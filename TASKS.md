# Tasks — CivicBid Studio

Deadline: September 3, 2026, 4:00 PM Eastern.

## P0 — required to submit

- [x] Synthetic seed: three opportunities, company profile, requirement rules (RAIL-01..10, STA-01..09, HSG-01..08).
- [x] Deterministic evaluation engine with weights, gates, cap, rationale, score drivers.
- [x] Single reducer with provenance, human-only approval/rejection and profile edits, staleness, supersession, audit-only tool-call events, reset.
- [x] Store, persistence (localStorage, schema-versioned), selectors, owner brief builder.
- [x] Calibration test pinning the seed scores and the JV move.
- [x] Domain tests: evaluation, reducer, brief, persistence.
- [x] Secret scan script.
- [x] GitHub Actions workflow: typecheck, lint, test, build, deploy to Pages.
- [x] Documentation: README, SUBMISSION, DEMO_SCRIPT, JUDGE_TEST, QA_CHECKLIST, STATUS, DECISIONS, TEST_RESULTS, KNOWN_LIMITATIONS, SUBMISSION_CHECKLIST, docs/ARCHITECTURE, docs/TOOL_CONTRACTS, docs/BUILD_BRIEF.
- [x] WebMCP runtime: thirteen tool definitions, registration from `src/main.tsx`, execute, discovery read-back, result envelope (`src/webmcp/`).
- [x] Interface: header badge, Site tools panel, Tool Console, left rail with profile and Confirm JV package, workspace (scorecard, matrix, risks), pending-decision card with human-only Approve/Reject, timeline, brief panel (`src/components/`, `src/app/`).
- [x] Judge-sequence automated test with a fake `document.modelContext` (`tests/demo-sequence.test.ts`), plus `tests/human-only-approval.test.ts` and `tests/webmcp-tools.test.ts`.
- [x] Typecheck, lint, full test suite, and build green locally on the integrated tree (September 3, 2026, about 1:05 AM Eastern).
- [ ] `npm run check` green on the submission commit and in GitHub Actions.
- [ ] Live URL verified in the ChatGPT desktop browser and Chrome 149+; badge reads 13 registered.
- [ ] Screenshots 01–09 captured; README hero image present.
- [ ] Video recorded (under three minutes), uploaded to YouTube, linked in README and SUBMISSION.
- [ ] Devpost form submitted with SUBMISSION.md copy, repository link, live link, video link.

## P1 — should have

- [ ] Apply the owner-brief word-budget patch (repeat the last-resort trim) and turn the todo in `tests/domain-brief.test.ts` into a real test.
- [ ] Add `"scan:secrets": "node scripts/scan-secrets.mjs"` to `package.json` and run it in the workflow.
- [ ] Fill `artifacts/test-evidence/TEST_REPORT.md` with the final run output and browser evidence.
- [ ] Keyboard focus and contrast pass on the pending card, matrix, and console.
- [ ] Replace the README template text on any remaining generated files.

## P2 — nice to have

- [ ] Export the owner brief as plain text from the interface.
- [ ] Filter chips for the timeline (agent / human / system).
- [ ] A "what would it take" panel that surfaces `civicbid_simulate_company_change` results for a person.
- [ ] Origin-trial token for Chrome so the flag is not required.
- [ ] Additional synthetic opportunities and sectors.
