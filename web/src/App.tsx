// Port of MainActivity.kt (auth gate, theme, RTL) + ESkyTellApp (scaffold, top bar, bottom navigation, sheets).
import { useEffect, useState } from 'preact/hooks';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { mdiPhone, mdiPhoneOutline, mdiMessageText, mdiMessageTextOutline, mdiBluetoothConnect, mdiBluetooth, mdiTune, mdiTuneVariant } from '@mdi/js';
import { auth } from './data/firebase';
import { isAdminUser } from './data/cloudRepository';
import { actions, activeSimLabel, getState, isSubscriptionActive, setState, startSession, stopSession, unreadSmsTotal, useStore } from './data/store';
import { Icon, Snackbar } from './ui/kit';
import { AuthScreen } from './screens/AuthScreen';
import { PhoneScreen } from './screens/PhoneScreen';
import { MessagesScreen } from './screens/MessagesScreen';
import { BridgeHubScreen } from './screens/BridgeHubScreen';
import { MoreAndAccountScreen } from './screens/MoreAndAccountScreen';
import { AdminStudioScreen } from './screens/AdminStudioScreen';
import { ActiveBridgeCallOverlay, HistoryBottomSheet, IphoneGuideSheet, PermissionsManagerSheet } from './components/TransferDialogs';
import { PaymentCheckoutSheet } from './components/PaymentCheckoutSheet';

export const ROUTE_PHONE = 'phone';
export const ROUTE_MESSAGES = 'messages';
export const ROUTE_BRIDGE = 'bridge';
export const ROUTE_MORE = 'more';
const ROUTES = [ROUTE_PHONE, ROUTE_MESSAGES, ROUTE_BRIDGE, ROUTE_MORE];

