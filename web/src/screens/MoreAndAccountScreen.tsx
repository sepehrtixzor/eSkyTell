// Port of ui/screens/MoreAndAccountScreen.kt
import { useEffect, useState } from 'preact/hooks';
import { mdiShieldAccount, mdiCellphoneArrowDown, mdiDownload, mdiCheckDecagram, mdiCrown, mdiCreation, mdiSimOutline, mdiWeatherNight, mdiWhiteBalanceSunny, mdiShieldLock, mdiHistory, mdiLogout } from '@mdi/js';
import { Button, Icon, Switch, TextField, alpha } from '../ui/kit';
import { actions, isSubscriptionActive, sim1DisplayLabel, sim2DisplayLabel, type MainUiState } from '../data/store';
import { AnnouncementCategoryLabel, categoryFromRaw, SubscriptionTierLabel, tierFromRaw, type AnnouncementModule } from '../data/models';
import { formatFaDate } from './AdminPaymentsTab';

/** Web build counterpart of BuildConfig.VERSION_CODE (app/build.gradle.kts versionCode = 1). */
export const WEB_VERSION_CODE = 1;

export function MoreAndAccountScreen({ s, onOpenAdminStudio, onOpenPermissionsSheet, onOpenHistorySheet, onSignOut }: {
  s: MainUiState; onOpenAdminStudio: () => void; onOpenPermissionsSheet: () => void; onOpenHistorySheet: () => void; onSignOut: () => void;
}) {
  const config = s.appConfig; const profile = s.userProfile;
  const hasUpdate = config.latestVersionCode > WEB_VERSION_CODE || !!config.updateNotes.trim();
  const [sim1, setSim1] = useState(sim1DisplayLabel(s));
  const [sim2, setSim2] = useState(sim2DisplayLabel(s));
  useEffect(() => { if (profile) { setSim1(profile.sim1Label); setSim2(profile.sim2Label); } }, [profile?.sim1Label, profile?.sim2Label]);
  const tier = tierFromRaw(profile?.subscriptionTier ?? 'FREE');
  const isFreeMode = !config.subscriptionRequired;
  const isPro = isSubscriptionActive(s) || s.isAdmin;
  const ok = isFreeMode || isPro;

  return (
    <div class="col g14 scroll" style={{ height: '100%', maxWidth: 680, margin: '0 auto', padding: 16 }}>
      {/* 1. Account */}
      <div class="card bordered row" style={{ padding: 16, flex: 'none' }}>
        <div class="row jcenter" style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--primary-container)', flex: 'none' }}>
          <span class="titleLarge" style={{ color: 'var(--mint)' }}>{(profile?.displayName ?? s.currentUserEmail).slice(0, 1).toUpperCase()}</span>
        </div>
        <div class="col g2" style={{ marginInlineStart: 12, minWidth: 0 }}>
          <div class="row g6">
            <span class="titleMedium bold ellipsis">{profile?.displayName?.trim() ? profile.displayName : 'کاربر eSkyTell'}</span>
            {s.isAdmin && <span class="labelSmall bold" style={{ background: alpha('#F4B860', 0.2), color: 'var(--gold)', borderRadius: 999, padding: '2px 8px', flex: 'none' }}>مدیر کل</span>}
          </div>
          <span class="bodySmall muted ellipsis">{s.currentUserEmail}</span>
        </div>
      </div>

      {/* 2. Admin studio */}
      {s.isAdmin && (
        <div class="card col g10" style={{ padding: 16, flex: 'none', background: alpha('#F4B860', 0.14), border: `1.5px solid ${alpha('#F4B860', 0.7)}` }}>
          <div class="row g10">
            <Icon path={mdiShieldAccount} size={28} color="var(--gold)" />
            <div class="col">
              <span class="titleMedium bold">استودیوی مدیریت بدون کد (Admin Studio)</span>
              <span class="bodySmall muted">تغییر وضعیت رایگان به اشتراکی، انتشار آپدیت، افزودن امکانات جدید و مدیریت کاربران</span>
            </div>
          </div>
          <Button icon={mdiShieldAccount} testId="open_admin_studio_btn" onClick={onOpenAdminStudio} style={{ height: 48, width: '100%', background: 'var(--gold)', color: 'var(--on-secondary)', fontWeight: 700 }}>ورود به پنل مدیریت eSkyTell</Button>
        </div>
      )}

      {/* 3. Update */}
      {hasUpdate && (
        <div class="card col g8" style={{ padding: 16, flex: 'none', background: alpha('#00D4AA', 0.14), border: `1px solid ${alpha('#00D4AA', 0.65)}` }}>
          <div class="row g8">
            <Icon path={mdiCellphoneArrowDown} color="var(--mint)" />
            <span class="titleSmall bold">نسخه {config.latestVersionName} {config.forceUpdate ? '(آپدیت مهم)' : 'در دسترس است'}</span>
          </div>
          {config.updateNotes.trim() && <span class="bodySmall" style={{ whiteSpace: 'pre-wrap' }}>{config.updateNotes}</span>}
          {config.updateUrl.trim() && <Button kind="tonal" icon={mdiDownload} onClick={() => actions.openExternalAction(config.updateUrl)} style={{ height: 48, width: '100%' }}>دریافت نسخه جدید</Button>}
        </div>
      )}

      {/* 4. Subscription */}
      <div class="card col g10" style={{ padding: 16, flex: 'none', border: `1px solid ${alpha('var(--outline)', 0.6)}` }}>
        <div class="row g8">
          <Icon path={ok ? mdiCheckDecagram : mdiCrown} color={ok ? 'var(--emerald)' : 'var(--gold)'} />
          <div class="col">
            <span class="titleSmall bold">وضعیت اشتراک eSkyTell</span>
            <span class="bodySmall" style={{ color: ok ? 'var(--emerald)' : 'var(--gold)' }}>
              {isFreeMode ? 'حالت فعلی: کاملاً رایگان برای همه کاربران'
                : isPro ? `اشتراک فعال: ${SubscriptionTierLabel[tier]}${profile?.subscriptionExpiresAt ? ` تا ${formatFaDate(profile.subscriptionExpiresAt.toDate())}` : ''}`
                  : 'نیاز به فعال‌سازی اشتراک Pro'}
            </span>
          </div>
        </div>
        {!isFreeMode && !s.isAdmin && <Button testId="more_upgrade_btn" onClick={actions.openPaywallSheet} style={{ height: 48, width: '100%' }}>{isPro ? 'تمدید اشتراک' : 'خرید اشتراک و ارسال فیش'}</Button>}
      </div>

      {/* 5. Announcements */}
      {s.publishedAnnouncements.length > 0 && <span class="titleMedium bold">امکانات و اطلاعیه‌های جدید</span>}
      {s.publishedAnnouncements.map((m) => <PublishedModuleCard key={m.id} m={m} />)}

      {/* 6. SIM labels */}
      <div class="card bordered col g10" style={{ padding: 16, flex: 'none' }}>
        <div class="row g8"><Icon path={mdiSimOutline} color="var(--gold)" /><span class="titleSmall bold">نام‌گذاری خطوط دو سیم‌کارت</span></div>
        <TextField value={sim1} onInput={setSim1} label="برچسب سیم‌کارت ۱" testId="settings_sim1_input" />
        <TextField value={sim2} onInput={setSim2} label="برچسب سیم‌کارت ۲" testId="settings_sim2_input" />
        <Button kind="tonal" disabled={s.isCloudSaving} testId="settings_save_sims_btn" onClick={() => actions.updateUserSimLabels(sim1, sim2)} style={{ height: 48, width: '100%' }}>ذخیره نام سیم‌کارت‌ها</Button>
      </div>

      {/* 7. Theme, permissions, history, sign out */}
      <div class="card bordered col g10" style={{ padding: 14, flex: 'none' }}>
        <div class="row between">
          <div class="row g10">
            <Icon path={s.isDarkTheme ? mdiWeatherNight : mdiWhiteBalanceSunny} color="var(--mint)" />
            <div class="col">
              <span class="titleSmall bold">تم تاریک Obsidian Jade</span>
              <span class="bodySmall muted">تغییر ظاهر بین حالت شب و روز</span>
            </div>
          </div>
          <Switch checked={s.isDarkTheme} onChange={() => actions.toggleTheme()} testId="settings_theme_switch" />
        </div>
        <div class="row g8">
          <Button kind="outlined" icon={mdiShieldLock} testId="settings_permissions_btn" onClick={onOpenPermissionsSheet} style={{ flex: 1, height: 48, padding: '0 8px' }}>مجوزها</Button>
          <Button kind="outlined" icon={mdiHistory} testId="settings_history_btn" onClick={onOpenHistorySheet} style={{ flex: 1, height: 48, padding: '0 8px' }}>تاریخچه پل</Button>
        </div>
        <button type="button" class="btn outlined" data-testid="sign_out_button" onClick={onSignOut} style={{ height: 48, width: '100%', borderColor: alpha('#F87171', 0.6), color: 'var(--rose)' }}>
          <Icon path={mdiLogout} size={18} style={{ transform: 'scaleX(-1)' }} />
          خروج از حساب کاربری
        </button>
      </div>
      <div style={{ minHeight: 16 }} />
    </div>
  );
}

function PublishedModuleCard({ m }: { m: AnnouncementModule }) {
  const cat = categoryFromRaw(m.category);
  return (
    <div class="card medium col g6" style={{ padding: 14, flex: 'none', border: `1px solid ${alpha('#00D4AA', 0.35)}` }}>
      <div class="row g8">
        <Icon path={mdiCreation} size={18} color="var(--gold)" />
        <span class="titleSmall bold grow">{m.title}</span>
        <span class="labelSmall" style={{ background: 'var(--primary-container)', color: 'var(--primary)', borderRadius: 999, padding: '2px 8px', flex: 'none' }}>{AnnouncementCategoryLabel[cat]}</span>
      </div>
      <span class="bodySmall muted" style={{ whiteSpace: 'pre-wrap' }}>{m.summary}</span>
      {m.actionValue.trim() && <Button kind="tonal" onClick={() => actions.openExternalAction(m.actionValue)} style={{ height: 42, width: '100%' }}>{m.actionLabel.trim() ? m.actionLabel : 'اجرا / مشاهده'}</Button>}
    </div>
  );
}
