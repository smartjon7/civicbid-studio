/**
 * Domain tests for the deterministic evaluation engine.
 *
 * Every expectation here derives from the synthetic seed in src/data/seed.ts
 * and the rules in src/domain/evaluateOpportunity.ts. Nothing is random.
 */
import { describe, expect, it } from 'vitest';
import { createSeedState, OPPORTUNITY_IDS } from '../src/data/seed';
import {
  CONDITIONAL_CAP,
  DIMENSION_WEIGHTS,
  diffEvaluations,
  effectiveBonding,
  evaluateAll,
  evaluateOpportunity,
  filterOpportunities,
  GO_THRESHOLD,
  NO_GO_THRESHOLD,
  rankEvaluations,
  simulateProfileChange,
  summariesDiffer,
  summarizeEvaluation,
} from '../src/domain/evaluateOpportunity';
import { applyCommand, createTestContext } from '../src/store/reducer';
import type { AppState, CompanyProfile, OpportunityEvaluation } from '../src/store/types';

const agent = { actor: 'agent', channel: 'webmcp', tool: 'civicbid_test' } as const;

/** Seed state with company-profile overrides applied directly (no command, no log). */
function seedWith(changes: Partial<CompanyProfile>, extra: Partial<AppState> = {}): AppState {
  const seed = createSeedState();
  return { ...seed, ...extra, company: { ...seed.company, ...changes } };
}

function requirement(state: AppState, opportunityId: string, requirementId: string) {
  const evaluation = evaluateOpportunity(state, opportunityId);
  if (!evaluation) throw new Error(`Unknown opportunity ${opportunityId}`);
  const found = evaluation.requirements.find((r) => r.requirementId === requirementId);
  if (!found) throw new Error(`Unknown requirement ${requirementId}`);
  return found;
}

describe('filterOpportunities', () => {
  it('returns Rail and Station for the judge prompt (over $20M, closing within 45 days)', () => {
    const state = createSeedState();
    const ids = filterOpportunities(state, { minimumValueUsd: 20_000_000, maximumDaysToDeadline: 45 }).map((o) => o.id);
    expect(ids).toEqual([OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station]);
  });

  it('excludes the $18M housing opportunity on value alone', () => {
    const state = createSeedState();
    const ids = filterOpportunities(state, { minimumValueUsd: 20_000_000 }).map((o) => o.id);
    expect(ids).toEqual([OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station]);
    expect(ids).not.toContain(OPPORTUNITY_IDS.housing);
  });

  it('filters by days to deadline measured from the demo anchor date', () => {
    const state = createSeedState();
    // Station closes in 20 days, Rail in 26, Housing in 44 (anchor 2026-09-03).
    expect(filterOpportunities(state, { maximumDaysToDeadline: 25 }).map((o) => o.id)).toEqual([OPPORTUNITY_IDS.station]);
    expect(filterOpportunities(state, { maximumDaysToDeadline: 26 }).map((o) => o.id)).toEqual([OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station]);
    expect(filterOpportunities(state, { maximumDaysToDeadline: 19 })).toEqual([]);
  });

  it('filters by sector and treats an empty sector list as no filter', () => {
    const state = createSeedState();
    expect(filterOpportunities(state, { sectors: ['housing'] }).map((o) => o.id)).toEqual([OPPORTUNITY_IDS.housing]);
    expect(filterOpportunities(state, { sectors: ['rail', 'accessibility'] }).map((o) => o.id)).toEqual([OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station]);
    expect(filterOpportunities(state, { sectors: [] })).toHaveLength(3);
  });

  it('hides closed opportunities unless includeClosed is set', () => {
    // Move the demo date past the Rail and Station deadlines but before Housing closes.
    const state: AppState = { ...createSeedState(), demoAnchorDate: '2026-10-01' };
    expect(filterOpportunities(state, {}).map((o) => o.id)).toEqual([OPPORTUNITY_IDS.housing]);
    expect(filterOpportunities(state, { includeClosed: true })).toHaveLength(3);
  });

  it('returns every opportunity when no filter is given', () => {
    expect(filterOpportunities(createSeedState(), {})).toHaveLength(3);
  });
});

