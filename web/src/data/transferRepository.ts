// Port of data/repository/TransferRepository.kt (device-local data, import/export).
import { dao } from './localDb';
import type {
  SmsRecordEntity, CallRecordEntity, ContactEntity, ImportResult, ExportFormat,
  BridgeCommandType, IncomingBridgeEvent, SmsDirection, CallDirection,
} from './models';
import { SmsDirectionLabel, CallDirectionLabel, ExportFormatInfo } from './models';

export interface GeneratedExportFile { blob: Blob; fileName: string; mimeType: string; byteSize: number }
const MAX_IMPORT_BYTES = 5_000_000;

const sms = (p: Partial<SmsRecordEntity> & { senderName: string; phoneNumber: string; body: string }): Omit<SmsRecordEntity, 'id'> => ({
  timestampMillis: Date.now(), direction: 'INCOMING', isSelected: true, sourceLabel: 'دستی', simSlot: 1, isRead: true, ...p,
});
const call = (p: Partial<CallRecordEntity> & { contactName: string; phoneNumber: string }): Omit<CallRecordEntity, 'id'> => ({
  timestampMillis: Date.now(), durationSeconds: 0, direction: 'INCOMING', isSelected: true, sourceLabel: 'دستی', simSlot: 1, ...p,
});
const clampSim = (n: unknown) => Math.min(2, Math.max(1, Number.isFinite(Number(n)) ? Number(n) : 1));

