// Port of ui/screens/BridgeHubScreen.kt
import {
  mdiBluetoothConnect, mdiBluetoothOff, mdiHistory, mdiShieldLock, mdiHelpCircleOutline, mdiAccessPoint, mdiClose,
  mdiLock, mdiRefresh, mdiWeatherNight, mdiSend, mdiBluetoothAudio, mdiBluetooth, mdiRadar, mdiCellphone, mdiAndroid,
  mdiLaptop, mdiDevices, mdiLinkVariant, mdiCheckCircle, mdiAlertCircleOutline,
} from '@mdi/js';
import { Button, Chip, Icon, IconButton, Switch, ProgressLinear, alpha } from '../ui/kit';
import { actions, activeBridgeDevice, allKnownDevices, type MainUiState } from '../data/store';
import { TRANSFER_MODES, TransferModeInfo, EXPORT_FORMATS, ExportFormatInfo, RelayDeviceRoleInfo, RelayTransportLabel, DevicePlatformLabel, type DiscoveredBluetoothDevice, type TransferMode, type TransferSessionState, type RelayDeviceRole } from '../data/models';
import heroImg from '../assets/img/img_eskytell_obsidian.jpg';
import emptyImg from '../assets/img/img_empty_devices.jpg';

function HeroPill({ icon, label, border, tint, onClick, testId }: { icon: string; label: string; border: string; tint: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} class="row g4"
      style={{ background: '#0A1613AA', border: `1px solid ${border}`, borderRadius: 999, padding: '6px 10px', color: '#fff', cursor: 'pointer' }}>
      <Icon path={icon} size={15} color={tint} />
      <span class="labelSmall">{label}</span>
    </button>
  );
}