describe('seed evaluation and ranking', () => {
  it('scores the pristine seed at Rail 78 Conditional GO, Station 53 NO-GO, Housing 67 Conditional GO', () => {
    const state = createSeedState();
    const byId = Object.fromEntries(evaluateAll(state).map((e) => [e.opportunityId, e]));
    expect(byId[OPPORTUNITY_IDS.rail].totalScore).toBe(78);
    expect(byId[OPPORTUNITY_IDS.rail].recommendation).toBe('conditional_go');
    expect(byId[OPPORTUNITY_IDS.station].totalScore).toBe(53);
    expect(byId[OPPORTUNITY_IDS.station].recommendation).toBe('no_go');
    expect(byId[OPPORTUNITY_IDS.housing].totalScore).toBe(67);
    expect(byId[OPPORTUNITY_IDS.housing].recommendation).toBe('conditional_go');
  });

  it('computes days to deadline from the frozen demo date, not the real clock', () => {
    const state = createSeedState();
    const byId = Object.fromEntries(evaluateAll(state).map((e) => [e.opportunityId, e.daysToDeadline]));
    expect(state.demoAnchorDate).toBe('2026-09-03');
    expect(byId[OPPORTUNITY_IDS.rail]).toBe(26);
    expect(byId[OPPORTUNITY_IDS.station]).toBe(20);
    expect(byId[OPPORTUNITY_IDS.housing]).toBe(44);
  });

  it('ranks by total score, then by recommendation, without mutating the input', () => {
    const state = createSeedState();
    const evaluations = evaluateAll(state);
    const inputOrder = evaluations.map((e) => e.opportunityId);
    const ranked = rankEvaluations(evaluations).map((e) => e.opportunityId);
    expect(ranked).toEqual([OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.housing, OPPORTUNITY_IDS.station]);
    expect(evaluations.map((e) => e.opportunityId)).toEqual(inputOrder);

    const tieNoGo = { opportunityId: 'tie-no-go', totalScore: 70, recommendation: 'no_go' } as unknown as OpportunityEvaluation;
    const tieConditional = { opportunityId: 'tie-conditional', totalScore: 70, recommendation: 'conditional_go' } as unknown as OpportunityEvaluation;
    const tieGo = { opportunityId: 'tie-go', totalScore: 70, recommendation: 'go' } as unknown as OpportunityEvaluation;
    expect(rankEvaluations([tieNoGo, tieConditional, tieGo]).map((e) => e.opportunityId)).toEqual(['tie-go', 'tie-conditional', 'tie-no-go']);
  });

  it('uses weights that sum to one and thresholds in the documented order', () => {
    const total = Object.values(DIMENSION_WEIGHTS).reduce((sum, d) => sum + d.weight, 0);
    expect(Math.round(total * 1000) / 1000).toBe(1);
    expect(DIMENSION_WEIGHTS.compliance.weight).toBe(0.3);
    expect(DIMENSION_WEIGHTS.experience.weight).toBe(0.2);
    expect(DIMENSION_WEIGHTS.capacity.weight).toBe(0.2);
    expect(DIMENSION_WEIGHTS.readiness.weight).toBe(0.15);
    expect(DIMENSION_WEIGHTS.strategic_fit.weight).toBe(0.1);
    expect(DIMENSION_WEIGHTS.risk_readiness.weight).toBe(0.05);
    expect(NO_GO_THRESHOLD).toBe(65);
    expect(CONDITIONAL_CAP).toBe(79);
    expect(GO_THRESHOLD).toBe(80);
  });

  it('returns null for an unknown opportunity id', () => {
    expect(evaluateOpportunity(createSeedState(), 'opp-does-not-exist')).toBeNull();
  });
});

