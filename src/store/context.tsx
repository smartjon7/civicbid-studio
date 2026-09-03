/**
 * React bindings for the store and the WebMCP tool runtime.
 *
 * Components read state through useAppState (useSyncExternalStore over the
 * store) and write only through useDispatch, which returns store.dispatch.
 * The tool runtime is exposed read-only so the interface can render the tool
 * list, the browser status badge, and the Tool Console.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { AppState, Command, CommandResult } from './types';
import type { AppStore } from './store';
import type { ToolRuntime, WebMcpStatus } from '../webmcp/types';

interface StoreContextValue {
  store: AppStore;
  runtime: ToolRuntime;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ store, runtime, children }: { store: AppStore; runtime: ToolRuntime; children: ReactNode }) {
  const value = useMemo(() => ({ store, runtime }), [store, runtime]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStoreContext(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('StoreProvider is missing above this component.');
  return value;
}

/** The current application state; re-renders on every store change. */
export function useAppState(): AppState {
  const { store } = useStoreContext();
  const subscribe = useCallback((onChange: () => void) => store.subscribe(() => onChange()), [store]);
  return useSyncExternalStore(subscribe, store.getState, store.getState);
}

/** The single write path: returns store.dispatch. */
export function useDispatch(): (command: Command) => CommandResult {
  const { store } = useStoreContext();
  return useCallback((command: Command) => store.dispatch(command), [store]);
}

export function useToolRuntime(): ToolRuntime {
  return useStoreContext().runtime;
}

/**
 * The browser tool status. The runtime may return a fresh object from
 * getStatus on every call, so snapshots are memoised by their JSON string to
 * keep useSyncExternalStore stable between real changes.
 */
export function useWebMcpStatus(): WebMcpStatus {
  const { runtime } = useStoreContext();
  const cache = useRef<{ key: string; value: WebMcpStatus } | null>(null);
  const subscribe = useCallback((onChange: () => void) => runtime.subscribe(() => onChange()), [runtime]);
  const getSnapshot = useCallback(() => {
    const raw = runtime.getStatus();
    const key = JSON.stringify(raw);
    const cached = cache.current;
    if (cached && cached.key === key) return cached.value;
    cache.current = { key, value: raw };
    return raw;
  }, [runtime]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
