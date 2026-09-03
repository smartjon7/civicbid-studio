/**
 * Synthetic seed data for CivicBid Studio.
 *
 * Every agency, company, opportunity, solicitation number, and figure here is
 * fictional and exists only to make the demonstration deterministic.
 */
import {
  DEMO_ANCHOR_DATE,
  SCHEMA_VERSION,
  type AppState,
  type CompanyProfile,
  type Opportunity,
  type Requirement,
} from '../store/types';

export const COMPANY_NAME = 'Atlas Civic Infrastructure, LLC';

export const OPPORTUNITY_IDS = {
  rail: 'opp-rail-fastener-renewal',
  station: 'opp-station-accessibility',
  housing: 'opp-senior-housing-preservation',
} as const;

export const JV_PRESET_CHANGES: Partial<CompanyProfile> = {
  jvPartnerConfirmed: true,
  jvCombinedBondingUsd: 60_000_000,
};

export const JV_PRESET_LABEL = 'Confirm JV package';

export function createSeedCompany(): CompanyProfile {
  return {
    name: COMPANY_NAME,
    dbeCertified: true,
    railYears: 8,
    comparableRailProjects: 4,
    singleProjectBondingUsd: 25_000_000,
    aggregateBondingUsd: 60_000_000,
    jvPartnerConfirmed: false,
    jvCombinedBondingUsd: 25_000_000,
    availableProjectManagers: 2,
    safetyRecord: 'acceptable',
    backlogUtilizationPct: 82,
    accessibilityStationProjects: 0,
    completedHousingDevelopments: 1,
  };
}

function req(
  opportunityId: string,
  id: string,
  partial: Omit<Requirement, 'id' | 'opportunityId'>,
): Requirement {
  return { id, opportunityId, ...partial };
}

function railRequirements(): Requirement[] {
  const o = OPPORTUNITY_IDS.rail;
  return [
    req(o, 'RAIL-01', {
      label: 'Minimum $30M single-project bonding, or agency-approved combined JV bonding',
      category: 'bonding',
      mandatory: true,
      kind: 'capability',
      failureMode: 'mitigable',
      rule: { kind: 'min_bonding', minimumUsd: 30_000_000 },
      evidence: 'Surety letter showing single-project capacity of $30M or more, or a JV surety letter with the agency JV approval.',
      suggestedMitigation: 'Confirm a qualified joint-venture partner and obtain a combined surety letter of at least $30M.',
      suggestedOwner: 'Finance & Bonding',
    }),
    req(o, 'RAIL-02', {
      label: 'At least five years of active rail-construction experience',
      category: 'experience',
      mandatory: true,
      kind: 'capability',
      failureMode: 'unmitigable',
      rule: { kind: 'min_rail_years', minimum: 5 },
      evidence: 'Corporate experience statement with continuous rail work by year.',
      suggestedMitigation: 'Cannot be created before bid day; if short, do not pursue.',
      suggestedOwner: 'Proposal Manager',
    }),
    req(o, 'RAIL-03', {
      label: 'Three comparable rail projects completed within the last seven years',
      category: 'experience',
      mandatory: true,
      kind: 'capability',
      failureMode: 'unmitigable',
      rule: { kind: 'min_comparable_rail_projects', minimum: 3, withinYears: 7 },
      evidence: 'Project data sheets with owner references and completion dates.',
      suggestedMitigation: 'Cannot be created before bid day; if short, do not pursue.',
      suggestedOwner: 'Proposal Manager',
    }),
    req(o, 'RAIL-04', {
      label: 'Named project manager with rail experience and documented availability',
      category: 'staffing',
      mandatory: true,
      kind: 'capability',
      failureMode: 'mitigable',
      rule: { kind: 'project_managers', minimum: 1, maxBacklogPct: 80 },
      evidence: 'Résumé, rail project list, and a signed availability letter for the named PM.',
      suggestedMitigation: 'Name the PM now, document release from current backlog, or bring a PM from the JV partner.',
      suggestedOwner: 'Operations Lead',
    }),
    req(o, 'RAIL-05', {
      label: 'Site-specific safety plan and an acceptable safety record',
      category: 'safety',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'safety_record' },
      evidence: 'Three-year EMR and OSHA summary plus a site-specific safety plan for live-track work.',
      suggestedMitigation: 'Assign the Safety Director to draft the live-track safety plan and attach the safety record.',
      suggestedOwner: 'Safety Director',
    }),
    req(o, 'RAIL-06', {
      label: '20% DBE participation plan',
      category: 'participation',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'dbe_participation', percent: 20 },
      evidence: 'Signed DBE utilization schedule with committed firms and percentages.',
      suggestedMitigation: 'Document self-performed DBE work and confirm subcontractor letters of intent.',
      suggestedOwner: 'Compliance Lead',
    }),
    req(o, 'RAIL-07', {
      label: 'If bidding as a JV, agency JV approval package due seven days before bid',
      category: 'legal',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'jv_approval_package', daysBeforeBid: 7 },
      evidence: 'Executed JV agreement, combined financials, and the agency JV approval form.',
      suggestedMitigation: 'Execute the JV agreement and file the approval package at least seven days before the bid date.',
      suggestedOwner: 'JV & Legal',
    }),
    req(o, 'RAIL-08', {
      label: 'Signed acknowledgment of all addenda',
      category: 'submission',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Acknowledgment form listing every addendum number and date.',
      suggestedMitigation: 'Track addenda daily and sign the acknowledgment on bid day.',
      suggestedOwner: 'Proposal Manager',
    }),
    req(o, 'RAIL-09', {
      label: 'Baseline schedule and track-possession plan',
      category: 'schedule',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Baseline CPM schedule and a possession plan aligned to the agency work windows.',
      suggestedMitigation: 'Assign the Scheduler to build the baseline around the published night possessions.',
      suggestedOwner: 'Scheduler',
    }),
    req(o, 'RAIL-10', {
      label: 'Bid bond equal to 5% of bid value',
      category: 'bonding',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Executed bid bond from the surety on the agency form.',
      suggestedMitigation: 'Request the bid bond from the surety once the estimate is set.',
      suggestedOwner: 'Finance & Bonding',
    }),
  ];
}

