import { describe, expect, it } from 'vitest';
import { createSeedCompany, createSeedState, OPPORTUNITY_IDS } from '../src/data/seed';
import { selectDecisionStatus } from '../src/domain/selectors';
import { createTestContext } from '../src/store/reducer';
import { createStore } from '../src/store/store';
import { createToolRuntime } from '../src/webmcp';
import type { CivicBidToolResult, ToolVerification } from '../src/webmcp/types';
import { validateInput } from '../src/webmcp/validate';

const human = { actor: 'human', channel: 'ui' } as const;

function setup() {
  const store = createStore(createSeedState(), createTestContext());
  const runtime = createToolRuntime(store);
  const call = (name: string, input: unknown = {}) => runtime.execute(name, input, 'webmcp');
  return { store, runtime, call };
}

function expectVerification(result: CivicBidToolResult) {
  const v: ToolVerification = result.verification;
  expect(v).toBeDefined();
  expect(['welcome', 'comparison', 'workspace', 'brief']).toContain(v.visiblePanel);
  expect(['none', 'pending', 'approved', 'rejected']).toContain(v.decisionStatus);
  expect(Array.isArray(v.focusedRequirementIds)).toBe(true);
  expect('activityEventId' in v).toBe(true);
  expect('selectedOpportunityId' in v).toBe(true);
  expect(typeof result.stateVersion).toBe('number');
  expect(Array.isArray(result.changed)).toBe(true);
  // Plain JSON only.
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
}

const STAGE_INPUT = {
  recommendation: 'conditional_go',
  rationale: 'Every mandatory gate is met or assigned except bonding, which a confirmed JV partner would close before bid day.',
  conditions: ['JV partner confirmed with combined bonding of at least $30M'],
  assumptions: [],
  confidence: 68,
};

describe('tool definitions', () => {
  const { runtime } = setup();

  it('exposes thirteen civicbid_ tools with closed schemas and valid examples', () => {
    expect(runtime.definitions).toHaveLength(13);
    const names = new Set(runtime.definitions.map((d) => d.name));
    expect(names.size).toBe(13);
    for (const def of runtime.definitions) {
      expect(def.name.startsWith('civicbid_')).toBe(true);
      expect(def.name).toMatch(/^[a-z0-9_]+$/);
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThanOrEqual(40);
      expect(def.inputSchema.type).toBe('object');
      expect(def.inputSchema.additionalProperties).toBe(false);
      expect(typeof def.readOnly).toBe('boolean');
      const validated = validateInput(def.inputSchema, def.example);
      expect(validated.ok, `${def.name} example failed: ${validated.ok ? '' : validated.message}`).toBe(true);
    }
  });

  it('marks the read-only tools and the write tools as expected', () => {
    const readOnly = runtime.definitions.filter((d) => d.readOnly).map((d) => d.name).sort();
    expect(readOnly).toEqual(
      [
        'civicbid_compare_opportunities',
        'civicbid_get_context',
        'civicbid_get_workspace_state',
        'civicbid_list_opportunities',
        'civicbid_list_requirements',
        'civicbid_simulate_company_change',
      ].sort(),
    );
  });

  it('has no tool whose name contains approve or reject', () => {
    for (const def of runtime.definitions) {
      expect(def.name).not.toMatch(/approve|reject/i);
    }
  });
});

