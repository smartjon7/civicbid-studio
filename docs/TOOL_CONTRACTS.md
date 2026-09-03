# Tool contracts — CivicBid Studio

Thirteen site tools registered from `src/main.tsx` with `document.modelContext.registerTool`. The definitions in `src/webmcp/tools.ts` and the schemas in `src/webmcp/schemas.ts` are binding; this document mirrors them. Every input schema closes `additionalProperties`, so an unknown property is rejected with `INVALID_INPUT`. Annotations use only `readOnlyHint`.

## Common result envelope

Every tool returns a plain JSON object (round-tripped through JSON so it never carries functions or class instances):

```
{
  ok: boolean,
  tool: string,
  summary: string,               // one sentence, plain English
  stateVersion: number,          // after the call
  changed: string[],             // state paths written; empty for reads and no-ops
  data?: unknown,                // tool-specific payload (below)
  warnings: string[],
  verification: {
    activityEventId: string | null,
    selectedOpportunityId: string | null,
    visiblePanel: 'welcome' | 'comparison' | 'workspace' | 'brief',
    focusedRequirementIds: string[],
    decisionStatus: 'none' | 'pending' | 'approved' | 'rejected'
  },
  error?: { code: string, message: string, recovery: string }
}
```

**Logging.** A write that changes state produces a versioned activity event, and `verification.activityEventId` points at it. A read-only call, and any failed call, is logged with an audit-only event that does not change `stateVersion`. A write that changed nothing (an idempotent repeat) points at the latest existing event.

## Error codes

