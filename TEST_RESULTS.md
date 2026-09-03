# Test results — CivicBid Studio

Only results observed in a real run are recorded here. Anything not yet run says so. Times are Eastern, September 3, 2026.

## Typecheck

- Command: `npx tsc -b`
- Result (about 1:22 AM, commit `3ac23c2`): **0 errors**, exit code 0.

## Lint

- Command: `npx oxlint`
- Result (about 1:22 AM): **exit code 0, no errors, no warnings** (the hook exports in `src/store/context.tsx` are allow-listed in `.oxlintrc.json`).

## Unit tests

- Command: `npx vitest run`
- Result (about 1:22 AM): **8 files passed, 121 tests passed, 0 failed, 0 todo.**

| File | Tests | Covers |
|---|---|---|
| `tests/calibration.test.ts` | 3 | Seed scores land in the target bands; the $20M/45-day filter returns Rail and Station; the JV preset moves Rail to GO |
| `tests/domain-evaluate.test.ts` | 33 | Filtering, ranking, every gate band, at-risk PM rule, JV package applicability, simulation does not mutate |
| `tests/domain-reducer.test.ts` | 35 | Idempotent assign and upsert, focus modes, every error code, human-only approval and profile edits, staleness, supersession, brief gating, reset, audit-only tool calls |
| `tests/domain-brief.test.ts` | 15 | Sections, word budgets at 150/260/400, canonical order, emphasis protection, human change, stale note |
| `tests/domain-persistence.test.ts` | 10 | Round trip, schema mismatch, seed refresh, toast cleared |
| `tests/webmcp-tools.test.ts` | 17 | Every tool's schema and example, valid and invalid inputs, unknown properties rejected, verification block, audit events, idempotency, stale-closure check, reset |
| `tests/human-only-approval.test.ts` | 3 | No approve/reject/profile command in `src/webmcp`; every tool run against a pending decision leaves approval null |
| `tests/demo-sequence.test.ts` | 3 | Fake `document.modelContext`: 13 registrations, discovery, the full three-prompt sequence through `executeTool`, brief blocked then allowed, reset |

Observed seed numbers: Rail 78 Conditional GO (26 days), Station 53 NO-GO (20 days, unmitigable STA-02), Housing 67 Conditional GO (44 days, $18M). After the JV preset with no agent work: Rail 83 GO, Station 62 NO-GO. After four assignments and two risks: Rail raw 83, capped 79 Conditional GO; then JV preset: Rail 87–88 GO.

## Build

- Command: `npx vite build`
- Result (about 1:22 AM): **succeeded**, exit code 0. `dist/index.html` 1.12 kB; CSS 23.86 kB (gzip 5.44 kB); JS about 347 kB (gzip about 102 kB). Base path `/civicbid-studio/`.

## Secret and private-data scan

- Command: `node scripts/scan-secrets.mjs`
- Result (about 1:22 AM): `Scanned 88 text files in the working tree and 6032 lines of git history. No secrets, private paths, personal e-mail addresses, environment files, or localhost URLs found.` Exit code 0. A second scan with a private denylist held outside the repository (real company, agency, project, and person names that must never appear) also returned clean over the working tree and full git history.
- Commit author identity is the GitHub noreply address.

## GitHub Actions

- Run for commit `3ac23c2`: https://github.com/smartjon7/civicbid-studio/actions/runs/33718887232 — **success** (typecheck, lint, tests, secret scan, build, deploy to Pages).

## Production URL

- https://smartjon7.github.io/civicbid-studio/ — HTTP 200 over HTTPS, no login, served the new bundle after the run above.
- Refresh keeps state (verified: state version 15 before and after reload). Single page, so no route 404 is possible.

## Browser and WebMCP discovery (real Chrome)

