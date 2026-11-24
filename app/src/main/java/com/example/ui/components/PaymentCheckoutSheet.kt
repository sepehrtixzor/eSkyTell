package com.example.ui.components

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AddPhotoAlternate
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.CreditCard
import androidx.compose.material.icons.rounded.CurrencyBitcoin
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.Cancel
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.data.model.AppGlobalConfig
import com.example.data.model.PaymentMethod
import com.example.data.model.PaymentPlan
import com.example.data.model.PaymentStatus
import com.example.data.model.formatToman
import com.example.ui.PaymentUiState
import com.example.ui.theme.ChampagneGold
import com.example.ui.theme.EmeraldSuccess
import com.example.ui.theme.MintJade
import com.example.ui.theme.RoseError

fun formatCardNumber(raw: String): String =
    raw.filter { it.isDigit() }.chunked(4).joinToString("-")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentCheckoutSheet(
    appConfig: AppGlobalConfig,
    paymentState: PaymentUiState,
    isSubscriptionActive: Boolean,
    onSubmit: (plan: PaymentPlan, method: PaymentMethod, destination: String, trackingCode: String, imageUri: Uri?) -> Unit,
    onDismiss: () -> Unit
) {
    val cfg = paymentState.config
    val clipboard = LocalClipboardManager.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var plan by remember { mutableStateOf(PaymentPlan.YEARLY) }
    var method by remember { mutableStateOf(PaymentMethod.CARD) }
    var selectedDestination by remember { mutableStateOf("") }
    var trackingCode by remember { mutableStateOf("") }
    var imageUri by remember { mutableStateOf<Uri?>(null) }
    var copiedLabel by remember { mutableStateOf<String?>(null) }

    val activeCards = cfg.cards.filter { it.active && it.cardNumber.isNotBlank() }
    val activeWallets = cfg.wallets.filter { it.active && it.address.isNotBlank() }
    val hasPending = paymentState.myRequests.any { PaymentStatus.fromRaw(it.status) == PaymentStatus.PENDING }

    LaunchedEffect(paymentState.submitSuccessTick) {
        if (paymentState.submitSuccessTick > 0) {
            trackingCode = ""
            imageUri = null
        }
    }

    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) imageUri = uri
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(color = ChampagneGold.copy(alpha = 0.18f), shape = CircleShape, modifier = Modifier.size(48.dp)) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Rounded.WorkspacePremium, null, tint = ChampagneGold, modifier = Modifier.size(26.dp))
                    }
                }
                Column {
                    Text("خرید اشتراک eSkyTell Pro", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(
                        if (isSubscriptionActive) "اشتراک شما فعال است؛ با خرید جدید تمدید می‌شود." else appConfig.paywallMessage,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (isSubscriptionActive) EmeraldSuccess else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // 1. Plan
            Text("۱. انتخاب پلن", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                PlanChoice(
                    title = "ماهانه",
                    price = formatToman(cfg.monthlyPriceToman),
                    sub = "۳۰ روز",
                    selected = plan == PaymentPlan.MONTHLY,
                    onClick = { plan = PaymentPlan.MONTHLY },
                    modifier = Modifier.weight(1f)
                )
                PlanChoice(
                    title = "سالانه",
                    price = formatToman(cfg.yearlyPriceToman),
                    sub = "۳۶۵ روز • به‌صرفه‌تر",
                    selected = plan == PaymentPlan.YEARLY,
                    onClick = { plan = PaymentPlan.YEARLY },
                    modifier = Modifier.weight(1f)
                )
            }

            // 2. Pay
            Text("۲. واریز ${formatToman(cfg.priceFor(plan))}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            if (cfg.instructions.isNotBlank()) {
                Text(cfg.instructions, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = method == PaymentMethod.CARD,
                    onClick = { method = PaymentMethod.CARD; selectedDestination = "" },
                    label = { Text("کارت به کارت") },
                    leadingIcon = { Icon(Icons.Rounded.CreditCard, null, modifier = Modifier.size(18.dp)) }
                )
                if (activeWallets.isNotEmpty()) {
                    FilterChip(
                        selected = method == PaymentMethod.CRYPTO,
                        onClick = { method = PaymentMethod.CRYPTO; selectedDestination = "" },
                        label = { Text("ارز دیجیتال") },
                        leadingIcon = { Icon(Icons.Rounded.CurrencyBitcoin, null, modifier = Modifier.size(18.dp)) }
                    )
                }
            }

            if (method == PaymentMethod.CARD) {
                if (activeCards.isEmpty()) {
                    InfoBox("هنوز شماره کارتی توسط مدیریت ثبت نشده است.")
                }
                activeCards.forEach { card ->
                    val dest = "${card.bankName} ${card.cardNumber} (${card.holderName})"
                    DestinationCard(
                        title = card.bankName.ifBlank { "کارت بانکی" },
                        mainValue = formatCardNumber(card.cardNumber),
                        lines = listOfNotNull(
                            card.holderName.takeIf { it.isNotBlank() }?.let { "به نام: $it" },
                            card.sheba.takeIf { it.isNotBlank() }?.let { "شبا: $it" }
                        ),
                        selected = selectedDestination == dest,
                        onSelect = { selectedDestination = dest },
                        onCopy = {
                            clipboard.setText(AnnotatedString(card.cardNumber))
                            copiedLabel = "شماره کارت کپی شد"
                        }
                    )
                }
            } else {
                activeWallets.forEach { w ->
                    val dest = "${w.coin} ${w.network}: ${w.address}"
                    DestinationCard(
                        title = listOf(w.coin, w.network).filter { it.isNotBlank() }.joinToString(" • ").ifBlank { "کیف پول" },
                        mainValue = w.address,
                        lines = listOfNotNull(w.note.takeIf { it.isNotBlank() }),
                        selected = selectedDestination == dest,
                        onSelect = { selectedDestination = dest },
                        onCopy = {
                            clipboard.setText(AnnotatedString(w.address))
                            copiedLabel = "آدرس کیف پول کپی شد"
                        }
                    )
                }
            }
            copiedLabel?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MintJade) }

            // 3. Receipt
            Text("۳. ثبت فیش واریزی", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            OutlinedTextField(
                value = trackingCode,
                onValueChange = { trackingCode = it.take(100) },
                label = { Text(if (method == PaymentMethod.CRYPTO) "هش تراکنش (TxID)" else "کد پیگیری / شماره مرجع") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("payment_tracking_code")
            )
            OutlinedButton(
                onClick = { pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(if (imageUri != null) Icons.Rounded.CheckCircle else Icons.Rounded.AddPhotoAlternate, null,
                    tint = if (imageUri != null) EmeraldSuccess else MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text(if (imageUri != null) "تصویر فیش انتخاب شد (تغییر)" else "آپلود تصویر فیش (اختیاری)")
            }

            val configReady = paymentState.configLoaded
            val destinationOk = selectedDestination.isNotBlank() ||
                (activeCards.isEmpty() && activeWallets.isEmpty())
            val canSubmit = configReady && !hasPending && !paymentState.isSubmitting &&
                (trackingCode.isNotBlank() || imageUri != null) && destinationOk
            if (!configReady) {
                InfoBox("در حال دریافت تنظیمات پرداخت… لطفاً چند لحظه صبر کنید.")
            } else if (!destinationOk && !hasPending) {
                InfoBox("ابتدا کارت یا کیف پول مقصد را انتخاب کنید.")
            }
            Button(
                onClick = {
                    onSubmit(plan, method, selectedDestination, trackingCode, imageUri)
                },
                enabled = canSubmit,
                modifier = Modifier.fillMaxWidth().height(52.dp).testTag("payment_submit_button")
            ) {
                if (paymentState.isSubmitting) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                } else {
                    Text("ارسال برای تایید", fontWeight = FontWeight.Bold)
                }
            }
            if (hasPending) {
                InfoBox("یک فیش در انتظار بررسی دارید؛ پس از تایید، اشتراک خودکار فعال می‌شود.")
            }

            // 4. History
            if (paymentState.myRequests.isNotEmpty()) {
                Text("پرداخت‌های من", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                paymentState.myRequests.take(10).forEach { r ->
                    val st = PaymentStatus.fromRaw(r.status)
                    val color = when (st) {
                        PaymentStatus.PENDING -> ChampagneGold
                        PaymentStatus.APPROVED -> EmeraldSuccess
                        PaymentStatus.REJECTED -> RoseError
                    }
                    Surface(
                        color = color.copy(alpha = 0.10f),
                        border = BorderStroke(1.dp, color.copy(alpha = 0.4f)),
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                when (st) {
                                    PaymentStatus.PENDING -> Icons.Rounded.HourglassTop
                                    PaymentStatus.APPROVED -> Icons.Rounded.CheckCircle
                                    PaymentStatus.REJECTED -> Icons.Rounded.Cancel
                                }, null, tint = color
                            )
                            Spacer(Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("${PaymentPlan.fromRaw(r.plan).labelFa} • ${formatToman(r.amountToman)}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                                Text(st.labelFa + (r.adminNote.takeIf { it.isNotBlank() }?.let { " — $it" } ?: ""),
                                    style = MaterialTheme.typography.bodySmall, color = color)
                            }
                        }
                    }
                }
            }

            TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("بستن") }
        }
    }
}

@Composable
private fun PlanChoice(title: String, price: String, sub: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier) {
    Surface(
        color = if (selected) ChampagneGold.copy(alpha = 0.16f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) ChampagneGold else MaterialTheme.colorScheme.outline),
        shape = MaterialTheme.shapes.medium,
        modifier = modifier.clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(price, style = MaterialTheme.typography.bodyMedium, color = if (selected) ChampagneGold else MaterialTheme.colorScheme.onSurface, textAlign = TextAlign.Center)
            Text(sub, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun DestinationCard(
    title: String,
    mainValue: String,
    lines: List<String>,
    selected: Boolean,
    onSelect: () -> Unit,
    onCopy: () -> Unit
) {
    Surface(
        color = if (selected) MintJade.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface,
        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) MintJade else MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)),
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth().clickable(onClick = onSelect)
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(mainValue, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                lines.forEach { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            IconButton(onClick = onCopy) { Icon(Icons.Rounded.ContentCopy, contentDescription = "کپی", tint = MintJade) }
        }
    }
}

@Composable
private fun InfoBox(text: String) {
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Text(text, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(12.dp), color = Color.Unspecified)
    }
}
