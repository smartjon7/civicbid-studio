import { useEffect, useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

export function CopyButton({ text, label, className = 'btn' }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  };

  return (
    <span className="copy-control">
      <button type="button" className={className} onClick={() => { void copy(); }}>{label}</button>
      <span className="copy-status" role="status" aria-live="polite">
        {state === 'copied' ? 'Copied to clipboard.' : state === 'failed' ? 'Copy is not available here. Select the text and copy it manually.' : ''}
      </span>
    </span>
  );
}
