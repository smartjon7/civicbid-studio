import type { DimensionScore } from '../store/types';

function tone(score: number): string {
  if (score >= 80) return 'go';
  if (score >= 55) return 'conditional';
  return 'no-go';
}

export function DimensionBars({ dimensions, showExplanations = false }: { dimensions: DimensionScore[]; showExplanations?: boolean }) {
  return (
    <ul className="dimensions">
      {dimensions.map((dimension) => (
        <li key={dimension.key} className="dimension">
          <div className="dimension-head">
            <span className="dimension-label">{dimension.label}</span>
            <span className="dimension-weight">weight {Math.round(dimension.weight * 100)}%</span>
            <span className="dimension-score">{Math.round(dimension.score)}</span>
          </div>
          <div className="bar" aria-hidden="true">
            <div className={`bar-fill bar-${tone(dimension.score)}`} style={{ width: `${Math.max(2, Math.min(100, dimension.score))}%` }} />
          </div>
          {showExplanations ? <p className="dimension-explanation">{dimension.explanation}</p> : null}
        </li>
      ))}
    </ul>
  );
}
