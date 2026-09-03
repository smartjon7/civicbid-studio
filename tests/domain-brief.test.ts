/**
 * Domain tests for the deterministic executive owner brief.
 */
import { describe, expect, it } from 'vitest';
import { createSeedState, OPPORTUNITY_IDS } from '../src/data/seed';
import { countWords } from '../src/domain/format';
import { buildOwnerBrief } from '../src/domain/ownerBrief';
import { applyCommand, createTestContext, type ReducerContext } from '../src/store/reducer';
import type { AppState, BriefEmphasis, Command } from '../src/store/types';

const agent = { actor: 'agent', channel: 'webmcp', tool: 'civicbid_test_tool' } as const;
const human = { actor: 'human', channel: 'ui' } as const;
const meta = { id: 'brief-test', generatedAt: '2026-09-03T15:00:00.000Z', generatedBy: 'agent' as const };

const HEADINGS = [
  'Approved decision',
  'Why this opportunity',
  'Conditions and assumptions',
  'Top disqualification risks',
  'Owners and dates',
  'Human change incorporated',
  'Next 24 hours',
  'Audit summary',
];

function run(state: AppState, commands: Command[], ctx: ReducerContext): AppState {
  let current = state;
  for (const command of commands) {
    const result = applyCommand(current, command, ctx);
    if (!result.ok) throw new Error(`${command.type} failed: ${result.error.code} ${result.error.message}`);
    current = result.state;
  }
  return current;
}

/** The judge sequence up to and including human approval of the revised GO. */
function approvedRailState(ctx = createTestContext()): AppState {
  const risk = (riskKey: string, title: string, severity: 'critical' | 'high' | 'medium', related: string[], ownerRole: 'Finance & Bonding' | 'JV & Legal' | 'Operations Lead'): Command => ({
    type: 'upsert_risk',
    risk: {
      riskKey,
      title,
      severity,
      relatedRequirementIds: related,
      rationale: `Synthetic rationale for ${title}.`,
      mitigation: `Synthetic mitigation for ${title}.`,
      ownerRole,
      status: 'open',
    },
    ...agent,
  });
  return run(
    createSeedState(),
    [
      { type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent },
      { type: 'assign_requirement', requirementId: 'RAIL-01', ownerRole: 'Finance & Bonding', dueDate: '2026-09-12', note: 'Combined surety letter.', ...agent },
      { type: 'assign_requirement', requirementId: 'RAIL-07', ownerRole: 'JV & Legal', dueDate: '2026-09-20', note: '', ...agent },
      { type: 'assign_requirement', requirementId: 'RAIL-05', ownerRole: 'Safety Director', dueDate: '2026-09-18', note: '', ...agent },
      { type: 'assign_requirement', requirementId: 'RAIL-09', ownerRole: 'Scheduler', dueDate: '2026-09-22', note: '', ...agent },
      risk('bonding-shortfall', 'Single-project bonding is short of the minimum', 'critical', ['RAIL-01'], 'Finance & Bonding'),
      risk('jv-approval-timing', 'JV approval package must be filed seven days early', 'high', ['RAIL-07'], 'JV & Legal'),
      risk('pm-availability', 'Project manager release is undocumented', 'medium', ['RAIL-04'], 'Operations Lead'),
      {
        type: 'stage_decision',
        input: {
          recommendation: 'conditional_go',
          rationale: 'Rail is the strongest pursuit; bonding is the only mandatory gap and a JV would close it before bid day.',
          conditions: ['Confirm the JV partner and obtain a combined surety letter of at least $30M.'],
          assumptions: ['Night possessions are available as published.'],
          confidence: 70,
        },
        ...agent,
      },
      { type: 'apply_jv_preset', ...human },
      {
        type: 'stage_decision',
        input: {
          recommendation: 'go',
          rationale: 'With the JV package confirmed the bonding gate passes and every remaining item is a deliverable the team can produce before bid day.',
          conditions: ['File the JV approval package at least seven days before bid.', 'Document project-manager availability.'],
          assumptions: ['The JV partner signs the agreement this week.'],
          confidence: 84,
        },
        ...agent,
      },
      { type: 'approve_decision', note: 'Approved. Proceed with the JV.', ...human },
    ],
    ctx,
  );
}

const options = (maximumWords: number, emphasis: BriefEmphasis[] = [], title: string | null = null) => ({ maximumWords, emphasis, title });

