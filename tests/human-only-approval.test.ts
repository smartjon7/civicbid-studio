/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSeedState, OPPORTUNITY_IDS } from '../src/data/seed';
import { selectDecisionStatus } from '../src/domain/selectors';
import { createTestContext } from '../src/store/reducer';
import { createStore } from '../src/store/store';
import { createToolRuntime } from '../src/webmcp';

const HUMAN_ONLY_COMMANDS = ['approve_decision', 'reject_decision', 'update_company_profile', 'apply_jv_preset'];

// Vitest provides __dirname to test files; fall back to the repository root otherwise.
const WEBMCP_DIR = typeof __dirname === 'string' ? join(__dirname, '..', 'src', 'webmcp') : join(process.cwd(), 'src', 'webmcp');

describe('no tool can reach a human-only command', () => {
  it('never names a human-only command anywhere in the WebMCP layer', () => {
    const files = readdirSync(WEBMCP_DIR).filter((name) => name.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const file of files) {
      const source = readFileSync(join(WEBMCP_DIR, file), 'utf8');
      for (const command of HUMAN_ONLY_COMMANDS) {
        expect(source.includes(command), `${file} mentions ${command}`).toBe(false);
      }
    }
  });

  it('registers no tool whose name suggests approval, rejection, or profile editing', () => {
    const runtime = createToolRuntime(createStore(createSeedState(), createTestContext()));
    for (const def of runtime.definitions) {
      expect(def.name).not.toMatch(/approve|reject|profile|preset/i);
    }
  });

  it('leaves a pending decision pending no matter which tool runs', async () => {
    const store = createStore(createSeedState(), createTestContext());
    const runtime = createToolRuntime(store);
    const call = (name: string, input: unknown) => runtime.execute(name, input, 'webmcp');

    expect((await call('civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.rail })).ok).toBe(true);
    const staged = await call('civicbid_stage_decision', {
      recommendation: 'conditional_go',
      rationale: 'Bonding is the only mandatory gap and a confirmed JV partner would close it before bid day.',
      conditions: ['JV partner confirmed with combined bonding of at least $30M'],
      confidence: 68,
    });
    expect(staged.ok).toBe(true);
    expect(selectDecisionStatus(store.getState())).toBe('pending');

    const plausible: Array<[string, unknown]> = [
      ['civicbid_list_opportunities', { minimumValueUsd: 20000000, maximumDaysToDeadline: 45 }],
      ['civicbid_compare_opportunities', { opportunityIds: [OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station] }],
      ['civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.rail }],
      ['civicbid_get_context', {}],
      ['civicbid_list_requirements', { mandatoryOnly: true }],
      ['civicbid_focus_requirements', { requirementIds: ['RAIL-01', 'RAIL-07'], mode: 'replace', reason: 'Bonding and the JV package decide the bid.' }],
      ['civicbid_assign_requirement', { requirementId: 'RAIL-01', ownerRole: 'Finance & Bonding', dueDate: '2026-09-12', note: 'Combined surety letter.' }],
      ['civicbid_upsert_risk', { riskKey: 'bonding-shortfall', title: 'Bonding shortfall', severity: 'high', relatedRequirementIds: ['RAIL-01'], rationale: 'Short of the minimum.', mitigation: 'Confirm the JV partner.', ownerRole: 'Finance & Bonding', status: 'open' }],
      ['civicbid_stage_decision', { recommendation: 'conditional_go', rationale: 'Restaged with the same reasoning after assigning the bonding work to Finance and Bonding.', confidence: 70 }],
      ['civicbid_get_workspace_state', { detailLevel: 'full', sinceStateVersion: 0 }],
      ['civicbid_simulate_company_change', { changes: { jvPartnerConfirmed: true, jvCombinedBondingUsd: 60000000 } }],
      ['civicbid_generate_owner_brief', { maximumWords: 260 }],
      // Inputs that look like attempts to approve are simply unknown properties.
      ['civicbid_stage_decision', { recommendation: 'go', rationale: 'Attempting to approve through the staging tool must not work at all.', confidence: 99, approve: true }],
      ['civicbid_get_workspace_state', { approved: true }],
    ];

    for (const [name, input] of plausible) {
      const result = await call(name, input);
      expect(result.verification.decisionStatus, `${name} changed the decision status`).toBe('pending');
      expect(store.getState().approval, `${name} produced an approval`).toBeNull();
      expect(selectDecisionStatus(store.getState())).toBe('pending');
      expect(store.getState().stagedDecision?.status).toBe('pending');
    }

    // Tools that do not exist are refused, including any name that sounds like approval.
    for (const name of ['civicbid_approve_decision', 'civicbid_reject_decision', 'civicbid_update_company_profile', 'civicbid_apply_jv_preset']) {
      const result = await call(name, {});
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(store.getState().approval).toBeNull();
    }

    // The reducer itself refuses agent provenance on the human-only commands.
    const agent = { actor: 'agent', channel: 'webmcp', tool: 'anything' } as const;
    for (const type of ['approve_decision', 'reject_decision'] as const) {
      const refused = store.dispatch({ type, note: 'agent attempt', ...agent });
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe('HUMAN_ONLY_ACTION');
    }
    const preset = store.dispatch({ type: 'apply_jv_preset', ...agent });
    expect(preset.ok).toBe(false);
    if (!preset.ok) expect(preset.error.code).toBe('HUMAN_ONLY_ACTION');
    const profile = store.dispatch({ type: 'update_company_profile', changes: { railYears: 20 }, label: 'agent attempt', ...agent });
    expect(profile.ok).toBe(false);
    if (!profile.ok) expect(profile.error.code).toBe('HUMAN_ONLY_ACTION');
    expect(store.getState().company.jvPartnerConfirmed).toBe(false);
    expect(store.getState().company.railYears).toBe(8);

    // The owner brief stays blocked until a human approves.
    const blocked = await call('civicbid_generate_owner_brief', {});
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe('DECISION_NOT_APPROVED');
    expect(store.getState().ownerBrief).toBeNull();

    // Reset clears the pending decision but never approves it.
    const reset = await call('civicbid_reset_demo', { confirm: 'RESET_CIVICBID_DEMO' });
    expect(reset.ok).toBe(true);
    expect(store.getState().approval).toBeNull();
    expect(selectDecisionStatus(store.getState())).toBe('none');
  });
});