export function BridgeHubScreen({ s, onOpenPermissionsSheet, onOpenIphoneGuide, onOpenHistorySheet }: {
  s: MainUiState; onOpenPermissionsSheet: () => void; onOpenIphoneGuide: () => void; onOpenHistorySheet: () => void;
}) {
  const devices = allKnownDevices(s);
  const isListening = s.transferState.kind === 'Listening';
  const perms = s.permissionSummary;
  const allGranted = perms.bluetoothGranted && perms.contactsGranted && perms.notificationsGranted;
  const ev = s.latestIncomingBridgeEvent;
  const connected = s.relayConnectionState.kind === 'Connected' ? s.relayConnectionState : null;
  const st = s.relayConnectionState;
  const relayText = st.kind === 'Connected' ? `متصل به ${st.deviceName} (${RelayTransportLabel[st.transport]})`
    : st.kind === 'Listening' ? `در حال انتظار اتصال (${RelayDeviceRoleInfo[st.role].labelFa})`
      : st.kind === 'Connecting' ? `در حال برقراری ارتباط با ${st.deviceName}...`
        : st.kind === 'Relaying' ? `در حال رله داده (${Math.trunc(st.progress * 100)}%)...`
          : st.kind === 'Error' ? st.message : RelayDeviceRoleInfo[s.relayDeviceRole].subtitleFa;

  return (
    <div class="col g14 scroll" style={{ height: '100%', maxWidth: 720, margin: '0 auto', padding: 16 }}>
      {/* 1. Hero */}
      <div class="card" style={{ border: `1px solid ${alpha('#00D4AA', 0.45)}`, overflow: 'hidden', position: 'relative', flex: 'none' }}>
        <img src={heroImg} alt="پل هوشمند eSkyTell" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 205, objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 205, background: 'linear-gradient(#06110E99, #09110FCC, var(--surface))' }} />
        <div class="col g10" style={{ position: 'relative', padding: 16 }}>
          <div class="row between g6 wrap">
            <div class="row g6" style={{ borderRadius: 999, padding: '6px 12px', background: !s.isBluetoothSupported ? '#8C1D18' : s.isBluetoothEnabled ? alpha('#10B981', 0.22) : alpha('#F4B860', 0.22) }}>
              <Icon path={s.isBluetoothEnabled ? mdiBluetoothConnect : mdiBluetoothOff} size={16} color={s.isBluetoothEnabled ? 'var(--emerald)' : 'var(--amber)'} />
              <span class="labelMedium" style={{ color: '#fff' }}>{!s.isBluetoothSupported ? 'بدون بلوتوث' : s.isBluetoothEnabled ? 'بلوتوث آماده' : 'بلوتوث خاموش'}</span>
            </div>
            <div class="row g6">
              <HeroPill icon={mdiHistory} label="تاریخچه" border={alpha('#F4B860', 0.55)} tint="var(--gold)" onClick={onOpenHistorySheet} testId="bridge_history_btn" />
              <HeroPill icon={mdiShieldLock} label="مجوزها" border={allGranted ? alpha('#10B981', 0.6) : alpha('#F4B860', 0.7)} tint={allGranted ? 'var(--emerald)' : 'var(--amber)'} onClick={onOpenPermissionsSheet} testId="bridge_permissions_btn" />
              <HeroPill icon={mdiHelpCircleOutline} label="راهنما" border={alpha('#00D4AA', 0.55)} tint="var(--mint)" onClick={onOpenIphoneGuide} testId="bridge_guide_btn" />
            </div>
          </div>
          <div style={{ height: 6 }} />
          <span class="headlineSmall" style={{ color: '#fff' }}>پل هوشمند eSkyTell</span>
          <span class="bodySmall" style={{ color: '#D5EBE5' }}>مدیریت اتصال دوطرفه با آیفون و گوشی دوم • {s.smsRecords.length} پیامک و {s.callRecords.length} تماس آماده همگام‌سازی</span>
          <button type="button" data-testid="bridge_receive_toggle_btn" onClick={() => actions.toggleReceiveServer()} class="btn row"
            style={{ minHeight: 48, height: 'auto', width: '100%', border: `1px solid ${isListening ? 'var(--emerald)' : 'var(--mint)'}`, background: isListening ? alpha('#10B981', 0.2) : '#0B181588', color: '#fff', padding: '8px 16px', whiteSpace: 'normal' }}>
            <Icon path={mdiAccessPoint} size={18} color={isListening ? 'var(--emerald)' : 'var(--mint)'} />
            <span style={{ textAlign: 'center' }}>{isListening ? 'پل زنده فعال است (لمس برای توقف)' : 'فعال‌سازی حالت آماده دریافت زنده (BLE + RFCOMM)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Incoming event */}
      {ev && (
        <div class="col g8" style={{ background: alpha('#10B981', 0.16), border: '1px solid var(--emerald)', borderRadius: 'var(--r-medium)', padding: 14 }}>
          <div class="row between">
            <span class="titleSmall bold">{ev.type === 'CALL_TRANSFER' ? `فرمان تماس دریافتی از ${ev.sourceDeviceName}` : ev.type === 'SMS_RELAY' ? `پیامک دریافتی از ${ev.sourceDeviceName}` : `مخاطب جدید از ${ev.sourceDeviceName}`}</span>
            <IconButton path={mdiClose} label="بستن" onClick={actions.dismissIncomingBridgeEvent} />
          </div>
          <span class="bodySmall">{ev.contactName} ({ev.phoneNumber}) {ev.messageBody.trim() ? `— ${ev.messageBody}` : ''}</span>
          {ev.phoneNumber.trim() && (
            <div class="row g8">
              <Button kind="tonal" onClick={() => actions.startBridgeCall(ev.phoneNumber, ev.contactName)}>تماس</Button>
              <Button kind="outlined" onClick={() => actions.openSystemSmsComposer(ev.phoneNumber, ev.messageBody)}>پاسخ پیامکی</Button>
            </div>
          )}
        </div>
      )}

      {/* 3. Transfer status */}
      {s.transferState.kind !== 'Idle' && <TransferStatusBanner state={s.transferState} />}

      {/* 4. Missing Bluetooth / permissions */}
      {(!s.isBluetoothSupported || !s.hasBluetoothPermissions || !s.isBluetoothEnabled || !allGranted) && (
        <div class="row between g10" style={{ background: 'var(--surface-variant)', border: `1px solid ${alpha('#F4B860', 0.55)}`, borderRadius: 'var(--r-medium)', padding: 14 }}>
          <div class="col g4 grow">
            <span class="titleSmall bold">{!s.isBluetoothSupported ? 'بلوتوث در این دستگاه پشتیبانی نمی‌شود' : !s.hasBluetoothPermissions ? 'تکمیل دسترسی‌های بلوتوث' : !s.isBluetoothEnabled ? 'بلوتوث خاموش است' : 'تکمیل مجوزهای مخاطبین و اعلان'}</span>
            <span class="bodySmall muted">برای اتصال پایدار به آیفون و دریافت اعلان تماس/پیامک، مجوزها و بلوتوث را فعال کنید.</span>
          </div>
          <Button testId="bridge_setup_action_btn" onClick={onOpenPermissionsSheet} style={{ padding: '0 16px' }}>
            {s.isBluetoothSupported && s.hasBluetoothPermissions && !s.isBluetoothEnabled ? 'روشن کردن' : 'تأیید مجوزها'}
          </Button>
        </div>
      )}

      {/* 4b. Role card */}
      <div class="card medium col g10" style={{ padding: 14, border: `1px solid ${connected ? alpha('#10B981', 0.7) : alpha('var(--outline)', 0.55)}` }}>
        <div class="row between">
          <div class="col grow">
            <span class="titleSmall bold">نقش دستگاه در رله داده</span>
            <span class="bodySmall" style={{ color: connected ? 'var(--emerald)' : 'var(--on-surface-variant)' }}>{relayText}</span>
          </div>
          {connected && <Button kind="outlined" testId="bridge_disconnect_peer_btn" onClick={actions.disconnectBridgePeer}>قطع</Button>}
        </div>
        <div class="row g8">
          {(['PRIMARY', 'SECONDARY'] as RelayDeviceRole[]).map((r) => (
            <Chip key={r} selected={s.relayDeviceRole === r} onClick={() => actions.setRelayDeviceRole(r)} style={{ flex: 1, justifyContent: 'center', height: 40 }}>{RelayDeviceRoleInfo[r].labelFa}</Chip>
          ))}
        </div>
      </div>

      {/* 5. Security + quiet hours */}
      <div class="card medium bordered col g10" style={{ padding: 14 }}>
        <div class="row between">
          <div class="row g8 grow">
            <Icon path={mdiLock} size={20} color="var(--mint)" />
            <div class="col">
              <span class="titleSmall bold">رمزنگاری بلوتوثی AES-256</span>
              <span class="labelSmall mono" style={{ color: 'var(--gold)' }}>پین جلسه: {s.pairingPin}</span>
            </div>
          </div>
          <div class="row">
            <IconButton path={mdiRefresh} label="تغییر پین" onClick={actions.regeneratePairingPin} />
            <Switch checked={s.encryptionEnabled} onChange={actions.setEncryptionEnabled} testId="bridge_encryption_switch" />
          </div>
        </div>
        {s.appConfig.enableQuietHours && (
          <div class="row between g8">
            <div class="row g8 grow">
              <Icon path={mdiWeatherNight} size={20} color="var(--gold)" />
              <div class="col">
                <span class="titleSmall bold">حالت سکوت پل (Quiet Hours)</span>
                <span class="bodySmall muted">عدم نمایش پاپ‌آپ اعلان‌های ورودی در زمان استراحت</span>
              </div>
            </div>
            <Switch checked={s.isQuietHoursEnabled} onChange={actions.toggleQuietHours} testId="bridge_quiet_hours_switch" />
          </div>
        )}
      </div>

      {/* 6. Modes & formats */}
      <div class="col g10">
        <div class="row between">
          <span class="titleMedium bold">پروتکل انتقال و خروجی</span>
          <Button kind="tonal" icon={mdiSend} testId="bridge_quick_export_btn" onClick={() => actions.sendViaStandardBluetoothExport()} style={{ padding: '0 16px' }}>اشتراک‌گذاری فوری</Button>
        </div>
        <div class="row g10 hscroll" style={{ alignItems: 'stretch' }}>
          {TRANSFER_MODES.map((m: TransferMode) => {
            const sel = s.transferMode === m;
            return (
              <button key={m} type="button" data-testid={`bridge_mode_${m}`} onClick={() => actions.setTransferMode(m)} class="col g4"
                style={{ width: 210, flex: 'none', textAlign: 'start', padding: 12, borderRadius: 'var(--r-medium)', cursor: 'pointer', background: sel ? alpha('var(--primary-container)', 0.65) : 'var(--surface)', border: `${sel ? 1.5 : 1}px solid ${sel ? 'var(--mint)' : alpha('var(--outline)', 0.55)}` }}>
                <span class="labelLarge bold" style={{ color: sel ? 'var(--mint)' : 'var(--on-surface)' }}>{TransferModeInfo[m].titleFa}</span>
                <span class="bodySmall muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{TransferModeInfo[m].subtitleFa}</span>
              </button>
            );
          })}
        </div>
        {s.transferMode === 'CROSS_PLATFORM_OPP' && (
          <div class="row g8 hscroll">
            {EXPORT_FORMATS.map((f) => <Chip key={f} selected={s.exportFormat === f} onClick={() => actions.setExportFormat(f)}>{ExportFormatInfo[f].titleFa}</Chip>)}
          </div>
        )}
      </div>

      {/* 7. Devices header */}
      <div class="row between">
        <div class="col">
          <span class="titleMedium bold">آیفون‌ها و دستگاه‌های بلوتوثی</span>
          <span class="bodySmall muted">{s.isScanning ? 'در حال اسکن بلوتوث...' : `${devices.length} دستگاه در دسترس`}</span>
        </div>
        <Button kind="tonal" icon={s.isScanning ? mdiClose : mdiBluetoothAudio} disabled={!s.isBluetoothSupported} testId="bridge_scan_btn" onClick={actions.toggleScan} style={{ padding: '0 16px' }}>
          {s.isScanning ? 'توقف اسکن' : 'جستجو'}
        </Button>
      </div>

      {/* 8. Devices */}
      {devices.length === 0 ? (
        <div class="card bordered col acenter g10" style={{ padding: 18 }}>
          <img src={emptyImg} alt="رادار اسکن بلوتوث" style={{ width: '100%', height: 145, objectFit: 'cover', borderRadius: 'var(--r-medium)' }} />
          <Icon path={s.isScanning ? mdiRadar : mdiBluetooth} color="var(--mint)" />
          <span class="titleSmall bold">{s.isScanning ? 'در حال جستجوی آیفون و گوشی‌های نزدیک...' : 'دستگاهی شناسایی نشده است'}</span>
          <span class="bodySmall muted center">بلوتوث آیفون یا گوشی دوم خود را روشن کنید و دکمه «جستجو» را بزنید.</span>
        </div>
      ) : devices.map((d) => {
        const isActive = activeBridgeDevice(s)?.address === d.address;
        const isConn = (connected?.address === d.address) || d.isConnected;
        return <BridgeDeviceCard key={d.address} d={d} isActive={isActive} isConn={isConn} mode={s.transferMode} />;
      })}
      <div style={{ minHeight: 16 }} />
    </div>
  );
}

