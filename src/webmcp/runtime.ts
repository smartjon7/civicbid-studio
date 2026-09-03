/**
 * Tool execution runtime.
 *
 * execute(name, input, channel) never throws. It validates the input against
 * the tool's schema, runs the handler with agent provenance, records the call
 * in the activity log, and returns the result envelope. Handlers always read
 * store.getState() at call time so a human edit made between two calls is
 * visible to the next call.
 */
import type { AppStore } from '../store/store';
import type { ActivityEvent, CommandError, Provenance } from '../store/types';
import { buildEnvelope, lastEventId } from './results';
import type { CivicBidToolResult, ToolChannel, ToolDefinition } from './types';
import { validateInput } from './validate';

export interface HandlerContext {
  store: AppStore;
  provenance: Provenance;
}

export type HandlerResult =
  | { ok: true; summary: string; data: unknown; changed: string[]; warnings: string[]; event: ActivityEvent | null }
  | { ok: false; error: CommandError };

export interface ToolSpec extends ToolDefinition {
  /** Runs the tool against the live store. Validation has already passed. */
  handler(ctx: HandlerContext, input: Record<string, unknown>): HandlerResult;
}

export type ToolExecutor = (name: string, input: unknown, channel: ToolChannel) => Promise<CivicBidToolResult>;

const RECOVERY_REREAD = 'Call civicbid_get_workspace_state to reread the current state, then retry once.';

export function createExecutor(store: AppStore, specs: ToolSpec[]): ToolExecutor {
  const byName = new Map<string, ToolSpec>(specs.map((spec) => [spec.name, spec]));
  const names = specs.map((spec) => spec.name).join(', ');

  function recordFailure(spec: ToolSpec, provenance: Provenance, error: CommandError): CivicBidToolResult {
    const audit = store.dispatch({ type: 'record_tool_call', tool: spec.name, ok: false, summary: `${error.code}: ${error.message}`, ...provenance });
    const activityEventId = audit.ok && audit.event ? audit.event.id : null;
    return buildEnvelope({ ok: false, tool: spec.name, summary: error.message, state: store.getState(), activityEventId, error });
  }

  return async function execute(name, input, channel) {
    const toolName = typeof name === 'string' ? name : String(name);
    const toolChannel: ToolChannel = channel === 'webmcp' ? 'webmcp' : 'console';
    try {
      const spec = byName.get(toolName);
      if (!spec) {
        return buildEnvelope({
          ok: false,
          tool: toolName,
          summary: `No tool named ${toolName} is registered.`,
          state: store.getState(),
          activityEventId: null,
          error: { code: 'NOT_FOUND', message: `No tool named "${toolName}" is registered.`, recovery: `Use one of: ${names}.` },
        });
      }

      const provenance: Provenance = { actor: 'agent', channel: toolChannel, tool: spec.name };
      const validation = validateInput(spec.inputSchema, input ?? {});
      if (!validation.ok) {
        return recordFailure(spec, provenance, {
          code: 'INVALID_INPUT',
          message: validation.message,
          recovery: `Correct the input and call ${spec.name} again. Example input: ${JSON.stringify(spec.example)}.`,
        });
      }

      const outcome = spec.handler({ store, provenance }, validation.value);
      if (!outcome.ok) return recordFailure(spec, provenance, outcome.error);

      let activityEventId: string | null;
      if (outcome.event) {
        // A domain event is the audit record for this call.
        activityEventId = outcome.event.id;
      } else if (spec.readOnly) {
        const audit = store.dispatch({ type: 'record_tool_call', tool: spec.name, ok: true, summary: outcome.summary, ...provenance });
        activityEventId = audit.ok && audit.event ? audit.event.id : lastEventId(store.getState());
      } else {
        // A write that changed nothing (idempotent repeat): point at the latest event, if any.
        activityEventId = lastEventId(store.getState());
      }

      return buildEnvelope({
        ok: true,
        tool: spec.name,
        summary: outcome.summary,
        state: store.getState(),
        activityEventId,
        changed: outcome.changed,
        data: outcome.data,
        warnings: outcome.warnings,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error while running the tool.';
      return buildEnvelope({
        ok: false,
        tool: toolName,
        summary: `${toolName} failed unexpectedly.`,
        state: store.getState(),
        activityEventId: null,
        error: { code: 'INTERNAL_STATE_ERROR', message, recovery: RECOVERY_REREAD },
      });
    }
  };
}
