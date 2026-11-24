// Port of ui/screens/AdminPaymentsTab.kt
import { useEffect, useState } from 'preact/hooks';
import { mdiCheckCircle, mdiCloseCircle, mdiDeleteOutline, mdiPlus, mdiPublish } from '@mdi/js';
import { Button, Chip, Dialog, Icon, IconButton, Portal, Switch, TextField, alpha } from '../ui/kit';
import { formatCardNumber } from '../components/PaymentCheckoutSheet';
import {
  formatToman, statusFromRaw, planFromRaw, methodFromRaw, PaymentPlanInfo, PaymentMethodLabel, PaymentStatusLabel,
  type PaymentRequest, type PaymentStatus, type BankCardInfo, type CryptoWalletInfo,
} from '../data/models';
import type { PaymentUiState } from '../data/store';

const faFmt = (() => {
  try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return null; }
})();
/** Persian (Jalali) calendar like android.icu SimpleDateFormat("yyyy/MM/dd HH:mm", fa_IR@calendar=persian). */
export function formatFaDate(d: Date): string {
  if (faFmt) {
    const p = Object.fromEntries(faFmt.formatToParts(d).map((x) => [x.type, x.value]));
    if (p.year && p.month && p.day) return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
  }
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${z(d.getMonth() + 1)}/${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}
const shortId = () => (crypto.randomUUID?.() ?? Math.random().toString(16).slice(2)).replace(/-/g, '').slice(0, 8);

export function PaymentsAdminTab({ paymentState, isSaving, onSaveConfig, onApprove, onReject, onDelete }: {
  paymentState: PaymentUiState; isSaving: boolean;
  onSaveConfig: (m: number, y: number, ins: string, cards: BankCardInfo[], wallets: CryptoWalletInfo[]) => void;
  onApprove: (r: PaymentRequest, note: string) => void; onReject: (r: PaymentRequest, note: string) => void; onDelete: (id: string) => void;
}) {
  const [section, setSection] = useState(0);
  const pending = paymentState.adminRequests.filter((r) => statusFromRaw(r.status) === 'PENDING').length;
  return (
    <div class="col" style={{ height: '100%' }}>
      <div class="row g8" style={{ padding: '8px 16px' }}>
        <Chip selected={section === 0} onClick={() => setSection(0)}>درخواست‌ها{pending > 0 ? ` (${pending})` : ''}</Chip>
        <Chip selected={section === 1} onClick={() => setSection(1)}>کارت‌ها، کیف پول و قیمت</Chip>
      </div>
      <div class="grow" style={{ minHeight: 0 }}>
        {section === 0 ? <RequestsSection requests={paymentState.adminRequests} onApprove={onApprove} onReject={onReject} onDelete={onDelete} />
          : <PaymentSettingsSection paymentState={paymentState} isSaving={isSaving} onSaveConfig={onSaveConfig} />}
      </div>
    </div>
  );
}

function RequestsSection({ requests, onApprove, onReject, onDelete }: { requests: PaymentRequest[]; onApprove: (r: PaymentRequest, n: string) => void; onReject: (r: PaymentRequest, n: string) => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<PaymentStatus>('PENDING');
  const [showAll, setShowAll] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRequest | null>(null);
  const [approving, setApproving] = useState<PaymentRequest | null>(null);
  const [note, setNote] = useState('');
  const list = requests.filter((r) => showAll || statusFromRaw(r.status) === filter);
  return (
    <div class="col g10 scroll" style={{ height: '100%', padding: '0 16px 24px' }}>
      <div class="row g6 hscroll" style={{ flex: 'none' }}>
        {(['PENDING', 'APPROVED', 'REJECTED'] as PaymentStatus[]).map((st) => <Chip key={st} selected={!showAll && filter === st} onClick={() => { setShowAll(false); setFilter(st); }}>{PaymentStatusLabel[st]}</Chip>)}
        <Chip selected={showAll} onClick={() => setShowAll(true)}>همه</Chip>
      </div>
      {list.length === 0 && <span class="bodyMedium muted" style={{ padding: '24px 0' }}>موردی برای نمایش نیست.</span>}
      {list.map((r) => {
        const st = statusFromRaw(r.status);
        const color = st === 'PENDING' ? '#F4B860' : st === 'APPROVED' ? '#10B981' : '#F87171';
        return (
          <div key={r.id} class="card medium col g6" style={{ padding: 14, flex: 'none', border: `1px solid ${alpha(color, 0.55)}` }}>
            <div class="row">
              <div class="col grow">
                <span class="titleSmall bold">{r.userName.trim() ? r.userName : 'کاربر'}</span>
                <span class="bodySmall muted ellipsis">{r.userEmail}</span>
              </div>
              <span class="labelSmall" style={{ color, background: alpha(color, 0.16), borderRadius: 'var(--r-small)', padding: '4px 8px' }}>{PaymentStatusLabel[st]}</span>
            </div>
            <span class="bodyMedium bold">{PaymentPlanInfo[planFromRaw(r.plan)].labelFa} • {formatToman(r.amountToman)} • {PaymentMethodLabel[methodFromRaw(r.method)]}</span>
            {r.destination.trim() && <span class="bodySmall" style={{ overflowWrap: 'anywhere' }}>مقصد: {r.destination}</span>}
            {r.trackingCode.trim() && <span class="bodySmall" style={{ color: 'var(--mint)', overflowWrap: 'anywhere' }}>کد پیگیری: {r.trackingCode}</span>}
            {r.createdAt && <span class="labelSmall muted">زمان ثبت: {formatFaDate(r.createdAt.toDate())}</span>}
            {r.adminNote.trim() && <span class="labelSmall">یادداشت: {r.adminNote}</span>}
            {r.receiptImage.trim() && (
              <img src={`data:image/jpeg;base64,${r.receiptImage}`} alt="تصویر فیش" onClick={() => setViewing(r.receiptImage)}
                style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 'var(--r-small)', cursor: 'pointer' }} />
            )}
            <div class="row g8">
              {st === 'PENDING' ? (
                <>
                  <Button icon={mdiCheckCircle} onClick={() => setApproving(r)} style={{ flex: 1, background: 'var(--emerald)', padding: '0 8px' }}>تایید و فعال‌سازی</Button>
                  <button type="button" class="btn outlined" onClick={() => { setNote(''); setRejecting(r); }} style={{ flex: 1, padding: '0 8px' }}><Icon path={mdiCloseCircle} size={18} color="var(--rose)" />رد</button>
                </>
              ) : <span class="grow" />}
              <IconButton path={mdiDeleteOutline} label="حذف" color="var(--rose)" onClick={() => onDelete(r.id)} />
            </div>
          </div>
        );
      })}
      {approving && (
        <Dialog onDismiss={() => setApproving(null)} title="تایید پرداخت" titleStart
          dismiss={<Button kind="text" onClick={() => setApproving(null)}>انصراف</Button>}
          confirm={<Button onClick={() => { onApprove(approving, ''); setApproving(null); }}>تایید</Button>}>
          <span class="bodyMedium">{PaymentPlanInfo[planFromRaw(approving.plan)].labelFa} برای «{approving.userName}» فعال (یا تمدید) شود؟</span>
        </Dialog>
      )}
      {rejecting && (
        <Dialog onDismiss={() => setRejecting(null)} title="رد درخواست" titleStart
          dismiss={<Button kind="text" onClick={() => setRejecting(null)}>انصراف</Button>}
          confirm={<Button onClick={() => { onReject(rejecting, note); setRejecting(null); }}>رد درخواست</Button>}>
          <TextField value={note} onInput={(v) => setNote(v.slice(0, 300))} label="دلیل (به کاربر نمایش داده می‌شود)" />
        </Dialog>
      )}
      {viewing && (
        <Portal>
          <div class="scrim" onClick={() => setViewing(null)}>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-large)', padding: 8, maxWidth: '100%' }}>
              <img src={`data:image/jpeg;base64,${viewing}`} alt="تصویر فیش" style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }} />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

function PaymentSettingsSection({ paymentState, isSaving, onSaveConfig }: { paymentState: PaymentUiState; isSaving: boolean; onSaveConfig: (m: number, y: number, ins: string, c: BankCardInfo[], w: CryptoWalletInfo[]) => void }) {
  const cfg = paymentState.config;
  const [monthly, setMonthly] = useState(String(cfg.monthlyPriceToman));
  const [yearly, setYearly] = useState(String(cfg.yearlyPriceToman));
  const [instructions, setInstructions] = useState(cfg.instructions);
  const [cards, setCards] = useState<BankCardInfo[]>(cfg.cards);
  const [wallets, setWallets] = useState<CryptoWalletInfo[]>(cfg.wallets);
  const [stamp, setStamp] = useState(cfg.updatedAt?.toMillis() ?? null);
  useEffect(() => {
    const cur = cfg.updatedAt?.toMillis() ?? null;
    if (cur !== stamp || (cards.length === 0 && wallets.length === 0)) {
      setMonthly(String(cfg.monthlyPriceToman)); setYearly(String(cfg.yearlyPriceToman)); setInstructions(cfg.instructions);
      setCards(cfg.cards); setWallets(cfg.wallets); setStamp(cur);
    }
  }, [cfg.updatedAt?.toMillis()]);
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 12);
  return (
    <div class="col g12 scroll" style={{ height: '100%', padding: '0 16px 24px' }}>
      <SectionCard title="قیمت اشتراک‌ها (تومان)">
        <div class="row g8 astart">
          <div class="col g4 grow"><TextField value={monthly} onInput={(v) => setMonthly(digits(v))} label="ماهانه" inputMode="numeric" /><span class="bodySmall muted" style={{ paddingInline: 16 }}>{formatToman(Number(monthly) || 0)}</span></div>
          <div class="col g4 grow"><TextField value={yearly} onInput={(v) => setYearly(digits(v))} label="سالانه" inputMode="numeric" /><span class="bodySmall muted" style={{ paddingInline: 16 }}>{formatToman(Number(yearly) || 0)}</span></div>
        </div>
        <TextField value={instructions} onInput={(v) => setInstructions(v.slice(0, 800))} label="راهنمای پرداخت برای کاربر" multiline minRows={2} maxRows={5} />
      </SectionCard>
      <SectionCard title={`شماره کارت‌ها (${cards.length})`}>
        {cards.map((c, i) => <CardEditor key={c.id || i} card={c} onChange={(n) => setCards(cards.map((x, j) => (j === i ? n : x)))} onDelete={() => setCards(cards.filter((_, j) => j !== i))} />)}
        <Button kind="outlined" icon={mdiPlus} class="full" onClick={() => setCards([...cards, { id: shortId(), bankName: '', cardNumber: '', holderName: '', sheba: '', active: true }])}>افزودن کارت</Button>
      </SectionCard>
      <SectionCard title={`کیف پول‌های ارز دیجیتال (${wallets.length})`}>
        {wallets.map((w, i) => <WalletEditor key={w.id || i} w={w} onChange={(n) => setWallets(wallets.map((x, j) => (j === i ? n : x)))} onDelete={() => setWallets(wallets.filter((_, j) => j !== i))} />)}
        <Button kind="outlined" icon={mdiPlus} class="full" onClick={() => setWallets([...wallets, { id: shortId(), coin: 'USDT', network: 'TRC20', address: '', note: '', active: true }])}>افزودن کیف پول</Button>
      </SectionCard>
      <Button icon={mdiPublish} disabled={isSaving} onClick={() => onSaveConfig(Number(monthly) || 0, Number(yearly) || 0, instructions, cards, wallets)} style={{ width: '100%', height: 50, flex: 'none' }}>ذخیره و انتشار برای همه کاربران</Button>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: any }) {
  return (
    <div class="card bordered col g10" style={{ padding: 16, flex: 'none' }}>
      <span class="titleSmall bold">{title}</span>
      {children}
    </div>
  );
}

