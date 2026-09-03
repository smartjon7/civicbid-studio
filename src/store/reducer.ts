/**
 * The single write path for CivicBid Studio.
 *
 * Both the human interface and the WebMCP tools dispatch Commands through
 * applyCommand. Approval and rejection are accepted only from the human UI
 * channel; there is no tool that can reach them.
 */
import {
  BRIEF_EMPHASES,
  COMPANY_PROFILE_FIELDS,
  OWNER_ROLES,
  RECOMMENDATIONS,
  RISK_STATUSES,
  SEVERITIES,
  type ActivityEvent,
  type AppState,
  type Command,
  type CommandResult,
  type CompanyProfile,
  type ErrorCode,
  type EvaluationDelta,
  type ProfileChange,
  type Provenance,
  type StagedDecision,
} from './types';
import { createSeedState, JV_PRESET_CHANGES, JV_PRESET_LABEL } from '../data/seed';
import {
  diffEvaluations,
  evaluateAll,
  evaluateOpportunity,
  rankEvaluations,
  summariesDiffer,
  summarizeEvaluation,
} from '../domain/evaluateOpportunity';
import { buildOwnerBrief } from '../domain/ownerBrief';
import { actorLabel, daysBetween, formatUsd, parseIsoDate, recommendationLabel } from '../domain/format';

export interface ReducerContext {
  now(): string;
  newId(prefix: string): string;
}

