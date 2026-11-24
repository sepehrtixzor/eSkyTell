// Port of ui/screens/MessagesScreen.kt
import { useEffect, useRef, useState } from 'preact/hooks';
import { mdiMessagePlus, mdiMagnify, mdiFileImport, mdiContentPaste, mdiMessageText, mdiDeleteOutline, mdiArrowRight, mdiPhone, mdiSimOutline, mdiSend } from '@mdi/js';
import { Button, Icon, IconButton, alpha, fmtDate } from '../ui/kit';
import { AddSmsDialog, ComposeSmsDialog, PasteTextDialog } from '../components/TransferDialogs';
import { actions, activeSimLabel, selectedThreadMessages, smsThreads, type MainUiState } from '../data/store';
import type { SmsThreadSummary } from '../data/models';

const QUICK_TEMPLATES = ['الان تماس می‌گیرم', 'لطفاً پیام بدید', 'در جلسه هستم', 'تأیید شد، ممنون'];

export function MessagesScreen({ s }: { s: MainUiState }) {
  const threads = smsThreads(s);
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [compose, setCompose] = useState(false);
  const [addManual, setAddManual] = useState(false);
  const [paste, setPaste] = useState(false);
  const selected = s.selectedSmsThreadPhone;

  // BackHandler equivalent: browser back closes the thread
  useEffect(() => {
    if (!selected) return;
    history.pushState({ thread: selected }, '');
    const onPop = () => actions.closeSmsThread();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [selected]);

  if (selected) {
    const summary = threads.find((t) => t.phoneNumber === selected);
    const name = summary?.displayName ?? selected;
    return <ConversationDetailPane s={s} phone={selected} displayName={name} onBack={() => history.back()} />;
  }

  const q = search.trim().toLowerCase();
  const filtered = threads.filter((t) => !q || t.displayName.toLowerCase().includes(q) || t.phoneNumber.includes(q) || t.lastMessage.toLowerCase().includes(q));

  return (
    <div class="col g10 scroll" style={{ height: '100%', maxWidth: 680, margin: '0 auto', padding: 16 }}>
      <div class="row between">
        <div class="col">
          <span class="headlineSmall">پیامک‌ها</span>
          <span class="bodySmall muted">{threads.length} گفتگو • {activeSimLabel(s)}</span>
        </div>
        <Button kind="tonal" icon={mdiMessagePlus} testId="messages_compose_btn" onClick={() => setCompose(true)}>پیام جدید</Button>
      </div>
      <div class="tf has-lead filled" style={{ '--r': '999px' } as any}>
        <input value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} placeholder="جستجو در گفتگوها و متن پیامک..." data-testid="messages_search_input" style={{ borderRadius: 999 }} />
        <span class="lead"><Icon path={mdiMagnify} /></span>
      </div>
      <div class="row wrap g8">
        <Button kind="outlined" icon={mdiFileImport} testId="messages_import_file_btn" onClick={() => fileRef.current?.click()}>ورود فایل (XML/CSV/JSON)</Button>
        <Button kind="outlined" icon={mdiContentPaste} testId="messages_paste_btn" onClick={() => setPaste(true)}>چسباندن متن</Button>
        <Button kind="outlined" icon={mdiMessageText} testId="messages_add_manual_btn" onClick={() => setAddManual(true)}>ثبت پیامک دریافتی</Button>
        <input ref={fileRef} type="file" hidden accept=".xml,.json,.csv,.vcf,.txt,text/xml,application/xml,application/json,text/csv,text/vcard,text/x-vcard,text/plain"
          onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) actions.importBackupFile(f); (e.target as HTMLInputElement).value = ''; }} />
      </div>
      {filtered.length === 0 ? (
        <div class="card col acenter g10" style={{ padding: 28 }}>
          <Icon path={mdiMessageText} size={44} color="var(--mint)" />
          <span class="titleSmall bold">صندوق پیامک خالی است</span>
          <span class="bodySmall muted">برای شروع یک «پیام جدید» بنویسید، فایل پشتیبان پیامک‌ها را وارد کنید یا پیام‌ها را از پل بلوتوث دریافت نمایید.</span>
        </div>
      ) : filtered.map((t) => <SmsThreadRowCard key={t.phoneNumber} t={t} />)}
      <div style={{ minHeight: 16 }} />

      {compose && <ComposeSmsDialog contacts={s.contacts} activeSimLabel={activeSimLabel(s)} onDismiss={() => setCompose(false)} onSend={(p, n, b) => actions.sendBridgeSms(p, n, b)} />}
      {addManual && <AddSmsDialog onDismiss={() => setAddManual(false)} onConfirm={actions.addManualSms} />}
      {paste && <PasteTextDialog onDismiss={() => setPaste(false)} onConfirm={(t) => actions.importPastedOrSharedText(t)} />}
    </div>
  );
}

