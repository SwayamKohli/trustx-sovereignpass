import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
export function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]')].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
  const first = controls[0]; const last = controls.at(-1);
  if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
export function Dialog({ title, onClose, busy = false, children }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog ref={ref} aria-labelledby="dialog-title" aria-busy={busy} onKeyDown={containDialogFocus} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="dialog-title">{title}</h2>{children}
    <button className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
  </dialog>;
}
