// Port of data/remote/CloudAdminRepository.kt + PaymentRepository.kt + FlowRetry.kt
import {
  collection, doc, onSnapshot, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit,
  serverTimestamp, deleteField, Timestamp, runTransaction, type DocumentSnapshot, type Query, type DocumentReference,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, auth } from './firebase';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../firebase-config';
import {
  defaultAppGlobalConfig, defaultPaymentConfig, PaymentPlanInfo, planFromRaw,
  type AppGlobalConfig, type AnnouncementModule, type UserProfile, type AnnouncementCategory,
  type SubscriptionTier, type PaymentConfig, type PaymentRequest, type BankCardInfo, type CryptoWalletInfo,
  type PaymentPlan, type PaymentMethod,
} from './models';

const CONFIG_DOC_ID = 'global';
export const ADMIN_HISTORY_LIMIT = 50;

export function isAdminUser(user: User | null | undefined): boolean {
  return (user?.email ?? '').trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
}

function logFirestoreError(e: unknown, op: string, path: string) {
  const u = auth.currentUser;
  console.error('FirestoreError', JSON.stringify({
    error: (e as Error)?.message ?? String(e), operationType: op, path,
    authInfo: { userId: u?.uid, email: u?.email, emailVerified: u?.emailVerified, providerInfo: u?.providerData.map((p) => ({ providerId: p.providerId, email: p.email })) },
  }));
}

/** Snapshot listener that retries with exponential backoff (2s..60s) like retryFirestoreListener. */
function listen<T>(
  target: Query | DocumentReference, map: (snap: any) => T, onValue: (v: T) => void, op: string, path: string,
  fallback?: () => T,
): () => void {
  const uid = auth.currentUser?.uid;
  let attempt = 0; let unsub: (() => void) | null = null; let timer: any = null; let stopped = false;
  const start = () => {
    if (stopped) return;
    const onErr = (e: unknown) => {
      unsub?.(); unsub = null;
      if (uid && auth.currentUser?.uid !== uid) return;
      if (attempt === 0 || attempt % 10 === 0) logFirestoreError(e, op, path);
      if (attempt === 0 && fallback) onValue(fallback());
      const backoff = Math.min(2000 * 2 ** Math.min(attempt, 5), 60000);
      attempt++;
      timer = setTimeout(start, backoff);
    };
    unsub = onSnapshot(target as any, (snap: any) => { attempt = 0; onValue(map(snap)); }, onErr);
  };
  start();
  return () => { stopped = true; unsub?.(); clearTimeout(timer); };
}

const est = { serverTimestamps: 'estimate' as const };
function docData<T>(snap: DocumentSnapshot, defaults: T): T {
  return { ...defaults, ...(snap.data(est) as any), id: snap.id };
}
const secs = (t: Timestamp | null | undefined) => (t ? t.seconds : null);

const emptyAnnouncement = (): AnnouncementModule => ({ id: '', title: '', summary: '', category: 'FEATURE', actionLabel: '', actionValue: '', published: true, createdBy: '', createdAt: null, updatedAt: null });
const emptyProfile = (): UserProfile => ({ id: '', userId: '', email: '', displayName: '', photoUrl: '', sim1Label: 'SIM 1 • خط کاری', sim2Label: 'SIM 2 • خط شخصی', hasActiveSubscription: false, subscriptionTier: 'FREE', subscriptionExpiresAt: null, createdAt: null, updatedAt: null });
const emptyRequest = (): PaymentRequest => ({ id: '', userId: '', userEmail: '', userName: '', plan: 'MONTHLY', amountToman: 0, method: 'CARD', destination: '', trackingCode: '', receiptImage: '', status: 'PENDING', adminNote: '', reviewedBy: '', createdAt: null, reviewedAt: null });
const toNum = (v: unknown, d: number) => (typeof v === 'number' ? v : Number(v ?? d) || d);

function normalizeConfig(c: AppGlobalConfig): AppGlobalConfig {
  return { ...c, freeTrialDays: toNum(c.freeTrialDays, 7), latestVersionCode: toNum(c.latestVersionCode, 1) };
}

function requireUserId(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('کاربر باید ابتدا وارد حساب گوگل شود.');
  return uid;
}