describe('validator', () => {
  const { runtime } = setup();
  const schemaFor = (name: string) => runtime.definitions.find((d) => d.name === name)!.inputSchema;

  it('rejects non-object input and unknown properties', () => {
    expect(validateInput(schemaFor('civicbid_get_context'), null).ok).toBe(false);
    expect(validateInput(schemaFor('civicbid_get_context'), 'text').ok).toBe(false);
    expect(validateInput(schemaFor('civicbid_get_context'), [1]).ok).toBe(false);
    const unknown = validateInput(schemaFor('civicbid_list_opportunities'), { minimumValueUsd: 1, extra: true });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.message).toContain('extra');
  });

  it('applies defaults and enforces bounds, enums, patterns, and uniqueness', () => {
    const defaults = validateInput(schemaFor('civicbid_list_opportunities'), {});
    expect(defaults.ok).toBe(true);
    if (defaults.ok) expect(defaults.value.includeClosed).toBe(false);

    const risk = validateInput(schemaFor('civicbid_upsert_risk'), { riskKey: 'x-1', title: 'T', severity: 'high', ownerRole: 'Scheduler' });
    expect(risk.ok).toBe(true);
    if (risk.ok) {
      expect(risk.value.status).toBe('open');
      expect(risk.value.relatedRequirementIds).toEqual([]);
    }

    const bounds = validateInput(schemaFor('civicbid_list_opportunities'), { maximumDaysToDeadline: 400 });
    expect(bounds.ok).toBe(false);
    if (!bounds.ok) expect(bounds.message).toContain('maximumDaysToDeadline');

    const wrongType = validateInput(schemaFor('civicbid_list_opportunities'), { minimumValueUsd: '20' });
    expect(wrongType.ok).toBe(false);
    if (!wrongType.ok) expect(wrongType.message).toContain('minimumValueUsd');

    const badEnum = validateInput(schemaFor('civicbid_assign_requirement'), { requirementId: 'RAIL-01', ownerRole: 'Janitor', dueDate: '2026-09-12' });
    expect(badEnum.ok).toBe(false);
    if (!badEnum.ok) expect(badEnum.message).toContain('ownerRole');

    const badDate = validateInput(schemaFor('civicbid_assign_requirement'), { requirementId: 'RAIL-01', ownerRole: 'Scheduler', dueDate: 'September 12' });
    expect(badDate.ok).toBe(false);
    if (!badDate.ok) expect(badDate.message).toContain('dueDate');

    const duplicate = validateInput(schemaFor('civicbid_compare_opportunities'), { opportunityIds: [OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.rail] });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.message).toContain('opportunityIds');

    const nested = validateInput(schemaFor('civicbid_simulate_company_change'), { changes: { name: 'Other Co' } });
    expect(nested.ok).toBe(false);
    if (!nested.ok) expect(nested.message).toContain('name');

    const missing = validateInput(schemaFor('civicbid_stage_decision'), { recommendation: 'go', rationale: 'x'.repeat(50) });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.message).toContain('confidence');
  });
});

describe('runtime envelope', () => {
  it('returns NOT_FOUND for an unknown tool and never throws on bad input', async () => {
    const { call } = setup();
    const unknown = await call('civicbid_nothing', {});
    expect(unknown.ok).toBe(false);
    expect(unknown.error?.code).toBe('NOT_FOUND');
    expectVerification(unknown);

    const weird = await call('civicbid_list_opportunities', 'not an object');
    expect(weird.ok).toBe(false);
    expect(weird.error?.code).toBe('INVALID_INPUT');
    expectVerification(weird);
  });

  it('rejects an unknown extra property with INVALID_INPUT and a recovery hint', async () => {
    const { call, store } = setup();
    const result = await call('civicbid_list_opportunities', { minimumValueUsd: 1, extraProperty: 1 });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
    expect(result.error?.message).toContain('extraProperty');
    expect(result.error?.recovery).toContain('civicbid_list_opportunities');
    const last = store.getState().activity.at(-1)!;
    expect(last.action).toBe('tool_call_failed');
    expect(last.tool).toBe('civicbid_list_opportunities');
    expect(result.verification.activityEventId).toBe(last.id);
  });

  it('records read-only calls without changing the state version', async () => {
    const { call, store } = setup();
    const before = store.getState().stateVersion;
    const eventsBefore = store.getState().activity.length;
    const result = await call('civicbid_list_opportunities', {});
    expect(result.ok).toBe(true);
    expect(result.stateVersion).toBe(before);
    expect(store.getState().stateVersion).toBe(before);
    expect(store.getState().activity).toHaveLength(eventsBefore + 1);
    const event = store.getState().activity.at(-1)!;
    expect(event.action).toBe('tool_call');
    expect(event.tool).toBe('civicbid_list_opportunities');
    expect(event.actor).toBe('agent');
    expect(event.channel).toBe('webmcp');
    expect(event.stateVersionBefore).toBe(event.stateVersionAfter);
    expect(result.verification.activityEventId).toBe(event.id);
  });

  it('labels console calls with the console channel', async () => {
    const { runtime, store } = setup();
    const result = await runtime.execute('civicbid_get_workspace_state', {}, 'console');
    expect(result.ok).toBe(true);
    expect(store.getState().activity.at(-1)!.channel).toBe('console');
  });
});