function stationRequirements(): Requirement[] {
  const o = OPPORTUNITY_IDS.station;
  return [
    req(o, 'STA-01', {
      label: 'Minimum $50M single-project bonding, or agency-approved combined JV bonding',
      category: 'bonding',
      mandatory: true,
      kind: 'capability',
      failureMode: 'mitigable',
      rule: { kind: 'min_bonding', minimumUsd: 50_000_000 },
      evidence: 'Surety letter showing single-project capacity of $50M or more, or an approved JV surety letter.',
      suggestedMitigation: 'Only a joint venture with combined capacity of $50M or more closes this gap.',
      suggestedOwner: 'Finance & Bonding',
    }),
    req(o, 'STA-02', {
      label: 'Three completed accessibility-station projects',
      category: 'experience',
      mandatory: true,
      kind: 'capability',
      failureMode: 'unmitigable',
      rule: { kind: 'min_accessibility_station_projects', minimum: 3 },
      evidence: 'Completed elevator, ramp, or platform accessibility projects at transit stations with references.',
      suggestedMitigation: 'Cannot be created before bid day; this gap disqualifies the pursuit.',
      suggestedOwner: 'Proposal Manager',
    }),
    req(o, 'STA-03', {
      label: 'Two dedicated project managers for the full contract duration',
      category: 'staffing',
      mandatory: true,
      kind: 'capability',
      failureMode: 'mitigable',
      rule: { kind: 'project_managers', minimum: 2, maxBacklogPct: 80 },
      evidence: 'Résumés and dedication letters for two project managers.',
      suggestedMitigation: 'Release two PMs from current backlog or recruit before bid day.',
      suggestedOwner: 'Operations Lead',
    }),
    req(o, 'STA-04', {
      label: 'Night and weekend phasing plan keeping stations open during construction',
      category: 'schedule',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Phase-by-phase plan showing customer access paths and work windows.',
      suggestedMitigation: 'Assign the Scheduler and Operations Lead to draft the phasing plan.',
      suggestedOwner: 'Scheduler',
    }),
    req(o, 'STA-05', {
      label: 'Quality-control plan for elevator, escalator, and platform work',
      category: 'quality',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'QC plan with inspection hold points and accessibility compliance checks.',
      suggestedMitigation: 'Assign the Quality Manager to draft the plan.',
      suggestedOwner: 'Quality Manager',
    }),
    req(o, 'STA-06', {
      label: 'Safety plan and an acceptable safety record',
      category: 'safety',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'safety_record' },
      evidence: 'Three-year EMR and OSHA summary plus a station-work safety plan.',
      suggestedMitigation: 'Assign the Safety Director to draft the plan.',
      suggestedOwner: 'Safety Director',
    }),
    req(o, 'STA-07', {
      label: '25% DBE participation plan',
      category: 'participation',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'dbe_participation', percent: 25 },
      evidence: 'Signed DBE utilization schedule.',
      suggestedMitigation: 'Confirm DBE subcontractor commitments.',
      suggestedOwner: 'Compliance Lead',
    }),
    req(o, 'STA-08', {
      label: 'Bid bond equal to 5% of bid value',
      category: 'bonding',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Executed bid bond on the agency form.',
      suggestedMitigation: 'Request from the surety once the estimate is set.',
      suggestedOwner: 'Finance & Bonding',
    }),
    req(o, 'STA-09', {
      label: 'Five years of transit-facility construction experience',
      category: 'experience',
      mandatory: true,
      kind: 'capability',
      failureMode: 'unmitigable',
      rule: { kind: 'min_rail_years', minimum: 5 },
      evidence: 'Corporate experience statement covering transit facility work.',
      suggestedMitigation: 'Cannot be created before bid day.',
      suggestedOwner: 'Proposal Manager',
    }),
  ];
}

