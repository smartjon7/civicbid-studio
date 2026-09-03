/**
 * JSON Schema inputs for every CivicBid Studio tool.
 *
 * The schemas use only the subset described in ./types (JsonSchema) so the
 * local validator, the browser, and the Tool Console all read the same
 * contract. Every object schema closes additionalProperties.
 */
import {
  BRIEF_EMPHASES,
  OWNER_ROLES,
  RECOMMENDATIONS,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_STATUSES,
  RISK_STATUSES,
  SECTORS,
  SEVERITIES,
} from '../store/types';
import { OPPORTUNITY_IDS } from '../data/seed';
import type { JsonSchema } from './types';

export const OPPORTUNITY_ID_VALUES: string[] = [OPPORTUNITY_IDS.rail, OPPORTUNITY_IDS.station, OPPORTUNITY_IDS.housing];

export const RESET_CONFIRMATION = 'RESET_CIVICBID_DEMO';

export const REQUIREMENT_ID_PATTERN = '^[A-Z]{2,5}-[0-9]{2}$';
export const RISK_KEY_PATTERN = '^[a-z0-9][a-z0-9-]{1,48}$';
export const ISO_DATE_PATTERN = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

const opportunityId: JsonSchema = {
  type: 'string',
  enum: [...OPPORTUNITY_ID_VALUES],
  description: 'Opportunity id exactly as returned by civicbid_list_opportunities.',
};

const ownerRole: JsonSchema = {
  type: 'string',
  enum: [...OWNER_ROLES],
  description: 'Role on the bid team that owns the work.',
};

const requirementId: JsonSchema = {
  type: 'string',
  pattern: REQUIREMENT_ID_PATTERN,
  minLength: 5,
  maxLength: 8,
  description: 'Requirement id such as RAIL-01, taken from civicbid_list_requirements.',
};

const isoDate: JsonSchema = {
  type: 'string',
  pattern: ISO_DATE_PATTERN,
  minLength: 10,
  maxLength: 10,
  description: 'Calendar date in YYYY-MM-DD form.',
};

const shortText = (maxLength: number, description: string, minLength = 1): JsonSchema => ({
  type: 'string',
  minLength,
  maxLength,
  description,
});

const boundedList = (items: JsonSchema, maxItems: number, description: string, minItems?: number): JsonSchema => ({
  type: 'array',
  items,
  ...(minItems !== undefined ? { minItems } : {}),
  maxItems,
  uniqueItems: true,
  description,
});

export const listOpportunitiesSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    minimumValueUsd: { type: 'integer', minimum: 0, description: 'Keep opportunities whose estimated value is at least this many US dollars.' },
    maximumDaysToDeadline: { type: 'integer', minimum: 1, maximum: 365, description: 'Keep opportunities whose bid deadline is within this many days of the demo date.' },
    sectors: boundedList({ type: 'string', enum: [...SECTORS] }, 3, 'Keep only these sectors.'),
    includeClosed: { type: 'boolean', default: false, description: 'Include opportunities whose deadline has already passed.' },
  },
};

export const compareOpportunitiesSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['opportunityIds'],
  properties: {
    opportunityIds: boundedList(opportunityId, 3, 'Two or three opportunity ids to rank side by side.', 2),
  },
};

export const openOpportunitySchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['opportunityId'],
  properties: { opportunityId },
};

export const getContextSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};

export const listRequirementsSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mandatoryOnly: { type: 'boolean', default: false, description: 'Return only mandatory requirements.' },
    statuses: boundedList({ type: 'string', enum: [...REQUIREMENT_STATUSES] }, REQUIREMENT_STATUSES.length, 'Keep only requirements in these statuses.'),
    categories: boundedList({ type: 'string', enum: [...REQUIREMENT_CATEGORIES] }, REQUIREMENT_CATEGORIES.length, 'Keep only requirements in these categories.'),
  },
};

export const focusRequirementsSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['requirementIds', 'mode', 'reason'],
  properties: {
    requirementIds: boundedList(requirementId, 10, 'Requirement ids from the open opportunity to highlight for the human.', 1),
    mode: { type: 'string', enum: ['replace', 'add'], description: 'replace sets the focus list; add extends it.' },
    reason: shortText(240, 'One sentence telling the human why these requirements deserve attention.'),
  },
};

export const assignRequirementSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['requirementId', 'ownerRole', 'dueDate'],
  properties: {
    requirementId,
    ownerRole,
    dueDate: isoDate,
    note: { type: 'string', maxLength: 300, default: '', description: 'Optional instruction for the owner.' },
  },
};

