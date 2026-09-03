# Devpost submission — CivicBid Studio

## Project title

CivicBid Studio

## Tagline

A shared bid room where a browser agent does the compliance work and a person makes the call.

## Concise description

CivicBid Studio is a public-infrastructure bid room built on WebMCP. A small contractor is looking at three synthetic opportunities — a $28M rail fastener renewal, a $42M station accessibility program, and an $18M senior-housing preservation project — and has to decide what to bid before the deadlines close.

The page registers thirteen site tools. Through them the agent filters the opportunities by value and deadline, compares them, opens the strongest one, reads every mandatory requirement with its live pass/gap/at-risk status, focuses the ones a person should look at, assigns owners and due dates, registers risks, and stages a bid/no-bid recommendation. It cannot approve. Approve, Reject, and the company-profile controls exist only as buttons in the interface, and the reducer refuses those commands from any other channel.

The demo turns on one human action. Rail scores 78, Conditional GO: single-project bonding is $5M short of the $30M minimum. The agent can simulate confirming a joint-venture partner and recommend it. The person clicks Confirm JV package. The agent rereads the workspace with `sinceStateVersion`, receives the one human event with before-and-after scores, and revises the recommendation to GO. The person approves. Only then does `civicbid_generate_owner_brief` produce an executive brief that names the decision, the conditions, the owners, the top disqualification risks, the human change that moved the score, and the next 24 hours — with an audit summary generated from the same timeline the judges can see on screen.

Everything is deterministic, synthetic, and local. There is no backend, no login, no network call, and no language-model API in the page.

## Why WebMCP is a strong fit

- **The page can say what the agent may do — and what it may not.** Thirteen tools are exposed. Approval, rejection, and profile edits are not. That boundary is the product.
- **Tools return verification, not just data.** Every result carries the state version, the fields changed, the activity event id, the selected opportunity, the visible panel, the focused requirement ids, and the decision status. The agent can confirm the outcome of every call.
- **The agent and the person share one state.** `civicbid_get_workspace_state` with `sinceStateVersion` returns exactly the human events since the agent last looked, each with before-and-after scores. Rereading a human edit is a first-class tool call, not a scrape.
- **Discovery is real.** The header count and the Site tools panel are read back from `document.modelContext.getTools()`, so the demo shows the browser's own registry rather than a label.
- **One write path.** Buttons and tools dispatch the same commands through the same reducer. A tool cannot desynchronise the interface from the score because it never touches the DOM.

## Better user experience

Before, a bid manager reads the solicitation, builds a compliance matrix by hand, and keeps the rationale in email. Here the agent does that in seconds against live rules, highlights the items that deserve attention, and leaves the decision where it belongs. The person sees the score move when they change one fact about their company, sees the agent notice and revise, and gets an owner brief that cites the change. The timeline shows who did what, through which channel, at which version.

## What was difficult before

Without WebMCP an agent has to guess at a page — click by label, scrape state, and hope nothing moved. It has no honest way to know what it changed, and the page has no way to reserve an action for a person. Sharing a stateful decision workspace between a person and an agent, with a human-only approval gate and an audit trail both sides write to, was not something a page could express.

## Implementation

- Vite 8, React 19, TypeScript 6. No runtime dependencies beyond React.
- `document.modelContext.registerTool` for all thirteen tools from the top-level document, once, with `readOnlyHint` on the read tools.
- A single reducer with provenance on every command; `HUMAN_ONLY_ACTION` returned to any non-human attempt at approval, rejection, or profile edits.
- A deterministic evaluation engine: six weighted dimensions (compliance 30, experience 20, capacity 20, readiness 15, strategic fit 10, risk readiness 5) and gate rules — any unmitigable mandatory failure is NO-GO; a mitigable capability gap caps the score at 79 and yields Conditional GO; otherwise 80+ is GO, 65–79 Conditional GO, below 65 NO-GO.
- A version-stamped activity log; read-only tool calls are logged without changing the version.
- A Tool Console that runs the same handlers, so the workflow can be exercised in any browser and tested end to end.
- Vitest domain tests for evaluation, the reducer, the brief, and persistence, plus a calibration test that pins the seed scores. GitHub Actions runs typecheck, lint, tests, and build on every push and deploys to GitHub Pages.

## Built during the challenge

The repository was created on September 3, 2026 during the submission period. All commits are dated. Nothing existed before the challenge.

## Links

- Live application: https://smartjon7.github.io/civicbid-studio/
- Repository (MIT): https://github.com/smartjon7/civicbid-studio

## Video

To be added (YouTube, under three minutes, with narration).