describe('gate logic', () => {
  it('NO-GO: an unmitigable mandatory failure disqualifies regardless of score', () => {
    const state = createSeedState();
    const station = evaluateOpportunity(state, OPPORTUNITY_IDS.station)!;
    expect(station.recommendation).toBe('no_go');
    expect(station.unmitigableGaps).toEqual(['STA-02']);
    expect(station.rationale).toContain('Disqualified');
    expect(station.nextAction).toContain('Do not pursue');

    // Even a strong profile cannot rescue the pursuit while the accessibility-station count is zero.
    const strong = seedWith({ jvPartnerConfirmed: true, jvCombinedBondingUsd: 60_000_000, availableProjectManagers: 3, backlogUtilizationPct: 50 });
    const stillNoGo = evaluateOpportunity(strong, OPPORTUNITY_IDS.station)!;
    expect(stillNoGo.recommendation).toBe('no_go');
    expect(stillNoGo.unmitigableGaps).toEqual(['STA-02']);

    // Only the disqualifying fact itself can change the outcome.
    const qualified = seedWith({ jvPartnerConfirmed: true, jvCombinedBondingUsd: 60_000_000, availableProjectManagers: 3, backlogUtilizationPct: 50, accessibilityStationProjects: 3 });
    const rescued = evaluateOpportunity(qualified, OPPORTUNITY_IDS.station)!;
    expect(rescued.unmitigableGaps).toEqual([]);
    expect(rescued.recommendation).not.toBe('no_go');
  });

  it('NO-GO: a poor safety record is treated as an unmitigable failure', () => {
    const state = seedWith({ safetyRecord: 'poor' });
    const rail = evaluateOpportunity(state, OPPORTUNITY_IDS.rail)!;
    expect(rail.recommendation).toBe('no_go');
    expect(rail.unmitigableGaps).toContain('RAIL-05');
    const safety = requirement(state, OPPORTUNITY_IDS.rail, 'RAIL-05');
    expect(safety.gateEffect).toBe('unmitigable_gap');
    expect(safety.status).toBe('gap');
    expect(safety.severity).toBe('critical');
  });

  it('Conditional GO (capped): a mitigable mandatory capability gap caps the score at 79', () => {
    const ctx = createTestContext();
    let state = createSeedState();
    const seedRail = evaluateOpportunity(state, OPPORTUNITY_IDS.rail)!;
    expect(seedRail.mitigableGaps).toEqual(['RAIL-01']);
    expect(seedRail.capped).toBe(false);

    state = applyCommand(state, { type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent }, ctx).state;
    for (const [id, role] of [
      ['RAIL-01', 'Finance & Bonding'],
      ['RAIL-07', 'JV & Legal'],
      ['RAIL-05', 'Safety Director'],
      ['RAIL-09', 'Scheduler'],
    ] as const) {
      const result = applyCommand(state, { type: 'assign_requirement', requirementId: id, ownerRole: role, dueDate: '2026-09-15', note: '', ...agent }, ctx);
      expect(result.ok).toBe(true);
      state = result.state;
    }
    for (const key of ['bonding-shortfall', 'jv-approval-timing']) {
      const result = applyCommand(
        state,
        {
          type: 'upsert_risk',
          risk: { riskKey: key, title: key, severity: 'high', relatedRequirementIds: ['RAIL-01'], rationale: 'Synthetic rationale.', mitigation: 'Synthetic mitigation.', ownerRole: 'Finance & Bonding', status: 'open' },
          ...agent,
        },
        ctx,
      );
      expect(result.ok).toBe(true);
      state = result.state;
    }

    const rail = evaluateOpportunity(state, OPPORTUNITY_IDS.rail)!;
    expect(rail.rawScore).toBeGreaterThan(CONDITIONAL_CAP);
    expect(rail.totalScore).toBe(CONDITIONAL_CAP);
    expect(rail.capped).toBe(true);
    expect(rail.recommendation).toBe('conditional_go');
    expect(rail.mitigableGaps).toEqual(['RAIL-01']);
    expect(rail.rationale).toContain('capped from');
  });

  it('GO: the JV preset closes the bonding gap and lifts Rail into the GO band', () => {
    const state = seedWith({ jvPartnerConfirmed: true, jvCombinedBondingUsd: 60_000_000 });
    const rail = evaluateOpportunity(state, OPPORTUNITY_IDS.rail)!;
    expect(rail.recommendation).toBe('go');
    expect(rail.totalScore).toBeGreaterThanOrEqual(GO_THRESHOLD);
    expect(rail.mitigableGaps).toEqual([]);
    expect(rail.unmitigableGaps).toEqual([]);
    expect(rail.capped).toBe(false);
    expect(rail.nextAction).toContain('Stage a GO recommendation');
    // Open deliverables still lower the score but never trigger the cap.
    expect(rail.openDeliverables.length).toBeGreaterThan(0);
    expect(effectiveBonding(state.company)).toBe(60_000_000);
  });

  it('Conditional GO (band): no capability gaps and a score between 65 and 79', () => {
    // JV confirmed at exactly the minimum with no aggregate headroom: bonding passes, capacity is modest.
    const state = seedWith({ jvPartnerConfirmed: true, jvCombinedBondingUsd: 30_000_000, aggregateBondingUsd: 28_000_000 });
    const rail = evaluateOpportunity(state, OPPORTUNITY_IDS.rail)!;
    expect(rail.mitigableGaps).toEqual([]);
    expect(rail.unmitigableGaps).toEqual([]);
    expect(rail.capped).toBe(false);
    expect(rail.totalScore).toBeGreaterThanOrEqual(NO_GO_THRESHOLD);
    expect(rail.totalScore).toBeLessThanOrEqual(CONDITIONAL_CAP);
    expect(rail.recommendation).toBe('conditional_go');
    expect(rail.rationale).toContain('conditional band');
  });

  it('NO-GO (band): no gate failures but a weighted score below 65', () => {
    // A synthetic variant of the housing pursuit with weak strategic fit, no headroom, no available PM,
    // and only two days to the deadline. Every mandatory capability is met, so the band decides.
    const seed = createSeedState();
    const state: AppState = {
      ...seed,
      demoAnchorDate: '2026-10-15',
      company: { ...seed.company, completedHousingDevelopments: 2, singleProjectBondingUsd: 15_000_000, aggregateBondingUsd: 15_000_000, availableProjectManagers: 0 },
      opportunities: seed.opportunities.map((o) => (o.id === OPPORTUNITY_IDS.housing ? { ...o, strategicFitScore: 5 } : o)),
    };
    const housing = evaluateOpportunity(state, OPPORTUNITY_IDS.housing)!;
    expect(housing.mitigableGaps).toEqual([]);
    expect(housing.unmitigableGaps).toEqual([]);
    expect(housing.totalScore).toBeLessThan(NO_GO_THRESHOLD);
    expect(housing.recommendation).toBe('no_go');
    expect(housing.rationale).toContain(`below the ${NO_GO_THRESHOLD} threshold`);
  });

  it('classifies every mandatory requirement into exactly one gate bucket', () => {
    const state = createSeedState();
    for (const evaluation of evaluateAll(state)) {
      const mandatoryIds = evaluation.requirements.filter((r) => r.mandatory).map((r) => r.requirementId).sort();
      const bucketed = [
        ...evaluation.passedGates,
        ...evaluation.atRisk,
        ...evaluation.mitigableGaps,
        ...evaluation.unmitigableGaps,
        ...evaluation.openDeliverables,
      ].sort();
      expect(bucketed).toEqual(mandatoryIds);
    }
  });
});

