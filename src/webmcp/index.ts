/**
 * Public entry for the WebMCP layer.
 *
 * The interface imports only from this module and from ./types. The runtime
 * built here owns the thirteen tool definitions, the executor that the
 * browser agent and the Tool Console share, and the registration lifecycle.
 */
import type { AppStore } from '../store/store';
import { createRegistration } from './registerTools';
import { createExecutor } from './runtime';
import { createToolSpecs } from './tools';
import type { ToolDefinition, ToolRuntime } from './types';

export type { CivicBidToolResult, DiscoveredTool, JsonSchema, ToolChannel, ToolDefinition, ToolError, ToolRuntime, ToolVerification, WebMcpStatus } from './types';

export function createToolRuntime(store: AppStore): ToolRuntime {
  const specs = createToolSpecs();
  const definitions: ToolDefinition[] = specs.map((spec) => ({
    name: spec.name,
    title: spec.title,
    description: spec.description,
    inputSchema: spec.inputSchema,
    readOnly: spec.readOnly,
    example: spec.example,
  }));
  const execute = createExecutor(store, specs);
  const registration = createRegistration(definitions, execute);
  return {
    definitions,
    execute,
    register: registration.register,
    unregister: registration.unregister,
    getStatus: registration.getStatus,
    subscribe: registration.subscribe,
  };
}
