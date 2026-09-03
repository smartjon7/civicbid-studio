/**
 * The judge sequence, end to end, through the tools as the browser would call
 * them: a fake document.modelContext collects the registered tools and every
 * call below goes through the collected execute callbacks.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createSeedCompany, createSeedState, OPPORTUNITY_IDS } from '../src/data/seed';
import { selectDecisionStatus } from '../src/domain/selectors';
import { createTestContext } from '../src/store/reducer';
import { createStore } from '../src/store/store';
import { createToolRuntime } from '../src/webmcp';
import type { CivicBidToolResult } from '../src/webmcp/types';

const human = { actor: 'human', channel: 'ui' } as const;

interface CollectedTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: unknown, options: { signal: AbortSignal }) => unknown;
}

function installFakeModelContext() {
  const collected = new Map<string, CollectedTool>();
  const registerCalls: Array<{ name: string; signal: AbortSignal | undefined }> = [];
  const fake = {
    registerTool(tool: CollectedTool, options?: { signal?: AbortSignal }) {
      collected.set(tool.name, tool);
      registerCalls.push({ name: tool.name, signal: options?.signal });
      options?.signal?.addEventListener('abort', () => {
        collected.delete(tool.name);
      });
      return Promise.resolve();
    },
    getTools() {
      return Promise.resolve([...collected.values()].map((t) => ({ name: t.name, title: t.title, description: t.description, annotations: t.annotations })));
    },
    executeTool(name: string, input: unknown) {
      const tool = collected.get(name);
      if (!tool) throw new Error(`No registered tool named ${name}`);
      return tool.execute(input, { signal: new AbortController().signal });
    },
  };
  Object.defineProperty(document, 'modelContext', { value: fake, configurable: true, writable: true });
  return { collected, registerCalls, fake };
}

function removeFakeModelContext() {
  delete (document as Document & { modelContext?: unknown }).modelContext;
}

describe('judge sequence through the registered tools', () => {
  afterEach(() => {
    removeFakeModelContext();
  });

  it('registers once, runs the three-prompt sequence, blocks the brief until human approval, and resets', async () => {
    const { collected, registerCalls, fake } = installFakeModelContext();
    const store = createStore(createSeedState(), createTestContext());
    const runtime = createToolRuntime(store);

    const statuses: string[] = [];
    runtime.subscribe((status) => statuses.push(`${status.registered}:${status.registeredCount}`));

    // React StrictMode can call register twice; only one registration happens.
    const [status, again] = await Promise.all([runtime.register(), runtime.register()]);
    expect(status.supported).toBe(true);
    expect(status.registered).toBe(true);
    expect(status.error).toBeNull();
    expect(status.canExecuteViaBrowser).toBe(true);
    expect(status.registeredCount).toBe(13);
    expect(status.discovered).toHaveLength(13);
    expect(again).toEqual(status);
    expect(registerCalls).toHaveLength(13);
    expect(collected.size).toBe(13);
    expect(statuses.length).toBeGreaterThan(0);
    const third = await runtime.register();
    expect(registerCalls).toHaveLength(13);
    expect(third.registered).toBe(true);
    for (const tool of collected.values()) {
      expect(tool.name.startsWith('civicbid_')).toBe(true);
      expect(typeof tool.execute).toBe('function');
      expect(Object.keys(tool.annotations ?? {})).toEqual(['readOnlyHint']);
    }
    expect(status.discovered.filter((t) => t.readOnly).map((t) => t.name)).toContain('civicbid_list_opportunities');
    expect(status.discovered.filter((t) => !t.readOnly).map((t) => t.name)).toContain('civicbid_stage_decision');

    const call = async (name: string, input: unknown): Promise<CivicBidToolResult> => (await fake.executeTool(name, input)) as CivicBidToolResult;
    const calledTools: string[] = [];
    const run = async (name: string, input: unknown) => {
      calledTools.push(name);
      return call(name, input);
    };

    // Prompt one: find, compare, open, understand, focus, assign, register risks, stage.
    const list = await run('civicbid_list_opportunities', { minimumValueUsd: 20000000, maximumDaysToDeadline: 45 });
    expect(list.ok).toBe(true);
    const listed = (list.data as { opportunities: Array<{ id: string; score: number; recommendation: string }> }).opportunities;
    expect(listed.map((o) => o.id)).toEqual([OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station]);
    expect(listed[0].score).toBe(78);
    expect(listed[0].recommendation).toBe('conditional_go');
    expect(listed[1].recommendation).toBe('no_go');

    const compare = await run('civicbid_compare_opportunities', { opportunityIds: [OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station] });
    expect(compare.ok).toBe(true);
    expect((compare.data as { strongestOpportunityId: string }).strongestOpportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect((compare.data as { decisiveDifferences: string[] }).decisiveDifferences.join(' ')).toContain('cannot be met before bid day');

    const open = await run('civicbid_open_opportunity', { opportunityId: OPPORTUNITY_IDS.rail });
    expect(open.ok).toBe(true);
    expect(open.verification.selectedOpportunityId).toBe(OPPORTUNITY_IDS.rail);

    const context = await run('civicbid_get_context', {});
    expect(context.ok).toBe(true);
    const contextData = context.data as { evaluation: { score: number; mitigableGaps: string[]; unmitigableGaps: string[] }; requirements: Array<{ id: string; status: string }> };
    expect(contextData.evaluation.score).toBe(78);
    expect(contextData.evaluation.mitigableGaps).toEqual(['RAIL-01']);
    expect(contextData.evaluation.unmitigableGaps).toEqual([]);
    expect(contextData.requirements.find((r) => r.id === 'RAIL-04')?.status).toBe('at_risk');

    const requirements = await run('civicbid_list_requirements', { mandatoryOnly: true });
    expect(requirements.ok).toBe(true);
    expect((requirements.data as { count: number }).count).toBe(10);

    const focus = await run('civicbid_focus_requirements', {
      requirementIds: ['RAIL-01', 'RAIL-07', 'RAIL-04', 'RAIL-05', 'RAIL-09'],
      mode: 'replace',
      reason: 'Bonding, the JV package, the named PM, the safety plan, and the possession schedule decide whether this bid can be submitted.',
    });
    expect(focus.ok).toBe(true);
    expect(focus.verification.focusedRequirementIds).toEqual(['RAIL-01', 'RAIL-07', 'RAIL-04', 'RAIL-05', 'RAIL-09']);

    const assignments: Array<[string, string, string]> = [
      ['RAIL-01', 'Finance & Bonding', '2026-09-12'],
      ['RAIL-07', 'JV & Legal', '2026-09-19'],
      ['RAIL-05', 'Safety Director', '2026-09-15'],
      ['RAIL-04', 'Operations Lead', '2026-09-10'],
    ];
    for (const [requirementId, ownerRole, dueDate] of assignments) {
      const assigned = await run('civicbid_assign_requirement', { requirementId, ownerRole, dueDate, note: `Owner: ${ownerRole}.` });
      expect(assigned.ok, `${requirementId}: ${assigned.error?.message ?? ''}`).toBe(true);
      expect((assigned.data as { assignment: { ownerRole: string } }).assignment.ownerRole).toBe(ownerRole);
    }

    const riskOne = await run('civicbid_upsert_risk', {
      riskKey: 'bonding-shortfall',
      title: 'Single-project bonding is $5M short of the $30M minimum',
      severity: 'high',
      relatedRequirementIds: ['RAIL-01'],
      rationale: 'Without a confirmed JV partner the company cannot reach the bonding minimum.',
      mitigation: 'Confirm the JV partner and obtain a combined surety letter of at least $30M.',
      ownerRole: 'Finance & Bonding',
      status: 'open',
    });
    expect(riskOne.ok).toBe(true);
    const riskTwo = await run('civicbid_upsert_risk', {
      riskKey: 'jv-approval-timing',
      title: 'JV approval package must be filed seven days before bid',
      severity: 'medium',
      relatedRequirementIds: ['RAIL-07'],
      rationale: 'The agency will not accept a JV bid without the approval package on file.',
      mitigation: 'Execute the JV agreement and file the package by September 19.',
      ownerRole: 'JV & Legal',
      status: 'open',
    });
    expect(riskTwo.ok).toBe(true);

    const staged = await run('civicbid_stage_decision', {
      recommendation: 'conditional_go',
      rationale: 'Rail Fastener Renewal passes every mandatory gate except bonding, which a confirmed JV partner with combined bonding of at least $30M would close before bid day.',
      conditions: ['JV partner confirmed with combined bonding of at least $30M', 'JV approval package filed by September 19'],
      assumptions: ['Night possessions remain available as published'],
      confidence: 68,
    });
    expect(staged.ok).toBe(true);
    expect(staged.verification.decisionStatus).toBe('pending');
    const firstDecisionId = (staged.data as { decision: { id: string } }).decision.id;

    const blocked = await run('civicbid_generate_owner_brief', { maximumWords: 260 });
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.code).toBe('DECISION_NOT_APPROVED');
    expect(store.getState().ownerBrief).toBeNull();

    // The human confirms the JV package in the workspace. No tool is involved.
    const versionBeforePreset = store.getState().stateVersion;
    const preset = store.dispatch({ type: 'apply_jv_preset', ...human });
    expect(preset.ok).toBe(true);

    // Prompt two: reread exactly what changed, then restage.
    const reread = await run('civicbid_get_workspace_state', { sinceStateVersion: versionBeforePreset });
    expect(reread.ok).toBe(true);
    const rereadData = reread.data as {
      humanChangesSince: Array<{ actor: string; action: string; evaluationDelta: { scoreAfter: number; recommendationAfter: string } | null }>;
      changedSinceSummary: string;
      stagedDecision: { stale: boolean };
      evaluation: { score: number; recommendation: string };
    };
    expect(rereadData.humanChangesSince).toHaveLength(1);
    expect(rereadData.humanChangesSince[0].actor).toBe('human');
    expect(rereadData.humanChangesSince[0].action).toBe('apply_jv_preset');
    expect(rereadData.humanChangesSince[0].evaluationDelta?.scoreAfter).toBeGreaterThanOrEqual(84);
    expect(rereadData.humanChangesSince[0].evaluationDelta?.recommendationAfter).toBe('go');
    expect(rereadData.stagedDecision.stale).toBe(true);
    expect(rereadData.evaluation.recommendation).toBe('go');
    expect(rereadData.changedSinceSummary).toContain('confirmed the JV package');

    const restaged = await run('civicbid_stage_decision', {
      recommendation: 'go',
      rationale: 'With the JV package confirmed the bonding gate passes, every mandatory requirement is met or assigned, and the score clears the GO threshold.',
      conditions: ['JV approval package filed by September 19'],
      assumptions: ['Night possessions remain available as published'],
      confidence: 84,
    });
    expect(restaged.ok).toBe(true);
    expect(restaged.verification.decisionStatus).toBe('pending');
    expect((restaged.data as { decision: { supersedesDecisionId: string | null } }).decision.supersedesDecisionId).toBe(firstDecisionId);
    expect(selectDecisionStatus(store.getState())).toBe('pending');

    // The human approves in the workspace. No tool is involved.
    const approved = store.dispatch({ type: 'approve_decision', note: 'Approved. Proceed with the JV bid.', ...human });
    expect(approved.ok).toBe(true);
    expect(selectDecisionStatus(store.getState())).toBe('approved');

    // Prompt three: the owner brief.
    const brief = await run('civicbid_generate_owner_brief', { maximumWords: 260, emphasis: ['decision', 'risks', 'next_actions'] });
    expect(brief.ok, brief.error?.message ?? '').toBe(true);
    expect(brief.verification.visiblePanel).toBe('brief');
    const briefData = brief.data as { brief: { text: string; wordCount: number; sections: unknown[] }; approvedDecisionId: string; visiblePanel: string };
    expect(briefData.visiblePanel).toBe('brief');
    expect(briefData.brief.text).toContain('GO');
    expect(briefData.brief.text).toMatch(/JV|joint/i);
    expect(briefData.brief.wordCount).toBeLessThanOrEqual(260);
    expect(briefData.brief.sections.length).toBeGreaterThan(0);
    expect(briefData.approvedDecisionId).toBe(store.getState().stagedDecision?.id);

    // The activity log narrates every tool call, in order, plus the two human actions.
    const agentTools = store.getState().activity.filter((e) => e.actor === 'agent').map((e) => e.tool);
    expect(agentTools).toEqual(calledTools);
    const humanActions = store.getState().activity.filter((e) => e.actor === 'human').map((e) => e.action);
    expect(humanActions).toEqual(['apply_jv_preset', 'approve_decision']);
    for (const event of store.getState().activity) {
      if (event.actor === 'agent') expect(event.channel).toBe('webmcp');
      if (event.actor === 'human') expect(event.tool).toBeNull();
    }
    const failedCalls = store.getState().activity.filter((e) => e.action === 'tool_call_failed');
    expect(failedCalls.map((e) => e.tool)).toEqual(['civicbid_generate_owner_brief']);

    // Reset restores the seed.
    const reset = await run('civicbid_reset_demo', { confirm: 'RESET_CIVICBID_DEMO' });
    expect(reset.ok).toBe(true);
    expect((reset.data as { selectedOpportunityId: string | null }).selectedOpportunityId).toBeNull();
    expect(reset.verification.selectedOpportunityId).toBeNull();
    expect(reset.verification.visiblePanel).toBe('welcome');
    expect(reset.verification.decisionStatus).toBe('none');
    const state = store.getState();
    expect(state.company).toEqual(createSeedCompany());
    expect(state.assignments).toEqual({});
    expect(state.risks).toEqual([]);
    expect(state.stagedDecision).toBeNull();
    expect(state.approval).toBeNull();
    expect(state.ownerBrief).toBeNull();
    expect(state.activity.map((e) => e.action)).toEqual(['reset_demo']);

    // Unregister aborts the shared signal, which removes every tool from the fake registry.
    runtime.unregister();
    expect(collected.size).toBe(0);
    expect(runtime.getStatus().registered).toBe(false);
    expect(runtime.getStatus().registeredCount).toBe(0);
  });

  it('reports an unsupported browser without an error', async () => {
    removeFakeModelContext();
    const runtime = createToolRuntime(createStore(createSeedState(), createTestContext()));
    const status = await runtime.register();
    expect(status).toEqual({ supported: false, registered: false, registeredCount: 0, discovered: [], canExecuteViaBrowser: false, error: null });
    // The local executor still works for the Tool Console.
    const result = await runtime.execute('civicbid_list_opportunities', {}, 'console');
    expect(result.ok).toBe(true);
  });

  it('reports a registration failure in status.error and stays unregistered', async () => {
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool() {
          return Promise.reject(new Error('registry refused the tool'));
        },
      },
      configurable: true,
      writable: true,
    });
    const runtime = createToolRuntime(createStore(createSeedState(), createTestContext()));
    const status = await runtime.register();
    expect(status.supported).toBe(true);
    expect(status.registered).toBe(false);
    expect(status.registeredCount).toBe(0);
    expect(status.error).toContain('registry refused the tool');
  });
});
