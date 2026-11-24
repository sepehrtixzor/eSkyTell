// Port of ui/components/PaymentCheckoutSheet.kt
import { useEffect, useRef, useState } from 'preact/hooks';
import { mdiCrown, mdiCreditCard, mdiBitcoin, mdiContentCopy, mdiCheckCircle, mdiImagePlus, mdiTimerSand, mdiCloseCircle } from '@mdi/js';
import { BottomSheet, Button, Chip, Icon, IconButton, TextField, Spinner, alpha } from '../ui/kit';
import { formatToman, priceFor, statusFromRaw, planFromRaw, PaymentPlanInfo, PaymentStatusLabel, type AppGlobalConfig, type PaymentPlan, type PaymentMethod } from '../data/models';
import type { PaymentUiState } from '../data/store';

export const formatCardNumber = (raw: string) => (raw.replace(/\D/g, '').match(/.{1,4}/g) ?? []).join('-');

export async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* */ } ta.remove(); return true;
  }
}

export function PaymentCheckoutSheet({ appConfig, paymentState, isSubscriptionActive, onSubmit, onDismiss }: {
  appConfig: AppGlobalConfig; paymentState: PaymentUiState; isSubscriptionActive: boolean;
  onSubmit: (plan: PaymentPlan, method: PaymentMethod, dest: string, tracking: string, image: File | null) => void; onDismiss: () => void;
}) {
  const cfg = paymentState.config;
  const [plan, setPlan] = useState<PaymentPlan>('YEARLY');
  const [method, setMethod] = useState<PaymentMethod>('CARD');
  const [dest, setDest] = useState('');
  const [tracking, setTracking] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeCards = cfg.cards.filter((c) => c.active && c.cardNumber.trim());
  const activeWallets = cfg.wallets.filter((w) => w.active && w.address.trim());
  const hasPending = paymentState.myRequests.some((r) => statusFromRaw(r.status) === 'PENDING');
  useEffect(() => { if (paymentState.submitSuccessTick > 0) { setTracking(''); setImage(null); } }, [paymentState.submitSuccessTick]);

  const configReady = paymentState.configLoaded;
  const destOk = !!dest.trim() || (activeCards.length === 0 && activeWallets.length === 0);
  const canSubmit = configReady && !hasPending && !paymentState.isSubmitting && (!!tracking.trim() || image != null) && destOk;

  return (
    <BottomSheet onDismiss={onDismiss}>
      <div class="col g14" style={{ padding: '0 20px 32px' }}>
        <div class="row g10">
          <div class="row jcenter" style={{ width: 48, height: 48, borderRadius: '50%', background: alpha('#F4B860', 0.18), flex: 'none' }}><Icon path={mdiCrown} size={26} color="var(--gold)" /></div>
          <div class="col">
            <span class="titleLarge">خرید اشتراک eSkyTell Pro</span>
            <span class="bodySmall" style={{ color: isSubscriptionActive ? 'var(--emerald)' : 'var(--on-surface-variant)' }}>{isSubscriptionActive ? 'اشتراک شما فعال است؛ با خرید جدید تمدید می‌شود.' : appConfig.paywallMessage}</span>
          </div>
        </div>

        <span class="titleSmall bold">۱. انتخاب پلن</span>
        <div class="row g10" style={{ alignItems: 'stretch' }}>
          <PlanChoice title="ماهانه" price={formatToman(cfg.monthlyPriceToman)} sub="۳۰ روز" selected={plan === 'MONTHLY'} onClick={() => setPlan('MONTHLY')} />
          <PlanChoice title="سالانه" price={formatToman(cfg.yearlyPriceToman)} sub="۳۶۵ روز • به‌صرفه‌تر" selected={plan === 'YEARLY'} onClick={() => setPlan('YEARLY')} />
        </div>

        <span class="titleSmall bold">۲. واریز {formatToman(priceFor(cfg, plan))}</span>
        {cfg.instructions.trim() && <span class="bodySmall muted">{cfg.instructions}</span>}
        <div class="row g8">
          <Chip selected={method === 'CARD'} onClick={() => { setMethod('CARD'); setDest(''); }}><Icon path={mdiCreditCard} size={18} />کارت به کارت</Chip>
          {activeWallets.length > 0 && <Chip selected={method === 'CRYPTO'} onClick={() => { setMethod('CRYPTO'); setDest(''); }}><Icon path={mdiBitcoin} size={18} />ارز دیجیتال</Chip>}
        </div>
        {method === 'CARD' ? (
          <>
            {activeCards.length === 0 && <InfoBox text="هنوز شماره کارتی توسط مدیریت ثبت نشده است." />}
            {activeCards.map((c) => {
              const d = `${c.bankName} ${c.cardNumber} (${c.holderName})`;
              return <DestinationCard key={c.id || c.cardNumber} title={c.bankName.trim() ? c.bankName : 'کارت بانکی'} main={formatCardNumber(c.cardNumber)} ltr
                lines={[c.holderName.trim() ? `به نام: ${c.holderName}` : null, c.sheba.trim() ? `شبا: ${c.sheba}` : null].filter(Boolean) as string[]}
                selected={dest === d} onSelect={() => setDest(d)} onCopy={async () => { await copyText(c.cardNumber); setCopied('شماره کارت کپی شد'); }} />;
            })}
          </>
        ) : activeWallets.map((w) => {
          const d = `${w.coin} ${w.network}: ${w.address}`;
          return <DestinationCard key={w.id || w.address} title={[w.coin, w.network].filter((x) => x.trim()).join(' • ') || 'کیف پول'} main={w.address} ltr
            lines={w.note.trim() ? [w.note] : []} selected={dest === d} onSelect={() => setDest(d)} onCopy={async () => { await copyText(w.address); setCopied('آدرس کیف پول کپی شد'); }} />;
        })}
        {copied && <span class="labelSmall" style={{ color: 'var(--mint)' }}>{copied}</span>}

        <span class="titleSmall bold">۳. ثبت فیش واریزی</span>
        <TextField value={tracking} onInput={(v) => setTracking(v.slice(0, 100))} label={method === 'CRYPTO' ? 'هش تراکنش (TxID)' : 'کد پیگیری / شماره مرجع'} testId="payment_tracking_code" />
        <button type="button" class="btn outlined" onClick={() => fileRef.current?.click()} style={{ width: '100%', color: 'var(--primary)' }}>
          <Icon path={image ? mdiCheckCircle : mdiImagePlus} color={image ? 'var(--emerald)' : 'var(--primary)'} />
          {image ? 'تصویر فیش انتخاب شد (تغییر)' : 'آپلود تصویر فیش (اختیاری)'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) setImage(f); (e.target as HTMLInputElement).value = ''; }} />

        {!configReady ? <InfoBox text="در حال دریافت تنظیمات پرداخت… لطفاً چند لحظه صبر کنید." /> : !destOk && !hasPending ? <InfoBox text="ابتدا کارت یا کیف پول مقصد را انتخاب کنید." /> : null}
        <Button disabled={!canSubmit} testId="payment_submit_button" onClick={() => onSubmit(plan, method, dest, tracking, image)} style={{ width: '100%', height: 52, fontWeight: 700 }}>
          {paymentState.isSubmitting ? <Spinner color="var(--on-primary)" /> : 'ارسال برای تایید'}
        </Button>
        {hasPending && <InfoBox text="یک فیش در انتظار بررسی دارید؛ پس از تایید، اشتراک خودکار فعال می‌شود." />}

        {paymentState.myRequests.length > 0 && <span class="titleSmall bold">پرداخت‌های من</span>}
        {paymentState.myRequests.slice(0, 10).map((r) => {
          const st = statusFromRaw(r.status);
          const color = st === 'PENDING' ? '#F4B860' : st === 'APPROVED' ? '#10B981' : '#F87171';
          return (
            <div key={r.id} class="row g10" style={{ padding: 12, borderRadius: 'var(--r-medium)', background: alpha(color, 0.1), border: `1px solid ${alpha(color, 0.4)}` }}>
              <Icon path={st === 'PENDING' ? mdiTimerSand : st === 'APPROVED' ? mdiCheckCircle : mdiCloseCircle} color={color} />
              <div class="col grow">
                <span class="bodyMedium bold">{PaymentPlanInfo[planFromRaw(r.plan)].labelFa} • {formatToman(r.amountToman)}</span>
                <span class="bodySmall" style={{ color }}>{PaymentStatusLabel[st]}{r.adminNote.trim() ? ` — ${r.adminNote}` : ''}</span>
              </div>
            </div>
          );
        })}
        <div class="row jcenter"><Button kind="text" onClick={onDismiss}>بستن</Button></div>
      </div>
    </BottomSheet>
  );
}

