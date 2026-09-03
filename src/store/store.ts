import type { AppState, Command, CommandResult, Store } from './types';
import { applyCommand, createDefaultContext, type ReducerContext } from './reducer';

export interface AppStore extends Store {
  replaceState(next: AppState): void;
}

export function createStore(initial: AppState, ctx: ReducerContext = createDefaultContext()): AppStore {
  let state = initial;
  const listeners = new Set<(state: AppState) => void>();

  const notify = () => {
    for (const listener of listeners) listener(state);
  };

  return {
    getState: () => state,
    dispatch(command: Command): CommandResult {
      let result: CommandResult;
      try {
        result = applyCommand(state, command, ctx);
      } catch (error) {
        return {
          ok: false,
          state,
          error: {
            code: 'INTERNAL_STATE_ERROR',
            message: error instanceof Error ? error.message : 'Unexpected error while applying the command.',
            recovery: 'Call civicbid_get_workspace_state to reread the current state, then retry once.',
          },
        };
      }
      if (result.ok && result.state !== state) {
        state = result.state;
        notify();
      }
      return result;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    replaceState(next) {
      state = next;
      notify();
    },
  };
}