describe('every tool succeeds with a valid input', () => {
  it('runs the thirteen tools in a sensible order with verification blocks', async () => {
    const { call, store, runtime } = setup();
    const example = (name: string) => runtime.definitions.find((d) => d.name === name)!.example;

    const list = await call('civicbid_list_opportunities', example('civicbid_list_opportunities'));
    expect(list.ok).toBe(true);
    expectVerification(list);
    const listData = list.data as { count: number; opportunities: Array<{ id: string; score: number }> };
    expect(listData.count).toBe(2);
    expect(listData.opportunities.map((o) => o.id)).toEqual([OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station]);

    const compare = await call('civicbid_compare_opportunities', example('civicbid_compare_opportunities'));
    expect(compare.ok).toBe(true);
    expectVerification(compare);
    expect((compare.data as { strongestOpportunityId: string }).strongestOpportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect(compare.verification.visiblePanel).toBe('comparison');
    const differences = (compare.data as { decisiveDifferences: string[] }).decisiveDifferences;
    expect(differences.length).toBeGreaterThanOrEqual(1);
    expect(differences.length).toBeLessThanOrEqual(4);

    const open = await call('civicbid_open_opportunity', example('civicbid_open_opportunity'));
    expect(open.ok).toBe(true);
    expectVerification(open);
    expect(open.verification.selectedOpportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect(open.verification.visiblePanel).toBe('workspace');
    const openData = open.data as { evaluation: { score: number; recommendation: string }; requirementCounts: { total: number; mandatory: number } };
    expect(openData.evaluation.score).toBe(78);
    expect(openData.evaluation.recommendation).toBe('conditional_go');
    expect(openData.requirementCounts.total).toBe(10);
    expect(openData.requirementCounts.mandatory).toBe(10);

    const context = await call('civicbid_get_context', example('civicbid_get_context'));
    expect(context.ok).toBe(true);
    expectVerification(context);
    const contextData = context.data as { requirements: unknown[]; company: { name: string }; decisionStatus: string; stateVersion: number };
    expect(contextData.requirements).toHaveLength(10);
    expect(contextData.company.name).toBe(createSeedCompany().name);
    expect(contextData.decisionStatus).toBe('none');
    expect(contextData.stateVersion).toBe(store.getState().stateVersion);

    const requirements = await call('civicbid_list_requirements', example('civicbid_list_requirements'));
    expect(requirements.ok).toBe(true);
    expectVerification(requirements);
    expect((requirements.data as { count: number }).count).toBe(10);

    const focus = await call('civicbid_focus_requirements', example('civicbid_focus_requirements'));
    expect(focus.ok).toBe(true);
    expectVerification(focus);
    expect(focus.verification.focusedRequirementIds).toEqual(['RAIL-01', 'RAIL-07']);

    const assign = await call('civicbid_assign_requirement', example('civicbid_assign_requirement'));
    expect(assign.ok).toBe(true);
    expectVerification(assign);
    expect((assign.data as { requirementStatus: string }).requirementStatus).toBe('assigned');

    const risk = await call('civicbid_upsert_risk', example('civicbid_upsert_risk'));
    expect(risk.ok).toBe(true);
    expectVerification(risk);
    expect((risk.data as { created: boolean; updated: boolean }).created).toBe(true);

    const stage = await call('civicbid_stage_decision', example('civicbid_stage_decision'));
    expect(stage.ok).toBe(true);
    expectVerification(stage);
    expect(stage.verification.decisionStatus).toBe('pending');
    expect((stage.data as { decisionStatus: string; message: string }).decisionStatus).toBe('pending');
    expect((stage.data as { message: string }).message).toContain('No tool can approve');

    const workspace = await call('civicbid_get_workspace_state', example('civicbid_get_workspace_state'));
    expect(workspace.ok).toBe(true);
    expectVerification(workspace);
    expect((workspace.data as { decisionStatus: string }).decisionStatus).toBe('pending');

    const simulate = await call('civicbid_simulate_company_change', example('civicbid_simulate_company_change'));
    expect(simulate.ok).toBe(true);
    expectVerification(simulate);
    const simData = simulate.data as { simulated: boolean; deltas: Array<{ opportunityId: string; recommendationAfter: string }>; recommendationToHuman: string };
    expect(simData.simulated).toBe(true);
    expect(simData.deltas).toHaveLength(1);
    expect(simData.deltas[0].opportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect(simData.deltas[0].recommendationAfter).toBe('go');
    expect(simData.recommendationToHuman).toContain('Only the human can make this change');
    expect(store.getState().company.jvPartnerConfirmed).toBe(false);

    const blocked = await call('civicbid_generate_owner_brief', example('civicbid_generate_owner_brief'));
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe('DECISION_NOT_APPROVED');
    expect(blocked.error?.recovery).toContain('approve');
    expectVerification(blocked);

    const approved = store.dispatch({ type: 'approve_decision', note: 'Approved for the test.', ...human });
    expect(approved.ok).toBe(true);
    const brief = await call('civicbid_generate_owner_brief', example('civicbid_generate_owner_brief'));
    expect(brief.ok).toBe(true);
    expectVerification(brief);
    expect(brief.verification.visiblePanel).toBe('brief');
    expect((brief.data as { brief: { wordCount: number } }).brief.wordCount).toBeLessThanOrEqual(260);

    const reset = await call('civicbid_reset_demo', example('civicbid_reset_demo'));
    expect(reset.ok).toBe(true);
    expectVerification(reset);
    expect(reset.verification.selectedOpportunityId).toBeNull();
    expect(reset.verification.visiblePanel).toBe('welcome');
  });
});

describe('invalid ids', () => {
  it('fails open with INVALID_INPUT for an id outside the enum', async () => {
    const { call } = setup();
    const result = await call('civicbid_open_opportunity', { opportunityId: 'opp-does-not-exist' });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
    expect(result.error?.message).toContain('opportunityId');
    expect(result.error?.recovery.length).toBeGreaterThan(0);
  });

  it('requires an open opportunity before context, requirements, focus, assign, risk, or stage', async () => {
    const { call, store } = setup();
    for (const name of ['civicbid_get_context', 'civicbid_list_requirements']) {
      const result = await call(name, {});
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NO_OPPORTUNITY_SELECTED');
      expect(result.error?.recovery).toContain(OPPORTUNITY_IDS.rail);
    }
    const focus = await call('civicbid_focus_requirements', { requirementIds: ['RAIL-01'], mode: 'replace', reason: 'Check bonding.' });
    expect(focus.ok).toBe(false);
    expect(focus.error?.code).toBe('NO_OPPORTUNITY_SELECTED');
    const assign = await call('civicbid_assign_requirement', { requirementId: 'RAIL-01', ownerRole: 'Scheduler', dueDate: '2026-09-12' });
    expect(assign.ok).toBe(false);
    expect(assign.error?.code).toBe('NO_OPPORTUNITY_SELECTED');
    const stage = await call('civicbid_stage_decision', STAGE_INPUT);
    expect(stage.ok).toBe(false);
    expect(stage.error?.code).toBe('NO_OPPORTUNITY_SELECTED');
    expect(store.getState().stateVersion).toBe(1);
  });

  it('fails assign and focus with clear codes for unknown or foreign requirement ids', async () => {
    const { call } = setup();
    await call('civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.rail });

    const unknown = await call('civicbid_assign_requirement', { requirementId: 'RAIL-99', ownerRole: 'Scheduler', dueDate: '2026-09-12' });
    expect(unknown.ok).toBe(false);
    expect(unknown.error?.code).toBe('NOT_FOUND');
    expect(unknown.error?.recovery).toContain('civicbid_list_requirements');

    const foreign = await call('civicbid_assign_requirement', { requirementId: 'STA-01', ownerRole: 'Scheduler', dueDate: '2026-09-12' });
    expect(foreign.ok).toBe(false);
    expect(foreign.error?.code).toBe('REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY');
    expect(foreign.error?.recovery).toContain(OPPORTUNITY_IDS.station);

    const malformed = await call('civicbid_assign_requirement', { requirementId: 'rail-1', ownerRole: 'Scheduler', dueDate: '2026-09-12' });
    expect(malformed.ok).toBe(false);
    expect(malformed.error?.code).toBe('INVALID_INPUT');

    const focusNone = await call('civicbid_focus_requirements', { requirementIds: ['STA-01', 'RAIL-99'], mode: 'replace', reason: 'Nothing valid.' });
    expect(focusNone.ok).toBe(false);
    expect(focusNone.error?.code).toBe('NOT_FOUND');

    const focusSome = await call('civicbid_focus_requirements', { requirementIds: ['RAIL-01', 'STA-01'], mode: 'replace', reason: 'One valid id.' });
    expect(focusSome.ok).toBe(true);
    expect((focusSome.data as { invalidIds: string[]; focusedRequirementIds: string[] }).invalidIds).toEqual(['STA-01']);
    expect((focusSome.data as { focusedRequirementIds: string[] }).focusedRequirementIds).toEqual(['RAIL-01']);
    expect(focusSome.warnings?.length).toBe(1);
  });

  it('refuses a go recommendation while an unmitigable gap remains', async () => {
    const { call } = setup();
    await call('civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.station });
    const stage = await call('civicbid_stage_decision', { ...STAGE_INPUT, recommendation: 'go' });
    expect(stage.ok).toBe(false);
    expect(stage.error?.code).toBe('INVALID_INPUT');
    expect(stage.error?.message).toContain('STA-02');
  });
});

describe('idempotent writes', () => {
  it('does not duplicate assignments or events on a repeated assign', async () => {
    const { call, store } = setup();
    await call('civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.rail });
    const input = { requirementId: 'RAIL-01', ownerRole: 'Finance & Bonding', dueDate: '2026-09-12', note: 'Get the surety letter.' };
    const first = await call('civicbid_assign_requirement', input);
    expect(first.ok).toBe(true);
    expect(first.changed).toEqual(['assignments.RAIL-01']);
    const versionAfterFirst = store.getState().stateVersion;
    const eventsAfterFirst = store.getState().activity.length;

    const second = await call('civicbid_assign_requirement', input);
    expect(second.ok).toBe(true);
    expect(second.summary).toContain('Already assigned exactly this way');
    expect(second.changed).toEqual([]);
    expect(second.stateVersion).toBe(versionAfterFirst);
    expect(store.getState().activity).toHaveLength(eventsAfterFirst);
    expect(Object.keys(store.getState().assignments)).toEqual(['RAIL-01']);
    expect(second.verification.activityEventId).toBe(first.verification.activityEventId);

    const changed = await call('civicbid_assign_requirement', { ...input, dueDate: '2026-09-14' });
    expect(changed.ok).toBe(true);
    expect(changed.changed).toEqual(['assignments.RAIL-01.dueDate']);
    expect((changed.data as { changedFields: string[] }).changedFields).toEqual(['dueDate']);
    expect(Object.keys(store.getState().assignments)).toEqual(['RAIL-01']);
  });

  it('does not duplicate risks or events on a repeated upsert', async () => {
    const { call, store } = setup();
    await call('civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.rail });
    const input = { riskKey: 'bonding-shortfall', title: 'Bonding shortfall', severity: 'high', ownerRole: 'Finance & Bonding', mitigation: 'Confirm the JV partner.' };
    const first = await call('civicbid_upsert_risk', input);
    expect(first.ok).toBe(true);
    expect((first.data as { created: boolean; updated: boolean }).created).toBe(true);
    const eventsAfterFirst = store.getState().activity.length;

    const second = await call('civicbid_upsert_risk', input);
    expect(second.ok).toBe(true);
    expect(second.changed).toEqual([]);
    expect((second.data as { created: boolean; updated: boolean }).created).toBe(false);
    expect((second.data as { created: boolean; updated: boolean }).updated).toBe(false);
    expect(store.getState().activity).toHaveLength(eventsAfterFirst);
    expect(store.getState().risks).toHaveLength(1);

    const third = await call('civicbid_upsert_risk', { ...input, severity: 'critical' });
    expect(third.ok).toBe(true);
    expect((third.data as { created: boolean; updated: boolean }).updated).toBe(true);
    expect(store.getState().risks).toHaveLength(1);
    expect(store.getState().risks[0].severity).toBe('critical');
  });
});

describe('stale closures', () => {
  it('sees a human profile change made between two calls', async () => {
    const { call, store } = setup();
    await call('civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.rail });
    const first = await call('civicbid_get_workspace_state', {});
    expect(first.ok).toBe(true);
    const firstData = first.data as { stateVersion: number; company: { jvPartnerConfirmed: boolean }; evaluation: { score: number; recommendation: string } };
    expect(firstData.company.jvPartnerConfirmed).toBe(false);
    expect(firstData.evaluation.recommendation).toBe('conditional_go');
    const seen = firstData.stateVersion;

    const preset = store.dispatch({ type: 'apply_jv_preset', ...human });
    expect(preset.ok).toBe(true);

    const second = await call('civicbid_get_workspace_state', { sinceStateVersion: seen, detailLevel: 'full' });
    expect(second.ok).toBe(true);
    const data = second.data as {
      stateVersion: number;
      company: { jvPartnerConfirmed: boolean; jvCombinedBondingUsd: number };
      evaluation: { score: number; recommendation: string; requirements: unknown[] };
      humanChangesSince: Array<{ action: string; profileChanges: unknown[]; evaluationDelta: { scoreBefore: number; scoreAfter: number; recommendationAfter: string } }>;
      changedSinceSummary: string;
    };
    expect(data.stateVersion).toBe(seen + 1);
    expect(data.company.jvPartnerConfirmed).toBe(true);
    expect(data.company.jvCombinedBondingUsd).toBe(60_000_000);
    expect(data.evaluation.recommendation).toBe('go');
    expect(data.evaluation.score).toBeGreaterThanOrEqual(80);
    expect(data.evaluation.requirements).toHaveLength(10);
    expect(data.humanChangesSince).toHaveLength(1);
    expect(data.humanChangesSince[0].action).toBe('apply_jv_preset');
    expect(data.humanChangesSince[0].profileChanges).toHaveLength(2);
    expect(data.humanChangesSince[0].evaluationDelta.scoreBefore).toBe(78);
    expect(data.humanChangesSince[0].evaluationDelta.scoreAfter).toBeGreaterThan(78);
    expect(data.humanChangesSince[0].evaluationDelta.recommendationAfter).toBe('go');
    expect(data.changedSinceSummary).toContain(`Since version ${seen}`);
    expect(data.changedSinceSummary).toContain('confirmed the JV package');
    expect(data.changedSinceSummary).toContain('Conditional GO to GO');

    const nothingNew = await call('civicbid_get_workspace_state', { sinceStateVersion: seen + 1 });
    expect((nothingNew.data as { humanChangesSince: unknown[] }).humanChangesSince).toHaveLength(0);
  });

  it('marks a pending decision stale after a human profile change and lets the agent restage', async () => {
    const { call, store } = setup();
    await call('civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.rail });
    const staged = await call('civicbid_stage_decision', STAGE_INPUT);
    expect(staged.ok).toBe(true);
    const firstId = (staged.data as { decision: { id: string } }).decision.id;
    store.dispatch({ type: 'apply_jv_preset', ...human });
    const context = await call('civicbid_get_context', {});
    expect((context.data as { stagedDecision: { stale: boolean } }).stagedDecision.stale).toBe(true);
    const restaged = await call('civicbid_stage_decision', { ...STAGE_INPUT, recommendation: 'go', confidence: 84 });
    expect(restaged.ok).toBe(true);
    expect((restaged.data as { decision: { supersedesDecisionId: string | null } }).decision.supersedesDecisionId).toBe(firstId);
    expect(selectDecisionStatus(store.getState())).toBe('pending');
  });
});

describe('reset', () => {
  it('returns the workspace to the seed and rejects the wrong confirmation', async () => {
    const { call, store } = setup();
    await call('civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.rail });
    await call('civicbid_assign_requirement', { requirementId: 'RAIL-01', ownerRole: 'Finance & Bonding', dueDate: '2026-09-12' });
    store.dispatch({ type: 'apply_jv_preset', ...human });
    expect(store.getState().company.jvPartnerConfirmed).toBe(true);

    const wrong = await call('civicbid_reset_demo', { confirm: 'yes' });
    expect(wrong.ok).toBe(false);
    expect(wrong.error?.code).toBe('INVALID_INPUT');
    expect(store.getState().company.jvPartnerConfirmed).toBe(true);

    const reset = await call('civicbid_reset_demo', { confirm: 'RESET_CIVICBID_DEMO' });
    expect(reset.ok).toBe(true);
    expect((reset.data as { reset: boolean; selectedOpportunityId: string | null; visiblePanel: string }).reset).toBe(true);
    expect((reset.data as { selectedOpportunityId: string | null }).selectedOpportunityId).toBeNull();
    expect((reset.data as { visiblePanel: string }).visiblePanel).toBe('welcome');
    const state = store.getState();
    expect(state.company).toEqual(createSeedCompany());
    expect(state.selectedOpportunityId).toBeNull();
    expect(state.assignments).toEqual({});
    expect(state.risks).toEqual([]);
    expect(state.stagedDecision).toBeNull();
    expect(state.approval).toBeNull();
    expect(state.ownerBrief).toBeNull();
    expect(state.activity).toHaveLength(1);
    expect(state.activity[0].action).toBe('reset_demo');
    expect(state.ui.visiblePanel).toBe('welcome');
  });
});
