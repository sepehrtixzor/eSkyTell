// Port of ui/screens/PhoneScreen.kt
import { useState } from 'preact/hooks';
import {
  mdiBluetoothConnect, mdiSimOutline, mdiAccountPlus, mdiMessageText, mdiPhone, mdiBackspace, mdiDialpad, mdiPlus,
  mdiPhoneIncoming, mdiPhoneOutgoing, mdiPhoneMissed, mdiDeleteOutline, mdiContacts, mdiBluetooth, mdiMagnify,
  mdiStar, mdiStarOutline, mdiTrayArrowDown, mdiPencil,
} from '@mdi/js';
import { Button, Chip, Icon, IconButton, TextField, alpha, fmtDate, useLongPress } from '../ui/kit';
import { AddCallDialog, AddEditContactDialog } from '../components/TransferDialogs';
import { actions, activeBridgeDevice, sim1DisplayLabel, sim2DisplayLabel, type MainUiState } from '../data/store';
import type { CallRecordEntity, ContactEntity } from '../data/models';
import { CallDirectionLabel } from '../data/models';

function SimPillChip({ selected, label, onClick, testId }: { selected: boolean; label: string; onClick: () => void; testId: string }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick} class="row g4"
      style={{ borderRadius: 999, padding: '5px 10px', cursor: 'pointer', background: selected ? alpha('#F4B860', 0.2) : 'var(--surface)', border: `1px solid ${selected ? 'var(--gold)' : alpha('var(--outline)', 0.5)}`, color: selected ? 'var(--gold)' : 'var(--on-surface-variant)', minWidth: 0, flexShrink: 1 }}>
      <Icon path={mdiSimOutline} size={13} />
      <span class="labelSmall ellipsis" style={{ fontWeight: selected ? 700 : 500 }}>{label}</span>
    </button>
  );
}

export function PhoneScreen({ s, onOpenSmsWithNumber }: { s: MainUiState; onOpenSmsWithNumber: (n: string) => void }) {
  const [tab, setTab] = useState(0);
  const [showAddCall, setShowAddCall] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [prefill, setPrefill] = useState('');
  const [editing, setEditing] = useState<ContactEntity | null>(null);
  const bridge = activeBridgeDevice(s);

  return (
    <div class="col g10" style={{ height: '100%', maxWidth: 680, margin: '0 auto', padding: '0 16px' }}>
      <div class="row between g6" style={{ paddingTop: 6 }}>
        {s.appConfig.enableDualSim ? (
          <div class="row g6" style={{ minWidth: 0 }}>
            <SimPillChip selected={s.activeSimSlot === 1} label={sim1DisplayLabel(s)} onClick={() => actions.selectSimSlot(1)} testId="sim_1_chip" />
            <SimPillChip selected={s.activeSimSlot === 2} label={sim2DisplayLabel(s)} onClick={() => actions.selectSimSlot(2)} testId="sim_2_chip" />
          </div>
        ) : <span />}
        <div class="row g4" style={{ borderRadius: 999, padding: '5px 10px', background: bridge ? alpha('#10B981', 0.14) : 'var(--surface-variant)', minWidth: 0, flexShrink: 0, maxWidth: '45%' }}>
          <Icon path={mdiBluetoothConnect} size={14} color={bridge ? 'var(--emerald)' : 'var(--on-surface-variant)'} />
          <span class="labelSmall ellipsis">{bridge?.name ?? 'بدون پل متصل'}</span>
        </div>
      </div>

      <div class="row g4" style={{ background: alpha('var(--surface-variant)', 0.7), border: `1px solid ${alpha('var(--outline)', 0.5)}`, borderRadius: 999, padding: 4 }}>
        {[[0, 'شماره‌گیر', 'phone_subtab_keypad'], [1, 'تماس‌های اخیر', 'phone_subtab_recents'], [2, 'مخاطبین', 'phone_subtab_contacts']].map(([idx, title, tag]) => {
          const active = tab === idx;
          return (
            <button key={tag} type="button" data-testid={tag} onClick={() => setTab(idx as number)} class="grow labelLarge ellipsis"
              style={{ height: 42, borderRadius: 999, border: 'none', cursor: 'pointer', background: active ? 'var(--primary)' : 'transparent', color: active ? 'var(--on-primary)' : 'var(--on-surface-variant)', fontWeight: active ? 700 : 500, padding: '0 6px' }}>
              {title}
            </button>
          );
        })}
      </div>

      <div class="grow" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 0 && <KeypadPane s={s} onAddToContacts={() => { setPrefill(s.dialerNumber); setShowAddContact(true); }} onQuickSms={() => onOpenSmsWithNumber(s.dialerNumber)} />}
        {tab === 1 && <RecentsPane calls={s.callRecords} onAddCall={() => setShowAddCall(true)} onSms={(c) => onOpenSmsWithNumber(c.phoneNumber)} onSaveContact={(c) => { setPrefill(c.phoneNumber); setShowAddContact(true); }} />}
        {tab === 2 && <ContactsPane s={s} onAdd={() => { setPrefill(''); setShowAddContact(true); }} onSms={(c) => onOpenSmsWithNumber(c.phoneNumber)} onEdit={setEditing} />}
      </div>

      {showAddCall && <AddCallDialog onDismiss={() => setShowAddCall(false)} onConfirm={actions.addManualCall} />}
      {showAddContact && <AddEditContactDialog initialPhone={prefill} onDismiss={() => setShowAddContact(false)} onConfirm={actions.saveContact} />}
      {editing && <AddEditContactDialog initialContact={editing} onDismiss={() => setEditing(null)} onConfirm={actions.saveContact} />}
    </div>
  );
}

