/**
 * Contract between the WebMCP layer and the interface.
 *
 * The interface (Tool Console, site-tools panel, header badge) depends only on
 * this file and on `createToolRuntime` from `./index`. The WebMCP layer owns
 * the implementation.
 */
import type { DecisionStatus, VisiblePanel } from '../store/types';

export type ToolChannel = 'webmcp' | 'console';

/** JSON Schema subset used for every tool input. */
export interface JsonSchema {
  type?: 'object' | 'string' | 'integer' | 'number' | 'boolean' | 'array';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: Array<string | number | boolean>;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
}

export interface ToolDefinition {
  /** Tool name registered with the browser, e.g. civicbid_get_context. */
  name: string;
  /** Short human title for the site-tools panel, e.g. "Get context". */
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** True when the tool reads only; maps to annotations.readOnlyHint. */
  readOnly: boolean;
  /** A valid example input used to prefill the Tool Console. */
  example: Record<string, unknown>;
}

export interface ToolVerification {
  activityEventId: string | null;
  selectedOpportunityId: string | null;
  visiblePanel: VisiblePanel;
  focusedRequirementIds: string[];
  decisionStatus: DecisionStatus;
}

export interface ToolError {
  code: string;
  message: string;
  recovery: string;
}

export interface CivicBidToolResult<T = unknown> {
  ok: boolean;
  tool: string;
  summary: string;
  stateVersion: number;
  changed: string[];
  data?: T;
  warnings?: string[];
  verification: ToolVerification;
  error?: ToolError;
}

export interface DiscoveredTool {
  name: string;
  description: string;
  readOnly: boolean;
}

export interface WebMcpStatus {
  /** document.modelContext.registerTool is a function in this browser. */
  supported: boolean;
  /** All tools have been registered in this page lifecycle. */
  registered: boolean;
  /** Number of tools the browser reports (getTools) or, when unavailable, the number registered. */
  registeredCount: number;
  /** Tools read back from document.modelContext.getTools(), when available. */
  discovered: DiscoveredTool[];
  /** document.modelContext.executeTool is available, so the Tool Console can route through the browser. */
  canExecuteViaBrowser: boolean;
  /** Set when registration failed. */
  error: string | null;
}

export interface ToolRuntime {
  definitions: ToolDefinition[];
  /** Runs a tool through the same handler the browser agent uses. Never throws. */
  execute(name: string, input: unknown, channel: ToolChannel): Promise<CivicBidToolResult>;
  /** Registers every tool once. Safe to call repeatedly. */
  register(): Promise<WebMcpStatus>;
  unregister(): void;
  getStatus(): WebMcpStatus;
  subscribe(listener: (status: WebMcpStatus) => void): () => void;
}
