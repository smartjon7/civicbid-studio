# Submission checklist — CivicBid Studio

Deadline: **September 3, 2026, 1:00 PM PDT / 4:00 PM Eastern.** Availability required through **September 21, 2026, 5:00 PM PDT.** Owner column: **lead** (engineering lead in this repository) or **Jonathan** (account holder; Devpost, YouTube, ChatGPT desktop testing).

## Rules items

| Item | Rule source | Owner | Status |
|---|---|---|---|
| Working live URL accessible in the ChatGPT in-app browser or Chrome with WebMCP enabled | Devpost rules | lead | done — verified in Chrome 152 with WebMCP enabled (TEST_RESULTS.md) |
| Hosted on an acceptable static provider (GitHub Pages, HTTPS, no login) | Devpost rules | lead | done |
| Remains available free of charge through September 21, 2026 | Devpost rules | Jonathan | keep the repository and Pages public; do not push to `main` |
| Public repository on GitHub | Devpost rules | lead | done |
| Open-source license file detectable at the top of the repository page | Devpost rules | lead | done — GitHub reports MIT |
| All source code, assets, and functional instructions in the repository | Devpost rules | lead | done — README local setup and browser requirements |
| Text description: why WebMCP fits, user-experience improvement, what humans and agents can now do together, implementation | Devpost rules | Jonathan (copy in SUBMISSION.md) | copy ready |
| Video under three minutes, with audio, public on YouTube, no third-party marks | Devpost rules | Jonathan | file rendered by the lead; upload pending |
| Project newly created during the submission period; commits dated | Devpost rules | lead | done — repository created September 3, 2026 |
| Tools registered at page level with `document.modelContext.registerTool` | Challenge page | lead | done — `src/main.tsx` |
| Tested in ChatGPT's in-app browser (GPT-5.6 Sol or Terra) | Challenge page | Jonathan | to confirm |
| Tested in Chrome 149+ with WebMCP enabled | Challenge page | lead | done — Chrome 152, 13 tools discovered, full sequence executed |

## Devpost form fields

| Field | Source | Owner | Status |
|---|---|---|---|
| Project title | SUBMISSION.md | Jonathan | ready |
| Tagline | SUBMISSION.md | Jonathan | ready |
| Description (all four required points) | SUBMISSION.md | Jonathan | ready |
| Built with | Vite, React, TypeScript, WebMCP | Jonathan | ready |
| Repository link | https://github.com/smartjon7/civicbid-studio | Jonathan | ready |
| Live application link | https://smartjon7.github.io/civicbid-studio/ | Jonathan | ready |
| Video link | YouTube | Jonathan | to add after upload |
| Images | `artifacts/screenshots/01–10` | Jonathan uploads | captured |

## Repository readiness

| Item | Owner | Status |
|---|---|---|
| `npm run typecheck` green | lead | done, 0 errors |
| `npm run lint` green | lead | done, 0 findings |
| `npm test` green | lead | done, 121 passed |
| `npm run build` green | lead | done |
| `npm run scan:secrets` exit 0 | lead | done, plus private-denylist scan clean |
| GitHub Actions run green on the application commit | lead | done, run 33718887232 |
| README hero screenshot present | lead | done |
| STATUS.md, TEST_RESULTS.md, KNOWN_LIMITATIONS.md current | lead | done |
| Footer carries the not-advice statement | lead | done (screenshot 01-welcome) |
| No real names, companies, agencies, or private references anywhere | lead | done — both scans clean |
| Submission tag `v1.0.0-submission` | lead | done |

## Final hour (Jonathan, in order)

1. Upload `CivicBid-Studio-WebMCP-demo.mp4` to YouTube as **Public** (or re-record per DEMO_SCRIPT.md). Confirm the runtime shows under 3:00 after upload.
2. Paste the YouTube link into the Devpost form. (Optionally also into README.md and SUBMISSION.md on a `post-submission` branch; do not change `main`.)
3. Open https://smartjon7.github.io/civicbid-studio/ in the ChatGPT desktop app's browser with GPT-5.6 Sol or Terra; confirm "Site tools ready · 13 registered"; run the three prompts from JUDGE_TEST.md.
4. On Devpost: title, tagline, description from SUBMISSION.md, repository link, live link, video link, screenshots from `artifacts/screenshots`, accept the attestations, submit before 2:30 PM Eastern. Keep the confirmation.
5. Leave the repository and Pages untouched until judging ends on September 21, 2026.
