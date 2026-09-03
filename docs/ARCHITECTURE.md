# Architecture — CivicBid Studio

Plain, inspectable, one write path. This document describes the state shape, the command flow, the evaluation engine, the tool runtime, persistence, and the decision state machine. File references are to `src/`.

## Layers

```
interface (React)  ──┐
                     ├──>  store.dispatch(Command)  ──>  applyCommand (reducer)  ──>  new AppState + ActivityEvent
WebMCP tools ────────┘                                                                    │
                                                                                          ├──>  subscribers (interface re-render)
                                                                                          └──>  persistence (localStorage)
evaluation (pure functions over AppState)  <──  selectors  <──  interface and tools read here
```

- `store/types.ts` — every type, enum, and the `Command` union.
- `store/reducer.ts` — `applyCommand`, the only place business state changes.
- `store/store.ts` — `createStore`: holds state, dispatches, notifies, converts thrown errors into `INTERNAL_STATE_ERROR`.
- `store/persistence.ts` — save and load through `localStorage`.
- `domain/evaluateOpportunity.ts` — the scoring and gate engine.
- `domain/selectors.ts` — read helpers shared by the interface and the tools.
- `domain/ownerBrief.ts` — the deterministic executive brief.
- `domain/format.ts` — money, dates, labels, word counts.
- `data/seed.ts` — synthetic company, opportunities, requirement rules, JV preset.
- `webmcp/types.ts` and `webmcp/index.ts` — tool definitions, registration, execution, discovery, result envelope.

## State shape

`AppState` (`store/types.ts`):

| Field | Meaning |
|---|---|
| `schemaVersion` | Persistence schema (currently 1); mismatch discards stored state |
| `stateVersion` | Monotonic counter, bumped by every business write, never by read-only tool calls or reset back to 1 |
| `demoAnchorDate` | `2026-09-03`; days to deadline are measured from here |
| `company` | The human-editable company profile (bonding, experience, staffing, safety, DBE, JV) |
| `opportunities` | Seed data; always refreshed from code on load |
| `selectedOpportunityId`, `comparisonIds` | What the workspace and comparison panel show |
| `focusedRequirementIds`, `focusReason` | Rows highlighted for human review and why |
| `assignments` | `requirementId -> Assignment` (owner role, due date, note, who assigned, timestamps) |
| `completedRequirementIds` | Requirements the human marked done |
| `risks` | Risk register; unique by `(riskKey, opportunityId)` |
| `stagedDecision`, `decisionHistory` | The current recommendation and every superseded one |
| `approval` | The human's approve/reject record for the current decision, or null |
| `ownerBrief` | The last generated brief, or null |
| `activity` | Version-stamped events, capped at 400 |
| `ui` | `visiblePanel` (welcome, comparison, workspace, brief), `toolConsoleOpen`, `lastToast` |

Evaluation results are never stored, except as `EvaluationSummary` snapshots inside a staged decision and its approval, which is how staleness is detected.

## Command flow

1. A button or a tool builds a `Command` with provenance: `actor` (agent, human, system), `channel` (webmcp, console, ui, system), and optionally `tool`.
2. `store.dispatch` calls `applyCommand(state, command, ctx)`. `ctx` supplies the clock and id generator; tests use `createTestContext()` for a fixed clock and sequential ids.
3. The reducer validates, and either returns `{ ok: false, error: { code, message, recovery } }` with the state unchanged, a no-op success (identical state, no event), or a `commit`.
4. `commit` creates one `ActivityEvent` (actor, channel, tool, action, title, detail, `changed[]`, `stateVersionBefore/After`, `opportunityId`, `profileChanges[]`, `evaluationDelta`), bumps `stateVersion`, appends the event, and sets `ui.lastToast`.
5. The store notifies subscribers only when the state object changed. Persistence writes on every notification.

Two commands are special:

- `record_tool_call` appends an audit event with `stateVersionBefore === stateVersionAfter` and does not change business state. Tools use it for read-only calls and for failed calls so the timeline shows every invocation.
- `set_ui` changes interface state without an event or a version bump.

### Human-only boundaries (enforced in the reducer)

- `approve_decision` and `reject_decision`: accepted only when `actor === 'human'` and `channel === 'ui'`. Anything else returns `HUMAN_ONLY_ACTION`.
- `update_company_profile` and `apply_jv_preset`: accepted only when `actor === 'human'`. The agent gets `HUMAN_ONLY_ACTION` with a pointer to `civicbid_simulate_company_change`.
- No tool definition maps to these commands, and the Tool Console cannot reach them either.

## Evaluation

`evaluateOpportunityWithProfile(state, opportunity, profile)` computes everything from the profile, the opportunity's requirement rules, assignments, completions, and risks.

