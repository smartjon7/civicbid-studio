/**
 * Interface copy and small presentation helpers shared by the components.
 */
import type { Sector } from '../store/types';
import { parseIsoDate } from '../domain/format';

export const APP_NAME = 'CivicBid Studio';
export const TAGLINE = 'A shared, auditable bid room where you and a browser agent decide what to pursue';
export const SOURCE_URL = 'https://github.com/smartjon7/civicbid-studio';

export const FOOTER_TEXT =
  'Built for the OpenAI WebMCP Challenge. All agencies, companies, projects, people, and data in this demo are fictional. This is a demonstration, not procurement, legal, bonding, or investment advice.';

export const UNSUPPORTED_BADGE_TEXT =
  "Site tools unavailable in this browser — open in ChatGPT's browser or Chrome 149+ with WebMCP enabled. The Tool Console runs the same tools here.";

export const CONSOLE_NOTE =
  'Runs the same handlers the browser agent calls through WebMCP. It is a testing aid, not a substitute for a WebMCP-enabled browser.';

export const CLICK_COUNT_LINE =
  'Without site tools this takes about 40 clicks across six panels; with site tools it is nine structured calls the agent can verify.';

export const HUMAN_ONLY_LINE = 'Only a human can approve. The agent stages; you decide.';

export const JUDGE_PROMPTS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Prompt 1 — find, compare, focus, assign, stage',
    text:
      "You are helping a small infrastructure contractor decide what to bid. Use this page's site tools to find opportunities worth more than $20 million that close within 45 days. Compare them, open the strongest opportunity, identify every mandatory requirement and possible disqualification risk, focus those items in the interface, assign the most important gaps to appropriate owners, and stage — but do not approve — a bid/no-bid recommendation. Explain your reasoning and stop for my review.",
  },
  {
    title: 'Prompt 2 — reread the human change and revise',
    text:
      'Read the updated workspace state and tell me exactly what changed. Reevaluate the selected opportunity and revise the staged recommendation if the new company capacity supports it. Do not approve anything.',
  },
  {
    title: 'Prompt 3 — the owner brief',
    text:
      'Generate a concise executive owner brief from the approved decision, conditions, assignments, risks, deadlines, and the human change that affected the recommendation. Focus on what must happen in the next 24 hours.',
  },
];

export const SECTOR_LABELS: Record<Sector, string> = {
  rail: 'Rail',
  accessibility: 'Accessibility',
  housing: 'Housing',
};

/** Provenance for every write made from the interface. */
export const HUMAN_UI = { actor: 'human', channel: 'ui' } as const;

/** "September 3, 2026" — the header's demo date. */
export function formatDemoDate(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** The first sentence of a tool description, for compact lists. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const index = trimmed.search(/[.!?](\s|$)/);
  return index >= 0 ? trimmed.slice(0, index + 1) : trimmed;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Reads a session-only flag without throwing in private or sandboxed windows. */
export function readSessionFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeSessionFlag(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Storage unavailable: the flag lives only in component state.
  }
}
