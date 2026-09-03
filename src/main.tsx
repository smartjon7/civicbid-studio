import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { StoreProvider } from './store/context';
import { createStore, type AppStore } from './store/store';
import { attachPersistence, loadInitialState } from './store/persistence';
import { createToolRuntime } from './webmcp';
import type { ToolRuntime } from './webmcp/types';

declare global {
  interface Window {
    /** Exposed for browser-based testing of the demo. */
    __civicbid?: { store: AppStore; runtime: ToolRuntime };
  }
}

const store = createStore(loadInitialState());
attachPersistence(store);

// Registered once at module scope so React StrictMode cannot double-register.
const runtime = createToolRuntime(store);
runtime.register().catch(() => undefined);

window.__civicbid = { store, runtime };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store} runtime={runtime}>
      <App />
    </StoreProvider>
  </StrictMode>,
);
