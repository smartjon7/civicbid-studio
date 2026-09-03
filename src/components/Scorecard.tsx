import type { OpportunityEvaluation } from '../store/types';
import { RecommendationChip } from './badges';
import { DimensionBars } from './DimensionBars';
import { Glyph, type GlyphKind } from './Glyph';

function GateLine({ glyph, tone, label, ids }: { glyph: GlyphKind; tone: string; label: string; ids: string[] }) {
  return (
    <li className={`gate gate-${tone}`}>
      <Glyph kind={glyph} />
      <span>
        <span className="gate-count">
          {label} ({ids.length})
        </span>
        {ids.length ? `: ${ids.join(', ')}` : ': none'}
      </span>
    </li>
  );
}

export function Scorecard({ evaluation }: { evaluation: OpportunityEvaluation }) {
  return (
    <section className="card scorecard" aria-labelledby="scorecard-title">
      <h3 id="scorecard-title">Evaluation scorecard</h3>
      <div className="score-hero">
        <span className="score-big">
          {evaluation.totalScore}
          <small> / 100</small>
        </span>
        <RecommendationChip recommendation={evaluation.recommendation} capped={evaluation.capped} rawScore={evaluation.rawScore} size="lg" />
      </div>
      <p className="rationale">{evaluation.rationale}</p>

      <DimensionBars dimensions={evaluation.dimensions} showExplanations />

      <h4>Gate status</h4>
      <ul className="gate-list">
        <GateLine glyph="check" tone="ok" label="Passed" ids={evaluation.passedGates} />
        <GateLine glyph="warning" tone="warn" label="At risk" ids={evaluation.atRisk} />
        <GateLine glyph="warning" tone="bad" label="Mitigable gaps" ids={evaluation.mitigableGaps} />
        <GateLine glyph="cross" tone="critical" label="Unmitigable gaps" ids={evaluation.unmitigableGaps} />
        <GateLine glyph="dot" tone="neutral" label="Open deliverables" ids={evaluation.openDeliverables} />
      </ul>

      {evaluation.scoreDrivers.length ? (
        <>
          <h4>What would change the score</h4>
          <ul className="driver-list">
            {evaluation.scoreDrivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h4>Next action</h4>
      <p className="next-action">{evaluation.nextAction}</p>
    </section>
  );
}
