// Port of ui/MainViewModel.kt (MainUiState + PaymentUiState and every action).
import { useEffect, useState } from 'preact/hooks';
import type { User } from 'firebase/auth';
import { dao } from './localDb';
import { transferRepository as repo } from './transferRepository';
import { cloudRepository as cloud, paymentRepository as pay } from './cloudRepository';
import {
  defaultAppGlobalConfig, defaultPaymentConfig, priceFor, statusFromRaw,
  type AppGlobalConfig, type UserProfile, type AnnouncementModule, type PaymentConfig, type PaymentRequest,
  type SmsRecordEntity, type CallRecordEntity, type ContactEntity, type TransferHistoryEntity, type SmsThreadSummary,
  type DiscoveredBluetoothDevice, type ActiveBridgeCall, type IncomingBridgeEvent, type TransferMode, type ExportFormat,
  type TransferSessionState, type RelayDeviceRole, type RelayConnectionState, type PermissionSummary,
  type CallDirection, type SmsDirection, type AnnouncementCategory, type SubscriptionTier, type PaymentPlan, type PaymentMethod,
  type BankCardInfo, type CryptoWalletInfo, RelayDeviceRoleInfo, DevicePlatformLabel, ExportFormatInfo,
} from './models';
import { generatePairingPin } from './crypto';

export interface PaymentUiState {
  config: PaymentConfig;
  configLoaded: boolean;
  myRequests: PaymentRequest[];
  adminRequests: PaymentRequest[];
  isSubmitting: boolean;
  submitSuccessTick: number;
}

export interface MainUiState {
  currentUserId: string;
  currentUserEmail: string;
  isAdmin: boolean;
  isDarkTheme: boolean;
  isBluetoothSupported: boolean;
  isBluetoothEnabled: boolean;
  hasBluetoothPermissions: boolean;
  permissionSummary: PermissionSummary;
  isScanning: boolean;
  pairedDevices: DiscoveredBluetoothDevice[];
  nearbyDevices: DiscoveredBluetoothDevice[];
  selectedBridgeSourceAddress: string | null;
  activeSimSlot: number;
  dialerNumber: string;
  activeCall: ActiveBridgeCall | null;
  isQuietHoursEnabled: boolean;
  pairingPin: string;
  encryptionEnabled: boolean;
  transferState: TransferSessionState;
  transferMode: TransferMode;
  exportFormat: ExportFormat;
  smsRecords: SmsRecordEntity[];
  callRecords: CallRecordEntity[];
  contacts: ContactEntity[];
  transferHistory: TransferHistoryEntity[];
  selectedSmsThreadPhone: string | null;
  latestIncomingBridgeEvent: IncomingBridgeEvent | null;
  appConfig: AppGlobalConfig;
  userProfile: UserProfile | null;
  publishedAnnouncements: AnnouncementModule[];
  adminAnnouncements: AnnouncementModule[];
  adminUsers: UserProfile[];
  isCloudSaving: boolean;
  showPaywallSheet: boolean;
  relayDeviceRole: RelayDeviceRole;
  relayConnectionState: RelayConnectionState;
  snackbarMessage: string | null;
  payment: PaymentUiState;
}

// ---- derived getters (MainUiState computed properties) ----
export const allKnownDevices = (s: MainUiState) => {
  const m = new Map<string, DiscoveredBluetoothDevice>();
  [...s.pairedDevices, ...s.nearbyDevices].forEach((d) => { if (!m.has(d.address)) m.set(d.address, d); });
  return [...m.values()];
};
export const activeBridgeDevice = (s: MainUiState): DiscoveredBluetoothDevice | null => {
  const all = allKnownDevices(s);
  return all.find((d) => d.address === s.selectedBridgeSourceAddress) ?? all.find((d) => d.isConnected)
    ?? s.pairedDevices.find((d) => d.platform === 'IPHONE') ?? s.pairedDevices[0] ?? null;
};
export const sim1DisplayLabel = (s: MainUiState) => s.userProfile?.sim1Label?.trim() ? s.userProfile.sim1Label : 'SIM 1 • خط کاری';
export const sim2DisplayLabel = (s: MainUiState) => s.userProfile?.sim2Label?.trim() ? s.userProfile.sim2Label : 'SIM 2 • خط شخصی';
export const activeSimLabel = (s: MainUiState) => (s.activeSimSlot === 2 ? sim2DisplayLabel(s) : sim1DisplayLabel(s));
export const isSubscriptionActive = (s: MainUiState) => {
  const p = s.userProfile;
  if (!p || !p.hasActiveSubscription) return false;
  const exp = p.subscriptionExpiresAt;
  if (!exp) return true;
  return exp.toMillis() > Date.now();
};
export const hasProBridgeAccess = (s: MainUiState) => !s.appConfig.subscriptionRequired || s.isAdmin || isSubscriptionActive(s);

