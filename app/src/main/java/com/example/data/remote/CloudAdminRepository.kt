package com.example.data.remote

import android.content.Context
import com.example.R
import com.example.data.model.AnnouncementCategory
import com.example.data.model.AnnouncementModule
import com.example.data.model.AppGlobalConfig
import com.example.data.model.SubscriptionTier
import com.example.data.model.UserProfile
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.util.Date

class CloudAdminRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth = Firebase.auth
) {
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        )
    )

    companion object {
        const val BOOTSTRAPPED_ADMIN_EMAIL = "sepehrtixzor1@gmail.com"
        private const val CONFIG_DOC_ID = "global"
    }

    private fun requireUserId(): String {
        return auth.currentUser?.uid
            ?: throw IllegalStateException("کاربر باید ابتدا وارد حساب گوگل شود.")
    }

    fun isCurrentUserAdmin(user: FirebaseUser? = auth.currentUser): Boolean {
        val email = user?.email?.lowercase()?.trim()
        return email == BOOTSTRAPPED_ADMIN_EMAIL
    }

    fun observeGlobalConfig(): Flow<AppGlobalConfig> = flow {
        val uid = requireUserId()
        if (uid.isBlank()) throw IllegalStateException("شناسه کاربری نامعتبر است.")
        val docRef = db.collection("app_config").document(CONFIG_DOC_ID)
        emitAll(
            docRef.snapshots()
                .map { snapshot ->
                    if (snapshot.exists()) {
                        snapshot.toObject(
                            AppGlobalConfig::class.java,
                            DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                        ) ?: AppGlobalConfig()
                    } else {
                        AppGlobalConfig()
                    }
                }
                .retryFirestoreListener(auth, uid, OperationType.GET, docRef.path) { AppGlobalConfig() }
        )
    }

    fun observePublishedAnnouncements(): Flow<List<AnnouncementModule>> = flow {
        val uid = requireUserId()
        val path = "announcements"
        emitAll(
            db.collection(path)
                .whereEqualTo("published", true)
                .snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        AnnouncementModule::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt?.seconds ?: 0L }
                }
                .retryFirestoreListener(auth, uid, OperationType.LIST, path) { emptyList() }
        )
    }

    fun observeAllAnnouncementsForAdmin(): Flow<List<AnnouncementModule>> = flow {
        val uid = requireUserId()
        val path = "announcements"
        emitAll(
            db.collection(path)
                .snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        AnnouncementModule::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.createdAt?.seconds ?: 0L }
                }
                .retryFirestoreListener(auth, uid, OperationType.LIST, path) { emptyList() }
        )
    }

    fun observeCurrentUserProfile(userId: String): Flow<UserProfile?> = flow {
        val uid = requireUserId()
        check(uid == userId) { "عدم تطابق شناسه کاربر" }
        val docRef = db.collection("users").document(userId)
        emitAll(
            docRef.snapshots()
                .map { snapshot ->
                    if (snapshot.exists()) {
                        snapshot.toObject(
                            UserProfile::class.java,
                            DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                        )
                    } else null
                }
                .retryFirestoreListener(auth, uid, OperationType.GET, docRef.path) { null }
        )
    }

    fun observeAllUsersForAdmin(): Flow<List<UserProfile>> = flow {
        val uid = requireUserId()
        val path = "users"
        emitAll(
            db.collection(path)
                .snapshots()
                .map { snapshot ->
                    snapshot.toObjects(
                        UserProfile::class.java,
                        DocumentSnapshot.ServerTimestampBehavior.ESTIMATE
                    ).sortedByDescending { it.updatedAt?.seconds ?: 0L }
                }
                .retryFirestoreListener(auth, uid, OperationType.LIST, path) { emptyList() }
        )
    }

    suspend fun ensureUserProfile(user: FirebaseUser): Result<Unit> {
        val docPath = "users/${user.uid}"
        return try {
            val uid = requireUserId()
            check(uid == user.uid) { "کاربر تغییر کرده است." }
            val docRef = db.collection("users").document(uid)
            val snap = docRef.get().await()
            val safeName = (user.displayName?.takeIf { it.isNotBlank() } ?: user.email?.substringBefore("@") ?: "کاربر eSkyTell").take(100)
            val safeEmail = (user.email ?: "").take(200)
            val safePhoto = (user.photoUrl?.toString() ?: "").take(500)

            if (!snap.exists()) {
                val payload = mutableMapOf<String, Any>(
                    "userId" to uid,
                    "email" to safeEmail,
                    "displayName" to safeName,
                    "sim1Label" to "SIM 1 • خط کاری",
                    "sim2Label" to "SIM 2 • خط شخصی",
                    "hasActiveSubscription" to false,
                    "subscriptionTier" to SubscriptionTier.FREE.name,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                if (safePhoto.isNotBlank()) {
                    payload["photoUrl"] = safePhoto
                }
                docRef.set(payload).await()
            } else {
                val updateMap = mutableMapOf<String, Any>(
                    "displayName" to safeName,
                    "email" to safeEmail,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                if (safePhoto.isNotBlank()) {
                    updateMap["photoUrl"] = safePhoto
                }
                docRef.update(updateMap).await()
            }

            // If bootstrapped admin signs in and global config isn't created yet, seed defaults
            if (isCurrentUserAdmin(user)) {
                val configRef = db.collection("app_config").document(CONFIG_DOC_ID)
                val configSnap = configRef.get().await()
                if (!configSnap.exists()) {
                    saveGlobalConfig(AppGlobalConfig())
                }
            }
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, docPath)
            Result.failure(e)
        }
    }

    suspend fun updateSimLabels(sim1Label: String, sim2Label: String): Result<Unit> {
        var docPath = "users/${auth.currentUser?.uid ?: "unauthenticated"}"
        return try {
            val uid = requireUserId()
            val clean1 = sim1Label.trim().ifBlank { "SIM 1" }.take(40)
            val clean2 = sim2Label.trim().ifBlank { "SIM 2" }.take(40)
            val docRef = db.collection("users").document(uid)
            docPath = docRef.path
            docRef.update(
                mapOf(
                    "sim1Label" to clean1,
                    "sim2Label" to clean2,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun saveGlobalConfig(config: AppGlobalConfig): Result<Unit> {
        val docPath = "app_config/$CONFIG_DOC_ID"
        return try {
            val uid = requireUserId()
            val docRef = db.collection("app_config").document(CONFIG_DOC_ID)
            val payload = mutableMapOf<String, Any>(
                "subscriptionRequired" to config.subscriptionRequired,
                "monthlyPriceLabel" to config.monthlyPriceLabel.trim().take(80),
                "yearlyPriceLabel" to config.yearlyPriceLabel.trim().take(80),
                "freeTrialDays" to config.freeTrialDays.coerceIn(0L, 365L),
                "paywallMessage" to config.paywallMessage.trim().take(400),
                "paymentUrl" to config.paymentUrl.trim().take(500),
                "latestVersionName" to config.latestVersionName.trim().ifBlank { "1.0.0" }.take(32),
                "latestVersionCode" to config.latestVersionCode.coerceIn(1L, 100000L),
                "updateNotes" to config.updateNotes.trim().take(1000),
                "updateUrl" to config.updateUrl.trim().take(500),
                "forceUpdate" to config.forceUpdate,
                "enableDualSim" to config.enableDualSim,
                "enableQuickTemplates" to config.enableQuickTemplates,
                "enableQuietHours" to config.enableQuietHours,
                "enableBleGattBridge" to config.enableBleGattBridge,
                "updatedBy" to uid.take(128),
                "updatedAt" to FieldValue.serverTimestamp()
            )

            val existing = docRef.get().await()
            if (existing.exists()) {
                docRef.update(payload).await()
            } else {
                docRef.set(payload).await()
            }
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, docPath)
            Result.failure(e)
        }
    }

    suspend fun saveAnnouncement(
        existingId: String?,
        title: String,
        summary: String,
        category: AnnouncementCategory,
        actionLabel: String,
        actionValue: String,
        published: Boolean
    ): Result<Unit> {
        val cleanTitle = title.trim().take(120)
        val cleanSummary = summary.trim().take(600)
        require(cleanTitle.isNotEmpty() && cleanSummary.isNotEmpty()) {
            "عنوان و توضیحات نمی‌توانند خالی باشند."
        }

        var docPath = "announcements/${existingId ?: "new"}"
        return try {
            val uid = requireUserId()
            val col = db.collection("announcements")
            if (existingId.isNullOrBlank()) {
                val docRef = col.document()
                docPath = docRef.path
                val payload = mutableMapOf<String, Any>(
                    "title" to cleanTitle,
                    "summary" to cleanSummary,
                    "category" to category.name,
                    "published" to published,
                    "createdBy" to uid.take(128),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                if (actionLabel.isNotBlank()) payload["actionLabel"] = actionLabel.trim().take(40)
                if (actionValue.isNotBlank()) payload["actionValue"] = actionValue.trim().take(500)
                docRef.set(payload).await()
            } else {
                val docRef = col.document(existingId)
                docPath = docRef.path
                val payload = mutableMapOf<String, Any>(
                    "title" to cleanTitle,
                    "summary" to cleanSummary,
                    "category" to category.name,
                    "actionLabel" to actionLabel.trim().take(40),
                    "actionValue" to actionValue.trim().take(500),
                    "published" to published,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                docRef.update(payload).await()
            }
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, docPath)
            Result.failure(e)
        }
    }

    suspend fun toggleAnnouncementPublished(id: String, published: Boolean): Result<Unit> {
        val docPath = "announcements/$id"
        return try {
            requireUserId()
            require(id.isNotBlank()) { "شناسه نامعتبر است." }
            db.collection("announcements").document(id).update(
                mapOf(
                    "published" to published,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun deleteAnnouncement(id: String): Result<Unit> {
        val docPath = "announcements/$id"
        return try {
            requireUserId()
            require(id.isNotBlank()) { "شناسه نامعتبر است." }
            db.collection("announcements").document(id).delete().await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docPath)
            Result.failure(e)
        }
    }

    suspend fun setUserSubscription(
        targetUserId: String,
        hasActiveSubscription: Boolean,
        tier: SubscriptionTier
    ): Result<Unit> {
        val docPath = "users/$targetUserId"
        return try {
            requireUserId()
            require(targetUserId.isNotBlank()) { "شناسه کاربر نامعتبر است." }
            val upd = mutableMapOf<String, Any>(
                "hasActiveSubscription" to hasActiveSubscription,
                "subscriptionTier" to tier.name,
                "updatedAt" to FieldValue.serverTimestamp()
            )
            // Keep subscriptionExpiresAt consistent with the grant; otherwise an old, past expiry
            // keeps the user locked even after the admin activates a plan.
            if (tier == SubscriptionTier.LIFETIME || tier == SubscriptionTier.FREE || !hasActiveSubscription) {
                upd["subscriptionExpiresAt"] = FieldValue.delete()
            } else {
                val days = if (tier == SubscriptionTier.YEARLY) 365L else 30L
                upd["subscriptionExpiresAt"] =
                    Timestamp(Date(System.currentTimeMillis() + days * 86_400_000L))
            }
            db.collection("users").document(targetUserId).update(upd).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }
}
