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
- **GitHub Pages path base.** The build assumes `/civicbid-studio/`. Hosting elsewhere needs `VITE_BASE` set at build time.
- **Top-level document only.** Tools registered inside iframes are not exposed by the platforms; the app registers from the top-level page.

## To be confirmed by the owner

- End-to-end runs in the ChatGPT desktop app and in Chrome 149+ are pending the owner's own testing. Domain behaviour is proven by automated tests; browser discovery and the three-prompt sequence need a person in a supported browser.
- Video and screenshots are pending.

## Open items

- **Owner brief word budget can overrun on a rich workspace.** Once every section is trimmed to one line, the last-resort step shortens the single longest line only once. With four assignments, three risks, two human profile changes, and a superseded decision, a 150-word budget produced 170 words; 260 and 400 held. A patch that repeats the last-resort trim until the budget is met is recorded in TEST_RESULTS.md; `tests/domain-brief.test.ts` carries a todo for the guarantee.
- **Activity log capped at 400 events.** Older events fall off; the state version keeps counting. Fine for a demo, not for a long-running workspace.
- **No undo.** Every write is a new version; there is no command to revert one. Reset restores the seed.