function housingRequirements(): Requirement[] {
  const o = OPPORTUNITY_IDS.housing;
  return [
    req(o, 'HSG-01', {
      label: 'Financial capacity of at least $15M in bonding or equivalent guarantees',
      category: 'bonding',
      mandatory: true,
      kind: 'capability',
      failureMode: 'mitigable',
      rule: { kind: 'min_bonding', minimumUsd: 15_000_000 },
      evidence: 'Surety letter or lender capacity letter.',
      suggestedMitigation: 'Provide the surety letter.',
      suggestedOwner: 'Finance & Bonding',
    }),
    req(o, 'HSG-02', {
      label: 'Two completed affordable-housing developments within the last ten years',
      category: 'experience',
      mandatory: true,
      kind: 'capability',
      failureMode: 'mitigable',
      rule: { kind: 'min_housing_developments', minimum: 2, withinYears: 10 },
      evidence: 'Development summaries with unit counts, financing sources, and completion dates.',
      suggestedMitigation: 'Partner with an experienced co-developer whose completed projects count toward the requirement.',
      suggestedOwner: 'JV & Legal',
    }),
    req(o, 'HSG-03', {
      label: 'Evidence of site control',
      category: 'legal',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Executed option, purchase agreement, or ground lease.',
      suggestedMitigation: 'Assign JV & Legal to secure and document site control.',
      suggestedOwner: 'JV & Legal',
    }),
    req(o, 'HSG-04', {
      label: 'Financing plan with lender and equity letters',
      category: 'submission',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Sources-and-uses statement with lender and investor interest letters.',
      suggestedMitigation: 'Assign Finance & Bonding to assemble the financing plan.',
      suggestedOwner: 'Finance & Bonding',
    }),
    req(o, 'HSG-05', {
      label: 'Environmental review documentation',
      category: 'legal',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Phase I environmental site assessment and any required clearances.',
      suggestedMitigation: 'Commission the Phase I assessment immediately.',
      suggestedOwner: 'Compliance Lead',
    }),
    req(o, 'HSG-06', {
      label: 'Community support letters',
      category: 'participation',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Letters from neighborhood organizations and local officials.',
      suggestedMitigation: 'Schedule community meetings and request letters.',
      suggestedOwner: 'Executive Sponsor',
    }),
    req(o, 'HSG-07', {
      label: 'Fifteen-year operating pro forma',
      category: 'quality',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Operating pro forma with rent assumptions, reserves, and debt coverage.',
      suggestedMitigation: 'Assign the Estimating Lead to build the pro forma.',
      suggestedOwner: 'Estimating Lead',
    }),
    req(o, 'HSG-08', {
      label: 'Local zoning and land-use approvals',
      category: 'legal',
      mandatory: true,
      kind: 'deliverable',
      failureMode: 'mitigable',
      rule: { kind: 'deliverable' },
      evidence: 'Zoning verification letter and approval schedule.',
      suggestedMitigation: 'Confirm zoning status and file for any variances.',
      suggestedOwner: 'JV & Legal',
    }),
  ];
}