const KEYS: [string, string][][] = [
  [['1', ' '], ['2', 'ABC'], ['3', 'DEF']],
  [['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO']],
  [['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ']],
  [['*', ''], ['0', '+'], ['#', '']],
];

function KeypadKey({ digit, sub }: { digit: string; sub: string }) {
  const lp = useLongPress(() => actions.appendDialerDigit(digit), () => { if (digit === '0') actions.appendDialerDigit('+'); });
  return (
    <button type="button" data-testid={`keypad_${digit}`} {...lp} class="col jcenter acenter"
      style={{ width: 74, height: 74, borderRadius: '50%', background: alpha('var(--surface-variant)', 0.8), border: `1px solid ${alpha('var(--outline)', 0.45)}`, color: 'var(--on-surface)', cursor: 'pointer', padding: 0, touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <span class="mono" style={{ fontSize: 26, lineHeight: '30px', fontWeight: 500 }}>{digit}</span>
      {sub.trim() && <span class="mono muted" style={{ fontSize: 10, lineHeight: '12px' }}>{sub}</span>}
    </button>
  );
}

function KeypadPane({ s, onAddToContacts, onQuickSms }: { s: MainUiState; onAddToContacts: () => void; onQuickSms: () => void }) {
  const n = s.dialerNumber; const has = !!n.trim();
  const back = useLongPress(() => has && actions.backspaceDialer(), () => has && actions.clearDialer());
  return (
    <div class="col acenter scroll" style={{ height: '100%', padding: '8px 0', justifyContent: 'space-evenly', gap: 8 }}>
      <div class="col acenter g6 full">
        <div class="ltr center ellipsis" style={{ padding: '0 16px', maxWidth: '100%', color: n ? 'var(--on-bg)' : 'var(--on-surface-variant)' }}>
          {n ? <span class="mono" style={{ fontSize: n.length > 13 ? 24 : 32, lineHeight: '40px', fontWeight: 700 }}>{n}</span>
            : <span class="titleMedium" dir="rtl">شماره را وارد کنید</span>}
        </div>
        {has ? <Button kind="text" icon={mdiAccountPlus} testId="dialer_add_contact_btn" onClick={onAddToContacts}>افزودن به مخاطبین</Button> : <div style={{ height: 36 }} />}
      </div>
      <div class="col acenter g12" dir="ltr">
        {KEYS.map((row, i) => <div key={i} class="row g20">{row.map(([d, sub]) => <KeypadKey key={d} digit={d} sub={sub} />)}</div>)}
      </div>
      <div style={{ height: 10 }} />
      <div class="row g18" style={{ paddingBottom: 12 }}>
        <IconButton path={mdiMessageText} label="ارسال پیامک به این شماره" disabled={!has} onClick={onQuickSms} color={has ? 'var(--gold)' : alpha('var(--on-surface-variant)', 0.4)} style={{ width: 54, height: 54 }} />
        <button type="button" data-testid="dialer_bridge_call_btn" aria-label="برقراری تماس با پل eSkyTell" disabled={!has} onClick={() => actions.startBridgeCall(n, '')}
          style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', background: has ? 'var(--emerald)' : alpha('var(--on-surface)', 0.12), color: has ? '#02241A' : alpha('var(--on-surface)', 0.38), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon path={mdiPhone} size={30} />
        </button>
        <button type="button" data-testid="dialer_backspace_btn" aria-label="پاک کردن رقم" {...back}
          style={{ width: 54, height: 54, borderRadius: '50%', border: 'none', background: 'transparent', color: has ? 'var(--on-surface)' : alpha('var(--on-surface-variant)', 0.4), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transform: 'scaleX(-1)' }}>
          <Icon path={mdiBackspace} />
        </button>
      </div>
      {has && <Button kind="outlined" icon={mdiDialpad} testId="dialer_native_call_btn" onClick={() => actions.placeSystemDialerCall(n)}>شماره‌گیری مستقیم از سیم‌کارت گوشی</Button>}
    </div>
  );
}

function EmptyCard({ icon, title, body, padding = 28 }: { icon?: string; title: string; body: string; padding?: number }) {
  return (
    <div class="card col acenter g8" style={{ padding }}>
      {icon && <Icon path={icon} size={34} color="var(--mint)" />}
      <span class="titleSmall bold">{title}</span>
      <span class="bodySmall muted center">{body}</span>
    </div>
  );
}

function RecentsPane({ calls, onAddCall, onSms, onSaveContact }: { calls: CallRecordEntity[]; onAddCall: () => void; onSms: (c: CallRecordEntity) => void; onSaveContact: (c: CallRecordEntity) => void }) {
  const [missedOnly, setMissedOnly] = useState(false);
  const filtered = missedOnly ? calls.filter((c) => c.direction === 'MISSED') : calls;
  return (
    <div class="col g10 scroll" style={{ height: '100%', padding: '8px 0' }}>
      <div class="row between g8">
        <div class="row g8">
          <Chip selected={!missedOnly} onClick={() => setMissedOnly(false)}>همه تماس‌ها</Chip>
          <Chip selected={missedOnly} onClick={() => setMissedOnly(true)}>بی‌پاسخ</Chip>
        </div>
        <Button kind="tonal" icon={mdiPlus} testId="recents_add_call_btn" onClick={onAddCall} style={{ padding: '0 16px' }}>ثبت تماس</Button>
      </div>
      {filtered.length === 0 ? (
        <EmptyCard icon={mdiPhone} title="تماسی ثبت نشده است" body="تماس‌های گرفته‌شده از شماره‌گیر، ورودی‌های بلوتوثی یا فایل‌های پشتیبان اینجا نمایش داده می‌شوند." />
      ) : filtered.map((c) => {
        const dir = (['INCOMING', 'OUTGOING', 'MISSED', 'REJECTED'].includes(c.direction) ? c.direction : 'INCOMING') as string;
        const color = dir === 'INCOMING' ? 'var(--emerald)' : dir === 'OUTGOING' ? 'var(--mint)' : dir === 'MISSED' ? 'var(--rose)' : 'var(--amber)';
        const icon = dir === 'INCOMING' ? mdiPhoneIncoming : dir === 'OUTGOING' ? mdiPhoneOutgoing : mdiPhoneMissed;
        return (
          <div key={c.id} class="card bordered medium row" style={{ padding: '14px 8px 14px 4px', paddingInlineStart: 14, cursor: 'pointer' }} onClick={() => actions.startBridgeCall(c.phoneNumber, c.contactName)}>
            <Icon path={icon} color={color} />
            <div class="col g2 grow" style={{ marginInlineStart: 12 }}>
              <div class="row g6" style={{ minWidth: 0 }}>
                <span class="titleSmall bold ellipsis" style={{ color: dir === 'MISSED' ? 'var(--rose)' : 'var(--on-surface)' }}>{c.contactName}</span>
                <span class="labelSmall" style={{ background: alpha('#F4B860', 0.16), color: 'var(--gold)', borderRadius: 999, padding: '1px 6px', flex: 'none' }}>SIM {c.simSlot}</span>
              </div>
              <span class="labelSmall mono muted ellipsis">{c.phoneNumber} • {CallDirectionLabel[dir]} • {fmtDate(c.timestampMillis, 'MM/dd HH:mm')}</span>
            </div>
            <div class="row" onClick={(e) => e.stopPropagation()}>
              <IconButton path={mdiMessageText} label="پیامک" color="var(--gold)" onClick={() => onSms(c)} style={{ width: 40 }} />
              <IconButton path={mdiPhone} label="شماره‌گیر گوشی" color="var(--mint)" onClick={() => actions.placeSystemDialerCall(c.phoneNumber)} style={{ width: 40 }} />
              <IconButton path={mdiAccountPlus} label="ذخیره مخاطب" onClick={() => onSaveContact(c)} style={{ width: 40 }} />
              <IconButton path={mdiDeleteOutline} label="حذف" onClick={() => actions.deleteCall(c.id)} style={{ width: 40 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContactsPane({ s, onAdd, onSms, onEdit }: { s: MainUiState; onAdd: () => void; onSms: (c: ContactEntity) => void; onEdit: (c: ContactEntity) => void }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = s.contacts.filter((c) => !q || c.displayName.toLowerCase().includes(q) || c.phoneNumber.includes(q));
  const granted = s.permissionSummary.contactsGranted;
  return (
    <div class="col g10 scroll" style={{ height: '100%', padding: '8px 0' }}>
      <div class="row wrap g8">
        <Button kind="tonal" icon={mdiAccountPlus} testId="contacts_add_btn" onClick={onAdd}>مخاطب جدید</Button>
        <Button kind="outlined" icon={mdiContacts} testId="contacts_import_phone_btn" onClick={() => actions.importContactsFromPhone()}>{granted ? 'همگام‌سازی دفترچه' : 'تأیید دسترسی مخاطبین'}</Button>
        {s.contacts.length > 0 && <Button kind="outlined" icon={mdiBluetooth} testId="contacts_share_vcard_btn" onClick={() => actions.shareContactsViaBluetooth(filtered)}>ارسال vCard</Button>}
      </div>
      <TextField value={search} onInput={setSearch} leading={mdiMagnify} placeholder="جستجو در نام یا شماره..." testId="contacts_search_field" />
      {filtered.length === 0 ? (
        <div class="card col astart g8" style={{ padding: 24 }}>
          <span class="titleSmall bold">مخاطبی یافت نشد</span>
          <span class="bodySmall muted">مخاطبین گوشی خود را همگام‌سازی کنید یا مخاطب جدید بسازید.</span>
        </div>
      ) : filtered.map((c) => (
        <div key={c.id} class="card bordered medium col g6" style={{ padding: 12 }}>
          <div class="row between">
            <div class="row grow">
              <div class="row jcenter" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-container)', flex: 'none' }}>
                <span class="titleSmall bold" style={{ color: 'var(--primary)' }}>{c.displayName.slice(0, 1).toUpperCase()}</span>
              </div>
              <div class="col" style={{ marginInlineStart: 10, minWidth: 0 }}>
                <span class="titleSmall bold ellipsis">{c.displayName}</span>
                <span class="bodySmall mono muted ltr" style={{ textAlign: 'right' }}>{c.phoneNumber}</span>
              </div>
            </div>
            <IconButton path={c.isFavorite ? mdiStar : mdiStarOutline} label="برگزیده" color={c.isFavorite ? 'var(--amber)' : 'var(--on-surface-variant)'} onClick={() => actions.toggleContactFavorite(c.id, !c.isFavorite)} />
          </div>
          <div class="row between">
            <div class="row">
              <IconButton path={mdiPhone} label="تماس" color="var(--emerald)" onClick={() => actions.startBridgeCall(c.phoneNumber, c.displayName)} />
              <IconButton path={mdiMessageText} label="پیامک" color="var(--mint)" onClick={() => onSms(c)} />
              <IconButton path={mdiTrayArrowDown} label="ذخیره در گوشی" color="var(--gold)" onClick={() => actions.exportContactToPhone(c)} />
            </div>
            <div class="row">
              <IconButton path={mdiPencil} label="ویرایش" onClick={() => onEdit(c)} />
              <IconButton path={mdiDeleteOutline} label="حذف" onClick={() => actions.deleteContact(c.id)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
