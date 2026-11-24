package com.example.data.model

import androidx.annotation.Keep
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

enum class AnnouncementCategory(val labelFa: String) {
    FEATURE("قابلیت جدید"),
    UPDATE("آپدیت سیستم"),
    TIP("راهنما و ترفند"),
    USSD("کد دستوری");

    companion object {
        fun fromRaw(raw: String): AnnouncementCategory =
            entries.firstOrNull { it.name == raw } ?: FEATURE
    }
}

enum class SubscriptionTier(val labelFa: String) {
    FREE("رایگان"),
    MONTHLY("اشتراک ماهانه"),
    YEARLY("اشتراک سالانه"),
    LIFETIME("اشتراک دائمی");

    companion object {
        fun fromRaw(raw: String): SubscriptionTier =
            entries.firstOrNull { it.name == raw } ?: FREE
    }
}

@Keep
@IgnoreExtraProperties
data class AppGlobalConfig(
    @DocumentId val id: String = "global",
    val subscriptionRequired: Boolean = false,
    val monthlyPriceLabel: String = "۹۹,۰۰۰ تومان / ماه",
    val yearlyPriceLabel: String = "۷۹۰,۰۰۰ تومان / سال",
    val freeTrialDays: Long = 7L,
    val paywallMessage: String = "برای استفاده نامحدود از پل بلوتوثی تماس و پیامک، اشتراک eSkyTell Pro را فعال کنید.",
    val paymentUrl: String = "",
    val latestVersionName: String = "1.0.0",
    val latestVersionCode: Long = 1L,
    val updateNotes: String = "",
    val updateUrl: String = "",
    val forceUpdate: Boolean = false,
    val enableDualSim: Boolean = true,
    val enableQuickTemplates: Boolean = true,
    val enableQuietHours: Boolean = true,
    val enableBleGattBridge: Boolean = true,
    val updatedBy: String = "system",
    val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class AnnouncementModule(
    @DocumentId val id: String = "",
    val title: String = "",
    val summary: String = "",
    val category: String = AnnouncementCategory.FEATURE.name,
    val actionLabel: String = "",
    val actionValue: String = "",
    val published: Boolean = true,
    val createdBy: String = "",
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)

@Keep
@IgnoreExtraProperties
data class UserProfile(
    @DocumentId val id: String = "",
    val userId: String = "",
    val email: String = "",
    val displayName: String = "",
    val photoUrl: String = "",
    val sim1Label: String = "SIM 1 • خط کاری",
    val sim2Label: String = "SIM 2 • خط شخصی",
    val hasActiveSubscription: Boolean = false,
    val subscriptionTier: String = SubscriptionTier.FREE.name,
    val subscriptionExpiresAt: Timestamp? = null,
    val createdAt: Timestamp? = null,
    val updatedAt: Timestamp? = null
)
