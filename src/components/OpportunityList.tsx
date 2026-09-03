import { useId, useMemo, useState } from 'react';
import { SECTORS, type OpportunityFilters, type Sector } from '../store/types';
import { evaluateAll, filterOpportunities } from '../domain/evaluateOpportunity';
import { useAppState, useDispatch } from '../store/context';
import { OpportunityCard } from './OpportunityCard';
import { HUMAN_UI, SECTOR_LABELS } from './uiText';

export function OpportunityList() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [minValueMillions, setMinValueMillions] = useState('');
  const [maxDays, setMaxDays] = useState('');
  const [sectors, setSectors] = useState<Sector[]>([]);
  const idBase = useId();

  const filters = useMemo<OpportunityFilters>(() => {
    const min = Number(minValueMillions);
    const days = Number(maxDays);
    return {
      minimumValueUsd: minValueMillions.trim() !== '' && Number.isFinite(min) ? min * 1_000_000 : undefined,
      maximumDaysToDeadline: maxDays.trim() !== '' && Number.isFinite(days) ? days : undefined,
      sectors: sectors.length ? sectors : undefined,
    };
  }, [minValueMillions, maxDays, sectors]);

  const evaluations = useMemo(() => evaluateAll(state), [state]);
  const visible = filterOpportunities(state, filters);
  const filtering = filters.minimumValueUsd !== undefined || filters.maximumDaysToDeadline !== undefined || sectors.length > 0;

  const toggleSector = (sector: Sector) => {
    setSectors((current) => (current.includes(sector) ? current.filter((s) => s !== sector) : [...current, sector]));
  };

  return (
    <section className="rail-section" aria-labelledby={`${idBase}-title`}>
      <div className="rail-section-head">
        <h2 id={`${idBase}-title`}>Opportunities</h2>
        <span className="muted">
          {visible.length} of {state.opportunities.length}
        </span>
      </div>
      <details className="filters" open={filtering}>
        <summary>Filters{filtering ? ' (active)' : ''}</summary>
        <div className="filter-grid">
          <div className="field">
            <label htmlFor={`${idBase}-min`}>Minimum value ($ millions)</label>
            <input id={`${idBase}-min`} type="number" min={0} step={1} inputMode="numeric" value={minValueMillions} onChange={(event) => setMinValueMillions(event.target.value)} placeholder="Any" />
          </div>
          <div className="field">
            <label htmlFor={`${idBase}-days`}>Closes within (days)</label>
            <input id={`${idBase}-days`} type="number" min={0} step={1} inputMode="numeric" value={maxDays} onChange={(event) => setMaxDays(event.target.value)} placeholder="Any" />
          </div>
          <fieldset className="field field-wide">
            <legend>Sector</legend>
            <div className="check-row">
              {SECTORS.map((sector) => (
                <label key={sector} className="check">
                  <input type="checkbox" checked={sectors.includes(sector)} onChange={() => toggleSector(sector)} />
                  <span>{SECTOR_LABELS[sector]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="filter-actions field-wide">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setMinValueMillions('20');
                setMaxDays('45');
                setSectors([]);
              }}
            >
              Apply the judge filter (over $20M, within 45 days)
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              disabled={!filtering}
              onClick={() => {
                setMinValueMillions('');
                setMaxDays('');
                setSectors([]);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </details>
      {visible.length === 0 ? (
        <p className="empty">No opportunity matches these filters.</p>
      ) : (
        <ul className="opp-list">
          {visible.map((opportunity) => {
            const evaluation = evaluations.find((e) => e.opportunityId === opportunity.id);
            if (!evaluation) return null;
            return (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                evaluation={evaluation}
                selected={state.selectedOpportunityId === opportunity.id}
                onOpen={() => dispatch({ type: 'select_opportunity', opportunityId: opportunity.id, ...HUMAN_UI })}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