- Browser: Google Chrome 152.0.0.0 on Windows 10 (the installed system Chrome), launched by Playwright with `--enable-features=WebMCP,WebMCPTesting`, the command-line equivalent of `chrome://flags/#enable-webmcp-testing`. Viewport 1366x768.
- `typeof document.modelContext` is `object`; `registerTool`, `getTools`, and `executeTool` are functions.
- Runtime status after load: `{ supported: true, registered: true, registeredCount: 13, canExecuteViaBrowser: true, error: null }`.
- `document.modelContext.getTools()` returned 13 tools, all prefixed `civicbid_`, each with its description and `annotations.readOnlyHint` (6 read-only, 7 write). None is named approve or reject.
- After a page reload the tools re-registered and `getTools()` again returned 13.
- Evidence file: `artifacts/test-evidence/webmcp-production-evidence.json` (tool list, every call with input, result summary, state version, and timing; human clicks; checks).
- Harness: a Playwright script outside the repository that reads the registry with `getTools()`, executes each tool with `document.modelContext.executeTool(tool, JSON.stringify(input))`, and performs the human steps with real clicks on the interface.

## Judge demo (production, about 1:25 AM)

19 tool calls through `executeTool`, two human clicks. All 18 checks passed.

| Step | Expected | Observed | Pass |
|---|---|---|---|
| Prompt 1: list ($20M, 45 days) | Rail and Station; Housing excluded | "2 of 3 opportunities match: Rail Fastener Renewal Program (78, Conditional GO); Station Accessibility Modernization (53, NO-GO)." | yes |
| Prompt 1: compare | Rail strongest | "Rail Fastener Renewal Program is the strongest at 78 (Conditional GO); Station Accessibility Modernization 53 (NO-GO)." | yes |
| Prompt 1: open, context, requirements, focus | Workspace on Rail; five rows focused | Opened at v3; focus at v4 highlighted RAIL-01, RAIL-07, RAIL-04, RAIL-05, RAIL-09 | yes |
| Prompt 1: assign x4, repeat one | Assignments recorded; repeat is a no-op | v5–v8; repeat returned "Already assigned exactly this way" with no change | yes |
| Prompt 1: two risks | Register updated | v9, v10 | yes |
| Prompt 1: stage | Conditional GO pending | v11, decisionStatus pending, "human approval is still required" | yes |
| Brief before approval (negative) | DECISION_NOT_APPROVED | "Human approval is still required. The owner brief can only be generated from an approved decision." | yes |
| Human: Confirm JV package (click) | Profile updated, version bumps | v12 | yes |
| Prompt 2: reread since v11 | One human event with delta | "Since version 11: the human confirmed the JV package; Rail Fastener Renewal Program moved 79 to 87 (Conditional GO to GO)."; gapsClosed RAIL-01 | yes |
| Prompt 2: re-stage GO | Pending, supersedes first | v13, supersedesDecisionId set, decisionStatus pending | yes |
| Human: Approve (click, confirm dialog) | Approved by human | v14, approval status approved | yes |
| Prompt 3: brief | Generated, within 260 words | "Owner Brief — Rail Fastener Renewal Program — GO" (253 words) at v15 | yes |
| Refresh | State persists; tools re-register | v15 → v15; 13 tools | yes |
| Reset via tool | Seed restored, welcome panel | v16, selectedOpportunityId null, visiblePanel welcome | yes |
| Console | No errors | 0 console errors, 0 page errors | yes |

## Unsupported-browser fallback

- Chrome without the WebMCP feature (the owner's own Chrome 152 profile, checked through the browser extension): `typeof document.modelContext` is `undefined`; the app shows the fallback badge and banner. The Tool Console lists all 13 tools and runs them through the same handlers (screenshot `artifacts/screenshots/08-tool-console.png`).

## ChatGPT desktop app

- Pending Jonathan: open the production URL in the ChatGPT desktop app's built-in browser with GPT-5.6 Sol or Terra, confirm "Site tools ready · 13 registered" and the Site tools menu, and run the three prompts from JUDGE_TEST.md.

## Demo video

- `CivicBid-Studio-WebMCP-demo.mp4` was rendered from the production URL in Chrome 152 with WebMCP enabled: every tool call through `executeTool`, human steps as real clicks, neural text-to-speech narration from DEMO_SCRIPT.md, muxed with ffmpeg. Runtime 2:29, under the three-minute rule. Attached to the GitHub release `v1.0.0-submission`.
