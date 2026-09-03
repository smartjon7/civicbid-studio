import { useState } from 'react';
import { actorLabel, formatTime } from '../domain/format';
import { selectDecisionStatus } from '../domain/selectors';
import { useAppState, useDispatch } from '../store/context';
import { HumanActionTag, RecommendationChip } from './badges';
import { Glyph } from './Glyph';
import { ConfirmDialog } from './Modal';
import { HUMAN_UI } from './uiText';

export function DecisionCard() {
  const state = useAppState();
  const dispatch = useDispatch();
  const decision = state.stagedDecision;
  const status = selectDecisionStatus(state);
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null);

  if (!decision) {
    return (
      <section className="card" aria-labelledby="decision-title">
        <h2 id="decision-title">Pending decision</h2>
        <p className="empty">No recommendation staged yet. Ask the agent to stage one, or open an opportunity and use the Tool Console.</p>
      </section>
    );
  }

  const opportunity = state.opportunities.find((o) => o.id === decision.opportunityId);
  const approval = state.approval && state.approval.decisionId === decision.id ? state.approval : null;

  return (
    <section className="card decision" aria-labelledby="decision-title">
      <div className="panel-head">
        <h2 id="decision-title">{status === 'pending' ? 'Pending decision' : status === 'approved' ? 'Approved decision' : 'Rejected decision'}</h2>
        <RecommendationChip recommendation={decision.recommendation} />
      </div>
      <p className="decision-opportunity">{opportunity?.title ?? decision.opportunityId}</p>

      {decision.stale && decision.staleReason ? (
        <div className="notice notice-warn" role="status">
          <Glyph kind="warning" />
          <div>
            <strong>Company profile changed since this was staged.</strong> {decision.staleReason}
          </div>
        </div>
      ) : null}

      <dl className="kv">
        <dt>Confidence</dt>
        <dd>{decision.confidence}%</dd>
        <dt>Staged by</dt>
        <dd>
          {actorLabel(decision.stagedBy)} at {formatTime(decision.stagedAt)}
        </dd>
        <dt>State version</dt>
        <dd>{decision.stateVersion}</dd>
        <dt>Snapshot</dt>
        <dd>
          score {decision.evaluationSnapshot.totalScore}
          {decision.evaluationSnapshot.mitigableGaps.length ? ` · mitigable: ${decision.evaluationSnapshot.mitigableGaps.join(', ')}` : ''}
          {decision.evaluationSnapshot.unmitigableGaps.length ? ` · unmitigable: ${decision.evaluationSnapshot.unmitigableGaps.join(', ')}` : ''}
        </dd>
      </dl>

      <h3>Rationale</h3>
      <p className="decision-text">{decision.rationale}</p>

      {decision.conditions.length ? (
        <>
          <h3>Conditions</h3>
          <ul className="list-plain">
            {decision.conditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </>
      ) : null}

      {decision.assumptions.length ? (
        <>
          <h3>Assumptions</h3>
          <ul className="list-plain">
            {decision.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </>
      ) : null}

      {decision.supersedesDecisionId ? <p className="muted">Revises an earlier recommendation (decision {decision.supersedesDecisionId}).</p> : null}

      {status === 'pending' ? (
        <>
          <p className="decision-status is-pending">
            <Glyph kind="lock" />
            <span>Pending human approval — the agent cannot approve this</span>
          </p>
          <div className="decision-actions">
            <div className="decision-action">
              <button type="button" className="btn btn-go" onClick={() => setConfirming('approve')}>Approve</button>
              <HumanActionTag />
            </div>
            <div className="decision-action">
              <button type="button" className="btn btn-danger" onClick={() => setConfirming('reject')}>Reject</button>
              <HumanActionTag />
            </div>
          </div>
        </>
      ) : status === 'approved' ? (
        <>
          <p className="decision-status is-approved">
            <Glyph kind="check" />
            <span>Approved by you at {approval ? formatTime(approval.decidedAt) : 'an earlier time'}</span>
          </p>
          {approval?.note ? <p className="muted">Your note: {approval.note}</p> : null}
        </>
      ) : (
        <>
          <p className="decision-status is-rejected">
            <Glyph kind="cross" />
            <span>Rejected{approval ? ` at ${formatTime(approval.decidedAt)}` : ''}</span>
          </p>
          {approval?.note ? <p className="muted">Your note: {approval.note}</p> : null}
          <p className="muted">The agent can stage a new recommendation; this one stays on record.</p>
        </>
      )}

      {confirming ? (
        <ConfirmDialog
          title={confirming === 'approve' ? 'Approve this recommendation?' : 'Reject this recommendation?'}
          tone={confirming === 'approve' ? 'go' : 'danger'}
          confirmLabel={confirming === 'approve' ? 'Approve' : 'Reject'}
          withNote
          noteLabel="Note for the record (optional)"
          body={
            <p>
              You are about to {confirming === 'approve' ? 'approve' : 'reject'} <strong>{opportunity?.title ?? decision.opportunityId}</strong> as{' '}
              <strong>{decision.recommendation === 'go' ? 'GO' : decision.recommendation === 'conditional_go' ? 'Conditional GO' : 'NO-GO'}</strong>. This is a human-only action; it is
              written to the activity log under your name{confirming === 'approve' ? ' and unlocks the owner brief' : ''}.
            </p>
          }
          onCancel={() => setConfirming(null)}
          onConfirm={(note) => {
            dispatch({ type: confirming === 'approve' ? 'approve_decision' : 'reject_decision', note, ...HUMAN_UI });
            setConfirming(null);
          }}
        />
      ) : null}
    </section>
  );
}
