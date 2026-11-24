package com.example.payments

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.example.MainActivity
import com.example.R
import com.example.data.model.PaymentPlan
import com.example.data.model.PaymentRequest
import com.example.data.model.PaymentStatus
import com.example.data.model.formatToman
import com.example.data.remote.CloudAdminRepository
import com.example.data.remote.PaymentRepository
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/** Local notifications to the admin about new payment receipts, with a one-tap "Approve" action. */
object PaymentNotifications {
    private const val CHANNEL_ID = "payment_requests"
    private const val PREFS = "payment_notify_prefs"
    private const val KEY_SEEN = "seen_ids"
    const val EXTRA_OPEN_PAYMENTS = "open_admin_payments"
    private const val WORK_NAME = "pending_payments_check"

    fun isAdminSignedIn(): Boolean =
        Firebase.auth.currentUser?.email?.trim()
            ?.equals(CloudAdminRepository.BOOTSTRAPPED_ADMIN_EMAIL, ignoreCase = true) == true

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = context.getSystemService(NotificationManager::class.java)
            if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
                mgr.createNotificationChannel(
                    NotificationChannel(CHANNEL_ID, "درخواست‌های پرداخت", NotificationManager.IMPORTANCE_HIGH).apply {
                        description = "اعلان فیش‌های واریزی جدید برای تایید مدیر"
                    }
                )
            }
        }
    }

    private fun canPost(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    fun notificationId(requestId: String): Int = 40_000 + (requestId.hashCode() and 0xFFFF)

    /** Notifies about pending requests not seen before. Returns how many were posted. */
    @Synchronized
    fun notifyUnseen(context: Context, requests: List<PaymentRequest>): Int {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val seen = prefs.getStringSet(KEY_SEEN, emptySet())!!.toMutableSet()
        val fresh = requests.filter {
            it.id.isNotBlank() && PaymentStatus.fromRaw(it.status) == PaymentStatus.PENDING && it.id !in seen
        }
        if (fresh.isEmpty()) return 0
        fresh.take(6).forEach { show(context, it) }
        seen.addAll(fresh.map { it.id })
        prefs.edit().putStringSet(KEY_SEEN, seen.toList().takeLast(500).toSet()).apply()
        return fresh.size
    }

    private fun show(context: Context, req: PaymentRequest) {
        if (!canPost(context)) return
        ensureChannel(context)
        val plan = PaymentPlan.fromRaw(req.plan)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_OPEN_PAYMENTS, true)
        }
        val openPi = PendingIntent.getActivity(
            context, notificationId(req.id), openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val approveIntent = Intent(context, PaymentActionReceiver::class.java).apply {
            action = PaymentActionReceiver.ACTION_APPROVE
            putExtra(PaymentActionReceiver.EXTRA_REQUEST_ID, req.id)
        }
        val approvePi = PendingIntent.getBroadcast(
            context, notificationId(req.id), approveIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val details = buildString {
            append("${plan.labelFa} • ${formatToman(req.amountToman)}")
            if (req.trackingCode.isNotBlank()) append("\nکد پیگیری: ${req.trackingCode}")
            if (req.receiptImage.isNotBlank()) append("\nتصویر فیش پیوست شده")
            if (req.userEmail.isNotBlank()) append("\n${req.userEmail}")
        }
        val n = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("فیش جدید از ${req.userName.ifBlank { "کاربر" }}")
            .setContentText("${plan.labelFa} • ${formatToman(req.amountToman)}")
            .setStyle(NotificationCompat.BigTextStyle().bigText(details))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(openPi)
            .addAction(0, "تایید و فعال‌سازی", approvePi)
            .addAction(0, "مشاهده فیش", openPi)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(notificationId(req.id), n)
        } catch (_: SecurityException) {
        }
    }

    fun showResult(context: Context, requestId: String, text: String) {
        if (!canPost(context)) return
        ensureChannel(context)
        val n = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("eSkyTell • پرداخت‌ها")
            .setContentText(text)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(notificationId(requestId), n)
        } catch (_: SecurityException) {
        }
    }

    /** Background check every 15 minutes while the app is closed (admin only). */
    fun schedule(context: Context) {
        val req = PeriodicWorkRequestBuilder<PendingPaymentsWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(context.applicationContext)
            .enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, req)
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context.applicationContext).cancelUniqueWork(WORK_NAME)
    }
}

class PendingPaymentsWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        if (!PaymentNotifications.isAdminSignedIn()) return Result.success()
        return try {
            val pending = PaymentRepository(applicationContext).fetchPendingRequests()
            PaymentNotifications.notifyUnseen(applicationContext, pending)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}

class PaymentActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_APPROVE = "com.example.payments.APPROVE"
        const val EXTRA_REQUEST_ID = "request_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_APPROVE) return
        val id = intent.getStringExtra(EXTRA_REQUEST_ID) ?: return
        val pending = goAsync()
        val appCtx = context.applicationContext
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                if (!PaymentNotifications.isAdminSignedIn()) {
                    PaymentNotifications.showResult(appCtx, id, "برای تایید باید با حساب مدیر وارد باشید.")
                } else {
                    val res = PaymentRepository(appCtx).approveById(id)
                    PaymentNotifications.showResult(
                        appCtx, id,
                        if (res.isSuccess) "تایید شد؛ اشتراک کاربر فعال شد."
                        else "تایید ناموفق: ${res.exceptionOrNull()?.message ?: "خطا"}"
                    )
                }
            } finally {
                pending.finish()
            }
        }
    }
}
