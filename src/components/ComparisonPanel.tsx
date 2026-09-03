import { formatLongDate, formatUsd } from '../domain/format';
import { selectComparison } from '../domain/selectors';
import { useAppState, useDispatch } from '../store/context';
import { RecommendationChip } from './badges';
import { DimensionBars } from './DimensionBars';
import { Glyph } from './Glyph';
import { HUMAN_UI } from './uiText';

export function ComparisonPanel() {
  const state = useAppState();
  const dispatch = useDispatch();
  const ranked = selectComparison(state);

  if (ranked.length === 0) {
    return (
      <div className="panel">
        <section className="card">
          <h2>Comparison</h2>
          <p className="empty">Nothing is being compared yet. Ask the agent to compare opportunities, or compare all three now.</p>
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'compare_opportunities', opportunityIds: state.opportunities.map((o) => o.id), ...HUMAN_UI })}>
            Compare all three
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Side by side</h2>
        <p className="muted">Ranked by the deterministic score. The strongest opportunity is marked.</p>
      </div>
      <div className="compare-grid">
        {ranked.map((evaluation, index) => {
          const mandatory = evaluation.requirements.filter((r) => r.mandatory).length;
          return (
            <article key={evaluation.opportunityId} className={`compare-card ${index === 0 ? 'is-strongest' : ''}`} aria-label={`${evaluation.title}, score ${evaluation.totalScore}, ${evaluation.recommendationLabel}`}>
              {index === 0 ? (
                <span className="badge badge-strongest">
                  <Glyph kind="star" />
                  <span>Strongest</span>
                </span>
              ) : (
                <span className="badge badge-neutral">Rank {index + 1}</span>
              )}
              <h3>{evaluation.title}</h3>
              <p className="muted">
                {evaluation.agency} · {formatUsd(evaluation.estimatedValueUsd)} · bids due {formatLongDate(evaluation.deadline)} ({evaluation.daysToDeadline} days)
              </p>
              <div className="score-row">
                <span className="score-big">
                  {evaluation.totalScore}
                  <small> / 100</small>
                </span>
                <RecommendationChip recommendation={evaluation.recommendation} capped={evaluation.capped} rawScore={evaluation.rawScore} />
              </div>
              <DimensionBars dimensions={evaluation.dimensions} />
              <p>
                <strong>{evaluation.passedGates.length} of {mandatory}</strong> mandatory gates passed
              </p>
              <dl className="gap-list">
                <dt>Mitigable gaps</dt>
                <dd>{evaluation.mitigableGaps.length ? evaluation.mitigableGaps.join(', ') : 'None'}</dd>
                <dt>Unmitigable gaps</dt>
                <dd className={evaluation.unmitigableGaps.length ? 'text-bad' : ''}>{evaluation.unmitigableGaps.length ? evaluation.unmitigableGaps.join(', ') : 'None'}</dd>
              </dl>
              <p className="rationale">{evaluation.rationale}</p>
              <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'select_opportunity', opportunityId: evaluation.opportunityId, ...HUMAN_UI })}>
                Open this opportunity
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
