/**
 * Registration with the browser's document.modelContext.
 *
 * register() is idempotent: a runtime flag stops a second call in the same
 * instance, a window-level marker retires a registration left by an earlier
 * page module, and one shared AbortController signal lets unregister() remove
 * every tool at once. When the browser has no WebMCP support the status says
 * so without an error.
 */
import type { CivicBidToolResult, DiscoveredTool, ToolChannel, ToolDefinition, WebMcpStatus } from './types';

export type ToolExecutor = (name: string, input: unknown, channel: ToolChannel) => Promise<CivicBidToolResult>;

export interface Registration {
  register(): Promise<WebMcpStatus>;
  unregister(): void;
  getStatus(): WebMcpStatus;
  subscribe(listener: (status: WebMcpStatus) => void): () => void;
}

const WINDOW_MARKER = '__civicbidWebMcpRegistration';

interface RegistrationMarker {
  unregister: () => void;
}

interface ToolDescriptor {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: Record<string, unknown> | null | undefined) => Promise<unknown>;
}

interface ModelContextLike {
  registerTool: (tool: ToolDescriptor, options?: { signal?: AbortSignal }) => unknown;
  getTools?: () => unknown;
  executeTool?: unknown;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function findModelContext(): ModelContextLike | null {
  if (typeof document === 'undefined') return null;
  const candidate = (document as Document & { modelContext?: unknown }).modelContext;
  if (!candidate || typeof candidate !== 'object') return null;
  const context = candidate as ModelContextLike;
  return typeof context.registerTool === 'function' ? context : null;
}

function initialStatus(): WebMcpStatus {
  return { supported: false, registered: false, registeredCount: 0, discovered: [], canExecuteViaBrowser: false, error: null };
}

function toDiscovered(raw: unknown): DiscoveredTool | null {
  if (!raw || typeof raw !== 'object') return null;
  const tool = raw as { name?: unknown; description?: unknown; annotations?: { readOnlyHint?: unknown } | null };
  if (typeof tool.name !== 'string') return null;
  return {
    name: tool.name,
    description: typeof tool.description === 'string' ? tool.description : '',
    readOnly: tool.annotations?.readOnlyHint === true,
  };
}

function globalMarkers(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

export function createRegistration(definitions: ToolDefinition[], execute: ToolExecutor): Registration {
  let status = initialStatus();
  const listeners = new Set<(status: WebMcpStatus) => void>();
  let registered = false;
  let inflight: Promise<WebMcpStatus> | null = null;
  let controller: AbortController | null = null;
  let marker: RegistrationMarker | null = null;
  let listening: { context: ModelContextLike; handler: () => void } | null = null;

  const setStatus = (patch: Partial<WebMcpStatus>) => {
    status = { ...status, ...patch };
    for (const listener of listeners) listener(status);
  };

  const refreshDiscovery = async (context: ModelContextLike) => {
    if (typeof context.getTools !== 'function') {
      setStatus({ discovered: [], registeredCount: definitions.length });
      return;
    }
    try {
      const raw = await context.getTools();
      const list = Array.isArray(raw) ? raw : [];
      const discovered = list.map(toDiscovered).filter((tool): tool is DiscoveredTool => tool !== null);
      setStatus({ discovered, registeredCount: discovered.length });
    } catch {
      setStatus({ discovered: [], registeredCount: definitions.length });
    }
  };

  const listen = (context: ModelContextLike) => {
    if (listening || typeof context.addEventListener !== 'function') return;
    const handler = () => {
      void refreshDiscovery(context);
    };
    context.addEventListener('toolchange', handler);
    listening = { context, handler };
  };

  const stopListening = () => {
    if (!listening) return;
    if (typeof listening.context.removeEventListener === 'function') {
      listening.context.removeEventListener('toolchange', listening.handler);
    }
    listening = null;
  };

  function unregister(): void {
    if (controller) {
      controller.abort();
      controller = null;
    }
    stopListening();
    const globals = globalMarkers();
    if (marker && globals[WINDOW_MARKER] === marker) delete globals[WINDOW_MARKER];
    marker = null;
    registered = false;
    if (status.supported) setStatus({ registered: false, registeredCount: 0, discovered: [] });
  }

  const doRegister = async (): Promise<WebMcpStatus> => {
    const context = findModelContext();
    if (!context) {
      setStatus({ supported: false, registered: false, registeredCount: 0, discovered: [], canExecuteViaBrowser: false, error: null });
      return status;
    }
    const canExecuteViaBrowser = typeof context.executeTool === 'function';
    const globals = globalMarkers();
    const previous = globals[WINDOW_MARKER] as RegistrationMarker | undefined;
    if (previous && previous !== marker && typeof previous.unregister === 'function') {
      // A registration left by an earlier page module (for example after a hot reload). Retire it first.
      try {
        previous.unregister();
      } catch {
        // The earlier module is gone; nothing more to do.
      }
      delete globals[WINDOW_MARKER];
    }

    const abort = new AbortController();
    controller = abort;
    try {
      for (const def of definitions) {
        await context.registerTool(
          {
            name: def.name,
            title: def.title,
            description: def.description,
            inputSchema: def.inputSchema,
            annotations: { readOnlyHint: def.readOnly },
            execute: (input) => execute(def.name, input ?? {}, 'webmcp'),
          },
          { signal: abort.signal },
        );
      }
      registered = true;
      marker = { unregister };
      globals[WINDOW_MARKER] = marker;
      setStatus({ supported: true, registered: true, registeredCount: definitions.length, discovered: [], canExecuteViaBrowser, error: null });
      listen(context);
      await refreshDiscovery(context);
    } catch (error) {
      abort.abort();
      controller = null;
      registered = false;
      setStatus({
        supported: true,
        registered: false,
        registeredCount: 0,
        discovered: [],
        canExecuteViaBrowser,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return status;
  };

  return {
    register() {
      if (inflight) return inflight;
      if (registered) return Promise.resolve(status);
      inflight = doRegister().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    unregister,
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
