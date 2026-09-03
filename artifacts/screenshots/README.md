# Screenshots

Captured by the lead from the deployed app in a supported browser at 1920x1080, browser zoom 110–125%, no other tabs, no personal names or accounts visible. PNG, no annotations, no third-party logos. Reset the demo before the first capture and follow the judge sequence in order so later screenshots show the state the earlier ones produced.

| File | What it shows | When to capture |
|---|---|---|
| `01-welcome.png` | The welcome screen: three opportunity cards, header badge "Site tools ready · 13 registered", demo date | After reset, before any prompt |
| `01-workspace.png` | README hero: the workspace on Rail with focused rows, assignments, risks, the pending Conditional GO card, and the timeline | After prompt 1 (same moment as 03; this is the wide hero crop) |
| `02-comparison.png` | The comparison panel: Rail 78 Conditional GO first, Station 53 NO-GO | During prompt 1, after `civicbid_compare_opportunities` |
| `03-workspace-focused.png` | Requirement matrix with the agent's focused rows highlighted and the focus reason | During prompt 1, after `civicbid_focus_requirements` |
| `04-pending-approval.png` | Pending-decision card: Conditional GO, Approve and Reject buttons, confidence, conditions | End of prompt 1 |
| `05-after-jv.png` | After Confirm JV package: profile shows the partner and $60M; pending card shows the stale warning; timeline shows the human event with the score movement | After the human click, before prompt 2 |
| `06-approved.png` | Card approved by the human with the version; timeline shows the human approval; pending GO reads "revised from Conditional GO" in the log | After prompt 2 and the Approve click |
| `07-owner-brief.png` | The brief panel with the sections visible, including "Human change incorporated" | After prompt 3 |
| `08-tool-console.png` | The Tool Console with a tool selected, its JSON input, and a result envelope | Any time; use `civicbid_get_context` or `civicbid_simulate_company_change` |
| `09-site-tools.png` | The Site tools panel listing thirteen tools with read/write badges (and, in ChatGPT, the address-bar Site tools menu) | Any time after load |

Naming is fixed: the README references `01-workspace.png`. Do not rename files after the README and Devpost images are set.
