import type { VisiblePanel } from '../store/types';
import { selectSelectedOpportunity } from '../domain/selectors';
import { useAppState, useDispatch } from '../store/context';
import { ComparisonPanel } from './ComparisonPanel';
import { OpportunityPanel } from './OpportunityPanel';
import { OwnerBriefPanel } from './OwnerBriefPanel';
import { WelcomePanel } from './WelcomePanel';
import { HUMAN_UI } from './uiText';

export function Workspace() {
  const state = useAppState();
  const dispatch = useDispatch();
  const selected = selectSelectedOpportunity(state);
  const panel = state.ui.visiblePanel;

  const tabs: Array<{ id: VisiblePanel; label: string; disabled: boolean }> = [
    { id: 'welcome', label: 'Welcome', disabled: false },
    { id: 'comparison', label: state.comparisonIds.length ? `Comparison (${state.comparisonIds.length})` : 'Comparison', disabled: false },
    { id: 'workspace', label: selected ? `Workspace: ${selected.title}` : 'Workspace', disabled: !selected },
    { id: 'brief', label: state.ownerBrief ? 'Owner brief' : 'Owner brief (not yet generated)', disabled: false },
  ];

  return (
    <>
      <nav className="panel-nav no-print" aria-label="Workspace panels">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`panel-tab ${panel === tab.id ? 'is-active' : ''}`}
            aria-current={panel === tab.id ? 'page' : undefined}
            disabled={tab.disabled}
            onClick={() => dispatch({ type: 'set_ui', ui: { visiblePanel: tab.id }, ...HUMAN_UI })}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {panel === 'welcome' ? <WelcomePanel /> : null}
      {panel === 'comparison' ? <ComparisonPanel /> : null}
      {panel === 'workspace' ? <OpportunityPanel /> : null}
      {panel === 'brief' ? <OwnerBriefPanel /> : null}
    </>
  );
}
