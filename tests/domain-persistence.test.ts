/**
 * Domain tests for localStorage persistence (jsdom).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedOpportunities, createSeedState, OPPORTUNITY_IDS } from '../src/data/seed';
import { attachPersistence, clearPersistedState, loadInitialState, loadPersistedState, savePersistedState } from '../src/store/persistence';
import { applyCommand, createTestContext } from '../src/store/reducer';
import { createStore } from '../src/store/store';
import { SCHEMA_VERSION, STORAGE_KEY, type AppState } from '../src/store/types';

const agent = { actor: 'agent', channel: 'webmcp', tool: 'civicbid_test_tool' } as const;

function workedState(): AppState {
  const ctx = createTestContext();
  let state = createSeedState();
  const select = applyCommand(state, { type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent }, ctx);
  if (!select.ok) throw new Error(select.error.message);
  state = select.state;
  const assign = applyCommand(state, { type: 'assign_requirement', requirementId: 'RAIL-01', ownerRole: 'Finance & Bonding', dueDate: '2026-09-15', note: 'Surety letter.', ...agent }, ctx);
  if (!assign.ok) throw new Error(assign.error.message);
  return { ...assign.state, ui: { ...assign.state.ui, toolConsoleOpen: true } };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('persistence', () => {
  it('round-trips a worked state through localStorage', () => {
    const state = workedState();
    expect(state.ui.lastToast).not.toBeNull();
    savePersistedState(state);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    const loaded = loadPersistedState();
    expect(loaded).not.toBeNull();
    expect(loaded).toEqual({
      ...state,
      opportunities: createSeedOpportunities(),
      ui: { ...state.ui, lastToast: null, toolConsoleOpen: false },
    });
    expect(loaded!.stateVersion).toBe(state.stateVersion);
    expect(loaded!.assignments['RAIL-01'].note).toBe('Surety letter.');
    expect(loaded!.activity).toHaveLength(state.activity.length);
    expect(loaded!.selectedOpportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect(loaded!.ui.visiblePanel).toBe('workspace');
  });

  it('clears the transient toast and closes the tool console on load', () => {
    savePersistedState(workedState());
    const loaded = loadPersistedState()!;
    expect(loaded.ui.lastToast).toBeNull();
    expect(loaded.ui.toolConsoleOpen).toBe(false);
  });

  it('always takes opportunity definitions from the current seed', () => {
    const state = workedState();
    const tampered: AppState = {
      ...state,
      opportunities: state.opportunities.map((o) => ({ ...o, title: `Edited ${o.title}`, estimatedValueUsd: 1 })),
    };
    savePersistedState(tampered);
    const loaded = loadPersistedState()!;
    expect(loaded.opportunities).toEqual(createSeedOpportunities());
    expect(loaded.opportunities[0].title).toBe('Rail Fastener Renewal Program');
  });

  it('returns null when nothing is stored', () => {
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null on a schema mismatch', () => {
    const state = workedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION + 1 }));
    expect(loadPersistedState()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: undefined }));
    expect(loadPersistedState()).toBeNull();
  });

  it('returns null when the stored value is malformed', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadPersistedState()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION }));
    expect(loadPersistedState()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, stateVersion: 'seven' }));
    expect(loadPersistedState()).toBeNull();
    window.localStorage.setItem(STORAGE_KEY, 'null');
    expect(loadPersistedState()).toBeNull();
  });

  it('fills missing fields from the seed for a minimal but valid record', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, stateVersion: 9 }));
    const loaded = loadPersistedState()!;
    expect(loaded.stateVersion).toBe(9);
    expect(loaded.company).toEqual(createSeedState().company);
    expect(loaded.ui).toEqual({ visiblePanel: 'welcome', toolConsoleOpen: false, lastToast: null });
    expect(loaded.opportunities).toHaveLength(3);
  });

  it('clearPersistedState removes the record and loadInitialState falls back to the seed', () => {
    savePersistedState(workedState());
    expect(loadInitialState().stateVersion).toBeGreaterThan(1);
    clearPersistedState();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    const initial = loadInitialState();
    expect(initial).toEqual(createSeedState());
    expect(initial.stateVersion).toBe(1);
    expect(initial.activity).toEqual([]);
  });

  it('attachPersistence writes immediately and after every change until detached', () => {
    const store = createStore(createSeedState(), createTestContext());
    const detach = attachPersistence(store);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).stateVersion).toBe(1);

    store.dispatch({ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.station, ...agent });
    const afterDispatch = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as AppState;
    expect(afterDispatch.stateVersion).toBe(2);
    expect(afterDispatch.selectedOpportunityId).toBe(OPPORTUNITY_IDS.station);

    detach();
    store.dispatch({ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent });
    expect((JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as AppState).stateVersion).toBe(2);
  });

  it('a reloaded workspace continues from the persisted version', () => {
    const ctx = createTestContext();
    const store = createStore(createSeedState(), ctx);
    attachPersistence(store);
    store.dispatch({ type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent });
    store.dispatch({ type: 'assign_requirement', requirementId: 'RAIL-05', ownerRole: 'Safety Director', dueDate: '2026-09-18', note: '', ...agent });

    const reloaded = createStore(loadInitialState(), ctx);
    expect(reloaded.getState().stateVersion).toBe(3);
    const next = reloaded.dispatch({ type: 'assign_requirement', requirementId: 'RAIL-09', ownerRole: 'Scheduler', dueDate: '2026-09-22', note: '', ...agent });
    expect(next.ok).toBe(true);
    expect(reloaded.getState().stateVersion).toBe(4);
    expect(Object.keys(reloaded.getState().assignments).sort()).toEqual(['RAIL-05', 'RAIL-09']);
  });
});
