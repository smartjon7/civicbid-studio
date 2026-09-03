# Submission checklist — CivicBid Studio

Deadline: **September 3, 2026, 1:00 PM PDT / 4:00 PM Eastern.** Availability required through **September 21, 2026, 5:00 PM PDT.** Owner column: **lead** (engineering lead in this repository) or **Jonathan** (account holder; Devpost, YouTube, ChatGPT desktop testing).

## Rules items

| Item | Rule source | Owner | Status |
|---|---|---|---|
| Working live URL accessible in the ChatGPT in-app browser or Chrome with WebMCP enabled | Devpost rules | lead | pending verification |
| Hosted on an acceptable static provider (GitHub Pages, HTTPS, no login) | Devpost rules | lead | workflow in place |
| Remains available free of charge through September 21, 2026 | Devpost rules | Jonathan | keep the repository and Pages public |
| Public repository on GitHub | Devpost rules | Jonathan | done |
| Open-source license file detectable at the top of the repository page | Devpost rules | lead | LICENSE (MIT) at root |
| All source code, assets, and functional instructions in the repository | Devpost rules | lead | README local setup and browser requirements |
| Text description: why WebMCP fits, user-experience improvement, what humans and agents can now do together, implementation | Devpost rules | Jonathan (copy in SUBMISSION.md) | copy ready |
| Video under three minutes, with audio, public on YouTube, no third-party marks | Devpost rules | Jonathan (script in DEMO_SCRIPT.md) | to record |
| Project newly created during the submission period; commits dated | Devpost rules | lead | repository created September 3, 2026 |
| Tools registered at page level with `document.modelContext.registerTool` | Challenge page | lead | in `src/main.tsx` |
| Tested in ChatGPT's in-app browser (GPT-5.6 Sol or Terra) | Challenge page | Jonathan | to confirm |
| Tested in Chrome 149+ with `chrome://flags/#enable-webmcp-testing` | Challenge page | lead | to confirm |

## Devpost form fields

| Field | Source | Owner | Status |
|---|---|---|---|
| Project title | SUBMISSION.md | Jonathan | ready |
| Tagline | SUBMISSION.md | Jonathan | ready |
| Description (all four required points) | SUBMISSION.md | Jonathan | ready |
| Built with | Vite, React, TypeScript, WebMCP | Jonathan | ready |
| Repository link | https://github.com/smartjon7/civicbid-studio | Jonathan | ready |
| Live application link | https://smartjon7.github.io/civicbid-studio/ | Jonathan | pending lead verification |
| Video link | YouTube | Jonathan | to add |
| Images | `artifacts/screenshots/01..09` | lead captures, Jonathan uploads | to capture |

## Repository readiness

| Item | Owner | Status |
|---|---|---|
| `npm run typecheck` green | lead | 0 errors locally at about 1:05 AM Eastern; rerun on the submission commit |
| `npm run lint` green (warnings acceptable, no errors) | lead | exit 0 locally at about 1:05 AM Eastern (4 advisory warnings); rerun on the submission commit |
| `npm test` green | lead | 8 files, 120 passed, 1 todo locally at about 1:05 AM Eastern; rerun on the submission commit |
| `npm run build` green | lead | succeeded locally at about 1:05 AM Eastern; rerun on the submission commit |
| `node scripts/scan-secrets.mjs` exit 0 | lead | clean at about 1:00 AM Eastern; rerun on the submission commit |
| GitHub Actions run green on the submission commit | lead | pending |
| README hero screenshot present | lead | to capture |
| STATUS.md, TEST_RESULTS.md, KNOWN_LIMITATIONS.md current | lead | current as of this lane |
| Footer carries the not-advice statement | UI lane | pending verification |
| No real names, companies, agencies, or private references anywhere | lead | scan clean; manual read pending |

## Final hour (owner runs in order)

1. Pull `main`, run `npm run check` and `node scripts/scan-secrets.mjs`.
2. Open the live URL in the ChatGPT desktop browser; confirm 13 registered; run the three prompts.
3. Capture screenshots 01–09; add `01-workspace.png` for the README.
4. Record the video per DEMO_SCRIPT.md; upload to YouTube as public; paste the link into README.md and SUBMISSION.md; push.
5. Submit the Devpost form; keep a copy of the confirmation.
6. Do not touch the repository or Pages until judging ends on September 21, 2026.
