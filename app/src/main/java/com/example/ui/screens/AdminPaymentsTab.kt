package com.example.ui.screens

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Cancel
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Publish
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.runtime.produceState
import androidx.compose.material3.CircularProgressIndicator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.example.data.model.BankCardInfo
import com.example.data.model.CryptoWalletInfo
import com.example.data.model.PaymentMethod
import com.example.data.model.PaymentPlan
import com.example.data.model.PaymentRequest
import com.example.data.model.PaymentStatus
import com.example.data.model.formatToman
import com.example.ui.PaymentUiState
import com.example.ui.components.formatCardNumber
import com.example.ui.theme.ChampagneGold
import com.example.ui.theme.EmeraldSuccess
import com.example.ui.theme.MintJade
import com.example.ui.theme.RoseError
import java.util.Date
import java.util.UUID

fun formatFaDate(date: Date): String = try {
    val fmt = android.icu.text.SimpleDateFormat(
        "yyyy/MM/dd HH:mm",
        android.icu.util.ULocale("fa_IR@calendar=persian")
    )
    fmt.format(date)
} catch (_: Throwable) {
    java.text.SimpleDateFormat("yyyy/MM/dd HH:mm", java.util.Locale.US).format(date)
}

@Composable
fun PaymentsAdminTab(
    paymentState: PaymentUiState,
    isSaving: Boolean,
    onSaveConfig: (Long, Long, String, List<BankCardInfo>, List<CryptoWalletInfo>) -> Unit,
    onApprove: (PaymentRequest, String) -> Unit,
    onReject: (PaymentRequest, String) -> Unit,
    onDelete: (String) -> Unit
) {
    var section by remember { mutableStateOf(0) }
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val pending = paymentState.adminRequests.count { PaymentStatus.fromRaw(it.status) == PaymentStatus.PENDING }
            FilterChip(selected = section == 0, onClick = { section = 0 }, label = { Text("درخواست‌ها${if (pending > 0) " ($pending)" else ""}") })
            FilterChip(selected = section == 1, onClick = { section = 1 }, label = { Text("کارت‌ها، کیف پول و قیمت") })
        }
        if (section == 0) {
            RequestsSection(paymentState.adminRequests, onApprove, onReject, onDelete)
        } else {
            PaymentSettingsSection(paymentState, isSaving, onSaveConfig)
        }
    }
}

