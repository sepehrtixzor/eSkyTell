// Port of ui/auth/AuthScreen.kt + AuthErrors.kt + GoogleSignInHelper.kt (Firebase popup / redirect on web)
import { useEffect, useState } from 'preact/hooks';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  verifyPasswordResetCode, confirmPasswordReset, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
} from 'firebase/auth';
import { mdiPhone, mdiMessageText, mdiBluetoothConnect, mdiEmail, mdiShieldCheck } from '@mdi/js';
import { auth } from '../data/firebase';
import { Button, Dialog, Icon, TextField, ProgressLinear, Spinner, alpha } from '../ui/kit';
import { readClipboard } from '../components/TransferDialogs';
import heroImg from '../assets/img/img_eskytell_obsidian.jpg';
import logoImg from '../assets/img/ic_eskytell_logo.jpg';

/** AuthErrors.describe for Firebase JS SDK error codes. */
export function describeAuthError(e: any): string {
  console.error('AuthError', e?.code, e?.message);
  const code: string = e?.code ?? '';
  const msg: string = e?.message ?? '';
  switch (code) {
    case 'auth/network-request-failed':
      return 'اتصال به سرور برقرار نشد. اینترنت را بررسی کنید (در صورت فیلتر بودن سرویس‌های گوگل، VPN را روشن کنید) و دوباره امتحان کنید.';
    case 'auth/too-many-requests':
      return 'تعداد تلاش‌ها زیاد بود. چند دقیقه صبر کنید و دوباره امتحان کنید.';
    case 'auth/weak-password':
      return 'رمز عبور ضعیف است؛ حداقل ۶ کاراکتر و ترکیبی از حرف و عدد استفاده کنید.';
    case 'auth/account-exists-with-different-credential':
      return 'این ایمیل قبلاً با روش دیگری (مثلاً گوگل) ثبت شده است. با همان روش وارد شوید.';
    case 'auth/email-already-in-use':
      return 'این ایمیل قبلاً ثبت شده است. وارد شوید یا «فراموشی رمز» را بزنید.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'لینک یا کد بازیابی نامعتبر یا منقضی شده است. دوباره درخواست لینک بازیابی بدهید.';
    case 'auth/user-disabled':
      return 'این حساب توسط مدیر غیرفعال شده است.';
    case 'auth/user-not-found':
      return 'حسابی با این ایمیل پیدا نشد. ابتدا ثبت‌نام کنید.';
    case 'auth/invalid-email':
      return 'فرمت ایمیل درست نیست.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'ایمیل یا رمز عبور اشتباه است. اگر با گوگل ثبت‌نام کرده‌اید، از دکمه گوگل استفاده کنید.';
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return 'ورود با ایمیل در تنظیمات Firebase فعال نیست. مدیر باید در Firebase Console › Authentication › Sign-in method گزینه Email/Password را فعال کند.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return 'ورود با گوگل لغو شد.';
    case 'auth/unauthorized-domain':
      return 'این دامنه برای ورود در Firebase مجاز نیست. مدیر باید دامنه را در Firebase Console › Authentication › Settings › Authorized domains اضافه کند.';
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    case 'auth/invalid-api-key':
      return 'کلید API فایربیس معتبر نیست یا محدود شده است (تنظیمات firebase-config را بررسی کنید).';
    case 'auth/requests-from-referer-are-blocked':
    case 'auth/requests-to-this-api-identitytoolkit-method-google.cloud.identitytoolkit.v1.authenticationservice.signup-are-blocked.':
      return 'کلید API فایربیس برای این وب‌سایت محدود شده است (محدودیت Android/HTTP referrer روی کلید را بررسی کنید).';
  }
  if (/API key|API_KEY/i.test(msg)) return 'کلید API فایربیس معتبر نیست یا محدود شده است (تنظیمات firebase-config را بررسی کنید).';
  if (/referer|referrer/i.test(msg)) return 'کلید API فایربیس برای این وب‌سایت محدود شده است (محدودیت Android/HTTP referrer روی کلید را بررسی کنید).';
  if (code.startsWith('auth/')) return `اطلاعات ورود نامعتبر است (${code.replace('auth/', '')}).`;
  return `خطای غیرمنتظره: ${msg || String(e)}`;
}