function BridgeDeviceCard({ d, isActive, isConn, mode }: { d: DiscoveredBluetoothDevice; isActive: boolean; isConn: boolean; mode: TransferMode }) {
  const icon = d.platform === 'IPHONE' ? mdiCellphone : d.platform === 'ANDROID' ? mdiAndroid : d.platform === 'COMPUTER' ? mdiLaptop : mdiDevices;
  const tint = isConn ? 'var(--emerald)' : isActive ? 'var(--mint)' : 'var(--primary)';
  return (
    <div class="card medium row between g6" data-testid={`device_card_${d.address}`} onClick={() => actions.selectBridgeSource(d.address)}
      style={{ padding: 14, cursor: 'pointer', border: `${isActive || isConn ? 1.5 : 1}px solid ${isConn ? 'var(--emerald)' : isActive ? 'var(--mint)' : alpha('var(--outline)', 0.55)}` }}>
      <div class="row grow">
        <div class="row jcenter" style={{ width: 44, height: 44, borderRadius: '50%', flex: 'none', background: isConn ? alpha('#10B981', 0.2) : isActive ? alpha('#00D4AA', 0.2) : d.platform === 'IPHONE' ? 'var(--primary-container)' : 'var(--surface-variant)' }}>
          <Icon path={icon} color={tint} />
        </div>
        <div class="col g2" style={{ marginInlineStart: 12, minWidth: 0 }}>
          <div class="row g6"><span class="titleSmall bold ellipsis">{d.name}</span>{isActive && <span class="labelSmall" style={{ background: alpha('#00D4AA', 0.18), color: 'var(--mint)', borderRadius: 999, padding: '1px 7px' }}>فعال</span>}</div>
          <div class="row g6 wrap">
            <span class="labelSmall" style={{ color: 'var(--gold)' }}>{DevicePlatformLabel[d.platform]}</span>
            {isConn ? <span class="labelSmall" style={{ color: 'var(--emerald)' }}>• متصل</span> : d.isPaired ? <span class="labelSmall" style={{ color: 'var(--emerald)' }}>• جفت‌شده</span> : null}
            {d.rssi != null && <span class="labelSmall mono muted">• {d.rssi} dBm</span>}
          </div>
        </div>
      </div>
      <div class="row g6" onClick={(e) => e.stopPropagation()}>
        {!d.isPaired && <IconButton path={mdiLinkVariant} label="جفت‌سازی" color="var(--gold)" onClick={() => actions.pairDevice(d)} />}
        <Button kind="outlined" testId={`connect_to_${d.address}`} onClick={() => (isConn ? actions.disconnectBridgePeer() : actions.connectToDevice(d))} style={{ padding: '0 14px' }}>{isConn ? 'قطع' : 'اتصال'}</Button>
        <Button kind="tonal" testId={`send_to_${d.address}`} onClick={() => actions.sendToDevice(d)} style={{ padding: '0 14px' }}>{mode === 'BLE_GATT_BRIDGE' ? 'ارسال BLE' : mode === 'DIRECT_RFCOMM' ? 'ارسال مستقیم' : 'ارسال فایل'}</Button>
      </div>
    </div>
  );
}