describe('project-manager availability rule (RAIL-04)', () => {
  it('is at risk in the seed because backlog utilization is above 80%', () => {
    const pm = requirement(createSeedState(), OPPORTUNITY_IDS.rail, 'RAIL-04');
    expect(pm.status).toBe('at_risk');
    expect(pm.gateEffect).toBe('at_risk');
    expect(pm.met).toBe(false);
    expect(pm.severity).toBe('medium');
    expect(pm.finding).toContain('82%');
  });

  it('becomes satisfied when backlog utilization drops to 80% or below', () => {
    const pm = requirement(seedWith({ backlogUtilizationPct: 80 }), OPPORTUNITY_IDS.rail, 'RAIL-04');
    expect(pm.status).toBe('satisfied');
    expect(pm.gateEffect).toBe('pass');
    expect(pm.met).toBe(true);
  });

  it('becomes complete when the human documents availability, even with high backlog', () => {
    const state: AppState = { ...createSeedState(), completedRequirementIds: ['RAIL-04'] };
    const pm = requirement(state, OPPORTUNITY_IDS.rail, 'RAIL-04');
    expect(pm.status).toBe('complete');
    expect(pm.gateEffect).toBe('pass');
    expect(pm.met).toBe(true);
    expect(pm.finding).toContain('Availability documented');
    expect(evaluateOpportunity(state, OPPORTUNITY_IDS.rail)!.atRisk).toEqual([]);
  });

  it('shows as assigned while still at risk once an owner is attached', () => {
    const seed = createSeedState();
    const state: AppState = {
      ...seed,
      assignments: {
        'RAIL-04': {
          requirementId: 'RAIL-04',
          opportunityId: OPPORTUNITY_IDS.rail,
          ownerRole: 'Operations Lead',
          dueDate: '2026-09-10',
          note: '',
          assignedBy: 'agent',
          createdAt: '2026-09-03T14:00:00.000Z',
          updatedAt: '2026-09-03T14:00:00.000Z',
        },
      },
    };
    const pm = requirement(state, OPPORTUNITY_IDS.rail, 'RAIL-04');
    expect(pm.status).toBe('assigned');
    expect(pm.gateEffect).toBe('at_risk');
    expect(pm.ownerRole).toBe('Operations Lead');
    expect(pm.dueDate).toBe('2026-09-10');
  });

  it('becomes a mitigable capability gap when no project manager is available', () => {
    const state = seedWith({ availableProjectManagers: 0 });
    const pm = requirement(state, OPPORTUNITY_IDS.rail, 'RAIL-04');
    expect(pm.status).toBe('gap');
    expect(pm.gateEffect).toBe('mitigable_gap');
    expect(evaluateOpportunity(state, OPPORTUNITY_IDS.rail)!.mitigableGaps).toContain('RAIL-04');
  });
});