export function normalizePhoneKey(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length > 9 ? digits.slice(-9) : digits;
}
export const smsThreads = (s: MainUiState): SmsThreadSummary[] => {
  const names = new Map<string, string>();
  s.contacts.forEach((c) => names.set(normalizePhoneKey(c.phoneNumber), c.displayName));
  const groups = new Map<string, SmsRecordEntity[]>();
  s.smsRecords.forEach((r) => { const g = groups.get(r.phoneNumber) ?? []; g.push(r); groups.set(r.phoneNumber, g); });
  return [...groups.entries()].map(([phone, items]) => {
    const sorted = [...items].sort((a, b) => b.timestampMillis - a.timestampMillis);
    const latest = sorted[0];
    return {
      phoneNumber: phone,
      displayName: names.get(normalizePhoneKey(phone)) ?? (latest.senderName.trim() ? latest.senderName : phone),
      lastMessage: latest.body, lastTimestampMillis: latest.timestampMillis,
      unreadCount: items.filter((i) => !i.isRead).length, messageCount: items.length, simSlot: latest.simSlot,
    };
  }).sort((a, b) => b.lastTimestampMillis - a.lastTimestampMillis);
};
export const unreadSmsTotal = (s: MainUiState) => smsThreads(s).reduce((a, t) => a + t.unreadCount, 0);
export const selectedThreadMessages = (s: MainUiState) =>
  s.selectedSmsThreadPhone ? s.smsRecords.filter((r) => r.phoneNumber === s.selectedSmsThreadPhone).sort((a, b) => a.timestampMillis - b.timestampMillis) : [];

// ---- store ----
const THEME_KEY = 'eskytell.dark';
// Web: no Web Bluetooth on iOS Safari; on other browsers the classic RFCOMM/OPP stacks are not exposed either.
const webBluetoothAvailable = typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;

function initialState(uid = '', email = '', isAdmin = false): MainUiState {
  return {
    currentUserId: uid, currentUserEmail: email, isAdmin,
    isDarkTheme: localStorage.getItem(THEME_KEY) !== 'false',
    isBluetoothSupported: webBluetoothAvailable, isBluetoothEnabled: false, hasBluetoothPermissions: false,
    permissionSummary: { bluetoothGranted: false, contactsGranted: !!(navigator as any).contacts?.select, notificationsGranted: typeof Notification !== 'undefined' && Notification.permission === 'granted' },
    isScanning: false, pairedDevices: [], nearbyDevices: [], selectedBridgeSourceAddress: null,
    activeSimSlot: 1, dialerNumber: '', activeCall: null, isQuietHoursEnabled: false,
    pairingPin: generatePairingPin(), encryptionEnabled: true, transferState: { kind: 'Idle' },
    transferMode: 'BLE_GATT_BRIDGE', exportFormat: 'HTML_REPORT',
    smsRecords: dao.smsRecords(), callRecords: dao.callRecords(), contacts: dao.contacts(), transferHistory: dao.transferHistory(),
    selectedSmsThreadPhone: null, latestIncomingBridgeEvent: null,
    appConfig: defaultAppGlobalConfig(), userProfile: null, publishedAnnouncements: [], adminAnnouncements: [], adminUsers: [],
    isCloudSaving: false, showPaywallSheet: false, relayDeviceRole: 'PRIMARY', relayConnectionState: { kind: 'Disconnected' },
    snackbarMessage: null,
    payment: { config: defaultPaymentConfig(), configLoaded: false, myRequests: [], adminRequests: [], isSubmitting: false, submitSuccessTick: 0 },
  };
}

let state: MainUiState = initialState();
const listeners = new Set<() => void>();
let unsubs: Array<() => void> = [];

