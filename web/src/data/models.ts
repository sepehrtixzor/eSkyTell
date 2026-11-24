// Port of data/model/*.kt and data/local/Entities.kt
import type { Timestamp } from 'firebase/firestore';

export type AnnouncementCategory = 'FEATURE' | 'UPDATE' | 'TIP' | 'USSD';
export const AnnouncementCategoryLabel: Record<AnnouncementCategory, string> = {
  FEATURE: 'قابلیت جدید',
  UPDATE: 'آپدیت سیستم',
  TIP: 'راهنما و ترفند',
  USSD: 'کد دستوری',
};
export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = ['FEATURE', 'UPDATE', 'TIP', 'USSD'];
export function categoryFromRaw(raw: string): AnnouncementCategory {
  return (ANNOUNCEMENT_CATEGORIES as string[]).includes(raw) ? (raw as AnnouncementCategory) : 'FEATURE';
}

export type SubscriptionTier = 'FREE' | 'MONTHLY' | 'YEARLY' | 'LIFETIME';
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = ['FREE', 'MONTHLY', 'YEARLY', 'LIFETIME'];
export const SubscriptionTierLabel: Record<SubscriptionTier, string> = {
  FREE: 'رایگان',
  MONTHLY: 'اشتراک ماهانه',
  YEARLY: 'اشتراک سالانه',
  LIFETIME: 'اشتراک دائمی',
};
export function tierFromRaw(raw: string): SubscriptionTier {
  return (SUBSCRIPTION_TIERS as string[]).includes(raw) ? (raw as SubscriptionTier) : 'FREE';
}

export interface AppGlobalConfig {
  id: string;
  subscriptionRequired: boolean;
  monthlyPriceLabel: string;
  yearlyPriceLabel: string;
  freeTrialDays: number;
  paywallMessage: string;
  paymentUrl: string;
  latestVersionName: string;
  latestVersionCode: number;
  updateNotes: string;
  updateUrl: string;
  forceUpdate: boolean;
  enableDualSim: boolean;
  enableQuickTemplates: boolean;
  enableQuietHours: boolean;
  enableBleGattBridge: boolean;
  updatedBy: string;
  updatedAt: Timestamp | null;
}
export const defaultAppGlobalConfig = (): AppGlobalConfig => ({
  id: 'global',
  subscriptionRequired: false,
  monthlyPriceLabel: '۹۹,۰۰۰ تومان / ماه',
  yearlyPriceLabel: '۷۹۰,۰۰۰ تومان / سال',
  freeTrialDays: 7,
  paywallMessage: 'برای استفاده نامحدود از پل بلوتوثی تماس و پیامک، اشتراک eSkyTell Pro را فعال کنید.',
  paymentUrl: '',
  latestVersionName: '1.0.0',
  latestVersionCode: 1,
  updateNotes: '',
  updateUrl: '',
  forceUpdate: false,
  enableDualSim: true,
  enableQuickTemplates: true,
  enableQuietHours: true,
  enableBleGattBridge: true,
  updatedBy: 'system',
  updatedAt: null,
});

export interface AnnouncementModule {
  id: string;
  title: string;
  summary: string;
  category: string;
  actionLabel: string;
  actionValue: string;
  published: boolean;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  photoUrl: string;
  sim1Label: string;
  sim2Label: string;
  hasActiveSubscription: boolean;
  subscriptionTier: string;
  subscriptionExpiresAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

// ---- Payments ----
export type PaymentPlan = 'MONTHLY' | 'YEARLY';
export const PaymentPlanInfo: Record<PaymentPlan, { labelFa: string; days: number; tier: SubscriptionTier }> = {
  MONTHLY: { labelFa: 'اشتراک ماهانه', days: 30, tier: 'MONTHLY' },
  YEARLY: { labelFa: 'اشتراک سالانه', days: 365, tier: 'YEARLY' },
};
export const planFromRaw = (raw: string): PaymentPlan => (raw === 'YEARLY' ? 'YEARLY' : 'MONTHLY');

export type PaymentMethod = 'CARD' | 'CRYPTO';
export const PaymentMethodLabel: Record<PaymentMethod, string> = { CARD: 'کارت به کارت', CRYPTO: 'ارز دیجیتال' };
export const methodFromRaw = (raw: string): PaymentMethod => (raw === 'CRYPTO' ? 'CRYPTO' : 'CARD');

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export const PaymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: 'در انتظار بررسی',
  APPROVED: 'تایید شد',
  REJECTED: 'رد شد',
};
export const statusFromRaw = (raw: string): PaymentStatus =>
  raw === 'APPROVED' ? 'APPROVED' : raw === 'REJECTED' ? 'REJECTED' : 'PENDING';

