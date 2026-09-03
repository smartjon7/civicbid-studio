# Demo video script — CivicBid Studio

Target length: 2:45. Hard limit: under 3:00 (challenge rule). Narration is written for about 150 words per minute; read it at a steady pace and let the screen carry the detail.

## Pre-recording checklist

- [ ] Open the live site in the ChatGPT desktop app's built-in browser (GPT-5.6 Sol or Terra) or Chrome 149+ with WebMCP enabled.
- [ ] Click **Reset demo** in the header and confirm (or run `civicbid_reset_demo` with the confirmation string) so the workspace is at the seed: no selection, no assignments, no risks, no decision.
- [ ] Confirm the header reads **Site tools ready · 13 registered** and the Site tools panel lists all thirteen.
- [ ] Set browser zoom so the three-column layout is readable at 1080p (110–125% usually works). Check that the pending-decision card and the timeline are visible without scrolling.
- [ ] Close every other tab and window. Hide bookmarks and extensions. No personal names, accounts, or notifications on screen.
- [ ] Have the three prompts in a plain-text file ready to paste.
- [ ] Do one full dry run without recording. Note where the agent pauses so the narration can breathe there.
- [ ] Recording at 1920x1080, 30 fps, system audio off, microphone on.

## Recording rules

- No third-party logos, trademarks, or music. Screen, cursor, and voice only.
- Do not cut inside a tool call. If the agent stalls, stop, reset, and record again.
- Never show a tool approving anything, because none can. Show the Approve button being clicked by hand.
- Keep every claim demonstrable on screen. If the score lands at 85 instead of 88, say the number you see.
- If the browser shows the fallback banner, stop. The video must show real site tools, not the Tool Console.

## Segments

### 0:00–0:15 — The problem

**Narration:** "Deciding whether to bid a public-infrastructure job is a shared job. An agent is good at reading the solicitation and finding the requirement that disqualifies you. A person has to make the call. CivicBid Studio is a bid room where both work on the same page."

**Shot:** The welcome screen. Three opportunity cards in the left rail. Cursor rests on the header badge.

### 0:15–0:35 — The page declares its tools

**Narration:** "The page registers thirteen site tools through WebMCP. The count in the header is read back from the browser's own registry. Read tools are marked read-only. And notice what is missing: there is no tool that approves, rejects, or edits the company profile. Those are buttons only a person can click."

**Shot:** Open the Site tools panel. Slow scroll down the list showing read/write badges. Hover Approve area on the right rail (empty pending card).

### 0:35–1:15 — Prompt 1: the agent does the compliance work

**Narration:** "First prompt: find opportunities over twenty million closing within forty-five days, compare them, open the strongest, find every disqualification risk, assign owners, and stage a recommendation — but do not approve."

Paste prompt 1, then stay quiet for the first tool calls.

**Narration (as calls land):** "Two opportunities qualify. Station Accessibility is a no-go: the company has zero accessibility-station projects, and that cannot be created before bid day. Rail Fastener Renewal scores seventy-eight, Conditional GO — bonding is five million short. The agent focuses those requirements, assigns Finance and Bonding, JV and Legal, the Safety Director, and the Scheduler, registers the risks, and stages a Conditional GO. Every call is on the timeline with a version stamp."

**Shot:** Comparison panel appears; workspace opens on Rail; focused rows highlight in the requirement matrix; assignments and risks fill in; the pending-decision card shows Conditional GO with Approve and Reject buttons. The timeline scrolls with agent badges and tool chips.

### 1:15–1:35 — The human changes one fact

**Narration:** "Now the person does the one thing only they can do. They confirm a joint-venture partner with sixty million in combined bonding. The pending card immediately flags that the profile changed since the recommendation was staged."

**Shot:** Click **Confirm JV package** in the left rail. The profile updates. The pending card shows "Company profile changed since this was staged." The timeline shows a human event with the score movement.

### 1:35–2:05 — Prompt 2: the agent rereads and revises

**Narration:** "Second prompt: read the updated state and tell me exactly what changed. The agent passes the last version it saw and gets back the one human event with before-and-after scores. Rail is now a GO. The agent re-stages, and the log records it as a revision of the Conditional GO. Still nothing approved."

**Shot:** Paste prompt 2. Show the `civicbid_get_workspace_state` call on the timeline, then the new pending card reading GO with "revised from Conditional GO".

### 2:05–2:20 — Approval is a click, not a call

**Narration:** "Approval is a click. The reducer accepts it only from a person in the interface — an agent that tries gets a human-only error."

**Shot:** Click **Approve**, then confirm in the dialog. The card reads "Approved by you". Timeline shows a human badge.

### 2:20–2:40 — Prompt 3: the owner brief

**Narration:** "Third prompt: an executive brief. This tool fails until a human approves. Now it produces the decision, the conditions, the owners and dates, the top risks, the human change that moved the score, the next twenty-four hours, and an audit summary built from the same timeline you have been watching."

**Shot:** Paste prompt 3. The brief panel opens. Slow scroll through the sections, pausing on "Human change incorporated" and "Audit summary".

### 2:40–2:45 — Close

**Narration:** "Synthetic data, no backend, MIT licensed. Every tool contract is in the repository."

**Shot:** Return to the header badge. Fade.

## Shot list summary

| Time | Shot | What must be visible |
|---|---|---|
| 0:00 | Welcome | Three cards, header badge |
| 0:15 | Site tools panel | Thirteen tools with read/write badges |
| 0:35 | Prompt 1 running | Comparison, workspace, focused rows, assignments, risks, pending card |
| 1:15 | Confirm JV package | Profile change, stale warning, human timeline event |
| 1:35 | Prompt 2 running | Workspace-state call, revised GO |
| 2:05 | Approve click | Approved card, human badge |
| 2:20 | Prompt 3 running | Owner brief sections |
| 2:40 | Close | Header badge |