describe('buildOwnerBrief', () => {
  it('refuses to build from a pending or missing decision', () => {
    expect(() => buildOwnerBrief(createSeedState(), options(260), meta)).toThrow('Owner brief requires an approved decision.');
    const ctx = createTestContext();
    const pending = run(
      createSeedState(),
      [
        { type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent },
        { type: 'stage_decision', input: { recommendation: 'conditional_go', rationale: 'Bonding is the only mandatory gap and a JV would close it before bid day.', conditions: [], assumptions: [], confidence: 60 }, ...agent },
      ],
      ctx,
    );
    expect(() => buildOwnerBrief(pending, options(260), meta)).toThrow('Owner brief requires an approved decision.');
  });

  it('contains every section in the default order and carries the decision metadata', () => {
    const state = approvedRailState();
    const brief = buildOwnerBrief(state, options(400), meta);
    expect(brief.sections.map((s) => s.heading)).toEqual(HEADINGS);
    expect(brief.id).toBe('brief-test');
    expect(brief.generatedBy).toBe('agent');
    expect(brief.generatedAt).toBe(meta.generatedAt);
    expect(brief.decisionId).toBe(state.stagedDecision!.id);
    expect(brief.opportunityId).toBe(OPPORTUNITY_IDS.rail);
    expect(brief.stateVersion).toBe(state.stateVersion);
    expect(brief.title).toBe('Owner Brief — Rail Fastener Renewal Program — GO');
    expect(brief.text.startsWith(brief.title)).toBe(true);
    for (const heading of HEADINGS) expect(brief.text).toContain(`\n${heading}\n`);
    for (const section of brief.sections) expect(section.body.trim().length).toBeGreaterThan(0);
  });

  it('describes the approved decision, the comparison, the conditions, the owners, and the audit trail', () => {
    const state = approvedRailState();
    // An effectively unlimited budget so no section is trimmed. The reducer enforces the 150–400 bounds; the builder does not.
    const brief = buildOwnerBrief(state, options(100_000), meta);
    const body = (heading: string) => brief.sections.find((s) => s.heading === heading)!.body;

    expect(body('Approved decision')).toContain('GO on Rail Fastener Renewal Program');
    expect(body('Approved decision')).toContain('North River Transit Authority');
    expect(body('Approved decision')).toContain('Approved by the human');
    expect(body('Approved decision')).not.toContain('Note:');

    expect(body('Why this opportunity')).toContain('Station Accessibility Modernization');
    expect(body('Why this opportunity')).toContain('NO-GO');
    expect(body('Why this opportunity')).toContain('Senior Housing Preservation Development');

    expect(body('Conditions and assumptions')).toContain('Condition: File the JV approval package');
    expect(body('Conditions and assumptions')).toContain('Assumption: The JV partner signs');

    expect(body('Top disqualification risks')).toContain('CRITICAL — Single-project bonding is short of the minimum');
    expect(body('Top disqualification risks')).toContain('At risk: Named project manager');
    expect(body('Top disqualification risks').indexOf('CRITICAL')).toBeLessThan(body('Top disqualification risks').indexOf('HIGH'));

    expect(body('Owners and dates')).toContain('RAIL-01');
    expect(body('Owners and dates')).toContain('Finance & Bonding, due Saturday, September 12, 2026');

    expect(body('Next 24 hours')).toContain('Finance & Bonding: start');
    expect(body('Audit summary')).toContain('through site tools');
    expect(body('Audit summary')).toContain('superseded');
  });

  it('names the human JV change and the score movement it caused', () => {
    const state = approvedRailState();
    const brief = buildOwnerBrief(state, options(400), meta);
    const body = brief.sections.find((s) => s.heading === 'Human change incorporated')!.body;
    expect(body).toContain('Human confirmed the JV package');
    expect(body).toContain('jvPartnerConfirmed false → true');
    expect(body).toContain('jvCombinedBondingUsd 25000000 → 60000000');
    expect(body).toContain('Score moved');
    expect(body).toContain('(Conditional GO → GO)');
  });

  it('says when the company profile was never changed', () => {
    const ctx = createTestContext();
    const state = run(
      createSeedState(),
      [
        { type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent },
        { type: 'stage_decision', input: { recommendation: 'conditional_go', rationale: 'Bonding is the only mandatory gap and a JV would close it before bid day.', conditions: [], assumptions: [], confidence: 60 }, ...agent },
        { type: 'approve_decision', note: '', ...human },
      ],
      ctx,
    );
    const brief = buildOwnerBrief(state, options(400), meta);
    expect(brief.sections.find((s) => s.heading === 'Human change incorporated')!.body).toBe('The company profile was not changed during this pursuit.');
    expect(brief.sections.find((s) => s.heading === 'Conditions and assumptions')!.body).toBe('No conditions or assumptions were attached to the decision.');
    expect(brief.sections.find((s) => s.heading === 'Owners and dates')!.body).toBe('No requirement assignments have been made.');
    expect(brief.title).toBe('Owner Brief — Rail Fastener Renewal Program — Conditional GO');
    // Nothing is trimmed on this light state, so the comparison with the other two pursuits survives.
    expect(brief.wordCount).toBeLessThanOrEqual(400);
    const why = brief.sections.find((s) => s.heading === 'Why this opportunity')!.body;
    expect(why).toContain('Station Accessibility Modernization (53, NO-GO)');
    expect(why).toContain('Senior Housing Preservation Development (67, Conditional GO)');
  });

  it('respects the word budget at 400 and at the 260-word default', () => {
    const state = approvedRailState();
    const untrimmed = buildOwnerBrief(state, options(100_000), meta);
    // The rich fixture is longer than the largest allowed budget, so trimming is exercised for real.
    expect(untrimmed.wordCount).toBeGreaterThan(400);

    const full = buildOwnerBrief(state, options(400), meta);
    expect(full.maximumWords).toBe(400);
    expect(full.wordCount).toBeLessThanOrEqual(400);
    expect(full.wordCount).toBe(countWords(full.text));
    expect(full.sections.map((s) => s.heading)).toEqual(HEADINGS);

    const standard = buildOwnerBrief(state, options(260), meta);
    expect(standard.wordCount).toBeLessThanOrEqual(260);
    expect(standard.wordCount).toBe(countWords(standard.text));
    expect(standard.sections.map((s) => s.heading)).toEqual(HEADINGS);
    expect(standard.wordCount).toBeLessThan(full.wordCount);
  });

  it('guarantees a 150-word budget for a rich workspace', () => {
    const state = approvedRailState();
    const tight = buildOwnerBrief(state, options(150), meta);
    expect(tight.wordCount).toBeLessThanOrEqual(150);
    expect(tight.wordCount).toBe(countWords(tight.text));
  });

  it('trims toward a 150-word budget on a rich workspace, keeping every section and the decision intact (current behaviour)', () => {
    const state = approvedRailState();
    const untrimmed = buildOwnerBrief(state, options(100_000), meta);
    const full = buildOwnerBrief(state, options(400), meta);
    const tight = buildOwnerBrief(state, options(150), meta);
    expect(tight.maximumWords).toBe(150);
    expect(tight.wordCount).toBe(countWords(tight.text));
    expect(tight.wordCount).toBeLessThan(full.wordCount);
    expect(tight.sections.map((s) => s.heading)).toEqual(HEADINGS);
    const bodyOf = (brief: typeof full, heading: string) => brief.sections.find((s) => s.heading === heading)!.body;
    expect(bodyOf(tight, 'Approved decision')).toContain('GO on Rail Fastener Renewal Program');
    expect(bodyOf(tight, 'Next 24 hours').length).toBeGreaterThan(0);
    expect(bodyOf(tight, 'Why this opportunity').length).toBeLessThan(bodyOf(untrimmed, 'Why this opportunity').length);
    expect(bodyOf(tight, 'Owners and dates').length).toBeLessThan(bodyOf(untrimmed, 'Owners and dates').length);
  });

  it('respects a 150-word budget on a light workspace', () => {
    const ctx = createTestContext();
    const state = run(
      createSeedState(),
      [
        { type: 'select_opportunity', opportunityId: OPPORTUNITY_IDS.rail, ...agent },
        { type: 'stage_decision', input: { recommendation: 'conditional_go', rationale: 'Bonding is the only mandatory gap and a JV would close it before bid day.', conditions: [], assumptions: [], confidence: 60 }, ...agent },
        { type: 'approve_decision', note: '', ...human },
      ],
      ctx,
    );
    const tight = buildOwnerBrief(state, options(150), meta);
    expect(tight.wordCount).toBeLessThanOrEqual(150);
    expect(tight.wordCount).toBe(countWords(tight.text));
  });

  it('trims the lowest-priority sections first and leaves the decision and next-24-hours sections whole', () => {
    const state = approvedRailState();
    const untrimmed = buildOwnerBrief(state, options(100_000), meta);
    const full = buildOwnerBrief(state, options(400), meta);
    const bodyOf = (brief: typeof full, heading: string) => brief.sections.find((s) => s.heading === heading)!.body;
    expect(bodyOf(full, 'Why this opportunity').length).toBeLessThan(bodyOf(untrimmed, 'Why this opportunity').length);
    expect(bodyOf(full, 'Approved decision')).toBe(bodyOf(untrimmed, 'Approved decision'));
    expect(bodyOf(full, 'Next 24 hours')).toBe(bodyOf(untrimmed, 'Next 24 hours'));
  });

  it('moves emphasised sections to the front', () => {
    const state = approvedRailState();
    expect(buildOwnerBrief(state, options(400, ['risks']), meta).sections[0].heading).toBe('Top disqualification risks');
    expect(buildOwnerBrief(state, options(400, ['deadlines']), meta).sections[0].heading).toBe('Next 24 hours');
    expect(buildOwnerBrief(state, options(400, ['next_actions']), meta).sections[0].heading).toBe('Next 24 hours');
    const two = buildOwnerBrief(state, options(400, ['assignments', 'decision']), meta);
    expect(two.sections.slice(0, 2).map((s) => s.heading).sort()).toEqual(['Approved decision', 'Owners and dates']);
    expect(two.emphasis).toEqual(['assignments', 'decision']);
    expect(two.sections.map((s) => s.heading).sort()).toEqual([...HEADINGS].sort());
  });

  it('trims emphasised sections last', () => {
    const state = approvedRailState();
    const untrimmed = buildOwnerBrief(state, options(100_000), meta);
    const emphasised = buildOwnerBrief(state, options(400, ['risks']), meta);
    const plain = buildOwnerBrief(state, options(400), meta);
    const risksOf = (brief: typeof plain) => brief.sections.find((s) => s.heading === 'Top disqualification risks')!.body;
    expect(emphasised.wordCount).toBeLessThanOrEqual(400);
    expect(risksOf(emphasised)).toBe(risksOf(untrimmed));
    expect(emphasised.sections.find((s) => s.heading === 'Why this opportunity')!.body.length).toBeLessThan(
      untrimmed.sections.find((s) => s.heading === 'Why this opportunity')!.body.length,
    );
  });

  it('honours a custom title', () => {
    const brief = buildOwnerBrief(approvedRailState(), options(300, [], 'Bid Committee Summary'), meta);
    expect(brief.title).toBe('Bid Committee Summary');
    expect(brief.text.startsWith('Bid Committee Summary')).toBe(true);
  });

  it('adds a stale note when the profile changed after approval', () => {
    const ctx = createTestContext();
    const approved = approvedRailState(ctx);
    const stale = run(approved, [{ type: 'update_company_profile', changes: { backlogUtilizationPct: 70 }, label: 'released backlog', ...human }], ctx);
    expect(stale.stagedDecision!.stale).toBe(true);
    const brief = buildOwnerBrief(stale, options(400), meta);
    const decision = brief.sections.find((s) => s.heading === 'Approved decision')!.body;
    expect(decision).toContain('Note: Company profile changed after this was staged (backlogUtilizationPct)');
    expect(decision).toContain('The approved decision stands as recorded');
    // Both human changes are listed, newest last.
    const human_ = brief.sections.find((s) => s.heading === 'Human change incorporated')!.body;
    expect(human_).toContain('Human confirmed the JV package');
    expect(human_).toContain('Human released backlog: backlogUtilizationPct 82 → 70');
  });

  it('is generated through the reducer with the same content', () => {
    const ctx = createTestContext();
    const state = approvedRailState(ctx);
    const result = applyCommand(state, { type: 'generate_owner_brief', options: options(260, ['deadlines']), ...agent }, ctx);
    if (!result.ok) throw new Error(result.error.message);
    const brief = result.state.ownerBrief!;
    expect(brief.sections[0].heading).toBe('Next 24 hours');
    expect(brief.wordCount).toBeLessThanOrEqual(260);
    expect(brief.generatedBy).toBe('agent');
    expect(brief.stateVersion).toBe(state.stateVersion);
    expect(result.event!.detail).toContain(`${brief.wordCount} words`);
  });
});
