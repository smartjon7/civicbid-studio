/**
 * Deterministic bid/no-bid evaluation engine.
 *
 * Every number here derives from the company profile, the opportunity's
 * requirement rules, the assignments, the completed flags, and the risk
 * register. No randomness, no network, no model calls.
 */
import type {
  AppState,
  CompanyProfile,
  DimensionScore,
  EvaluationDelta,
  EvaluationSummary,
  GateEffect,
  Opportunity,
  OpportunityEvaluation,
  OpportunityFilters,
  Recommendation,
  Requirement,
  RequirementEvaluation,
  RequirementStatus,
  Severity,
} from '../store/types';
import { daysBetween, formatUsd, recommendationLabel } from './format';

export const DIMENSION_WEIGHTS: Record<DimensionScore['key'], { label: string; weight: number }> = {
  compliance: { label: 'Mandatory compliance and eligibility', weight: 0.3 },
  experience: { label: 'Relevant experience', weight: 0.2 },
  capacity: { label: 'Bonding and delivery capacity', weight: 0.2 },
  readiness: { label: 'Schedule and staffing readiness', weight: 0.15 },
  strategic_fit: { label: 'Strategic fit', weight: 0.1 },
  risk_readiness: { label: 'Risk readiness', weight: 0.05 },
};

export const CONDITIONAL_CAP = 79;
export const GO_THRESHOLD = 80;
export const NO_GO_THRESHOLD = 65;