export const cloudRepository = {
  observeGlobalConfig(cb: (c: AppGlobalConfig) => void) {
    const ref = doc(db, 'app_config', CONFIG_DOC_ID);
    return listen(ref, (s: DocumentSnapshot) => (s.exists() ? normalizeConfig(docData(s, defaultAppGlobalConfig())) : defaultAppGlobalConfig()), cb, 'get', ref.path, defaultAppGlobalConfig);
  },
  observePublishedAnnouncements(cb: (l: AnnouncementModule[]) => void) {
    return listen(query(collection(db, 'announcements'), where('published', '==', true)),
      (s: any) => s.docs.map((d: DocumentSnapshot) => docData(d, emptyAnnouncement())).sort((a: AnnouncementModule, b: AnnouncementModule) => (secs(b.createdAt) ?? 0) - (secs(a.createdAt) ?? 0)),
      cb, 'list', 'announcements', () => []);
  },
  observeAllAnnouncementsForAdmin(cb: (l: AnnouncementModule[]) => void) {
    return listen(collection(db, 'announcements'),
      (s: any) => s.docs.map((d: DocumentSnapshot) => docData(d, emptyAnnouncement())).sort((a: AnnouncementModule, b: AnnouncementModule) => (secs(b.createdAt) ?? 0) - (secs(a.createdAt) ?? 0)),
      cb, 'list', 'announcements', () => []);
  },
  observeCurrentUserProfile(userId: string, cb: (p: UserProfile | null) => void) {
    const ref = doc(db, 'users', userId);
    return listen(ref, (s: DocumentSnapshot) => (s.exists() ? docData(s, emptyProfile()) : null), cb, 'get', ref.path, () => null);
  },
  observeAllUsersForAdmin(cb: (l: UserProfile[]) => void) {
    return listen(collection(db, 'users'),
      (s: any) => s.docs.map((d: DocumentSnapshot) => docData(d, emptyProfile())).sort((a: UserProfile, b: UserProfile) => (secs(b.updatedAt) ?? 0) - (secs(a.updatedAt) ?? 0)),
      cb, 'list', 'users', () => []);
  },

  async ensureUserProfile(user: User): Promise<void> {
    const docPath = `users/${user.uid}`;
    try {
      const uid = requireUserId();
      if (uid !== user.uid) throw new Error('کاربر تغییر کرده است.');
      const ref = doc(db, 'users', uid);
      const snap = await getDoc(ref);
      const safeName = ((user.displayName?.trim() ? user.displayName : null) ?? user.email?.split('@')[0] ?? 'کاربر eSkyTell').slice(0, 100);
      const safeEmail = (user.email ?? '').slice(0, 200);
      const safePhoto = (user.photoURL ?? '').slice(0, 500);
      if (!snap.exists()) {
        const payload: Record<string, unknown> = {
          userId: uid, email: safeEmail, displayName: safeName, sim1Label: 'SIM 1 • خط کاری', sim2Label: 'SIM 2 • خط شخصی',
          hasActiveSubscription: false, subscriptionTier: 'FREE', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        };
        if (safePhoto.trim()) payload.photoUrl = safePhoto;
        await setDoc(ref, payload);
      } else {
        const upd: Record<string, unknown> = { displayName: safeName, email: safeEmail, updatedAt: serverTimestamp() };
        if (safePhoto.trim()) upd.photoUrl = safePhoto;
        await updateDoc(ref, upd);
      }
      if (isAdminUser(user)) {
        const cfgSnap = await getDoc(doc(db, 'app_config', CONFIG_DOC_ID));
        if (!cfgSnap.exists()) await cloudRepository.saveGlobalConfig(defaultAppGlobalConfig());
      }
    } catch (e) { logFirestoreError(e, 'write', docPath); }
  },

  async updateSimLabels(sim1: string, sim2: string) {
    const uid = requireUserId();
    await updateDoc(doc(db, 'users', uid), {
      sim1Label: (sim1.trim() || 'SIM 1').slice(0, 40), sim2Label: (sim2.trim() || 'SIM 2').slice(0, 40), updatedAt: serverTimestamp(),
    });
  },

  async saveGlobalConfig(c: AppGlobalConfig) {
    const uid = requireUserId();
    const ref = doc(db, 'app_config', CONFIG_DOC_ID);
    const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.trunc(n)));
    const payload = {
      subscriptionRequired: c.subscriptionRequired,
      monthlyPriceLabel: c.monthlyPriceLabel.trim().slice(0, 80),
      yearlyPriceLabel: c.yearlyPriceLabel.trim().slice(0, 80),
      freeTrialDays: clamp(c.freeTrialDays, 0, 365),
      paywallMessage: c.paywallMessage.trim().slice(0, 400),
      paymentUrl: c.paymentUrl.trim().slice(0, 500),
      latestVersionName: (c.latestVersionName.trim() || '1.0.0').slice(0, 32),
      latestVersionCode: clamp(c.latestVersionCode, 1, 100000),
      updateNotes: c.updateNotes.trim().slice(0, 1000),
      updateUrl: c.updateUrl.trim().slice(0, 500),
      forceUpdate: c.forceUpdate,
      enableDualSim: c.enableDualSim,
      enableQuickTemplates: c.enableQuickTemplates,
      enableQuietHours: c.enableQuietHours,
      enableBleGattBridge: c.enableBleGattBridge,
      updatedBy: uid.slice(0, 128),
      updatedAt: serverTimestamp(),
    };
    const existing = await getDoc(ref);
    if (existing.exists()) await updateDoc(ref, payload); else await setDoc(ref, payload);
  },

  async saveAnnouncement(existingId: string | null, title: string, summary: string, category: AnnouncementCategory, actionLabel: string, actionValue: string, published: boolean) {
    const t = title.trim().slice(0, 120); const s = summary.trim().slice(0, 600);
    if (!t || !s) throw new Error('عنوان و توضیحات نمی‌توانند خالی باشند.');
    const uid = requireUserId();
    const col = collection(db, 'announcements');
    if (!existingId) {
      const ref = doc(col);
      const payload: Record<string, unknown> = { title: t, summary: s, category, published, createdBy: uid.slice(0, 128), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      if (actionLabel.trim()) payload.actionLabel = actionLabel.trim().slice(0, 40);
      if (actionValue.trim()) payload.actionValue = actionValue.trim().slice(0, 500);
      await setDoc(ref, payload);
    } else {
      await updateDoc(doc(col, existingId), { title: t, summary: s, category, actionLabel: actionLabel.trim().slice(0, 40), actionValue: actionValue.trim().slice(0, 500), published, updatedAt: serverTimestamp() });
    }
  },
  async toggleAnnouncementPublished(id: string, published: boolean) {
    requireUserId();
    await updateDoc(doc(db, 'announcements', id), { published, updatedAt: serverTimestamp() });
  },
  async deleteAnnouncement(id: string) { requireUserId(); await deleteDoc(doc(db, 'announcements', id)); },

  async setUserSubscription(targetUserId: string, hasActive: boolean, tier: SubscriptionTier) {
    requireUserId();
    const upd: Record<string, unknown> = { hasActiveSubscription: hasActive, subscriptionTier: tier, updatedAt: serverTimestamp() };
    if (tier === 'LIFETIME' || tier === 'FREE' || !hasActive) upd.subscriptionExpiresAt = deleteField();
    else upd.subscriptionExpiresAt = Timestamp.fromMillis(Date.now() + (tier === 'YEARLY' ? 365 : 30) * 86_400_000);
    await updateDoc(doc(db, 'users', targetUserId), upd);
  },
};