export interface BankCardInfo {
  id: string;
  bankName: string;
  cardNumber: string;
  holderName: string;
  sheba: string;
  active: boolean;
}
export interface CryptoWalletInfo {
  id: string;
  coin: string;
  network: string;
  address: string;
  note: string;
  active: boolean;
}
export interface PaymentConfig {
  id: string;
  monthlyPriceToman: number;
  yearlyPriceToman: number;
  cards: BankCardInfo[];
  wallets: CryptoWalletInfo[];
  instructions: string;
  updatedAt: Timestamp | null;
}
export const defaultPaymentConfig = (): PaymentConfig => ({
  id: 'main',
  monthlyPriceToman: 99000,
  yearlyPriceToman: 790000,
  cards: [],
  wallets: [],
  instructions:
    'مبلغ پلن را به یکی از کارت‌ها یا کیف پول‌های زیر واریز کنید، سپس کد پیگیری یا تصویر فیش را ارسال کنید. پس از تایید، اشتراک شما خودکار فعال می‌شود.',
  updatedAt: null,
});
export const priceFor = (c: PaymentConfig, plan: PaymentPlan) =>
  plan === 'MONTHLY' ? c.monthlyPriceToman : c.yearlyPriceToman;

export interface PaymentRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  plan: string;
  amountToman: number;
  method: string;
  destination: string;
  trackingCode: string;
  receiptImage: string;
  status: string;
  adminNote: string;
  reviewedBy: string;
  createdAt: Timestamp | null;
  reviewedAt: Timestamp | null;
}

export function toFaDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}
export function formatToman(amount: number): string {
  const grouped = Math.trunc(amount).toLocaleString('en-US');
  return `${toFaDigits(grouped)} تومان`;
}

// ---- Transfer / local ----
export type SmsDirection = 'INCOMING' | 'OUTGOING' | 'DRAFT';
export const SmsDirectionLabel: Record<string, string> = { INCOMING: 'دریافتی', OUTGOING: 'ارسالی', DRAFT: 'پیش‌نویس' };
export type CallDirection = 'INCOMING' | 'OUTGOING' | 'MISSED' | 'REJECTED';
export const CallDirectionLabel: Record<string, string> = {
  INCOMING: 'ورودی',
  OUTGOING: 'خروجی',
  MISSED: 'بی‌پاسخ',
  REJECTED: 'رد شده',
};

export type ExportFormat = 'HTML_REPORT' | 'VCARD_CONTACTS' | 'JSON_BUNDLE' | 'CSV_TABLE' | 'PLAIN_TEXT';
export const ExportFormatInfo: Record<ExportFormat, { extension: string; mimeType: string; titleFa: string; subtitleFa: string }> = {
  HTML_REPORT: { extension: 'html', mimeType: 'text/html', titleFa: 'گزارش تعاملی (HTML)', subtitleFa: 'مناسب آیفون و مرورگر — نمایش کامل پیامک‌ها و تماس‌ها' },
  VCARD_CONTACTS: { extension: 'vcf', mimeType: 'text/vcard', titleFa: 'کارت مخاطبین (vCard)', subtitleFa: 'افزودن مستقیم شماره‌های تماس به مخاطبین آیفون' },
  JSON_BUNDLE: { extension: 'json', mimeType: 'application/json', titleFa: 'بسته داده (JSON)', subtitleFa: 'انتقال ساختاریافته بین دستگاه‌ها و نرم‌افزارها' },
  CSV_TABLE: { extension: 'csv', mimeType: 'text/csv', titleFa: 'جدول اکسل (CSV)', subtitleFa: 'باز شدن در اپلیکیشن Numbers آیفون و اکسل' },
  PLAIN_TEXT: { extension: 'txt', mimeType: 'text/plain', titleFa: 'متن ساده (TXT)', subtitleFa: 'فایل سبک متنی قابل خواندن در همه گوشی‌ها' },
};
export const EXPORT_FORMATS = Object.keys(ExportFormatInfo) as ExportFormat[];

export type TransferMode = 'CROSS_PLATFORM_OPP' | 'BLE_GATT_BRIDGE' | 'DIRECT_RFCOMM';
export const TransferModeInfo: Record<TransferMode, { titleFa: string; subtitleFa: string }> = {
  CROSS_PLATFORM_OPP: { titleFa: 'ارسال به آیفون و همه گوشی‌ها', subtitleFa: 'ارسال فایل استاندارد از طریق بلوتوث (OPP) یا اشتراک‌گذاری به iOS و اندروید' },
  BLE_GATT_BRIDGE: { titleFa: 'پل زنده بلوتوث (BLE GATT)', subtitleFa: 'ارتباط کم‌مصرف و دوطرفه بلوتوث برای همگام‌سازی سریع با آیفون و اندروید' },
  DIRECT_RFCOMM: { titleFa: 'اتصال مستقیم RFCOMM', subtitleFa: 'همگام‌سازی پرسرعت تماس و پیامک بین دو گوشی دارای eSkyTell' },
};
export const TRANSFER_MODES = Object.keys(TransferModeInfo) as TransferMode[];