@Composable
private fun RequestsSection(
    requests: List<PaymentRequest>,
    onApprove: (PaymentRequest, String) -> Unit,
    onReject: (PaymentRequest, String) -> Unit,
    onDelete: (String) -> Unit
) {
    var filter by remember { mutableStateOf(PaymentStatus.PENDING) }
    var showAll by remember { mutableStateOf(false) }
    var viewingImage by remember { mutableStateOf<String?>(null) }
    var rejecting by remember { mutableStateOf<PaymentRequest?>(null) }
    var approving by remember { mutableStateOf<PaymentRequest?>(null) }

    val list = requests.filter { showAll || PaymentStatus.fromRaw(it.status) == filter }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PaymentStatus.entries.forEach { st ->
                    FilterChip(
                        selected = !showAll && filter == st,
                        onClick = { showAll = false; filter = st },
                        label = { Text(st.labelFa) }
                    )
                }
                FilterChip(selected = showAll, onClick = { showAll = true }, label = { Text("همه") })
            }
        }
        if (list.isEmpty()) {
            item {
                Text(
                    "موردی برای نمایش نیست.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 24.dp)
                )
            }
        }
        items(list, key = { it.id }) { r ->
            val st = PaymentStatus.fromRaw(r.status)
            val color = when (st) {
                PaymentStatus.PENDING -> ChampagneGold
                PaymentStatus.APPROVED -> EmeraldSuccess
                PaymentStatus.REJECTED -> RoseError
            }
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(1.dp, color.copy(alpha = 0.55f)),
                shape = MaterialTheme.shapes.medium
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(r.userName.ifBlank { "کاربر" }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Text(r.userEmail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Surface(color = color.copy(alpha = 0.16f), shape = MaterialTheme.shapes.small) {
                            Text(st.labelFa, color = color, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                        }
                    }
                    Text(
                        "${PaymentPlan.fromRaw(r.plan).labelFa} • ${formatToman(r.amountToman)} • ${PaymentMethod.fromRaw(r.method).labelFa}",
                        style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold
                    )
                    if (r.destination.isNotBlank()) Text("مقصد: ${r.destination}", style = MaterialTheme.typography.bodySmall)
                    if (r.trackingCode.isNotBlank()) Text("کد پیگیری: ${r.trackingCode}", style = MaterialTheme.typography.bodySmall, color = MintJade)
                    r.createdAt?.let { Text("زمان ثبت: ${formatFaDate(it.toDate())}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    if (r.adminNote.isNotBlank()) Text("یادداشت: ${r.adminNote}", style = MaterialTheme.typography.labelSmall)

                    if (r.receiptImage.isNotBlank()) {
                        val receipt = r.receiptImage
                        val bmp by produceState<ImageBitmap?>(initialValue = null, r.id, receipt.length) {
                            value = withContext(Dispatchers.Default) { decodeBase64Bitmap(receipt, maxSidePx = 480) }
                        }
                        bmp?.let { thumb ->
                            Image(
                                bitmap = thumb,
                                contentDescription = "تصویر فیش",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(160.dp)
                                    .clickable { viewingImage = r.receiptImage }
                            )
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (st == PaymentStatus.PENDING) {
                            Button(
                                onClick = { approving = r },
                                colors = ButtonDefaults.buttonColors(containerColor = EmeraldSuccess),
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(Icons.Rounded.CheckCircle, null, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("تایید و فعال‌سازی")
                            }
                            OutlinedButton(onClick = { rejecting = r }, modifier = Modifier.weight(1f)) {
                                Icon(Icons.Rounded.Cancel, null, tint = RoseError, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("رد")
                            }
                        } else {
                            Spacer(Modifier.weight(1f))
                            IconButton(onClick = { onDelete(r.id) }) {
                                Icon(Icons.Rounded.DeleteOutline, contentDescription = "حذف", tint = RoseError)
                            }
                        }
                    }
                }
            }
        }
    }

    approving?.let { r ->
        AlertDialog(
            onDismissRequest = { approving = null },
            title = { Text("تایید پرداخت") },
            text = { Text("${PaymentPlan.fromRaw(r.plan).labelFa} برای «${r.userName}» فعال (یا تمدید) شود؟") },
            confirmButton = {
                Button(onClick = { onApprove(r, ""); approving = null }) { Text("تایید") }
            },
            dismissButton = { TextButton(onClick = { approving = null }) { Text("انصراف") } }
        )
    }

    rejecting?.let { r ->
        var note by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { rejecting = null },
            title = { Text("رد درخواست") },
            text = {
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it.take(300) },
                    label = { Text("دلیل (به کاربر نمایش داده می‌شود)") },
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(onClick = { onReject(r, note); rejecting = null }) { Text("رد درخواست") }
            },
            dismissButton = { TextButton(onClick = { rejecting = null }) { Text("انصراف") } }
        )
    }

    viewingImage?.let { img ->
        Dialog(onDismissRequest = { viewingImage = null }) {
            val bmp by produceState<ImageBitmap?>(initialValue = null, img.length, img.hashCode()) {
                value = withContext(Dispatchers.Default) { decodeBase64Bitmap(img, maxSidePx = 1600) }
            }
            Surface(shape = MaterialTheme.shapes.large) {
                Box(modifier = Modifier.padding(8.dp).clickable { viewingImage = null }) {
                    val full = bmp
                    if (full == null) {
                        CircularProgressIndicator(modifier = Modifier.padding(24.dp).align(Alignment.Center))
                    } else {
                        Image(bitmap = full, contentDescription = "تصویر فیش", contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxWidth().heightIn(max = 600.dp))
                    }
                }
            }
        }
    }
}

/** Decodes off the main thread (call from a background dispatcher), downsampled with inSampleSize. */
private fun decodeBase64Bitmap(b64: String, maxSidePx: Int): ImageBitmap? = try {
    val bytes = Base64.decode(b64, Base64.DEFAULT)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    var sample = 1
    if (bounds.outWidth > 0 && bounds.outHeight > 0) {
        while (bounds.outWidth / (sample * 2) >= maxSidePx || bounds.outHeight / (sample * 2) >= maxSidePx) {
            sample *= 2
        }
    }
    val opts = BitmapFactory.Options().apply {
        inSampleSize = sample
        inPreferredConfig = android.graphics.Bitmap.Config.RGB_565
    }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)?.asImageBitmap()
} catch (_: Exception) {
    null
} catch (_: OutOfMemoryError) {
    null
}