export const upsertRiskSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['riskKey', 'title', 'severity', 'ownerRole'],
  properties: {
    riskKey: { type: 'string', pattern: RISK_KEY_PATTERN, minLength: 2, maxLength: 49, description: 'Stable lowercase slug such as bonding-shortfall. Reusing a key updates that risk.' },
    title: shortText(100, 'Short name of the risk.'),
    severity: { type: 'string', enum: [...SEVERITIES], description: 'How badly this could hurt the bid.' },
    relatedRequirementIds: { ...boundedList(requirementId, 5, 'Requirement ids in the open opportunity that this risk threatens.'), default: [] },
    rationale: { type: 'string', maxLength: 500, default: '', description: 'Why the risk exists.' },
    mitigation: { type: 'string', maxLength: 500, default: '', description: 'What will be done about it.' },
    ownerRole,
    status: { type: 'string', enum: [...RISK_STATUSES], default: 'open', description: 'open, mitigating, or resolved.' },
  },
};

export const stageDecisionSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendation', 'rationale', 'confidence'],
  properties: {
    recommendation: { type: 'string', enum: [...RECOMMENDATIONS], description: 'go, conditional_go, or no_go.' },
    rationale: shortText(1200, 'Plain-English reasoning behind the recommendation.', 40),
    conditions: { ...boundedList(shortText(240, 'A condition the bid depends on.'), 8, 'Conditions that must hold for the recommendation to stand.'), default: [] },
    assumptions: { ...boundedList(shortText(240, 'An assumption behind the recommendation.'), 8, 'Assumptions the recommendation rests on.'), default: [] },
    confidence: { type: 'integer', minimum: 0, maximum: 100, description: 'Confidence in the recommendation, 0 to 100.' },
  },
};

export const getWorkspaceStateSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    detailLevel: { type: 'string', enum: ['summary', 'full'], default: 'summary', description: 'summary returns scores and gaps; full returns the entire evaluation.' },
    sinceStateVersion: { type: 'integer', minimum: 0, description: 'Return human and system changes made after this state version.' },
  },
};

export const generateOwnerBriefSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    maximumWords: { type: 'integer', minimum: 150, maximum: 400, default: 260, description: 'Word budget for the brief.' },
    emphasis: { ...boundedList({ type: 'string', enum: [...BRIEF_EMPHASES] }, 6, 'Sections to place first and protect from trimming.'), default: [] },
    title: shortText(100, 'Optional title for the brief.'),
  },
};

export const resetDemoSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['confirm'],
  properties: {
    confirm: { type: 'string', enum: [RESET_CONFIRMATION], description: `Must be exactly ${RESET_CONFIRMATION}.` },
  },
};

const nonNegativeInteger = (description: string): JsonSchema => ({ type: 'integer', minimum: 0, description });

export const simulateCompanyChangeSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['changes'],
  properties: {
    changes: {
      type: 'object',
      additionalProperties: false,
      description: 'Company profile fields to try. Nothing is written.',
      properties: {
        jvPartnerConfirmed: { type: 'boolean', description: 'Whether a joint-venture partner is confirmed.' },
        jvCombinedBondingUsd: nonNegativeInteger('Combined JV bonding capacity in US dollars.'),
        singleProjectBondingUsd: nonNegativeInteger('Single-project bonding capacity in US dollars.'),
        aggregateBondingUsd: nonNegativeInteger('Aggregate bonding capacity in US dollars.'),
        availableProjectManagers: nonNegativeInteger('Project managers available to be named.'),
        backlogUtilizationPct: { type: 'integer', minimum: 0, maximum: 100, description: 'Backlog utilization percent.' },
        railYears: nonNegativeInteger('Years of rail-construction experience.'),
        comparableRailProjects: nonNegativeInteger('Comparable rail projects completed.'),
        accessibilityStationProjects: nonNegativeInteger('Completed accessibility-station projects.'),
        completedHousingDevelopments: nonNegativeInteger('Completed affordable-housing developments.'),
        safetyRecord: { type: 'string', enum: ['strong', 'acceptable', 'poor'], description: 'Safety record rating.' },
        dbeCertified: { type: 'boolean', description: 'Whether the company holds DBE certification.' },
      },
    },
    opportunityId: { ...opportunityId, description: 'Limit the result to one opportunity.' },
  },
};