describe('JV approval package rule (RAIL-07)', () => {
  it('applies in the seed because single-project bonding is below the $30M minimum', () => {
    const jv = requirement(createSeedState(), OPPORTUNITY_IDS.rail, 'RAIL-07');
    expect(jv.gateEffect).toBe('deliverable_open');
    expect(jv.status).toBe('gap');
    expect(jv.finding).toContain('A JV is the only path');
  });

  it('is not applicable when single bonding covers the minimum and no JV is confirmed', () => {
    const state = seedWith({ singleProjectBondingUsd: 35_000_000 });
    const jv = requirement(state, OPPORTUNITY_IDS.rail, 'RAIL-07');
    expect(jv.gateEffect).toBe('not_applicable');
    expect(jv.status).toBe('satisfied');
    expect(jv.finding).toContain('Not required unless');
    expect(requirement(state, OPPORTUNITY_IDS.rail, 'RAIL-01').gateEffect).toBe('pass');
  });

  it('applies whenever a JV partner is confirmed, even if single bonding would have sufficed', () => {
    const state = seedWith({ singleProjectBondingUsd: 35_000_000, jvPartnerConfirmed: true, jvCombinedBondingUsd: 60_000_000 });
    const jv = requirement(state, OPPORTUNITY_IDS.rail, 'RAIL-07');
    expect(jv.gateEffect).toBe('deliverable_open');
    expect(jv.finding).toContain('JV partner confirmed');
  });

  it('is complete once the package is filed', () => {
    const state: AppState = { ...seedWith({ jvPartnerConfirmed: true, jvCombinedBondingUsd: 60_000_000 }), completedRequirementIds: ['RAIL-07'] };
    const jv = requirement(state, OPPORTUNITY_IDS.rail, 'RAIL-07');
    expect(jv.status).toBe('complete');
    expect(jv.finding).toBe('JV approval package filed.');
  });
});

