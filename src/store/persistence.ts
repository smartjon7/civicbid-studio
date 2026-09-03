import { SCHEMA_VERSION, STORAGE_KEY, type AppState } from './types';
import { createSeedOpportunities, createSeedState } from '../data/seed';
import type { AppStore } from './store';

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Loads the persisted workspace, or null when nothing usable is stored. */
export function loadPersistedState(): AppState | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || typeof parsed.stateVersion !== 'number') return null;
    const seed = createSeedState();
    return {
      ...seed,
      ...parsed,
      // Opportunity definitions are code, not user data: always take the current seed.
      opportunities: createSeedOpportunities(),
      ui: { ...seed.ui, ...(parsed.ui ?? {}), lastToast: null, toolConsoleOpen: false },
    };
  } catch {
    return null;
  }
}

export function savePersistedState(state: AppState): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or privacy mode: the app keeps working in memory.
  }
}

export function clearPersistedState(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Writes every state change to localStorage. Returns the unsubscribe function. */
export function attachPersistence(store: AppStore): () => void {
  savePersistedState(store.getState());
  return store.subscribe((state) => savePersistedState(state));
}

/** Loads persisted state or the pristine seed. */
export function loadInitialState(): AppState {
  return loadPersistedState() ?? createSeedState();
}