@Composable
private fun PaymentSettingsSection(
    paymentState: PaymentUiState,
    isSaving: Boolean,
    onSaveConfig: (Long, Long, String, List<BankCardInfo>, List<CryptoWalletInfo>) -> Unit
) {
    val cfg = paymentState.config
    var monthly by remember { mutableStateOf(cfg.monthlyPriceToman.toString()) }
    var yearly by remember { mutableStateOf(cfg.yearlyPriceToman.toString()) }
    var instructions by remember { mutableStateOf(cfg.instructions) }
    val cards = remember { mutableStateListOf<BankCardInfo>().apply { addAll(cfg.cards) } }
    val wallets = remember { mutableStateListOf<CryptoWalletInfo>().apply { addAll(cfg.wallets) } }
    var loadedStamp by remember { mutableStateOf(cfg.updatedAt) }

    LaunchedEffect(cfg.updatedAt) {
        if (cfg.updatedAt != loadedStamp || (cards.isEmpty() && wallets.isEmpty())) {
            monthly = cfg.monthlyPriceToman.toString()
            yearly = cfg.yearlyPriceToman.toString()
            instructions = cfg.instructions
            cards.clear(); cards.addAll(cfg.cards)
            wallets.clear(); wallets.addAll(cfg.wallets)
            loadedStamp = cfg.updatedAt
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            SectionCard("قیمت اشتراک‌ها (تومان)") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = monthly,
                        onValueChange = { monthly = it.filter { c -> c.isDigit() }.take(12) },
                        label = { Text("ماهانه") },
                        supportingText = { Text(formatToman(monthly.toLongOrNull() ?: 0L)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = yearly,
                        onValueChange = { yearly = it.filter { c -> c.isDigit() }.take(12) },
                        label = { Text("سالانه") },
                        supportingText = { Text(formatToman(yearly.toLongOrNull() ?: 0L)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = instructions,
                    onValueChange = { instructions = it.take(800) },
                    label = { Text("راهنمای پرداخت برای کاربر") },
                    minLines = 2, maxLines = 5,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        item {
            SectionCard("شماره کارت‌ها (${cards.size})") {
                cards.forEachIndexed { index, card ->
                    CardEditor(
                        card = card,
                        onChange = { cards[index] = it },
                        onDelete = { cards.removeAt(index) }
                    )
                }
                OutlinedButton(
                    onClick = { cards.add(BankCardInfo(id = UUID.randomUUID().toString().take(8))) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Rounded.Add, null); Spacer(Modifier.width(6.dp)); Text("افزودن کارت")
                }
            }
        }

        item {
            SectionCard("کیف پول‌های ارز دیجیتال (${wallets.size})") {
                wallets.forEachIndexed { index, w ->
                    WalletEditor(
                        wallet = w,
                        onChange = { wallets[index] = it },
                        onDelete = { wallets.removeAt(index) }
                    )
                }
                OutlinedButton(
                    onClick = { wallets.add(CryptoWalletInfo(id = UUID.randomUUID().toString().take(8), coin = "USDT", network = "TRC20")) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Rounded.Add, null); Spacer(Modifier.width(6.dp)); Text("افزودن کیف پول")
                }
            }
        }

        item {
            Button(
                onClick = {
                    onSaveConfig(
                        monthly.toLongOrNull() ?: 0L,
                        yearly.toLongOrNull() ?: 0L,
                        instructions,
                        cards.toList(),
                        wallets.toList()
                    )
                },
                enabled = !isSaving,
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                Icon(Icons.Rounded.Publish, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("ذخیره و انتشار برای همه کاربران")
            }
        }
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)),
        shape = MaterialTheme.shapes.large
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            content()
        }
    }
}

@Composable
private fun CardEditor(card: BankCardInfo, onChange: (BankCardInfo) -> Unit, onDelete: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (card.cardNumber.isBlank()) "کارت جدید" else formatCardNumber(card.cardNumber),
                    style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f)
                )
                Text("فعال", style = MaterialTheme.typography.labelSmall)
                Switch(checked = card.active, onCheckedChange = { onChange(card.copy(active = it)) })
                IconButton(onClick = onDelete) { Icon(Icons.Rounded.DeleteOutline, "حذف", tint = RoseError) }
            }
            OutlinedTextField(
                value = card.cardNumber,
                onValueChange = { onChange(card.copy(cardNumber = it.filter { c -> c.isDigit() }.take(19))) },
                label = { Text("شماره کارت") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true, modifier = Modifier.fillMaxWidth()
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(
                    value = card.bankName, onValueChange = { onChange(card.copy(bankName = it.take(60))) },
                    label = { Text("نام بانک") }, singleLine = true, modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = card.holderName, onValueChange = { onChange(card.copy(holderName = it.take(80))) },
                    label = { Text("نام صاحب کارت") }, singleLine = true, modifier = Modifier.weight(1f)
                )
            }
            OutlinedTextField(
                value = card.sheba, onValueChange = { onChange(card.copy(sheba = it.take(34))) },
                label = { Text("شماره شبا (اختیاری)") }, singleLine = true, modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun WalletEditor(wallet: CryptoWalletInfo, onChange: (CryptoWalletInfo) -> Unit, onDelete: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    listOf(wallet.coin, wallet.network).filter { it.isNotBlank() }.joinToString(" • ").ifBlank { "کیف پول جدید" },
                    style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f)
                )
                Text("فعال", style = MaterialTheme.typography.labelSmall)
                Switch(checked = wallet.active, onCheckedChange = { onChange(wallet.copy(active = it)) })
                IconButton(onClick = onDelete) { Icon(Icons.Rounded.DeleteOutline, "حذف", tint = RoseError) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(
                    value = wallet.coin, onValueChange = { onChange(wallet.copy(coin = it.take(30))) },
                    label = { Text("ارز (مثلاً USDT)") }, singleLine = true, modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = wallet.network, onValueChange = { onChange(wallet.copy(network = it.take(30))) },
                    label = { Text("شبکه (مثلاً TRC20)") }, singleLine = true, modifier = Modifier.weight(1f)
                )
            }
            OutlinedTextField(
                value = wallet.address, onValueChange = { onChange(wallet.copy(address = it.trim().take(200))) },
                label = { Text("آدرس کیف پول") }, singleLine = true, modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = wallet.note, onValueChange = { onChange(wallet.copy(note = it.take(200))) },
                label = { Text("توضیح (مثلاً Memo یا هشدار شبکه)") }, singleLine = true, modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
