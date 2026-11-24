package com.example.ui.auth

import android.net.Uri
import android.util.Log
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuthActionCodeException
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException

/**
 * Turns every Firebase Auth / Credential Manager failure into a clear Persian message
 * that says what went wrong and what to do. Raw codes are also logged under tag "AuthError".
 */
object AuthErrors {

    fun describe(e: Throwable): String {
        Log.e("AuthError", "${e.javaClass.simpleName}: ${e.message}", e)
        val code = (e as? FirebaseAuthException)?.errorCode.orEmpty()
        val msg = e.message.orEmpty()

        return when {
            e is FirebaseNetworkException ->
                "اتصال به سرور برقرار نشد. اینترنت را بررسی کنید (در صورت فیلتر بودن سرویس‌های گوگل، VPN را روشن کنید) و دوباره امتحان کنید."
            e is FirebaseTooManyRequestsException || code == "ERROR_TOO_MANY_REQUESTS" ->
                "تعداد تلاش‌ها زیاد بود. چند دقیقه صبر کنید و دوباره امتحان کنید."
            e is FirebaseAuthWeakPasswordException ->
                "رمز عبور ضعیف است؛ حداقل ۶ کاراکتر و ترکیبی از حرف و عدد استفاده کنید."
            e is FirebaseAuthUserCollisionException ->
                if (code == "ERROR_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL")
                    "این ایمیل قبلاً با روش دیگری (مثلاً گوگل) ثبت شده است. با همان روش وارد شوید."
                else "این ایمیل قبلاً ثبت شده است. وارد شوید یا «فراموشی رمز» را بزنید."
            e is FirebaseAuthActionCodeException ->
                "لینک یا کد بازیابی نامعتبر یا منقضی شده است. دوباره درخواست لینک بازیابی بدهید."
            e is FirebaseAuthInvalidUserException -> when (code) {
                "ERROR_USER_DISABLED" -> "این حساب توسط مدیر غیرفعال شده است."
                else -> "حسابی با این ایمیل پیدا نشد. ابتدا ثبت‌نام کنید."
            }
            e is FirebaseAuthInvalidCredentialsException -> when (code) {
                "ERROR_INVALID_EMAIL" -> "فرمت ایمیل درست نیست."
                "ERROR_WRONG_PASSWORD", "ERROR_INVALID_CREDENTIAL" ->
                    "ایمیل یا رمز عبور اشتباه است. اگر با گوگل ثبت‌نام کرده‌اید، از دکمه گوگل استفاده کنید."
                "ERROR_INVALID_ACTION_CODE", "ERROR_EXPIRED_ACTION_CODE" ->
                    "لینک یا کد بازیابی نامعتبر یا منقضی شده است. دوباره درخواست بدهید."
                else -> "اطلاعات ورود نامعتبر است ($code)."
            }
            code == "ERROR_OPERATION_NOT_ALLOWED" || msg.contains("OPERATION_NOT_ALLOWED") || msg.contains("CONFIGURATION_NOT_FOUND") ->
                "ورود با ایمیل در تنظیمات Firebase فعال نیست. مدیر باید در Firebase Console › Authentication › Sign-in method گزینه Email/Password را فعال کند."
            msg.contains("API key", ignoreCase = true) || msg.contains("API_KEY") ->
                "کلید API فایربیس معتبر نیست یا محدود شده است (google-services.json را بررسی کنید)."
            msg.contains("app-check", ignoreCase = true) || msg.contains("unauthorized", ignoreCase = true) ->
                "این نسخه از اپ برای پروژه فایربیس مجاز نیست (اثرانگشت SHA امضای اپ ثبت نشده)."
            e is GetCredentialCancellationException -> "ورود با گوگل لغو شد."
            e is NoCredentialException ->
                "حساب گوگلی برای ورود پیدا نشد. یک حساب گوگل به گوشی اضافه کنید. اگر حساب دارید، اثرانگشت SHA-1 امضای این نسخه در فایربیس ثبت نشده است."
            e is GetCredentialException && (msg.contains("16") || msg.contains("developer", true) || msg.contains("10:")) ->
                "ورود گوگل برای این نسخه پیکربندی نشده است (SHA-1 امضای اپ در Firebase ثبت نیست)."
            e is GetCredentialException ->
                "ورود با گوگل انجام نشد: ${e.type.substringAfterLast('.')}. سرویس‌های Google Play را به‌روز کنید و دوباره تلاش کنید."
            else -> "خطای غیرمنتظره: ${e.localizedMessage ?: e.javaClass.simpleName}"
        }
    }

    /**
     * Accepts the whole reset link from the email (or just the code) and returns the oobCode.
     * Handles the Firebase hosted handler link and links wrapped inside a "link" / "continueUrl" param.
     */
    fun extractOobCode(input: String): String? {
        val text = input.trim()
        if (text.isEmpty()) return null
        if (!text.contains("://") && !text.contains("oobCode")) {
            return text.takeIf { it.length >= 10 && !it.contains(' ') }
        }
        val urlStart = text.indexOf("http")
        val url = if (urlStart >= 0) text.substring(urlStart).substringBefore(' ').substringBefore('\n') else text
        return try {
            val uri = Uri.parse(url)
            uri.getQueryParameter("oobCode")
                ?: uri.getQueryParameter("link")?.let { Uri.parse(it).getQueryParameter("oobCode") }
                ?: uri.getQueryParameter("continueUrl")?.let { Uri.parse(it).getQueryParameter("oobCode") }
                ?: Regex("oobCode=([A-Za-z0-9_\\-]+)").find(text)?.groupValues?.get(1)
        } catch (_: Exception) {
            Regex("oobCode=([A-Za-z0-9_\\-]+)").find(text)?.groupValues?.get(1)
        }
    }
}