export type DevicePlatform = 'IPHONE' | 'ANDROID' | 'COMPUTER' | 'OTHER';
export const DevicePlatformLabel: Record<DevicePlatform, string> = {
  IPHONE: 'آیفون / اپل',
  ANDROID: 'اندروید / موبایل',
  COMPUTER: 'لپ‌تاپ / دسکتاپ',
  OTHER: 'سایر دستگاه‌ها',
};

export interface DiscoveredBluetoothDevice {
  name: string;
  address: string;
  isPaired: boolean;
  rssi?: number | null;
  platform: DevicePlatform;
  isBle: boolean;
  isConnected: boolean;
}

export type BridgeCommandType = 'CALL_TRANSFER' | 'SMS_RELAY' | 'CONTACT_SYNC';
export interface IncomingBridgeEvent {
  type: BridgeCommandType;
  sourceDeviceName: string;
  contactName: string;
  phoneNumber: string;
  messageBody: string;
  simSlot: number;
  timestampMillis: number;
}
export interface PermissionSummary {
  bluetoothGranted: boolean;
  contactsGranted: boolean;
  notificationsGranted: boolean;
}
export interface ActiveBridgeCall {
  contactName: string;
  phoneNumber: string;
  simSlot: number;
  targetDeviceName: string;
  startedAtMillis: number;
  isMuted: boolean;
  isSpeaker: boolean;
  isBluetoothAudio: boolean;
}
export interface SmsThreadSummary {
  phoneNumber: string;
  displayName: string;
  lastMessage: string;
  lastTimestampMillis: number;
  unreadCount: number;
  messageCount: number;
  simSlot: number;
}
export type TransferSessionState =
  | { kind: 'Idle' }
  | { kind: 'Listening'; deviceName: string }
  | { kind: 'Connecting'; targetName: string }
  | { kind: 'Transferring'; targetName: string; progress: number; bytesSent: number; totalBytes: number }
  | { kind: 'Success'; message: string }
  | { kind: 'Error'; message: string };

export type RelayDeviceRole = 'PRIMARY' | 'SECONDARY';
export const RelayDeviceRoleInfo: Record<RelayDeviceRole, { labelFa: string; subtitleFa: string }> = {
  PRIMARY: { labelFa: 'دستگاه اصلی', subtitleFa: 'گوشی مبدأ دارای سیم‌کارت برای رله تماس و پیامک' },
  SECONDARY: { labelFa: 'دستگاه دوم', subtitleFa: 'گوشی مقصد / آیفون متصل به پل بلوتوث' },
};
export type RelayTransport = 'AUTO' | 'RFCOMM' | 'BLE_GATT';
export const RelayTransportLabel: Record<RelayTransport, string> = {
  AUTO: 'خودکار (RFCOMM / BLE)',
  RFCOMM: 'کانال مستقیم RFCOMM',
  BLE_GATT: 'کانال کم‌مصرف BLE GATT',
};
export type RelayConnectionState =
  | { kind: 'Disconnected' }
  | { kind: 'Listening'; role: RelayDeviceRole; localDeviceName: string }
  | { kind: 'Connecting'; deviceName: string; address: string }
  | { kind: 'Connected'; deviceName: string; address: string; role: RelayDeviceRole; transport: RelayTransport }
  | { kind: 'Relaying'; deviceName: string; progress: number; bytesTransferred: number; totalBytes: number }
  | { kind: 'Error'; message: string };

export interface ImportResult {
  smsAdded: number;
  callsAdded: number;
  sourceName: string;
}

export interface SmsRecordEntity {
  id: number;
  senderName: string;
  phoneNumber: string;
  body: string;
  timestampMillis: number;
  direction: string;
  isSelected: boolean;
  sourceLabel: string;
  simSlot: number;
  isRead: boolean;
}
export interface CallRecordEntity {
  id: number;
  contactName: string;
  phoneNumber: string;
  timestampMillis: number;
  durationSeconds: number;
  direction: string;
  isSelected: boolean;
  sourceLabel: string;
  simSlot: number;
}
export interface ContactEntity {
  id: number;
  displayName: string;
  phoneNumber: string;
  email: string;
  notes: string;
  isFavorite: boolean;
  syncedToSystem: boolean;
  sourceLabel: string;
  updatedAtMillis: number;
}
export interface TransferHistoryEntity {
  id: number;
  targetDeviceName: string;
  targetAddress: string;
  targetPlatform: string;
  channelMethod: string;
  exportFormat: string;
  smsCount: number;
  callCount: number;
  bytesTransferred: number;
  status: string;
  timestampMillis: number;
}
