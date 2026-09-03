# AGENTS.md — Boundaries for every agent working in this repository

These rules survive context compaction and multi-agent work. Read them before editing anything.

## Product

CivicBid Studio is a synthetic demonstration built for the OpenAI WebMCP Challenge: a shared public-infrastructure bid room where a person and a browser agent evaluate opportunities, uncover disqualification risks, coordinate compliance work, and stage auditable bid decisions. The human is the only actor who can approve or reject a decision.

## Non-negotiable boundaries

1. **Standalone project.** This repository is self-contained. Do not read from, write to, copy from, or reference any private repository, vault, note system, or workspace belonging to the owner.
2. **Synthetic data only.** Every company, agency, opportunity, person, role, email address, number, and document in this repository is fictional. Do not add real companies, clients, employees, partners, projects, finances, or disputes.
3. **No secrets.** Never commit tokens, keys, `.env` files, cookies, browser profiles, account exports, or screenshots containing private tabs or identities.
4. **No external calls at runtime.** The app makes no network requests, uses no LLM API, and needs no backend or login.
5. **Human-only approval.** There is no WebMCP tool, console command, URL parameter, or hidden path that approves or rejects a decision. The approve and reject commands are accepted only from the human UI channel. Do not add one.
6. **No owner brief before approval.** `civicbid_generate_owner_brief` must fail with `DECISION_NOT_APPROVED` until a human has approved the current staged decision.
7. **One domain layer.** UI controls and WebMCP tools dispatch the same commands through the same reducer. Tools never manipulate the DOM directly and never duplicate business logic.
8. **Do not fake evidence.** Never fabricate tool calls, activity events, test output, or production results. A capability is complete only when it runs in the deployed app.
9. **MIT license.** Keep `LICENSE` at the repository root.
10. **Not advice.** The app is a demonstration, not procurement, legal, bonding, or investment advice, and says so in its footer.

## Working agreements

- Keep `STATUS.md`, `DECISIONS.md`, `TEST_RESULTS.md`, `KNOWN_LIMITATIONS.md`, `DEMO_SCRIPT.md`, and `SUBMISSION_CHECKLIST.md` current.
- Small, truthful commits. Do not rewrite history after the repository is public.
- Two agents never edit the same file at the same time. The lead integrates and tests all work.
- Prefer simple, inspectable code over abstraction.
- Windows-friendly paths and scripts; no shell-specific tricks in `package.json`.
