/**
 * CivicBid Studio — shared domain and state types.
 *
 * Everything in this file is synthetic demonstration data structure.
 * UI controls and WebMCP tools both dispatch the Command union below through
 * the same reducer; there is no second write path.
 */

export const SCHEMA_VERSION = 1;
export const DEMO_ANCHOR_DATE = '2026-09-03';
export const STORAGE_KEY = 'civicbid-studio:state:v1';

export const SECTORS = ['rail', 'accessibility', 'housing'] as const;
export type Sector = (typeof SECTORS)[number];

export const OWNER_ROLES = [
  'Executive Sponsor',
  'Proposal Manager',
  'Estimating Lead',
  'Finance & Bonding',
  'Operations Lead',
  'Safety Director',
  'Compliance Lead',
  'JV & Legal',
  'Scheduler',
  'Quality Manager',
] as const;
export type OwnerRole = (typeof OWNER_ROLES)[number];

export const REQUIREMENT_CATEGORIES = [
  'eligibility',
  'bonding',
  'experience',
  'staffing',
  'safety',
  'participation',
  'schedule',
  'quality',
  'legal',
  'submission',
] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const REQUIREMENT_STATUSES = ['satisfied', 'gap', 'at_risk', 'assigned', 'complete'] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const RISK_STATUSES = ['open', 'mitigating', 'resolved'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const RECOMMENDATIONS = ['go', 'conditional_go', 'no_go'] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const BRIEF_EMPHASES = ['decision', 'conditions', 'risks', 'assignments', 'deadlines', 'next_actions'] as const;
export type BriefEmphasis = (typeof BRIEF_EMPHASES)[number];

export type DecisionStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type Actor = 'agent' | 'human' | 'system';
export type Channel = 'webmcp' | 'console' | 'ui' | 'system';
export type SafetyRecord = 'strong' | 'acceptable' | 'poor';
export type StrategicFit = 'high' | 'medium' | 'low';
export type RequirementKind = 'capability' | 'deliverable';
export type FailureMode = 'mitigable' | 'unmitigable';
export type VisiblePanel = 'welcome' | 'comparison' | 'workspace' | 'brief';

export interface Provenance {
  actor: Actor;
  channel: Channel;
  /** Name of the WebMCP tool that produced this write, when one did. */
  tool?: string;
}

// ---------------------------------------------------------------------------
// Company profile (human-editable only)
// ---------------------------------------------------------------------------

export interface CompanyProfile {
  name: string;
  dbeCertified: boolean;
  railYears: number;
  comparableRailProjects: number;
  singleProjectBondingUsd: number;
  aggregateBondingUsd: number;
  jvPartnerConfirmed: boolean;
  jvCombinedBondingUsd: number;
  availableProjectManagers: number;
  safetyRecord: SafetyRecord;
  backlogUtilizationPct: number;
  accessibilityStationProjects: number;
  completedHousingDevelopments: number;
}

export const COMPANY_PROFILE_FIELDS: ReadonlyArray<keyof CompanyProfile> = [
  'name',
  'dbeCertified',
  'railYears',
  'comparableRailProjects',
  'singleProjectBondingUsd',
  'aggregateBondingUsd',
  'jvPartnerConfirmed',
  'jvCombinedBondingUsd',
  'availableProjectManagers',
  'safetyRecord',
  'backlogUtilizationPct',
  'accessibilityStationProjects',
  'completedHousingDevelopments',
];

export interface ProfileChange {
  field: keyof CompanyProfile;
  before: string | number | boolean;
  after: string | number | boolean;
}

// ---------------------------------------------------------------------------
// Opportunities and requirements (seed data, immutable during a session)
// ---------------------------------------------------------------------------

export type RequirementRule =
  | { kind: 'min_bonding'; minimumUsd: number }
  | { kind: 'min_rail_years'; minimum: number }
  | { kind: 'min_comparable_rail_projects'; minimum: number; withinYears: number }
  | { kind: 'min_accessibility_station_projects'; minimum: number }
  | { kind: 'min_housing_developments'; minimum: number; withinYears: number }
  | { kind: 'project_managers'; minimum: number; maxBacklogPct: number }
  | { kind: 'safety_record' }
  | { kind: 'dbe_participation'; percent: number }
  | { kind: 'jv_approval_package'; daysBeforeBid: number }
  | { kind: 'deliverable' };

export interface Requirement {
  id: string;
  opportunityId: string;
  label: string;
  category: RequirementCategory;
  mandatory: boolean;
  kind: RequirementKind;
  failureMode: FailureMode;
  rule: RequirementRule;
  evidence: string;
  suggestedMitigation: string;
  suggestedOwner: OwnerRole;
}

export interface Opportunity {
  id: string;
  title: string;
  agency: string;
  solicitationNumber: string;
  sector: Sector;
  sectorLabel: string;
  location: string;
  estimatedValueUsd: number;
  deadline: string; // ISO date, YYYY-MM-DD
  strategicFit: StrategicFit;
  strategicFitScore: number;
  summary: string;
  scopeHighlights: string[];
  requirements: Requirement[];
}

// ---------------------------------------------------------------------------
// Evaluation (derived, never persisted except as snapshots)
// ---------------------------------------------------------------------------

export type GateEffect =
  | 'pass'
  | 'at_risk'
  | 'mitigable_gap'
  | 'unmitigable_gap'
  | 'deliverable_open'
  | 'not_applicable';

export interface RequirementEvaluation {
  requirementId: string;
  label: string;
  category: RequirementCategory;
  mandatory: boolean;
  kind: RequirementKind;
  failureMode: FailureMode;
  status: RequirementStatus;
  met: boolean;
  gateEffect: GateEffect;
  severity: Severity;
  finding: string;
  evidence: string;
  suggestedMitigation: string;
  suggestedOwner: OwnerRole;
  ownerRole: OwnerRole | null;
  dueDate: string | null;
  assignmentNote: string | null;
  complete: boolean;
  focused: boolean;
}

export type DimensionKey =
  | 'compliance'
  | 'experience'
  | 'capacity'
  | 'readiness'
  | 'strategic_fit'
  | 'risk_readiness';

export interface DimensionScore {
  key: DimensionKey;
  label: string;
  weight: number;
  score: number;
  weighted: number;
  explanation: string;
}

export interface OpportunityEvaluation {
  opportunityId: string;
  title: string;
  agency: string;
  sector: Sector;
  estimatedValueUsd: number;
  deadline: string;
  daysToDeadline: number;
  totalScore: number;
  rawScore: number;
  capped: boolean;
  recommendation: Recommendation;
  recommendationLabel: string;
  dimensions: DimensionScore[];
  requirements: RequirementEvaluation[];
  passedGates: string[];
  atRisk: string[];
  mitigableGaps: string[];
  unmitigableGaps: string[];
  openDeliverables: string[];
  scoreDrivers: string[];
  rationale: string;
  nextAction: string;
  evaluatedAtStateVersion: number;
}

export interface EvaluationSummary {
  opportunityId: string;
  totalScore: number;
  recommendation: Recommendation;
  mitigableGaps: string[];
  unmitigableGaps: string[];
  stateVersion: number;
}

export interface EvaluationDelta {
  opportunityId: string;
  title: string;
  scoreBefore: number;
  scoreAfter: number;
  recommendationBefore: Recommendation;
  recommendationAfter: Recommendation;
  gapsClosed: string[];
  gapsOpened: string[];
}

// ---------------------------------------------------------------------------
// Workspace records
// ---------------------------------------------------------------------------

export interface Assignment {
  requirementId: string;
  opportunityId: string;
  ownerRole: OwnerRole;
  dueDate: string;
  note: string;
  assignedBy: Actor;
  createdAt: string;
  updatedAt: string;
}

export interface RiskItem {
  riskKey: string;
  opportunityId: string;
  title: string;
  severity: Severity;
  relatedRequirementIds: string[];
  rationale: string;
  mitigation: string;
  ownerRole: OwnerRole;
  status: RiskStatus;
  createdBy: Actor;
  createdAt: string;
  updatedAt: string;
}

export interface StagedDecision {
  id: string;
  opportunityId: string;
  recommendation: Recommendation;
  rationale: string;
  conditions: string[];
  assumptions: string[];
  confidence: number;
  stagedBy: Actor;
  stagedAt: string;
  stateVersion: number;
  evaluationSnapshot: EvaluationSummary;
  supersedesDecisionId: string | null;
  status: 'pending' | 'approved' | 'rejected';
  stale: boolean;
  staleReason: string | null;
}

export interface DecisionApproval {
  decisionId: string;
  opportunityId: string;
  status: 'approved' | 'rejected';
  decidedBy: 'human';
  decidedAt: string;
  note: string;
  stateVersion: number;
  evaluationSnapshot: EvaluationSummary;
}

export interface OwnerBriefSection {
  heading: string;
  body: string;
}

export interface OwnerBrief {
  id: string;
  title: string;
  generatedAt: string;
  generatedBy: Actor;
  stateVersion: number;
  decisionId: string;
  opportunityId: string;
  wordCount: number;
  maximumWords: number;
  emphasis: BriefEmphasis[];
  sections: OwnerBriefSection[];
  text: string;
}

export interface ActivityEvent {
  id: string;
  seq: number;
  at: string;
  actor: Actor;
  channel: Channel;
  tool: string | null;
  action: string;
  title: string;
  detail: string;
  changed: string[];
  stateVersionBefore: number;
  stateVersionAfter: number;
  opportunityId: string | null;
  profileChanges: ProfileChange[];
  evaluationDelta: EvaluationDelta | null;
}

export interface UiState {
  visiblePanel: VisiblePanel;
  toolConsoleOpen: boolean;
  lastToast: { id: string; text: string; actor: Actor } | null;
}

export interface AppState {
  schemaVersion: number;
  stateVersion: number;
  demoAnchorDate: string;
  company: CompanyProfile;
  opportunities: Opportunity[];
  selectedOpportunityId: string | null;
  comparisonIds: string[];
  focusedRequirementIds: string[];
  focusReason: string | null;
  assignments: Record<string, Assignment>;
  completedRequirementIds: string[];
  risks: RiskItem[];
  stagedDecision: StagedDecision | null;
  decisionHistory: StagedDecision[];
  approval: DecisionApproval | null;
  ownerBrief: OwnerBrief | null;
  activity: ActivityEvent[];
  ui: UiState;
}

// ---------------------------------------------------------------------------
// Commands — the only way to write business state
// ---------------------------------------------------------------------------

export interface OpportunityFilters {
  minimumValueUsd?: number;
  maximumDaysToDeadline?: number;
  sectors?: Sector[];
  includeClosed?: boolean;
}

export interface RiskInput {
  riskKey: string;
  title: string;
  severity: Severity;
  relatedRequirementIds: string[];
  rationale: string;
  mitigation: string;
  ownerRole: OwnerRole;
  status: RiskStatus;
}

export interface StagedDecisionInput {
  recommendation: Recommendation;
  rationale: string;
  conditions: string[];
  assumptions: string[];
  confidence: number;
}

export interface OwnerBriefOptions {
  maximumWords: number;
  emphasis: BriefEmphasis[];
  title: string | null;
}

export type Command =
  | ({ type: 'select_opportunity'; opportunityId: string } & Provenance)
  | ({ type: 'compare_opportunities'; opportunityIds: string[] } & Provenance)
  | ({ type: 'focus_requirements'; requirementIds: string[]; mode: 'replace' | 'add'; reason: string } & Provenance)
  | ({ type: 'clear_focus' } & Provenance)
  | ({ type: 'assign_requirement'; requirementId: string; ownerRole: OwnerRole; dueDate: string; note: string } & Provenance)
  | ({ type: 'mark_requirement_complete'; requirementId: string; complete: boolean } & Provenance)
  | ({ type: 'upsert_risk'; risk: RiskInput } & Provenance)
  | ({ type: 'stage_decision'; input: StagedDecisionInput } & Provenance)
  | ({ type: 'approve_decision'; note: string } & Provenance)
  | ({ type: 'reject_decision'; note: string } & Provenance)
  | ({ type: 'update_company_profile'; changes: Partial<CompanyProfile>; label: string } & Provenance)
  | ({ type: 'apply_jv_preset' } & Provenance)
  | ({ type: 'generate_owner_brief'; options: OwnerBriefOptions } & Provenance)
  | ({ type: 'reset_demo' } & Provenance)
  | ({ type: 'record_tool_call'; tool: string; ok: boolean; summary: string } & Provenance)
  | ({ type: 'set_ui'; ui: Partial<UiState> } & Provenance);

export type CommandType = Command['type'];

export type ErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'NO_OPPORTUNITY_SELECTED'
  | 'REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY'
  | 'DECISION_NOT_PENDING'
  | 'DECISION_NOT_APPROVED'
  | 'APPROVED_DECISION_LOCKED'
  | 'HUMAN_ONLY_ACTION'
  | 'UNSUPPORTED_BROWSER'
  | 'INTERNAL_STATE_ERROR';

export interface CommandError {
  code: ErrorCode;
  message: string;
  recovery: string;
}

export type CommandResult =
  | {
      ok: true;
      state: AppState;
      event: ActivityEvent | null;
      changed: string[];
      noop: boolean;
      warnings: string[];
    }
  | {
      ok: false;
      state: AppState;
      error: CommandError;
    };

export interface Store {
  getState(): AppState;
  dispatch(command: Command): CommandResult;
  subscribe(listener: (state: AppState) => void): () => void;
}