/** AuthErrors.extractOobCode */
export function extractOobCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (!text.includes('://') && !text.includes('oobCode')) return text.length >= 10 && !text.includes(' ') ? text : null;
  const re = /oobCode=([A-Za-z0-9_\-]+)/;
  const start = text.indexOf('http');
  const url = start >= 0 ? text.substring(start).split(/[ \n]/)[0] : text;
  try {
    const u = new URL(url);
    const direct = u.searchParams.get('oobCode');
    if (direct) return direct;
    for (const k of ['link', 'continueUrl']) {
      const inner = u.searchParams.get(k);
      if (inner) { try { const c = new URL(inner).searchParams.get('oobCode'); if (c) return c; } catch { /* */ } }
    }
    return text.match(re)?.[1] ?? null;
  } catch { return text.match(re)?.[1] ?? null; }
}
const EMAIL_RE = /^[a-zA-Z0-9+._%\-]{1,256}@[a-zA-Z0-9][a-zA-Z0-9\-]{0,64}(\.[a-zA-Z0-9][a-zA-Z0-9\-]{0,25})+$/;

const isStandalone = () => (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Equivalent of attemptAutoSignIn: complete a pending Google redirect sign-in.
  useEffect(() => {
    getRedirectResult(auth).catch((e) => { if (e?.code !== 'auth/no-auth-event') setError(describeAuthError(e)); });
  }, []);

  async function google() {
    setLoading(true); setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      // Installed iOS PWAs cannot keep a popup window alive; use redirect there.
      if (isStandalone()) { await signInWithRedirect(auth, provider); return; }
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
        try { await signInWithRedirect(auth, provider); return; } catch (e2) { setError(describeAuthError(e2)); }
      } else if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
        /* onAuthCancelled */
      } else setError(describeAuthError(e));
    } finally { setLoading(false); }
  }

  return (
    <div class="scroll" style={{ height: '100%', background: 'linear-gradient(var(--bg), #0C1F1B, var(--bg))', paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)', paddingLeft: 'var(--sal)', paddingRight: 'var(--sar)' }}>
      <div class="col acenter g18" style={{ maxWidth: 520, margin: '0 auto', padding: 24, minHeight: '100%', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', height: 210, borderRadius: 'var(--r-xl)', overflow: 'hidden', flex: 'none' }}>
          <img src={heroImg} alt="eSkyTell Second Phone Bridge" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(#09110F33, #09110FE6)' }} />
          <div class="col acenter" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${alpha('#00D4AA', 0.65)}`, background: 'var(--surface)' }}>
              <img src={logoImg} alt="لوگوی eSkyTell" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ height: 10 }} />
            <span class="latin" style={{ fontSize: 28, lineHeight: '36px', fontWeight: 700, color: 'var(--mint)' }}>eSkyTell</span>
            <span class="titleSmall center" style={{ color: '#fff' }}>پل هوشمند تماس و پیامک گوشی دوم</span>
          </div>
        </div>

        <div class="card bordered col g12 full" style={{ padding: 18 }}>
          <FeatureRow icon={mdiPhone} tint="var(--mint)" title="شماره‌گیر و تماس یکپارچه" subtitle="محیط ساده و آشنا با پشتیبانی دو سیم‌کارت (SIM 1 / SIM 2)" />
          <FeatureRow icon={mdiMessageText} tint="var(--gold)" title="گفتگوهای پیامکی مرتب" subtitle="صندوق پیام رشته‌ای با پاسخ سریع و همگام‌سازی بلوتوثی" />
          <FeatureRow icon={mdiBluetoothConnect} tint="var(--mint)" title="اتصال مستقیم آیفون و اندروید" subtitle="انتقال بلوتوثی رمزنگاری‌شده بدون نیاز به سرور واسط" />
        </div>

        <EmailAuthCard enabled={!loading} onBusy={setLoading} onError={setError} onInfo={setInfo} />

        {info && <div class="bodySmall full" style={{ background: alpha('#00D4AA', 0.14), border: `1px solid ${alpha('#00D4AA', 0.5)}`, borderRadius: 'var(--r-medium)', color: 'var(--mint)', padding: 12 }}>{info}</div>}

        <div class="row full g4">
          <div class="divider grow" style={{ background: 'var(--outline)' }} />
          <span class="labelMedium muted">&nbsp; یا &nbsp;</span>
          <div class="divider grow" style={{ background: 'var(--outline)' }} />
        </div>

        {error && <div class="bodySmall full" style={{ background: alpha('#F87171', 0.14), border: `1px solid ${alpha('#F87171', 0.5)}`, borderRadius: 'var(--r-medium)', color: 'var(--rose)', padding: 12 }}>{error}</div>}

        <Button disabled={loading} testId="google_sign_in_button" onClick={google} style={{ width: '100%', height: 54, fontSize: 16, fontWeight: 700 }}>
          {loading ? <Spinner color="var(--on-primary)" /> : <><Icon path={mdiShieldCheck} size={20} /><span style={{ marginInlineStart: 2 }}>ورود امن با حساب گوگل</span></>}
        </Button>

        <span class="bodySmall muted center">نسخه فعلی رایگان است و تنظیمات، آپدیت‌ها و اشتراک شما به‌صورت امن همگام‌سازی می‌شود.</span>
      </div>
    </div>
  );
}

function FeatureRow({ icon, tint, title, subtitle }: { icon: string; tint: string; title: string; subtitle: string }) {
  return (
    <div class="row g12">
      <div class="row jcenter" style={{ width: 40, height: 40, borderRadius: '50%', background: `color-mix(in srgb, ${tint} 14%, transparent)`, flex: 'none' }}><Icon path={icon} size={20} color={tint} /></div>
      <div class="col g2">
        <span class="titleSmall bold">{title}</span>
        <span class="bodySmall muted">{subtitle}</span>
      </div>
    </div>
  );
}

function EmailAuthCard({ enabled, onBusy, onError, onInfo }: { enabled: boolean; onBusy: (b: boolean) => void; onError: (m: string | null) => void; onInfo: (m: string | null) => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showReset, setShowReset] = useState(false);

  async function submit() {
    onError(null); onInfo(null);
    if (!EMAIL_RE.test(email)) { onError('ایمیل معتبر وارد کنید.'); return; }
    if (password.length < 6) { onError('رمز عبور باید حداقل ۶ کاراکتر باشد.'); return; }
    if (isRegister && password !== confirm) { onError('تکرار رمز عبور یکسان نیست.'); return; }
    onBusy(true);
    try {
      if (isRegister) {
        const res = await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);
        try { await sendEmailVerification(res.user); } catch { /* runCatching */ }
        onInfo('حساب ساخته شد. لینک تأیید به ایمیل شما ارسال شد.');
      } else {
        await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      }
    } catch (e) { onError(describeAuthError(e)); }
    finally { onBusy(false); }
  }

  return (
    <div class="card bordered col g10 full" style={{ padding: 18 }}>
      {showReset && (
        <PasswordResetDialog initialEmail={email} onDismiss={() => setShowReset(false)}
          onResetDone={async (resetEmail, newPass) => {
            setShowReset(false); setEmail(resetEmail); setPassword(newPass);
            onBusy(true);
            try { await signInWithEmailAndPassword(auth, resetEmail, newPass); onInfo('رمز عبور تغییر کرد و وارد شدید.'); }
            catch { onInfo('رمز عبور تغییر کرد. اکنون با رمز جدید وارد شوید.'); }
            finally { onBusy(false); }
          }} />
      )}
      <span class="titleMedium bold">{isRegister ? 'ساخت حساب با ایمیل' : 'ورود با ایمیل'}</span>
      <form class="col g10" noValidate onSubmit={(e) => { e.preventDefault(); if (enabled) submit(); }}>
        <TextField value={email} onInput={(v) => setEmail(v.trim())} label="ایمیل" type="email" inputMode="email" autoComplete="email" testId="email_field" dir="ltr" />
        <TextField value={password} onInput={setPassword} label="رمز عبور" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} testId="password_field" dir="ltr" />
        {isRegister && <TextField value={confirm} onInput={setConfirm} label="تکرار رمز عبور" type="password" autoComplete="new-password" dir="ltr" />}
        <Button type="submit" icon={mdiEmail} disabled={!enabled} testId="email_auth_button" style={{ width: '100%', height: 50, fontWeight: 700 }}>{isRegister ? 'ثبت‌نام' : 'ورود'}</Button>
      </form>
      <div class="row between">
        <Button kind="text" onClick={() => { setIsRegister(!isRegister); setConfirm(''); onError(null); onInfo(null); }}>{isRegister ? 'حساب دارید؟ ورود' : 'حساب ندارید؟ ثبت‌نام'}</Button>
        {!isRegister && <Button kind="text" onClick={() => { onError(null); onInfo(null); setShowReset(true); }}>فراموشی رمز</Button>}
      </div>
    </div>
  );
}

function PasswordResetDialog({ initialEmail, onDismiss, onResetDone }: { initialEmail: string; onDismiss: () => void; onResetDone: (email: string, pass: string) => void }) {
  const [step, setStep] = useState(0);
  const [resetEmail, setResetEmail] = useState(initialEmail.trim());
  const [link, setLink] = useState('');
  const [p1, setP1] = useState(''); const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function confirmClick() {
    setError(null); setInfo(null);
    if (step === 0) {
      if (!EMAIL_RE.test(resetEmail)) { setError('ایمیل معتبر وارد کنید.'); return; }
      setBusy(true);
      try { await sendPasswordResetEmail(auth, resetEmail.toLowerCase()); setStep(1); }
      catch (e) { setError(describeAuthError(e)); } finally { setBusy(false); }
    } else {
      const code = extractOobCode(link);
      if (!code) { setError('لینک یا کد بازیابی را از ایمیل کپی و اینجا بچسبانید.'); return; }
      if (p1.length < 6) { setError('رمز جدید باید حداقل ۶ کاراکتر باشد.'); return; }
      if (p1 !== p2) { setError('تکرار رمز یکسان نیست.'); return; }
      setBusy(true);
      try {
        const accountEmail = await verifyPasswordResetCode(auth, code);
        await confirmPasswordReset(auth, code, p1);
        onResetDone(accountEmail || resetEmail, p1);
      } catch (e) { setError(describeAuthError(e)); } finally { setBusy(false); }
    }
  }

  return (
    <Dialog onDismiss={() => { if (!busy) onDismiss(); }} title={step === 0 ? 'بازیابی رمز عبور' : 'تعیین رمز جدید'} titleStart
      dismiss={<Button kind="text" disabled={busy} onClick={onDismiss}>بستن</Button>}
      confirm={<Button disabled={busy} onClick={confirmClick}>{step === 0 ? 'ارسال لینک بازیابی' : 'ثبت رمز جدید'}</Button>}>
      <div class="col g10">
        {step === 0 ? (
          <>
            <span class="bodySmall">ایمیل حساب را وارد کنید تا لینک بازیابی برایتان ارسال شود.</span>
            <TextField value={resetEmail} onInput={(v) => setResetEmail(v.trim())} label="ایمیل" type="email" inputMode="email" dir="ltr" />
          </>
        ) : (
          <>
            <span class="bodySmall">ایمیل بازیابی ارسال شد (پوشه اسپم را هم ببینید). روی لینک داخل ایمیل نزنید؛ انگشت را روی لینک نگه دارید، «کپی لینک» را بزنید و اینجا بچسبانید. سپس رمز جدید را وارد کنید.</span>
            <TextField value={link} onInput={setLink} label="لینک یا کد بازیابی از ایمیل" multiline maxRows={3} dir="ltr"
              trailing={<Button kind="text" onClick={async () => { const t = await readClipboard(); if (t) setLink(t); }}>چسباندن</Button>} />
            <TextField value={p1} onInput={setP1} label="رمز جدید (حداقل ۶ کاراکتر)" type="password" autoComplete="new-password" dir="ltr" />
            <TextField value={p2} onInput={setP2} label="تکرار رمز جدید" type="password" autoComplete="new-password" dir="ltr" />
            <Button kind="text" disabled={busy} style={{ alignSelf: 'flex-start' }} onClick={async () => {
              setError(null); setBusy(true);
              try { await sendPasswordResetEmail(auth, resetEmail.toLowerCase()); setInfo('ایمیل بازیابی دوباره ارسال شد.'); }
              catch (e) { setError(describeAuthError(e)); } finally { setBusy(false); }
            }}>ارسال دوباره ایمیل</Button>
          </>
        )}
        {info && <span class="bodySmall" style={{ color: 'var(--primary)' }}>{info}</span>}
        {error && <span class="bodySmall" style={{ color: 'var(--error)' }}>{error}</span>}
        {busy && <ProgressLinear />}
      </div>
    </Dialog>
  );
}