**Requirement rules** (`RequirementRule`): `min_bonding`, `min_rail_years`, `min_comparable_rail_projects`, `min_accessibility_station_projects`, `min_housing_developments`, `project_managers` (minimum count and maximum backlog percent), `safety_record`, `dbe_participation`, `jv_approval_package`, `deliverable`. Each yields met / applicable / at-risk and a plain-English finding.

**Gate effect per mandatory requirement:** `pass`, `not_applicable`, `at_risk`, `mitigable_gap`, `unmitigable_gap`, `deliverable_open`. Capability-type requirements that fail become gaps with the requirement's failure mode; deliverable-type requirements that are not complete are `deliverable_open`; a poor safety record is always unmitigable.

**Dimensions and weights:** compliance 0.30 (average of point values over mandatory requirements: met 1.0, assigned deliverable 0.85, at risk 0.6, open deliverable 0.55, mitigable capability gap 0.25, unmitigable 0), experience 0.20, capacity 0.20 (bonding ratio and aggregate headroom), readiness 0.15 (project-manager availability and days to deadline), strategic fit 0.10, risk readiness 0.05 (registered risks with an owner and mitigation).

**Recommendation:**

1. Any `unmitigable_gap` → NO-GO.
2. Else any `mitigable_gap` → Conditional GO, score capped at 79.
3. Else score ≥ 80 → GO; 65–79 → Conditional GO; < 65 → NO-GO.

Helpers: `evaluateAll`, `rankEvaluations` (score, then recommendation), `filterOpportunities` (value, days to deadline, sector, closed), `simulateProfileChange` (evaluates a hypothetical profile without writing), `summarizeEvaluation` / `summariesDiffer` / `diffEvaluations` (staleness and deltas).

## Tool runtime

`webmcp/index.ts` exports `createToolRuntime(store)` returning a `ToolRuntime` (`webmcp/types.ts`):

- `definitions`: thirteen `ToolDefinition`s (name, title, description, JSON-schema input, `readOnly`, an example input for the console).
- `execute(name, input, channel)`: validates input against the schema, dispatches commands or reads selectors, records read-only and failed calls with `record_tool_call`, and returns a `CivicBidToolResult` envelope. Never throws.
- `register()`: feature-detects `document.modelContext.registerTool`, registers every tool once with `annotations: { readOnlyHint }` for reads, then reads the registry back with `getTools()` to build `WebMcpStatus` (supported, registered, count, discovered list, whether `executeTool` is available, error).
- `unregister()`, `getStatus()`, `subscribe()` for the interface.

**Result envelope:** `{ ok, tool, summary, stateVersion, changed, data, warnings, verification: { activityEventId, selectedOpportunityId, visiblePanel, focusedRequirementIds, decisionStatus }, error: { code, message, recovery } }`.

**Error codes:** `INVALID_INPUT`, `NOT_FOUND`, `NO_OPPORTUNITY_SELECTED`, `REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY`, `DECISION_NOT_PENDING`, `DECISION_NOT_APPROVED`, `APPROVED_DECISION_LOCKED`, `HUMAN_ONLY_ACTION`, `UNSUPPORTED_BROWSER`, `INTERNAL_STATE_ERROR`.

The Tool Console calls the same `execute` with `channel: 'console'` (or routes through `document.modelContext.executeTool` when the browser offers it). Console runs are logged as "Agent (tool console)".

## Persistence

- Key: `civicbid-studio:state:v1`. Written on every state change by `attachPersistence(store)`.
- `loadPersistedState()` returns null when nothing is stored, the JSON is malformed, `schemaVersion` differs, or `stateVersion` is not a number. Otherwise it merges the stored record over a fresh seed, always takes `opportunities` from code, clears `ui.lastToast`, and closes the Tool Console.
- `loadInitialState()` falls back to `createSeedState()`.
- Quota or privacy-mode failures are swallowed; the app keeps working in memory.

## Decision state machine

```
none ──stage──> pending ──approve (human, ui)──> approved
                  │  └────reject (human, ui)──> rejected
                  │
                  └──stage again──> pending (supersedes; previous kept in history)

approved ──stage again──> pending (approval cleared; superseded decision recorded as approved in history)
approved ──generate_owner_brief──> approved (+ ownerBrief)
pending / rejected ──generate_owner_brief──> DECISION_NOT_APPROVED
```

- `selectDecisionStatus`: `none` when nothing is staged; the approval's status when it matches the current decision; otherwise `pending`.
- **Staleness:** a human profile change re-evaluates the decision's opportunity; if the score, recommendation, or gap lists differ from the decision's snapshot, `stale` is set with a plain reason. Pending: "Reevaluate and re-stage before approval." Approved: "The approved decision stands as recorded; stage a new decision to replace it." The brief carries the note.
- **Contradiction guard:** staging GO or Conditional GO while an unmitigable gap exists is rejected with `INVALID_INPUT`.
- **Reset:** restores the seed but keeps the version counting up and starts a fresh activity log with the reset event.
