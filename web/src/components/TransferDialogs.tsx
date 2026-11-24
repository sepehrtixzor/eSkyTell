// Port of ui/components/TransferDialogs.kt
import { useEffect, useState } from 'preact/hooks';
import {
  mdiMessageText, mdiSend, mdiSimOutline, mdiCellphone, mdiAccountPlus, mdiContentPaste, mdiShieldLock, mdiBluetooth,
  mdiContacts, mdiBell, mdiPhone, mdiCheckCircle, mdiAlertOutline, mdiBluetoothConnect, mdiMicrophoneOff, mdiVolumeHigh,
  mdiBluetoothAudio, mdiDialpad, mdiPhoneHangup, mdiCrown, mdiCheckDecagram, mdiHistory, mdiDeleteOutline,
} from '@mdi/js';
import { Button, Chip, Dialog, BottomSheet, Icon, IconButton, Switch, TextField, alpha, fmtDate, pad2 } from '../ui/kit';
import type { SmsDirection, CallDirection, ContactEntity, PermissionSummary, ActiveBridgeCall, AppGlobalConfig, TransferHistoryEntity } from '../data/models';
import { SmsDirectionLabel, CallDirectionLabel } from '../data/models';

export function AddSmsDialog({ onDismiss, onConfirm }: { onDismiss: () => void; onConfirm: (sender: string, phone: string, body: string, dir: SmsDirection) => void }) {
  const [sender, setSender] = useState(''); const [phone, setPhone] = useState(''); const [body, setBody] = useState('');
  const [direction, setDirection] = useState<SmsDirection>('INCOMING');
  const ok = !!body.trim() || !!phone.trim();
  return (
    <Dialog onDismiss={onDismiss} icon={mdiMessageText} title="افزودن پیامک به صندوق"
      dismiss={<Button kind="text" onClick={onDismiss}>انصراف</Button>}
      confirm={<Button disabled={!ok} testId="confirm_add_sms_button" onClick={() => { onConfirm(sender, phone.trim() ? phone : 'نامشخص', body, direction); onDismiss(); }}>افزودن</Button>}>
      <div class="col g10">
        <TextField value={sender} onInput={setSender} label="نام فرستنده / مخاطب" testId="sms_sender_input" />
        <TextField value={phone} onInput={setPhone} label="شماره تلفن" type="tel" inputMode="tel" testId="sms_phone_input" />
        <TextField value={body} onInput={setBody} label="متن پیامک" multiline minRows={3} maxRows={5} testId="sms_body_input" />
        <div class="labelMedium" style={{ color: 'var(--on-surface)' }}>نوع پیام:</div>
        <div class="row wrap g8">
          {(['INCOMING', 'OUTGOING', 'DRAFT'] as SmsDirection[]).map((d) => <Chip key={d} selected={direction === d} onClick={() => setDirection(d)}>{SmsDirectionLabel[d]}</Chip>)}
        </div>
      </div>
    </Dialog>
  );
}

export function ComposeSmsDialog({ contacts, activeSimLabel, onDismiss, onSend }: { contacts: ContactEntity[]; activeSimLabel: string; onDismiss: () => void; onSend: (phone: string, name: string, body: string) => void }) {
  const [phone, setPhone] = useState(''); const [name, setName] = useState(''); const [body, setBody] = useState('');
  const ok = !!phone.trim() && !!body.trim();
  return (
    <Dialog onDismiss={onDismiss} icon={mdiSend} title="پیام جدید eSkyTell"
      dismiss={<Button kind="text" onClick={onDismiss}>بستن</Button>}
      confirm={<Button disabled={!ok} testId="confirm_compose_sms_button" onClick={() => { onSend(phone, name, body); onDismiss(); }}>ارسال پیامک</Button>}>
      <div class="col g10">
        <div class="row g6" style={{ background: alpha('var(--primary-container)', 0.55), borderRadius: 'var(--r-small)', padding: '6px 10px', alignSelf: 'flex-start' }}>
          <Icon path={mdiSimOutline} size={16} color="var(--primary)" />
          <span class="labelSmall" style={{ color: 'var(--on-primary-container)' }}>ارسال از طریق: {activeSimLabel}</span>
        </div>
        {contacts.length > 0 && (
          <div class="row g6 hscroll">
            {contacts.slice(0, 10).map((c) => <Chip key={c.id} selected={phone === c.phoneNumber} onClick={() => { setPhone(c.phoneNumber); setName(c.displayName); }}>{c.displayName}</Chip>)}
          </div>
        )}
        <TextField value={phone} onInput={setPhone} label="شماره گیرنده *" type="tel" inputMode="tel" testId="compose_sms_phone" />
        <TextField value={name} onInput={setName} label="نام مخاطب (اختیاری)" testId="compose_sms_name" />
        <TextField value={body} onInput={setBody} label="متن پیامک *" multiline minRows={3} maxRows={6} testId="compose_sms_body" />
      </div>
    </Dialog>
  );
}

