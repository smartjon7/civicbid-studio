# Test report — CivicBid Studio

Evidence for the submission. Every result below comes from a real run on September 3, 2026 (times Eastern). The machine-readable record of the production WebMCP run is `webmcp-production-evidence.json` beside this file.

## Submission commit

- Application code verified in production: `3ac23c2` on `main` (Actions run https://github.com/smartjon7/civicbid-studio/actions/runs/33718887232, success).
- Submission tag: `v1.0.0-submission` (documentation, screenshots, and evidence added on top of `3ac23c2`; no application code changed after the production run).

## Environment

- Node 24.18.0, npm 11.17.0, Windows 10.
- Browser for the WebMCP run: Google Chrome 152.0.0.0 (installed system Chrome), launched by Playwright 1.62.1 with `--enable-features=WebMCP,WebMCPTesting`, headless, viewport 1366x768. Reported user agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36`.
- Fallback check: the owner's own Chrome 152 profile without the feature, through the browser extension.

## Typecheck

```
$ npx tsc -b
(no output)
```

Result: 0 errors, exit 0.

## Lint

```
$ npx oxlint
(no findings)
```

Result: exit 0.

## Unit tests

```
$ npx vitest run
 Test Files  8 passed (8)
      Tests  121 passed (121)
```

Result: pass.

## Build

```
$ npx vite build
dist/index.html                   1.12 kB │ gzip:   0.64 kB
dist/assets/index-*.css          23.86 kB │ gzip:   5.44 kB
dist/assets/index-*.js          ~347 kB   │ gzip: ~102 kB
✓ built
```

Result: pass.

## Secret scan

```
$ node scripts/scan-secrets.mjs
Scanned 88 text files in the working tree and 6032 lines of git history.
No secrets, private paths, personal e-mail addresses, environment files, or localhost URLs found.
```

Result: exit 0. An additional private-denylist scan (kept outside the repository) over the working tree and full git history: clean.

## GitHub Actions

- Run: https://github.com/smartjon7/civicbid-studio/actions/runs/33718887232
- Jobs: build (npm ci, typecheck, lint, test, scan:secrets, build) and deploy (GitHub Pages).
- Result: success.

## Production URL

- https://smartjon7.github.io/civicbid-studio/
- Loads over HTTPS without login: yes (HTTP 200; new bundle hash served after the run above).
- Footer not-advice statement visible: yes (screenshot 01-welcome).
- Header badge reads "Site tools ready · 13 registered": yes, read back from `document.modelContext.getTools()` (screenshot 09-site-tools shows each tool marked "discovered by the browser").

## WebMCP discovery

| Browser | Tools reported by `getTools()` | Site tools panel count | Notes |
|---|---|---|---|
| ChatGPT desktop app | pending Jonathan | pending | needs his account; JUDGE_TEST.md has the steps |
| Chrome 152 with the WebMCP feature enabled | 13 | 13 | 6 read-only, 7 write; `registerTool`, `getTools`, `executeTool` all present; tools re-registered after reload |
| Chrome 152 without the feature (fallback) | n/a (`document.modelContext` undefined) | banner shown | Tool Console lists and runs all 13 through the same handlers |

## Judge sequence (production, Chrome 152, about 1:25 AM)

| Step | Expected | Observed | Pass |
|---|---|---|---|
| Prompt 1: list | Rail and Station returned; Housing excluded | 2 of 3 match: Rail (78, Conditional GO), Station (53, NO-GO) | yes |
| Prompt 1: compare | Rail first at 78 Conditional GO; Station 53 NO-GO | strongest Rail | yes |
| Prompt 1: open, focus, assign, risks | Workspace shows focused rows, assignments, risks | v3 open, v4 focus of 5 rows, v5–v8 assignments, v9–v10 risks | yes |
| Prompt 1: stage | Conditional GO pending; no approval | v11 pending | yes |
| Human: Confirm JV package | Profile updated; pending card stale; human event with delta | v12; delta 79 → 87, Conditional GO → GO, gap RAIL-01 closed | yes |
| Prompt 2: reread | Exactly one human event reported with before/after | one event since v11 with the delta above | yes |
| Prompt 2: re-stage | GO pending; supersedes the first | v13, supersedesDecisionId set | yes |
| Human: Approve | Approved by human at version N | v14 approved | yes |
| Prompt 3: brief before approval (negative) | DECISION_NOT_APPROVED | returned before the JV step with the reducer's recovery text | yes |
| Prompt 3: brief | All sections; human change named; audit summary | 253 words at v15; sections shown in screenshot 07 | yes |
| Agent asked to approve (negative) | HUMAN_ONLY_ACTION | covered by `tests/human-only-approval.test.ts` (no such tool exists to call in the browser) | yes |
| Refresh | State persists; tools re-register | v15 → v15; 13 tools | yes |
| Reset | Seed restored; version continues | v16, no selection, welcome panel | yes |
| Console | No errors | 0 console errors, 0 page errors | yes |

18 of 18 automated checks passed; 19 tool calls through `document.modelContext.executeTool`; 2 human clicks.

## Screenshots

Captured from the production URL in the run above at 1366x768: `artifacts/screenshots/01-welcome.png`, `01-workspace.png` (README hero), `02-comparison.png`, `03-workspace-focused.png`, `04-pending-approval.png`, `05-after-jv.png`, `06-approved.png`, `07-owner-brief.png`, `08-tool-console.png`, `09-site-tools.png`, `10-after-reset.png`.

## Demo video

- `CivicBid-Studio-WebMCP-demo.mp4`: rendered from the production URL in Chrome 152 with WebMCP enabled, every tool call through `executeTool`, human steps as real clicks, neural text-to-speech narration from DEMO_SCRIPT.md, muxed with ffmpeg. Runtime 2:29 (149.0 s), 1440x810, H.264 + AAC, about 20 MB, one continuous take; narration mean level −25 dB, peak −6 dB. Attached to the GitHub release `v1.0.0-submission`.

## Sign-off

- Lead: verified as above.
- Owner: pending (ChatGPT desktop run, video upload, Devpost submission).
