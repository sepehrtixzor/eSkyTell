// Web replacement for the Room TransferDatabase (data/local/*). Persists to localStorage on this device
// (same scope as Room: device-local, not synced to the cloud).
import type { SmsRecordEntity, CallRecordEntity, ContactEntity, TransferHistoryEntity } from './models';

interface Tables {
  sms_records: SmsRecordEntity[];
  call_records: CallRecordEntity[];
  contacts: ContactEntity[];
  transfer_history: TransferHistoryEntity[];
  seq: number;
}
const KEY = 'eskytell.transfer_db.v1';

function load(): Tables {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const t = JSON.parse(raw);
      return { sms_records: [], call_records: [], contacts: [], transfer_history: [], seq: 1, ...t };
    }
  } catch { /* ignore */ }
  return { sms_records: [], call_records: [], contacts: [], transfer_history: [], seq: 1 };
}

let db: Tables = load();
const listeners = new Set<() => void>();
function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* quota */ }
  listeners.forEach((l) => l());
}
const nextId = () => db.seq++;

export const dao = {
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  // Observations with the same ORDER BY as TransferDao
  smsRecords: (): SmsRecordEntity[] => [...db.sms_records].sort((a, b) => b.timestampMillis - a.timestampMillis),
  callRecords: (): CallRecordEntity[] => [...db.call_records].sort((a, b) => b.timestampMillis - a.timestampMillis),
  contacts: (): ContactEntity[] =>
    [...db.contacts].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.displayName.localeCompare(b.displayName)),
  transferHistory: (): TransferHistoryEntity[] => [...db.transfer_history].sort((a, b) => b.timestampMillis - a.timestampMillis),

  insertSmsList(records: Omit<SmsRecordEntity, 'id'>[]) {
    records.forEach((r) => db.sms_records.push({ ...r, id: nextId() }));
    commit();
  },
  markThreadRead(phone: string) {
    db.sms_records.forEach((s) => { if (s.phoneNumber === phone) s.isRead = true; });
    commit();
  },
  insertCallList(records: Omit<CallRecordEntity, 'id'>[]) {
    records.forEach((r) => db.call_records.push({ ...r, id: nextId() }));
    commit();
  },
  insertContacts(list: Omit<ContactEntity, 'id'>[]) {
    list.forEach((c) => db.contacts.push({ ...c, id: nextId() }));
    commit();
  },
  updateContact(c: ContactEntity) {
    const i = db.contacts.findIndex((x) => x.id === c.id);
    if (i >= 0) db.contacts[i] = c; else db.contacts.push(c);
    commit();
  },
  findContactByPhone: (phone: string) => db.contacts.find((c) => c.phoneNumber === phone) ?? null,
  setContactFavorite(id: number, fav: boolean) {
    db.contacts.forEach((c) => { if (c.id === id) c.isFavorite = fav; });
    commit();
  },
  setContactSyncedToSystem(id: number, synced: boolean) {
    db.contacts.forEach((c) => { if (c.id === id) c.syncedToSystem = synced; });
    commit();
  },
  deleteContact(id: number) { db.contacts = db.contacts.filter((c) => c.id !== id); commit(); },
  insertHistory(e: Omit<TransferHistoryEntity, 'id' | 'timestampMillis'> & { timestampMillis?: number }) {
    db.transfer_history.push({ timestampMillis: Date.now(), ...e, id: nextId() });
    commit();
  },
  deleteSmsThread(phone: string) { db.sms_records = db.sms_records.filter((s) => s.phoneNumber !== phone); commit(); },
  deleteCall(id: number) { db.call_records = db.call_records.filter((c) => c.id !== id); commit(); },
  deleteHistory(id: number) { db.transfer_history = db.transfer_history.filter((h) => h.id !== id); commit(); },
  clearAllHistory() { db.transfer_history = []; commit(); },
};
