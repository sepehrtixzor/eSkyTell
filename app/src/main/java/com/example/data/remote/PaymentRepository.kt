package com.example.data.remote

import android.content.Context
import com.example.R
import com.example.data.model.BankCardInfo
import com.example.data.model.CryptoWalletInfo
import com.example.data.model.PaymentConfig
import com.example.data.model.PaymentMethod
import com.example.data.model.PaymentPlan
import com.example.data.model.PaymentRequest
import com.example.data.model.PaymentStatus
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.util.Date

/**
 * Card-to-card / crypto manual payments.
 *  - payment_config/main     : cards, wallets and toman prices (admin edits)
 *  - payment_requests/{id}   : a user's receipt (tracking code and/or image), approved by admin
 *    in the app or by the Telegram bridge bot (telegram_bridge/bridge.py).
 */
class PaymentRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        )
    )

    private val configRef get() = db.collection("payment_config").document("main")
    private val requestsCol get() = db.collection("payment_requests")

    fun observeConfig(): Flow<PaymentConfig> =
        configRef.snapshots()
            .map { snap ->
                if (snap.exists()) {
                    snap.toObject(PaymentConfig::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                        ?: PaymentConfig()
                } else PaymentConfig()
            }
            .catch { e -> if (e is CancellationException) throw e; emit(PaymentConfig()) }

    fun observeMyRequests(userId: String): Flow<List<PaymentRequest>> =
        requestsCol.whereEqualTo("userId", userId)
            .snapshots()
            .map { snap ->
                snap.toObjects(PaymentRequest::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                    .sortedByDescending { it.createdAt?.seconds ?: Long.MAX_VALUE }
            }
            .catch { e -> if (e is CancellationException) throw e; emit(emptyList()) }

    fun observeAllRequestsForAdmin(): Flow<List<PaymentRequest>> =
        requestsCol.snapshots()
            .map { snap ->
                snap.toObjects(PaymentRequest::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                    .sortedByDescending { it.createdAt?.seconds ?: Long.MAX_VALUE }
            }
            .catch { e -> if (e is CancellationException) throw e; emit(emptyList()) }

    suspend fun saveConfig(
        monthlyToman: Long,
        yearlyToman: Long,
        instructions: String,
        cards: List<BankCardInfo>,
        wallets: List<CryptoWalletInfo>
    ): Result<Unit> = runCatchingFs {
        val payload = mapOf(
            "monthlyPriceToman" to monthlyToman.coerceIn(0L, 10_000_000_000L),
            "yearlyPriceToman" to yearlyToman.coerceIn(0L, 10_000_000_000L),
            "instructions" to instructions.trim().take(800),
            "cards" to cards.take(20).map {
                mapOf(
                    "id" to it.id.take(40),
                    "bankName" to it.bankName.trim().take(60),
                    "cardNumber" to it.cardNumber.filter { c -> c.isDigit() }.take(19),
                    "holderName" to it.holderName.trim().take(80),
                    "sheba" to it.sheba.trim().uppercase().take(34),
                    "active" to it.active
                )
            },
            "wallets" to wallets.take(20).map {
                mapOf(
                    "id" to it.id.take(40),
                    "coin" to it.coin.trim().take(30),
                    "network" to it.network.trim().take(30),
                    "address" to it.address.trim().take(200),
                    "note" to it.note.trim().take(200),
                    "active" to it.active
                )
            },
            "updatedAt" to FieldValue.serverTimestamp()
        )
        configRef.set(payload).await()
    }

    suspend fun submitRequest(
        plan: PaymentPlan,
        amountToman: Long,
        method: PaymentMethod,
        destination: String,
        trackingCode: String,
        receiptImageBase64: String
    ): Result<Unit> = runCatchingFs {
        val user = auth.currentUser ?: throw IllegalStateException("ابتدا وارد حساب شوید.")
        val code = trackingCode.trim().take(100)
        require(code.isNotEmpty() || receiptImageBase64.isNotEmpty()) {
            "کد پیگیری یا تصویر فیش را وارد کنید."
        }
        require(receiptImageBase64.length <= 900_000) { "حجم تصویر زیاد است." }
        val doc = requestsCol.document()
        val payload = mutableMapOf<String, Any>(
            "userId" to user.uid,
            "userEmail" to (user.email ?: "").take(200),
            "userName" to (user.displayName?.takeIf { it.isNotBlank() } ?: user.email?.substringBefore("@") ?: "کاربر").take(100),
            "plan" to plan.name,
            "amountToman" to amountToman,
            "method" to method.name,
            "destination" to destination.take(250),
            "trackingCode" to code,
            "receiptImage" to receiptImageBase64,
            "status" to PaymentStatus.PENDING.name,
            "createdAt" to FieldValue.serverTimestamp()
        )
        doc.set(payload).await()
    }

    /** Approves the request and extends the user's subscription atomically. */
    suspend fun approveRequest(request: PaymentRequest, note: String): Result<Unit> = runCatchingFs {
        val adminUid = auth.currentUser?.uid ?: throw IllegalStateException("ورود لازم است.")
        val reqRef = requestsCol.document(request.id)
        val userRef = db.collection("users").document(request.userId)
        db.runTransaction { tx ->
            val reqSnap = tx.get(reqRef)
            val status = reqSnap.getString("status")
            if (status != PaymentStatus.PENDING.name) {
                throw IllegalStateException("این درخواست قبلاً بررسی شده است.")
            }
            val userSnap = tx.get(userRef)
            val plan = PaymentPlan.fromRaw(reqSnap.getString("plan") ?: request.plan)
            val now = Date()
            val currentExpiry = userSnap.getTimestamp("subscriptionExpiresAt")?.toDate()
            val base = if (currentExpiry != null && currentExpiry.after(now)) currentExpiry else now
            val newExpiry = Date(base.time + plan.days * 24L * 60L * 60L * 1000L)
            tx.update(
                reqRef, mapOf(
                    "status" to PaymentStatus.APPROVED.name,
                    "adminNote" to note.trim().take(300),
                    "reviewedBy" to adminUid,
                    "reviewedAt" to FieldValue.serverTimestamp()
                )
            )
            if (userSnap.exists()) {
                tx.update(
                    userRef, mapOf(
                        "hasActiveSubscription" to true,
                        "subscriptionTier" to plan.tier.name,
                        "subscriptionExpiresAt" to Timestamp(newExpiry),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                )
            }
            null
        }.await()
    }

    suspend fun fetchRequest(id: String): PaymentRequest? =
        requestsCol.document(id).get().await().toObject(PaymentRequest::class.java)

    suspend fun fetchPendingRequests(): List<PaymentRequest> =
        requestsCol.whereEqualTo("status", PaymentStatus.PENDING.name).get().await()
            .toObjects(PaymentRequest::class.java)

    suspend fun approveById(id: String): Result<Unit> {
        val req = try { fetchRequest(id) } catch (e: Exception) { return Result.failure(e) }
            ?: return Result.failure(IllegalStateException("درخواست پیدا نشد."))
        return approveRequest(req, "تایید از نوتیفیکیشن")
    }

    suspend fun rejectRequest(request: PaymentRequest, note: String): Result<Unit> = runCatchingFs {
        val adminUid = auth.currentUser?.uid ?: throw IllegalStateException("ورود لازم است.")
        requestsCol.document(request.id).update(
            mapOf(
                "status" to PaymentStatus.REJECTED.name,
                "adminNote" to note.trim().take(300),
                "reviewedBy" to adminUid,
                "reviewedAt" to FieldValue.serverTimestamp()
            )
        ).await()
    }

    suspend fun deleteRequest(id: String): Result<Unit> = runCatchingFs {
        requestsCol.document(id).delete().await()
    }

    private inline fun runCatchingFs(block: () -> Unit): Result<Unit> = try {
        block(); Result.success(Unit)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        Result.failure(e)
    }
}