function CardEditor({ card, onChange, onDelete }: { card: BankCardInfo; onChange: (c: BankCardInfo) => void; onDelete: () => void }) {
  return (
    <div class="col g6" style={{ background: alpha('var(--surface-variant)', 0.4), borderRadius: 'var(--r-medium)', padding: 10, '--tf-bg': 'var(--surface)' } as any}>
      <div class="row g6">
        <span class="titleSmall grow ltr" style={{ textAlign: 'right' }}>{card.cardNumber.trim() ? formatCardNumber(card.cardNumber) : <span dir="rtl">کارت جدید</span>}</span>
        <span class="labelSmall">فعال</span>
        <Switch checked={card.active} onChange={(v) => onChange({ ...card, active: v })} />
        <IconButton path={mdiDeleteOutline} label="حذف" color="var(--rose)" onClick={onDelete} />
      </div>
      <TextField value={card.cardNumber} onInput={(v) => onChange({ ...card, cardNumber: v.replace(/\D/g, '').slice(0, 19) })} label="شماره کارت" inputMode="numeric" />
      <div class="row g6">
        <TextField value={card.bankName} onInput={(v) => onChange({ ...card, bankName: v.slice(0, 60) })} label="نام بانک" />
        <TextField value={card.holderName} onInput={(v) => onChange({ ...card, holderName: v.slice(0, 80) })} label="نام صاحب کارت" />
      </div>
      <TextField value={card.sheba} onInput={(v) => onChange({ ...card, sheba: v.slice(0, 34) })} label="شماره شبا (اختیاری)" />
    </div>
  );
}

