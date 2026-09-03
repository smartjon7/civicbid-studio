# Test results — CivicBid Studio

Only results observed in a real run are recorded here. Anything not yet run says so.

## Typecheck

- Command: `npx tsc -b`
- Result (September 3, 2026, about 1:05 AM Eastern, integrated tree): **0 errors** (`grep -c "error TS"` on the output returned 0).

## Lint

- Command: `npx oxlint`
- Result (September 3, 2026, about 1:05 AM Eastern): **exit code 0, no errors.** Four `react/only-export-components` warnings in `src/store/context.tsx` (fast-refresh advisory only, not a failure).

## Unit tests

- Command: `npx vitest run` (whole suite)
- Result (September 3, 2026, about 1:05 AM Eastern): **8 files passed, 120 tests passed, 1 todo, 0 failed.** Duration about 8.5 seconds. The three additional files (`tests/demo-sequence.test.ts`, `tests/human-only-approval.test.ts`, `tests/webmcp-tools.test.ts`) belong to the runtime lane and cover the judge sequence through a fake `document.modelContext`, the human-only boundary, the tool definitions, the validator, the envelope, idempotent writes, stale closures, and reset.

- Command: `npx vitest run tests/domain-evaluate.test.ts tests/domain-reducer.test.ts tests/domain-brief.test.ts tests/domain-persistence.test.ts tests/calibration.test.ts`
- Result (September 3, 2026, about 1:00 AM Eastern): **5 files passed, 95 tests passed, 1 todo, 0 failed.** Duration about 6 seconds.

| File | Tests | Result |
|---|---|---|
| `tests/calibration.test.ts` | 3 | passed |
| `tests/domain-evaluate.test.ts` | 33 | passed |
| `tests/domain-reducer.test.ts` | 35 | passed |
| `tests/domain-brief.test.ts` | 14 passed, 1 todo | passed |
| `tests/domain-persistence.test.ts` | 10 | passed |

Observed seed numbers (from the calibration and evaluation tests): Rail 78 Conditional GO (26 days), Station 53 NO-GO (20 days, unmitigable STA-02), Housing 67 Conditional GO (44 days, $18M). After the JV preset with no agent work: Rail 83 GO, Station 62 NO-GO. After four assignments and two risks: Rail raw 83, capped 79 Conditional GO; then JV preset: Rail 88 GO.

### Open finding from the tests

`tests/domain-brief.test.ts` — the 150-word budget is not guaranteed on a rich workspace. Observed: 170 words for a 150 budget on the fixture (four assignments, three risks, superseded decision, two human profile events). 260 and 400 held. The test carries `it.todo(...)` for the guarantee and a passing test for current behaviour. Cause: in `src/domain/ownerBrief.ts` the last-resort trim shortens the single longest line once. Proposed patch (replace the `if (out.words > options.maximumWords) { ... }` block after the line-popping loop):

```ts
  // Last resort: shorten the longest remaining line, repeatedly, until within budget.
  guard = 0;
  while (out.words > options.maximumWords && guard++ < 50) {
    const longest = ordered.reduce((best, s) => (countWords(s.lines.join(' ')) > countWords(best.lines.join(' ')) ? s : best), ordered[0]);
    const words = longest.lines.join(' ').split(/\s+/).filter((w) => w.length > 0);
    if (words.length <= 6) break;
    const keep = Math.max(6, words.length - (out.words - options.maximumWords) - 1);
    longest.lines = [words.slice(0, keep).join(' ') + '…'];
    out = render();
  }
```

## Build

- Command: `npx vite build`
- Result (September 3, 2026, about 1:05 AM Eastern): **succeeded**, exit code 0. 61 modules transformed; `dist/index.html` 1.12 kB, `dist/assets/index-*.css` 23.86 kB (gzip 5.44 kB), `dist/assets/index-*.js` 346.98 kB (gzip 102.41 kB); built in about 0.6 s. Base path `/civicbid-studio/`.

## Browser

- ChatGPT desktop app (GPT-5.6 Sol or Terra): pending Jonathan.
- Chrome 149+ with `chrome://flags/#enable-webmcp-testing`: pending lead.
- Unsupported browser fallback banner and Tool Console: pending lead.

## WebMCP discovery

- Expected: header badge **Site tools ready · 13 registered**, read back from `document.modelContext.getTools()`; Site tools panel lists thirteen tools with read/write badges.
- Result: pending lead.

## Judge demo

- Three prompts and two human clicks per JUDGE_TEST.md.
- Result: pending lead (domain sequence proven in tests; browser run not yet performed).

## Production URL

- https://smartjon7.github.io/civicbid-studio/
- Result: pending lead (workflow present; deployment of the full workspace not yet verified).

## Secret scan

- Command: `node scripts/scan-secrets.mjs`
- Result (September 3, 2026, about 1:00 AM Eastern, after the documentation was added): `Scanned 88 text files in the working tree and 6032 lines of git history. No secrets, private paths, personal e-mail addresses, environment files, or localhost URLs found.` Exit code 0.
- Detection check: a throwaway probe file with fake AWS, GitHub, sk-, Slack, private-key, e-mail, Windows and POSIX user paths, private-tooling words, a `.env.probe` file, and a `localhost` URL under `src/` produced 13 findings and exit code 1; the probe files were removed and the scan returned to exit 0.