const POINTS = {
  met: 1,
  assignedDeliverable: 0.85,
  atRisk: 0.6,
  openDeliverable: 0.55,
  mitigableCapabilityGap: 0.25,
  unmitigableCapabilityGap: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function effectiveBonding(profile: CompanyProfile): number {
  return profile.jvPartnerConfirmed
    ? Math.max(profile.singleProjectBondingUsd, profile.jvCombinedBondingUsd)
    : profile.singleProjectBondingUsd;
}

function bondingMinimum(opportunity: Opportunity): number | null {
  const rule = opportunity.requirements.find((r) => r.rule.kind === 'min_bonding');
  return rule && rule.rule.kind === 'min_bonding' ? rule.rule.minimumUsd : null;
}

interface RequirementContext {
  profile: CompanyProfile;
  opportunity: Opportunity;
  assigned: boolean;
  ownerRole: RequirementEvaluation['ownerRole'];
  dueDate: string | null;
  assignmentNote: string | null;
  complete: boolean;
  focused: boolean;
}

interface RuleOutcome {
  met: boolean;
  applicable: boolean;
  atRisk: boolean;
  finding: string;
}

function applyRule(requirement: Requirement, ctx: RequirementContext): RuleOutcome {
  const { profile, opportunity } = ctx;
  const rule = requirement.rule;
  switch (rule.kind) {
    case 'min_bonding': {
      const effective = effectiveBonding(profile);
      const met = effective >= rule.minimumUsd;
      const basis = profile.jvPartnerConfirmed
        ? `combined JV bonding of ${formatUsd(profile.jvCombinedBondingUsd)} (partner confirmed)`
        : `single-project bonding of ${formatUsd(profile.singleProjectBondingUsd)} (no confirmed JV partner)`;
      return {
        met,
        applicable: true,
        atRisk: false,
        finding: met
          ? `Meets the ${formatUsd(rule.minimumUsd)} minimum with ${basis}.`
          : `Short of the ${formatUsd(rule.minimumUsd)} minimum: ${basis}, a ${formatUsd(rule.minimumUsd - effective)} shortfall.`,
      };
    }
    case 'min_rail_years': {
      const met = profile.railYears >= rule.minimum;
      return {
        met,
        applicable: true,
        atRisk: false,
        finding: met
          ? `${profile.railYears} years of rail experience against ${rule.minimum} required.`
          : `Only ${profile.railYears} years of rail experience against ${rule.minimum} required.`,
      };
    }
    case 'min_comparable_rail_projects': {
      const met = profile.comparableRailProjects >= rule.minimum;
      return {
        met,
        applicable: true,
        atRisk: false,
        finding: met
          ? `${profile.comparableRailProjects} comparable rail projects against ${rule.minimum} required within ${rule.withinYears} years.`
          : `Only ${profile.comparableRailProjects} comparable rail projects against ${rule.minimum} required within ${rule.withinYears} years.`,
      };
    }
    case 'min_accessibility_station_projects': {
      const met = profile.accessibilityStationProjects >= rule.minimum;
      return {
        met,
        applicable: true,
        atRisk: false,
        finding: met
          ? `${profile.accessibilityStationProjects} completed accessibility-station projects against ${rule.minimum} required.`
          : `${profile.accessibilityStationProjects} completed accessibility-station projects against ${rule.minimum} required.`,
      };
    }
    case 'min_housing_developments': {
      const met = profile.completedHousingDevelopments >= rule.minimum;
      return {
        met,
        applicable: true,
        atRisk: false,
        finding: met
          ? `${profile.completedHousingDevelopments} completed housing developments against ${rule.minimum} required.`
          : `${profile.completedHousingDevelopments} completed housing development against ${rule.minimum} required within ${rule.withinYears} years.`,
      };
    }
    case 'project_managers': {
      const enough = profile.availableProjectManagers >= rule.minimum;
      const backlogHigh = profile.backlogUtilizationPct > rule.maxBacklogPct;
      if (!enough) {
        return {
          met: false,
          applicable: true,
          atRisk: false,
          finding: `${profile.availableProjectManagers} project manager(s) available against ${rule.minimum} required.`,
        };
      }
      if (backlogHigh && !ctx.complete) {
        return {
          met: false,
          applicable: true,
          atRisk: true,
          finding: `${profile.availableProjectManagers} project manager(s) available, but backlog utilization is ${profile.backlogUtilizationPct}% (above ${rule.maxBacklogPct}%), so availability is not yet documented.`,
        };
      }
      return {
        met: true,
        applicable: true,
        atRisk: false,
        finding: ctx.complete
          ? `Availability documented for ${profile.availableProjectManagers} project manager(s).`
          : `${profile.availableProjectManagers} project manager(s) available with backlog at ${profile.backlogUtilizationPct}%.`,
      };
    }
    case 'safety_record': {
      if (profile.safetyRecord === 'poor') {
        return { met: false, applicable: true, atRisk: false, finding: 'Safety record is below the acceptable threshold.' };
      }
      return {
        met: ctx.complete,
        applicable: true,
        atRisk: false,
        finding: ctx.complete
          ? `Safety record is ${profile.safetyRecord}; the site-specific safety plan is complete.`
          : `Safety record is ${profile.safetyRecord}; the site-specific safety plan still has to be produced.`,
      };
    }
    case 'dbe_participation': {
      return {
        met: ctx.complete,
        applicable: true,
        atRisk: false,
        finding: ctx.complete
          ? `${rule.percent}% DBE participation plan complete.`
          : profile.dbeCertified
            ? `${rule.percent}% DBE participation plan not yet documented; ${profile.name} is DBE-certified, so self-performed work counts.`
            : `${rule.percent}% DBE participation plan not yet documented; subcontractor commitments are needed.`,
      };
    }
    case 'jv_approval_package': {
      const minimum = bondingMinimum(opportunity);
      const needsJv = profile.jvPartnerConfirmed || (minimum !== null && profile.singleProjectBondingUsd < minimum);
      if (!needsJv) {
        return { met: true, applicable: false, atRisk: false, finding: 'Not required unless the bid is submitted as a joint venture.' };
      }
      return {
        met: ctx.complete,
        applicable: true,
        atRisk: false,
        finding: ctx.complete
          ? 'JV approval package filed.'
          : profile.jvPartnerConfirmed
            ? `JV partner confirmed; the agency approval package is due ${rule.daysBeforeBid} days before bid and is not yet filed.`
            : `A JV is the only path to the bonding minimum, and no JV approval package has been started (due ${rule.daysBeforeBid} days before bid).`,
      };
    }
    case 'deliverable': {
      return {
        met: ctx.complete,
        applicable: true,
        atRisk: false,
        finding: ctx.complete ? 'Complete.' : 'Not yet produced.',
      };
    }
  }
}

function severityFor(effect: GateEffect, mandatory: boolean): Severity {
  switch (effect) {
    case 'unmitigable_gap':
      return 'critical';
    case 'mitigable_gap':
      return 'high';
    case 'at_risk':
      return 'medium';
    case 'deliverable_open':
      return mandatory ? 'medium' : 'low';
    default:
      return 'low';
  }
}

export function evaluateRequirement(requirement: Requirement, ctx: RequirementContext): RequirementEvaluation {
  const outcome = applyRule(requirement, ctx);
  let status: RequirementStatus;
  let gateEffect: GateEffect;

  if (!outcome.applicable) {
    status = 'satisfied';
    gateEffect = 'not_applicable';
  } else if (outcome.met) {
    status = ctx.complete ? 'complete' : 'satisfied';
    gateEffect = 'pass';
  } else if (outcome.atRisk) {
    status = ctx.assigned ? 'assigned' : 'at_risk';
    gateEffect = 'at_risk';
  } else if (requirement.kind === 'capability' || requirement.rule.kind === 'safety_record' && ctx.profile.safetyRecord === 'poor') {
    status = ctx.assigned ? 'assigned' : 'gap';
    gateEffect = requirement.failureMode === 'unmitigable' ? 'unmitigable_gap' : 'mitigable_gap';
  } else {
    status = ctx.assigned ? 'assigned' : 'gap';
    gateEffect = 'deliverable_open';
  }

  if (requirement.rule.kind === 'safety_record' && ctx.profile.safetyRecord === 'poor') {
    gateEffect = 'unmitigable_gap';
    status = 'gap';
  }

  return {
    requirementId: requirement.id,
    label: requirement.label,
    category: requirement.category,
    mandatory: requirement.mandatory,
    kind: requirement.kind,
    failureMode: requirement.failureMode,
    status,
    met: outcome.met,
    gateEffect,
    severity: severityFor(gateEffect, requirement.mandatory),
    finding: outcome.finding,
    evidence: requirement.evidence,
    suggestedMitigation: requirement.suggestedMitigation,
    suggestedOwner: requirement.suggestedOwner,
    ownerRole: ctx.ownerRole,
    dueDate: ctx.dueDate,
    assignmentNote: ctx.assignmentNote,
    complete: ctx.complete,
    focused: ctx.focused,
  };
}

function pointsFor(evaluation: RequirementEvaluation): number {
  switch (evaluation.gateEffect) {
    case 'pass':
    case 'not_applicable':
      return POINTS.met;
    case 'at_risk':
      return POINTS.atRisk;
    case 'deliverable_open':
      return evaluation.status === 'assigned' ? POINTS.assignedDeliverable : POINTS.openDeliverable;
    case 'mitigable_gap':
      return POINTS.mitigableCapabilityGap;
    case 'unmitigable_gap':
      return POINTS.unmitigableCapabilityGap;
  }
}

function deadlineScore(days: number): number {
  if (days >= 21) return 100;
  if (days >= 14) return 70;
  if (days >= 7) return 50;
  if (days >= 0) return 30;
  return 0;
}

export function evaluateOpportunityWithProfile(
  state: AppState,
  opportunity: Opportunity,
  profile: CompanyProfile,
): OpportunityEvaluation {
  const daysToDeadline = daysBetween(state.demoAnchorDate, opportunity.deadline);
  const focused = new Set(state.focusedRequirementIds);
  const completed = new Set(state.completedRequirementIds);

  const requirements = opportunity.requirements.map((requirement) => {
    const assignment = state.assignments[requirement.id] ?? null;
    return evaluateRequirement(requirement, {
      profile,
      opportunity,
      assigned: assignment !== null,
      ownerRole: assignment?.ownerRole ?? null,
      dueDate: assignment?.dueDate ?? null,
      assignmentNote: assignment?.note ?? null,
      complete: completed.has(requirement.id),
      focused: focused.has(requirement.id),
    });
  });

  const mandatory = requirements.filter((r) => r.mandatory);
  const compliancePoints = mandatory.reduce((sum, r) => sum + pointsFor(r), 0);
  const compliance = mandatory.length ? (compliancePoints / mandatory.length) * 100 : 100;

  // Experience: average of capability ratios for experience-type rules.
  const experienceRatios: number[] = [];
  for (const requirement of opportunity.requirements) {
    const rule = requirement.rule;
    if (rule.kind === 'min_rail_years') experienceRatios.push(clamp(profile.railYears / rule.minimum, 0, 1));
    if (rule.kind === 'min_comparable_rail_projects') experienceRatios.push(clamp(profile.comparableRailProjects / rule.minimum, 0, 1));
    if (rule.kind === 'min_accessibility_station_projects') experienceRatios.push(clamp(profile.accessibilityStationProjects / rule.minimum, 0, 1));
    if (rule.kind === 'min_housing_developments') experienceRatios.push(clamp(profile.completedHousingDevelopments / rule.minimum, 0, 1));
  }
  const experience = experienceRatios.length
    ? (experienceRatios.reduce((a, b) => a + b, 0) / experienceRatios.length) * 100
    : 70;

  // Capacity: bonding ratio against the minimum plus aggregate headroom.
  const minimumBonding = bondingMinimum(opportunity);
  const effective = effectiveBonding(profile);
  const bondingRatio = minimumBonding ? clamp(effective / minimumBonding, 0, 1) * 100 : 100;
  const aggregate = Math.max(profile.aggregateBondingUsd, profile.jvPartnerConfirmed ? profile.jvCombinedBondingUsd : 0);
  const headroom = clamp((aggregate - opportunity.estimatedValueUsd) / opportunity.estimatedValueUsd, 0, 1) * 100;
  const capacity = 0.7 * bondingRatio + 0.3 * headroom;

  // Readiness: project-manager availability and time to deadline.
  const pmRule = opportunity.requirements.find((r) => r.rule.kind === 'project_managers');
  const pmMinimum = pmRule && pmRule.rule.kind === 'project_managers' ? pmRule.rule.minimum : 1;
  const pmMaxBacklog = pmRule && pmRule.rule.kind === 'project_managers' ? pmRule.rule.maxBacklogPct : 80;
  const pmDocumented = pmRule ? completed.has(pmRule.id) : false;
  let pmScore = profile.availableProjectManagers >= pmMinimum ? 100 : 40;
  if (profile.backlogUtilizationPct > pmMaxBacklog && !pmDocumented) pmScore = Math.min(pmScore, 60);
  const readiness = 0.6 * pmScore + 0.4 * deadlineScore(daysToDeadline);

  const strategic = opportunity.strategicFitScore;

  // Risk readiness: registered risks with a mitigation and an owner.
  const risks = state.risks.filter((r) => r.opportunityId === opportunity.id);
  const handled = risks.filter((r) => r.mitigation.trim().length > 0 && r.ownerRole).length;
  const riskReadiness = risks.length === 0 ? 30 : clamp(30 + 20 * handled, 0, 100);

  const dimensions: DimensionScore[] = [
    dim('compliance', compliance, `${mandatory.filter((r) => r.met).length} of ${mandatory.length} mandatory requirements met; ${mandatory.filter((r) => r.status === 'assigned').length} assigned.`),
    dim('experience', experience, experienceRatios.length ? `Experience ratios: ${experienceRatios.map((r) => `${Math.round(r * 100)}%`).join(', ')}.` : 'No experience thresholds in this solicitation.'),
    dim('capacity', capacity, `Effective bonding ${formatUsd(effective)}${minimumBonding ? ` against ${formatUsd(minimumBonding)} minimum` : ''}; aggregate headroom ${Math.round(headroom)}%.`),
    dim('readiness', readiness, `${profile.availableProjectManagers} PM(s) at ${profile.backlogUtilizationPct}% backlog; ${daysToDeadline} days to deadline.`),
    dim('strategic_fit', strategic, `${opportunity.strategicFit} strategic fit for ${opportunity.sectorLabel.toLowerCase()} work.`),
    dim('risk_readiness', riskReadiness, risks.length ? `${handled} of ${risks.length} registered risks carry an owner and mitigation.` : 'No risks registered yet.'),
  ];

  const rawScore = Math.round(dimensions.reduce((sum, d) => sum + d.weighted, 0));

  const unmitigableGaps = mandatory.filter((r) => r.gateEffect === 'unmitigable_gap').map((r) => r.requirementId);
  const mitigableGaps = mandatory.filter((r) => r.gateEffect === 'mitigable_gap').map((r) => r.requirementId);
  const atRisk = mandatory.filter((r) => r.gateEffect === 'at_risk').map((r) => r.requirementId);
  const openDeliverables = mandatory.filter((r) => r.gateEffect === 'deliverable_open').map((r) => r.requirementId);
  const passedGates = mandatory.filter((r) => r.gateEffect === 'pass' || r.gateEffect === 'not_applicable').map((r) => r.requirementId);

  let recommendation: Recommendation;
  let totalScore = rawScore;
  let capped = false;
  if (unmitigableGaps.length > 0) {
    recommendation = 'no_go';
  } else if (mitigableGaps.length > 0) {
    recommendation = 'conditional_go';
    if (rawScore > CONDITIONAL_CAP) {
      totalScore = CONDITIONAL_CAP;
      capped = true;
    }
  } else if (rawScore >= GO_THRESHOLD) {
    recommendation = 'go';
  } else if (rawScore >= NO_GO_THRESHOLD) {
    recommendation = 'conditional_go';
  } else {
    recommendation = 'no_go';
  }

  const label = (id: string) => requirements.find((r) => r.requirementId === id)?.label ?? id;
  const scoreDrivers = buildScoreDrivers(opportunity, profile, requirements);

  let rationale: string;
  let nextAction: string;
  if (recommendation === 'no_go' && unmitigableGaps.length > 0) {
    rationale = `Disqualified by ${unmitigableGaps.length} requirement(s) that cannot be created before bid day: ${unmitigableGaps.map(label).join('; ')}.`;
    nextAction = 'Do not pursue unless the company profile changes on the disqualifying requirement(s).';
  } else if (recommendation === 'no_go') {
    rationale = `Score ${totalScore} is below the ${NO_GO_THRESHOLD} threshold.`;
    nextAction = 'Do not pursue; the weighted score is below the minimum.';
  } else if (recommendation === 'conditional_go' && mitigableGaps.length > 0) {
    rationale = `Score ${totalScore}${capped ? ` (capped from ${rawScore})` : ''}: ${mitigableGaps.length} mandatory gap(s) remain mitigable before bid day: ${mitigableGaps.map(label).join('; ')}.`;
    nextAction = `Close the mitigable gap(s) — ${mitigableGaps.map((id) => requirements.find((r) => r.requirementId === id)?.suggestedMitigation ?? id).join(' ')}`;
  } else if (recommendation === 'conditional_go') {
    rationale = `Score ${totalScore} sits in the conditional band (${NO_GO_THRESHOLD}–${CONDITIONAL_CAP}) with no mandatory capability gaps.`;
    nextAction = 'Assign the open deliverables and register mitigations to lift the score.';
  } else {
    rationale = `Score ${totalScore} with every mandatory gate passed or on track${atRisk.length ? ` (${atRisk.length} item(s) at risk)` : ''}.`;
    nextAction = 'Stage a GO recommendation for human approval and start the bid.';
  }

  return {
    opportunityId: opportunity.id,
    title: opportunity.title,
    agency: opportunity.agency,
    sector: opportunity.sector,
    estimatedValueUsd: opportunity.estimatedValueUsd,
    deadline: opportunity.deadline,
    daysToDeadline,
    totalScore,
    rawScore,
    capped,
    recommendation,
    recommendationLabel: recommendationLabel(recommendation),
    dimensions,
    requirements,
    passedGates,
    atRisk,
    mitigableGaps,
    unmitigableGaps,
    openDeliverables,
    scoreDrivers,
    rationale,
    nextAction,
    evaluatedAtStateVersion: state.stateVersion,
  };
}

function dim(key: DimensionScore['key'], score: number, explanation: string): DimensionScore {
  const { label, weight } = DIMENSION_WEIGHTS[key];
  const rounded = round1(clamp(score, 0, 100));
  return { key, label, weight, score: rounded, weighted: round1(rounded * weight), explanation };
}

function buildScoreDrivers(opportunity: Opportunity, profile: CompanyProfile, requirements: RequirementEvaluation[]): string[] {
  const drivers: string[] = [];
  const minimum = bondingMinimum(opportunity);
  if (minimum !== null) {
    const effective = effectiveBonding(profile);
    if (effective < minimum) {
      drivers.push(
        `Confirming a qualified JV partner with combined bonding of at least ${formatUsd(minimum)} would satisfy the bonding requirement (currently ${formatUsd(effective)}).`,
      );
    } else {
      drivers.push(`Bonding capacity of ${formatUsd(effective)} covers the ${formatUsd(minimum)} minimum${profile.jvPartnerConfirmed ? ' through the confirmed JV' : ''}.`);
    }
  }
  const pm = requirements.find((r) => r.gateEffect === 'at_risk');
  if (pm) {
    drivers.push(`Reducing backlog utilization below 80% or documenting PM availability would clear "${pm.label}".`);
  }
  const unmitigable = requirements.filter((r) => r.gateEffect === 'unmitigable_gap');
  for (const gap of unmitigable) {
    drivers.push(`"${gap.label}" cannot be satisfied before bid day with the current profile.`);
  }
  const open = requirements.filter((r) => r.gateEffect === 'deliverable_open' && r.status === 'gap');
  if (open.length) {
    drivers.push(`${open.length} mandatory deliverable(s) are unassigned; assigning an owner raises the compliance score.`);
  }
  return drivers;
}

export function evaluateOpportunity(state: AppState, opportunityId: string): OpportunityEvaluation | null {
  const opportunity = state.opportunities.find((o) => o.id === opportunityId);
  if (!opportunity) return null;
  return evaluateOpportunityWithProfile(state, opportunity, state.company);
}

export function evaluateAll(state: AppState, profile: CompanyProfile = state.company): OpportunityEvaluation[] {
  return state.opportunities.map((o) => evaluateOpportunityWithProfile(state, o, profile));
}

const RECOMMENDATION_RANK: Record<Recommendation, number> = { go: 3, conditional_go: 2, no_go: 1 };

export function rankEvaluations(evaluations: OpportunityEvaluation[]): OpportunityEvaluation[] {
  return [...evaluations].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return RECOMMENDATION_RANK[b.recommendation] - RECOMMENDATION_RANK[a.recommendation];
  });
}