export const transferRepository = {
  addManualSms(senderName: string, phoneNumber: string, body: string, direction: SmsDirection, simSlot = 1, sourceLabel = 'ثبت مستقیم') {
    dao.insertSmsList([sms({
      senderName: senderName.trim() ? senderName : phoneNumber,
      phoneNumber: phoneNumber.trim() || 'نامشخص',
      body: body.trim(), direction, sourceLabel, simSlot, isRead: direction !== 'INCOMING',
    })]);
  },
  markThreadRead: (p: string) => dao.markThreadRead(p),
  deleteSmsThread: (p: string) => dao.deleteSmsThread(p),
  addManualCall(contactName: string, phoneNumber: string, durationSeconds: number, direction: CallDirection, simSlot = 1, sourceLabel = 'شماره‌گیر eSkyTell') {
    dao.insertCallList([call({
      contactName: contactName.trim() ? contactName : phoneNumber,
      phoneNumber: phoneNumber.trim(), durationSeconds: Math.max(0, durationSeconds), direction, sourceLabel, simSlot,
    })]);
  },
  upsertContact(displayName: string, phoneNumber: string, email = '', notes = '', isFavorite = false, existingId: number | null = null) {
    const cleanPhone = phoneNumber.trim();
    const cleanName = displayName.trim() || cleanPhone;
    if (existingId != null) {
      dao.updateContact({ id: existingId, displayName: cleanName, phoneNumber: cleanPhone, email: email.trim(), notes: notes.trim(), isFavorite, syncedToSystem: false, sourceLabel: 'ویرایش‌شده', updatedAtMillis: Date.now() });
    } else {
      const existing = dao.findContactByPhone(cleanPhone);
      if (existing) {
        dao.updateContact({ ...existing, displayName: cleanName, email: email.trim() || existing.email, notes: notes.trim() || existing.notes, isFavorite: isFavorite || existing.isFavorite, updatedAtMillis: Date.now() });
      } else {
        dao.insertContacts([{ displayName: cleanName, phoneNumber: cleanPhone, email: email.trim(), notes: notes.trim(), isFavorite, syncedToSystem: false, sourceLabel: 'برنامه', updatedAtMillis: Date.now() }]);
      }
    }
  },
  setContactFavorite: (id: number, f: boolean) => dao.setContactFavorite(id, f),
  deleteContact: (id: number) => dao.deleteContact(id),
  markContactSynced: (id: number) => dao.setContactSyncedToSystem(id, true),
  deleteCall: (id: number) => dao.deleteCall(id),
  deleteHistory: (id: number) => dao.deleteHistory(id),
  clearHistory: () => dao.clearAllHistory(),
  recordTransferHistory: dao.insertHistory,

  /** Web Contact Picker API (Android Chrome only; not available in iOS Safari). */
  async importDeviceContacts(): Promise<number> {
    const nav = navigator as any;
    if (!nav.contacts?.select) return -1;
    const picked: any[] = await nav.contacts.select(['name', 'tel', 'email'], { multiple: true });
    const batch: Omit<ContactEntity, 'id'>[] = [];
    const seen = new Set<string>();
    for (const c of picked) {
      const phone = String(c.tel?.[0] ?? '').trim();
      if (phone && !seen.has(phone)) {
        seen.add(phone);
        if (!dao.findContactByPhone(phone)) batch.push({ displayName: String(c.name?.[0] ?? '') || phone, phoneNumber: phone, email: String(c.email?.[0] ?? ''), notes: '', isFavorite: false, syncedToSystem: true, sourceLabel: 'دفترچه گوشی', updatedAtMillis: Date.now() });
      }
    }
    if (batch.length) dao.insertContacts(batch);
    return batch.length;
  },

  importSharedOrPastedText(rawText: string, sourceLabel = 'کلیپ‌بورد'): ImportResult {
    const trimmed = rawText.trim();
    if (!trimmed) return { smsAdded: 0, callsAdded: 0, sourceName: sourceLabel };
    if (trimmed.startsWith('{')) { const r = parseJsonBundle(trimmed, sourceLabel); if (r.smsAdded > 0 || r.callsAdded > 0) return r; }
    if (trimmed.startsWith('<')) { const r = parseXmlBackup(trimmed, sourceLabel); if (r.smsAdded > 0 || r.callsAdded > 0) return r; }
    const phoneRegex = /(\+?\d[\d\s\-()]{6,16}\d)/;
    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const smsBatch: Omit<SmsRecordEntity, 'id'>[] = [];
    const callBatch: Omit<CallRecordEntity, 'id'>[] = [];
    if (lines.length > 1) {
      for (const line of lines) {
        const match = line.match(phoneRegex);
        const phone = match ? match[0].replace(/[\s\-()]/g, '') : '';
        const lower = line.toLowerCase();
        if (phone && (line.includes('تماس') || lower.includes('call') || lower.includes('missed'))) {
          const dir: CallDirection = line.includes('از دست') || line.includes('بی‌پاسخ') || lower.includes('missed') ? 'MISSED'
            : line.includes('خروجی') || lower.includes('outgoing') ? 'OUTGOING' : 'INCOMING';
          callBatch.push(call({ contactName: (line.replace(match?.[0] ?? '', '').trim() || phone).slice(0, 40), phoneNumber: phone, direction: dir, sourceLabel }));
        } else {
          smsBatch.push(sms({ senderName: phone || 'پیام واردشده', phoneNumber: phone || 'نامشخص', body: line, sourceLabel, isRead: false }));
        }
      }
    } else {
      const match = trimmed.match(phoneRegex);
      const phone = match ? match[0].replace(/[\s\-()]/g, '') : '';
      smsBatch.push(sms({ senderName: phone || 'متن اشتراک‌گذاری', phoneNumber: phone || 'نامشخص', body: trimmed, sourceLabel, isRead: false }));
    }
    if (smsBatch.length) dao.insertSmsList(smsBatch);
    if (callBatch.length) dao.insertCallList(callBatch);
    return { smsAdded: smsBatch.length, callsAdded: callBatch.length, sourceName: sourceLabel };
  },

  async importFromFile(file: File): Promise<ImportResult> {
    const fileName = file.name || 'فایل پشتیبان';
    if (file.size > MAX_IMPORT_BYTES) return { smsAdded: 0, callsAdded: 0, sourceName: fileName };
    let content: string;
    try { content = await file.text(); } catch { return { smsAdded: 0, callsAdded: 0, sourceName: fileName }; }
    const lowerName = fileName.toLowerCase();
    const trimmed = content.trim();
    try {
      if (lowerName.endsWith('.json') || trimmed.startsWith('{')) return parseJsonBundle(trimmed, fileName);
      if (lowerName.endsWith('.xml') || trimmed.startsWith('<')) return parseXmlBackup(trimmed, fileName);
      if (lowerName.endsWith('.vcf') || /BEGIN:VCARD/i.test(trimmed)) return parseVCard(trimmed, fileName);
      if (lowerName.endsWith('.csv')) return parseCsv(trimmed, fileName);
      return transferRepository.importSharedOrPastedText(trimmed, fileName);
    } catch { return { smsAdded: 0, callsAdded: 0, sourceName: fileName }; }
  },

  importBridgePayload(jsonPayload: string, senderDeviceName: string): { importResult: ImportResult; incomingEvent: IncomingBridgeEvent | null } {
    try {
      const root = JSON.parse(jsonPayload);
      const raw = String(root.bridgeType ?? '');
      if (raw) {
        const cmd: BridgeCommandType = (['CALL_TRANSFER', 'SMS_RELAY', 'CONTACT_SYNC'] as const).find((t) => t === raw) ?? 'SMS_RELAY';
        const phone = String(root.phoneNumber ?? '');
        const contact = String(root.contactName ?? (phone || 'مخاطب'));
        const body = String(root.messageBody ?? '');
        const simSlot = clampSim(root.simSlot);
        const source = String(root.sourceDeviceName ?? senderDeviceName);
        let s = 0, c = 0;
        if (cmd === 'CALL_TRANSFER') { transferRepository.addManualCall(contact, phone || 'نامشخص', 0, 'INCOMING', simSlot, `پل بلوتوث: ${source}`); c = 1; }
        else if (cmd === 'SMS_RELAY') { transferRepository.addManualSms(contact, phone || 'نامشخص', body || 'پیام از پل بلوتوث', 'INCOMING', simSlot, `پل بلوتوث: ${source}`); s = 1; }
        else if (phone) transferRepository.upsertContact(contact, phone, '', `دریافت از ${source}`);
        return { importResult: { smsAdded: s, callsAdded: c, sourceName: `بلوتوث: ${source}` }, incomingEvent: { type: cmd, sourceDeviceName: source, contactName: contact, phoneNumber: phone, messageBody: body, simSlot, timestampMillis: Date.now() } };
      }
    } catch { /* fallthrough */ }
    return { importResult: parseJsonBundle(jsonPayload, `بلوتوث: ${senderDeviceName}`), incomingEvent: null };
  },

  buildRfcommJsonPayload(smsList: SmsRecordEntity[], callList: CallRecordEntity[]): string {
    return JSON.stringify({
      app: 'eSkyTell', version: 2, exportedAt: Date.now(),
      sms: smsList.map((s) => ({ senderName: s.senderName, phoneNumber: s.phoneNumber, body: s.body, timestampMillis: s.timestampMillis, direction: s.direction, simSlot: s.simSlot })),
      calls: callList.map((c) => ({ contactName: c.contactName, phoneNumber: c.phoneNumber, timestampMillis: c.timestampMillis, durationSeconds: c.durationSeconds, direction: c.direction, simSlot: c.simSlot })),
    });
  },

  createContactsVCardFile(list: ContactEntity[]): GeneratedExportFile {
    let sb = '';
    for (const c of list) {
      sb += `BEGIN:VCARD\nVERSION:3.0\nFN:${c.displayName}\nTEL;TYPE=CELL:${c.phoneNumber}\n`;
      if (c.email.trim()) sb += `EMAIL:${c.email}\n`;
      if (c.notes.trim()) sb += `NOTE:${c.notes.replace(/\n/g, ' ')}\n`;
      sb += 'END:VCARD\n';
    }
    return mkFile(`eSkyTell_Contacts_${stamp()}.vcf`, 'text/vcard', sb);
  },

  createExportFile(format: ExportFormat, smsList: SmsRecordEntity[], callList: CallRecordEntity[]): GeneratedExportFile {
    const info = ExportFormatInfo[format];
    const content = format === 'JSON_BUNDLE' ? transferRepository.buildRfcommJsonPayload(smsList, callList)
      : format === 'VCARD_CONTACTS' ? buildVCardContent(smsList, callList)
        : format === 'HTML_REPORT' ? buildHtmlReport(smsList, callList)
          : format === 'CSV_TABLE' ? buildCsvContent(smsList, callList)
            : buildPlainTextContent(smsList, callList);
    return mkFile(`eSkyTell_${stamp()}.${info.extension}`, info.mimeType, content);
  },
};