export function AddCallDialog({ onDismiss, onConfirm }: { onDismiss: () => void; onConfirm: (contact: string, phone: string, dur: number, dir: CallDirection) => void }) {
  const [contact, setContact] = useState(''); const [phone, setPhone] = useState(''); const [dur, setDur] = useState('60');
  const [direction, setDirection] = useState<CallDirection>('INCOMING');
  return (
    <Dialog onDismiss={onDismiss} icon={mdiCellphone} title="افزودن سابقه تماس"
      dismiss={<Button kind="text" onClick={onDismiss}>انصراف</Button>}
      confirm={<Button disabled={!phone.trim()} testId="confirm_add_call_button" onClick={() => { onConfirm(contact, phone, parseInt(dur, 10) || 0, direction); onDismiss(); }}>افزودن</Button>}>
      <div class="col g10">
        <TextField value={contact} onInput={setContact} label="نام مخاطب" testId="call_contact_input" />
        <TextField value={phone} onInput={setPhone} label="شماره تلفن *" type="tel" inputMode="tel" testId="call_phone_input" />
        <TextField value={dur} onInput={(v) => setDur(v.replace(/\D/g, ''))} label="مدت تماس (ثانیه)" inputMode="numeric" testId="call_duration_input" />
        <div class="labelMedium" style={{ color: 'var(--on-surface)' }}>وضعیت تماس:</div>
        <div class="row wrap g8">
          {(['INCOMING', 'OUTGOING', 'MISSED', 'REJECTED'] as CallDirection[]).map((d) => <Chip key={d} selected={direction === d} onClick={() => setDirection(d)}>{CallDirectionLabel[d]}</Chip>)}
        </div>
      </div>
    </Dialog>
  );
}

export function AddEditContactDialog({ initialContact, initialPhone = '', onDismiss, onConfirm }: {
  initialContact?: ContactEntity | null; initialPhone?: string; onDismiss: () => void;
  onConfirm: (name: string, phone: string, email: string, notes: string, fav: boolean, existingId: number | null) => void;
}) {
  const [name, setName] = useState(initialContact?.displayName ?? '');
  const [phone, setPhone] = useState(initialContact?.phoneNumber ?? initialPhone);
  const [email, setEmail] = useState(initialContact?.email ?? '');
  const [notes, setNotes] = useState(initialContact?.notes ?? '');
  const [fav, setFav] = useState(initialContact?.isFavorite ?? false);
  return (
    <Dialog onDismiss={onDismiss} icon={mdiAccountPlus} title={initialContact ? 'ویرایش مخاطب' : 'افزودن مخاطب جدید'}
      dismiss={<Button kind="text" onClick={onDismiss}>انصراف</Button>}
      confirm={<Button disabled={!phone.trim()} testId="confirm_save_contact_button" onClick={() => { onConfirm(name.trim() ? name : phone, phone, email, notes, fav, initialContact?.id ?? null); onDismiss(); }}>ذخیره مخاطب</Button>}>
      <div class="col g10">
        <TextField value={name} onInput={setName} label="نام و نام خانوادگی *" testId="contact_name_input" />
        <TextField value={phone} onInput={setPhone} label="شماره تلفن *" type="tel" inputMode="tel" testId="contact_phone_input" />
        <TextField value={email} onInput={setEmail} label="ایمیل (اختیاری)" type="email" inputMode="email" testId="contact_email_input" />
        <TextField value={notes} onInput={setNotes} label="یادداشت" multiline maxRows={3} testId="contact_notes_input" />
        <div class="row between">
          <span class="bodyMedium" style={{ color: 'var(--on-surface)' }}>مخاطب برگزیده</span>
          <Switch checked={fav} onChange={setFav} />
        </div>
      </div>
    </Dialog>
  );
}

