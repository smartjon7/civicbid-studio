/**
 * The thirteen CivicBid Studio tools.
 *
 * Every write goes through store.dispatch with agent provenance, so the tools
 * share the reducer with the human interface and can never reach the
 * human-only commands. Handlers read store.getState() at call time.
 */
import {
  evaluateAll,
  evaluateOpportunity,
  filterOpportunities,
  rankEvaluations,
  simulateProfileChange,
} from '../domain/evaluateOpportunity';
import { recommendationLabel } from '../domain/format';
import {
  selectAssignmentsFor,
  selectDaysToDeadline,
  selectDecisionStatus,
  selectEventsSince,
  selectHumanProfileEvents,
  selectRequirements,
  selectRisksFor,
  type RequirementFilters,
} from '../domain/selectors';
import type {
  ActivityEvent,
  AppState,
  Assignment,
  BriefEmphasis,
  CommandResult,
  CompanyProfile,
  DecisionApproval,
  ErrorCode,
  EvaluationDelta,
  OpportunityEvaluation,
  OpportunityFilters,
  OwnerBrief,
  OwnerBriefOptions,
  OwnerRole,
  Recommendation,
  RequirementCategory,
  RequirementEvaluation,
  RequirementStatus,
  RiskInput,
  RiskItem,
  RiskStatus,
  Sector,
  Severity,
  StagedDecision,
  StagedDecisionInput,
} from '../store/types';
import type { HandlerResult, ToolSpec } from './runtime';
import {
  assignRequirementSchema,
  compareOpportunitiesSchema,
  focusRequirementsSchema,
  generateOwnerBriefSchema,
  getContextSchema,
  getWorkspaceStateSchema,
  listOpportunitiesSchema,
  listRequirementsSchema,
  openOpportunitySchema,
  OPPORTUNITY_ID_VALUES,
  RESET_CONFIRMATION,
  resetDemoSchema,
  simulateCompanyChangeSchema,
  stageDecisionSchema,
  upsertRiskSchema,
} from './schemas';

export const HUMAN_APPROVAL_MESSAGE = 'Human approval is still required. No tool can approve this decision.';

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

function fail(code: ErrorCode, message: string, recovery: string): HandlerResult {
  return { ok: false, error: { code, message, recovery } };
}

function read(summary: string, data: unknown, warnings: string[] = []): HandlerResult {
  return { ok: true, summary, data, changed: [], warnings, event: null };
}

function written(result: CommandResult, summary: string, data: unknown, warnings: string[] = []): HandlerResult {
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, summary, data, changed: [...result.changed], warnings: [...result.warnings, ...warnings], event: result.event };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function opportunityIdList(state: AppState): string {
  return state.opportunities.map((o) => o.id).join(', ');
}

function requireSelected(state: AppState): { ok: true; id: string } | { ok: false; result: HandlerResult } {
  if (!state.selectedOpportunityId) {
    return {
      ok: false,
      result: fail(
        'NO_OPPORTUNITY_SELECTED',
        'No opportunity is open in the workspace.',
        `Call civicbid_open_opportunity with one of: ${opportunityIdList(state)}.`,
      ),
    };
  }
  return { ok: true, id: state.selectedOpportunityId };
}

// ---------------------------------------------------------------------------
// Views: plain objects derived from state
// ---------------------------------------------------------------------------

function opportunityCard(state: AppState, e: OpportunityEvaluation) {
  const opportunity = state.opportunities.find((o) => o.id === e.opportunityId);
  return {
    id: e.opportunityId,
    title: e.title,
    agency: e.agency,
    sector: e.sector,
    estimatedValueUsd: e.estimatedValueUsd,
    deadline: e.deadline,
    daysToDeadline: e.daysToDeadline,
    score: e.totalScore,
    recommendation: e.recommendation,
    recommendationLabel: e.recommendationLabel,
    mitigableGapCount: e.mitigableGaps.length,
    unmitigableGapCount: e.unmitigableGaps.length,
    summary: opportunity?.summary ?? '',
  };
}

function opportunityDetail(state: AppState, opportunityId: string) {
  const o = state.opportunities.find((x) => x.id === opportunityId);
  if (!o) return null;
  return {
    id: o.id,
    title: o.title,
    agency: o.agency,
    solicitationNumber: o.solicitationNumber,
    sector: o.sector,
    sectorLabel: o.sectorLabel,
    location: o.location,
    estimatedValueUsd: o.estimatedValueUsd,
    deadline: o.deadline,
    daysToDeadline: selectDaysToDeadline(state, o),
    strategicFit: o.strategicFit,
    summary: o.summary,
    scopeHighlights: [...o.scopeHighlights],
  };
}

function evaluationSummary(e: OpportunityEvaluation) {
  return {
    opportunityId: e.opportunityId,
    score: e.totalScore,
    rawScore: e.rawScore,
    capped: e.capped,
    recommendation: e.recommendation,
    recommendationLabel: e.recommendationLabel,
    mitigableGaps: [...e.mitigableGaps],
    unmitigableGaps: [...e.unmitigableGaps],
    atRisk: [...e.atRisk],
    nextAction: e.nextAction,
  };
}

