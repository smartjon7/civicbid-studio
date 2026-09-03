/**
 * Accessible modal: traps focus, closes on Escape, restores focus on close.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, tone = 'default' }: { title: string; onClose: () => void; children: ReactNode; tone?: 'default' | 'danger' | 'go' }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const node = dialogRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => (node ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);
    const first = focusables()[0];
    if (first) first.focus();
    else node?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`modal modal-${tone}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId} className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone = 'default',
  withNote = false,
  noteLabel = 'Note (optional)',
  onConfirm,
  onCancel,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'danger' | 'go';
  withNote?: boolean;
  noteLabel?: string;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const noteId = useId();
  return (
    <Modal title={title} onClose={onCancel} tone={tone}>
      <div className="modal-body">{body}</div>
      {withNote ? (
        <div className="field">
          <label htmlFor={noteId}>{noteLabel}</label>
          <textarea id={noteId} rows={3} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      ) : null}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className={`btn btn-${tone === 'default' ? 'primary' : tone}`} onClick={() => onConfirm(note.trim())}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
