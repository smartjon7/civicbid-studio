import { useState } from 'react';
import { useAppState, useDispatch, useWebMcpStatus } from '../store/context';
import { FallbackBanner } from '../components/FallbackBanner';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { LeftRail } from '../components/LeftRail';
import { RightRail } from '../components/RightRail';
import { Toast } from '../components/Toast';
import { ToolConsole } from '../components/ToolConsole';
import { Workspace } from '../components/Workspace';
import { HUMAN_UI, readSessionFlag, writeSessionFlag } from '../components/uiText';

const BANNER_KEY = 'civicbid-studio:fallback-banner-dismissed';

export function App() {
  const state = useAppState();
  const dispatch = useDispatch();
  const status = useWebMcpStatus();
  const [bannerDismissed, setBannerDismissed] = useState(() => readSessionFlag(BANNER_KEY));
  const showBanner = !status.supported && !bannerDismissed;

  return (
    <div className="app">
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <Header />
      {showBanner ? (
        <FallbackBanner
          onDismiss={() => {
            writeSessionFlag(BANNER_KEY);
            setBannerDismissed(true);
          }}
        />
      ) : null}
      <div className="app-body">
        <aside className="rail rail-left" aria-label="Opportunities and company profile">
          <LeftRail />
        </aside>
        <main id="workspace" className="workspace" tabIndex={-1}>
          <Workspace />
        </main>
        <aside className="rail rail-right" aria-label="Decision, owner brief, and activity">
          <RightRail />
        </aside>
      </div>
      <Footer />
      {state.ui.toolConsoleOpen ? <ToolConsole onClose={() => dispatch({ type: 'set_ui', ui: { toolConsoleOpen: false }, ...HUMAN_UI })} /> : null}
      <Toast />
    </div>
  );
}
