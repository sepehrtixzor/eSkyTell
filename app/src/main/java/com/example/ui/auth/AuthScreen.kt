package com.example.ui.auth

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.BluetoothConnected
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Sms
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.material.icons.rounded.Email
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import com.example.R
import com.example.ui.theme.ChampagneGold
import com.example.ui.theme.JakartaNumericFamily
import com.example.ui.theme.MintJade
import com.example.ui.theme.RoseError

@Composable
fun AuthScreen(
    onAuthSuccess: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember(context) { CredentialManager.create(context) }

    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var infoMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        attemptAutoSignIn(
            context = context,
            credentialManager = credentialManager,
            onAuthSuccess = onAuthSuccess,
            onUnauthenticated = {},
            scope = scope
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.background,
                        Color(0xFF0C1F1B),
                        MaterialTheme.colorScheme.background
                    )
                )
            )
            .windowInsetsPadding(WindowInsets.safeDrawing),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 520.dp)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(210.dp)
                    .clip(MaterialTheme.shapes.extraLarge)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.img_eskytell_obsidian),
                    contentDescription = "eSkyTell Second Phone Bridge",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color(0x3309110F),
                                    Color(0xE609110F)
                                )
                            )
                        )
                )
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.5.dp, MintJade.copy(alpha = 0.65f)),
                        modifier = Modifier.size(64.dp)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.ic_eskytell_logo),
                            contentDescription = "لوگوی eSkyTell",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = "eSkyTell",
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontFamily = JakartaNumericFamily,
                            fontWeight = FontWeight.Bold
                        ),
                        color = MintJade
                    )
                    Text(
                        text = "پل هوشمند تماس و پیامک گوشی دوم",
                        style = MaterialTheme.typography.titleSmall,
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)),
                shape = MaterialTheme.shapes.large,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    FeatureHighlightRow(
                        icon = Icons.Rounded.Call,
                        tint = MintJade,
                        title = "شماره‌گیر و تماس یکپارچه",
                        subtitle = "محیط ساده و آشنا با پشتیبانی دو سیم‌کارت (SIM 1 / SIM 2)"
                    )
                    FeatureHighlightRow(
                        icon = Icons.Rounded.Sms,
                        tint = ChampagneGold,
                        title = "گفتگوهای پیامکی مرتب",
                        subtitle = "صندوق پیام رشته‌ای با پاسخ سریع و همگام‌سازی بلوتوثی"
                    )
                    FeatureHighlightRow(
                        icon = Icons.Rounded.BluetoothConnected,
                        tint = MintJade,
                        title = "اتصال مستقیم آیفون و اندروید",
                        subtitle = "انتقال بلوتوثی رمزنگاری‌شده بدون نیاز به سرور واسط"
                    )
                }
            }

            EmailAuthCard(
                enabled = !isLoading,
                onBusy = { busy -> isLoading = busy },
                onError = { msg -> errorMessage = msg },
                onInfo = { msg -> infoMessage = msg },
                onAuthSuccess = onAuthSuccess
            )

            infoMessage?.let { msg ->
                Surface(
                    color = MintJade.copy(alpha = 0.14f),
                    border = BorderStroke(1.dp, MintJade.copy(alpha = 0.5f)),
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(text = msg, style = MaterialTheme.typography.bodySmall, color = MintJade, modifier = Modifier.padding(12.dp))
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                HorizontalDivider(modifier = Modifier.weight(1f))
                Text("  یا  ", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                HorizontalDivider(modifier = Modifier.weight(1f))
            }

            errorMessage?.let { msg ->
                Surface(
                    color = RoseError.copy(alpha = 0.14f),
                    border = BorderStroke(1.dp, RoseError.copy(alpha = 0.5f)),
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = msg,
                        style = MaterialTheme.typography.bodySmall,
                        color = RoseError,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            Button(
                onClick = {
                    isLoading = true
                    errorMessage = null
                    onGoogleSignInClicked(
                        context = context,
                        credentialManager = credentialManager,
                        onAuthSuccess = {
                            isLoading = false
                            onAuthSuccess()
                        },
                        onAuthError = { msg ->
                            isLoading = false
                            errorMessage = msg
                        },
                        scope = scope,
                        onAuthCancelled = {
                            isLoading = false
                        }
                    )
                },
                enabled = !isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .testTag("google_sign_in_button")
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        imageVector = Icons.Rounded.Shield,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = "ورود امن با حساب گوگل",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Text(
                text = "نسخه فعلی رایگان است و تنظیمات، آپدیت‌ها و اشتراک شما به‌صورت امن همگام‌سازی می‌شود.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun FeatureHighlightRow(
    icon: ImageVector,
    tint: Color,
    title: String,
    subtitle: String
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Surface(
            color = tint.copy(alpha = 0.14f),
            shape = CircleShape,
            modifier = Modifier.size(40.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(imageVector = icon, contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Text(text = subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}


@Composable
private fun EmailAuthCard(
    enabled: Boolean,
    onBusy: (Boolean) -> Unit,
    onError: (String?) -> Unit,
    onInfo: (String?) -> Unit,
    onAuthSuccess: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var isRegister by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }

    fun mapError(e: Exception): String = AuthErrors.describe(e)
    var showReset by remember { mutableStateOf(false) }

    if (showReset) {
        PasswordResetDialog(
            initialEmail = email,
            onDismiss = { showReset = false },
            onResetDone = { resetEmail, newPassword ->
                showReset = false
                email = resetEmail
                password = newPassword
                scope.launch {
                    onBusy(true)
                    try {
                        Firebase.auth.signInWithEmailAndPassword(resetEmail, newPassword).await()
                        onInfo("رمز عبور تغییر کرد و وارد شدید.")
                        onAuthSuccess()
                    } catch (e: Exception) {
                        onInfo("رمز عبور تغییر کرد. اکنون با رمز جدید وارد شوید.")
                    } finally {
                        onBusy(false)
                    }
                }
            }
        )
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)),
        shape = MaterialTheme.shapes.large,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                text = if (isRegister) "ساخت حساب با ایمیل" else "ورود با ایمیل",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            OutlinedTextField(
                value = email,
                onValueChange = { email = it.trim() },
                label = { Text("ایمیل") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                modifier = Modifier.fillMaxWidth().testTag("email_field")
            )
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("رمز عبور") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth().testTag("password_field")
            )
            if (isRegister) {
                OutlinedTextField(
                    value = confirm,
                    onValueChange = { confirm = it },
                    label = { Text("تکرار رمز عبور") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth()
                )
            }
            Button(
                enabled = enabled,
                onClick = {
                    onError(null); onInfo(null)
                    if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                        onError("ایمیل معتبر وارد کنید."); return@Button
                    }
                    if (password.length < 6) {
                        onError("رمز عبور باید حداقل ۶ کاراکتر باشد."); return@Button
                    }
                    if (isRegister && password != confirm) {
                        onError("تکرار رمز عبور یکسان نیست."); return@Button
                    }
                    scope.launch {
                        onBusy(true)
                        try {
                            if (isRegister) {
                                val res = Firebase.auth.createUserWithEmailAndPassword(email.lowercase(), password).await()
                                runCatching { res.user?.sendEmailVerification()?.await() }
                                onInfo("حساب ساخته شد. لینک تأیید به ایمیل شما ارسال شد.")
                            } else {
                                Firebase.auth.signInWithEmailAndPassword(email.lowercase(), password).await()
                            }
                            onAuthSuccess()
                        } catch (e: Exception) {
                            onError(mapError(e))
                        } finally {
                            onBusy(false)
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(50.dp).testTag("email_auth_button")
            ) {
                Icon(Icons.Rounded.Email, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(if (isRegister) "ثبت‌نام" else "ورود", fontWeight = FontWeight.Bold)
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = { isRegister = !isRegister; confirm = ""; onError(null); onInfo(null) }) {
                    Text(if (isRegister) "حساب دارید؟ ورود" else "حساب ندارید؟ ثبت‌نام")
                }
                if (!isRegister) {
                    TextButton(onClick = {
                        onError(null); onInfo(null)
                        showReset = true
                    }) { Text("فراموشی رمز") }
                }
            }
        }
    }
}


@Composable
private fun PasswordResetDialog(
    initialEmail: String,
    onDismiss: () -> Unit,
    onResetDone: (email: String, newPassword: String) -> Unit
) {
    val scope = rememberCoroutineScope()
    val clipboard = androidx.compose.ui.platform.LocalClipboardManager.current
    var step by remember { mutableStateOf(0) }
    var resetEmail by remember { mutableStateOf(initialEmail.trim()) }
    var linkOrCode by remember { mutableStateOf("") }
    var newPass by remember { mutableStateOf("") }
    var newPass2 by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var info by remember { mutableStateOf<String?>(null) }

    androidx.compose.material3.AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(if (step == 0) "بازیابی رمز عبور" else "تعیین رمز جدید") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (step == 0) {
                    Text(
                        "ایمیل حساب را وارد کنید تا لینک بازیابی برایتان ارسال شود.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedTextField(
                        value = resetEmail,
                        onValueChange = { resetEmail = it.trim() },
                        label = { Text("ایمیل") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    Text(
                        "ایمیل بازیابی ارسال شد (پوشه اسپم را هم ببینید). روی لینک داخل ایمیل نزنید؛ انگشت را روی لینک نگه دارید، «کپی لینک» را بزنید و اینجا بچسبانید. سپس رمز جدید را وارد کنید.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedTextField(
                        value = linkOrCode,
                        onValueChange = { linkOrCode = it },
                        label = { Text("لینک یا کد بازیابی از ایمیل") },
                        maxLines = 3,
                        trailingIcon = {
                            TextButton(onClick = {
                                clipboard.getText()?.text?.let { linkOrCode = it }
                            }) { Text("چسباندن") }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = newPass,
                        onValueChange = { newPass = it },
                        label = { Text("رمز جدید (حداقل ۶ کاراکتر)") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = newPass2,
                        onValueChange = { newPass2 = it },
                        label = { Text("تکرار رمز جدید") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth()
                    )
                    TextButton(
                        enabled = !busy,
                        onClick = {
                            error = null
                            scope.launch {
                                busy = true
                                try {
                                    Firebase.auth.sendPasswordResetEmail(resetEmail.lowercase()).await()
                                    info = "ایمیل بازیابی دوباره ارسال شد."
                                } catch (e: Exception) {
                                    error = AuthErrors.describe(e)
                                } finally {
                                    busy = false
                                }
                            }
                        }
                    ) { Text("ارسال دوباره ایمیل") }
                }
                info?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall) }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                if (busy) {
                    androidx.compose.material3.LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !busy,
                onClick = {
                    error = null; info = null
                    if (step == 0) {
                        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(resetEmail).matches()) {
                            error = "ایمیل معتبر وارد کنید."; return@Button
                        }
                        scope.launch {
                            busy = true
                            try {
                                Firebase.auth.sendPasswordResetEmail(resetEmail.lowercase()).await()
                                step = 1
                            } catch (e: Exception) {
                                error = AuthErrors.describe(e)
                            } finally {
                                busy = false
                            }
                        }
                    } else {
                        val code = AuthErrors.extractOobCode(linkOrCode)
                        when {
                            code == null -> { error = "لینک یا کد بازیابی را از ایمیل کپی و اینجا بچسبانید."; return@Button }
                            newPass.length < 6 -> { error = "رمز جدید باید حداقل ۶ کاراکتر باشد."; return@Button }
                            newPass != newPass2 -> { error = "تکرار رمز یکسان نیست."; return@Button }
                        }
                        scope.launch {
                            busy = true
                            try {
                                val accountEmail = Firebase.auth.verifyPasswordResetCode(code!!).await()
                                Firebase.auth.confirmPasswordReset(code, newPass).await()
                                onResetDone(accountEmail ?: resetEmail, newPass)
                            } catch (e: Exception) {
                                error = AuthErrors.describe(e)
                            } finally {
                                busy = false
                            }
                        }
                    }
                }
            ) { Text(if (step == 0) "ارسال لینک بازیابی" else "ثبت رمز جدید") }
        },
        dismissButton = {
            TextButton(enabled = !busy, onClick = onDismiss) { Text("بستن") }
        }
    )
}