| Code | When |
|---|---|
| `INVALID_INPUT` | Schema validation failed (unknown property, wrong type, out of bounds, id outside the enum), or the request contradicts a gate |
| `NOT_FOUND` | Unknown tool name; or no requested requirement id belongs to the open opportunity |
| `NO_OPPORTUNITY_SELECTED` | A workspace tool was called before `civicbid_open_opportunity` |
| `REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY` | A requirement id belongs to another opportunity (assign, risk) |
| `DECISION_NOT_PENDING` | Approve/reject with nothing pending (human interface path only) |
| `DECISION_NOT_APPROVED` | Owner brief requested before a human approved the current decision |
| `APPROVED_DECISION_LOCKED` | Reserved for edits that would silently alter an approved decision |
| `HUMAN_ONLY_ACTION` | Any non-human attempt at approval, rejection, or a profile edit (the reducer's answer; no tool maps to these) |
| `UNSUPPORTED_BROWSER` | Reserved: the browser has no WebMCP and a browser-routed execution was requested |
| `INTERNAL_STATE_ERROR` | An unexpected exception; state unchanged; reread with `civicbid_get_workspace_state` and retry once |

Every error carries a `recovery` sentence the agent can act on. Validation errors include the tool's example input.

## Shared enumerations

- Opportunity ids (enum in every schema that takes one): `opp-rail-fastener-renewal`, `opp-station-accessibility`, `opp-senior-housing-preservation`.
- Requirement ids: pattern `^[A-Z]{2,5}-[0-9]{2}$`, 5–8 characters; seed values `RAIL-01`..`RAIL-10`, `STA-01`..`STA-09`, `HSG-01`..`HSG-08`.
- Owner roles: Executive Sponsor, Proposal Manager, Estimating Lead, Finance & Bonding, Operations Lead, Safety Director, Compliance Lead, JV & Legal, Scheduler, Quality Manager.
- Sectors: `rail`, `accessibility`, `housing`.
- Requirement statuses: `satisfied`, `gap`, `at_risk`, `assigned`, `complete`. Categories: `eligibility`, `bonding`, `experience`, `staffing`, `safety`, `participation`, `schedule`, `quality`, `legal`, `submission`.
- Severities: `low`, `medium`, `high`, `critical`. Risk statuses: `open`, `mitigating`, `resolved`.
- Recommendations: `go`, `conditional_go`, `no_go`.
- Brief emphases: `decision`, `conditions`, `risks`, `assignments`, `deadlines`, `next_actions`.
- Dates: `YYYY-MM-DD`, exactly 10 characters.

---

## civicbid_list_opportunities — read

**Purpose:** list and filter opportunities with each one's deterministic score and recommendation, best first.

**Input** (all optional)

| Field | Type | Bounds | Default |
|---|---|---|---|
| `minimumValueUsd` | integer | ≥ 0 | none |
| `maximumDaysToDeadline` | integer | 1–365 | none |
| `sectors` | array of sector | ≤ 3, unique | all |
| `includeClosed` | boolean | | `false` |

**Returns** `data`: `{ count, demoDate, opportunities: [{ id, title, agency, sector, estimatedValueUsd, deadline, daysToDeadline, score, recommendation, recommendationLabel, mitigableGapCount, unmitigableGapCount, summary }] }`.

**Errors:** `INVALID_INPUT`.

**Example:** `{ "minimumValueUsd": 20000000, "maximumDaysToDeadline": 45 }` returns Rail (78, Conditional GO) and Station (53, NO-GO).

## civicbid_compare_opportunities — read (switches the comparison panel)

**Purpose:** rank two or three opportunities side by side with dimension scores, gates, gaps, and up to four plain-English reasons the strongest one wins.

**Input:** `opportunityIds` — required array of 2–3 unique opportunity ids.

**Returns** `data`: `{ strongestOpportunityId, ranked: [{ opportunityId, title, score, rawScore, capped, recommendation, recommendationLabel, dimensions: [{ key, label, weight, score }], passedGates, mitigableGaps, unmitigableGaps, rationale }], decisiveDifferences: string[] }`.

**Errors:** `INVALID_INPUT`.

**Behaviour:** business data is unchanged, but the visible panel switches to the comparison, so this call is logged as a versioned event with `changed: ['comparisonIds', 'ui.visiblePanel']`.

## civicbid_open_opportunity — write

**Purpose:** open one opportunity in the shared workspace.

**Input:** `opportunityId` — required, one of the three ids.

**Returns** `data`: `{ opportunity: { id, title, agency, solicitationNumber, sector, sectorLabel, location, estimatedValueUsd, deadline, daysToDeadline, strategicFit, summary, scopeHighlights }, evaluation: { opportunityId, score, rawScore, capped, recommendation, recommendationLabel, mitigableGaps, unmitigableGaps, atRisk, nextAction }, requirementCounts: { total, mandatory, satisfied, gap, atRisk, assigned, complete } }`.

**Errors:** `INVALID_INPUT` (id outside the enum).

**Behaviour:** switching opportunities clears the requirement focus. Opening the already-open opportunity is a no-op.

## civicbid_get_context — read

**Purpose:** everything about the open opportunity in one call.

**Input:** none (empty object).

**Returns** `data`: `{ stateVersion, demoDate, company, opportunity, evaluation (with dimensions, gates, scoreDrivers, rationale), requirements: [{ id, label, category, mandatory, status, gateEffect, severity, finding, suggestedMitigation, suggestedOwner, ownerRole, dueDate }], focusedRequirementIds, focusReason, comparisonIds, assignments, risks, stagedDecision, approval, decisionStatus, ownerBrief: { exists, ... }, recentHumanChanges (last 10 human profile events) }`.

**Errors:** `NO_OPPORTUNITY_SELECTED`.

## civicbid_list_requirements — read

**Purpose:** the requirement matrix for the open opportunity, filterable.

**Input** (all optional)

| Field | Type | Bounds | Default |
|---|---|---|---|
| `mandatoryOnly` | boolean | | `false` |
| `statuses` | array of status | ≤ 5, unique | all |
| `categories` | array of category | ≤ 10, unique | all |

**Returns** `data`: `{ opportunityId, count, requirements: [{ id, label, category, mandatory, status, gateEffect, severity, finding, suggestedMitigation, suggestedOwner, ownerRole, dueDate, evidence, kind, failureMode, focused, assignmentNote, complete }] }`.

**Errors:** `NO_OPPORTUNITY_SELECTED`, `INVALID_INPUT`.

## civicbid_focus_requirements — write

**Purpose:** highlight requirements in the person's view with a one-sentence reason.

**Input**

| Field | Type | Bounds |
|---|---|---|
| `requirementIds` | array of requirement id | required, 1–10, unique |
| `mode` | `replace` or `add` | required |
| `reason` | string | required, 1–240 characters |

**Returns** `data`: `{ focusedRequirementIds, reason, invalidIds, visiblePanel }`.

**Warnings:** ids that match the pattern but do not belong to the open opportunity are ignored and listed in `invalidIds` with a warning.

**Errors:** `NO_OPPORTUNITY_SELECTED`, `INVALID_INPUT`, `NOT_FOUND` (when none of the ids belongs to the open opportunity). An identical focus is a no-op.

## civicbid_assign_requirement — write (idempotent upsert)

**Purpose:** assign an owner role and due date to a requirement of the open opportunity.

**Input**

| Field | Type | Bounds | Default |
|---|---|---|---|
| `requirementId` | requirement id | required, in the open opportunity | |
| `ownerRole` | owner role | required | |
| `dueDate` | date | required, `YYYY-MM-DD` | |
| `note` | string | ≤ 300 characters | `""` |

**Returns** `data`: `{ assignment: { requirementId, opportunityId, ownerRole, dueDate, note, assignedBy, createdAt, updatedAt }, changedFields, requirementStatus, warnings }`.

**Warnings:** due date after the bid deadline; due date before the demo date.

**Errors:** `NO_OPPORTUNITY_SELECTED`, `INVALID_INPUT` (pattern, role, date, note length, invalid calendar date), `NOT_FOUND`, `REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY`. Re-sending the same assignment is a no-op; changes record only the fields that differ.

## civicbid_upsert_risk — write (idempotent by riskKey)

**Purpose:** register or update a risk for the open opportunity.

**Input**

| Field | Type | Bounds | Default |
|---|---|---|---|
| `riskKey` | string | required, pattern `^[a-z0-9][a-z0-9-]{1,48}$`, 2–49 characters | |
| `title` | string | required, 1–100 characters | |
| `severity` | severity | required | |
| `relatedRequirementIds` | array of requirement id | ≤ 5, unique, in the open opportunity | `[]` |
| `rationale` | string | ≤ 500 characters | `""` |
| `mitigation` | string | ≤ 500 characters | `""` |
| `ownerRole` | owner role | required | |
| `status` | risk status | | `open` |

**Returns** `data`: `{ risk, created, updated }`.

**Errors:** `NO_OPPORTUNITY_SELECTED`, `INVALID_INPUT`, `NOT_FOUND`, `REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY`. An identical risk is a no-op.

## civicbid_stage_decision — write (never approves)

**Purpose:** stage a bid/no-bid recommendation as a pending decision for the human.

**Input**

| Field | Type | Bounds | Default |
|---|---|---|---|
| `recommendation` | `go`, `conditional_go`, `no_go` | required | |
| `rationale` | string | required, 40–1,200 characters | |
| `conditions` | array of string | ≤ 8, unique, each 1–240 characters | `[]` |
| `assumptions` | array of string | ≤ 8, unique, each 1–240 characters | `[]` |
| `confidence` | integer | required, 0–100 | |

**Returns** `data`: `{ decision: { id, recommendation, recommendationLabel, rationale, conditions, assumptions, confidence, stagedAt, stateVersion, supersedesDecisionId, stale }, evaluationSnapshot, decisionStatus: 'pending', message: 'Human approval is still required. No tool can approve this decision.' }`.

**Errors:** `NO_OPPORTUNITY_SELECTED`, `INVALID_INPUT` — including a GO or Conditional GO that contradicts an unmitigable gate failure (the recovery says to stage `no_go` or ask the human to change the profile).

**Behaviour:** approval is never set. Staging while a decision is pending supersedes it. Staging after approval supersedes the approved decision and clears the approval; the superseded decision stays in history as approved.

## civicbid_get_workspace_state — read

**Purpose:** the workspace at a glance, and exactly what humans changed since a version.

**Input** (all optional)

| Field | Type | Bounds | Default |
|---|---|---|---|
| `detailLevel` | `summary` or `full` | | `summary` |
| `sinceStateVersion` | integer | ≥ 0 | `0` (everything) |

**Returns** `data`: `{ stateVersion, demoDate, detailLevel, company, selectedOpportunity: { id, title } | null, evaluation (summary, or full with requirements) | null, assignments, risks, stagedDecision, approval, decisionStatus, ownerBrief, comparisonIds, focusedRequirementIds, focusReason, sinceStateVersion, humanChangesSince: [{ id, at, actor, channel, action, title, detail, changed, stateVersionBefore, stateVersionAfter, profileChanges, evaluationDelta }], changedSinceSummary }`.

`humanChangesSince` holds the human and system events with `stateVersionAfter` greater than `sinceStateVersion`; each carries `profileChanges` (field, before, after) and `evaluationDelta` (score and recommendation before and after, gaps closed and opened). `changedSinceSummary` is a one-sentence narration, for example "Since version 9: the human confirmed the JV package; Rail Fastener Renewal Program moved 79 to 88 (Conditional GO to GO)."

**Errors:** `INVALID_INPUT`.

## civicbid_generate_owner_brief — write (requires human approval)

**Purpose:** the executive brief from the approved decision.

**Input** (all optional)

| Field | Type | Bounds | Default |
|---|---|---|---|
| `maximumWords` | integer | 150–400 | `260` |
| `emphasis` | array of emphasis | ≤ 6, unique | `[]` |
| `title` | string | 1–100 characters | generated |

**Returns** `data`: `{ brief: { id, title, wordCount, maximumWords, sections: [{ heading, body }], text, stateVersion, decisionId, generatedAt }, approvedDecisionId, visiblePanel: 'brief' }`.

**Errors:** `DECISION_NOT_APPROVED` (no decision, pending, or rejected — the recovery says to stop and ask the human to approve in the workspace), `INVALID_INPUT`. A brief on a stale approval succeeds and carries the staleness note.

## civicbid_reset_demo — write

**Purpose:** restore the synthetic seed.

**Input:** `confirm` — required, must equal `RESET_CIVICBID_DEMO` (enforced by the schema enum).

**Returns** `data`: `{ reset: true, stateVersion, selectedOpportunityId: null, visiblePanel: 'welcome' }`.

**Errors:** `INVALID_INPUT` when the confirmation string is missing or wrong.

**Behaviour:** the state version keeps counting up (never returns to 1); the activity log restarts with the reset event.

## civicbid_simulate_company_change — read

**Purpose:** preview how every opportunity (or one) would move if the company profile changed, without writing anything.

**Input**

| Field | Type | Bounds |
|---|---|---|
| `changes` | object | required, at least one field: `jvPartnerConfirmed` (boolean), `jvCombinedBondingUsd`, `singleProjectBondingUsd`, `aggregateBondingUsd`, `availableProjectManagers`, `railYears`, `comparableRailProjects`, `accessibilityStationProjects`, `completedHousingDevelopments` (integers ≥ 0), `backlogUtilizationPct` (integer 0–100), `safetyRecord` (`strong`, `acceptable`, `poor`), `dbeCertified` (boolean) |
| `opportunityId` | opportunity id | optional; limits the result to one opportunity |

**Returns** `data`: `{ simulated: true, changes, deltas: [{ opportunityId, title, scoreBefore, scoreAfter, recommendationBefore, recommendationAfter, gapsClosed, gapsOpened }], recommendationToHuman }`.

`recommendationToHuman` says what the change would do and that only the human can make it in the workspace.

**Errors:** `INVALID_INPUT` (empty `changes`, unknown field, out of bounds), `NOT_FOUND`.

**Behaviour:** the state version does not change; the call is logged as a read.

---

## Not tools, by design

Approve, Reject, Confirm JV package, company profile edits, marking a requirement done, and the Reset demo button are interface controls only. The reducer returns `HUMAN_ONLY_ACTION` to any command for approval, rejection, or profile edits that does not come from a human in the interface, and `tests/human-only-approval.test.ts` checks that no tool names or reaches those commands.
