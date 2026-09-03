/**
 * Public entry for the WebMCP layer.
 *
 * STUB — replaced by the full implementation. The interface imports only from
 * this module and from ./types.
 */
import type { AppStore } from '../store/store';
import type { ToolRuntime, WebMcpStatus } from './types';

export type { CivicBidToolResult, DiscoveredTool, JsonSchema, ToolChannel, ToolDefinition, ToolError, ToolRuntime, ToolVerification, WebMcpStatus } from './types';

export function createToolRuntime(_store: AppStore): ToolRuntime {
  const status: WebMcpStatus = { supported: false, registered: false, registeredCount: 0, discovered: [], canExecuteViaBrowser: false, error: 'Tool runtime not implemented yet.' };
  return {
    definitions: [],
    async execute(name) {
      return {
        ok: false,
        tool: name,
        summary: 'Tool runtime not implemented yet.',
        stateVersion: 0,
        changed: [],
        verification: { activityEventId: null, selectedOpportunityId: null, visiblePanel: 'welcome', focusedRequirementIds: [], decisionStatus: 'none' },
        error: { code: 'INTERNAL_STATE_ERROR', message: 'Tool runtime not implemented yet.', recovery: 'Wait for the full implementation.' },
      };
    },
    async register() {
      return status;
    },
    unregister() {},
    getStatus: () => status,
    subscribe() {
      return () => {};
    },
  };
}
