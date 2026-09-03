# Demo video script — CivicBid Studio

Target length: about 2:30. Hard limit: under 3:00 (challenge rule). The narration below is the exact text used in the produced video, so a re-recording with a live voice can follow it word for word.

## Two ways to produce the video

**A. Produced fallback video (already rendered).** `CivicBid-Studio-WebMCP-demo.mp4` was recorded from the live site in Chrome 152 with WebMCP enabled, with every tool call executed through `document.modelContext.executeTool` — the browser's own WebMCP path — and every human step performed as a real click. Narration is a neural text-to-speech voice reading the script below. Nothing on screen is staged or edited: the recording is one continuous take at 1440x810, and the timeline in the video is the real activity log. This video satisfies the rules (under three minutes, audio, shows the build and the WebMCP implementation) and can be uploaded as-is.

**B. Re-recording with ChatGPT (stronger, optional).** If time allows, record the same sequence in the ChatGPT desktop app's built-in browser with GPT-5.6 Sol or Terra so judges see ChatGPT's own Site tools menu and "Recently used" list. Follow the pre-recording checklist, paste the three prompts from [JUDGE_TEST.md](JUDGE_TEST.md), and read the narration below over it. Accelerate only dead air; never cut inside a tool call.

## Pre-recording checklist (for option B)

- [ ] Open the live site in the ChatGPT desktop app's built-in browser (GPT-5.6 Sol or Terra) or Chrome 149+ with WebMCP enabled.
- [ ] Click **Reset demo** in the header and confirm, so the workspace is at the seed: no selection, no assignments, no risks, no decision.
- [ ] Confirm the header reads **Site tools ready · 13 registered** and the Site tools panel lists all thirteen.
- [ ] Set browser zoom so the three-column layout is readable at 1080p (110–125% usually works). Check that the pending-decision card and the timeline are visible without scrolling.
- [ ] Close every other tab and window. Hide bookmarks and extensions. No personal names, accounts, or notifications on screen.
- [ ] Have the three prompts in a plain-text file ready to paste.
- [ ] Do one full dry run without recording. Note where the agent pauses so the narration can breathe there.
- [ ] Record at 1920x1080, 30 fps, system audio off, microphone on.

## Recording rules

- No third-party logos, trademarks, or music. Screen, cursor, and voice only.
- Do not cut inside a tool call. If the agent stalls, stop, reset, and record again.
- Never show a tool approving anything, because none can. Show the Approve button being clicked by hand.
- Keep every claim demonstrable on screen. If the score lands at 87 instead of 88, say the number you see.
- If the browser shows the fallback banner, stop. The video must show real site tools, not the Tool Console.

## Narration and shots

### 0:00–0:15 — The problem

**Narration:** "Public contractors lose winnable work when one mandatory requirement, bonding gap, staffing constraint, or deadline slips through. CivicBid Studio gives a person and an AI agent one shared, auditable bid room."

**Shot:** The welcome screen. Three opportunity cards in the left rail, the header badge "Site tools ready · 13 registered", the demo date. At about 0:06 the Site tools panel opens.

### 0:15–0:32 — The page declares its tools

**Narration:** "Instead of forcing an agent to guess through screenshots and clicks, this page registers thirteen structured site tools with WebMCP. The agent reads and changes the same workspace I see, and the browser can list every tool it discovered."

**Shot:** The Site tools panel: thirteen tools with read/write badges, each marked as discovered by the browser. The panel closes at the end of the segment.

### 0:32–1:12 — Prompt 1: the agent does the compliance work

**Narration:** "Watch the site tools run the first request: find opportunities over twenty million dollars closing within forty-five days, compare them, and open the strongest. Rail Fastener Renewal leads at seventy-eight, Conditional GO. The agent lists the mandatory requirements, focuses the disqualification risks in the interface, assigns bonding, the joint-venture package, safety, and scheduling to named owners, registers two risks with mitigations, and stages a Conditional GO recommendation. Every call lands in the activity timeline with a state version. And then it stops. The decision is pending human approval."

**Shot:** Tool calls land in order: list, compare (comparison panel: Rail 78 first, Station 53 NO-GO), open Rail, context, requirements, focus (five rows outlined with the reason), four assignments, two risks, stage. The pending-decision card shows Conditional GO with Approve and Reject marked "Human action required". The timeline fills with agent badges, tool chips, and version stamps.

### 1:12–1:38 — The human changes one fact; the agent rereads and revises

**Narration:** "The agent cannot approve this. It also cannot change our company's capacity. That is mine. I confirm the joint-venture package: partner confirmed, combined bonding sixty million. The agent rereads the workspace since the last version it saw, reports exactly what changed, and revises the recommendation to GO. Still pending. Then I approve it myself."

**Shot:** Click **Confirm JV package** in the left rail. The profile updates, the score moves to the high eighties, the pending card shows "Company profile changed since this was staged", and the timeline shows the human event with the score movement. The agent calls `civicbid_get_workspace_state` with `sinceStateVersion`, then stages GO ("revised from Conditional GO"). Click **Approve**, confirm in the dialog. The card reads "Approved by you".

### 1:38–1:58 — Prompt 3: the owner brief

**Narration:** "Only now can the agent generate the executive owner brief: the approved decision, why this opportunity, conditions, the top disqualification risks, owners and dates, the human change that moved the score, and the next twenty-four hours. Beneath it, the complete agent and human audit trail."

**Shot:** `civicbid_generate_owner_brief` runs and the brief panel opens with every section visible, including "Human change incorporated" and "Audit summary".

### 1:58–2:18 — Why it matters

**Narration:** "This is the agent-native web working the way it should. The human interface stays primary, the agent gets precise tools, and the two collaborate in shared context with human judgment at the gate. The same pattern fits procurement, grants, housing, compliance, and every deadline-driven decision."

**Shot:** Back to the workspace with the approved card and the full timeline.

### 2:18–2:29 — Close

**Narration:** "CivicBid Studio. Open source, MIT licensed, entirely synthetic data. Built for the OpenAI WebMCP Challenge."

**Shot:** The Site tools panel and the footer with the source link.

## Shot list summary

| Time | Shot | What must be visible |
|---|---|---|
| 0:00 | Welcome | Three cards, header badge, demo date |
| 0:06 | Site tools panel | Thirteen tools with read/write badges |
| 0:32 | Prompt 1 running | Comparison, workspace, focused rows, assignments, risks, pending card |
| 1:12 | Confirm JV package | Profile change, stale warning, human timeline event |
| 1:22 | Reread and revise | Workspace-state call, revised GO |
| 1:32 | Approve click | Approved card, human badge |
| 1:38 | Prompt 3 running | Owner brief sections |
| 1:58 | Why it matters | Workspace and timeline |
| 2:18 | Close | Site tools panel, footer |
