// Material 3 primitives used by the screens (Compose equivalents).
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';

export function Icon({ path, size = 24, color, style, class: cls }: { path: string; size?: number; color?: string; style?: JSX.CSSProperties; class?: string }) {
  return (
    <svg class={`ic ${cls ?? ''}`} viewBox="0 0 24 24" style={{ width: size, height: size, color, ...style }} aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

type BtnKind = 'filled' | 'tonal' | 'outlined' | 'text';
export function Button(props: {
  kind?: BtnKind; onClick?: () => void; disabled?: boolean; icon?: string; children?: ComponentChildren;
  style?: JSX.CSSProperties; class?: string; testId?: string; type?: 'button' | 'submit';
}) {
  const { kind = 'filled', onClick, disabled, icon, children, style, class: cls, testId, type = 'button' } = props;
  return (
    <button type={type} class={`btn ${kind} ${cls ?? ''}`} onClick={onClick} disabled={disabled} style={style} data-testid={testId}>
      {icon && <Icon path={icon} size={18} />}
      {children}
    </button>
  );
}

export function IconButton({ path, onClick, color, label, disabled, size = 24, style }: { path: string; onClick?: () => void; color?: string; label?: string; disabled?: boolean; size?: number; style?: JSX.CSSProperties }) {
  return (
    <button type="button" class="iconbtn" onClick={onClick} aria-label={label} title={label} disabled={disabled} style={{ color, ...style }}>
      <Icon path={path} size={size} />
    </button>
  );
}

export function Chip({ selected, onClick, children, style }: { selected: boolean; onClick: () => void; children: ComponentChildren; style?: JSX.CSSProperties }) {
  return <button type="button" class={`chip ${selected ? 'selected' : ''}`} onClick={onClick} style={style}>{children}</button>;
}

export function Switch({ checked, onChange, testId }: { checked: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return <button type="button" role="switch" aria-checked={checked} class={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} data-testid={testId} />;
}

export function TextField(props: {
  value: string; onInput: (v: string) => void; label?: string; placeholder?: string; type?: string; multiline?: boolean;
  minRows?: number; maxRows?: number; leading?: string; trailing?: ComponentChildren; inputMode?: string; testId?: string;
  autoComplete?: string; dir?: 'ltr' | 'rtl' | 'auto'; disabled?: boolean;
}) {
  const { value, onInput, label, placeholder, type = 'text', multiline, minRows = 1, maxRows = 4, leading, trailing, inputMode, testId, autoComplete, dir, disabled } = props;
  const filled = value.length > 0 || !!placeholder;
  const cls = `tf ${filled ? 'filled' : ''} ${leading ? 'has-lead' : ''} ${trailing ? 'has-trail' : ''}`;
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Auto-grow between minRows and maxRows like Compose OutlinedTextField(minLines, maxLines)
  useLayoutEffect(() => {
    const ta = taRef.current; if (!ta) return;
    const lh = 22; const padding = 30;
    ta.style.height = 'auto';
    const h = Math.min(maxRows * lh + padding, Math.max(minRows * lh + padding, ta.scrollHeight + 2));
    ta.style.height = `${h}px`;
    ta.style.overflowY = ta.scrollHeight + 2 > h ? 'auto' : 'hidden';
  }, [value, minRows, maxRows]);
  return (
    <div class={cls}>
      {multiline ? (
        <textarea ref={taRef} value={value} rows={minRows} onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)} placeholder={placeholder} data-testid={testId} dir={dir} disabled={disabled} />
      ) : (
        <input value={value} type={type} inputMode={inputMode as any} autoComplete={autoComplete} onInput={(e) => onInput((e.target as HTMLInputElement).value)} placeholder={placeholder} data-testid={testId} dir={dir} disabled={disabled} />
      )}
      {label && <label>{label}</label>}
      {leading && <span class="lead"><Icon path={leading} /></span>}
      {trailing && <span class="trail">{trailing}</span>}
    </div>
  );
}

export function Portal({ children }: { children: ComponentChildren }) {
  return createPortal(children as any, document.body);
}

export function Dialog({ onDismiss, icon, title, children, confirm, dismiss, titleStart }: {
  onDismiss: () => void; icon?: string; title?: ComponentChildren; children?: ComponentChildren;
  confirm?: ComponentChildren; dismiss?: ComponentChildren; titleStart?: boolean;
}) {
  useBodyLock();
  return (
    <Portal>
      <div class="scrim" onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }} dir="rtl">
        <div class="dialog" role="dialog">
          {icon && <Icon path={icon} class="d-icon" />}
          {title && <div class={`d-title ${titleStart && !icon ? 'start' : ''}`}>{title}</div>}
          {children && <div class="d-body">{children}</div>}
          {(confirm || dismiss) && <div class="d-actions">{dismiss}{confirm}</div>}
        </div>
      </div>
    </Portal>
  );
}

export function BottomSheet({ onDismiss, children }: { onDismiss: () => void; children: ComponentChildren }) {
  useBodyLock();
  return (
    <Portal>
      <div class="scrim sheet-scrim" onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }} dir="rtl">
        <div class="sheet" role="dialog">
          <div class="handle" />
          {children}
        </div>
      </div>
    </Portal>
  );
}

let lockCount = 0;
function useBodyLock() {
  useEffect(() => {
    lockCount++; document.body.style.overflow = 'hidden';
    return () => { lockCount--; if (lockCount <= 0) document.body.style.overflow = ''; };
  }, []);
}

export function Snackbar({ message, onDone }: { message: string | null; onDone: () => void }) {
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    setShown(message);
    const t = setTimeout(() => { setShown(null); onDone(); }, 4000);
    return () => clearTimeout(t);
  }, [message]);
  if (!shown) return null;
  return <Portal><div class="snackbar" dir="rtl" role="status">{shown}</div></Portal>;
}

/** Surface with alpha-tinted color, like Color.copy(alpha = x). */
export const alpha = (hex: string, a: number) => `color-mix(in srgb, ${hex} ${Math.round(a * 100)}%, transparent)`;

export function ProgressLinear() { return <div class="progress-linear" />; }
export function Spinner({ color }: { color?: string }) { return <div class="spinner" style={{ color }} />; }

/** Long-press helper (combinedClickable onLongClick). */
export function useLongPress(onClick: () => void, onLong: () => void, ms = 500) {
  let timer: any = null; let fired = false;
  const start = () => { fired = false; timer = setTimeout(() => { fired = true; onLong(); }, ms); };
  const cancel = () => clearTimeout(timer);
  return {
    onPointerDown: start,
    onPointerUp: () => { cancel(); if (!fired) onClick(); },
    onPointerLeave: cancel,
    onContextMenu: (e: Event) => e.preventDefault(),
  };
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
export function fmtDate(ms: number, pattern: 'MM/dd HH:mm' | 'yyyy/MM/dd HH:mm' | 'HH:mm' | 'yyyy/MM/dd' | 'MM/dd') {
  const d = new Date(ms);
  const map: Record<string, string> = { yyyy: String(d.getFullYear()), MM: pad2(d.getMonth() + 1), dd: pad2(d.getDate()), HH: pad2(d.getHours()), mm: pad2(d.getMinutes()) };
  return pattern.replace(/yyyy|MM|dd|HH|mm/g, (k) => map[k]);
}