function mkFile(fileName: string, mimeType: string, content: string): GeneratedExportFile {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  return { blob, fileName, mimeType, byteSize: blob.size };
}
const pad = (n: number) => String(n).padStart(2, '0');
function stamp() { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }
function fmt(ms: number) { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }

function parseJsonBundle(json: string, sourceLabel: string): ImportResult {
  try {
    const root = JSON.parse(json);
    const smsBatch: Omit<SmsRecordEntity, 'id'>[] = [];
    const callBatch: Omit<CallRecordEntity, 'id'>[] = [];
    if (Array.isArray(root.sms)) for (const o of root.sms) {
      if (!o || typeof o !== 'object') continue;
      const body = String(o.body ?? ''); const phone = String(o.phoneNumber ?? o.address ?? '');
      if (body.trim() || phone.trim()) smsBatch.push(sms({ senderName: String(o.senderName ?? (phone || 'مخاطب')), phoneNumber: phone || 'نامشخص', body, timestampMillis: Number(o.timestampMillis) || Date.now(), direction: String(o.direction ?? 'INCOMING'), sourceLabel, simSlot: clampSim(o.simSlot), isRead: false }));
    }
    if (Array.isArray(root.calls)) for (const o of root.calls) {
      if (!o || typeof o !== 'object') continue;
      const phone = String(o.phoneNumber ?? o.number ?? '');
      if (phone.trim()) callBatch.push(call({ contactName: String(o.contactName ?? phone), phoneNumber: phone, timestampMillis: Number(o.timestampMillis) || Date.now(), durationSeconds: Number(o.durationSeconds) || 0, direction: String(o.direction ?? 'INCOMING'), sourceLabel, simSlot: clampSim(o.simSlot) }));
    }
    if (smsBatch.length) dao.insertSmsList(smsBatch);
    if (callBatch.length) dao.insertCallList(callBatch);
    return { smsAdded: smsBatch.length, callsAdded: callBatch.length, sourceName: sourceLabel };
  } catch { return { smsAdded: 0, callsAdded: 0, sourceName: sourceLabel }; }
}