function SmsThreadRowCard({ t }: { t: SmsThreadSummary }) {
  const unread = t.unreadCount > 0;
  return (
    <div class="card medium row" data-testid={`sms_thread_${t.phoneNumber}`} onClick={() => actions.openSmsThread(t.phoneNumber)}
      style={{ padding: 14, paddingInlineEnd: 4, cursor: 'pointer', border: `1px solid ${unread ? alpha('#00D4AA', 0.65) : alpha('var(--outline)', 0.5)}` }}>
      <div style={{ position: 'relative', flex: 'none' }}>
        <div class="row jcenter" style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--primary-container)' }}>
          <span class="titleMedium bold" style={{ color: 'var(--primary)' }}>{t.displayName.slice(0, 1).toUpperCase()}</span>
        </div>
        {unread && <span style={{ position: 'absolute', top: 0, insetInlineEnd: 0, width: 12, height: 12, borderRadius: '50%', background: 'var(--mint)' }} />}
      </div>
      <div class="col g2 grow" style={{ marginInlineStart: 12 }}>
        <div class="row between g6">
          <span class="titleSmall bold ellipsis grow">{t.displayName}</span>
          <span class="labelSmall mono muted">{fmtDate(t.lastTimestampMillis, 'HH:mm')}</span>
        </div>
        <span class="bodySmall muted" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.lastMessage}</span>
        <div class="row g6">
          <span class="labelSmall" style={{ background: alpha('#F4B860', 0.16), color: 'var(--gold)', borderRadius: 999, padding: '1px 7px' }}>SIM {t.simSlot}</span>
          <span class="labelSmall muted">{t.messageCount} پیام</span>
          {unread && <span class="labelSmall bold" style={{ background: alpha('#00D4AA', 0.2), color: 'var(--mint)', borderRadius: 999, padding: '1px 7px' }}>{t.unreadCount} جدید</span>}
        </div>
      </div>
      <span onClick={(e) => e.stopPropagation()}><IconButton path={mdiDeleteOutline} label="حذف گفتگو" onClick={() => actions.deleteSmsThread(t.phoneNumber)} /></span>
    </div>
  );
}

function ConversationDetailPane({ s, phone, displayName, onBack }: { s: MainUiState; phone: string; displayName: string; onBack: () => void }) {
  const [draft, setDraft] = useState('');
  const messages = selectedThreadMessages(s);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages.length]);
  const send = () => { const t = draft.trim(); if (t) { actions.sendBridgeSms(phone, displayName, t); setDraft(''); } };
  return (
    <div class="col" style={{ height: '100%', maxWidth: 680, margin: '0 auto' }}>
      <div class="row between" style={{ background: 'var(--surface)', border: `1px solid ${alpha('var(--outline)', 0.45)}`, padding: '10px 8px' }}>
        <div class="row grow">
          <IconButton path={mdiArrowRight} label="بازگشت" onClick={onBack} />
          <div class="row jcenter" style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--primary-container)', flex: 'none' }}>
            <span class="titleSmall bold" style={{ color: 'var(--primary)' }}>{displayName.slice(0, 1).toUpperCase()}</span>
          </div>
          <div class="col" style={{ marginInlineStart: 10, minWidth: 0 }}>
            <span class="titleSmall bold ellipsis">{displayName}</span>
            <span class="labelSmall mono muted ltr" style={{ textAlign: 'right' }}>{phone}</span>
          </div>
        </div>
        <div class="row">
          <IconButton path={mdiPhone} label="تماس با مخاطب" color="var(--mint)" onClick={() => actions.startBridgeCall(phone, displayName)} />
          <IconButton path={mdiMessageText} label="باز کردن در پیام‌رسان گوشی" color="var(--gold)" onClick={() => actions.openSystemSmsComposer(phone, draft)} />
        </div>
      </div>
      <div ref={listRef} class="col g10 scroll grow" style={{ padding: 16 }}>
        {messages.map((m) => {
          const out = m.direction === 'OUTGOING';
          return (
            <div key={m.id} class="row" style={{ justifyContent: out ? 'flex-start' : 'flex-end' }}>
              <div class="col g4" style={{
                maxWidth: 300, padding: '10px 14px', background: out ? 'var(--primary-container)' : 'var(--surface-variant)',
                borderStartStartRadius: 18, borderStartEndRadius: 18, borderEndStartRadius: out ? 4 : 18, borderEndEndRadius: out ? 18 : 4,
              }}>
                <span class="bodyMedium" style={{ color: out ? 'var(--on-primary-container)' : 'var(--on-surface)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</span>
                <span class="labelSmall mono muted">{fmtDate(m.timestampMillis, 'HH:mm')} • SIM {m.simSlot}</span>
              </div>
            </div>
          );
        })}
      </div>
      {s.appConfig.enableQuickTemplates && (
        <div class="row g8 hscroll" style={{ padding: '4px 14px' }}>
          {QUICK_TEMPLATES.map((t) => (
            <button key={t} type="button" class="chip labelSmall" onClick={() => setDraft(t)} style={{ fontSize: 11, color: 'var(--on-surface)' }}>{t}</button>
          ))}
        </div>
      )}
      <div style={{ background: 'var(--surface)', border: `1px solid ${alpha('var(--outline)', 0.45)}`, padding: '8px 12px' }}>
        {s.appConfig.enableDualSim && (
          <div class="row g6" data-testid="composer_sim_toggle" onClick={() => actions.selectSimSlot(s.activeSimSlot === 1 ? 2 : 1)} style={{ paddingBottom: 6, cursor: 'pointer' }}>
            <Icon path={mdiSimOutline} size={14} color="var(--gold)" />
            <span class="labelSmall" style={{ color: 'var(--gold)' }}>ارسال از: {activeSimLabel(s)} (برای تعویض لمس کنید)</span>
          </div>
        )}
        <div class="row g8">
          <div class="tf grow filled">
            <textarea value={draft} rows={Math.min(4, Math.max(1, draft.split('\n').length))} placeholder="پیام خود را بنویسید..." data-testid="thread_message_input"
              onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)} style={{ borderRadius: 24 }} />
          </div>
          <button type="button" data-testid="thread_send_btn" aria-label="ارسال پیامک" disabled={!draft.trim()} onClick={send}
            style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', flex: 'none', background: draft.trim() ? 'var(--mint)' : alpha('var(--on-surface)', 0.12), color: draft.trim() ? 'var(--on-primary)' : alpha('var(--on-surface)', 0.38), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon path={mdiSend} style={{ transform: 'scaleX(-1)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
