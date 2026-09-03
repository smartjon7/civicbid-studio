/**
 * Result envelope shared by every tool call.
 *
 * Every tool returns the same shape so an agent can verify the outcome of a
 * call from the response alone: the state version after the call, the fields
 * that changed, and a verification block read from the live store.
 */
import { selectDecisionStatus } from '../domain/selectors';
import type { AppState } from '../store/types';
import type { CivicBidToolResult, ToolError, ToolVerification } from './types';

export function lastEventId(state: AppState): string | null {
  return state.activity.length ? state.activity[state.activity.length - 1].id : null;
}

export function verificationFor(state: AppState, activityEventId: string | null): ToolVerification {
  return {
    activityEventId,
    selectedOpportunityId: state.selectedOpportunityId,
    visiblePanel: state.ui.visiblePanel,
    focusedRequirementIds: [...state.focusedRequirementIds],
    decisionStatus: selectDecisionStatus(state),
  };
}

/** Round-trips through JSON so results never carry functions, class instances, or undefined. */
export function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value === undefined ? null : value)) as T;
}

export interface EnvelopeInput {
  ok: boolean;
  tool: string;
  summary: string;
  state: AppState;
  activityEventId: string | null;
  changed?: string[];
  data?: unknown;
  warnings?: string[];
  error?: ToolError;
}

export function buildEnvelope(input: EnvelopeInput): CivicBidToolResult {
  const result: CivicBidToolResult = {
    ok: input.ok,
    tool: input.tool,
    summary: input.summary,
    stateVersion: input.state.stateVersion,
    changed: [...(input.changed ?? [])],
    warnings: [...(input.warnings ?? [])],
    verification: verificationFor(input.state, input.activityEventId),
  };
  if (input.data !== undefined) result.data = input.data;
  if (input.error) result.error = { code: input.error.code, message: input.error.message, recovery: input.error.recovery };
  return toPlainJson(result);
}