function parseXmlBackup(xml: string, sourceLabel: string): ImportResult {
  const smsBatch: Omit<SmsRecordEntity, 'id'>[] = [];
  const callBatch: Omit<CallRecordEntity, 'id'>[] = [];
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    doc.querySelectorAll('*').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      const a = (n: string) => el.getAttribute(n);
      if (tag === 'sms') {
        const address = a('address') ?? ''; const body = a('body') ?? '';
        const cn = a('contact_name'); const contact = cn && cn !== '(Unknown)' ? cn : address;
        const date = Number(a('date')) || Date.now(); const type = Number(a('type')) || 1;
        const dir = type === 2 ? 'OUTGOING' : type === 3 ? 'DRAFT' : 'INCOMING';
        if (body.trim() || address.trim()) smsBatch.push(sms({ senderName: contact || 'مخاطب', phoneNumber: address || 'نامشخص', body, timestampMillis: date, direction: dir, sourceLabel }));
      } else if (tag === 'call') {
        const number = a('number') ?? ''; const cn = a('contact_name'); const contact = cn && cn !== '(Unknown)' ? cn : number;
        const date = Number(a('date')) || Date.now(); const duration = Number(a('duration')) || 0; const type = Number(a('type')) || 1;
        const dir = type === 2 ? 'OUTGOING' : type === 3 ? 'MISSED' : type === 5 ? 'REJECTED' : 'INCOMING';
        if (number.trim()) callBatch.push(call({ contactName: contact || number, phoneNumber: number, timestampMillis: date, durationSeconds: duration, direction: dir, sourceLabel }));
      }
    });
  } catch { /* ignore */ }
  if (smsBatch.length) dao.insertSmsList(smsBatch);
  if (callBatch.length) dao.insertCallList(callBatch);
  return { smsAdded: smsBatch.length, callsAdded: callBatch.length, sourceName: sourceLabel };
}

