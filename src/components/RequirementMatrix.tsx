import { useEffect, useId, useRef, useState } from 'react';
import { OWNER_ROLES, type GateEffect, type Opportunity, type OpportunityEvaluation, type OwnerRole, type RequirementEvaluation } from '../store/types';
import { addDays, daysBetween, formatShortDate } from '../domain/format';
import { useAppState, useDispatch } from '../store/context';
import { RequirementStatusBadge } from './badges';
import { Glyph } from './Glyph';
import { Modal } from './Modal';
import { HUMAN_UI, pluralize } from './uiText';

const GATE_TEXT: Record<GateEffect, string> = {
  pass: 'Gate passed',
  at_risk: 'Gate at risk',
  mitigable_gap: 'Mitigable gap',
  unmitigable_gap: 'Unmitigable — disqualifying',
  deliverable_open: 'Deliverable open',
  not_applicable: 'Not applicable',
};

export function RequirementMatrix({ opportunity, evaluation }: { opportunity: Opportunity; evaluation: OpportunityEvaluation }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const tableRef = useRef<HTMLTableElement>(null);
  const [assigning, setAssigning] = useState<RequirementEvaluation | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const focusKey = state.focusedRequirementIds.join(',');

  useEffect(() => {
    if (!focusKey) return;
    const row = tableRef.current?.querySelector<HTMLElement>('tr[data-focused="true"]');
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'center' });
  }, [focusKey]);

  const requirements = evaluation.requirements;
  const counts = {
    mandatory: requirements.filter((r) => r.mandatory).length,
    satisfied: requirements.filter((r) => r.status === 'satisfied' || r.status === 'complete').length,
    gaps: requirements.filter((r) => r.status === 'gap').length,
    atRisk: requirements.filter((r) => r.status === 'at_risk').length,
    assigned: requirements.filter((r) => r.status === 'assigned').length,
  };

  return (
    <section className="card" aria-labelledby="matrix-title">
      <div className="panel-head">
        <h3 id="matrix-title">Requirement matrix</h3>
        <p className="muted">
          {pluralize(counts.mandatory, 'mandatory requirement')} · {counts.satisfied} satisfied · {counts.gaps} gaps · {counts.atRisk} at risk · {counts.assigned} assigned
        </p>
      </div>

      {state.focusedRequirementIds.length > 0 ? (
        <div className="focus-bar" role="status">
          <Glyph kind="warning" />
          <span>
            <strong>Focused for your review ({state.focusedRequirementIds.join(', ')}):</strong> {state.focusReason}
          </span>
          <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'clear_focus', ...HUMAN_UI })}>
            Clear focus
          </button>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="notice notice-warn" role="status">
          <Glyph kind="warning" />
          <div>
            {warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setWarnings([])}>Dismiss</button>
        </div>
      ) : null}

      <div className="table-wrap">
        <table ref={tableRef} className="req-table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Requirement, finding, and mitigation</th>
              <th scope="col">Status</th>
              <th scope="col">Owner and due date</th>
              <th scope="col">Done</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((requirement) => (
              <tr key={requirement.requirementId} className={`req-row ${requirement.focused ? 'is-focused' : ''}`} data-focused={requirement.focused ? 'true' : undefined}>
                <th scope="row" className="req-id">
                  <code>{requirement.requirementId}</code>
                  {requirement.mandatory ? <span className="req-mandatory">Mandatory</span> : <span className="req-optional">Optional</span>}
                  {requirement.focused ? <span className="req-focused-tag">Focused</span> : null}
                </th>
                <td className="req-main">
                  <div className="req-label">{requirement.label}</div>
                  <div className="req-finding">
                    <span className="req-key">Finding</span>
                    {requirement.finding}
                  </div>
                  {requirement.status !== 'satisfied' && requirement.status !== 'complete' ? (
                    <div className="req-mitigation">
                      <span className="req-key">Mitigation</span>
                      {requirement.suggestedMitigation}
                    </div>
                  ) : null}
                  {requirement.assignmentNote ? (
                    <div className="req-note">
                      <span className="req-key">Note</span>
                      {requirement.assignmentNote}
                    </div>
                  ) : null}
                </td>
                <td>
                  <RequirementStatusBadge status={requirement.status} />
                  <div className="req-gate muted">{GATE_TEXT[requirement.gateEffect]}</div>
                </td>
                <td className="req-owner">
                  {requirement.ownerRole ? (
                    <>
                      <div className="req-owner-name">{requirement.ownerRole}</div>
                      <div className="muted">Due {requirement.dueDate ? formatShortDate(requirement.dueDate) : 'not set'}</div>
                    </>
                  ) : (
                    <div className="muted">Unassigned · suggested {requirement.suggestedOwner}</div>
                  )}
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAssigning(requirement)}>
                    {requirement.ownerRole ? 'Change' : 'Assign'}
                  </button>
                </td>
                <td className="req-done">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={requirement.complete}
                      aria-label={`Done: ${requirement.requirementId}`}
                      onChange={(event) => dispatch({ type: 'mark_requirement_complete', requirementId: requirement.requirementId, complete: event.target.checked, ...HUMAN_UI })}
                    />
                    <span>Done</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assigning ? (
        <AssignDialog
          requirement={assigning}
          opportunity={opportunity}
          anchorDate={state.demoAnchorDate}
          onClose={() => setAssigning(null)}
          onWarnings={setWarnings}
        />
      ) : null}
    </section>
  );
}

function AssignDialog({
  requirement,
  opportunity,
  anchorDate,
  onClose,
  onWarnings,
}: {
  requirement: RequirementEvaluation;
  opportunity: Opportunity;
  anchorDate: string;
  onClose: () => void;
  onWarnings: (warnings: string[]) => void;
}) {
  const dispatch = useDispatch();
  const idBase = useId();
  const defaultDue = requirement.dueDate ?? (daysBetween(anchorDate, opportunity.deadline) > 7 ? addDays(anchorDate, 7) : opportunity.deadline);
  const [ownerRole, setOwnerRole] = useState<OwnerRole>(requirement.ownerRole ?? requirement.suggestedOwner);
  const [dueDate, setDueDate] = useState(defaultDue);
  const [note, setNote] = useState(requirement.assignmentNote ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = dispatch({ type: 'assign_requirement', requirementId: requirement.requirementId, ownerRole, dueDate, note, ...HUMAN_UI });
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onWarnings(result.warnings);
    onClose();
  };

  return (
    <Modal title={`Assign ${requirement.requirementId}`} onClose={onClose}>
      <p className="modal-body">{requirement.label}</p>
      <div className="field">
        <label htmlFor={`${idBase}-owner`}>Owner role</label>
        <select id={`${idBase}-owner`} value={ownerRole} onChange={(event) => setOwnerRole(event.target.value as OwnerRole)}>
          {OWNER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
              {role === requirement.suggestedOwner ? ' (suggested)' : ''}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${idBase}-due`}>Due date</label>
        <input id={`${idBase}-due`} type="date" value={dueDate} min={anchorDate} max={opportunity.deadline} onChange={(event) => setDueDate(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${idBase}-note`}>Note (optional)</label>
        <textarea id={`${idBase}-note`} rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit}>Assign</button>
      </div>
    </Modal>
  );
}