export function createSeedOpportunities(): Opportunity[] {
  return [
    {
      id: OPPORTUNITY_IDS.rail,
      title: 'Rail Fastener Renewal Program',
      agency: 'North River Transit Authority',
      solicitationNumber: 'NRTA-IFB-2026-114',
      sector: 'rail',
      sectorLabel: 'Rail',
      location: 'Harbor County (fictional)',
      estimatedValueUsd: 28_000_000,
      deadline: '2026-09-29',
      strategicFit: 'high',
      strategicFitScore: 92,
      summary:
        'Replace direct-fixation fasteners and pads on 14 miles of elevated and at-grade mainline track during night possessions, with rail-profile grinding and tie-plate renewal in six interlockings.',
      scopeHighlights: [
        'Fastener and pad renewal on 14 track-miles',
        'Night possessions, Sunday through Thursday',
        'Work in six interlockings with signal coordination',
        'Two-year duration with incentive for early completion',
      ],
      requirements: railRequirements(),
    },
    {
      id: OPPORTUNITY_IDS.station,
      title: 'Station Accessibility Modernization',
      agency: 'Central Metro Works',
      solicitationNumber: 'CMW-RFP-2026-087',
      sector: 'accessibility',
      sectorLabel: 'Accessibility / Rail',
      location: 'Harbor County (fictional)',
      estimatedValueUsd: 42_000_000,
      deadline: '2026-09-23',
      strategicFit: 'medium',
      strategicFitScore: 65,
      summary:
        'Add elevators, ramps, tactile platform edges, and compliant wayfinding at five stations while keeping every station open, using night and weekend phasing.',
      scopeHighlights: [
        'Nine new elevators and four escalator replacements',
        'Five stations kept open throughout construction',
        'Platform edge and wayfinding upgrades',
        'Thirty-month duration with liquidated damages',
      ],
      requirements: stationRequirements(),
    },
    {
      id: OPPORTUNITY_IDS.housing,
      title: 'Senior Housing Preservation Development',
      agency: 'Commonwealth Housing Partnership',
      solicitationNumber: 'CHP-RFQ-2026-031',
      sector: 'housing',
      sectorLabel: 'Housing',
      location: 'Harbor County (fictional)',
      estimatedValueUsd: 18_000_000,
      deadline: '2026-10-17',
      strategicFit: 'medium',
      strategicFitScore: 70,
      summary:
        'Rehabilitate and preserve 120 units of senior affordable housing across two buildings, with energy retrofits and a fifteen-year affordability covenant.',
      scopeHighlights: [
        '120 units across two buildings',
        'Occupied rehabilitation with tenant relocation plan',
        'Energy retrofit and accessibility upgrades',
        'Fifteen-year affordability covenant',
      ],
      requirements: housingRequirements(),
    },
  ];
}

export function createSeedState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    stateVersion: 1,
    demoAnchorDate: DEMO_ANCHOR_DATE,
    company: createSeedCompany(),
    opportunities: createSeedOpportunities(),
    selectedOpportunityId: null,
    comparisonIds: [],
    focusedRequirementIds: [],
    focusReason: null,
    assignments: {},
    completedRequirementIds: [],
    risks: [],
    stagedDecision: null,
    decisionHistory: [],
    approval: null,
    ownerBrief: null,
    activity: [],
    ui: { visiblePanel: 'welcome', toolConsoleOpen: false, lastToast: null },
  };
}