export async function readClipboard(): Promise<string | null> {
  try { return await navigator.clipboard.readText(); } catch { return null; }
}

export function PasteTextDialog({ onDismiss, onConfirm }: { onDismiss: () => void; onConfirm: (t: string) => void }) {
  const [text, setText] = useState('');
  return (
    <Dialog onDismiss={onDismiss} icon={mdiContentPaste} title="ورود سریع متن یا شماره‌ها"
      dismiss={<Button kind="text" onClick={onDismiss}>انصراف</Button>}
      confirm={<Button disabled={!text.trim()} testId="confirm_paste_button" onClick={() => { onConfirm(text); onDismiss(); }}>استخراج و افزودن</Button>}>
      <div class="col g10">
        <div class="bodySmall muted">متن پیامک، فهرست شماره‌ها یا خروجی XML/JSON را اینجا بچسبانید تا وارد eSkyTell شود.</div>
        <Button kind="outlined" icon={mdiContentPaste} class="full" testId="paste_clipboard_button" onClick={async () => { const t = await readClipboard(); if (t) setText(t); }}>چسباندن از کلیپ‌بورد</Button>
        <TextField value={text} onInput={setText} label="متن پیامک یا تماس‌ها" multiline minRows={4} maxRows={7} testId="paste_text_input" />
      </div>
    </Dialog>
  );
}

function PermissionRow({ icon, title, description, granted }: { icon: string; title: string; description: string; granted: boolean }) {
  return (
    <div class="row g12" style={{ background: alpha('var(--surface-variant)', 0.65), borderRadius: 'var(--r-medium)', padding: 12 }}>
      <Icon path={icon} color={granted ? 'var(--emerald)' : 'var(--amber)'} />
      <div class="col g2 grow">
        <div class="titleSmall bold">{title}</div>
        <div class="bodySmall muted">{description}</div>
      </div>
      <Icon path={granted ? mdiCheckCircle : mdiAlertOutline} color={granted ? 'var(--emerald)' : 'var(--amber)'} />
    </div>
  );
}

export function PermissionsManagerSheet({ summary, onRequestAllPermitted, onDismiss }: { summary: PermissionSummary; onRequestAllPermitted: () => void; onDismiss: () => void }) {
  const all = summary.bluetoothGranted && summary.contactsGranted && summary.notificationsGranted;
  return (
    <BottomSheet onDismiss={onDismiss}>
      <div class="col g12" style={{ padding: '0 24px 32px' }}>
        <div class="row g10"><Icon path={mdiShieldLock} size={28} color="var(--primary)" /><span class="titleLarge">مجوزهای فعال eSkyTell</span></div>
        <div class="bodySmall muted">دسترسی‌های لازم برای ارتباط زنده بلوتوثی (BLE/Classic)، همگام‌سازی دفترچه مخاطبین، مسیریابی صدا و اعلان‌های فوری:</div>
        <PermissionRow icon={mdiBluetooth} title="بلوتوث و اسکن BLE / Classic" description="جستجو، جفت‌سازی و اتصال دوطرفه با آیفون و گوشی‌های دیگر" granted={summary.bluetoothGranted} />
        <PermissionRow icon={mdiContacts} title="خواندن و ذخیره مخاطبین" description="همگام‌سازی مخاطبین گوشی و ارسال مستقیم به آیفون با فرمت vCard" granted={summary.contactsGranted} />
        <PermissionRow icon={mdiBell} title="اعلان‌های زنده تماس و پیامک" description="نمایش فوری هشدارهای دریافتی از پل بلوتوث" granted={summary.notificationsGranted} />
        <PermissionRow icon={mdiPhone} title="شماره‌گیر و مسیریابی صدا (بدون مجوز حساس)" description="اجرای تماس از شماره‌گیر استاندارد و انتقال صوت روی بلوتوث" granted={true} />
        <Button icon={mdiCheckCircle} style={{ height: 48 }} class="full" testId="grant_all_permitted_button" onClick={() => { onRequestAllPermitted(); onDismiss(); }}>
          {all ? 'همه مجوزهای لازم فعال هستند' : 'اعطای مجوزهای بلوتوث، مخاطبین و اعلان'}
        </Button>
      </div>
    </BottomSheet>
  );
}

function GuideStepCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div class="row g12 astart" style={{ background: alpha('var(--surface-variant)', 0.7), borderRadius: 'var(--r-medium)', padding: 14 }}>
      <span class="titleSmall" style={{ background: 'var(--primary-container)', color: 'var(--on-primary-container)', borderRadius: 'var(--r-small)', padding: '4px 10px' }}>{step}</span>
      <div class="col g4">
        <div class="titleSmall bold">{title}</div>
        <div class="bodySmall muted">{body}</div>
      </div>
    </div>
  );
}

export function IphoneGuideSheet({ onDismiss }: { onDismiss: () => void }) {
  return (
    <BottomSheet onDismiss={onDismiss}>
      <div class="col g14" style={{ padding: '0 24px 32px' }}>
        <div class="row g10"><Icon path={mdiCellphone} size={28} color="var(--primary)" /><span class="titleLarge">راهنمای پل بلوتوثی آیفون در eSkyTell</span></div>
        <GuideStepCard step="۱" title="جفت‌سازی آیفون یا گوشی دوم" body="در تب «پل بلوتوث»، بلوتوث آیفون را روشن و جستجو را لمس کنید؛ سپس حالت «آماده دریافت زنده (BLE + RFCOMM)» را فعال نگه دارید." />
        <GuideStepCard step="۲" title="شماره‌گیری و پیامک با رابط آشنا و دو سیم‌کارت" body="در تب «تلفن» یا «پیامک»، سیم‌کارت دلخواه (SIM 1 / SIM 2) را انتخاب کنید و تماس یا پیام را مستقیم یا از طریق پل بلوتوث بفرستید." />
        <GuideStepCard step="۳" title="اشتراک فایل به آیفون (vCard و HTML)" body="برای انتقال فوری مخاطبین و گزارش پیامک‌ها به آیفون بدون نیاز به نصب اپ ثانویه، از خروجی استاندارد vCard یا گزارش HTML استفاده کنید." />
        <Button icon={mdiCheckCircle} class="full" style={{ height: 48 }} onClick={onDismiss}>متوجه شدم</Button>
      </div>
    </BottomSheet>
  );
}

