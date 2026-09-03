/**
 * Domain tests for the single write path (src/store/reducer.ts) and the store.
 *
 * Human-only boundaries, idempotent writes, error codes, staleness, and the
 * audit log are all exercised here with a deterministic reducer context.
 */
import { describe, expect, it } from 'vitest';
import { createSeedCompany, createSeedState, OPPORTUNITY_IDS } from '../src/data/seed';
import { evaluateOpportunity } from '../src/domain/evaluateOpportunity';
import { selectDecisionStatus, selectEventsSince } from '../src/domain/selectors';
import { applyCommand, createTestContext, type ReducerContext } from '../src/store/reducer';
import { createStore } from '../src/store/store';
import type { AppState, Command, CommandResult, OwnerRole, StagedDecisionInput } from '../src/store/types';

const agent = { actor: 'agent', channel: 'webmcp', tool: 'civicbid_test_tool' } as const;
const console_ = { actor: 'agent', channel: 'console', tool: 'civicbid_test_tool' } as const;
const human = { actor: 'human', channel: 'ui' } as const;

const RATIONALE = 'Rail is the strongest pursuit: bonding is the only mandatory gap and a JV closes it before bid day.';

const decisionInput = (recommendation: StagedDecisionInput['recommendation'], overrides: Partial<StagedDecisionInput> = {}): StagedDecisionInput => ({
  recommendation,
  rationale: RATIONALE,
  conditions: ['Confirm the JV partner and combined surety letter.'],
  assumptions: ['Night possessions are available as published.'],
  confidence: 72,
  ...overrides,
});

