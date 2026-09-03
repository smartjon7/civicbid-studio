import { useEffect, useState } from 'react';
import { actorLabel } from '../domain/format';
import { useAppState } from '../store/context';
import { ActorBadge } from './badges';

const TOAST_MS = 4000;

export function Toast() {
  const toast = useAppState().ui.lastToast;
  const [hiddenId, setHiddenId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setHiddenId(toast.id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visible = toast !== null && hiddenId !== toast.id;

  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
      {visible ? (
        <div className={`toast toast-${toast.actor}`}>
          <ActorBadge actor={toast.actor} />
          <span className="toast-text">{toast.text}</span>
          <span className="visually-hidden">{actorLabel(toast.actor)}</span>
        </div>
      ) : null}
    </div>
  );
}
