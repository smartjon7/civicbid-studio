import { actorLabel, formatLongDate, formatTime } from '../domain/format';
import { selectDecisionStatus } from '../domain/selectors';
import { useAppState, useDispatch } from '../store/context';
import { CopyButton } from './CopyButton';
import { HUMAN_UI } from './uiText';

export function OwnerBriefPanel() {
  const state = useAppState();
  const dispatch = useDispatch();
  const brief = state.ownerBrief;
  const back = () => dispatch({ type: 'set_ui', ui: { visiblePanel: 'workspace' }, ...HUMAN_UI });

  if (!brief) {
    const status = selectDecisionStatus(state);
    return (
      <div className="panel">
        <section className="card">
          <h2>Owner brief</h2>
          <p className="empty">
            {status === 'approved'
              ? 'The decision is approved. Ask the agent to generate the owner brief, or generate it from the right rail.'
              : 'No owner brief yet. It can only be generated after you approve a staged decision.'}
          </p>
          <button type="button" className="btn" onClick={back}>Back to workspace</button>
        </section>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="brief-actions no-print">
        <CopyButton text={brief.text} label="Copy brief" />
        <button type="button" className="btn" onClick={() => window.print()}>Print</button>
        <button type="button" className="btn btn-quiet" onClick={back}>Back to workspace</button>
      </div>
      <article className="brief-document" aria-labelledby="brief-title">
        <p className="brief-kicker">Executive owner brief · synthetic demonstration</p>
        <h2 id="brief-title">{brief.title}</h2>
        <p className="brief-meta">
          Generated {formatLongDate(brief.generatedAt.slice(0, 10))} at {formatTime(brief.generatedAt)} by {actorLabel(brief.generatedBy)} · Decision {brief.decisionId} · State version {brief.stateVersion} · {brief.wordCount} words (limit {brief.maximumWords})
        </p>
        {brief.sections.map((section) => (
          <section key={section.heading}>
            <h3>{section.heading}</h3>
            <p>{section.body}</p>
          </section>
        ))}
      </article>
    </div>
  );
}
