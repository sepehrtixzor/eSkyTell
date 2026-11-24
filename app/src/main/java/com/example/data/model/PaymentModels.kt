package com.example.data.model

import androidx.annotation.Keep
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import java.util.Locale

enum class PaymentPlan(val labelFa: String, val days: Long, val tier: SubscriptionTier) {
    MONTHLY("اشتراک ماهانه", 30L, SubscriptionTier.MONTHLY),
    YEARLY("اشتراک سالانه", 365L, SubscriptionTier.YEARLY);

    companion object {
        fun fromRaw(raw: String): PaymentPlan = entries.firstOrNull { it.name == raw } ?: MONTHLY
    }
}

enum class PaymentMethod(val labelFa: String) {
    CARD("کارت به کارت"),
    CRYPTO("ارز دیجیتال");

    companion object {
        fun fromRaw(raw: String): PaymentMethod = entries.firstOrNull { it.name == raw } ?: CARD
    }
}

enum class PaymentStatus(val labelFa: String) {
    PENDING("در انتظار بررسی"),
    APPROVED("تایید شد"),
    REJECTED("رد شد");

    companion object {
        fun fromRaw(raw: String): PaymentStatus = entries.firstOrNull { it.name == raw } ?: PENDING
    }
}

@Keep
@IgnoreExtraProperties
data class BankCardInfo(
    val id: String = "",
    val bankName: String = "",
    val cardNumber: String = "",
    val holderName: String = "",
    val sheba: String = "",
    val active: Boolean = true
)

@Keep
@IgnoreExtraProperties
data class CryptoWalletInfo(
    val id: String = "",
    val coin: String = "",
    val network: String = "",
    val address: String = "",
    val note: String = "",
    val active: Boolean = true
)

@Keep
@IgnoreExtraProperties
data class PaymentConfig(
    @DocumentId val id: String = "main",
    val monthlyPriceToman: Long = 99_000L,
    val yearlyPriceToman: Long = 790_000L,
    val cards: List<BankCardInfo> = emptyList(),
    val wallets: List<CryptoWalletInfo> = emptyList(),
    val instructions: String = "مبلغ پلن را به یکی از کارت‌ها یا کیف پول‌های زیر واریز کنید، سپس کد پیگیری یا تصویر فیش را ارسال کنید. پس از تایید، اشتراک شما خودکار فعال می‌شود.",
    val updatedAt: Timestamp? = null
) {
    fun priceFor(plan: PaymentPlan): Long = when (plan) {
        PaymentPlan.MONTHLY -> monthlyPriceToman
        PaymentPlan.YEARLY -> yearlyPriceToman
    }
}

@Keep
@IgnoreExtraProperties
data class PaymentRequest(
    @DocumentId val id: String = "",
    val userId: String = "",
    val userEmail: String = "",
    val userName: String = "",
    val plan: String = PaymentPlan.MONTHLY.name,
    val amountToman: Long = 0L,
    val method: String = PaymentMethod.CARD.name,
    val destination: String = "",
    val trackingCode: String = "",
    val receiptImage: String = "",
    val status: String = PaymentStatus.PENDING.name,
    val adminNote: String = "",
    val reviewedBy: String = "",
    val createdAt: Timestamp? = null,
    val reviewedAt: Timestamp? = null
)

fun formatToman(amount: Long): String {
    val grouped = String.format(Locale.US, "%,d", amount)
    val fa = grouped.map { ch -> if (ch in '0'..'9') ('۰' + (ch - '0')) else ch }.joinToString("")
    return "$fa تومان"
}
