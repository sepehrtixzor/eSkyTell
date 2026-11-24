// Port of ui/screens/AdminStudioScreen.kt
import { useEffect, useState } from 'preact/hooks';
import { mdiArrowRight, mdiCrown, mdiCogs, mdiAccountGroup, mdiCashMultiple, mdiPublish, mdiPlus, mdiPencil, mdiDeleteOutline, mdiMagnify } from '@mdi/js';
import { Button, Chip, Dialog, Icon, IconButton, Switch, TextField, alpha } from '../ui/kit';
import { actions, type MainUiState } from '../data/store';
import { ANNOUNCEMENT_CATEGORIES, AnnouncementCategoryLabel, categoryFromRaw, SUBSCRIPTION_TIERS, SubscriptionTierLabel, tierFromRaw, type AnnouncementCategory, type AnnouncementModule, type AppGlobalConfig, type UserProfile } from '../data/models';
import { PaymentsAdminTab, formatFaDate } from './AdminPaymentsTab';

export function AdminStudioScreen({ s, initialTab, tabRequestTick, onClose }: { s: MainUiState; initialTab: number; tabRequestTick: number; onClose: () => void }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => setTab(initialTab), [initialTab, tabRequestTick]);
  const [editing, setEditing] = useState<AnnouncementModule | null>(null);
  const [showNew, setShowNew] = useState(false);
  const config = s.appConfig;
  const [f, setF] = useState(() => toForm(config));
  useEffect(() => setF(toForm(config)), [config]);
  const upd = (p: Partial<ReturnType<typeof toForm>>) => setF({ ...f, ...p });

  // BackHandler
  useEffect(() => {
    history.pushState({ admin: true }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const emit = () => actions.saveAdminGlobalConfig({
    ...config, subscriptionRequired: f.subRequired, monthlyPriceLabel: f.monthlyPrice, yearlyPriceLabel: f.yearlyPrice,
    freeTrialDays: parseInt(f.trialDays, 10) || 0, paywallMessage: f.paywallMessage, paymentUrl: f.paymentUrl,
    latestVersionName: f.versionName, latestVersionCode: Math.max(1, parseInt(f.versionCode, 10) || 1),
    updateNotes: f.updateNotes, updateUrl: f.updateUrl, forceUpdate: f.forceUpdate, enableDualSim: f.enableDualSim,
    enableQuickTemplates: f.enableQuickTemplates, enableQuietHours: f.enableQuietHours, enableBleGattBridge: f.enableBleGatt,
  });
  const pending = s.payment.adminRequests.filter((r) => r.status === 'PENDING').length;
  const tabs: [string, string, string][] = [
    [mdiCrown, 'اشتراک و قیمت', 'admin_tab_monetization'],
    [mdiCogs, 'آپدیت و امکانات', 'admin_tab_features'],
    [mdiAccountGroup, `کاربران (${s.adminUsers.length})`, 'admin_tab_users'],
    [mdiCashMultiple, pending > 0 ? `پرداخت‌ها (${pending})` : 'پرداخت‌ها', 'admin_tab_payments'],
  ];

  return (
    <div class="col" style={{ height: '100%', paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>
      <div class="row" style={{ height: 64, padding: '0 4px', flex: 'none' }}>
        <IconButton path={mdiArrowRight} label="بازگشت" onClick={() => history.back()} />
        <div class="col" style={{ marginInlineStart: 4 }}>
          <span class="titleMedium bold">پنل مدیریت eSkyTell</span>
          <span class="labelSmall" style={{ color: 'var(--gold)' }}>مدیریت آسان بدون نیاز به کدنویسی</span>
        </div>
      </div>
      <div class="col grow" style={{ width: '100%', maxWidth: 720, margin: '0 auto', minHeight: 0 }}>
        <div class="row hscroll" style={{ borderBottom: '1px solid var(--surface-variant)', padding: '0 8px', flex: 'none' }}>
          {tabs.map(([icon, label, id], i) => (
            <button key={id} type="button" data-testid={id} onClick={() => setTab(i)} class="col acenter g4"
              style={{ flex: 'none', minWidth: 90, padding: '10px 16px 8px', background: 'none', border: 'none', cursor: 'pointer', color: tab === i ? 'var(--primary)' : 'var(--on-surface-variant)', borderBottom: `3px solid ${tab === i ? 'var(--primary)' : 'transparent'}` }}>
              <Icon path={icon} />
              <span class="titleSmall" style={{ whiteSpace: 'nowrap' }}>{label}</span>
            </button>
          ))}
        </div>
        <div class="grow" style={{ minHeight: 0 }}>
          {tab === 0 && <MonetizationTab f={f} upd={upd} saving={s.isCloudSaving} onSave={emit} />}
          {tab === 1 && <ReleasesTab f={f} upd={upd} saving={s.isCloudSaving} modules={s.adminAnnouncements} onSave={emit} onNew={() => setShowNew(true)} onEdit={setEditing} />}
          {tab === 2 && <UsersTab users={s.adminUsers} />}
          {tab === 3 && <PaymentsAdminTab paymentState={s.payment} isSaving={s.isCloudSaving} onSaveConfig={actions.savePaymentConfig} onApprove={actions.approvePaymentRequest} onReject={actions.rejectPaymentRequest} onDelete={actions.deletePaymentRequest} />}
        </div>
      </div>
      {showNew && <ModuleEditorDialog initial={null} onDismiss={() => setShowNew(false)} onSave={(t, su, c, al, av, p) => actions.saveAdminAnnouncement(null, t, su, c, al, av, p)} />}
      {editing && <ModuleEditorDialog initial={editing} onDismiss={() => setEditing(null)} onSave={(t, su, c, al, av, p) => actions.saveAdminAnnouncement(editing.id, t, su, c, al, av, p)} />}
    </div>
  );
}

function toForm(c: AppGlobalConfig) {
  return {
    subRequired: c.subscriptionRequired, monthlyPrice: c.monthlyPriceLabel, yearlyPrice: c.yearlyPriceLabel, trialDays: String(c.freeTrialDays),
    paywallMessage: c.paywallMessage, paymentUrl: c.paymentUrl, versionName: c.latestVersionName, versionCode: String(c.latestVersionCode),
    updateNotes: c.updateNotes, updateUrl: c.updateUrl, forceUpdate: c.forceUpdate, enableDualSim: c.enableDualSim,
    enableQuickTemplates: c.enableQuickTemplates, enableQuietHours: c.enableQuietHours, enableBleGatt: c.enableBleGattBridge,
  };
}
type Form = ReturnType<typeof toForm>;

function MonetizationTab({ f, upd, saving, onSave }: { f: Form; upd: (p: Partial<Form>) => void; saving: boolean; onSave: () => void }) {
  return (
    <div class="col g12 scroll" style={{ height: '100%', padding: 16 }}>
      <div class="card row between g10" style={{ padding: 16, flex: 'none', background: f.subRequired ? alpha('#F4B860', 0.14) : alpha('#10B981', 0.14), border: `1px solid ${f.subRequired ? 'var(--gold)' : 'var(--emerald)'}` }}>
        <div class="col g4 grow">
          <span class="titleMedium bold">{f.subRequired ? 'حالت اشتراکی فعال است' : 'حالت فعلی: کاملاً رایگان'}</span>
          <span class="bodySmall muted">هر زمان که بخواهید با تغییر این کلید می‌توانید کل برنامه را بین رایگان و اشتراکی جابه‌جا کنید.</span>
        </div>
        <Switch checked={f.subRequired} onChange={(v) => upd({ subRequired: v })} testId="admin_subscription_switch" />
      </div>
      <div class="card bordered col g10" style={{ padding: 16, flex: 'none' }}>
        <span class="titleSmall bold">تنظیم تعرفه‌ها و صفحه خرید</span>
        <TextField value={f.monthlyPrice} onInput={(v) => upd({ monthlyPrice: v })} label="متن قیمت ماهانه" testId="admin_monthly_price" />
        <TextField value={f.yearlyPrice} onInput={(v) => upd({ yearlyPrice: v })} label="متن قیمت سالانه" testId="admin_yearly_price" />
        <TextField value={f.trialDays} onInput={(v) => upd({ trialDays: v.replace(/\D/g, '') })} label="تعداد روز تست رایگان" inputMode="numeric" />
        <TextField value={f.paywallMessage} onInput={(v) => upd({ paywallMessage: v })} label="پیام دعوت به خرید اشتراک" multiline minRows={2} maxRows={4} />
        <TextField value={f.paymentUrl} onInput={(v) => upd({ paymentUrl: v })} label="لینک درگاه پرداخت یا صفحه پشتیبانی (اختیاری)" dir="ltr" />
        <Button icon={mdiPublish} disabled={saving} testId="admin_save_monetization_btn" onClick={onSave} style={{ width: '100%', height: 48 }}>انتشار تغییرات اشتراک برای همه کاربران</Button>
      </div>
    </div>
  );
}

function FeatureToggleRow({ title, checked, onChange }: { title: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div class="row between g8"><span class="bodyMedium grow">{title}</span><Switch checked={checked} onChange={onChange} /></div>;
}

function ReleasesTab({ f, upd, saving, modules, onSave, onNew, onEdit }: { f: Form; upd: (p: Partial<Form>) => void; saving: boolean; modules: AnnouncementModule[]; onSave: () => void; onNew: () => void; onEdit: (m: AnnouncementModule) => void }) {
  return (
    <div class="col g12 scroll" style={{ height: '100%', padding: 16 }}>
      <div class="card bordered col g10" style={{ padding: 16, flex: 'none' }}>
        <span class="titleSmall bold">انتشار آپدیت جدید برای عموم</span>
        <div class="row g8">
          <TextField value={f.versionName} onInput={(v) => upd({ versionName: v })} label="نام نسخه (مثلاً 1.2.0)" />
          <TextField value={f.versionCode} onInput={(v) => upd({ versionCode: v.replace(/\D/g, '') })} label="کد نسخه" inputMode="numeric" />
        </div>
        <TextField value={f.updateNotes} onInput={(v) => upd({ updateNotes: v })} label="توضیحات تغییرات نسخه جدید" multiline minRows={2} maxRows={4} />
        <TextField value={f.updateUrl} onInput={(v) => upd({ updateUrl: v })} label="لینک دانلود یا استور نسخه جدید (https://...)" dir="ltr" />
        <div class="row between"><span class="bodyMedium">نشان‌گذاری به عنوان آپدیت مهم</span><Switch checked={f.forceUpdate} onChange={(v) => upd({ forceUpdate: v })} /></div>
        <div class="divider" />
        <span class="titleSmall bold">کلیدهای روشن/خاموش امکانات داخلی</span>
        <FeatureToggleRow title="پشتیبانی دو سیم‌کارت (SIM 1 / SIM 2)" checked={f.enableDualSim} onChange={(v) => upd({ enableDualSim: v })} />
        <FeatureToggleRow title="قالب‌های پاسخ سریع پیامک" checked={f.enableQuickTemplates} onChange={(v) => upd({ enableQuickTemplates: v })} />
        <FeatureToggleRow title="حالت سکوت پل (Quiet Hours)" checked={f.enableQuietHours} onChange={(v) => upd({ enableQuietHours: v })} />
        <FeatureToggleRow title="پل کم‌مصرف بلوتوث BLE GATT" checked={f.enableBleGatt} onChange={(v) => upd({ enableBleGatt: v })} />
        <Button icon={mdiPublish} disabled={saving} testId="admin_save_release_btn" onClick={onSave} style={{ width: '100%', height: 48 }}>ذخیره و انتشار آپدیت و امکانات</Button>
      </div>
      <div class="row between g8">
        <span class="titleMedium bold">ماژول‌ها و اطلاعیه‌های پویا ({modules.length})</span>
        <Button kind="tonal" icon={mdiPlus} testId="admin_add_module_btn" onClick={onNew} style={{ padding: '0 14px' }}>افزودن مورد جدید</Button>
      </div>
      {modules.map((m) => (
        <div key={m.id} class="card medium bordered col g6" style={{ padding: 14, flex: 'none' }}>
          <div class="row between">
            <div class="col grow">
              <span class="titleSmall bold">{m.title}</span>
              <span class="labelSmall" style={{ color: 'var(--mint)' }}>{AnnouncementCategoryLabel[categoryFromRaw(m.category)]}</span>
            </div>
            <Switch checked={m.published} onChange={(v) => actions.toggleAdminAnnouncementPublished(m.id, v)} />
          </div>
          <span class="bodySmall muted" style={{ whiteSpace: 'pre-wrap' }}>{m.summary}</span>
          <div class="row" style={{ justifyContent: 'flex-end' }}>
            <IconButton path={mdiPencil} label="ویرایش" onClick={() => onEdit(m)} />
            <IconButton path={mdiDeleteOutline} label="حذف" color="var(--rose)" onClick={() => actions.deleteAdminAnnouncement(m.id)} />
          </div>
        </div>
      ))}
      <div style={{ minHeight: 16 }} />
    </div>
  );
}

function UsersTab({ users }: { users: UserProfile[] }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = users.filter((u) => !q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  return (
    <div class="col g10 scroll" style={{ height: '100%', padding: 16 }}>
      <TextField value={search} onInput={setSearch} leading={mdiMagnify} placeholder="جستجوی کاربر با نام یا ایمیل..." />
      {filtered.map((u) => {
        const cur = tierFromRaw(u.subscriptionTier);
        return (
          <div key={u.id || `u_${u.userId}_${u.email}`} class="card medium bordered col g8" style={{ padding: 14, flex: 'none' }}>
            <div class="row between g8">
              <div class="col grow">
                <span class="titleSmall bold">{u.displayName}</span>
                <span class="bodySmall muted ellipsis">{u.email}</span>
                {u.subscriptionExpiresAt && <span class="labelSmall" style={{ color: 'var(--gold)' }}>انقضا: {formatFaDate(u.subscriptionExpiresAt.toDate())}</span>}
              </div>
              <span class="labelSmall" style={{ borderRadius: 999, padding: '4px 10px', background: u.hasActiveSubscription ? alpha('#10B981', 0.18) : 'var(--surface-variant)', color: u.hasActiveSubscription ? 'var(--emerald)' : 'var(--on-surface-variant)' }}>{SubscriptionTierLabel[cur]}</span>
            </div>
            <div class="row wrap g6">
              {SUBSCRIPTION_TIERS.map((t) => <Chip key={t} selected={cur === t} onClick={() => actions.setAdminUserSubscription(u.userId, t !== 'FREE', t)}>{SubscriptionTierLabel[t]}</Chip>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModuleEditorDialog({ initial, onDismiss, onSave }: { initial: AnnouncementModule | null; onDismiss: () => void; onSave: (t: string, s: string, c: AnnouncementCategory, al: string, av: string, p: boolean) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [cat, setCat] = useState<AnnouncementCategory>(initial ? categoryFromRaw(initial.category) : 'FEATURE');
  const [al, setAl] = useState(initial?.actionLabel ?? '');
  const [av, setAv] = useState(initial?.actionValue ?? '');
  const [pub, setPub] = useState(initial?.published ?? true);
  const ok = !!title.trim() && !!summary.trim();
  return (
    <Dialog onDismiss={onDismiss} title={initial ? 'ویرایش ماژول' : 'افزودن قابلیت یا اطلاعیه جدید'} titleStart
      dismiss={<Button kind="text" onClick={onDismiss}>انصراف</Button>}
      confirm={<Button disabled={!ok} testId="admin_module_save_btn" onClick={() => { onSave(title, summary, cat, al, av, pub); onDismiss(); }}>ذخیره و انتشار</Button>}>
      <div class="col g10">
        <TextField value={title} onInput={setTitle} label="عنوان *" testId="admin_module_title" />
        <TextField value={summary} onInput={setSummary} label="توضیحات برای کاربران *" multiline minRows={3} maxRows={5} testId="admin_module_summary" />
        <div class="row wrap g6">{ANNOUNCEMENT_CATEGORIES.map((c) => <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>{AnnouncementCategoryLabel[c]}</Chip>)}</div>
        <TextField value={al} onInput={setAl} label="متن دکمه اقدام (اختیاری)" />
        <TextField value={av} onInput={setAv} label="لینک وب یا کد شماره‌گیری tel:*100# (اختیاری)" dir="ltr" />
        <div class="row between"><span class="bodyMedium" style={{ color: 'var(--on-surface)' }}>انتشار فوری برای کاربران</span><Switch checked={pub} onChange={setPub} /></div>
      </div>
    </Dialog>
  );
}
