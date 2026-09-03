# DELTA — Material improvements to the CivicBid Studio handover

Prepared September 3, 2026, 12:20 AM Eastern, before implementation began. Each item names the judging category it improves. Everything else in the handover is being executed as written.

The handover's concept, product name, tool prefix, deterministic scoring model, three-opportunity demo, human-only approval, and three-prompt judge sequence are unchanged.

## 1. Show the browser's own tool registry, not a hard-coded count

After registration the app calls `document.modelContext.getTools()` (verified in the WebMCP type definitions and Chrome documentation) and renders the real list in a "Site tools" panel with read/write badges. The header count comes from the browser, so the video shows discovery working rather than a label claiming it.

Improves: **WebMCP Leverage**, **Execution**.

## 2. A built-in Tool Console that runs the same registered handlers

A panel lets anyone pick a tool, edit its JSON input, and run it through the identical handler the browser agent calls. When the browser supports `executeTool` the console routes through the browser; otherwise it calls the local handler map. Every console run is logged as "Agent via tool console". Judges in a browser without WebMCP can still exercise every tool, and the lead engineer can test all tools end to end in an ordinary browser. It is labelled plainly as a testing aid, never presented as WebMCP itself.

Improves: **Execution**.

## 3. A what-if tool: `civicbid_simulate_company_change` (read-only)

The agent can ask "what happens to the evaluation if the JV partner is confirmed with $60M combined bonding?" without writing anything, then recommend that the human make the change. This turns the demo's decisive human intervention into an agent-recommended, human-executed move, which is the cleanest possible illustration of shared control.

Improves: **Creativity and Ambition**, **WebMCP Leverage**.

## 4. `sinceStateVersion` on `civicbid_get_workspace_state`

The agent passes the last state version it saw and receives exactly the human and system events since then, each with before-and-after scores and recommendation. Prompt two ("tell me exactly what changed") becomes deterministic, and the audit log proves the agent reread the human edit.

Improves: **WebMCP Leverage**, **Execution**.

## 5. Staleness applies to pending recommendations, not only approved ones

The handover flags a stale decision only after approval. In the demo the profile changes while the recommendation is *pending*. The pending card now flags "Company profile changed since this was staged — reevaluate", and a re-staged decision records which decision it supersedes so the log narrates "revised Conditional GO to GO".

Improves: **Execution**.

## 6. Data-driven requirement checks

Each mandatory requirement carries a machine-readable rule evaluated against the live company profile (minimum bonding, rail years, comparable projects, project-manager availability, safety record, and so on). Requirement status, gate results, dimension scores, and the recommendation all derive from one function. A human edit cannot desynchronise the matrix from the score, and tools and UI share the logic by construction.

Improves: **Execution**, **WebMCP Leverage**.

## 7. Frozen demo date

Days-to-deadline are computed from a fixed anchor of September 3, 2026, shown in the header as "Demo date". The judge prompt ("closing within 45 days, over $20 million") returns the same two opportunities through the September 21 judging window regardless of the real clock.

Improves: **Execution**.

## 8. The judge sequence as an automated test

A test installs a fake `document.modelContext`, registers the real tools, and runs the exact three-prompt tool sequence: filter, compare, open, list requirements, focus, assign, add risks, stage; human JV preset; reread and restage; human approval; brief. It asserts that Rail wins, no tool can approve, the brief is blocked before approval and succeeds after, and reset restores the seed. It runs on every push.

Improves: **Execution**.

## 9. GitHub Pages through GitHub Actions as the deployment

GitHub is the only pre-authenticated provider in this environment. A workflow builds on every push to `main` and publishes to Pages over HTTPS with no login. This is a change to the handover's provider order (Vercel first), chosen because it can be completed and verified now without a credential from Jonathan.

Improves: **Execution**.

## 10. Version-stamped, narrated activity log

Every event records actor, channel (WebMCP, tool console, UI, system), the tool or action name, the state version before and after, the fields changed, and a one-sentence plain-English narration. The owner brief's audit summary is generated from this log, so the decision document and the trail behind it cannot disagree.

Improves: **WebMCP Leverage**, **Execution**.

## Considered and not adopted

- **Pivoting the concept.** Nothing available within the window uses WebMCP more meaningfully than a shared, stateful decision workspace with a human-only approval gate.
- **Merging `civicbid_get_context` and `civicbid_get_workspace_state`.** They overlap, but the second carries the version-delta contract that prompt two depends on. Descriptions are sharpened instead.
- **Adding a profile-editing tool.** The company profile stays human-editable only; that boundary is part of the story.
- **A `destructiveHint` annotation on reset.** Only `readOnlyHint` and `untrustedContentHint` are in the current type definitions, so reset uses the confirmation string alone.
