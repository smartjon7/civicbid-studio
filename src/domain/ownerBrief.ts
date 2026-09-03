/**
 * Deterministic executive owner brief.
 *
 * Built only from approved state: the staged decision, its approval, the
 * evaluation, assignments, risks, and the activity log. No model calls.
 */
import type { Actor, AppState, BriefEmphasis, OwnerBrief, OwnerBriefOptions, OwnerBriefSection } from '../store/types';
import { evaluateAll, evaluateOpportunity } from './evaluateOpportunity';
import { countWords, formatLongDate, formatUsd, recommendationLabel } from './format';
import { selectAssignmentsFor, selectHumanProfileEvents, selectRisksFor } from './selectors';

interface BriefMeta {
  id: string;
  generatedAt: string;
  generatedBy: Actor;
}

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 } as const;

const EMPHASIS_SECTION: Record<BriefEmphasis, string> = {
  decision: 'Approved decision',
  conditions: 'Conditions and assumptions',
  risks: 'Top disqualification risks',
  assignments: 'Owners and dates',
  deadlines: 'Next 24 hours',
  next_actions: 'Next 24 hours',
};

export function buildOwnerBrief(state: AppState, options: OwnerBriefOptions, meta: BriefMeta): OwnerBrief {
  const decision = state.stagedDecision;
  const approval = state.approval;
  if (!decision || !approval || approval.decisionId !== decision.id || approval.status !== 'approved') {
    throw new Error('Owner brief requires an approved decision.');
  }
  const opportunity = state.opportunities.find((o) => o.id === decision.opportunityId);
  const evaluation = evaluateOpportunity(state, decision.opportunityId);
  if (!opportunity || !evaluation) throw new Error('Approved decision references an unknown opportunity.');

  const label = recommendationLabel(decision.recommendation);
  const others = evaluateAll(state).filter((e) => e.opportunityId !== opportunity.id);
  const assignments = selectAssignmentsFor(state, opportunity.id);
  const risks = [...selectRisksFor(state, opportunity.id)].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const humanChanges = selectHumanProfileEvents(state);
  const requirementLabel = (id: string) => evaluation.requirements.find((r) => r.requirementId === id)?.label ?? id;

  // Section bodies are arrays of lines so the word budget can trim them.
  const sections: Array<{ heading: string; lines: string[]; priority: number }> = [];

  sections.push({
    heading: 'Approved decision',
    priority: 0,
    lines: [
      `${label} on ${opportunity.title} (${opportunity.agency}, ${formatUsd(opportunity.estimatedValueUsd)}, bids due ${formatLongDate(opportunity.deadline)}, ${evaluation.daysToDeadline} days out).`,
      `Approved by the human on ${formatLongDate(approval.decidedAt.slice(0, 10))} at state version ${approval.stateVersion}; deterministic score ${evaluation.totalScore} of 100 (${evaluation.recommendationLabel}).`,
      ...(decision.stale && decision.staleReason ? [`Note: ${decision.staleReason}`] : []),
    ],
  });

  sections.push({
    heading: 'Why this opportunity',
    priority: 3,
    lines: [
      decision.rationale,
      ...(others.length
        ? [`Compared with ${others.map((o) => `${o.title} (${o.totalScore}, ${o.recommendationLabel})`).join(' and ')}.`]
        : []),
    ],
  });

  sections.push({
    heading: 'Conditions and assumptions',
    priority: 2,
    lines: [
      ...decision.conditions.map((c) => `Condition: ${c}`),
      ...decision.assumptions.map((a) => `Assumption: ${a}`),
      ...(decision.conditions.length + decision.assumptions.length === 0 ? ['No conditions or assumptions were attached to the decision.'] : []),
    ],
  });

  const gapLines = [
    ...evaluation.unmitigableGaps.map((id) => `Disqualifier: ${requirementLabel(id)}.`),
    ...evaluation.mitigableGaps.map((id) => `Open mandatory gap: ${requirementLabel(id)}.`),
    ...evaluation.atRisk.map((id) => `At risk: ${requirementLabel(id)}.`),
  ];
  sections.push({
    heading: 'Top disqualification risks',
    priority: 1,
    lines: [
      ...gapLines,
      ...risks.slice(0, 5).map((r) => `${r.severity.toUpperCase()} — ${r.title}: ${r.mitigation || r.rationale} (${r.ownerRole}, ${r.status}).`),
      ...(gapLines.length + risks.length === 0 ? ['No open disqualification risks are registered.'] : []),
    ],
  });

  sections.push({
    heading: 'Owners and dates',
    priority: 2,
    lines: assignments.length
      ? assignments.map((a) => `${a.requirementId} — ${requirementLabel(a.requirementId)}: ${a.ownerRole}, due ${formatLongDate(a.dueDate)}.`)
      : ['No requirement assignments have been made.'],
  });

  sections.push({
    heading: 'Human change incorporated',
    priority: 1,
    lines: humanChanges.length
      ? humanChanges.map((e) => {
          const fields = e.profileChanges.map((c) => `${c.field} ${String(c.before)} → ${String(c.after)}`).join(', ');
          const delta = e.evaluationDelta && e.evaluationDelta.opportunityId === opportunity.id
            ? ` Score moved ${e.evaluationDelta.scoreBefore} → ${e.evaluationDelta.scoreAfter} (${recommendationLabel(e.evaluationDelta.recommendationBefore)} → ${recommendationLabel(e.evaluationDelta.recommendationAfter)}).`
            : '';
          return `${e.title}: ${fields}.${delta}`;
        })
      : ['The company profile was not changed during this pursuit.'],
  });

  const soonest = [...assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  const nextActions = [
    ...soonest.map((a) => `${a.ownerRole}: start ${requirementLabel(a.requirementId)} (due ${formatLongDate(a.dueDate)}).`),
    ...evaluation.mitigableGaps.map((id) => `Close: ${evaluation.requirements.find((r) => r.requirementId === id)?.suggestedMitigation ?? id}`),
    ...evaluation.openDeliverables
      .filter((id) => !state.assignments[id])
      .slice(0, 3)
      .map((id) => `Assign an owner for ${requirementLabel(id)}.`),
  ];
  sections.push({
    heading: 'Next 24 hours',
    priority: 0,
    lines: nextActions.length ? nextActions : ['Confirm the bid team and release the estimate.'],
  });

  const agentEvents = state.activity.filter((e) => e.actor === 'agent').length;
  const humanEvents = state.activity.filter((e) => e.actor === 'human').length;
  const toolEvents = state.activity.filter((e) => e.channel === 'webmcp').length;
  sections.push({
    heading: 'Audit summary',
    priority: 2,
    lines: [
      `${state.activity.length} logged events: ${agentEvents} by the agent (${toolEvents} through site tools), ${humanEvents} by the human. State versions ${state.activity[0]?.stateVersionBefore ?? state.stateVersion} through ${state.stateVersion}. Decision ${decision.id}${decision.supersedesDecisionId ? ` superseded ${decision.supersedesDecisionId}` : ''}.`,
    ],
  });

  // Emphasised sections come first and are trimmed last.
  const emphasised = new Set(options.emphasis.map((e) => EMPHASIS_SECTION[e]));
  const ordered = [...sections].sort((a, b) => Number(emphasised.has(b.heading)) - Number(emphasised.has(a.heading)));
  for (const section of ordered) if (emphasised.has(section.heading)) section.priority = -1;

  const title = options.title ?? `Owner Brief — ${opportunity.title} — ${label}`;
  const render = () => {
    const rendered: OwnerBriefSection[] = ordered.map((s) => ({ heading: s.heading, body: s.lines.join(' ') }));
    const text = `${title}\n\n${rendered.map((s) => `${s.heading}\n${s.body}`).join('\n\n')}`;
    return { rendered, text, words: countWords(text) };
  };

  let out = render();
  // Trim lowest-priority sections one line at a time until within budget.
  let guard = 0;
  while (out.words > options.maximumWords && guard++ < 200) {
    const candidates = ordered.filter((s) => s.lines.length > 1).sort((a, b) => b.priority - a.priority);
    if (!candidates.length) break;
    candidates[0].lines.pop();
    out = render();
  }
  // Last resort: shorten the longest remaining line, repeatedly, until within budget.
  guard = 0;
  while (out.words > options.maximumWords && guard++ < 50) {
    const longest = ordered.reduce((best, s) => (countWords(s.lines.join(' ')) > countWords(best.lines.join(' ')) ? s : best), ordered[0]);
    const words = longest.lines.join(' ').split(/s+/).filter((w) => w.length > 0);
    if (words.length <= 6) break;
    const keep = Math.max(6, words.length - (out.words - options.maximumWords) - 1);
    longest.lines = [words.slice(0, keep).join(' ') + '…'];
    out = render();
  }

  return {
    id: meta.id,
    title,
    generatedAt: meta.generatedAt,
    generatedBy: meta.generatedBy,
    stateVersion: state.stateVersion,
    decisionId: decision.id,
    opportunityId: opportunity.id,
    wordCount: out.words,
    maximumWords: options.maximumWords,
    emphasis: [...options.emphasis],
    sections: out.rendered,
    text: out.text,
  };
}