describe('other requirement rules', () => {
  it('reports DBE certification in the participation finding', () => {
    expect(requirement(createSeedState(), OPPORTUNITY_IDS.rail, 'RAIL-06').finding).toContain('DBE-certified');
    expect(requirement(seedWith({ dbeCertified: false }), OPPORTUNITY_IDS.rail, 'RAIL-06').finding).toContain('subcontractor commitments');
  });

  it('assigning an open deliverable raises the score without changing the recommendation band', () => {
    const seed = createSeedState();
    const before = evaluateOpportunity(seed, OPPORTUNITY_IDS.rail)!;
    const state: AppState = {
      ...seed,
      assignments: {
        'RAIL-09': {
          requirementId: 'RAIL-09',
          opportunityId: OPPORTUNITY_IDS.rail,
          ownerRole: 'Scheduler',
          dueDate: '2026-09-20',
          note: '',
          assignedBy: 'agent',
          createdAt: '2026-09-03T14:00:00.000Z',
          updatedAt: '2026-09-03T14:00:00.000Z',
        },
      },
    };
    const assigned = requirement(state, OPPORTUNITY_IDS.rail, 'RAIL-09');
    expect(assigned.status).toBe('assigned');
    expect(assigned.gateEffect).toBe('deliverable_open');
    expect(assigned.ownerRole).toBe('Scheduler');
    const after = evaluateOpportunity(state, OPPORTUNITY_IDS.rail)!;
    expect(after.rawScore).toBeGreaterThan(before.rawScore);
    expect(after.recommendation).toBe(before.recommendation);
    expect(after.capped).toBe(false);
  });

  it('lists score drivers that name the JV path, the backlog lever, and unassigned deliverables', () => {
    const rail = evaluateOpportunity(createSeedState(), OPPORTUNITY_IDS.rail)!;
    expect(rail.scoreDrivers.some((d) => d.includes('JV partner'))).toBe(true);
    expect(rail.scoreDrivers.some((d) => d.includes('backlog utilization below 80%'))).toBe(true);
    expect(rail.scoreDrivers.some((d) => d.includes('unassigned'))).toBe(true);
  });
});

describe('simulateProfileChange', () => {
  it('previews the JV preset without mutating the state or the profile', () => {
    const state = createSeedState();
    const snapshot = JSON.stringify(state);
    const deltas = simulateProfileChange(state, { jvPartnerConfirmed: true, jvCombinedBondingUsd: 60_000_000 });
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(state.company.jvPartnerConfirmed).toBe(false);
    expect(state.stateVersion).toBe(1);
    expect(state.activity).toEqual([]);

    expect(deltas.map((d) => d.opportunityId)).toEqual([OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station, OPPORTUNITY_IDS.housing]);
    const rail = deltas[0];
    expect(rail.scoreBefore).toBe(78);
    expect(rail.recommendationBefore).toBe('conditional_go');
    expect(rail.recommendationAfter).toBe('go');
    expect(rail.scoreAfter).toBeGreaterThanOrEqual(GO_THRESHOLD);
    expect(rail.gapsClosed).toEqual(['RAIL-01']);
    expect(rail.gapsOpened).toEqual([]);

    const station = deltas[1];
    expect(station.recommendationAfter).toBe('no_go');
    expect(station.gapsClosed).toEqual(['STA-01']);

    const housing = deltas[2];
    expect(housing.scoreBefore).toBe(housing.scoreAfter);
    expect(housing.gapsClosed).toEqual([]);
  });

  it('reports no change when the simulated values equal the current profile', () => {
    const state = createSeedState();
    for (const delta of simulateProfileChange(state, { backlogUtilizationPct: 82 })) {
      expect(delta.scoreBefore).toBe(delta.scoreAfter);
      expect(delta.recommendationBefore).toBe(delta.recommendationAfter);
    }
  });
});

describe('evaluation summaries', () => {
  it('detects score, recommendation, and gap differences', () => {
    const before = evaluateOpportunity(createSeedState(), OPPORTUNITY_IDS.rail)!;
    const after = evaluateOpportunity(seedWith({ jvPartnerConfirmed: true, jvCombinedBondingUsd: 60_000_000 }), OPPORTUNITY_IDS.rail)!;
    const a = summarizeEvaluation(before, 1);
    const b = summarizeEvaluation(after, 2);
    expect(summariesDiffer(a, b)).toBe(true);
    expect(summariesDiffer(a, summarizeEvaluation(before, 9))).toBe(false);
    const delta = diffEvaluations(before, after);
    expect(delta.gapsClosed).toEqual(['RAIL-01']);
    expect(delta.scoreBefore).toBe(78);
    expect(delta.recommendationAfter).toBe('go');
  });
});