function evaluationFull(e: OpportunityEvaluation, includeRequirements: boolean) {
  return {
    ...evaluationSummary(e),
    dimensions: e.dimensions.map((d) => ({ key: d.key, label: d.label, weight: d.weight, score: d.score, weighted: d.weighted, explanation: d.explanation })),
    gates: {
      passed: [...e.passedGates],
      atRisk: [...e.atRisk],
      mitigableGaps: [...e.mitigableGaps],
      unmitigableGaps: [...e.unmitigableGaps],
      openDeliverables: [...e.openDeliverables],
    },
    scoreDrivers: [...e.scoreDrivers],
    rationale: e.rationale,
    daysToDeadline: e.daysToDeadline,
    evaluatedAtStateVersion: e.evaluatedAtStateVersion,
    ...(includeRequirements ? { requirements: e.requirements.map(requirementFull) } : {}),
  };
}

function requirementBrief(r: RequirementEvaluation) {
  return {
    id: r.requirementId,
    label: r.label,
    category: r.category,
    mandatory: r.mandatory,
    status: r.status,
    gateEffect: r.gateEffect,
    severity: r.severity,
    finding: r.finding,
    suggestedMitigation: r.suggestedMitigation,
    suggestedOwner: r.suggestedOwner,
    ownerRole: r.ownerRole,
    dueDate: r.dueDate,
  };
}

function requirementFull(r: RequirementEvaluation) {
  return {
    ...requirementBrief(r),
    evidence: r.evidence,
    kind: r.kind,
    failureMode: r.failureMode,
    focused: r.focused,
    assignmentNote: r.assignmentNote,
    complete: r.complete,
  };
}

function requirementCounts(requirements: RequirementEvaluation[]) {
  const count = (status: RequirementStatus) => requirements.filter((r) => r.status === status).length;
  return {
    total: requirements.length,
    mandatory: requirements.filter((r) => r.mandatory).length,
    satisfied: count('satisfied'),
    gap: count('gap'),
    atRisk: count('at_risk'),
    assigned: count('assigned'),
    complete: count('complete'),
  };
}

function assignmentView(a: Assignment) {
  return { ...a };
}

function riskView(r: RiskItem) {
  return { ...r, relatedRequirementIds: [...r.relatedRequirementIds] };
}

function decisionView(d: StagedDecision) {
  return {
    id: d.id,
    opportunityId: d.opportunityId,
    recommendation: d.recommendation,
    recommendationLabel: recommendationLabel(d.recommendation),
    rationale: d.rationale,
    conditions: [...d.conditions],
    assumptions: [...d.assumptions],
    confidence: d.confidence,
    stagedBy: d.stagedBy,
    stagedAt: d.stagedAt,
    stateVersion: d.stateVersion,
    supersedesDecisionId: d.supersedesDecisionId,
    status: d.status,
    stale: d.stale,
    staleReason: d.staleReason,
    evaluationSnapshot: { ...d.evaluationSnapshot, mitigableGaps: [...d.evaluationSnapshot.mitigableGaps], unmitigableGaps: [...d.evaluationSnapshot.unmitigableGaps] },
  };
}

function approvalView(a: DecisionApproval | null) {
  if (!a) return null;
  return { ...a, evaluationSnapshot: { ...a.evaluationSnapshot, mitigableGaps: [...a.evaluationSnapshot.mitigableGaps], unmitigableGaps: [...a.evaluationSnapshot.unmitigableGaps] } };
}

function briefStatus(b: OwnerBrief | null) {
  if (!b) return { exists: false, wordCount: 0 };
  return {
    exists: true,
    id: b.id,
    title: b.title,
    wordCount: b.wordCount,
    maximumWords: b.maximumWords,
    stateVersion: b.stateVersion,
    decisionId: b.decisionId,
    generatedAt: b.generatedAt,
  };
}

function eventView(e: ActivityEvent) {
  return {
    id: e.id,
    at: e.at,
    actor: e.actor,
    channel: e.channel,
    action: e.action,
    title: e.title,
    detail: e.detail,
    changed: [...e.changed],
    stateVersionBefore: e.stateVersionBefore,
    stateVersionAfter: e.stateVersionAfter,
    profileChanges: e.profileChanges.map((c) => ({ ...c })),
    evaluationDelta: e.evaluationDelta ? { ...e.evaluationDelta, gapsClosed: [...e.evaluationDelta.gapsClosed], gapsOpened: [...e.evaluationDelta.gapsOpened] } : null,
  };
}

function deltaMoved(d: EvaluationDelta): boolean {
  return d.scoreBefore !== d.scoreAfter || d.recommendationBefore !== d.recommendationAfter || d.gapsClosed.length > 0 || d.gapsOpened.length > 0;
}

function describeDelta(d: EvaluationDelta): string {
  return `${d.title} moved ${d.scoreBefore} to ${d.scoreAfter} (${recommendationLabel(d.recommendationBefore)} to ${recommendationLabel(d.recommendationAfter)})`;
}

function describeChangesSince(since: number, events: ActivityEvent[]): string {
  if (events.length === 0) return `No human or system changes since version ${since}.`;
  const shown = events.slice(-5);
  const parts = shown.map((e) => {
    const who = e.actor === 'human' ? 'the human' : 'the system';
    const action = e.title.replace(/^(Human|System|Agent(?: \(tool console\))?)\s+/, '');
    let text = `${who} ${action}`;
    if (e.evaluationDelta && deltaMoved(e.evaluationDelta)) text += `; ${describeDelta(e.evaluationDelta)}`;
    return text;
  });
  const earlier = events.length > shown.length ? ` and ${plural(events.length - shown.length, 'earlier change')}` : '';
  return `Since version ${since}: ${parts.join('; ')}${earlier}.`;
}

