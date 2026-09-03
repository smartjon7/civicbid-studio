/**
 * The company profile is editable only by the human. Every change goes through
 * update_company_profile so the evaluation, the activity log, and any staged
 * decision's staleness stay in step.
 */
import { useId, useState } from 'react';
import type { CompanyProfile, SafetyRecord } from '../store/types';
import { formatUsd } from '../domain/format';
import { useAppState, useDispatch } from '../store/context';
import { Glyph } from './Glyph';
import { HumanActionTag } from './badges';
import { HUMAN_UI } from './uiText';

type NumberKey = {
  [K in keyof CompanyProfile]: CompanyProfile[K] extends number ? K : never;
}[keyof CompanyProfile];

type BooleanKey = {
  [K in keyof CompanyProfile]: CompanyProfile[K] extends boolean ? K : never;
}[keyof CompanyProfile];

interface NumberSpec {
  field: NumberKey;
  label: string;
  kind: 'money' | 'count' | 'percent';
}

const CAPABILITY_FIELDS: NumberSpec[] = [
  { field: 'railYears', label: 'Years of rail experience', kind: 'count' },
  { field: 'comparableRailProjects', label: 'Comparable rail projects (7 years)', kind: 'count' },
  { field: 'accessibilityStationProjects', label: 'Accessibility-station projects', kind: 'count' },
  { field: 'completedHousingDevelopments', label: 'Affordable-housing developments', kind: 'count' },
];

const CAPACITY_FIELDS: NumberSpec[] = [
  { field: 'singleProjectBondingUsd', label: 'Single-project bonding (USD)', kind: 'money' },
  { field: 'aggregateBondingUsd', label: 'Aggregate bonding (USD)', kind: 'money' },
  { field: 'jvCombinedBondingUsd', label: 'Combined JV bonding (USD)', kind: 'money' },
  { field: 'availableProjectManagers', label: 'Available project managers', kind: 'count' },
  { field: 'backlogUtilizationPct', label: 'Backlog utilization (%)', kind: 'percent' },
];

const BOOLEAN_FIELDS: Array<{ field: BooleanKey; label: string }> = [
  { field: 'dbeCertified', label: 'DBE certified' },
  { field: 'jvPartnerConfirmed', label: 'JV partner confirmed' },
];

const SAFETY_OPTIONS: Array<{ value: SafetyRecord; label: string }> = [
  { value: 'strong', label: 'Strong' },
  { value: 'acceptable', label: 'Acceptable' },
  { value: 'poor', label: 'Poor' },
];

const EDIT_LABEL = 'edited the company profile';

export function CompanyProfileCard() {
  const state = useAppState();
  const dispatch = useDispatch();
  const company = state.company;
  const idBase = useId();
  const [error, setError] = useState<{ field: keyof CompanyProfile; message: string } | null>(null);

  const commit = (field: keyof CompanyProfile, value: string | number | boolean): boolean => {
    const changes = { [field]: value } as Partial<CompanyProfile>;
    const result = dispatch({ type: 'update_company_profile', changes, label: EDIT_LABEL, ...HUMAN_UI });
    if (!result.ok) {
      setError({ field, message: result.error.message });
      return false;
    }
    setError(null);
    return true;
  };

  const jvConfirmed = company.jvPartnerConfirmed && company.jvCombinedBondingUsd >= 60_000_000;

  return (
    <section className="rail-section" aria-labelledby={`${idBase}-title`}>
      <div className="rail-section-head">
        <h2 id={`${idBase}-title`}>Company profile</h2>
        <HumanActionTag />
      </div>
      <p className="muted">Only you can change these numbers. The agent reads them and can preview a change, but never writes them.</p>

      <div className="preset">
        <button type="button" className={`btn ${jvConfirmed ? '' : 'btn-primary'} btn-block`} disabled={jvConfirmed} onClick={() => dispatch({ type: 'apply_jv_preset', ...HUMAN_UI })}>
          {jvConfirmed ? (
            <>
              <Glyph kind="check" /> JV package confirmed
            </>
          ) : (
            'Confirm JV package'
          )}
        </button>
        <p className="preset-caption">Human action · sets JV partner to Yes and combined bonding to $60M</p>
      </div>

      <div className="profile-grid">
        <TextField id={`${idBase}-name`} label="Company name" value={company.name} error={error?.field === 'name' ? error.message : null} onCommit={(value) => commit('name', value)} />

        <h3 className="profile-group">Capability</h3>
        {CAPABILITY_FIELDS.map((spec) => (
          <NumberField key={spec.field} id={`${idBase}-${spec.field}`} spec={spec} value={company[spec.field]} error={error?.field === spec.field ? error.message : null} onCommit={(value) => commit(spec.field, value)} />
        ))}

        <h3 className="profile-group">Capacity and staffing</h3>
        {CAPACITY_FIELDS.map((spec) => (
          <NumberField key={spec.field} id={`${idBase}-${spec.field}`} spec={spec} value={company[spec.field]} error={error?.field === spec.field ? error.message : null} onCommit={(value) => commit(spec.field, value)} />
        ))}

        <h3 className="profile-group">Standing</h3>
        {BOOLEAN_FIELDS.map(({ field, label }) => (
          <div key={field} className="field">
            <label className="check">
              <input type="checkbox" checked={company[field]} onChange={(event) => commit(field, event.target.checked)} />
              <span>{label}</span>
            </label>
            {error?.field === field ? <p className="field-error" role="alert">{error.message}</p> : null}
          </div>
        ))}
        <div className="field">
          <label htmlFor={`${idBase}-safety`}>Safety record</label>
          <select id={`${idBase}-safety`} value={company.safetyRecord} onChange={(event) => commit('safetyRecord', event.target.value)}>
            {SAFETY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {error?.field === 'safetyRecord' ? <p className="field-error" role="alert">{error.message}</p> : null}
        </div>
      </div>
    </section>
  );
}

function NumberField({ id, spec, value, error, onCommit }: { id: string; spec: NumberSpec; value: number; error: string | null; onCommit: (value: number) => boolean }) {
  const [draft, setDraft] = useState<{ base: number; text: string } | null>(null);
  const text = draft && draft.base === value ? draft.text : String(value);

  const commit = () => {
    if (draft === null || draft.base !== value) return;
    if (text.trim() === '') {
      setDraft(null);
      return;
    }
    const parsed = Number(text);
    if (parsed === value) {
      setDraft(null);
      return;
    }
    if (onCommit(parsed)) setDraft(null);
  };

  const hint = spec.kind === 'money' ? formatUsd(value) : spec.kind === 'percent' ? `${value}%` : null;

  return (
    <div className="field">
      <label htmlFor={id}>{spec.label}</label>
      <div className="field-row">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={spec.kind === 'percent' ? 100 : undefined}
          step={spec.kind === 'money' ? 1_000_000 : 1}
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => setDraft({ base: value, text: event.target.value })}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
        {hint ? <span id={`${id}-hint`} className="field-hint">{hint}</span> : null}
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}

function TextField({ id, label, value, error, onCommit }: { id: string; label: string; value: string; error: string | null; onCommit: (value: string) => boolean }) {
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(null);
  const text = draft && draft.base === value ? draft.text : value;

  const commit = () => {
    if (draft === null || draft.base !== value) return;
    if (text.trim() === value) {
      setDraft(null);
      return;
    }
    if (onCommit(text)) setDraft(null);
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        maxLength={80}
        value={text}
        aria-invalid={error ? true : undefined}
        onChange={(event) => setDraft({ base: value, text: event.target.value })}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </div>
  );
}
