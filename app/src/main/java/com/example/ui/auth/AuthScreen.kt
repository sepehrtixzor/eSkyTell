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

    fun mapError(e: Exception): String = when (e) {
        is FirebaseAuthWeakPasswordException -> "رمز عبور باید حداقل ۶ کاراکتر باشد."
        is FirebaseAuthUserCollisionException -> "این ایمیل قبلاً ثبت شده است. وارد شوید."
        is FirebaseAuthInvalidUserException -> "حسابی با این ایمیل پیدا نشد."
        is FirebaseAuthInvalidCredentialsException -> "ایمیل یا رمز عبور اشتباه است."
        else -> "خطا: ${e.localizedMessage ?: "ارتباط برقرار نشد"}"
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
                                val res = Firebase.auth.createUserWithEmailAndPassword(email, password).await()
                                runCatching { res.user?.sendEmailVerification()?.await() }
                            } else {
                                Firebase.auth.signInWithEmailAndPassword(email, password).await()
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
                TextButton(onClick = { isRegister = !isRegister; onError(null) }) {
                    Text(if (isRegister) "حساب دارید؟ ورود" else "حساب ندارید؟ ثبت‌نام")
                }
                if (!isRegister) {
                    TextButton(onClick = {
                        onError(null); onInfo(null)
                        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                            onError("برای بازیابی، ابتدا ایمیل را وارد کنید."); return@TextButton
                        }
                        scope.launch {
                            try {
                                Firebase.auth.sendPasswordResetEmail(email).await()
                                onInfo("لینک بازیابی رمز به ایمیل شما ارسال شد.")
                            } catch (e: Exception) {
                                onError(mapError(e))
                            }
                        }
                    }) { Text("فراموشی رمز") }
                }
            }
        }
    }
}