function PlanChoice({ title, price, sub, selected, onClick }: { title: string; price: string; sub: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} class="col acenter g4 grow"
      style={{ padding: 14, borderRadius: 'var(--r-medium)', cursor: 'pointer', color: 'var(--on-surface)', background: selected ? alpha('#F4B860', 0.16) : alpha('var(--surface-variant)', 0.6), border: `${selected ? 2 : 1}px solid ${selected ? 'var(--gold)' : 'var(--outline)'}` }}>
      <span class="titleMedium bold">{title}</span>
      <span class="bodyMedium center" style={{ color: selected ? 'var(--gold)' : 'var(--on-surface)' }}>{price}</span>
      <span class="labelSmall muted">{sub}</span>
    </button>
  );
}

function DestinationCard({ title, main, lines, selected, onSelect, onCopy, ltr }: { title: string; main: string; lines: string[]; selected: boolean; onSelect: () => void; onCopy: () => void; ltr?: boolean }) {
  return (
    <div class="row" onClick={onSelect} style={{ padding: 12, cursor: 'pointer', borderRadius: 'var(--r-medium)', background: selected ? alpha('#00D4AA', 0.12) : 'var(--surface)', border: `${selected ? 2 : 1}px solid ${selected ? 'var(--mint)' : alpha('var(--outline)', 0.6)}` }}>
      <div class="col g2 grow">
        <span class="labelMedium muted">{title}</span>
        <span class={`titleMedium bold ${ltr ? 'ltr' : ''}`} style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{main}</span>
        {lines.map((l) => <span key={l} class="bodySmall muted" style={{ overflowWrap: 'anywhere' }}>{l}</span>)}
      </div>
      <span onClick={(e) => e.stopPropagation()}><IconButton path={mdiContentCopy} label="کپی" color="var(--mint)" onClick={onCopy} /></span>
    </div>
  );
}

function InfoBox({ text }: { text: string }) {
  return <div class="bodySmall" style={{ background: 'var(--surface-variant)', borderRadius: 'var(--r-medium)', padding: 12 }}>{text}</div>;
}
