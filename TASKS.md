# Tasks — CivicBid Studio

Deadline: September 3, 2026, 4:00 PM Eastern.

## P0 — required to submit

- [x] Synthetic seed: three opportunities, company profile, requirement rules (RAIL-01..10, STA-01..09, HSG-01..08).
- [x] Deterministic evaluation engine with weights, gates, cap, rationale, score drivers.
- [x] Single reducer with provenance, human-only approval/rejection and profile edits, staleness, supersession, audit-only tool-call events, reset.
- [x] Store, persistence (localStorage, schema-versioned), selectors, owner brief builder.
- [x] Calibration test pinning the seed scores and the JV move.
- [x] Domain tests: evaluation, reducer, brief, persistence.
- [x] Secret scan script, wired into `npm run check` and the workflow.
- [x] GitHub Actions workflow: typecheck, lint, test, secret scan, build, deploy to Pages.
- [x] Documentation: README, SUBMISSION, DEMO_SCRIPT, JUDGE_TEST, QA_CHECKLIST, STATUS, DECISIONS, TEST_RESULTS, KNOWN_LIMITATIONS, SUBMISSION_CHECKLIST, docs/ARCHITECTURE, docs/TOOL_CONTRACTS, docs/BUILD_BRIEF.
- [x] WebMCP runtime: thirteen tool definitions, registration from `src/main.tsx`, execute, discovery read-back, result envelope (`src/webmcp/`).
- [x] Interface: header badge, Site tools panel, Tool Console, left rail with profile and Confirm JV package, workspace (scorecard, matrix, risks), pending-decision card with human-only Approve/Reject, timeline, brief panel (`src/components/`, `src/app/`).
- [x] Judge-sequence automated test with a fake `document.modelContext` (`tests/demo-sequence.test.ts`), plus `tests/human-only-approval.test.ts` and `tests/webmcp-tools.test.ts`.
- [x] Typecheck, lint, full test suite (121), secret scan, and build green on the application commit and in GitHub Actions.
- [x] Live URL verified in Chrome 152 with WebMCP enabled: `getTools()` returns 13, full judge sequence through `executeTool`, human clicks, persistence, reset, no console errors.
- [x] Screenshots 01–10 captured from production; README hero image present.
- [x] Demo video rendered from production (under three minutes, narrated).
- [ ] Jonathan: verify in the ChatGPT desktop browser (GPT-5.6 Sol or Terra).
- [ ] Jonathan: upload the video to YouTube (Public) and paste the link into the Devpost form.
- [ ] Jonathan: submit the Devpost form with SUBMISSION.md copy, repository link, live link, video link, screenshots.

## P1 — done or deferred

- [x] Owner-brief word budget guaranteed at 150–400 (last-resort trim repeats); test converted from todo to a real guarantee.
- [x] `scan:secrets` in `package.json` and the workflow.
- [x] `artifacts/test-evidence/TEST_REPORT.md` filled from real runs.
- [x] Copy and print for the owner brief; per-row human Assign/Change; Generate brief button after approval.
- [ ] Keyboard focus and contrast pass beyond what the build already provides (deferred; not blocking).

## P2 — not before judging ends

- [ ] Filter chips for the timeline (agent / human / system).
- [ ] A "what would it take" panel that surfaces `civicbid_simulate_company_change` results for a person.
- [ ] Origin-trial token for Chrome so the flag is not required.
- [ ] Additional synthetic opportunities and sectors.
- [ ] Undo of the last agent write.