function parseVCard(vcf: string, sourceLabel: string): ImportResult {
  const batch: Omit<ContactEntity, 'id'>[] = [];
  for (const card of vcf.split(/BEGIN:VCARD/i)) {
    if (!/TEL/i.test(card)) continue;
    let name = '', phone = '', email = '';
    for (const line of card.split(/\r?\n/)) {
      const c = line.trim();
      const after = () => c.substring(c.indexOf(':') + 1).trim();
      if (/^FN:/i.test(c)) name = after();
      else if (/^TEL/i.test(c) && c.includes(':')) phone = after();
      else if (/^EMAIL/i.test(c) && c.includes(':')) email = after();
    }
    if (phone && !dao.findContactByPhone(phone)) batch.push({ displayName: name || phone, phoneNumber: phone, email, notes: '', isFavorite: false, syncedToSystem: false, sourceLabel, updatedAtMillis: Date.now() });
  }
  if (batch.length) dao.insertContacts(batch);
  return { smsAdded: 0, callsAdded: batch.length, sourceName: sourceLabel };
}

function parseCsv(csv: string, sourceLabel: string): ImportResult {
  const smsBatch: Omit<SmsRecordEntity, 'id'>[] = [];
  const callBatch: Omit<CallRecordEntity, 'id'>[] = [];
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, index) => {
    if (index === 0 && (/type/i.test(line) || line.includes('نوع'))) return;
    const cols = line.split(',').map((c) => c.trim().replace(/^"+|"+$/g, ''));
    if (cols.length >= 3) {
      const type = cols[0].toLowerCase();
      if (type.includes('call') || type.includes('تماس')) callBatch.push(call({ contactName: cols[1] || cols[2] || '', phoneNumber: cols[2] ?? '', durationSeconds: Number(cols[3]) || 0, sourceLabel }));
      else smsBatch.push(sms({ senderName: cols[1] || 'مخاطب', phoneNumber: cols[2] || 'نامشخص', body: cols[3] || line, sourceLabel }));
    }
  });
  if (smsBatch.length) dao.insertSmsList(smsBatch);
  if (callBatch.length) dao.insertCallList(callBatch);
  return { smsAdded: smsBatch.length, callsAdded: callBatch.length, sourceName: sourceLabel };
}

