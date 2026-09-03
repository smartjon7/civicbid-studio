import { useEffect, useState } from 'react';
import { useAppState, useDispatch, useWebMcpStatus } from '../store/context';
import { Glyph } from './Glyph';
import { ConfirmDialog } from './Modal';
import { SiteToolsPanel } from './SiteToolsPanel';
import { APP_NAME, HUMAN_UI, TAGLINE, UNSUPPORTED_BADGE_TEXT, formatDemoDate } from './uiText';

export function Header() {
  const state = useAppState();
  const dispatch = useDispatch();
  const status = useWebMcpStatus();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!toolsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setToolsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toolsOpen]);

  const ready = status.supported && status.registered && !status.error;
  const consoleOpen = state.ui.toolConsoleOpen;

  return (
    <header className="app-header">
      <div className="brand">
        <h1 className="brand-name">{APP_NAME}</h1>
        <p className="brand-tagline">{TAGLINE}</p>
      </div>
      <div className="header-badges">
        <span className="badge badge-neutral">
          <Glyph kind="info" />
          <span>Synthetic demo</span>
        </span>
        <span className="badge badge-neutral">
          <span>Demo date: {formatDemoDate(state.demoAnchorDate)}</span>
        </span>
        {ready ? (
          <span className="badge badge-ok" title="The browser reports these tools as registered.">
            <Glyph kind="check" />
            <span>Site tools ready · {status.registeredCount} registered</span>
          </span>
        ) : status.supported ? (
          <span className="badge badge-warn">
            <Glyph kind="warning" />
            <span>{status.error ? `Site tools error: ${status.error}` : 'Registering site tools'}</span>
          </span>
        ) : (
          <span className="badge badge-warn badge-wrap">
            <Glyph kind="warning" />
            <span>{UNSUPPORTED_BADGE_TEXT}</span>
          </span>
        )}
      </div>
      <div className="header-actions">
        <button type="button" className="btn" aria-expanded={toolsOpen} aria-controls="site-tools-panel" onClick={() => setToolsOpen((open) => !open)}>
          Site tools
        </button>
        <button
          type="button"
          className={`btn ${consoleOpen ? 'btn-active' : ''}`}
          aria-pressed={consoleOpen}
          onClick={() => dispatch({ type: 'set_ui', ui: { toolConsoleOpen: !consoleOpen }, ...HUMAN_UI })}
        >
          Tool Console
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setConfirmReset(true)}>
          Reset demo
        </button>
      </div>
      {toolsOpen ? (
        <div id="site-tools-panel">
          <SiteToolsPanel onClose={() => setToolsOpen(false)} />
        </div>
      ) : null}
      {confirmReset ? (
        <ConfirmDialog
          title="Reset the demonstration?"
          body={<p>This restores the seed state: the company profile, assignments, risks, the staged decision, the approval, the owner brief, and the activity log. It cannot be undone.</p>}
          confirmLabel="Reset demo"
          tone="danger"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            dispatch({ type: 'reset_demo', ...HUMAN_UI });
            setConfirmReset(false);
          }}
        />
      ) : null}
    </header>
  );
}
