# Judge test — CivicBid Studio

Three prompts, two clicks, about five minutes. Everything is synthetic and deterministic; the numbers below are what the seed produces.

## Setup

1. Open **https://smartjon7.github.io/civicbid-studio/** in one of:
   - the ChatGPT desktop app's built-in browser with **GPT-5.6 Sol** or **GPT-5.6 Terra** (Luna has site tools disabled), or
   - **Google Chrome 149+** with `chrome://flags/#enable-webmcp-testing` enabled and relaunched.
2. Confirm the header reads **Site tools ready · 13 registered**. Open the **Site tools** panel to see the list the browser reports.
3. If the workspace is not empty (another session left state in this browser), click **Reset demo** in the header and confirm.
4. In any other browser you will see a fallback banner. The **Tool Console** still runs every tool through the same handlers and is a fair way to inspect the contracts, but it is not WebMCP.

## Prompt 1

> You are helping a small infrastructure contractor decide what to bid. Use this page's site tools to find opportunities worth more than $20 million that close within 45 days. Compare them, open the strongest opportunity, identify every mandatory requirement and possible disqualification risk, focus those items in the interface, assign the most important gaps to appropriate owners, and stage — but do not approve — a bid/no-bid recommendation. Explain your reasoning and stop for my review.

**Expected results**

- `civicbid_list_opportunities` returns two opportunities: **Rail Fastener Renewal Program** ($28M, 26 days, score 78, Conditional GO) and **Station Accessibility Modernization** ($42M, 20 days, score 53, NO-GO). Senior Housing ($18M) is excluded by the value filter.
- The comparison panel opens. Rail ranks first.
- The agent opens Rail. The requirement matrix shows RAIL-01 (bonding, $25M against a $30M minimum) as a mitigable gap and RAIL-04 (named project manager) as at risk because backlog utilization is 82%.
- Focused rows are highlighted in the matrix with the agent's reason.
- Assignments appear with owner roles and due dates — typically Finance & Bonding for RAIL-01, JV & Legal for RAIL-07, the Safety Director for RAIL-05, the Scheduler for RAIL-09.
- Risks appear in the register with severity, owner, and mitigation.
- The pending-decision card on the right shows **Conditional GO** with **Approve** and **Reject** buttons. The score stays at or below 79 while the bonding gap is open, even as assignments raise the raw score.
- Station is not staged as anything but NO-GO; the tool refuses a GO or Conditional GO that contradicts an unmitigable gate.

**Look at:** the timeline. Every call has an agent badge, a tool chip, and a version stamp. Read-only calls appear without a version change.

## Human action

Click **Confirm JV package** in the left rail (company profile).

**Expected results**

- The profile shows a confirmed JV partner and $60M combined bonding.
- The pending card shows the warning "Company profile changed since this was staged." with the old and new score and recommendation.
- The timeline shows a **Human** event listing the two fields changed and the score movement for Rail (Conditional GO to GO).

## Prompt 2

> Read the updated workspace state and tell me exactly what changed. Reevaluate the selected opportunity and revise the staged recommendation if the new company capacity supports it. Do not approve anything.

**Expected results**

- The agent calls `civicbid_get_workspace_state` with `sinceStateVersion` and reports the single human event with before-and-after scores and the fields changed.
- Rail now evaluates to **GO** with a score between 85 and 88 (83 if no assignments or risks were added). Station stays NO-GO.
- The agent re-stages a GO. The pending card and timeline read "revised from Conditional GO". No approval exists.

**Look at:** the pending card's decision status (still pending) and the agent's explanation of what changed.

## Human action

Click **Approve** on the pending-decision card and confirm in the dialog ("Approve this recommendation?").

**Expected results**

- The card shows "Approved by you" with the time.
- The timeline shows a **Human** approval event.

## Prompt 3

> Generate a concise executive owner brief from the approved decision, conditions, assignments, risks, deadlines, and the human change that affected the recommendation. Focus on what must happen in the next 24 hours.

**Expected results**

- `civicbid_generate_owner_brief` succeeds. Before approval the same call returns `DECISION_NOT_APPROVED` with a recovery message telling the agent to stop and ask the human.
- The brief panel opens with: Approved decision, Why this opportunity, Conditions and assumptions, Top disqualification risks, Owners and dates, Human change incorporated (naming the JV change and the score movement), Next 24 hours, and an Audit summary with event counts and the version range.

**Look at:** the "Human change incorporated" section and the audit summary; both are generated from the same timeline shown on the right.

## Negative checks worth trying

- Ask the agent to approve. It should report a human-only error and stop.
- Ask the agent to change the company profile. It should report that the profile is human-only and offer `civicbid_simulate_company_change` instead.
- Ask for the owner brief before approving. It should report `DECISION_NOT_APPROVED`.
- Run `civicbid_reset_demo` without the confirmation string. It should refuse; with `confirm: "RESET_CIVICBID_DEMO"` it restores the seed and the version keeps counting up.
