# QA checklist — CivicBid Studio

Tick each item only after observing it. Domain items are covered by automated tests; browser and end-to-end items need a person in a supported browser.

## Domain (automated: `npm test`)

- [x] Seed calibration: Rail 78 Conditional GO, Station 53 NO-GO, Housing 67 Conditional GO.
- [x] Filter over $20M within 45 days returns Rail and Station only; Housing ($18M) excluded.
- [x] Days to deadline use the frozen demo date (September 3, 2026): Rail 26, Station 20, Housing 44.
- [x] Any unmitigable mandatory failure yields NO-GO regardless of score (Station STA-02; poor safety record).
- [x] A mitigable mandatory capability gap caps the score at 79 and yields Conditional GO (Rail after agent work: raw 83, shown 79).
- [x] No gaps: 80+ GO, 65–79 Conditional GO, below 65 NO-GO.
- [x] JV preset moves Rail to GO (83 with no agent work, 85–88 with assignments and risks); Station stays NO-GO.
- [x] Project-manager rule: at risk at 82% backlog, satisfied at 80% or below, complete when documented.
- [x] JV approval package applies when single bonding is below the minimum or a JV is confirmed; not applicable otherwise.
- [x] `simulateProfileChange` never mutates state.
- [x] `assign_requirement` and `upsert_risk` are idempotent and record only changed fields.
- [x] `focus_requirements` add/replace; identical focus is a no-op; switching opportunity clears focus.
- [x] Invalid ids and inputs return `INVALID_INPUT`, `NOT_FOUND`, `NO_OPPORTUNITY_SELECTED`, `REQUIREMENT_NOT_IN_SELECTED_OPPORTUNITY` with recovery text.
- [x] `stage_decision` never sets approval; a GO/Conditional GO contradicting an unmitigable gate is rejected.
- [x] `approve_decision` / `reject_decision` accepted only from human + ui; every other provenance gets `HUMAN_ONLY_ACTION`.
- [x] `update_company_profile` / `apply_jv_preset` rejected for the agent with a pointer to the simulate tool.
- [x] JV preset marks a pending decision stale with a reason; a profile change after approval marks stale but keeps the approval.
- [x] Re-staging after approval supersedes the approved decision and clears the approval.
- [x] Owner brief fails before approval (`DECISION_NOT_APPROVED`) and succeeds after; stale approvals are noted in the brief.
- [x] Reset restores the seed except the monotonic version, the activity log, and the interface state.
- [x] `record_tool_call` appends an audit event without bumping the version.
- [x] Activity log capped at 400 events with monotonic sequence numbers.
- [x] Persistence round-trips through localStorage; schema mismatch returns null; opportunities refreshed from seed; toast cleared.
- [ ] Owner brief guarantees a 150-word budget on a rich workspace (open: last-resort trim runs once; see KNOWN_LIMITATIONS.md).

## Tools (automated in `tests/webmcp-tools.test.ts`, `tests/human-only-approval.test.ts`, `tests/demo-sequence.test.ts`; then confirm by hand in the Tool Console and in a WebMCP browser)

- [x] Thirteen `civicbid_` tools with closed schemas and valid example inputs; read/write flags as documented; no tool name contains approve or reject; no tool reaches a human-only command (automated).
- [x] Judge sequence through the registered tools against a fake `document.modelContext`: registers once, Rail wins, no tool approves, brief blocked until human approval, reset restores the seed (automated).
- [ ] All thirteen tools listed in the Tool Console with valid example inputs (by hand).
- [ ] Every tool returns the result envelope: `ok`, `tool`, `summary`, `stateVersion`, `changed`, `data`, `warnings`, `verification`, `error`.
- [ ] `verification` carries `activityEventId`, `selectedOpportunityId`, `visiblePanel`, `focusedRequirementIds`, `decisionStatus`.
- [ ] Read tools do not change `stateVersion`; their calls still appear on the timeline.
- [ ] `civicbid_compare_opportunities` switches the centre panel to the comparison.
- [ ] `civicbid_get_workspace_state` with `sinceStateVersion` returns only human and system events after that version, each with before/after scores.
- [ ] `civicbid_generate_owner_brief` returns `DECISION_NOT_APPROVED` before approval with a recovery message.
- [ ] `civicbid_reset_demo` refuses without `confirm: "RESET_CIVICBID_DEMO"`; with it, the version increases and the seed returns.
- [ ] `civicbid_simulate_company_change` returns deltas and writes nothing (version unchanged, profile unchanged).
- [ ] No tool exists for approve, reject, profile edits, marking complete, or the Reset button's human path.
- [ ] Every failed call is logged on the timeline as a failed tool call.

## Browser (ChatGPT desktop app and Chrome 149+)

- [ ] Header badge reads **Site tools ready · 13 registered** and the count comes from `getTools()`.
- [ ] Site tools panel lists thirteen tools with read/write badges matching the annotations.
- [ ] ChatGPT: Site tools menu in the address bar shows the same thirteen; Recently used shows calls with Sources.
- [ ] Chrome: tools visible with the WebMCP flag enabled; page works with the flag disabled (fallback banner).
- [ ] Unsupported browser shows the fallback banner and the Tool Console still works.
- [ ] Registration happens once per page lifecycle; reload does not duplicate tools.
- [ ] No console errors on load, on each tool call, or on reset.
- [ ] Layout readable at 1280 wide and at 1920 wide; no horizontal scroll at 1280.

## End to end (the judge sequence)

- [ ] Prompt 1: two opportunities found, comparison shown, Rail opened, requirements focused, gaps assigned, risks registered, Conditional GO staged, nothing approved.
- [ ] Human: Confirm JV package changes the profile; the pending card flags staleness; the timeline shows the human event with the score movement.
- [ ] Prompt 2: agent reports exactly the human change, re-stages GO, timeline reads "revised from Conditional GO"; still pending.
- [ ] Human: Approve; card shows approved by human with version; timeline shows human approval.
- [ ] Prompt 3: brief generated with all sections including "Human change incorporated" and the audit summary.
- [ ] Agent asked to approve reports the human-only error and stops.
- [ ] Reset returns to the seed; version continues counting.
- [ ] State survives a page reload (localStorage) and the tool count is still thirteen after reload.

## Release

- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass locally.
- [ ] `node scripts/scan-secrets.mjs` exits 0.
- [ ] GitHub Actions run green on the submission commit; Pages serves the latest build.
- [ ] Production URL loads over HTTPS with no login and the footer carries the not-advice statement.
- [ ] LICENSE (MIT) detected on the repository page.
- [ ] README hero screenshot present; screenshots 01–09 captured per `artifacts/screenshots/README.md`.