function buildVCardContent(smsList: SmsRecordEntity[], callList: CallRecordEntity[]): string {
  const seen = new Map<string, string>();
  callList.forEach((c) => { if (c.phoneNumber.trim() && c.phoneNumber !== 'نامشخص' && !seen.has(c.phoneNumber)) seen.set(c.phoneNumber, c.contactName); });
  smsList.forEach((s) => { if (s.phoneNumber.trim() && s.phoneNumber !== 'نامشخص' && !seen.has(s.phoneNumber)) seen.set(s.phoneNumber, s.senderName); });
  let sb = '';
  seen.forEach((name, phone) => {
    const note = smsList.filter((s) => s.phoneNumber === phone).slice(0, 3).map((s) => s.body.replace(/\n/g, ' ')).join(' | ');
    sb += `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:${phone}\n`;
    if (note.trim()) sb += `NOTE:${note}\n`;
    sb += 'END:VCARD\n';
  });
  if (seen.size === 0) sb += 'BEGIN:VCARD\nVERSION:3.0\nFN:eSkyTell Contact\nNOTE:No phone numbers queued\nEND:VCARD\n';
  return sb;
}
function buildCsvContent(smsList: SmsRecordEntity[], callList: CallRecordEntity[]): string {
  let sb = '\uFEFFنوع,نام مخاطب,شماره تلفن,متن یا مدت(ثانیه),وضعیت,سیم‌کارت,تاریخ\n';
  smsList.forEach((s) => {
    const body = s.body.replace(/"/g, '""').replace(/\n/g, ' ');
    sb += `"پیامک","${s.senderName}","${s.phoneNumber}","${body}","${SmsDirectionLabel[s.direction] ?? s.direction}","SIM ${s.simSlot}","${fmt(s.timestampMillis)}"\n`;
  });
  callList.forEach((c) => {
    sb += `"تماس","${c.contactName}","${c.phoneNumber}","${c.durationSeconds}","${CallDirectionLabel[c.direction] ?? c.direction}","SIM ${c.simSlot}","${fmt(c.timestampMillis)}"\n`;
  });
  return sb;
}
function buildPlainTextContent(smsList: SmsRecordEntity[], callList: CallRecordEntity[]): string {
  let sb = `=== بسته ارتباطی eSkyTell ===\nتعداد پیامک‌ها: ${smsList.length} | تعداد تماس‌ها: ${callList.length}\n\n`;
  if (smsList.length) {
    sb += '--- پیامک‌ها ---\n';
    smsList.forEach((s) => { sb += `[${SmsDirectionLabel[s.direction] ?? s.direction} | SIM ${s.simSlot}] ${s.senderName} (${s.phoneNumber}) - ${fmt(s.timestampMillis)}\n${s.body}\n----------------\n`; });
    sb += '\n';
  }
  if (callList.length) {
    sb += '--- تماس‌ها ---\n';
    callList.forEach((c) => { sb += `[${CallDirectionLabel[c.direction] ?? c.direction} | SIM ${c.simSlot}] ${c.contactName} (${c.phoneNumber}) | مدت: ${c.durationSeconds} ثانیه | ${fmt(c.timestampMillis)}\n`; });
  }
  return sb;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function buildHtmlReport(smsList: SmsRecordEntity[], callList: CallRecordEntity[]): string {
  const smsHtml = smsList.map((s) => `<div class="card"><div class="row"><strong>${esc(s.senderName)}</strong><span class="badge">${esc(SmsDirectionLabel[s.direction] ?? s.direction)} • SIM ${s.simSlot}</span></div><div class="meta">${esc(s.phoneNumber)} • ${fmt(s.timestampMillis)}</div><p class="body">${esc(s.body)}</p></div>`).join('\n');
  const callHtml = callList.map((c) => `<div class="card"><div class="row"><strong>${esc(c.contactName)}</strong><span class="badge call">${esc(CallDirectionLabel[c.direction] ?? c.direction)} • SIM ${c.simSlot}</span></div><div class="meta">${esc(c.phoneNumber)} • مدت: ${c.durationSeconds} ثانیه • ${fmt(c.timestampMillis)}</div></div>`).join('\n');
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>گزارش eSkyTell</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Tahoma, sans-serif; background: #09110F; color: #F1F7F5; margin: 0; padding: 20px; }
.container { max-width: 720px; margin: 0 auto; }
h1 { color: #00D4AA; font-size: 22px; margin-bottom: 4px; }
h2 { color: #F4B860; font-size: 17px; margin-top: 24px; border-bottom: 1px solid #223A34; padding-bottom: 6px; }
.summary { color: #93ACA5; font-size: 13px; margin-bottom: 18px; }
.card { background: #0F1B18; border: 1px solid #223A34; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.row { display: flex; justify-content: space-between; align-items: center; }
.badge { background: #0D3D33; color: #00D4AA; padding: 3px 10px; border-radius: 99px; font-size: 12px; }
.badge.call { background: #3A2C12; color: #F4B860; }
.meta { color: #93ACA5; font-size: 12px; margin-top: 6px; direction: ltr; text-align: right; }
.body { margin: 10px 0 0 0; line-height: 1.7; font-size: 14px; }
</style>
</head>
<body>
<div class="container">
<h1>گزارش پل ارتباطی eSkyTell</h1>
<div class="summary">پیامک‌ها: ${smsList.length} مورد | تماس‌ها: ${callList.length} مورد</div>
<h2>پیامک‌ها</h2>
${smsHtml.trim() ? smsHtml : "<p class='summary'>پیامکی انتخاب نشده است.</p>"}
<h2>تاریخچه تماس‌ها</h2>
${callHtml.trim() ? callHtml : "<p class='summary'>تماسی انتخاب نشده است.</p>"}
</div>
</body>
</html>`;
}
