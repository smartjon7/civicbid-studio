import type { RiskItem } from '../store/types';
import { RiskStatusBadge, SeverityBadge } from './badges';
import { pluralize } from './uiText';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function RiskRegister({ risks }: { risks: RiskItem[] }) {
  const ordered = [...risks].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title));
  return (
    <section className="card" aria-labelledby="risks-title">
      <div className="panel-head">
        <h3 id="risks-title">Risk register</h3>
        <p className="muted">{pluralize(risks.length, 'risk')} registered for this opportunity</p>
      </div>
      {ordered.length === 0 ? (
        <p className="empty">No risks registered yet. The agent adds them as it works the requirements; each one carries an owner and a mitigation.</p>
      ) : (
        <ul className="risk-list">
          {ordered.map((risk) => (
            <li key={risk.riskKey} className={`risk risk-${risk.severity}`}>
              <div className="risk-head">
                <SeverityBadge severity={risk.severity} />
                <span className="risk-title">{risk.title}</span>
                <RiskStatusBadge status={risk.status} />
              </div>
              <p className="risk-meta">
                Owner: {risk.ownerRole}
                {risk.relatedRequirementIds.length ? ` · Related: ${risk.relatedRequirementIds.join(', ')}` : ''}
              </p>
              {risk.rationale ? (
                <p>
                  <span className="req-key">Why</span>
                  {risk.rationale}
                </p>
              ) : null}
              {risk.mitigation ? (
                <p>
                  <span className="req-key">Mitigation</span>
                  {risk.mitigation}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