// ---------------- Payments ----------------
const configRef = () => doc(db, 'payment_config', 'main');
const requestsCol = () => collection(db, 'payment_requests');
const sortReq = (l: PaymentRequest[]) => l.sort((a, b) => (secs(b.createdAt) ?? Number.MAX_SAFE_INTEGER) - (secs(a.createdAt) ?? Number.MAX_SAFE_INTEGER));

export const paymentRepository = {
  observeConfig(cb: (c: PaymentConfig | null) => void) {
    cb(null);
    return listen(configRef(), (s: DocumentSnapshot) => {
      if (!s.exists()) return null;
      const c = docData(s, defaultPaymentConfig());
      return { ...c, monthlyPriceToman: toNum(c.monthlyPriceToman, 0), yearlyPriceToman: toNum(c.yearlyPriceToman, 0), cards: c.cards ?? [], wallets: c.wallets ?? [] };
    }, cb, 'get', 'payment_config/main');
  },
  observeMyRequests(userId: string, cb: (l: PaymentRequest[]) => void) {
    cb([]);
    return listen(query(requestsCol(), where('userId', '==', userId)),
      (s: any) => sortReq(s.docs.map((d: DocumentSnapshot) => docData(d, emptyRequest()))), cb, 'list', 'payment_requests');
  },
  observeAllRequestsForAdmin(cb: (l: PaymentRequest[]) => void) {
    let pending: PaymentRequest[] = []; let recent: PaymentRequest[] = [];
    const emit = () => {
      const m = new Map<string, PaymentRequest>();
      [...pending, ...recent].forEach((r) => { if (!m.has(r.id)) m.set(r.id, r); });
      cb(sortReq([...m.values()]));
    };
    cb([]);
    const u1 = listen(query(requestsCol(), orderBy('createdAt', 'desc'), limit(ADMIN_HISTORY_LIMIT)),
      (s: any) => s.docs.map((d: DocumentSnapshot) => docData(d, emptyRequest())), (l) => { recent = l; emit(); }, 'list', 'payment_requests');
    const u2 = listen(query(requestsCol(), where('status', '==', 'PENDING')),
      (s: any) => s.docs.map((d: DocumentSnapshot) => docData(d, emptyRequest())), (l) => { pending = l; emit(); }, 'list', 'payment_requests');
    return () => { u1(); u2(); };
  },

  async saveConfig(monthly: number, yearly: number, instructions: string, cards: BankCardInfo[], wallets: CryptoWalletInfo[]) {
    const clampT = (n: number) => Math.min(10_000_000_000, Math.max(0, Math.trunc(n)));
    await setDoc(configRef(), {
      monthlyPriceToman: clampT(monthly),
      yearlyPriceToman: clampT(yearly),
      instructions: instructions.trim().slice(0, 800),
      cards: cards.slice(0, 20).map((c) => ({ id: c.id.slice(0, 40), bankName: c.bankName.trim().slice(0, 60), cardNumber: c.cardNumber.replace(/\D/g, '').slice(0, 19), holderName: c.holderName.trim().slice(0, 80), sheba: c.sheba.trim().toUpperCase().slice(0, 34), active: c.active })),
      wallets: wallets.slice(0, 20).map((w) => ({ id: w.id.slice(0, 40), coin: w.coin.trim().slice(0, 30), network: w.network.trim().slice(0, 30), address: w.address.trim().slice(0, 200), note: w.note.trim().slice(0, 200), active: w.active })),
      updatedAt: serverTimestamp(),
    });
  },

  async submitRequest(plan: PaymentPlan, amountToman: number, method: PaymentMethod, destination: string, trackingCode: string, receiptImageBase64: string) {
    const user = auth.currentUser;
    if (!user) throw new Error('ابتدا وارد حساب شوید.');
    const code = trackingCode.trim().slice(0, 100);
    if (!code && !receiptImageBase64) throw new Error('کد پیگیری یا تصویر فیش را وارد کنید.');
    if (receiptImageBase64.length > 900_000) throw new Error('حجم تصویر زیاد است.');
    const ref = doc(requestsCol());
    await setDoc(ref, {
      userId: user.uid,
      userEmail: (user.email ?? '').slice(0, 200),
      userName: ((user.displayName?.trim() ? user.displayName : null) ?? user.email?.split('@')[0] ?? 'کاربر').slice(0, 100),
      plan, amountToman: Math.trunc(amountToman), method,
      destination: destination.slice(0, 250), trackingCode: code, receiptImage: receiptImageBase64,
      status: 'PENDING', createdAt: serverTimestamp(),
    });
  },

  async approveRequest(request: PaymentRequest, note: string) {
    const adminUid = auth.currentUser?.uid;
    if (!adminUid) throw new Error('ورود لازم است.');
    const reqRef = doc(db, 'payment_requests', request.id);
    const userRef = doc(db, 'users', request.userId);
    await runTransaction(db, async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (reqSnap.get('status') !== 'PENDING') throw new Error('این درخواست قبلاً بررسی شده است.');
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('پروفایل کاربر یافت نشد.');
      const isLifetime = userSnap.get('subscriptionTier') === 'LIFETIME';
      const plan = planFromRaw(reqSnap.get('plan') ?? request.plan);
      const now = Date.now();
      const isActive = userSnap.get('hasActiveSubscription') === true;
      const exp = (userSnap.get('subscriptionExpiresAt') as Timestamp | undefined)?.toMillis();
      const base = isActive && exp != null && exp > now ? exp : now;
      const newExpiry = base + PaymentPlanInfo[plan].days * 86_400_000;
      tx.update(reqRef, { status: 'APPROVED', adminNote: note.trim().slice(0, 300), reviewedBy: adminUid, reviewedAt: serverTimestamp() });
      if (!isLifetime) {
        tx.update(userRef, { hasActiveSubscription: true, subscriptionTier: PaymentPlanInfo[plan].tier, subscriptionExpiresAt: Timestamp.fromMillis(newExpiry), updatedAt: serverTimestamp() });
      }
    });
  },
  async rejectRequest(request: PaymentRequest, note: string) {
    const adminUid = auth.currentUser?.uid;
    if (!adminUid) throw new Error('ورود لازم است.');
    await updateDoc(doc(db, 'payment_requests', request.id), { status: 'REJECTED', adminNote: note.trim().slice(0, 300), reviewedBy: adminUid, reviewedAt: serverTimestamp() });
  },
  async deleteRequest(id: string) { await deleteDoc(doc(db, 'payment_requests', id)); },
};