export function summarizeEvaluation(evaluation: OpportunityEvaluation, stateVersion: number): EvaluationSummary {
  return {
    opportunityId: evaluation.opportunityId,
    totalScore: evaluation.totalScore,
    recommendation: evaluation.recommendation,
    mitigableGaps: [...evaluation.mitigableGaps],
    unmitigableGaps: [...evaluation.unmitigableGaps],
    stateVersion,
  };
}

export function summariesDiffer(a: EvaluationSummary, b: EvaluationSummary): boolean {
  return (
    a.totalScore !== b.totalScore ||
    a.recommendation !== b.recommendation ||
    a.mitigableGaps.join(',') !== b.mitigableGaps.join(',') ||
    a.unmitigableGaps.join(',') !== b.unmitigableGaps.join(',')
  );
}

export function diffEvaluations(before: OpportunityEvaluation, after: OpportunityEvaluation): EvaluationDelta {
  const gapsBefore = new Set([...before.mitigableGaps, ...before.unmitigableGaps]);
  const gapsAfter = new Set([...after.mitigableGaps, ...after.unmitigableGaps]);
  return {
    opportunityId: after.opportunityId,
    title: after.title,
    scoreBefore: before.totalScore,
    scoreAfter: after.totalScore,
    recommendationBefore: before.recommendation,
    recommendationAfter: after.recommendation,
    gapsClosed: [...gapsBefore].filter((id) => !gapsAfter.has(id)),
    gapsOpened: [...gapsAfter].filter((id) => !gapsBefore.has(id)),
  };
}

/** Evaluates every opportunity as if the profile changes were applied, without writing anything. */
export function simulateProfileChange(state: AppState, changes: Partial<CompanyProfile>): EvaluationDelta[] {
  const before = evaluateAll(state);
  const after = evaluateAll(state, { ...state.company, ...changes });
  return before.map((b, index) => diffEvaluations(b, after[index]));
}

export function filterOpportunities(state: AppState, filters: OpportunityFilters): Opportunity[] {
  return state.opportunities.filter((opportunity) => {
    const days = daysBetween(state.demoAnchorDate, opportunity.deadline);
    if (!filters.includeClosed && days < 0) return false;
    if (filters.minimumValueUsd !== undefined && opportunity.estimatedValueUsd < filters.minimumValueUsd) return false;
    if (filters.maximumDaysToDeadline !== undefined && days > filters.maximumDaysToDeadline) return false;
    if (filters.sectors && filters.sectors.length > 0 && !filters.sectors.includes(opportunity.sector)) return false;
    return true;
  });
}
