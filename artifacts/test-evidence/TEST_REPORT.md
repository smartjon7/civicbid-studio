# Test report — CivicBid Studio

Evidence for the submission commit. Fill each section from a real run; paste output verbatim. Do not summarise a run that did not happen.

## Submission commit

- Commit: pending
- Branch: `main`
- Date and time (Eastern): pending

## Environment

- Node: 24.18.0
- npm: 11.17.0
- OS: Windows 10
- Browsers used: pending (ChatGPT desktop app version and model; Chrome version)

## Typecheck

```
$ npx tsc -b
(paste output)
```

Result: pending

## Lint

```
$ npx oxlint
(paste output)
```

Result: pending

## Unit tests

```
$ npx vitest run
(paste output)
```

Result: pending. Last local run on the integrated tree (September 3, 2026, about 1:05 AM Eastern): 8 files, 120 passed, 1 todo, 0 failed.

## Build

```
$ npx vite build
(paste output, including asset sizes)
```

Result: pending

## Secret scan

```
$ node scripts/scan-secrets.mjs
(paste output)
```

Result: pending. Last local run: 88 text files, 6032 history lines, no findings, exit 0.

## GitHub Actions

- Run URL: pending
- Jobs: build (typecheck, lint, test, build) and deploy
- Result: pending

## Production URL

- URL: https://smartjon7.github.io/civicbid-studio/
- Loads over HTTPS without login: pending
- Footer not-advice statement visible: pending
- Header badge reads "Site tools ready · 13 registered": pending

## WebMCP discovery

| Browser | Tools reported by `getTools()` | Site tools panel count | Notes |
|---|---|---|---|
| ChatGPT desktop app (model: ) | | | |
| Chrome 149+ with flag | | | |
| Unsupported browser (fallback) | n/a | banner shown? | Tool Console works? |

## Judge sequence

| Step | Expected | Observed | Pass |
|---|---|---|---|
| Prompt 1: list | Rail and Station returned; Housing excluded | | |
| Prompt 1: compare | Rail first at 78 Conditional GO; Station 53 NO-GO | | |
| Prompt 1: open, focus, assign, risks | Workspace shows focused rows, assignments, risks | | |
| Prompt 1: stage | Conditional GO pending; no approval | | |
| Human: Confirm JV package | Profile updated; pending card stale; human event with delta | | |
| Prompt 2: reread | Exactly one human event reported with before/after | | |
| Prompt 2: re-stage | GO pending; "revised from Conditional GO" | | |
| Human: Approve | Approved by human at version N | | |
| Prompt 3: brief before approval (negative) | DECISION_NOT_APPROVED | | |
| Prompt 3: brief | All sections; human change named; audit summary | | |
| Agent asked to approve (negative) | HUMAN_ONLY_ACTION | | |
| Reset | Seed restored; version continues | | |

## Screenshots

See `artifacts/screenshots/README.md`. List the files captured and the commit they show.

## Sign-off

- Lead: pending
- Owner: pending
