import type { Opportunity, OpportunityEvaluation } from '../store/types';
import { formatLongDate, formatUsd } from '../domain/format';
import { RecommendationChip } from './badges';

export function OpportunityCard({
  opportunity,
  evaluation,
  selected,
  onOpen,
}: {
  opportunity: Opportunity;
  evaluation: OpportunityEvaluation;
  selected: boolean;
  onOpen: () => void;
}) {
  const days = evaluation.daysToDeadline;
  return (
    <li>
      <button type="button" className={`opp-card ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={onOpen}>
        <span className="opp-card-head">
          <span className="opp-title">{opportunity.title}</span>
          <RecommendationChip recommendation={evaluation.recommendation} size="sm" />
        </span>
        <span className="opp-agency">{opportunity.agency}</span>
        <span className="opp-meta">
          <span className="opp-meta-item"><span className="opp-meta-label">Value</span> {formatUsd(opportunity.estimatedValueUsd)}</span>
          <span className="opp-meta-item"><span className="opp-meta-label">Sector</span> {opportunity.sectorLabel}</span>
          <span className="opp-meta-item opp-meta-wide"><span className="opp-meta-label">Bids due</span> {formatLongDate(opportunity.deadline)}</span>
          <span className="opp-meta-item">
            <span className="opp-meta-label">Days left</span> {days < 0 ? 'Closed' : days}
          </span>
          <span className="opp-meta-item"><span className="opp-meta-label">Score</span> <strong>{evaluation.totalScore}</strong> of 100</span>
        </span>
        {selected ? <span className="opp-open-note">Open in the workspace</span> : null}
      </button>
    </li>
  );
}
