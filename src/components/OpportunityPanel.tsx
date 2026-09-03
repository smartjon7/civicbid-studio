import { useMemo } from 'react';
import { evaluateOpportunity } from '../domain/evaluateOpportunity';
import { formatLongDate, formatUsd } from '../domain/format';
import { selectRisksFor, selectSelectedOpportunity } from '../domain/selectors';
import { useAppState } from '../store/context';
import { RecommendationChip } from './badges';
import { RequirementMatrix } from './RequirementMatrix';
import { RiskRegister } from './RiskRegister';
import { Scorecard } from './Scorecard';

export function OpportunityPanel() {
  const state = useAppState();
  const opportunity = selectSelectedOpportunity(state);
  const evaluation = useMemo(() => (opportunity ? evaluateOpportunity(state, opportunity.id) : null), [state, opportunity]);

  if (!opportunity || !evaluation) {
    return (
      <div className="panel">
        <section className="card">
          <h2>No opportunity open</h2>
          <p className="empty">Choose an opportunity on the left, or ask the agent to open the strongest one.</p>
        </section>
      </div>
    );
  }

  const risks = selectRisksFor(state, opportunity.id);

  return (
    <div className="panel">
      <section className="card summary" aria-labelledby="summary-title">
        <div className="panel-head">
          <div>
            <p className="kicker kicker-dark">{opportunity.agency}</p>
            <h2 id="summary-title">{opportunity.title}</h2>
          </div>
          <RecommendationChip recommendation={evaluation.recommendation} capped={evaluation.capped} rawScore={evaluation.rawScore} />
        </div>
        <dl className="summary-grid">
          <div>
            <dt>Solicitation</dt>
            <dd>{opportunity.solicitationNumber}</dd>
          </div>
          <div>
            <dt>Estimated value</dt>
            <dd>{formatUsd(opportunity.estimatedValueUsd)}</dd>
          </div>
          <div>
            <dt>Bids due</dt>
            <dd>
              {formatLongDate(opportunity.deadline)} ({evaluation.daysToDeadline} days)
            </dd>
          </div>
          <div>
            <dt>Sector</dt>
            <dd>{opportunity.sectorLabel}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{opportunity.location}</dd>
          </div>
          <div>
            <dt>Strategic fit</dt>
            <dd>{opportunity.strategicFit.charAt(0).toUpperCase() + opportunity.strategicFit.slice(1)}</dd>
          </div>
        </dl>
        <p className="summary-text">{opportunity.summary}</p>
        <ul className="scope-list">
          {opportunity.scopeHighlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <Scorecard evaluation={evaluation} />
      <RequirementMatrix opportunity={opportunity} evaluation={evaluation} />
      <RiskRegister risks={risks} />
    </div>
  );
}