function decisiveDifferences(ranked: OpportunityEvaluation[]): string[] {
  if (ranked.length < 2) return [];
  const top = ranked[0];
  const out: string[] = [];
  const labelFor = (e: OpportunityEvaluation, id: string) => e.requirements.find((r) => r.requirementId === id)?.label ?? id;
  for (const other of ranked.slice(1)) {
    const lead = top.totalScore - other.totalScore;
    out.push(
      lead > 0
        ? `${top.title} leads ${other.title} by ${plural(lead, 'point')} (${top.totalScore} to ${other.totalScore}).`
        : `${top.title} ties ${other.title} at ${top.totalScore} but ranks ahead on recommendation (${top.recommendationLabel} against ${other.recommendationLabel}).`,
    );
    if (other.unmitigableGaps.length > 0 && top.unmitigableGaps.length === 0) {
      out.push(
        `${other.title} is disqualified by ${plural(other.unmitigableGaps.length, 'requirement')} that cannot be met before bid day (${other.unmitigableGaps.map((id) => labelFor(other, id)).join('; ')}); ${top.title} has no disqualifying gap.`,
      );
    } else if (other.mitigableGaps.length > top.mitigableGaps.length) {
      out.push(`${top.title} has ${plural(top.mitigableGaps.length, 'open mandatory gap')} against ${other.mitigableGaps.length} for ${other.title}.`);
    }
    const edge = top.dimensions
      .map((d, index) => ({ d, o: other.dimensions[index], gain: (d.score - (other.dimensions[index]?.score ?? 0)) * d.weight }))
      .filter((x) => x.o && x.gain > 0)
      .sort((a, b) => b.gain - a.gain)[0];
    if (edge) {
      out.push(`${top.title} scores ${edge.d.score} against ${edge.o.score} on ${edge.d.label.toLowerCase()} (${Math.round(edge.d.weight * 100)}% of the total).`);
    }
  }
  return out.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Tool specifications
// ---------------------------------------------------------------------------

const WRITE_NOTE = 'This tool changes the workspace and is logged; it never approves or rejects anything, because approval belongs to the human alone.';

export function createToolSpecs(): ToolSpec[] {
  return [
    {
      name: 'civicbid_list_opportunities',
      title: 'List opportunities',
      description:
        'Lists the public-infrastructure opportunities in the bid room with each one\'s deterministic score and bid/no-bid recommendation, sorted best first. Use it first, to find and filter opportunities by minimum value, days to the bid deadline, or sector. Do not use it for requirement detail; open an opportunity for that. Read-only: it changes nothing in the workspace.',
      inputSchema: listOpportunitiesSchema,
      readOnly: true,
      example: { minimumValueUsd: 20000000, maximumDaysToDeadline: 45 },
      handler(ctx, input) {
        const state = ctx.store.getState();
        const filters: OpportunityFilters = { includeClosed: input.includeClosed === true };
        if (typeof input.minimumValueUsd === 'number') filters.minimumValueUsd = input.minimumValueUsd;
        if (typeof input.maximumDaysToDeadline === 'number') filters.maximumDaysToDeadline = input.maximumDaysToDeadline;
        if (Array.isArray(input.sectors) && input.sectors.length > 0) filters.sectors = input.sectors as Sector[];
        const matching = new Set(filterOpportunities(state, filters).map((o) => o.id));
        const ranked = rankEvaluations(evaluateAll(state).filter((e) => matching.has(e.opportunityId)));
        const opportunities = ranked.map((e) => opportunityCard(state, e));
        const summary = opportunities.length
          ? `${opportunities.length} of ${state.opportunities.length} opportunities match: ${opportunities.map((o) => `${o.title} (${o.score}, ${o.recommendationLabel})`).join('; ')}.`
          : `No opportunities match the filters; ${state.opportunities.length} exist in total.`;
        return read(summary, { count: opportunities.length, demoDate: state.demoAnchorDate, opportunities });
      },
    },

    {
      name: 'civicbid_compare_opportunities',
      title: 'Compare opportunities',
      description:
        'Ranks two or three opportunities side by side with dimension scores, passed gates, gaps, and up to four plain-English reasons the strongest one wins. Use it when the human asks which opportunity to pursue. Do not use it on a single opportunity. It does not change any business data, but it switches the visible panel to the comparison so the human sees the same ranking.',
      inputSchema: compareOpportunitiesSchema,
      readOnly: true,
      example: { opportunityIds: [OPPORTUNITY_ID_VALUES[0], OPPORTUNITY_ID_VALUES[1]] },
      handler(ctx, input) {
        const ids = input.opportunityIds as string[];
        const result = ctx.store.dispatch({ type: 'compare_opportunities', opportunityIds: ids, ...ctx.provenance });
        if (!result.ok) return { ok: false, error: result.error };
        const state = result.state;
        const ranked = rankEvaluations(evaluateAll(state).filter((e) => ids.includes(e.opportunityId)));
        const top = ranked[0];
        const data = {
          strongestOpportunityId: top.opportunityId,
          ranked: ranked.map((e) => ({
            opportunityId: e.opportunityId,
            title: e.title,
            score: e.totalScore,
            rawScore: e.rawScore,
            capped: e.capped,
            recommendation: e.recommendation,
            recommendationLabel: e.recommendationLabel,
            dimensions: e.dimensions.map((d) => ({ key: d.key, label: d.label, weight: d.weight, score: d.score })),
            passedGates: [...e.passedGates],
            mitigableGaps: [...e.mitigableGaps],
            unmitigableGaps: [...e.unmitigableGaps],
            rationale: e.rationale,
          })),
          decisiveDifferences: decisiveDifferences(ranked),
        };
        const rest = ranked.slice(1).map((e) => `${e.title} ${e.totalScore} (${e.recommendationLabel})`).join('; ');
        return written(result, `${top.title} is the strongest at ${top.totalScore} (${top.recommendationLabel}); ${rest}.`, data);
      },
    },

    {
      name: 'civicbid_open_opportunity',
      title: 'Open opportunity',
      description:
        'Opens one opportunity in the shared workspace so both the human and the agent work on the same bid, and returns its evaluation and requirement counts. Use it before listing requirements, focusing, assigning, registering risks, or staging a decision. Do not use it just to read scores; civicbid_list_opportunities already returns them. Side effect: the workspace switches to this opportunity and any requirement focus from another opportunity is cleared. ' +
        WRITE_NOTE,
      inputSchema: openOpportunitySchema,
      readOnly: false,
      example: { opportunityId: OPPORTUNITY_ID_VALUES[0] },
      handler(ctx, input) {
        const opportunityId = input.opportunityId as string;
        const result = ctx.store.dispatch({ type: 'select_opportunity', opportunityId, ...ctx.provenance });
        if (!result.ok) return { ok: false, error: result.error };
        const state = result.state;
        const evaluation = evaluateOpportunity(state, opportunityId);
        const detail = opportunityDetail(state, opportunityId);
        if (!evaluation || !detail) {
          return fail('NOT_FOUND', `Opportunity "${opportunityId}" was not found.`, `Use one of: ${opportunityIdList(state)}.`);
        }
        const data = {
          opportunity: detail,
          evaluation: evaluationSummary(evaluation),
          requirementCounts: requirementCounts(evaluation.requirements),
        };
        const gaps = `${plural(evaluation.mitigableGaps.length, 'mitigable gap')}, ${plural(evaluation.unmitigableGaps.length, 'unmitigable gap')}`;
        const summary = result.noop
          ? `${evaluation.title} is already open: score ${evaluation.totalScore}, ${evaluation.recommendationLabel}, ${gaps}.`
          : `Opened ${evaluation.title}: score ${evaluation.totalScore}, ${evaluation.recommendationLabel}, ${gaps}.`;
        return written(result, summary, data);
      },
    },

    {
      name: 'civicbid_get_context',
      title: 'Get context',
      description:
        'Returns everything about the open opportunity in one call: company profile, evaluation with dimensions and gates, every requirement with status and finding, assignments, risks, the staged decision, approval status, owner-brief status, and recent human profile changes. Use it after opening an opportunity and before planning work. Do not use it to detect what changed since an earlier call; civicbid_get_workspace_state with sinceStateVersion does that. Read-only.',
      inputSchema: getContextSchema,
      readOnly: true,
      example: {},
      handler(ctx) {
        const state = ctx.store.getState();
        const selected = requireSelected(state);
        if (!selected.ok) return selected.result;
        const evaluation = evaluateOpportunity(state, selected.id);
        const detail = opportunityDetail(state, selected.id);
        if (!evaluation || !detail) return fail('INTERNAL_STATE_ERROR', 'The open opportunity could not be evaluated.', 'Call civicbid_open_opportunity again.');
        const assignments = selectAssignmentsFor(state, selected.id).map(assignmentView);
        const risks = selectRisksFor(state, selected.id).map(riskView);
        const decisionStatus = selectDecisionStatus(state);
        const data = {
          stateVersion: state.stateVersion,
          demoDate: state.demoAnchorDate,
          company: { ...state.company },
          opportunity: detail,
          evaluation: evaluationFull(evaluation, false),
          requirements: evaluation.requirements.map(requirementBrief),
          focusedRequirementIds: [...state.focusedRequirementIds],
          focusReason: state.focusReason,
          comparisonIds: [...state.comparisonIds],
          assignments,
          risks,
          stagedDecision: state.stagedDecision ? decisionView(state.stagedDecision) : null,
          approval: approvalView(state.approval),
          decisionStatus,
          ownerBrief: briefStatus(state.ownerBrief),
          recentHumanChanges: selectHumanProfileEvents(state).slice(-10).map(eventView),
        };
        const summary = `${evaluation.title}: score ${evaluation.totalScore} (${evaluation.recommendationLabel}), ${plural(evaluation.mitigableGaps.length, 'mitigable gap')}, ${plural(evaluation.unmitigableGaps.length, 'unmitigable gap')}, ${plural(assignments.length, 'assignment')}, ${plural(risks.length, 'risk')}; decision ${decisionStatus}.`;
        return read(summary, data);
      },
    },

    {
      name: 'civicbid_list_requirements',
      title: 'List requirements',
      description:
        'Lists the requirements of the open opportunity with status, gate effect, severity, finding, evidence, suggested mitigation, suggested owner, and any assignment. Use it to find disqualification risks and unassigned work; filter by mandatory, status, or category. Do not call it before an opportunity is open. Read-only.',
      inputSchema: listRequirementsSchema,
      readOnly: true,
      example: { mandatoryOnly: true },
      handler(ctx, input) {
        const state = ctx.store.getState();
        const selected = requireSelected(state);
        if (!selected.ok) return selected.result;
        const filters: RequirementFilters = { mandatoryOnly: input.mandatoryOnly === true };
        if (Array.isArray(input.statuses) && input.statuses.length > 0) filters.statuses = input.statuses as RequirementStatus[];
        if (Array.isArray(input.categories) && input.categories.length > 0) filters.categories = input.categories as RequirementCategory[];
        const requirements = selectRequirements(state, selected.id, filters).map(requirementFull);
        const title = state.opportunities.find((o) => o.id === selected.id)?.title ?? selected.id;
        const counts = requirementCounts(selectRequirements(state, selected.id, filters));
        const summary = `${plural(requirements.length, 'requirement')} for ${title}${filters.mandatoryOnly ? ' (mandatory only)' : ''}: ${counts.satisfied} satisfied, ${counts.gap} open gaps, ${counts.atRisk} at risk, ${counts.assigned} assigned, ${counts.complete} complete.`;
        return read(summary, { opportunityId: selected.id, count: requirements.length, requirements });
      },
    },

    {
      name: 'civicbid_focus_requirements',
      title: 'Focus requirements',
      description:
        'Highlights up to ten requirements of the open opportunity in the human\'s view, with a one-sentence reason, so the person sees exactly what the agent wants reviewed. Use it after identifying disqualification risks. Do not use it to assign work; civicbid_assign_requirement does that. Side effect: the highlighted set and reason change in the workspace. ' +
        WRITE_NOTE,
      inputSchema: focusRequirementsSchema,
      readOnly: false,
      example: { requirementIds: ['RAIL-01', 'RAIL-07'], mode: 'replace', reason: 'Bonding and the JV approval package decide whether this bid is possible.' },
      handler(ctx, input) {
        const state = ctx.store.getState();
        const selected = requireSelected(state);
        if (!selected.ok) return selected.result;
        const opportunity = state.opportunities.find((o) => o.id === selected.id);
        if (!opportunity) return fail('INTERNAL_STATE_ERROR', 'The open opportunity could not be found.', 'Call civicbid_open_opportunity again.');
        const known = new Set(opportunity.requirements.map((r) => r.id));
        const requested = input.requirementIds as string[];
        const validIds = requested.filter((id) => known.has(id));
        const invalidIds = requested.filter((id) => !known.has(id));
        if (validIds.length === 0) {
          return fail(
            'NOT_FOUND',
            `None of the requested ids (${invalidIds.join(', ')}) belong to ${opportunity.title}.`,
            `Use ids from civicbid_list_requirements, such as ${opportunity.requirements.slice(0, 3).map((r) => r.id).join(', ')}.`,
          );
        }
        const result = ctx.store.dispatch({
          type: 'focus_requirements',
          requirementIds: validIds,
          mode: input.mode as 'replace' | 'add',
          reason: input.reason as string,
          ...ctx.provenance,
        });
        if (!result.ok) return { ok: false, error: result.error };
        const next = result.state;
        const warnings = invalidIds.length ? [`Ignored ${plural(invalidIds.length, 'id')} not in ${opportunity.title}: ${invalidIds.join(', ')}.`] : [];
        const data = {
          focusedRequirementIds: [...next.focusedRequirementIds],
          reason: next.focusReason,
          invalidIds,
          visiblePanel: next.ui.visiblePanel,
        };
        const summary = result.noop
          ? `Focus unchanged: ${next.focusedRequirementIds.join(', ')} already highlighted for the human.`
          : `Highlighted ${plural(next.focusedRequirementIds.length, 'requirement')} for the human: ${next.focusedRequirementIds.join(', ')}.`;
        return written(result, summary, data, warnings);
      },
    },

    {
      name: 'civicbid_assign_requirement',
      title: 'Assign requirement',
      description:
        'Assigns one requirement of the open opportunity to an owner role with a due date and optional note; calling it again with the same values is a harmless no-op, and different values update the assignment. Use it to put every mitigable gap and open deliverable in someone\'s hands. Do not use it for requirements that cannot be met before bid day. Side effect: the assignment is recorded and the compliance score can rise. ' +
        WRITE_NOTE,
      inputSchema: assignRequirementSchema,
      readOnly: false,
      example: { requirementId: 'RAIL-01', ownerRole: 'Finance & Bonding', dueDate: '2026-09-12', note: 'Obtain the combined JV surety letter.' },
      handler(ctx, input) {
        const requirementId = input.requirementId as string;
        const ownerRole = input.ownerRole as OwnerRole;
        const dueDate = input.dueDate as string;
        const note = typeof input.note === 'string' ? input.note : '';
        const before = ctx.store.getState().assignments[requirementId] ?? null;
        const result = ctx.store.dispatch({ type: 'assign_requirement', requirementId, ownerRole, dueDate, note, ...ctx.provenance });
        if (!result.ok) return { ok: false, error: result.error };
        const state = result.state;
        const assignment = state.assignments[requirementId];
        if (!assignment) return fail('INTERNAL_STATE_ERROR', `The assignment for ${requirementId} was not recorded.`, 'Call civicbid_get_context and retry once.');
        const evaluation = evaluateOpportunity(state, assignment.opportunityId);
        const requirementStatus = evaluation?.requirements.find((r) => r.requirementId === requirementId)?.status ?? null;
        const changedFields = !before
          ? ['ownerRole', 'dueDate', 'note']
          : (['ownerRole', 'dueDate', 'note'] as const).filter((field) => before[field] !== assignment[field]);
        const data = {
          assignment: assignmentView(assignment),
          changedFields: [...changedFields],
          requirementStatus,
          warnings: [...result.warnings],
        };
        const summary = result.noop
          ? `Already assigned exactly this way: ${requirementId} to ${ownerRole}, due ${dueDate}.`
          : `${before ? 'Updated' : 'Assigned'} ${requirementId} to ${ownerRole}, due ${dueDate}; the requirement is now ${requirementStatus ?? 'unchanged'}.`;
        return written(result, summary, data);
      },
    },

    {
      name: 'civicbid_upsert_risk',
      title: 'Register risk',
      description:
        'Adds a risk to the open opportunity\'s register, or updates the risk that already carries the same riskKey, with severity, related requirements, rationale, mitigation, owner, and status. Use it to record disqualification and delivery risks with a named owner; registering mitigations raises risk readiness. Do not use it for requirement assignments. Side effect: the risk register changes. ' +
        WRITE_NOTE,
      inputSchema: upsertRiskSchema,
      readOnly: false,
      example: {
        riskKey: 'bonding-shortfall',
        title: 'Single-project bonding is short of the $30M minimum',
        severity: 'high',
        relatedRequirementIds: ['RAIL-01'],
        rationale: 'Without a confirmed JV partner the company cannot reach the bonding minimum.',
        mitigation: 'Confirm the JV partner and obtain a combined surety letter.',
        ownerRole: 'Finance & Bonding',
        status: 'open',
      },
      handler(ctx, input) {
        const state = ctx.store.getState();
        const riskKey = input.riskKey as string;
        const selectedId = state.selectedOpportunityId;
        const existed = selectedId ? state.risks.some((r) => r.riskKey === riskKey && r.opportunityId === selectedId) : false;
        const risk: RiskInput = {
          riskKey,
          title: input.title as string,
          severity: input.severity as Severity,
          relatedRequirementIds: Array.isArray(input.relatedRequirementIds) ? (input.relatedRequirementIds as string[]) : [],
          rationale: typeof input.rationale === 'string' ? input.rationale : '',
          mitigation: typeof input.mitigation === 'string' ? input.mitigation : '',
          ownerRole: input.ownerRole as OwnerRole,
          status: (typeof input.status === 'string' ? input.status : 'open') as RiskStatus,
        };
        const result = ctx.store.dispatch({ type: 'upsert_risk', risk, ...ctx.provenance });
        if (!result.ok) return { ok: false, error: result.error };
        const record = result.state.risks.find((r) => r.riskKey === riskKey && r.opportunityId === result.state.selectedOpportunityId);
        if (!record) return fail('INTERNAL_STATE_ERROR', `Risk ${riskKey} was not recorded.`, 'Call civicbid_get_context and retry once.');
        const created = !existed && !result.noop;
        const updated = existed && !result.noop;
        const summary = result.noop
          ? `Risk already recorded exactly this way: "${record.title}" (${record.severity}, ${record.ownerRole}).`
          : `${created ? 'Added' : 'Updated'} ${record.severity} risk "${record.title}" owned by ${record.ownerRole} (${record.status}).`;
        return written(result, summary, { risk: riskView(record), created, updated });
      },
    },

    {
      name: 'civicbid_stage_decision',
      title: 'Stage decision',
      description:
        'Stages a bid/no-bid recommendation (go, conditional_go, or no_go) for the open opportunity with rationale, conditions, assumptions, and confidence, and hands it to the human as a pending decision. Use it once the gaps are assigned and the risks registered; staging again replaces the pending recommendation and records which one it supersedes. Do not stage go or conditional_go while an unmitigable gap remains. Side effect: the pending decision changes and any earlier approval no longer applies. ' +
        WRITE_NOTE,
      inputSchema: stageDecisionSchema,
      readOnly: false,
      example: {
        recommendation: 'conditional_go',
        rationale: 'Every mandatory gate is met or assigned except bonding, which a confirmed JV partner would close before bid day.',
        conditions: ['JV partner confirmed with combined bonding of at least $30M', 'JV approval package filed seven days before bid'],
        assumptions: ['Night possessions remain available as published'],
        confidence: 68,
      },
      handler(ctx, input) {
        const decisionInput: StagedDecisionInput = {
          recommendation: input.recommendation as Recommendation,
          rationale: input.rationale as string,
          conditions: Array.isArray(input.conditions) ? (input.conditions as string[]) : [],
          assumptions: Array.isArray(input.assumptions) ? (input.assumptions as string[]) : [],
          confidence: input.confidence as number,
        };
        const result = ctx.store.dispatch({ type: 'stage_decision', input: decisionInput, ...ctx.provenance });
        if (!result.ok) return { ok: false, error: result.error };
        const state = result.state;
        const decision = state.stagedDecision;
        if (!decision) return fail('INTERNAL_STATE_ERROR', 'The decision was not staged.', 'Call civicbid_get_context and retry once.');
        const title = state.opportunities.find((o) => o.id === decision.opportunityId)?.title ?? decision.opportunityId;
        const view = decisionView(decision);
        const data = {
          decision: {
            id: view.id,
            recommendation: view.recommendation,
            recommendationLabel: view.recommendationLabel,
            rationale: view.rationale,
            conditions: view.conditions,
            assumptions: view.assumptions,
            confidence: view.confidence,
            stagedAt: view.stagedAt,
            stateVersion: view.stateVersion,
            supersedesDecisionId: view.supersedesDecisionId,
            stale: view.stale,
          },
          evaluationSnapshot: view.evaluationSnapshot,
          decisionStatus: selectDecisionStatus(state),
          message: HUMAN_APPROVAL_MESSAGE,
        };
        const supersedes = decision.supersedesDecisionId ? ` (supersedes ${decision.supersedesDecisionId})` : '';
        const summary = `Staged ${view.recommendationLabel} for ${title} at ${decision.confidence}% confidence${supersedes}; human approval is still required.`;
        return written(result, summary, data);
      },
    },

    {
      name: 'civicbid_get_workspace_state',
      title: 'Get workspace state',
      description:
        'Returns the current state version, the open opportunity and its evaluation, assignments, risks, the staged decision, approval status, and, when sinceStateVersion is given, every human and system change made after that version with before-and-after scores plus a one-sentence summary. Use it to reread the workspace after the human may have edited something, and before restaging a decision. Do not use it for the full requirement list; civicbid_get_context has that. Read-only.',
      inputSchema: getWorkspaceStateSchema,
      readOnly: true,
      example: { detailLevel: 'summary', sinceStateVersion: 0 },
      handler(ctx, input) {
        const state = ctx.store.getState();
        const detailLevel = input.detailLevel === 'full' ? 'full' : 'summary';
        const since = typeof input.sinceStateVersion === 'number' ? input.sinceStateVersion : 0;
        const selected = state.selectedOpportunityId ? state.opportunities.find((o) => o.id === state.selectedOpportunityId) ?? null : null;
        const evaluation = selected ? evaluateOpportunity(state, selected.id) : null;
        const events = selectEventsSince(state, since);
        const decisionStatus = selectDecisionStatus(state);
        const changedSinceSummary = describeChangesSince(since, events);
        const data = {
          stateVersion: state.stateVersion,
          demoDate: state.demoAnchorDate,
          detailLevel,
          company: { ...state.company },
          selectedOpportunity: selected ? { id: selected.id, title: selected.title } : null,
          evaluation: evaluation ? (detailLevel === 'full' ? evaluationFull(evaluation, true) : evaluationSummary(evaluation)) : null,
          assignments: selectAssignmentsFor(state, state.selectedOpportunityId).map(assignmentView),
          risks: selectRisksFor(state, state.selectedOpportunityId).map(riskView),
          stagedDecision: state.stagedDecision ? decisionView(state.stagedDecision) : null,
          approval: approvalView(state.approval),
          decisionStatus,
          ownerBrief: briefStatus(state.ownerBrief),
          comparisonIds: [...state.comparisonIds],
          focusedRequirementIds: [...state.focusedRequirementIds],
          focusReason: state.focusReason,
          sinceStateVersion: since,
          humanChangesSince: events.map(eventView),
          changedSinceSummary,
        };
        const where = selected && evaluation ? `${selected.title} open at ${evaluation.totalScore} (${evaluation.recommendationLabel})` : 'no opportunity open';
        return read(`State version ${state.stateVersion}: ${where}; decision ${decisionStatus}. ${changedSinceSummary}`, data);
      },
    },

    {
      name: 'civicbid_generate_owner_brief',
      title: 'Generate owner brief',
      description:
        'Generates the executive owner brief from the approved decision, its evaluation, assignments, risks, human changes, and the audit log, within a word budget. Use it only after the human has approved the staged decision; before that it fails with DECISION_NOT_APPROVED and the right move is to stop and ask the human to approve in the workspace. Side effect: the brief is stored and shown. ' +
        WRITE_NOTE,
      inputSchema: generateOwnerBriefSchema,
      readOnly: false,
      example: { maximumWords: 260, emphasis: ['decision', 'risks', 'next_actions'] },
      handler(ctx, input) {
        const options: OwnerBriefOptions = {
          maximumWords: typeof input.maximumWords === 'number' ? input.maximumWords : 260,
          emphasis: Array.isArray(input.emphasis) ? (input.emphasis as BriefEmphasis[]) : [],
          title: typeof input.title === 'string' && input.title.trim() ? input.title : null,
        };
        const result = ctx.store.dispatch({ type: 'generate_owner_brief', options, ...ctx.provenance });
        if (!result.ok) return { ok: false, error: result.error };
        const brief = result.state.ownerBrief;
        if (!brief) return fail('INTERNAL_STATE_ERROR', 'The owner brief was not stored.', 'Call civicbid_get_workspace_state and retry once.');
        const data = {
          brief: {
            id: brief.id,
            title: brief.title,
            wordCount: brief.wordCount,
            maximumWords: brief.maximumWords,
            sections: brief.sections.map((s) => ({ heading: s.heading, body: s.body })),
            text: brief.text,
            stateVersion: brief.stateVersion,
            decisionId: brief.decisionId,
            generatedAt: brief.generatedAt,
          },
          approvedDecisionId: brief.decisionId,
          visiblePanel: result.state.ui.visiblePanel,
        };
        return written(result, `Generated the owner brief "${brief.title}" (${brief.wordCount} words) from approved decision ${brief.decisionId}.`, data);
      },
    },

    {
      name: 'civicbid_reset_demo',
      title: 'Reset demonstration',
      description:
        'Restores the demonstration to its seed state: the company profile, assignments, risks, decisions, approval, brief, and activity log are all cleared. Use it only when the human asks to start over, and pass the confirmation string exactly. Do not use it to undo a single step. Side effect: all workspace data is replaced. ' +
        WRITE_NOTE,
      inputSchema: resetDemoSchema,
      readOnly: false,
      example: { confirm: RESET_CONFIRMATION },
      handler(ctx, input) {
        if (input.confirm !== RESET_CONFIRMATION) {
          return fail('INVALID_INPUT', `confirm must be exactly ${RESET_CONFIRMATION}.`, `Pass { "confirm": "${RESET_CONFIRMATION}" }.`);
        }
        const result = ctx.store.dispatch({ type: 'reset_demo', ...ctx.provenance });
        if (!result.ok) return { ok: false, error: result.error };
        const state = result.state;
        const data = {
          reset: true,
          stateVersion: state.stateVersion,
          selectedOpportunityId: state.selectedOpportunityId,
          visiblePanel: state.ui.visiblePanel,
        };
        return written(result, 'Reset the demonstration: every assignment, risk, decision, and brief was cleared and the seed company profile restored.', data);
      },
    },

    {
      name: 'civicbid_simulate_company_change',
      title: 'Simulate company change',
      description:
        'Previews how the evaluation of every opportunity (or one opportunity) would move if the company profile changed, for example if a JV partner were confirmed with more bonding, without writing anything. Use it to recommend a profile change to the human, who is the only one who can make it in the workspace. Do not use it to change the profile; no tool can. Read-only.',
      inputSchema: simulateCompanyChangeSchema,
      readOnly: true,
      example: { changes: { jvPartnerConfirmed: true, jvCombinedBondingUsd: 60000000 }, opportunityId: OPPORTUNITY_ID_VALUES[0] },
      handler(ctx, input) {
        const state = ctx.store.getState();
        const changes = (input.changes ?? {}) as Partial<CompanyProfile>;
        if (Object.keys(changes).length === 0) {
          return fail('INVALID_INPUT', 'changes must include at least one company profile field.', 'Pass fields such as { "jvPartnerConfirmed": true, "jvCombinedBondingUsd": 60000000 }.');
        }
        const opportunityId = typeof input.opportunityId === 'string' ? input.opportunityId : null;
        const all = simulateProfileChange(state, changes);
        const deltas = opportunityId ? all.filter((d) => d.opportunityId === opportunityId) : all;
        if (deltas.length === 0) {
          return fail('NOT_FOUND', `Opportunity "${opportunityId}" was not found.`, `Use one of: ${opportunityIdList(state)}.`);
        }
        const moved = deltas.filter(deltaMoved);
        const preferredId = opportunityId ?? state.stagedDecision?.opportunityId ?? state.selectedOpportunityId ?? null;
        const focus =
          moved.find((d) => d.opportunityId === preferredId) ??
          moved.find((d) => d.recommendationBefore !== d.recommendationAfter) ??
          moved.reduce<EvaluationDelta | null>((best, d) => (!best || Math.abs(d.scoreAfter - d.scoreBefore) > Math.abs(best.scoreAfter - best.scoreBefore) ? d : best), null);
        const verb = changes.jvPartnerConfirmed === true ? 'Confirming the JV package' : 'Applying these profile changes';
        const recommendationToHuman = focus
          ? `${verb} would move ${focus.title} from ${focus.scoreBefore} (${recommendationLabel(focus.recommendationBefore)}) to ${focus.scoreAfter} (${recommendationLabel(focus.recommendationAfter)}). Only the human can make this change in the workspace.`
          : `${verb} would not move any score or recommendation, so there is no reason to ask the human for it.`;
        const summary = focus
          ? `${verb} would move ${focus.title} from ${focus.scoreBefore} (${recommendationLabel(focus.recommendationBefore)}) to ${focus.scoreAfter} (${recommendationLabel(focus.recommendationAfter)}); nothing was written.`
          : `${verb} would not move any score or recommendation; nothing was written.`;
        return read(summary, {
          simulated: true,
          changes: { ...changes },
          deltas: deltas.map((d) => ({ ...d, gapsClosed: [...d.gapsClosed], gapsOpened: [...d.gapsOpened] })),
          recommendationToHuman,
        });
      },
    },
  ];
}