export function getState() { return state; }
export function setState(patch: Partial<MainUiState> | ((s: MainUiState) => Partial<MainUiState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
const setPay = (p: Partial<PaymentUiState>) => setState((s) => ({ payment: { ...s.payment, ...p } }));
export function useStore(): MainUiState {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((x) => x + 1); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return state;
}
const snack = (m: string) => setState({ snackbarMessage: m });

dao.subscribe(() => setState({ smsRecords: dao.smsRecords(), callRecords: dao.callRecords(), contacts: dao.contacts(), transferHistory: dao.transferHistory() }));

/** Called on sign-in (per-user scope, like UserScopedStores + MainViewModel.factory). */
export function startSession(user: User, isAdmin: boolean) {
  stopSession();
  state = initialState(user.uid, user.email ?? '', isAdmin);
  listeners.forEach((l) => l());
  cloud.ensureUserProfile(user);
  unsubs.push(cloud.observeGlobalConfig((c) => setState({ appConfig: c })));
  unsubs.push(cloud.observePublishedAnnouncements((l) => setState({ publishedAnnouncements: l })));
  unsubs.push(cloud.observeCurrentUserProfile(user.uid, (p) => setState({ userProfile: p })));
  if (isAdmin) {
    unsubs.push(cloud.observeAllAnnouncementsForAdmin((l) => setState({ adminAnnouncements: l })));
    unsubs.push(cloud.observeAllUsersForAdmin((l) => setState({ adminUsers: l })));
    unsubs.push(pay.observeAllRequestsForAdmin((l) => { setPay({ adminRequests: l }); notifyAdminPending(l); }));
  }
  unsubs.push(pay.observeConfig((c) => setPay({ config: c ?? defaultPaymentConfig(), configLoaded: c != null })));
  unsubs.push(pay.observeMyRequests(user.uid, (l) => setPay({ myRequests: l })));
}
export function stopSession() { unsubs.forEach((u) => u()); unsubs = []; }

// Web stand-in for PaymentNotifications: a browser notification for new pending receipts (admin only).
const seenPending = new Set<string>();
let firstPendingLoad = true;
function notifyAdminPending(list: PaymentRequest[]) {
  const pending = list.filter((r) => statusFromRaw(r.status) === 'PENDING');
  const fresh = pending.filter((r) => !seenPending.has(r.id));
  pending.forEach((r) => seenPending.add(r.id));
  if (firstPendingLoad) { firstPendingLoad = false; return; }
  if (fresh.length && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    fresh.forEach((r) => { try { new Notification('فیش پرداخت جدید', { body: `${r.userName} • ${r.plan}`, tag: `pay-${r.id}` }); } catch { /* iOS */ } });
  }
}

function requireProBridgeAccess(): boolean {
  if (hasProBridgeAccess(state)) return true;
  setState({ showPaywallSheet: true });
  return false;
}
function findContactName(phone: string) {
  const key = normalizePhoneKey(phone);
  return key ? state.contacts.find((c) => normalizePhoneKey(c.phoneNumber) === key)?.displayName : undefined;
}
function openUrl(url: string) { window.location.href = url; }

export function downloadBlob(blob: Blob, fileName: string) {
  const file = new File([blob], fileName, { type: blob.type });
  const nav = navigator as any;
  if (nav.canShare?.({ files: [file] })) { nav.share({ files: [file], title: fileName }).catch(() => {}); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export const actions = {
  consumeSnackbar: () => setState({ snackbarMessage: null }),
  toggleTheme: () => { const v = !state.isDarkTheme; localStorage.setItem(THEME_KEY, String(v)); setState({ isDarkTheme: v }); },
  selectSimSlot: (i: number) => setState({ activeSimSlot: Math.min(2, Math.max(1, i)) }),
  toggleQuietHours: (enabled: boolean) => setState({ isQuietHoursEnabled: enabled, snackbarMessage: enabled ? 'حالت سکوت پل (Quiet Hours) فعال شد.' : 'حالت سکوت پل غیرفعال شد.' }),
  regeneratePairingPin: () => setState({ pairingPin: generatePairingPin(), snackbarMessage: 'کد امنیتی رمزنگاری بلوتوث به‌روزرسانی شد.' }),
  setEncryptionEnabled: (e: boolean) => setState({ encryptionEnabled: e }),
  openPaywallSheet: () => setState({ showPaywallSheet: true }),
  dismissPaywallSheet: () => setState({ showPaywallSheet: false }),

  appendDialerDigit: (d: string) => { if (state.dialerNumber.length < 24) setState({ dialerNumber: state.dialerNumber + d }); },
  backspaceDialer: () => setState({ dialerNumber: state.dialerNumber.slice(0, -1) }),
  clearDialer: () => setState({ dialerNumber: '' }),
  placeSystemDialerCall(phone: string) {
    const clean = phone.trim();
    if (!clean) { snack('ابتدا شماره تلفن را وارد کنید.'); return; }
    openUrl(`tel:${encodeURIComponent(clean)}`);
  },
  startBridgeCall(phone: string, contactName = '') {
    const clean = phone.trim();
    if (!clean) { snack('شماره تماس را وارد کنید.'); return; }
    if (!requireProBridgeAccess()) return;
    const resolved = contactName.trim() ? contactName : findContactName(clean) ?? clean;
    const target = activeBridgeDevice(state);
    setState({ activeCall: { contactName: resolved, phoneNumber: clean, simSlot: state.activeSimSlot, targetDeviceName: target?.name ?? 'شماره‌گیر گوشی / پل eSkyTell', startedAtMillis: Date.now(), isMuted: false, isSpeaker: false, isBluetoothAudio: true } });
    repo.addManualCall(resolved, clean, 0, 'OUTGOING', state.activeSimSlot, activeSimLabel(state));
  },
  toggleActiveCallMute: () => state.activeCall && setState({ activeCall: { ...state.activeCall, isMuted: !state.activeCall.isMuted } }),
  toggleActiveCallSpeaker: () => state.activeCall && setState({ activeCall: { ...state.activeCall, isSpeaker: !state.activeCall.isSpeaker } }),
  toggleActiveCallBluetoothAudio: () => state.activeCall && setState({ activeCall: { ...state.activeCall, isBluetoothAudio: !state.activeCall.isBluetoothAudio } }),
  endActiveBridgeCall: () => setState({ activeCall: null }),

  openSmsThread: (phone: string) => { setState({ selectedSmsThreadPhone: phone }); repo.markThreadRead(phone); },
  closeSmsThread: () => setState({ selectedSmsThreadPhone: null }),
  deleteSmsThread(phone: string) {
    repo.deleteSmsThread(phone);
    setState((s) => ({ selectedSmsThreadPhone: s.selectedSmsThreadPhone === phone ? null : s.selectedSmsThreadPhone, snackbarMessage: 'گفتگو حذف شد.' }));
  },
  sendBridgeSms(phone: string, contactName: string, body: string, alsoOpenSystemSmsIfNoDevice = true) {
    const p = phone.trim(); const b = body.trim();
    if (!p || !b) { snack('شماره و متن پیامک را وارد کنید.'); return; }
    if (!requireProBridgeAccess()) return;
    const resolved = contactName.trim() ? contactName : findContactName(p) ?? p;
    repo.addManualSms(resolved, p, b, 'OUTGOING', state.activeSimSlot, activeSimLabel(state));
    const target = activeBridgeDevice(state);
    if (!target && state.relayConnectionState.kind !== 'Connected' && alsoOpenSystemSmsIfNoDevice) actions.openSystemSmsComposer(p, b);
  },
  openSystemSmsComposer(phone: string, body = '') {
    const clean = phone.trim();
    if (!clean) { snack('شماره گیرنده را وارد کنید.'); return; }
    // iOS uses `sms:NUMBER&body=` ; Android `sms:NUMBER?body=`
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    openUrl(`sms:${encodeURIComponent(clean)}${body.trim() ? `${isIOS ? '&' : '?'}body=${encodeURIComponent(body)}` : ''}`);
  },

  addManualSms(sender: string, phone: string, body: string, direction: SmsDirection) {
    repo.addManualSms(sender, phone, body, direction, state.activeSimSlot, activeSimLabel(state));
    snack('پیامک در صندوق ثبت شد.');
  },
  addManualCall(contact: string, phone: string, duration: number, direction: CallDirection) {
    repo.addManualCall(contact, phone, duration, direction, state.activeSimSlot, activeSimLabel(state));
    snack('سابقه تماس ثبت شد.');
  },
  saveContact(name: string, phone: string, email = '', notes = '', fav = false, existingId: number | null = null) {
    repo.upsertContact(name, phone, email, notes, fav, existingId);
    snack(`مخاطب «${name.trim() ? name : phone}» ذخیره شد.`);
  },
  toggleContactFavorite: (id: number, fav: boolean) => repo.setContactFavorite(id, fav),
  deleteContact: (id: number) => repo.deleteContact(id),
  async importContactsFromPhone() {
    try {
      const added = await repo.importDeviceContacts();
      if (added < 0) { snack('مرورگر این دستگاه دسترسی به دفترچه مخاطبین را پشتیبانی نمی‌کند. از فایل vCard استفاده کنید.'); return; }
      snack(added > 0 ? `${added} مخاطب جدید از دفترچه گوشی همگام‌سازی شد.` : 'همه مخاطبین گوشی از قبل در eSkyTell موجود هستند.');
    } catch { snack('ابتدا مجوز دسترسی به مخاطبین گوشی را تأیید کنید.'); }
  },
  exportContactToPhone(c: ContactEntity) {
    const f = repo.createContactsVCardFile([c]);
    repo.markContactSynced(c.id);
    downloadBlob(f.blob, f.fileName);
  },
  shareContactsViaBluetooth(list: ContactEntity[]) {
    if (!list.length) { snack('مخاطبی برای اشتراک وجود ندارد.'); return; }
    const f = repo.createContactsVCardFile(list);
    repo.recordTransferHistory({ targetDeviceName: 'آیفون / دستگاه بلوتوثی', targetAddress: 'VCARD-OPP', targetPlatform: DevicePlatformLabel.IPHONE, channelMethod: 'ارسال کارت مخاطب (vCard)', exportFormat: 'VCF', smsCount: 0, callCount: list.length, bytesTransferred: f.byteSize, status: 'آماده ارسال' });
    downloadBlob(f.blob, f.fileName);
  },
  async importBackupFile(file: File) {
    const r = await repo.importFromFile(file);
    snack(r.smsAdded + r.callsAdded > 0 ? `از «${r.sourceName}»: ${r.smsAdded} پیامک و ${r.callsAdded} مورد وارد شد.` : `اطلاعات معتبری در فایل «${r.sourceName}» یافت نشد.`);
  },
  importPastedOrSharedText(text: string, sourceLabel = 'کلیپ‌بورد') {
    const r = repo.importSharedOrPastedText(text, sourceLabel);
    snack(r.smsAdded + r.callsAdded > 0 ? `${r.smsAdded} پیامک و ${r.callsAdded} تماس اضافه شد.` : 'متن معتبری برای افزودن یافت نشد.');
  },
  deleteCall: (id: number) => repo.deleteCall(id),
  deleteHistory: (id: number) => repo.deleteHistory(id),
  clearHistory: () => { repo.clearHistory(); snack('تاریخچه انتقال‌ها پاک شد.'); },

  // --- Bluetooth (no classic Bluetooth / BLE peripheral on iOS Safari) ---
  refreshBluetoothStatus: () => {},
  toggleScan() {
    snack('مرورگر آیفون (Safari) به بلوتوث دسترسی ندارد؛ از «ارسال فایل استاندارد» یا اشتراک‌گذاری استفاده کنید.');
  },
  selectBridgeSource: (address: string) => setState({ selectedBridgeSourceAddress: address, snackbarMessage: 'دستگاه فعال پل بلوتوث انتخاب شد.' }),
  pairDevice: (d: DiscoveredBluetoothDevice) => snack(`درخواست جفت‌سازی برای «${d.name}» ارسال شد.`),
  setTransferMode(mode: TransferMode) {
    if (mode === 'BLE_GATT_BRIDGE' && !state.appConfig.enableBleGattBridge) { snack('حالت BLE GATT موقتاً توسط مدیریت غیرفعال شده است.'); return; }
    setState({ transferMode: mode });
  },
  setExportFormat: (f: ExportFormat) => setState({ exportFormat: f }),
  setRelayDeviceRole: (r: RelayDeviceRole) => setState({ relayDeviceRole: r, snackbarMessage: `نقش دستگاه روی «${RelayDeviceRoleInfo[r].labelFa}» تنظیم شد.` }),
  connectToDevice(d: DiscoveredBluetoothDevice) { if (!requireProBridgeAccess()) return; setState({ selectedBridgeSourceAddress: d.address }); actions.toggleScan(); },
  disconnectBridgePeer: () => setState({ relayConnectionState: { kind: 'Disconnected' }, transferState: { kind: 'Idle' }, snackbarMessage: 'اتصال پل بلوتوث قطع شد.' }),
  toggleReceiveServer() {
    if (state.transferState.kind === 'Listening') { setState({ transferState: { kind: 'Idle' } }); return; }
    if (!requireProBridgeAccess()) return;
    actions.toggleScan();
  },
  dismissIncomingBridgeEvent: () => setState({ latestIncomingBridgeEvent: null }),
  clearTransferBanner: () => setState({ transferState: { kind: 'Idle' } }),
  sendToDevice(d: DiscoveredBluetoothDevice) {
    if (!requireProBridgeAccess()) return;
    if (!state.smsRecords.length && !state.callRecords.length) { snack('هنوز پیامک یا تماسی برای همگام‌سازی ثبت نشده است.'); return; }
    actions.sendViaStandardBluetoothExport(d.name, d.address);
  },
  sendViaStandardBluetoothExport(targetName = 'آیفون / دستگاه بلوتوثی', targetAddress = 'OPP/SHARE') {
    const s = state;
    if (!s.smsRecords.length && !s.callRecords.length) { snack('هنوز پیامک یا تماسی برای خروجی گرفتن ثبت نشده است.'); return; }
    const f = repo.createExportFile(s.exportFormat, s.smsRecords, s.callRecords);
    repo.recordTransferHistory({ targetDeviceName: targetName, targetAddress, targetPlatform: DevicePlatformLabel.IPHONE, channelMethod: 'ارسال فایل استاندارد (بلوتوث / اشتراک)', exportFormat: ExportFormatInfo[s.exportFormat].extension.toUpperCase(), smsCount: s.smsRecords.length, callCount: s.callRecords.length, bytesTransferred: f.byteSize, status: 'آماده ارسال' });
    downloadBlob(f.blob, f.fileName);
  },

  // --- Payments ---
  async submitPaymentReceipt(plan: PaymentPlan, method: PaymentMethod, destination: string, trackingCode: string, image: File | null) {
    const p = state.payment;
    if (p.isSubmitting) return;
    if (!p.configLoaded) { snack('تنظیمات پرداخت هنوز دریافت نشده است. چند لحظه بعد دوباره تلاش کنید.'); return; }
    if (p.myRequests.some((r) => statusFromRaw(r.status) === 'PENDING')) { snack('یک فیش در انتظار بررسی دارید.'); return; }
    setPay({ isSubmitting: true });
    let base64 = '';
    if (image) {
      try { base64 = await compressReceiptImage(image); } catch { base64 = ''; }
      if (!base64) { setPay({ isSubmitting: false }); snack('خواندن تصویر فیش ممکن نشد. تصویر دیگری انتخاب کنید.'); return; }
    }
    try {
      await pay.submitRequest(plan, priceFor(state.payment.config, plan), method, destination, trackingCode, base64);
      setPay({ isSubmitting: false, submitSuccessTick: state.payment.submitSuccessTick + 1 });
      snack('فیش شما ثبت شد. پس از تایید مدیر، اشتراک خودکار فعال می‌شود.');
    } catch (e) {
      setPay({ isSubmitting: false });
      snack((e as Error)?.message || 'ثبت فیش ناموفق بود.');
    }
  },
  async savePaymentConfig(m: number, y: number, ins: string, cards: BankCardInfo[], wallets: CryptoWalletInfo[]) {
    if (!state.isAdmin) return;
    setState({ isCloudSaving: true });
    try { await pay.saveConfig(m, y, ins, cards, wallets); snack('اطلاعات پرداخت و قیمت‌ها ذخیره شد.'); }
    catch (e) { snack(`خطا در ذخیره اطلاعات پرداخت: ${(e as Error)?.message ?? ''}`); }
    finally { setState({ isCloudSaving: false }); }
  },
  async approvePaymentRequest(r: PaymentRequest, note: string) {
    if (!state.isAdmin) return;
    try { await pay.approveRequest(r, note); snack(`تایید شد؛ اشتراک «${r.userName}» فعال شد.`); }
    catch (e) { snack(`خطا در تایید: ${(e as Error)?.message ?? ''}`); }
  },
  async rejectPaymentRequest(r: PaymentRequest, note: string) {
    if (!state.isAdmin) return;
    try { await pay.rejectRequest(r, note); snack('درخواست رد شد.'); } catch { snack('خطا در رد درخواست.'); }
  },
  async deletePaymentRequest(id: string) {
    if (!state.isAdmin) return;
    try { await pay.deleteRequest(id); snack('درخواست حذف شد.'); } catch { snack('خطا در حذف درخواست.'); }
  },

  // --- Cloud account & Admin studio ---
  async updateUserSimLabels(a: string, b: string) {
    setState({ isCloudSaving: true });
    try { await cloud.updateSimLabels(a, b); snack('نام سیم‌کارت‌ها ذخیره و همگام‌سازی شد.'); }
    catch { snack('خطا در ذخیره نام سیم‌کارت‌ها.'); }
    finally { setState({ isCloudSaving: false }); }
  },
  async saveAdminGlobalConfig(c: AppGlobalConfig) {
    if (!state.isAdmin) return;
    setState({ isCloudSaving: true });
    try { await cloud.saveGlobalConfig(c); snack('تنظیمات کل سیستم با موفقیت منتشر شد.'); }
    catch (e) { snack(`خطا در انتشار تنظیمات: ${(e as Error)?.message || 'دسترسی محدود'}`); }
    finally { setState({ isCloudSaving: false }); }
  },
  async saveAdminAnnouncement(existingId: string | null, title: string, summary: string, category: AnnouncementCategory, actionLabel: string, actionValue: string, published: boolean) {
    if (!state.isAdmin) return;
    setState({ isCloudSaving: true });
    try { await cloud.saveAnnouncement(existingId, title, summary, category, actionLabel, actionValue, published); snack(existingId == null ? 'امکان/اطلاعیه جدید منتشر شد.' : 'ویرایش ذخیره شد.'); }
    catch (e) { snack(`خطا در ذخیره اطلاعیه: ${(e as Error)?.message ?? ''}`); }
    finally { setState({ isCloudSaving: false }); }
  },
  async toggleAdminAnnouncementPublished(id: string, published: boolean) {
    if (!state.isAdmin) return;
    try { await cloud.toggleAnnouncementPublished(id, published); snack(published ? 'منتشر شد.' : 'از دید کاربران پنهان شد.'); }
    catch { snack('خطا در تغییر وضعیت انتشار.'); }
  },
  async deleteAdminAnnouncement(id: string) {
    if (!state.isAdmin) return;
    try { await cloud.deleteAnnouncement(id); snack('ماژول حذف شد.'); } catch { snack('خطا در حذف.'); }
  },
  async setAdminUserSubscription(uid: string, hasActive: boolean, tier: SubscriptionTier) {
    if (!state.isAdmin) return;
    setState({ isCloudSaving: true });
    try { await cloud.setUserSubscription(uid, hasActive, tier); snack('وضعیت اشتراک کاربر به‌روزرسانی شد.'); }
    catch { snack('خطا در تغییر اشتراک کاربر.'); }
    finally { setState({ isCloudSaving: false }); }
  },
  openExternalAction(raw: string) {
    const clean = raw.trim();
    if (!clean) return;
    if (!/^(https?:\/\/|tel:)/i.test(clean)) { snack('لینک یا کد اقدام معتبر نیست.'); return; }
    if (/^https?:/i.test(clean)) window.open(clean, '_blank', 'noopener'); else openUrl(clean);
  },
};

/** Same algorithm as MainViewModel.compressReceiptImage: JPEG, max side 1280→480, quality 70→40, ≤650k base64 chars. */
async function compressReceiptImage(file: File): Promise<string> {
  const bmp = await loadImage(file);
  let maxSide = 1280; let quality = 70;
  for (;;) {
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)); const h = Math.max(1, Math.round(bmp.height * scale));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    const b64 = c.toDataURL('image/jpeg', quality / 100).split(',')[1] ?? '';
    if (b64.length <= 650_000 || maxSide <= 480) return b64;
    maxSide = Math.trunc(maxSide * 0.75); quality = Math.max(40, quality - 10);
  }
}
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
