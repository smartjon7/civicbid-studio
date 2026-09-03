/**
 * Read-side helpers shared by the interface and the WebMCP tools.
 * All functions are pure and take the current AppState.
 */
import type {
  ActivityEvent,
  AppState,
  Assignment,
  DecisionStatus,
  Opportunity,
  OpportunityEvaluation,
  RequirementCategory,
  RequirementEvaluation,
  RequirementStatus,
  RiskItem,
} from '../store/types';
import { evaluateAll, evaluateOpportunity, rankEvaluations } from './evaluateOpportunity';
import { daysBetween } from './format';

export function selectOpportunity(state: AppState, opportunityId: string | null): Opportunity | null {
  if (!opportunityId) return null;
  return state.opportunities.find((o) => o.id === opportunityId) ?? null;
}

export function selectSelectedOpportunity(state: AppState): Opportunity | null {
  return selectOpportunity(state, state.selectedOpportunityId);
}

export function selectSelectedEvaluation(state: AppState): OpportunityEvaluation | null {
  if (!state.selectedOpportunityId) return null;
  return evaluateOpportunity(state, state.selectedOpportunityId);
}

export function selectAllEvaluations(state: AppState): OpportunityEvaluation[] {
  return evaluateAll(state);
}

export function selectComparison(state: AppState): OpportunityEvaluation[] {
  if (state.comparisonIds.length === 0) return [];
  return rankEvaluations(evaluateAll(state).filter((e) => state.comparisonIds.includes(e.opportunityId)));
}

export function selectDecisionStatus(state: AppState): DecisionStatus {
  const decision = state.stagedDecision;
  if (!decision) return 'none';
  if (state.approval && state.approval.decisionId === decision.id) return state.approval.status;
  return 'pending';
}

export function selectRisksFor(state: AppState, opportunityId: string | null): RiskItem[] {
  if (!opportunityId) return [];
  return state.risks.filter((r) => r.opportunityId === opportunityId);
}

export function selectAssignmentsFor(state: AppState, opportunityId: string | null): Assignment[] {
  if (!opportunityId) return [];
  return Object.values(state.assignments)
    .filter((a) => a.opportunityId === opportunityId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.requirementId.localeCompare(b.requirementId));
}

export interface RequirementFilters {
  mandatoryOnly?: boolean;
  statuses?: RequirementStatus[];
  categories?: RequirementCategory[];
}

export function selectRequirements(state: AppState, opportunityId: string | null, filters: RequirementFilters = {}): RequirementEvaluation[] {
  if (!opportunityId) return [];
  const evaluation = evaluateOpportunity(state, opportunityId);
  if (!evaluation) return [];
  return evaluation.requirements.filter((r) => {
    if (filters.mandatoryOnly && !r.mandatory) return false;
    if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(r.status)) return false;
    if (filters.categories && filters.categories.length > 0 && !filters.categories.includes(r.category)) return false;
    return true;
  });
}

/** Human and system events that happened after the given state version. */
export function selectEventsSince(state: AppState, sinceStateVersion: number, actors: Array<ActivityEvent['actor']> = ['human', 'system']): ActivityEvent[] {
  return state.activity.filter((e) => e.stateVersionAfter > sinceStateVersion && actors.includes(e.actor));
}

export function selectHumanProfileEvents(state: AppState): ActivityEvent[] {
  return state.activity.filter((e) => e.actor === 'human' && e.profileChanges.length > 0);
}

export function selectRecentEvents(state: AppState, limit = 12): ActivityEvent[] {
  return state.activity.slice(-limit).reverse();
}

export function selectDaysToDeadline(state: AppState, opportunity: Opportunity): number {
  return daysBetween(state.demoAnchorDate, opportunity.deadline);
}

export function selectActivityCounts(state: AppState): { agent: number; human: number; system: number; total: number } {
  const counts = { agent: 0, human: 0, system: 0, total: state.activity.length };
  for (const event of state.activity) counts[event.actor] += 1;
  return counts;
}