function useHashRoute(): [string, (r: string) => void] {
  const read = () => { const h = location.hash.replace(/^#\/?/, '').split('?')[0]; return ROUTES.includes(h) ? h : ROUTE_PHONE; };
  const [route, setRoute] = useState(read);
  useEffect(() => { const f = () => setRoute(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return [route, (r: string) => { if (r !== route) location.replace(`#/${r}`); }];
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(() => (window as any).__ESKYTELL_MOCK_USER__ ?? auth.currentUser ?? undefined);
  useEffect(() => {
    if ((window as any).__ESKYTELL_MOCK_USER__) return;
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);
  const s = useStore();

  // Per-user scope (UserScopedStores.retainOnly)
  useEffect(() => {
    if (user) startSession(user, isAdminUser(user)); else stopSession();
  }, [user?.uid]);

  // Theme (ESkyTellTheme darkTheme) — applied on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('light', !s.isDarkTheme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.isDarkTheme ? '#09110F' : '#F4F8F7');
  }, [s.isDarkTheme]);

  // ACTION_SEND text share target equivalent (?text= via manifest share_target)
  useEffect(() => {
    if (!user) return;
    const p = new URLSearchParams(location.search);
    const shared = p.get('text') || p.get('title') || p.get('url');
    if (shared?.trim()) {
      actions.importPastedOrSharedText(shared, 'اشتراک‌گذاری');
      history.replaceState(null, '', location.pathname + location.hash);
    }
  }, [user?.uid]);

  if (user === undefined) return <div style={{ height: '100%', background: 'var(--bg)' }} />;
  if (user === null) return <AuthScreen />;
  return <ESkyTellApp key={user.uid} />;
}

const DESTINATIONS = [
  { route: ROUTE_PHONE, label: 'تلفن', sel: mdiPhone, unsel: mdiPhoneOutline, testId: 'nav_phone' },
  { route: ROUTE_MESSAGES, label: 'پیامک', sel: mdiMessageText, unsel: mdiMessageTextOutline, testId: 'nav_messages' },
  { route: ROUTE_BRIDGE, label: 'پل بلوتوث', sel: mdiBluetoothConnect, unsel: mdiBluetooth, testId: 'nav_bridge' },
  { route: ROUTE_MORE, label: 'تنظیمات', sel: mdiTune, unsel: mdiTuneVariant, testId: 'nav_more' },
];

function ESkyTellApp() {
  const s = useStore();
  const [route, navigate] = useHashRoute();
  const [showGuide, setShowGuide] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdmin, setShowAdmin] = useState(() => /admin=payments/.test(location.hash));
  const [adminTab, setAdminTab] = useState(() => (/admin=payments/.test(location.hash) ? 3 : 0));
  const [adminTick, setAdminTick] = useState(0);
  const [wide, setWide] = useState(() => window.innerWidth >= 600);
  useEffect(() => { const f = () => setWide(window.innerWidth >= 600); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const unread = unreadSmsTotal(s);

  // Admin notification permission request (POST_NOTIFICATIONS equivalent) on first admin interaction
  useEffect(() => {
    if (!s.isAdmin || typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    const ask = () => { Notification.requestPermission().catch(() => {}); window.removeEventListener('pointerdown', ask); };
    window.addEventListener('pointerdown', ask, { once: true });
    return () => window.removeEventListener('pointerdown', ask);
  }, [s.isAdmin]);

  const sheets = (
    <>
      {showGuide && <IphoneGuideSheet onDismiss={() => setShowGuide(false)} />}
      {showPerms && <PermissionsManagerSheet summary={s.permissionSummary} onRequestAllPermitted={requestAllPermitted} onDismiss={() => setShowPerms(false)} />}
      {showHistory && <HistoryBottomSheet history={s.transferHistory} onDeleteEntry={actions.deleteHistory} onClearHistory={actions.clearHistory} onDismiss={() => setShowHistory(false)} />}
      {s.showPaywallSheet && <PaymentCheckoutSheet appConfig={s.appConfig} paymentState={s.payment} isSubscriptionActive={isSubscriptionActive(s)} onSubmit={actions.submitPaymentReceipt} onDismiss={actions.dismissPaywallSheet} />}
      <Snackbar message={s.snackbarMessage} onDone={actions.consumeSnackbar} />
    </>
  );

  if (showAdmin && s.isAdmin) {
    return <>{<AdminStudioScreen s={s} initialTab={adminTab} tabRequestTick={adminTick} onClose={() => { setShowAdmin(false); setAdminTab(0); }} />}{sheets}</>;
  }
  if (s.activeCall) {
    return (
      <>
        <ActiveBridgeCallOverlay activeCall={s.activeCall} simLabel={activeSimLabel(s)} onToggleMute={actions.toggleActiveCallMute} onToggleSpeaker={actions.toggleActiveCallSpeaker}
          onToggleBluetoothAudio={actions.toggleActiveCallBluetoothAudio} onLaunchSystemDialer={() => actions.placeSystemDialerCall(s.activeCall!.phoneNumber)} onEndCall={actions.endActiveBridgeCall} />
        <Snackbar message={s.snackbarMessage} onDone={actions.consumeSnackbar} />
      </>
    );
  }

  const openSmsWithNumber = (n: string) => { if (n.trim()) { actions.openSmsThread(n); navigate(ROUTE_MESSAGES); } };
  const navItems = DESTINATIONS.map((d) => {
    const selected = route === d.route;
    return (
      <button key={d.route} type="button" data-testid={d.testId} onClick={() => navigate(d.route)} class={`nav-item ${selected ? 'sel' : ''}`} aria-label={d.label}>
        <span class="nav-ind">
          <Icon path={selected ? d.sel : d.unsel} />
          {d.route === ROUTE_MESSAGES && unread > 0 && <span class="badge nav-badge">{unread}</span>}
        </span>
        <span class="nav-label ellipsis">{d.label}</span>
      </button>
    );
  });

  return (
    <div class="col" style={{ height: '100%' }}>
      <header class="row jcenter" style={{ height: 64, paddingTop: 'var(--sat)', boxSizing: 'content-box', background: 'var(--bg)', flex: 'none' }}>
        <span style={{ fontSize: 22, lineHeight: '28px', fontWeight: 700 }}>eSkyTell</span>
      </header>
      <div class="row grow" style={{ minHeight: 0, alignItems: 'stretch', paddingLeft: 'var(--sal)', paddingRight: 'var(--sar)' }}>
        {wide && <nav class="nav-rail col g12">{navItems}</nav>}
        <main class="grow" style={{ minWidth: 0, height: '100%' }}>
          {route === ROUTE_PHONE && <PhoneScreen s={s} onOpenSmsWithNumber={openSmsWithNumber} />}
          {route === ROUTE_MESSAGES && <MessagesScreen s={s} />}
          {route === ROUTE_BRIDGE && <BridgeHubScreen s={s} onOpenPermissionsSheet={() => setShowPerms(true)} onOpenIphoneGuide={() => setShowGuide(true)} onOpenHistorySheet={() => setShowHistory(true)} />}
          {route === ROUTE_MORE && <MoreAndAccountScreen s={s} onOpenAdminStudio={() => { setAdminTab(0); setAdminTick(adminTick + 1); setShowAdmin(true); }} onOpenPermissionsSheet={() => setShowPerms(true)} onOpenHistorySheet={() => setShowHistory(true)} onSignOut={() => { stopSession(); signOut(auth); if ((window as any).__ESKYTELL_MOCK_USER__) location.reload(); }} />}
        </main>
      </div>
      {!wide && <nav class="nav-bar row">{navItems}</nav>}
      {sheets}
    </div>
  );
}

/** allCompliantPermissions(): on web, only notifications (and the Contact Picker where supported) can be requested. */
async function requestAllPermitted() {
  try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission(); } catch { /* iOS non-PWA */ }
  const st = getState();
  actions.refreshBluetoothStatus();
  setState({
    permissionSummary: { ...st.permissionSummary, notificationsGranted: typeof Notification !== 'undefined' && Notification.permission === 'granted' },
  });
}
