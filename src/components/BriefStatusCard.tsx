import { useState } from 'react';
import { selectDecisionStatus } from '../domain/selectors';
import { useAppState, useDispatch } from '../store/context';
import { HUMAN_UI } from './uiText';

export function BriefStatusCard() {
  const state = useAppState();
  const dispatch = useDispatch();
  const brief = state.ownerBrief;
  const approved = selectDecisionStatus(state) === 'approved';
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    const result = dispatch({ type: 'generate_owner_brief', options: { maximumWords: 260, emphasis: [], title: null }, ...HUMAN_UI });
    setError(result.ok ? null : result.error.message);
  };

  return (
    <section className="card" aria-labelledby="brief-status-title">
      <div className="panel-head">
        <h2 id="brief-status-title">Owner brief</h2>
        <span className={`badge ${brief ? 'badge-ok' : 'badge-neutral'}`}>{brief ? `Generated (${brief.wordCount} words)` : 'Not generated'}</span>
      </div>
      {brief ? (
        <p className="muted">{brief.title}</p>
      ) : (
        <p className="muted">{approved ? 'The decision is approved; the brief can be generated now.' : 'Unlocks after you approve a staged decision.'}</p>
      )}
      <div className="decision-actions">
        {brief ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'set_ui', ui: { visiblePanel: 'brief' }, ...HUMAN_UI })}>
            Open brief
          </button>
        ) : null}
        {approved ? (
          <button type="button" className="btn btn-sm" onClick={generate}>
            {brief ? 'Regenerate brief' : 'Generate brief'}
          </button>
        ) : null}
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </section>
  );
}