function WalletEditor({ w, onChange, onDelete }: { w: CryptoWalletInfo; onChange: (c: CryptoWalletInfo) => void; onDelete: () => void }) {
  return (
    <div class="col g6" style={{ background: alpha('var(--surface-variant)', 0.4), borderRadius: 'var(--r-medium)', padding: 10, '--tf-bg': 'var(--surface)' } as any}>
      <div class="row g6">
        <span class="titleSmall grow">{[w.coin, w.network].filter((x) => x.trim()).join(' • ') || 'کیف پول جدید'}</span>
        <span class="labelSmall">فعال</span>
        <Switch checked={w.active} onChange={(v) => onChange({ ...w, active: v })} />
        <IconButton path={mdiDeleteOutline} label="حذف" color="var(--rose)" onClick={onDelete} />
      </div>
      <div class="row g6">
        <TextField value={w.coin} onInput={(v) => onChange({ ...w, coin: v.slice(0, 30) })} label="ارز (مثلاً USDT)" />
        <TextField value={w.network} onInput={(v) => onChange({ ...w, network: v.slice(0, 30) })} label="شبکه (مثلاً TRC20)" />
      </div>
      <TextField value={w.address} onInput={(v) => onChange({ ...w, address: v.trim().slice(0, 200) })} label="آدرس کیف پول" dir="ltr" />
      <TextField value={w.note} onInput={(v) => onChange({ ...w, note: v.slice(0, 200) })} label="توضیح (مثلاً Memo یا هشدار شبکه)" />
    </div>
  );
}