function CallControlCircle({ icon, label, active, onClick, testId }: { icon: string; label: string; active: boolean; onClick: () => void; testId: string }) {
  return (
    <div class="col acenter g6">
      <button type="button" data-testid={testId} onClick={onClick} aria-label={label}
        style={{ width: 58, height: 58, borderRadius: '50%', border: 'none', background: active ? 'var(--mint)' : '#1A2F2A', color: active ? '#00241C' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon path={icon} size={26} />
      </button>
      <span class="labelSmall center" style={{ color: '#C2DBD5', maxWidth: 72 }}>{label}</span>
    </div>
  );
}

export function ActiveBridgeCallOverlay({ activeCall, simLabel, onToggleMute, onToggleSpeaker, onToggleBluetoothAudio, onLaunchSystemDialer, onEndCall }: {
  activeCall: ActiveBridgeCall; simLabel: string; onToggleMute: () => void; onToggleSpeaker: () => void; onToggleBluetoothAudio: () => void; onLaunchSystemDialer: () => void; onEndCall: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - activeCall.startedAtMillis) / 1000)));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [activeCall.startedAtMillis]);
  const timer = `${pad2(Math.floor(elapsed / 60))}:${pad2(elapsed % 60)}`;
  return (
    <div class="col between acenter" style={{ position: 'fixed', inset: 0, background: 'linear-gradient(#061612, #09110F, #0B1E1A)', padding: 'calc(24px + var(--sat)) 24px calc(24px + var(--sab))', zIndex: 40 }}>
      <div class="col acenter g10" style={{ paddingTop: 36 }}>
        <div class="row g6" style={{ background: alpha('#00D4AA', 0.16), border: `1px solid ${alpha('#00D4AA', 0.45)}`, borderRadius: 999, padding: '6px 14px' }}>
          <Icon path={mdiBluetoothConnect} size={16} color="var(--mint)" />
          <span class="labelMedium" style={{ color: 'var(--mint)' }}>{activeCall.targetDeviceName} • {simLabel}</span>
        </div>
        <div style={{ height: 16 }} />
        <div class="row jcenter" style={{ width: 96, height: 96, borderRadius: '50%', background: alpha('#00D4AA', 0.15), border: `2px solid ${alpha('#F4B860', 0.55)}` }}>
          <span class="headlineLarge" style={{ color: '#fff', fontWeight: 700 }}>{activeCall.contactName.slice(0, 1).toUpperCase()}</span>
        </div>
        <span class="headlineSmall" style={{ color: '#fff', fontWeight: 700 }}>{activeCall.contactName}</span>
        <span class="titleMedium mono ltr" style={{ color: '#9EC2B9' }}>{activeCall.phoneNumber}</span>
        <span class="bodyLarge mono" style={{ color: 'var(--gold)' }}>تماس پل زنده • {timer}</span>
      </div>
      <div class="col acenter g24" style={{ paddingBottom: 32 }}>
        <div class="row g20 astart">
          <CallControlCircle icon={mdiMicrophoneOff} label="بی‌صدا" active={activeCall.isMuted} onClick={onToggleMute} testId="call_mute_btn" />
          <CallControlCircle icon={mdiVolumeHigh} label="اسپیکر" active={activeCall.isSpeaker} onClick={onToggleSpeaker} testId="call_speaker_btn" />
          <CallControlCircle icon={mdiBluetoothAudio} label="صوت بلوتوث" active={activeCall.isBluetoothAudio} onClick={onToggleBluetoothAudio} testId="call_bt_audio_btn" />
          <CallControlCircle icon={mdiDialpad} label="شماره‌گیر گوشی" active={false} onClick={onLaunchSystemDialer} testId="call_native_dialer_btn" />
        </div>
        <button type="button" data-testid="end_bridge_call_btn" onClick={onEndCall} aria-label="پایان تماس"
          style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon path={mdiPhoneHangup} size={32} />
        </button>
      </div>
    </div>
  );
}

function PlanBox({ title, price, badge, highlight }: { title: string; price: string; badge: string | null; highlight: boolean }) {
  return (
    <div class="col acenter g6 grow" style={{ padding: 14, borderRadius: 'var(--r-medium)', background: highlight ? alpha('var(--primary-container)', 0.45) : alpha('var(--surface-variant)', 0.6), border: `${highlight ? 1.5 : 1}px solid ${highlight ? 'var(--gold)' : 'var(--outline)'}` }}>
      <span class="titleSmall bold">{title}</span>
      <span class="bodyMedium latin bold center" style={{ color: highlight ? 'var(--gold)' : 'var(--primary)' }}>{price}</span>
      {badge && <span class="labelSmall" style={{ background: alpha('#F4B860', 0.18), color: 'var(--gold)', borderRadius: 999, padding: '2px 8px' }}>{badge}</span>}
    </div>
  );
}