export function createDefaultContext(): ReducerContext {
  let counter = 0;
  return {
    now: () => new Date().toISOString(),
    newId: (prefix) =>
      `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  };
}

/** Deterministic context for tests: fixed clock, sequential ids. */
export function createTestContext(startIso = '2026-09-03T14:00:00.000Z'): ReducerContext {
  let counter = 0;
  let tick = 0;
  const base = new Date(startIso).getTime();
  return {
    now: () => new Date(base + tick++ * 1000).toISOString(),
    newId: (prefix) => `${prefix}-${String(++counter).padStart(4, '0')}`,
  };
}

const MAX_ACTIVITY = 400;
const REQUIREMENT_ID_PATTERN = /^[A-Z]{2,5}-\d{2}$/;
const RISK_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}$/;

function fail(state: AppState, code: ErrorCode, message: string, recovery: string): CommandResult {
  return { ok: false, state, error: { code, message, recovery } };
}

function noop(state: AppState, warnings: string[] = []): CommandResult {
  return { ok: true, state, event: null, changed: [], noop: true, warnings };
}

interface EventInput {
  action: string;
  title: string;
  detail?: string;
  changed: string[];
  opportunityId?: string | null;
  profileChanges?: ProfileChange[];
  evaluationDelta?: EvaluationDelta | null;
}

function commit(
  state: AppState,
  next: Partial<AppState>,
  provenance: Provenance,
  input: EventInput,
  ctx: ReducerContext,
  warnings: string[] = [],
): CommandResult {
  const before = state.stateVersion;
  const after = before + 1;
  const lastSeq = state.activity.length ? state.activity[state.activity.length - 1].seq : 0;
  const event: ActivityEvent = {
    id: ctx.newId('evt'),
    seq: lastSeq + 1,
    at: ctx.now(),
    actor: provenance.actor,
    channel: provenance.channel,
    action: input.action,
    title: input.title,
    detail: input.detail ?? '',
    changed: input.changed,
    stateVersionBefore: before,
    stateVersionAfter: after,
    opportunityId: input.opportunityId === undefined ? (next.selectedOpportunityId ?? state.selectedOpportunityId) : input.opportunityId,
    profileChanges: input.profileChanges ?? [],
    evaluationDelta: input.evaluationDelta ?? null,
  };
  const activity = [...state.activity, event].slice(-MAX_ACTIVITY);
  const merged: AppState = {
    ...state,
    ...next,
    stateVersion: after,
    activity,
    ui: { ...state.ui, ...(next.ui ?? {}), lastToast: { id: event.id, text: event.title, actor: event.actor } },
  };
  return { ok: true, state: merged, event, changed: input.changed, noop: false, warnings };
}

function who(p: Provenance): string {
  return actorLabel(p.actor, p.channel);
}

function opportunityIds(state: AppState): string {
  return state.opportunities.map((o) => o.id).join(', ');
}

function requireSelected(state: AppState): { ok: true; opportunityId: string } | { ok: false; result: CommandResult } {
  if (!state.selectedOpportunityId) {
    return {
      ok: false,
      result: fail(
        state,
        'NO_OPPORTUNITY_SELECTED',
        'No opportunity is open in the workspace.',
        `Call civicbid_open_opportunity with one of: ${opportunityIds(state)}.`,
      ),
    };
  }
  return { ok: true, opportunityId: state.selectedOpportunityId };
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function stringWithin(value: unknown, min: number, max: number): value is string {
  return isString(value) && value.trim().length >= min && value.trim().length <= max;
}

function locateRequirement(state: AppState, requirementId: string) {
  for (const opportunity of state.opportunities) {
    const requirement = opportunity.requirements.find((r) => r.id === requirementId);
    if (requirement) return { opportunity, requirement };
  }
  return null;
}

function requirementInSelected(state: AppState, requirementId: string, selectedId: string): CommandResult | null {
  if (!isString(requirementId) || !REQUIREMENT_ID_PATTERN.test(requirementId)) {
    return fail(state, 'INVALID_INPUT', `"${String(requirementId)}" is not a requirement id.`, 'Use ids such as RAIL-01 from civicbid_list_requirements.');
  }
  const located = locateRequirement(state, requirementId);
  if (!located) {
    return fail(state, 'NOT_FOUND', `Requirement ${requirementId} does not exist.`, 'Call civicbid_list_requirements for the valid ids.');
  }
  if (located.opportunity.id !== selectedId) {
    return fail(
      state,
      'REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY',
      `Requirement ${requirementId} belongs to ${located.opportunity.title}, not the open opportunity.`,
      `Open ${located.opportunity.id} first with civicbid_open_opportunity, or use a requirement from the open opportunity.`,
    );
  }
  return null;
}

function validateProfileChanges(changes: Partial<CompanyProfile>): { ok: true; clean: Partial<CompanyProfile> } | { ok: false; message: string } {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return { ok: false, message: 'Profile changes must be an object.' };
  const clean: Partial<CompanyProfile> = {};
  for (const [key, raw] of Object.entries(changes)) {
    if (!COMPANY_PROFILE_FIELDS.includes(key as keyof CompanyProfile)) return { ok: false, message: `Unknown company field "${key}".` };
    const field = key as keyof CompanyProfile;
    switch (field) {
      case 'name':
        if (!stringWithin(raw, 1, 80)) return { ok: false, message: 'Company name must be 1–80 characters.' };
        clean.name = (raw as string).trim();
        break;
      case 'dbeCertified':
      case 'jvPartnerConfirmed':
        if (typeof raw !== 'boolean') return { ok: false, message: `${field} must be true or false.` };
        clean[field] = raw;
        break;
      case 'safetyRecord':
        if (raw !== 'strong' && raw !== 'acceptable' && raw !== 'poor') return { ok: false, message: 'safetyRecord must be strong, acceptable, or poor.' };
        clean.safetyRecord = raw;
        break;
      case 'backlogUtilizationPct':
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 100) return { ok: false, message: 'backlogUtilizationPct must be 0–100.' };
        clean.backlogUtilizationPct = Math.round(raw);
        break;
      default:
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return { ok: false, message: `${field} must be a non-negative number.` };
        clean[field] = Math.round(raw) as never;
    }
  }
  return { ok: true, clean };
}

function stalenessFor(decision: StagedDecision, nextState: AppState, changedFields: string[]): { stale: boolean; staleReason: string | null } {
  const evaluation = evaluateOpportunity(nextState, decision.opportunityId);
  if (!evaluation) return { stale: decision.stale, staleReason: decision.staleReason };
  const summary = summarizeEvaluation(evaluation, nextState.stateVersion);
  if (!summariesDiffer(summary, decision.evaluationSnapshot)) return { stale: decision.stale, staleReason: decision.staleReason };
  const suffix = decision.status === 'approved'
    ? 'The approved decision stands as recorded; stage a new decision to replace it.'
    : 'Reevaluate and re-stage before approval.';
  return {
    stale: true,
    staleReason: `Company profile changed after this was staged (${changedFields.join(', ')}): score ${decision.evaluationSnapshot.totalScore} → ${summary.totalScore}, ${recommendationLabel(decision.evaluationSnapshot.recommendation)} → ${recommendationLabel(summary.recommendation)}. ${suffix}`,
  };
}

export function applyCommand(state: AppState, command: Command, ctx: ReducerContext): CommandResult {
  switch (command.type) {
    case 'set_ui': {
      return { ok: true, state: { ...state, ui: { ...state.ui, ...command.ui } }, event: null, changed: [], noop: false, warnings: [] };
    }

    case 'select_opportunity': {
      const opportunity = state.opportunities.find((o) => o.id === command.opportunityId);
      if (!opportunity) {
        return fail(state, 'NOT_FOUND', `Opportunity "${String(command.opportunityId)}" was not found.`, `Use one of: ${opportunityIds(state)}.`);
      }
      if (state.selectedOpportunityId === opportunity.id && state.ui.visiblePanel === 'workspace') return noop(state);
      const switching = state.selectedOpportunityId !== opportunity.id;
      const evaluation = evaluateOpportunity(state, opportunity.id)!;
      return commit(
        state,
        {
          selectedOpportunityId: opportunity.id,
          focusedRequirementIds: switching ? [] : state.focusedRequirementIds,
          focusReason: switching ? null : state.focusReason,
          ui: { ...state.ui, visiblePanel: 'workspace' },
        },
        command,
        {
          action: 'open_opportunity',
          title: `${who(command)} opened ${opportunity.title}`,
          detail: `${opportunity.agency} · ${formatUsd(opportunity.estimatedValueUsd)} · due ${opportunity.deadline} · score ${evaluation.totalScore}, ${evaluation.recommendationLabel}.`,
          changed: ['selectedOpportunityId', 'ui.visiblePanel', ...(switching ? ['focusedRequirementIds'] : [])],
          opportunityId: opportunity.id,
        },
        ctx,
      );
    }

    case 'compare_opportunities': {
      const ids = Array.isArray(command.opportunityIds) ? command.opportunityIds : [];
      const unique = [...new Set(ids)];
      if (unique.length < 2 || unique.length > 3 || unique.length !== ids.length) {
        return fail(state, 'INVALID_INPUT', 'Provide two or three distinct opportunity ids.', `Choose from: ${opportunityIds(state)}.`);
      }
      const missing = unique.filter((id) => !state.opportunities.some((o) => o.id === id));
      if (missing.length) {
        return fail(state, 'NOT_FOUND', `Unknown opportunity id(s): ${missing.join(', ')}.`, `Use ids from civicbid_list_opportunities: ${opportunityIds(state)}.`);
      }
      const ranked = rankEvaluations(evaluateAll(state).filter((e) => unique.includes(e.opportunityId)));
      const top = ranked[0];
      return commit(
        state,
        { comparisonIds: unique, ui: { ...state.ui, visiblePanel: 'comparison' } },
        command,
        {
          action: 'compare_opportunities',
          title: `${who(command)} compared ${ranked.map((e) => e.title).join(' vs ')}`,
          detail: `Strongest: ${top.title} at ${top.totalScore} (${top.recommendationLabel}). ${ranked.slice(1).map((e) => `${e.title} ${e.totalScore} (${e.recommendationLabel})`).join('; ')}.`,
          changed: ['comparisonIds', 'ui.visiblePanel'],
          opportunityId: state.selectedOpportunityId,
        },
        ctx,
      );
    }

    case 'focus_requirements': {
      const selected = requireSelected(state);
      if (!selected.ok) return selected.result;
      const ids = Array.isArray(command.requirementIds) ? [...new Set(command.requirementIds)] : [];
      if (ids.length < 1 || ids.length > 10) {
        return fail(state, 'INVALID_INPUT', 'Provide between 1 and 10 requirement ids.', 'Use ids from civicbid_list_requirements.');
      }
      if (command.mode !== 'replace' && command.mode !== 'add') {
        return fail(state, 'INVALID_INPUT', 'mode must be "replace" or "add".', 'Pass mode: "replace" to set the focus or "add" to extend it.');
      }
      if (!stringWithin(command.reason, 1, 240)) {
        return fail(state, 'INVALID_INPUT', 'reason must be 1–240 characters.', 'Say in one sentence why these requirements deserve human attention.');
      }
      for (const id of ids) {
        const problem = requirementInSelected(state, id, selected.opportunityId);
        if (problem) return problem;
      }
      const nextIds = command.mode === 'add' ? [...new Set([...state.focusedRequirementIds, ...ids])] : ids;
      const reason = command.reason.trim();
      if (nextIds.join(',') === state.focusedRequirementIds.join(',') && reason === state.focusReason && state.ui.visiblePanel === 'workspace') {
        return noop(state);
      }
      return commit(
        state,
        { focusedRequirementIds: nextIds, focusReason: reason, ui: { ...state.ui, visiblePanel: 'workspace' } },
        command,
        {
          action: 'focus_requirements',
          title: `${who(command)} focused ${nextIds.length} requirement${nextIds.length === 1 ? '' : 's'} for review: ${nextIds.join(', ')}`,
          detail: reason,
          changed: ['focusedRequirementIds', 'focusReason'],
        },
        ctx,
      );
    }

    case 'clear_focus': {
      if (state.focusedRequirementIds.length === 0) return noop(state);
      return commit(
        state,
        { focusedRequirementIds: [], focusReason: null },
        command,
        { action: 'clear_focus', title: `${who(command)} cleared the requirement focus`, changed: ['focusedRequirementIds', 'focusReason'] },
        ctx,
      );
    }

    case 'assign_requirement': {
      const selected = requireSelected(state);
      if (!selected.ok) return selected.result;
      const problem = requirementInSelected(state, command.requirementId, selected.opportunityId);
      if (problem) return problem;
      if (!OWNER_ROLES.includes(command.ownerRole)) {
        return fail(state, 'INVALID_INPUT', `"${String(command.ownerRole)}" is not an owner role.`, `Use one of: ${OWNER_ROLES.join(', ')}.`);
      }
      if (!isString(command.dueDate) || !parseIsoDate(command.dueDate)) {
        return fail(state, 'INVALID_INPUT', 'dueDate must be a calendar date in YYYY-MM-DD form.', 'Example: 2026-09-15.');
      }
      const note = isString(command.note) ? command.note.trim() : '';
      if (note.length > 300) {
        return fail(state, 'INVALID_INPUT', 'note must be 300 characters or fewer.', 'Shorten the note.');
      }
      const opportunity = state.opportunities.find((o) => o.id === selected.opportunityId)!;
      const warnings: string[] = [];
      if (daysBetween(command.dueDate, opportunity.deadline) < 0) warnings.push(`Due date ${command.dueDate} is after the bid deadline ${opportunity.deadline}.`);
      if (daysBetween(state.demoAnchorDate, command.dueDate) < 0) warnings.push(`Due date ${command.dueDate} is before the demo date ${state.demoAnchorDate}.`);

      const existing = state.assignments[command.requirementId];
      if (existing && existing.ownerRole === command.ownerRole && existing.dueDate === command.dueDate && existing.note === note) {
        return noop(state, warnings);
      }
      const now = ctx.now();
      const changed: string[] = [];
      if (!existing) changed.push(`assignments.${command.requirementId}`);
      else {
        if (existing.ownerRole !== command.ownerRole) changed.push(`assignments.${command.requirementId}.ownerRole`);
        if (existing.dueDate !== command.dueDate) changed.push(`assignments.${command.requirementId}.dueDate`);
        if (existing.note !== note) changed.push(`assignments.${command.requirementId}.note`);
      }
      const assignment = {
        requirementId: command.requirementId,
        opportunityId: selected.opportunityId,
        ownerRole: command.ownerRole,
        dueDate: command.dueDate,
        note,
        assignedBy: command.actor,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      return commit(
        state,
        { assignments: { ...state.assignments, [command.requirementId]: assignment }, ui: { ...state.ui, visiblePanel: 'workspace' } },
        command,
        {
          action: 'assign_requirement',
          title: `${who(command)} ${existing ? 'updated the assignment for' : 'assigned'} ${command.requirementId} to ${command.ownerRole}`,
          detail: `Due ${command.dueDate}${note ? ` — ${note}` : ''}`,
          changed,
        },
        ctx,
        warnings,
      );
    }

    case 'mark_requirement_complete': {
      const selected = requireSelected(state);
      if (!selected.ok) return selected.result;
      const problem = requirementInSelected(state, command.requirementId, selected.opportunityId);
      if (problem) return problem;
      const has = state.completedRequirementIds.includes(command.requirementId);
      if (has === command.complete) return noop(state);
      const completedRequirementIds = command.complete
        ? [...state.completedRequirementIds, command.requirementId]
        : state.completedRequirementIds.filter((id) => id !== command.requirementId);
      return commit(
        state,
        { completedRequirementIds },
        command,
        {
          action: 'mark_requirement_complete',
          title: `${who(command)} marked ${command.requirementId} ${command.complete ? 'complete' : 'not complete'}`,
          changed: ['completedRequirementIds'],
        },
        ctx,
      );
    }

    case 'upsert_risk': {
      const selected = requireSelected(state);
      if (!selected.ok) return selected.result;
      const risk = command.risk;
      if (!risk || typeof risk !== 'object') return fail(state, 'INVALID_INPUT', 'risk must be an object.', 'Provide riskKey, title, severity, rationale, mitigation, ownerRole, and status.');
      if (!isString(risk.riskKey) || !RISK_KEY_PATTERN.test(risk.riskKey)) {
        return fail(state, 'INVALID_INPUT', 'riskKey must be a lowercase slug (letters, digits, hyphens; 2–49 characters).', 'Example: bonding-shortfall.');
      }
      if (!stringWithin(risk.title, 1, 100)) return fail(state, 'INVALID_INPUT', 'title must be 1–100 characters.', 'Shorten the title.');
      if (!SEVERITIES.includes(risk.severity)) return fail(state, 'INVALID_INPUT', `severity must be one of ${SEVERITIES.join(', ')}.`, 'Pick a severity.');
      if (!OWNER_ROLES.includes(risk.ownerRole)) return fail(state, 'INVALID_INPUT', `"${String(risk.ownerRole)}" is not an owner role.`, `Use one of: ${OWNER_ROLES.join(', ')}.`);
      if (!RISK_STATUSES.includes(risk.status)) return fail(state, 'INVALID_INPUT', `status must be one of ${RISK_STATUSES.join(', ')}.`, 'Pick a status.');
      const rationale = isString(risk.rationale) ? risk.rationale.trim() : '';
      const mitigation = isString(risk.mitigation) ? risk.mitigation.trim() : '';
      if (rationale.length > 500 || mitigation.length > 500) return fail(state, 'INVALID_INPUT', 'rationale and mitigation must be 500 characters or fewer.', 'Shorten the text.');
      const related = Array.isArray(risk.relatedRequirementIds) ? [...new Set(risk.relatedRequirementIds)] : [];
      if (related.length > 5) return fail(state, 'INVALID_INPUT', 'relatedRequirementIds may hold at most five ids.', 'Keep the most relevant five.');
      for (const id of related) {
        const problem = requirementInSelected(state, id, selected.opportunityId);
        if (problem) return problem;
      }
      const index = state.risks.findIndex((r) => r.riskKey === risk.riskKey && r.opportunityId === selected.opportunityId);
      const existing = index >= 0 ? state.risks[index] : null;
      const title = risk.title.trim();
      if (
        existing &&
        existing.title === title &&
        existing.severity === risk.severity &&
        existing.rationale === rationale &&
        existing.mitigation === mitigation &&
        existing.ownerRole === risk.ownerRole &&
        existing.status === risk.status &&
        existing.relatedRequirementIds.join(',') === related.join(',')
      ) {
        return noop(state);
      }
      const now = ctx.now();
      const record = {
        riskKey: risk.riskKey,
        opportunityId: selected.opportunityId,
        title,
        severity: risk.severity,
        relatedRequirementIds: related,
        rationale,
        mitigation,
        ownerRole: risk.ownerRole,
        status: risk.status,
        createdBy: existing?.createdBy ?? command.actor,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      const risks = existing ? state.risks.map((r, i) => (i === index ? record : r)) : [...state.risks, record];
      return commit(
        state,
        { risks, ui: { ...state.ui, visiblePanel: 'workspace' } },
        command,
        {
          action: 'upsert_risk',
          title: `${who(command)} ${existing ? 'updated' : 'added'} risk "${title}" (${risk.severity})`,
          detail: mitigation ? `Mitigation: ${mitigation}` : rationale,
          changed: [`risks.${risk.riskKey}`],
        },
        ctx,
      );
    }

    case 'stage_decision': {
      const selected = requireSelected(state);
      if (!selected.ok) return selected.result;
      const input = command.input;
      if (!input || typeof input !== 'object') return fail(state, 'INVALID_INPUT', 'input must be an object.', 'Provide recommendation, rationale, conditions, assumptions, and confidence.');
      if (!RECOMMENDATIONS.includes(input.recommendation)) {
        return fail(state, 'INVALID_INPUT', `recommendation must be one of ${RECOMMENDATIONS.join(', ')}.`, 'Pick a recommendation.');
      }
      if (!stringWithin(input.rationale, 40, 1200)) {
        return fail(state, 'INVALID_INPUT', 'rationale must be 40–1,200 characters.', 'Explain the recommendation in a few sentences.');
      }
      const listOk = (list: unknown): list is string[] =>
        Array.isArray(list) && list.length <= 8 && list.every((item) => stringWithin(item, 1, 240));
      const conditions = input.conditions ?? [];
      const assumptions = input.assumptions ?? [];
      if (!listOk(conditions) || !listOk(assumptions)) {
        return fail(state, 'INVALID_INPUT', 'conditions and assumptions must be arrays of up to 8 strings, each 1–240 characters.', 'Trim the lists.');
      }
      if (!Number.isInteger(input.confidence) || input.confidence < 0 || input.confidence > 100) {
        return fail(state, 'INVALID_INPUT', 'confidence must be an integer from 0 to 100.', 'Example: 72.');
      }
      const evaluation = evaluateOpportunity(state, selected.opportunityId)!;
      if (evaluation.unmitigableGaps.length > 0 && input.recommendation !== 'no_go') {
        return fail(
          state,
          'INVALID_INPUT',
          `A ${recommendationLabel(input.recommendation)} recommendation contradicts ${evaluation.unmitigableGaps.length} unmitigable gate failure(s): ${evaluation.unmitigableGaps.join(', ')}.`,
          'Stage no_go, or ask the human to change the company profile so the disqualifying requirement is met, then stage again.',
        );
      }
      const previous = state.stagedDecision;
      const decision: StagedDecision = {
        id: ctx.newId('dec'),
        opportunityId: selected.opportunityId,
        recommendation: input.recommendation,
        rationale: input.rationale.trim(),
        conditions: conditions.map((c) => c.trim()),
        assumptions: assumptions.map((a) => a.trim()),
        confidence: input.confidence,
        stagedBy: command.actor,
        stagedAt: ctx.now(),
        stateVersion: state.stateVersion + 1,
        evaluationSnapshot: summarizeEvaluation(evaluation, state.stateVersion + 1),
        supersedesDecisionId: previous?.id ?? null,
        status: 'pending',
        stale: false,
        staleReason: null,
      };
      const opportunity = state.opportunities.find((o) => o.id === selected.opportunityId)!;
      const revised = previous ? ` (revised from ${recommendationLabel(previous.recommendation)}${previous.status !== 'pending' ? `, previously ${previous.status}` : ''})` : '';
      return commit(
        state,
        {
          stagedDecision: decision,
          decisionHistory: previous ? [...state.decisionHistory, previous] : state.decisionHistory,
          approval: null,
          ownerBrief: previous && previous.status === 'approved' ? state.ownerBrief : state.ownerBrief,
          ui: { ...state.ui, visiblePanel: 'workspace' },
        },
        command,
        {
          action: 'stage_decision',
          title: `${who(command)} staged ${recommendationLabel(input.recommendation)} for ${opportunity.title}${revised}`,
          detail: `Confidence ${input.confidence}%, score ${evaluation.totalScore}. Human approval is still required.`,
          changed: ['stagedDecision', 'approval', ...(previous ? ['decisionHistory'] : [])],
          opportunityId: selected.opportunityId,
        },
        ctx,
      );
    }

    case 'approve_decision':
    case 'reject_decision': {
      if (command.actor !== 'human' || command.channel !== 'ui') {
        return fail(
          state,
          'HUMAN_ONLY_ACTION',
          'Approving or rejecting a decision is a human-only action taken in the workspace.',
          'Stop and ask the human to review the pending decision card and click Approve or Reject.',
        );
      }
      const decision = state.stagedDecision;
      if (!decision || decision.status !== 'pending') {
        return fail(state, 'DECISION_NOT_PENDING', 'There is no pending decision to act on.', 'Stage a recommendation first.');
      }
      const approving = command.type === 'approve_decision';
      const evaluation = evaluateOpportunity(state, decision.opportunityId)!;
      const opportunity = state.opportunities.find((o) => o.id === decision.opportunityId)!;
      const note = isString(command.note) ? command.note.trim().slice(0, 300) : '';
      const approval = {
        decisionId: decision.id,
        opportunityId: decision.opportunityId,
        status: approving ? ('approved' as const) : ('rejected' as const),
        decidedBy: 'human' as const,
        decidedAt: ctx.now(),
        note,
        stateVersion: state.stateVersion + 1,
        evaluationSnapshot: summarizeEvaluation(evaluation, state.stateVersion + 1),
      };
      return commit(
        state,
        { approval, stagedDecision: { ...decision, status: approval.status } },
        command,
        {
          action: approving ? 'approve_decision' : 'reject_decision',
          title: `Human ${approving ? 'approved' : 'rejected'} ${recommendationLabel(decision.recommendation)} for ${opportunity.title}`,
          detail: note || (approving ? 'Approved in the workspace. Only a human can take this action.' : 'Rejected in the workspace. Only a human can take this action.'),
          changed: ['approval', 'stagedDecision.status'],
          opportunityId: decision.opportunityId,
        },
        ctx,
      );
    }

    case 'apply_jv_preset':
    case 'update_company_profile': {
      if (command.actor !== 'human') {
        return fail(
          state,
          'HUMAN_ONLY_ACTION',
          'The company profile is edited only by the human in the workspace.',
          'Ask the human to change the profile (for example, click "Confirm JV package"), or call civicbid_simulate_company_change to preview the effect without writing.',
        );
      }
      const label = command.type === 'apply_jv_preset' ? JV_PRESET_LABEL : (isString(command.label) && command.label.trim() ? command.label.trim() : 'updated the company profile');
      const validation = validateProfileChanges(command.type === 'apply_jv_preset' ? JV_PRESET_CHANGES : command.changes);
      if (!validation.ok) return fail(state, 'INVALID_INPUT', validation.message, 'Correct the field and try again.');
      const profileChanges: ProfileChange[] = [];
      for (const [key, value] of Object.entries(validation.clean)) {
        const field = key as keyof CompanyProfile;
        if (state.company[field] !== value) profileChanges.push({ field, before: state.company[field], after: value as string | number | boolean });
      }
      if (profileChanges.length === 0) return noop(state);
      const company = { ...state.company, ...validation.clean };
      const before = evaluateAll(state);
      const interim: AppState = { ...state, company, stateVersion: state.stateVersion + 1 };
      const after = evaluateAll(interim);
      const deltas = before.map((b, i) => diffEvaluations(b, after[i]));
      const focusId = state.stagedDecision?.opportunityId ?? state.selectedOpportunityId;
      const primary = deltas.find((d) => d.opportunityId === focusId) ?? deltas.reduce((best, d) => (Math.abs(d.scoreAfter - d.scoreBefore) > Math.abs(best.scoreAfter - best.scoreBefore) ? d : best), deltas[0]);
      const changedFields = profileChanges.map((c) => c.field);
      let stagedDecision = state.stagedDecision;
      if (stagedDecision) {
        const staleness = stalenessFor(stagedDecision, interim, changedFields);
        stagedDecision = { ...stagedDecision, ...staleness };
      }
      const summary = deltas
        .filter((d) => d.scoreBefore !== d.scoreAfter || d.recommendationBefore !== d.recommendationAfter)
        .map((d) => `${d.title}: ${d.scoreBefore} → ${d.scoreAfter} (${recommendationLabel(d.recommendationBefore)} → ${recommendationLabel(d.recommendationAfter)})`)
        .join('; ');
      return commit(
        state,
        { company, stagedDecision },
        command,
        {
          action: command.type,
          title: `Human ${command.type === 'apply_jv_preset' ? 'confirmed the JV package' : label}`,
          detail: `${profileChanges.map((c) => `${c.field}: ${formatValue(c.before)} → ${formatValue(c.after)}`).join('; ')}. ${summary ? `Evaluation moved — ${summary}.` : 'No evaluation changed.'}`,
          changed: [...changedFields.map((f) => `company.${f}`), ...(stagedDecision?.stale && !state.stagedDecision?.stale ? ['stagedDecision.stale'] : [])],
          opportunityId: focusId ?? null,
          profileChanges,
          evaluationDelta: primary ?? null,
        },
        ctx,
      );
    }

    case 'generate_owner_brief': {
      const decision = state.stagedDecision;
      if (!decision) {
        return fail(state, 'DECISION_NOT_APPROVED', 'No decision has been staged, so there is nothing approved to brief.', 'Stage a recommendation with civicbid_stage_decision, then ask the human to approve it.');
      }
      const approval = state.approval;
      if (!approval || approval.decisionId !== decision.id || approval.status !== 'approved') {
        const why = decision.status === 'rejected' ? 'The staged decision was rejected by the human.' : 'Human approval is still required.';
        return fail(state, 'DECISION_NOT_APPROVED', `${why} The owner brief can only be generated from an approved decision.`, 'Stop and ask the human to approve the pending decision in the workspace, then call civicbid_generate_owner_brief again.');
      }
      const options = command.options ?? { maximumWords: 260, emphasis: [], title: null };
      if (!Number.isInteger(options.maximumWords) || options.maximumWords < 150 || options.maximumWords > 400) {
        return fail(state, 'INVALID_INPUT', 'maximumWords must be an integer from 150 to 400.', 'Example: 260.');
      }
      const emphasis = Array.isArray(options.emphasis) ? [...new Set(options.emphasis)] : [];
      if (emphasis.length > 6 || emphasis.some((e) => !BRIEF_EMPHASES.includes(e))) {
        return fail(state, 'INVALID_INPUT', `emphasis must contain up to six of: ${BRIEF_EMPHASES.join(', ')}.`, 'Remove the unknown value.');
      }
      if (options.title !== null && options.title !== undefined && !stringWithin(options.title, 1, 100)) {
        return fail(state, 'INVALID_INPUT', 'title must be 1–100 characters.', 'Shorten the title or omit it.');
      }
      const brief = buildOwnerBrief(
        state,
        { maximumWords: options.maximumWords, emphasis, title: options.title ? options.title.trim() : null },
        { id: ctx.newId('brief'), generatedAt: ctx.now(), generatedBy: command.actor },
      );
      return commit(
        state,
        { ownerBrief: brief, ui: { ...state.ui, visiblePanel: 'brief' } },
        command,
        {
          action: 'generate_owner_brief',
          title: `${who(command)} generated the owner brief`,
          detail: `${brief.wordCount} words from state version ${state.stateVersion}, decision ${decision.id}.`,
          changed: ['ownerBrief', 'ui.visiblePanel'],
          opportunityId: decision.opportunityId,
        },
        ctx,
      );
    }

    case 'reset_demo': {
      const seed = createSeedState();
      const base: AppState = { ...seed, stateVersion: state.stateVersion, activity: [] };
      return commit(
        base,
        {},
        command,
        {
          action: 'reset_demo',
          title: `${who(command)} reset the demonstration`,
          detail: 'All synthetic workspace data was restored to the seed state.',
          changed: ['*'],
          opportunityId: null,
        },
        ctx,
      );
    }

    default: {
      const unknown = command as { type?: string };
      return fail(state, 'INVALID_INPUT', `Unknown command "${String(unknown.type)}".`, 'Use a supported command.');
    }
  }
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === 'number') return value >= 1_000_000 ? formatUsd(value) : String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value;
}
