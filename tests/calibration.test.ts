import { describe, expect, it } from 'vitest';
import { createSeedState, OPPORTUNITY_IDS } from '../src/data/seed';
import { evaluateAll, evaluateOpportunity, filterOpportunities, rankEvaluations, simulateProfileChange } from '../src/domain/evaluateOpportunity';
import { applyCommand, createTestContext } from '../src/store/reducer';
import type { AppState } from '../src/store/types';

const human = { actor: 'human', channel: 'ui' } as const;
const agent = { actor: 'agent', channel: 'webmcp' } as const;

function scores(state: AppState) {
  return Object.fromEntries(evaluateAll(state).map((e) => [e.opportunityId, { score: e.totalScore, raw: e.rawScore, rec: e.recommendation }]));
}

describe('seed calibration', () => {
  it('produces the handover target bands from the pristine seed', () => {
    const state = createSeedState();
    const s = scores(state);
    console.log('initial', JSON.stringify(s));
    expect(s[OPPORTUNITY_IDS.rail].score).toBeGreaterThanOrEqual(76);
    expect(s[OPPORTUNITY_IDS.rail].score).toBeLessThanOrEqual(79);
    expect(s[OPPORTUNITY_IDS.rail].rec).toBe('conditional_go');
    expect(s[OPPORTUNITY_IDS.station].score).toBeGreaterThanOrEqual(52);
    expect(s[OPPORTUNITY_IDS.station].score).toBeLessThanOrEqual(60);
    expect(s[OPPORTUNITY_IDS.station].rec).toBe('no_go');
    expect(s[OPPORTUNITY_IDS.housing].score).toBeGreaterThanOrEqual(67);
    expect(s[OPPORTUNITY_IDS.housing].score).toBeLessThanOrEqual(73);
    expect(s[OPPORTUNITY_IDS.housing].rec).toBe('conditional_go');
  });

  it('filters to Rail and Station for the judge prompt', () => {
    const state = createSeedState();
    const ids = filterOpportunities(state, { minimumValueUsd: 20_000_000, maximumDaysToDeadline: 45 }).map((o) => o.id);
    expect(ids).toEqual([OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station]);
    const ranked = rankEvaluations(evaluateAll(state).filter((e) => ids.includes(e.opportunityId)));
    expect(ranked[0].opportunityId).toBe(OPPORTUNITY_IDS.rail);
  });

  it('moves Rail to GO after the JV preset, with and without agent work', () => {
    const ctx = createTestContext();
    let state = createSeedState();
    const direct = simulateProfileChange(state, { jvPartnerConfirmed: true, jvCombinedBondingUsd: 60_000_000 });
    console.log('simulate', JSON.stringify(direct));
    const railDirect = direct.find((d) => d.opportunityId === OPPORTUNITY_IDS.rail)!;
    expect(railDirect.recommendationAfter).toBe('go');
    expect(railDirect.scoreAfter).toBeGreaterThanOrEqual(80);

    // Agent work first
    let r = applyCommand(state, { type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent }, ctx);
    expect(r.ok).toBe(true);
    state = r.state;
    for (const [id, role] of [
      ['RAIL-01', 'Finance & Bonding'],
      ['RAIL-07', 'JV & Legal'],
      ['RAIL-05', 'Safety Director'],
      ['RAIL-09', 'Scheduler'],
    ] as const) {
      r = applyCommand(state, { type: 'assign_requirement', requirementId: id, ownerRole: role, dueDate: '2026-09-15', note: '', ...agent }, ctx);
      expect(r.ok).toBe(true);
      state = r.state;
    }
    for (const key of ['bonding-shortfall', 'jv-approval-timing']) {
      r = applyCommand(
        state,
        {
          type: 'upsert_risk',
          risk: { riskKey: key, title: key, severity: 'high', relatedRequirementIds: ['RAIL-01'], rationale: 'x', mitigation: 'y', ownerRole: 'Finance & Bonding', status: 'open' },
          ...agent,
        },
        ctx,
      );
      expect(r.ok).toBe(true);
      state = r.state;
    }
    const afterAgent = scores(state);
    console.log('after agent', JSON.stringify(afterAgent));
    expect(afterAgent[OPPORTUNITY_IDS.rail].score).toBeLessThanOrEqual(79);
    expect(afterAgent[OPPORTUNITY_IDS.rail].rec).toBe('conditional_go');

    r = applyCommand(state, { type: 'apply_jv_preset', ...human }, ctx);
    expect(r.ok).toBe(true);
    state = r.state;
    const afterJv = scores(state);
    console.log('after jv', JSON.stringify(afterJv));
    expect(afterJv[OPPORTUNITY_IDS.rail].score).toBeGreaterThanOrEqual(84);
    expect(afterJv[OPPORTUNITY_IDS.rail].score).toBeLessThanOrEqual(89);
    expect(afterJv[OPPORTUNITY_IDS.rail].rec).toBe('go');
    expect(afterJv[OPPORTUNITY_IDS.station].score).toBeLessThan(afterJv[OPPORTUNITY_IDS.rail].score);
    expect(afterJv[OPPORTUNITY_IDS.station].rec).toBe('no_go');
    const rail = evaluateOpportunity(state, OPPORTUNITY_IDS.rail)!;
    expect(rail.mitigableGaps).toEqual([]);
    expect(rail.unmitigableGaps).toEqual([]);
  });
});