/** Legacy paywall (kept for parity; MainActivity uses PaymentCheckoutSheet). */
export function PaywallBottomSheet({ appConfig, onOpenPaymentUrl, onDismiss }: { appConfig: AppGlobalConfig; onOpenPaymentUrl: (u: string) => void; onDismiss: () => void }) {
  return (
    <BottomSheet onDismiss={onDismiss}>
      <div class="col acenter g14" style={{ padding: '0 24px 32px' }}>
        <div class="row jcenter" style={{ width: 64, height: 64, borderRadius: '50%', background: alpha('#F4B860', 0.18) }}><Icon path={mdiCrown} size={34} color="var(--gold)" /></div>
        <span class="headlineSmall center">اشتراک ویژه eSkyTell Pro</span>
        <span class="bodyMedium muted center">{appConfig.paywallMessage}</span>
        <div class="row g10 full" style={{ alignItems: 'stretch' }}>
          <PlanBox title="پلن ماهانه" price={appConfig.monthlyPriceLabel} badge={appConfig.freeTrialDays > 0 ? `${appConfig.freeTrialDays} روز تست رایگان` : null} highlight={false} />
          <PlanBox title="پلن سالانه" price={appConfig.yearlyPriceLabel} badge="به‌صرفه‌تر" highlight={true} />
        </div>
        {appConfig.paymentUrl.trim() ? (
          <Button icon={mdiCheckDecagram} class="full" style={{ height: 50 }} testId="paywall_checkout_button" onClick={() => onOpenPaymentUrl(appConfig.paymentUrl)}>خرید و فعال‌سازی اشتراک</Button>
        ) : (
          <div class="bodySmall center full" style={{ background: 'var(--surface-variant)', borderRadius: 'var(--r-medium)', padding: 12 }}>برای فعال‌سازی اشتراک روی حساب خود با پشتیبانی یا مدیریت eSkyTell تماس بگیرید.</div>
        )}
        <Button kind="text" onClick={onDismiss}>بازگشت</Button>
      </div>
    </BottomSheet>
  );
}

export function HistoryBottomSheet({ history, onDeleteEntry, onClearHistory, onDismiss }: { history: TransferHistoryEntity[]; onDeleteEntry: (id: number) => void; onClearHistory: () => void; onDismiss: () => void }) {
  return (
    <BottomSheet onDismiss={onDismiss}>
      <div class="col g12" style={{ padding: '0 20px 28px' }}>
        <div class="row between">
          <div class="row g8"><Icon path={mdiHistory} color="var(--primary)" /><span class="titleLarge">گزارش انتقال‌های بلوتوثی ({history.length})</span></div>
          {history.length > 0 && <Button kind="text" testId="clear_history_button" onClick={onClearHistory}><span style={{ color: 'var(--rose)' }}>پاک کردن</span></Button>}
        </div>
        {history.length === 0 ? (
          <div class="bodySmall muted" style={{ background: alpha('var(--surface-variant)', 0.5), borderRadius: 'var(--r-medium)', padding: 18 }}>
            هنوز انتقالی ثبت نشده است. پس از ارسال یا دریافت پیامک/تماس از طریق بلوتوث، گزارش اینجا نمایش داده می‌شود.
          </div>
        ) : (
          <div class="col g8 scroll" style={{ maxHeight: 340 }}>
            {history.map((e) => {
              const color = e.status.includes('ناموفق') ? 'var(--rose)' : e.status.includes('موفق') || e.status.includes('ارسال') ? 'var(--emerald)' : 'var(--primary)';
              return (
                <div key={e.id} class="row between" style={{ background: alpha('var(--surface-variant)', 0.45), borderRadius: 'var(--r-medium)', padding: 12 }}>
                  <div class="col g2 grow">
                    <div class="row g6"><span class="titleSmall bold">{e.targetDeviceName}</span><span class="labelSmall" style={{ color }}>{e.status}</span></div>
                    <span class="bodySmall muted">{e.channelMethod} • {e.exportFormat}</span>
                    <span class="labelSmall mono muted">{e.smsCount} پیامک • {e.callCount} تماس • {fmtDate(e.timestampMillis, 'yyyy/MM/dd HH:mm')}</span>
                  </div>
                  <IconButton path={mdiDeleteOutline} label="حذف گزارش" onClick={() => onDeleteEntry(e.id)} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
