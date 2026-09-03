# Build brief — CivicBid Studio (public version)

The brief the team built against, with private references removed. Companion documents: `DELTA.md` (what changed from the original plan and why) and `RULES_VERIFICATION.md` (what the challenge rules require, checked against official sources).

## Goal

Win a place among the ten winners of the OpenAI WebMCP Challenge with a working, honest demonstration of a person and a browser agent sharing one stateful decision workspace, where the page declares what the agent may do and reserves the decision for the person.

## Product

CivicBid Studio: a public-infrastructure bid room. A small contractor evaluates three synthetic opportunities, uncovers disqualification risks, assigns compliance work, registers risks, stages a bid/no-bid recommendation, and produces an executive owner brief. The human is the only actor who can approve or reject.

## Scope

### P0 — must ship

- Thirteen site tools registered at page level with `document.modelContext.registerTool`; read tools annotated `readOnlyHint`.
- A single reducer with provenance on every command; approval, rejection, and profile edits accepted only from the human interface.
- A deterministic evaluation engine: six weighted dimensions, gate rules, a Conditional GO cap, plain-English rationale and score drivers.
- The three-opportunity synthetic seed calibrated so the judge prompt returns two opportunities, Rail wins at 78 Conditional GO, Station is a NO-GO on an unmitigable gap, and one human action (Confirm JV package) moves Rail to GO.
- A version-stamped activity timeline with actor badges, tool chips, and narrated events.
- The owner brief, generated only after human approval, naming the human change that moved the score.
- The interface: header with a live tool count, Site tools panel, Tool Console, opportunity cards and filters, editable company profile with the JV preset, workspace with scorecard, requirement matrix and risk register, pending-decision card with human-only approve/reject and a stale warning, timeline, brief panel.
- Automated tests: calibration, evaluation, reducer, brief, persistence, and the judge sequence against a fake `document.modelContext`.
- GitHub Pages deployment through GitHub Actions; MIT license; README, submission copy, demo script, judge test, QA checklist, status, decisions, test results, known limitations, submission checklist.

### P1 — should ship

- `civicbid_simulate_company_change` so the decisive human move is agent-recommended.
- `sinceStateVersion` on `civicbid_get_workspace_state` so prompt two is deterministic.
- Staleness on pending decisions, not only approved ones.
- Secret scan script and a clean history.
- Screenshots and the video.

### P2 — nice to have

- Brief export, timeline filters, a "what would it take" panel, an origin-trial token for Chrome, more synthetic opportunities.

## Judging criteria (equally weighted)

- **WebMCP Leverage** — the tools are the product; discovery is read back from the browser; results carry verification; the human boundary is expressed by what is not a tool.
- **Execution** — deterministic, tested, deployed, documented; the console lets anyone exercise every tool.
- **Potential Impact** — bid/no-bid and compliance triage are real, recurring, high-stakes work in public procurement.
- **Creativity and Ambition** — shared control with an audit trail both sides write to, and an agent that recommends a human move, rereads it, and revises.

## Synthetic data

- **Company:** Atlas Civic Infrastructure, LLC — DBE-certified; 8 years of rail work; 4 comparable rail projects; $25M single-project bonding, $60M aggregate; no confirmed JV partner ($25M combined until confirmed); 2 available project managers at 82% backlog; acceptable safety record; 0 accessibility-station projects; 1 completed housing development.
- **Rail Fastener Renewal Program** — North River Transit Authority, $28M, bids due September 29, 2026, high strategic fit. Ten mandatory requirements including a $30M bonding minimum (mitigable through a JV), five years of rail experience and three comparable projects (unmitigable, both met), a named project manager (at risk on backlog), a safety plan, a 20% DBE plan, the JV approval package, addenda acknowledgment, baseline schedule, bid bond.
- **Station Accessibility Modernization** — Central Metro Works, $42M, due September 23, 2026, medium fit. Nine requirements including a $50M bonding minimum and three completed accessibility-station projects (unmitigable; the company has none).
- **Senior Housing Preservation Development** — Commonwealth Housing Partnership, $18M, due October 17, 2026, medium fit. Eight requirements; excluded by the $20M filter.
- **JV preset:** partner confirmed, $60M combined bonding.
- **Demo date:** September 3, 2026, frozen.

All names, agencies, numbers, and documents are fictional. Locations are labelled fictional in the seed.

## Demo

Three prompts and two clicks (see `JUDGE_TEST.md`): the agent triages and stages a Conditional GO; the person confirms the JV package; the agent rereads exactly what changed and revises to GO; the person approves; the agent generates the owner brief. The video (`DEMO_SCRIPT.md`) runs 2:45 and shows the browser's own tool registry, the timeline, the human-only approval, and the brief.

## Boundaries

- Standalone repository; no private references.
- Synthetic data only; no secrets; no network calls; no model API.
- Human-only approval; no brief before approval.
- One domain layer; tools never touch the DOM.
- No fabricated evidence: a capability is complete only when it runs in the deployed app.
- MIT license; not advice.
