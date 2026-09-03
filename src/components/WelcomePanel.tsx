import { useMemo } from 'react';
import { evaluateAll } from '../domain/evaluateOpportunity';
import { formatLongDate, formatUsd } from '../domain/format';
import { useAppState, useDispatch } from '../store/context';
import { RecommendationChip } from './badges';
import { CopyButton } from './CopyButton';
import { CLICK_COUNT_LINE, HUMAN_ONLY_LINE, HUMAN_UI, JUDGE_PROMPTS } from './uiText';

export function WelcomePanel() {
  const state = useAppState();
  const dispatch = useDispatch();
  const evaluations = useMemo(() => evaluateAll(state), [state]);
  const first = JUDGE_PROMPTS[0];

  return (
    <div className="panel welcome">
      <section className="hero" aria-labelledby="welcome-title">
        <p className="kicker">A shared, auditable bid room</p>
        <h2 id="welcome-title">Decide what to bid, together.</h2>
        <p className="lead">
          CivicBid Studio puts a person and a browser agent in the same public-infrastructure bid room. The agent finds and compares opportunities, uncovers
          disqualification risks, assigns compliance work, registers risks, and stages a bid/no-bid recommendation. You change the facts only you know, and you
          alone approve. Every move by either of you is written to one version-stamped activity log.
        </p>
        <p className="lead-strong">{HUMAN_ONLY_LINE}</p>
      </section>

      <section className="card" aria-labelledby="steps-title">
        <h3 id="steps-title">How the demonstration runs</h3>
        <ol className="step-list">
          <li>
            <strong>The agent works the room.</strong> Ask it to find opportunities over $20 million that close within 45 days, compare them, open the strongest,
            focus the mandatory gaps in this interface, assign owners, and stage a recommendation. It stops for your review.
          </li>
          <li>
            <strong>You change the facts.</strong> Confirm the JV package in the company profile on the left. The score moves, the pending recommendation is
            flagged as stale, and the agent rereads exactly what changed and revises its recommendation.
          </li>
          <li>
            <strong>You approve; the agent briefs.</strong> Only your Approve button unlocks the owner brief. The agent then generates it from the approved
            decision, the conditions, the assignments, the risks, and the audit log.
          </li>
        </ol>
        <p className="muted">{CLICK_COUNT_LINE}</p>
      </section>

      <section className="card" aria-labelledby="prompt-title">
        <h3 id="prompt-title">{first.title}</h3>
        <p className="muted">Paste this into the agent to start. It is the first of the three prompts the demonstration is built around.</p>
        <pre className="prompt">{first.text}</pre>
        <CopyButton text={first.text} label="Copy prompt" />
        <details className="prompt-more">
          <summary>Prompts 2 and 3</summary>
          {JUDGE_PROMPTS.slice(1).map((prompt) => (
            <div key={prompt.title} className="prompt-extra">
              <h4>{prompt.title}</h4>
              <pre className="prompt">{prompt.text}</pre>
              <CopyButton text={prompt.text} label="Copy prompt" className="btn btn-sm" />
            </div>
          ))}
        </details>
      </section>

      <section className="card" aria-labelledby="opps-title">
        <div className="panel-head">
          <h3 id="opps-title">The three opportunities in this room</h3>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => dispatch({ type: 'compare_opportunities', opportunityIds: state.opportunities.map((o) => o.id), ...HUMAN_UI })}
          >
            Compare all three
          </button>
        </div>
        <ul className="welcome-opps">
          {evaluations.map((evaluation) => {
            const opportunity = state.opportunities.find((o) => o.id === evaluation.opportunityId);
            if (!opportunity) return null;
            return (
              <li key={opportunity.id} className="welcome-opp">
                <span className="opp-title">{opportunity.title}</span>
                <span className="muted">{opportunity.agency}</span>
                <span className="muted">
                  {formatUsd(opportunity.estimatedValueUsd)} · bids due {formatLongDate(opportunity.deadline)} · {evaluation.daysToDeadline} days
                </span>
                <span className="score-row">
                  <span>
                    Score <strong>{evaluation.totalScore}</strong>
                  </span>
                  <RecommendationChip recommendation={evaluation.recommendation} size="sm" />
                </span>
                <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'select_opportunity', opportunityId: opportunity.id, ...HUMAN_UI })}>
                  Open
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