function ok(result: CommandResult): Extract<CommandResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected success, got ${result.error.code}: ${result.error.message}`);
  return result;
}

function failed(result: CommandResult): Extract<CommandResult, { ok: false }> {
  if (result.ok) throw new Error('Expected failure, got success');
  return result;
}

/** Applies commands in order, asserting each succeeds, and returns the final state. */
function run(state: AppState, commands: Command[], ctx: ReducerContext): AppState {
  let current = state;
  for (const command of commands) current = ok(applyCommand(current, command, ctx)).state;
  return current;
}

function openRail(ctx: ReducerContext): AppState {
  return run(createSeedState(), [{ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent }], ctx);
}

function assign(requirementId: string, ownerRole: OwnerRole, dueDate = '2026-09-15', note = ''): Command {
  return { type: 'assign_requirement', requirementId, ownerRole, dueDate, note, ...agent };
}

describe('select and compare', () => {
  it('opens the workspace, logs a versioned event with provenance, and is idempotent', () => {
    const ctx = createTestContext();
    const seed = createSeedState();
    const first = ok(applyCommand(seed, { type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent }, ctx));
    expect(first.noop).toBe(false);
    expect(first.state.selectedOpportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect(first.state.ui.visiblePanel).toBe('workspace');
    expect(first.state.stateVersion).toBe(2);
    expect(first.event).not.toBeNull();
    expect(first.event!.actor).toBe('agent');
    expect(first.event!.channel).toBe('webmcp');
    expect(first.event!.tool).toBe('civicbid_test_tool');
    expect(first.event!.stateVersionBefore).toBe(1);
    expect(first.event!.stateVersionAfter).toBe(2);
    expect(first.event!.opportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect(first.event!.title).toContain('Agent opened Rail Fastener Renewal Program');
    expect(first.event!.detail).toContain('score 78');
    expect(first.state.ui.lastToast?.id).toBe(first.event!.id);

    const again = ok(applyCommand(first.state, { type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent }, ctx));
    expect(again.noop).toBe(true);
    expect(again.state).toBe(first.state);
    expect(again.state.stateVersion).toBe(2);
  });

  it('clears the requirement focus when switching to another opportunity', () => {
    const ctx = createTestContext();
    const focused = run(openRail(ctx), [{ type: 'focus_requirements', requirementIds: ['RAIL-01'], mode: 'replace', reason: 'Bonding gap.', ...agent }], ctx);
    expect(focused.focusedRequirementIds).toEqual(['RAIL-01']);
    const switched = run(focused, [{ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.station, ...agent }], ctx);
    expect(switched.focusedRequirementIds).toEqual([]);
    expect(switched.focusReason).toBeNull();
  });

  it('rejects an unknown opportunity with NOT_FOUND and a recovery hint', () => {
    const error = failed(applyCommand(createSeedState(), { type: 'select_opportunity', opportunityId: 'opp-nope', ...agent }, createTestContext())).error;
    expect(error.code).toBe('NOT_FOUND');
    expect(error.recovery).toContain(OPPORTUNITY_IDS.rail);
  });

  it('compares two or three distinct opportunities and narrates the strongest', () => {
    const ctx = createTestContext();
    const result = ok(applyCommand(createSeedState(), { type: 'compare_opportunities', opportunityIds: [OPPORTUNITY_IDS.station, OPPORTUNITY_IDS.rail], ...agent }, ctx));
    expect(result.state.comparisonIds).toEqual([OPPORTUNITY_IDS.station, OPPORTUNITY_IDS.rail]);
    expect(result.state.ui.visiblePanel).toBe('comparison');
    expect(result.event!.detail).toContain('Strongest: Rail Fastener Renewal Program at 78');

    const one = failed(applyCommand(createSeedState(), { type: 'compare_opportunities', opportunityIds: [OPPORTUNITY_IDS.rail], ...agent }, ctx));
    expect(one.error.code).toBe('INVALID_INPUT');
    const duplicate = failed(applyCommand(createSeedState(), { type: 'compare_opportunities', opportunityIds: [OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.rail], ...agent }, ctx));
    expect(duplicate.error.code).toBe('INVALID_INPUT');
    const unknown = failed(applyCommand(createSeedState(), { type: 'compare_opportunities', opportunityIds: [OPPORTUNITY_IDS.rail, 'opp-nope'], ...agent }, ctx));
    expect(unknown.error.code).toBe('NOT_FOUND');
    expect(unknown.error.message).toContain('opp-nope');
  });
});

describe('focus_requirements', () => {
  it('replaces, adds, and treats an identical focus as a no-op', () => {
    const ctx = createTestContext();
    let state = openRail(ctx);
    state = run(state, [{ type: 'focus_requirements', requirementIds: ['RAIL-01', 'RAIL-02'], mode: 'replace', reason: 'Mandatory gates.', ...agent }], ctx);
    expect(state.focusedRequirementIds).toEqual(['RAIL-01', 'RAIL-02']);
    expect(state.focusReason).toBe('Mandatory gates.');

    state = run(state, [{ type: 'focus_requirements', requirementIds: ['RAIL-03', 'RAIL-01'], mode: 'add', reason: 'Add experience.', ...agent }], ctx);
    expect(state.focusedRequirementIds).toEqual(['RAIL-01', 'RAIL-02', 'RAIL-03']);
    expect(state.focusReason).toBe('Add experience.');

    const same = ok(applyCommand(state, { type: 'focus_requirements', requirementIds: ['RAIL-01', 'RAIL-02', 'RAIL-03'], mode: 'replace', reason: 'Add experience.', ...agent }, ctx));
    expect(same.noop).toBe(true);

    state = run(state, [{ type: 'focus_requirements', requirementIds: ['RAIL-04'], mode: 'replace', reason: 'Only the PM.', ...agent }], ctx);
    expect(state.focusedRequirementIds).toEqual(['RAIL-04']);

    const cleared = ok(applyCommand(state, { type: 'clear_focus', ...human }, ctx));
    expect(cleared.state.focusedRequirementIds).toEqual([]);
    expect(ok(applyCommand(cleared.state, { type: 'clear_focus', ...human }, ctx)).noop).toBe(true);
  });

  it('validates the selection, ids, mode, count, and reason', () => {
    const ctx = createTestContext();
    const noSelection = failed(applyCommand(createSeedState(), { type: 'focus_requirements', requirementIds: ['RAIL-01'], mode: 'replace', reason: 'x', ...agent }, ctx));
    expect(noSelection.error.code).toBe('NO_OPPORTUNITY_SELECTED');
    expect(noSelection.error.recovery).toContain('civicbid_open_opportunity');

    const state = openRail(ctx);
    expect(failed(applyCommand(state, { type: 'focus_requirements', requirementIds: [], mode: 'replace', reason: 'x', ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'focus_requirements', requirementIds: ['RAIL-01'], mode: 'toggle' as 'add', reason: 'x', ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'focus_requirements', requirementIds: ['RAIL-01'], mode: 'replace', reason: '   ', ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'focus_requirements', requirementIds: ['not-an-id'], mode: 'replace', reason: 'x', ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'focus_requirements', requirementIds: ['RAIL-99'], mode: 'replace', reason: 'x', ...agent }, ctx)).error.code).toBe('NOT_FOUND');
    const wrongOpportunity = failed(applyCommand(state, { type: 'focus_requirements', requirementIds: ['STA-01'], mode: 'replace', reason: 'x', ...agent }, ctx));
    expect(wrongOpportunity.error.code).toBe('REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY');
    expect(wrongOpportunity.error.recovery).toContain(OPPORTUNITY_IDS.station);
    const eleven = Array.from({ length: 11 }, (_, i) => `RAIL-${String(i + 1).padStart(2, '0')}`);
    expect(failed(applyCommand(state, { type: 'focus_requirements', requirementIds: eleven, mode: 'replace', reason: 'x', ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
  });
});

describe('assign_requirement', () => {
  it('is an idempotent upsert that records only the fields that changed', () => {
    const ctx = createTestContext();
    const state = openRail(ctx);
    const first = ok(applyCommand(state, assign('RAIL-01', 'Finance & Bonding', '2026-09-12', 'Get the surety letter.'), ctx));
    expect(first.changed).toEqual(['assignments.RAIL-01']);
    expect(first.event!.title).toContain('assigned RAIL-01 to Finance & Bonding');
    expect(first.state.assignments['RAIL-01'].assignedBy).toBe('agent');
    expect(first.state.assignments['RAIL-01'].opportunityId).toBe(OPPORTUNITY_IDS.rail);
    const createdAt = first.state.assignments['RAIL-01'].createdAt;

    const repeat = ok(applyCommand(first.state, assign('RAIL-01', 'Finance & Bonding', '2026-09-12', 'Get the surety letter.'), ctx));
    expect(repeat.noop).toBe(true);
    expect(repeat.state).toBe(first.state);
    expect(repeat.state.stateVersion).toBe(first.state.stateVersion);

    const updated = ok(applyCommand(first.state, assign('RAIL-01', 'Finance & Bonding', '2026-09-14', 'Get the surety letter.'), ctx));
    expect(updated.noop).toBe(false);
    expect(updated.changed).toEqual(['assignments.RAIL-01.dueDate']);
    expect(updated.event!.title).toContain('updated the assignment for RAIL-01');
    expect(updated.state.assignments['RAIL-01'].createdAt).toBe(createdAt);
    expect(updated.state.assignments['RAIL-01'].updatedAt).not.toBe(createdAt);
    expect(Object.keys(updated.state.assignments)).toEqual(['RAIL-01']);

    const reassigned = ok(applyCommand(updated.state, assign('RAIL-01', 'JV & Legal', '2026-09-14', ''), ctx));
    expect(reassigned.changed).toEqual(['assignments.RAIL-01.ownerRole', 'assignments.RAIL-01.note']);
  });

  it('rejects bad ids, roles, dates, and notes with specific codes', () => {
    const ctx = createTestContext();
    expect(failed(applyCommand(createSeedState(), assign('RAIL-01', 'Finance & Bonding'), ctx)).error.code).toBe('NO_OPPORTUNITY_SELECTED');
    const state = openRail(ctx);
    expect(failed(applyCommand(state, assign('bogus', 'Finance & Bonding'), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, assign('RAIL-99', 'Finance & Bonding'), ctx)).error.code).toBe('NOT_FOUND');
    expect(failed(applyCommand(state, assign('HSG-01', 'Finance & Bonding'), ctx)).error.code).toBe('REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY');
    const badRole = failed(applyCommand(state, assign('RAIL-01', 'Chief Wizard' as 'Scheduler'), ctx));
    expect(badRole.error.code).toBe('INVALID_INPUT');
    expect(badRole.error.recovery).toContain('Finance & Bonding');
    expect(failed(applyCommand(state, assign('RAIL-01', 'Finance & Bonding', '2026-02-30'), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, assign('RAIL-01', 'Finance & Bonding', 'next week'), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, assign('RAIL-01', 'Finance & Bonding', '2026-09-15', 'x'.repeat(301)), ctx)).error.code).toBe('INVALID_INPUT');
  });

  it('warns, without failing, when a due date falls after the bid deadline or before the demo date', () => {
    const ctx = createTestContext();
    const state = openRail(ctx);
    const late = ok(applyCommand(state, assign('RAIL-01', 'Finance & Bonding', '2026-10-15'), ctx));
    expect(late.warnings.some((w) => w.includes('after the bid deadline'))).toBe(true);
    const early = ok(applyCommand(state, assign('RAIL-01', 'Finance & Bonding', '2026-08-01'), ctx));
    expect(early.warnings.some((w) => w.includes('before the demo date'))).toBe(true);
    const fine = ok(applyCommand(state, assign('RAIL-01', 'Finance & Bonding', '2026-09-15'), ctx));
    expect(fine.warnings).toEqual([]);
  });
});

describe('upsert_risk', () => {
  const risk = (overrides: Partial<Extract<Command, { type: 'upsert_risk' }>['risk']> = {}): Command => ({
    type: 'upsert_risk',
    risk: {
      riskKey: 'bonding-shortfall',
      title: 'Single-project bonding is $5M short',
      severity: 'critical',
      relatedRequirementIds: ['RAIL-01', 'RAIL-07'],
      rationale: 'Bonding is $25M against a $30M minimum.',
      mitigation: 'Confirm the JV partner and obtain a combined surety letter.',
      ownerRole: 'Finance & Bonding',
      status: 'open',
      ...overrides,
    },
    ...agent,
  });

  it('is idempotent by riskKey within the open opportunity', () => {
    const ctx = createTestContext();
    const state = openRail(ctx);
    const first = ok(applyCommand(state, risk(), ctx));
    expect(first.changed).toEqual(['risks.bonding-shortfall']);
    expect(first.event!.title).toContain('added risk');
    expect(first.state.risks).toHaveLength(1);
    expect(first.state.risks[0].createdBy).toBe('agent');

    const repeat = ok(applyCommand(first.state, risk(), ctx));
    expect(repeat.noop).toBe(true);
    expect(repeat.state.risks).toHaveLength(1);

    const updated = ok(applyCommand(first.state, risk({ severity: 'high', status: 'mitigating' }), ctx));
    expect(updated.noop).toBe(false);
    expect(updated.event!.title).toContain('updated risk');
    expect(updated.state.risks).toHaveLength(1);
    expect(updated.state.risks[0].severity).toBe('high');
    expect(updated.state.risks[0].status).toBe('mitigating');
    expect(updated.state.risks[0].createdAt).toBe(first.state.risks[0].createdAt);

    const second = ok(applyCommand(updated.state, risk({ riskKey: 'pm-availability', title: 'PM release not documented', relatedRequirementIds: ['RAIL-04'] }), ctx));
    expect(second.state.risks.map((r) => r.riskKey)).toEqual(['bonding-shortfall', 'pm-availability']);
  });

  it('validates keys, titles, enums, lengths, and related requirement ids', () => {
    const ctx = createTestContext();
    expect(failed(applyCommand(createSeedState(), risk(), ctx)).error.code).toBe('NO_OPPORTUNITY_SELECTED');
    const state = openRail(ctx);
    expect(failed(applyCommand(state, risk({ riskKey: 'Bad Key' }), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, risk({ title: '' }), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, risk({ severity: 'extreme' as 'high' }), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, risk({ ownerRole: 'Nobody' as 'Scheduler' }), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, risk({ status: 'closed' as 'open' }), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, risk({ mitigation: 'm'.repeat(501) }), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, risk({ relatedRequirementIds: ['RAIL-01', 'RAIL-02', 'RAIL-03', 'RAIL-04', 'RAIL-05', 'RAIL-06'] }), ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, risk({ relatedRequirementIds: ['STA-02'] }), ctx)).error.code).toBe('REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY');
    expect(failed(applyCommand(state, risk({ relatedRequirementIds: ['RAIL-42'] }), ctx)).error.code).toBe('NOT_FOUND');
  });
});

describe('stage_decision', () => {
  it('stages a pending decision and never sets approval', () => {
    const ctx = createTestContext();
    const state = openRail(ctx);
    const staged = ok(applyCommand(state, { type: 'stage_decision', input: decisionInput('conditional_go'), ...agent }, ctx));
    const decision = staged.state.stagedDecision!;
    expect(decision.status).toBe('pending');
    expect(decision.stagedBy).toBe('agent');
    expect(decision.recommendation).toBe('conditional_go');
    expect(decision.supersedesDecisionId).toBeNull();
    expect(decision.stale).toBe(false);
    expect(decision.evaluationSnapshot.totalScore).toBe(78);
    expect(decision.evaluationSnapshot.mitigableGaps).toEqual(['RAIL-01']);
    expect(staged.state.approval).toBeNull();
    expect(selectDecisionStatus(staged.state)).toBe('pending');
    expect(staged.changed).toEqual(['stagedDecision', 'approval']);
    expect(staged.event!.detail).toContain('Human approval is still required');
  });

  it('rejects a GO or Conditional GO that contradicts an unmitigable gate failure', () => {
    const ctx = createTestContext();
    const state = run(createSeedState(), [{ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.station, ...agent }], ctx);
    for (const recommendation of ['go', 'conditional_go'] as const) {
      const rejected = failed(applyCommand(state, { type: 'stage_decision', input: decisionInput(recommendation), ...agent }, ctx));
      expect(rejected.error.code).toBe('INVALID_INPUT');
      expect(rejected.error.message).toContain('STA-02');
      expect(rejected.error.recovery).toContain('no_go');
    }
    const accepted = ok(applyCommand(state, { type: 'stage_decision', input: decisionInput('no_go'), ...agent }, ctx));
    expect(accepted.state.stagedDecision!.recommendation).toBe('no_go');
  });

  it('validates rationale length, list sizes, and confidence', () => {
    const ctx = createTestContext();
    const state = openRail(ctx);
    expect(failed(applyCommand(state, { type: 'stage_decision', input: decisionInput('go', { rationale: 'Too short.' }), ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'stage_decision', input: decisionInput('go', { confidence: 101 }), ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'stage_decision', input: decisionInput('go', { confidence: 7.5 }), ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'stage_decision', input: decisionInput('go', { conditions: Array.from({ length: 9 }, () => 'c') }), ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'stage_decision', input: decisionInput('maybe' as 'go'), ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(createSeedState(), { type: 'stage_decision', input: decisionInput('go'), ...agent }, ctx)).error.code).toBe('NO_OPPORTUNITY_SELECTED');
  });

  it('re-staging while pending supersedes the previous decision and keeps it in history', () => {
    const ctx = createTestContext();
    let state = openRail(ctx);
    state = run(state, [{ type: 'stage_decision', input: decisionInput('conditional_go'), ...agent }], ctx);
    const firstId = state.stagedDecision!.id;
    const revised = ok(applyCommand(state, { type: 'stage_decision', input: decisionInput('conditional_go', { confidence: 80 }), ...agent }, ctx));
    expect(revised.state.stagedDecision!.id).not.toBe(firstId);
    expect(revised.state.stagedDecision!.supersedesDecisionId).toBe(firstId);
    expect(revised.state.decisionHistory.map((d) => d.id)).toEqual([firstId]);
    expect(revised.event!.title).toContain('revised from Conditional GO');
    expect(revised.changed).toEqual(['stagedDecision', 'approval', 'decisionHistory']);
  });
});

describe('approve_decision and reject_decision are human-only through the interface', () => {
  function pendingRail(ctx: ReducerContext): AppState {
    return run(openRail(ctx), [{ type: 'stage_decision', input: decisionInput('conditional_go'), ...agent }], ctx);
  }

  it('returns HUMAN_ONLY_ACTION for the agent on any channel and for a human off the interface', () => {
    const ctx = createTestContext();
    const state = pendingRail(ctx);
    const attempts = [
      { type: 'approve_decision', note: '', ...agent },
      { type: 'approve_decision', note: '', ...console_ },
      { type: 'reject_decision', note: '', ...agent },
      { type: 'approve_decision', note: '', actor: 'human', channel: 'webmcp' },
      { type: 'approve_decision', note: '', actor: 'system', channel: 'system' },
    ] as const;
    for (const attempt of attempts) {
      const result = failed(applyCommand(state, attempt, ctx));
      expect(result.error.code).toBe('HUMAN_ONLY_ACTION');
      expect(result.error.recovery).toContain('ask the human');
      expect(result.state).toBe(state);
    }
    expect(state.approval).toBeNull();
    expect(selectDecisionStatus(state)).toBe('pending');
  });

  it('approves only a pending decision and records a human approval snapshot', () => {
    const ctx = createTestContext();
    expect(failed(applyCommand(openRail(ctx), { type: 'approve_decision', note: '', ...human }, ctx)).error.code).toBe('DECISION_NOT_PENDING');

    const state = pendingRail(ctx);
    const approved = ok(applyCommand(state, { type: 'approve_decision', note: 'Proceed once the JV letter is in hand.', ...human }, ctx));
    expect(approved.state.approval).not.toBeNull();
    expect(approved.state.approval!.status).toBe('approved');
    expect(approved.state.approval!.decidedBy).toBe('human');
    expect(approved.state.approval!.decisionId).toBe(state.stagedDecision!.id);
    expect(approved.state.approval!.note).toBe('Proceed once the JV letter is in hand.');
    expect(approved.state.approval!.evaluationSnapshot.totalScore).toBe(78);
    expect(approved.state.stagedDecision!.status).toBe('approved');
    expect(selectDecisionStatus(approved.state)).toBe('approved');
    expect(approved.event!.actor).toBe('human');
    expect(approved.event!.channel).toBe('ui');
    expect(approved.event!.title).toContain('Human approved Conditional GO');

    expect(failed(applyCommand(approved.state, { type: 'approve_decision', note: '', ...human }, ctx)).error.code).toBe('DECISION_NOT_PENDING');
    expect(failed(applyCommand(approved.state, { type: 'reject_decision', note: '', ...human }, ctx)).error.code).toBe('DECISION_NOT_PENDING');
  });

  it('rejects a pending decision and blocks the brief afterwards', () => {
    const ctx = createTestContext();
    const rejected = ok(applyCommand(pendingRail(ctx), { type: 'reject_decision', note: 'Not this quarter.', ...human }, ctx));
    expect(rejected.state.approval!.status).toBe('rejected');
    expect(rejected.state.stagedDecision!.status).toBe('rejected');
    expect(selectDecisionStatus(rejected.state)).toBe('rejected');
    const brief = failed(applyCommand(rejected.state, { type: 'generate_owner_brief', options: { maximumWords: 260, emphasis: [], title: null }, ...agent }, ctx));
    expect(brief.error.code).toBe('DECISION_NOT_APPROVED');
    expect(brief.error.message).toContain('rejected');
  });

  it('truncates an over-long approval note to 300 characters', () => {
    const ctx = createTestContext();
    const approved = ok(applyCommand(pendingRail(ctx), { type: 'approve_decision', note: 'n'.repeat(500), ...human }, ctx));
    expect(approved.state.approval!.note).toHaveLength(300);
  });
});

describe('company profile is human-only', () => {
  it('rejects agent profile edits and points to the simulate tool', () => {
    const ctx = createTestContext();
    const state = createSeedState();
    const edit = failed(applyCommand(state, { type: 'update_company_profile', changes: { jvPartnerConfirmed: true }, label: 'confirmed JV', ...agent }, ctx));
    expect(edit.error.code).toBe('HUMAN_ONLY_ACTION');
    expect(edit.error.recovery).toContain('civicbid_simulate_company_change');
    const preset = failed(applyCommand(state, { type: 'apply_jv_preset', ...console_ }, ctx));
    expect(preset.error.code).toBe('HUMAN_ONLY_ACTION');
    expect(state.company.jvPartnerConfirmed).toBe(false);
  });

  it('validates human edits field by field and treats an unchanged edit as a no-op', () => {
    const ctx = createTestContext();
    const state = createSeedState();
    expect(failed(applyCommand(state, { type: 'update_company_profile', changes: { notAField: 1 } as never, label: 'x', ...human }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'update_company_profile', changes: { backlogUtilizationPct: 140 }, label: 'x', ...human }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'update_company_profile', changes: { railYears: -1 }, label: 'x', ...human }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'update_company_profile', changes: { safetyRecord: 'excellent' as 'strong' }, label: 'x', ...human }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(state, { type: 'update_company_profile', changes: { name: '' }, label: 'x', ...human }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(ok(applyCommand(state, { type: 'update_company_profile', changes: { backlogUtilizationPct: 82 }, label: 'same', ...human }, ctx)).noop).toBe(true);
  });

  it('the JV preset marks a pending decision stale with a reason and logs the profile change', () => {
    const ctx = createTestContext();
    const pending = run(openRail(ctx), [{ type: 'stage_decision', input: decisionInput('conditional_go'), ...agent }], ctx);
    const preset = ok(applyCommand(pending, { type: 'apply_jv_preset', ...human }, ctx));

    expect(preset.state.company.jvPartnerConfirmed).toBe(true);
    expect(preset.state.company.jvCombinedBondingUsd).toBe(60_000_000);
    const decision = preset.state.stagedDecision!;
    expect(decision.status).toBe('pending');
    expect(decision.stale).toBe(true);
    expect(decision.staleReason).toContain('Qualified JV partner confirmed');
    expect(decision.staleReason).toContain('Conditional GO → GO');
    expect(decision.staleReason).toContain('Reevaluate and re-stage before approval');

    const event = preset.event!;
    expect(event.actor).toBe('human');
    expect(event.title).toBe('Human confirmed the JV package');
    expect(event.profileChanges.map((c) => c.field).sort()).toEqual(['jvCombinedBondingUsd', 'jvPartnerConfirmed']);
    expect(event.evaluationDelta!.opportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect(event.evaluationDelta!.recommendationBefore).toBe('conditional_go');
    expect(event.evaluationDelta!.recommendationAfter).toBe('go');
    expect(event.changed).toEqual(['company.jvPartnerConfirmed', 'company.jvCombinedBondingUsd', 'stagedDecision.stale']);
    expect(event.detail).toContain('Evaluation moved');

    // The agent rereads exactly the human events since the version it last saw.
    const since = selectEventsSince(preset.state, pending.stateVersion);
    expect(since.map((e) => e.id)).toEqual([event.id]);

    // A second preset changes nothing and is a no-op.
    expect(ok(applyCommand(preset.state, { type: 'apply_jv_preset', ...human }, ctx)).noop).toBe(true);
  });

  it('a profile change after approval marks the decision stale but leaves the approval intact', () => {
    const ctx = createTestContext();
    const approved = run(
      openRail(ctx),
      [
        { type: 'stage_decision', input: decisionInput('conditional_go'), ...agent },
        { type: 'approve_decision', note: '', ...human },
      ],
      ctx,
    );
    const changed = ok(applyCommand(approved, { type: 'update_company_profile', changes: { backlogUtilizationPct: 70 }, label: 'released backlog', ...human }, ctx));
    const decision = changed.state.stagedDecision!;
    expect(decision.status).toBe('approved');
    expect(decision.stale).toBe(true);
    expect(decision.staleReason).toContain('The approved decision stands as recorded');
    expect(changed.state.approval).toEqual(approved.approval);
    expect(selectDecisionStatus(changed.state)).toBe('approved');
    expect(changed.event!.title).toBe('Human released backlog');
  });

  it('a profile change that does not move the evaluation leaves the decision fresh', () => {
    const ctx = createTestContext();
    const pending = run(openRail(ctx), [{ type: 'stage_decision', input: decisionInput('conditional_go'), ...agent }], ctx);
    const renamed = ok(applyCommand(pending, { type: 'update_company_profile', changes: { name: 'Atlas Civic Infrastructure JV' }, label: 'renamed', ...human }, ctx));
    expect(renamed.state.stagedDecision!.stale).toBe(false);
    expect(renamed.event!.detail).toContain('No evaluation changed');
  });
});

describe('re-stage after approval', () => {
  it('supersedes the approved decision, clears the approval, and narrates the revision', () => {
    const ctx = createTestContext();
    const approved = run(
      openRail(ctx),
      [
        { type: 'stage_decision', input: decisionInput('conditional_go'), ...agent },
        { type: 'approve_decision', note: '', ...human },
        { type: 'apply_jv_preset', ...human },
      ],
      ctx,
    );
    const approvedId = approved.stagedDecision!.id;
    expect(evaluateOpportunity(approved, OPPORTUNITY_IDS.rail)!.recommendation).toBe('go');

    const restaged = ok(applyCommand(approved, { type: 'stage_decision', input: decisionInput('go', { confidence: 85 }), ...agent }, ctx));
    expect(restaged.state.stagedDecision!.id).not.toBe(approvedId);
    expect(restaged.state.stagedDecision!.supersedesDecisionId).toBe(approvedId);
    expect(restaged.state.stagedDecision!.status).toBe('pending');
    expect(restaged.state.stagedDecision!.stale).toBe(false);
    expect(restaged.state.approval).toBeNull();
    expect(selectDecisionStatus(restaged.state)).toBe('pending');
    expect(restaged.state.decisionHistory.map((d) => d.id)).toEqual([approvedId]);
    expect(restaged.state.decisionHistory[0].status).toBe('approved');
    expect(restaged.event!.title).toContain('revised from Conditional GO, previously approved');
  });
});

describe('generate_owner_brief', () => {
  const options = { maximumWords: 260, emphasis: [], title: null } as const;

  it('fails before approval and succeeds after', () => {
    const ctx = createTestContext();
    const none = failed(applyCommand(createSeedState(), { type: 'generate_owner_brief', options: { ...options, emphasis: [] }, ...agent }, ctx));
    expect(none.error.code).toBe('DECISION_NOT_APPROVED');
    expect(none.error.recovery).toContain('civicbid_stage_decision');

    const pending = run(openRail(ctx), [{ type: 'stage_decision', input: decisionInput('conditional_go'), ...agent }], ctx);
    const blocked = failed(applyCommand(pending, { type: 'generate_owner_brief', options: { ...options, emphasis: [] }, ...agent }, ctx));
    expect(blocked.error.code).toBe('DECISION_NOT_APPROVED');
    expect(blocked.error.message).toContain('Human approval is still required');
    expect(pending.ownerBrief).toBeNull();

    const approved = run(pending, [{ type: 'approve_decision', note: '', ...human }], ctx);
    const generated = ok(applyCommand(approved, { type: 'generate_owner_brief', options: { ...options, emphasis: [] }, ...agent }, ctx));
    expect(generated.state.ownerBrief).not.toBeNull();
    expect(generated.state.ownerBrief!.decisionId).toBe(approved.stagedDecision!.id);
    expect(generated.state.ownerBrief!.wordCount).toBeLessThanOrEqual(260);
    expect(generated.state.ownerBrief!.generatedBy).toBe('agent');
    expect(generated.state.ui.visiblePanel).toBe('brief');
    expect(generated.changed).toEqual(['ownerBrief', 'ui.visiblePanel']);
  });

  it('validates the brief options', () => {
    const ctx = createTestContext();
    const approved = run(
      openRail(ctx),
      [
        { type: 'stage_decision', input: decisionInput('conditional_go'), ...agent },
        { type: 'approve_decision', note: '', ...human },
      ],
      ctx,
    );
    expect(failed(applyCommand(approved, { type: 'generate_owner_brief', options: { maximumWords: 100, emphasis: [], title: null }, ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(approved, { type: 'generate_owner_brief', options: { maximumWords: 401, emphasis: [], title: null }, ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(approved, { type: 'generate_owner_brief', options: { maximumWords: 200, emphasis: ['jokes' as 'risks'], title: null }, ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
    expect(failed(applyCommand(approved, { type: 'generate_owner_brief', options: { maximumWords: 200, emphasis: [], title: 't'.repeat(101) }, ...agent }, ctx)).error.code).toBe('INVALID_INPUT');
  });
});

describe('mark_requirement_complete', () => {
  it('toggles completion, is a no-op when unchanged, and clears the at-risk PM gate', () => {
    const ctx = createTestContext();
    const state = openRail(ctx);
    const done = ok(applyCommand(state, { type: 'mark_requirement_complete', requirementId: 'RAIL-04', complete: true, ...human }, ctx));
    expect(done.state.completedRequirementIds).toEqual(['RAIL-04']);
    expect(evaluateOpportunity(done.state, OPPORTUNITY_IDS.rail)!.atRisk).toEqual([]);
    expect(ok(applyCommand(done.state, { type: 'mark_requirement_complete', requirementId: 'RAIL-04', complete: true, ...human }, ctx)).noop).toBe(true);
    const undone = ok(applyCommand(done.state, { type: 'mark_requirement_complete', requirementId: 'RAIL-04', complete: false, ...human }, ctx));
    expect(undone.state.completedRequirementIds).toEqual([]);
    expect(failed(applyCommand(state, { type: 'mark_requirement_complete', requirementId: 'STA-01', complete: true, ...human }, ctx)).error.code).toBe('REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY');
  });
});

describe('record_tool_call', () => {
  it('appends an audit event without bumping the state version', () => {
    const ctx = createTestContext();
    const state = openRail(ctx);
    const version = state.stateVersion;
    const read = ok(applyCommand(state, { type: 'record_tool_call', ...agent, tool: 'civicbid_get_context', ok: true, summary: 'Read the workspace.' }, ctx));
    expect(read.noop).toBe(false);
    expect(read.changed).toEqual([]);
    expect(read.state.stateVersion).toBe(version);
    expect(read.state.activity).toHaveLength(state.activity.length + 1);
    const event = read.event!;
    expect(event.tool).toBe('civicbid_get_context');
    expect(event.action).toBe('tool_call');
    expect(event.stateVersionBefore).toBe(version);
    expect(event.stateVersionAfter).toBe(version);
    expect(event.opportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect(event.title).toContain('called civicbid_get_context');

    const failure = ok(applyCommand(read.state, { type: 'record_tool_call', ...console_, tool: 'civicbid_assign_requirement', ok: false, summary: 'INVALID_INPUT' }, ctx));
    expect(failure.event!.action).toBe('tool_call_failed');
    expect(failure.event!.title).toContain('Agent (tool console) failed calling civicbid_assign_requirement');
    expect(failure.state.stateVersion).toBe(version);

    // Audit events are not "since" events: they carry no version change, so a version-delta reread ignores them.
    expect(selectEventsSince(failure.state, version)).toEqual([]);
    expect(failed(applyCommand(state, { type: 'record_tool_call', ...agent, tool: '', ok: true, summary: '' }, ctx)).error.code).toBe('INVALID_INPUT');
  });
});

describe('reset_demo', () => {
  it('restores the seed except the monotonic version, the activity log, and the interface state', () => {
    const ctx = createTestContext();
    let state = run(
      openRail(ctx),
      [
        assign('RAIL-01', 'Finance & Bonding'),
        { type: 'stage_decision', input: decisionInput('conditional_go'), ...agent },
        { type: 'approve_decision', note: '', ...human },
        { type: 'apply_jv_preset', ...human },
      ],
      ctx,
    );
    const versionBefore = state.stateVersion;
    expect(versionBefore).toBeGreaterThan(1);
    const reset = ok(applyCommand(state, { type: 'reset_demo', ...console_ }, ctx));
    state = reset.state;
    expect(state.stateVersion).toBe(versionBefore + 1);
    expect(state.company).toEqual(createSeedCompany());
    expect(state.selectedOpportunityId).toBeNull();
    expect(state.comparisonIds).toEqual([]);
    expect(state.focusedRequirementIds).toEqual([]);
    expect(state.assignments).toEqual({});
    expect(state.completedRequirementIds).toEqual([]);
    expect(state.risks).toEqual([]);
    expect(state.stagedDecision).toBeNull();
    expect(state.decisionHistory).toEqual([]);
    expect(state.approval).toBeNull();
    expect(state.ownerBrief).toBeNull();
    expect(state.opportunities).toEqual(createSeedState().opportunities);
    expect(state.activity).toHaveLength(1);
    expect(state.activity[0].action).toBe('reset_demo');
    expect(state.activity[0].changed).toEqual(['*']);
    expect(state.ui.visiblePanel).toBe('welcome');
    expect(state.ui.lastToast?.text).toContain('reset the demonstration');
    expect(selectDecisionStatus(state)).toBe('none');
  });
});

describe('activity log', () => {
  it('caps the log at 400 events and keeps sequence numbers monotonic', () => {
    const ctx = createTestContext();
    let state = createSeedState();
    for (let i = 0; i < 405; i += 1) {
      state = ok(applyCommand(state, { type: 'record_tool_call', ...agent, tool: 'civicbid_get_context', ok: true, summary: `call ${i}` }, ctx)).state;
    }
    expect(state.activity).toHaveLength(400);
    expect(state.activity[0].seq).toBe(6);
    expect(state.activity[399].seq).toBe(405);
    expect(state.stateVersion).toBe(1);
  });

  it('rejects an unknown command type', () => {
    const result = failed(applyCommand(createSeedState(), { type: 'launch_rockets', ...agent } as unknown as Command, createTestContext()));
    expect(result.error.code).toBe('INVALID_INPUT');
  });
});

describe('store', () => {
  it('notifies subscribers only when the state changes', () => {
    const store = createStore(createSeedState(), createTestContext());
    const seen: number[] = [];
    const unsubscribe = store.subscribe((s) => seen.push(s.stateVersion));

    store.dispatch({ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent });
    expect(seen).toEqual([2]);
    store.dispatch({ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent });
    expect(seen).toEqual([2]);
    store.dispatch({ type: 'record_tool_call', ...agent, tool: 'civicbid_get_context', ok: true, summary: '' });
    expect(seen).toEqual([2, 2]);
    store.dispatch({ type: 'approve_decision', note: '', ...agent });
    expect(seen).toEqual([2, 2]);
    expect(store.getState().stateVersion).toBe(2);

    unsubscribe();
    store.dispatch({ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.station, ...agent });
    expect(seen).toEqual([2, 2]);
    expect(store.getState().selectedOpportunityId).toBe(OPPORTUNITY_IDS.station);
  });

  it('converts an unexpected exception into INTERNAL_STATE_ERROR and keeps the previous state', () => {
    const broken: ReducerContext = {
      now: () => {
        throw new Error('clock failure');
      },
      newId: (prefix) => `${prefix}-x`,
    };
    const store = createStore(createSeedState(), broken);
    const before = store.getState();
    const result = failed(store.dispatch({ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent }));
    expect(result.error.code).toBe('INTERNAL_STATE_ERROR');
    expect(result.error.message).toBe('clock failure');
    expect(result.error.recovery).toContain('civicbid_get_workspace_state');
    expect(store.getState()).toBe(before);
  });

  it('replaceState swaps the state and notifies', () => {
    const store = createStore(createSeedState(), createTestContext());
    let notified = 0;
    store.subscribe(() => {
      notified += 1;
    });
    const next: AppState = { ...createSeedState(), stateVersion: 42 };
    store.replaceState(next);
    expect(store.getState()).toBe(next);
    expect(notified).toBe(1);
  });
});