function TransferStatusBanner({ state }: { state: TransferSessionState }) {
  const bg = state.kind === 'Success' ? alpha('#10B981', 0.16) : state.kind === 'Error' ? '#8C1D18' : alpha('var(--primary-container)', 0.65);
  const text = state.kind === 'Listening' ? `پل زنده روی «${state.deviceName}» آماده دریافت...`
    : state.kind === 'Connecting' ? `در حال اتصال به ${state.targetName}...`
      : state.kind === 'Transferring' ? `انتقال به ${state.targetName} (${Math.trunc(state.progress * 100)}%)`
        : state.kind === 'Success' || state.kind === 'Error' ? state.message : '';
  return (
    <div class="col g8" style={{ background: bg, borderRadius: 'var(--r-medium)', padding: 14 }}>
      <div class="row between">
        <div class="row g8 grow">
          <Icon path={state.kind === 'Success' ? mdiCheckCircle : state.kind === 'Error' ? mdiAlertCircleOutline : mdiBluetoothConnect} color={state.kind === 'Success' ? 'var(--emerald)' : state.kind === 'Error' ? 'var(--error)' : 'var(--mint)'} />
          <span class="bodyMedium">{text}</span>
        </div>
        {state.kind === 'Listening' ? <Button kind="text" onClick={actions.toggleReceiveServer}>توقف</Button>
          : state.kind === 'Success' || state.kind === 'Error' ? <IconButton path={mdiClose} label="بستن" onClick={actions.clearTransferBanner} /> : null}
      </div>
      {(state.kind === 'Listening' || state.kind === 'Connecting' || state.kind === 'Transferring') && <ProgressLinear />}
    </div>
  );
}
