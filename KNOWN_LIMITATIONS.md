# Known limitations — CivicBid Studio

Honest list, as of September 3, 2026.

## By design

- **No language model in the page.** The agent is the browser's agent (ChatGPT or Chrome). The page itself contains no model, no API key, and makes no network calls. The owner brief, the rationale text, and the timeline narration are deterministic templates filled from state.
- **Synthetic data.** Three fictional opportunities, one fictional company, fictional agencies and roles. Rules are simplified versions of real procurement requirements and are not procurement, legal, bonding, or investment advice.
- **Single user, single browser.** State lives in `localStorage` under one key. There is no backend, no login, and no sharing between browsers or people. Two tabs on the same origin share the store but do not synchronise live.
- **Frozen demo date.** Days to deadline are measured from September 3, 2026 so the judge prompt is repeatable. The header shows the demo date.
- **Deterministic scoring.** Weights, gates, and point values are fixed and documented; they are a demonstration model, not a calibrated industry model.

## Platform

- **WebMCP works only in supported browsers.** The ChatGPT desktop app's built-in browser with GPT-5.6 Sol or Terra (Luna has site tools disabled), or Chrome 149+ with `chrome://flags/#enable-webmcp-testing`. Everywhere else the page shows a fallback banner; the Tool Console still runs the same handlers but is not WebMCP.
- **Annotations are limited to `readOnlyHint`.** `destructiveHint` is not in the current type definitions, so the reset tool relies on a confirmation string.
- **`civicbid_compare_opportunities` is annotated read-only** because it changes no business data, but it does switch the visible panel to the comparison and records an activity event. The description says so.
- **GitHub Pages path base.** The build assumes `/civicbid-studio/`. Hosting elsewhere needs `VITE_BASE` set at build time.
- **Top-level document only.** Tools registered inside iframes are not exposed by the platforms; the app registers from the top-level page.

## What has and has not been verified in a browser

- **Verified:** Chrome 152 on Windows with WebMCP enabled, driven by Playwright against the production URL. `document.modelContext.getTools()` returned all thirteen tools; the entire three-prompt sequence was executed through `document.modelContext.executeTool()`; the two human steps were real clicks; persistence across refresh, re-registration after refresh, reset, and the absence of console errors were checked. Evidence: `artifacts/test-evidence/webmcp-production-evidence.json`.
- **Not yet verified by a person:** the ChatGPT desktop app's built-in browser with GPT-5.6 Sol or Terra. The tool contracts follow the published ChatGPT site-tools guidance (top-level registration, JSON Schema inputs, plain-object results), but a live ChatGPT session has not been run by the owner at the time of writing.
- **The produced demo video** shows the site tools executing through Chrome's WebMCP API under a script, with real human clicks, not a ChatGPT conversation. It is an honest recording of the implementation; a ChatGPT re-recording would be stronger and the script for it is in `DEMO_SCRIPT.md`.

## Open items

- **Activity log capped at 400 events.** Older events fall off; the state version keeps counting. Fine for a demo, not for a long-running workspace.
- **No undo.** Every write is a new version; there is no command to revert one. Reset restores the seed.
- **Owner brief trimming is mechanical.** Within the word budget, lower-priority sections lose lines first and, as a last resort, the longest line is shortened with an ellipsis. Emphasis protects sections from trimming but cannot add words back.
