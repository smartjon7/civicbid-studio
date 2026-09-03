import type { Recommendation, Actor, Channel } from '../store/types';

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    const text = Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1);
    return `$${text}M`;
  }
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

export function formatLongDate(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatShortDate(isoDate: string): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return isoTimestamp;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

/** Parses YYYY-MM-DD as a UTC date. Returns null when the string is not a valid calendar date. */
export function parseIsoDate(value: string): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function addDays(isoDate: string, days: number): string {
  const parsed = parseIsoDate(isoDate);
  if (!parsed) return isoDate;
  const next = new Date(parsed.getTime() + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  go: 'GO',
  conditional_go: 'Conditional GO',
  no_go: 'NO-GO',
};

export function recommendationLabel(recommendation: Recommendation): string {
  return RECOMMENDATION_LABELS[recommendation];
}

export function actorLabel(actor: Actor, channel?: Channel): string {
  if (actor === 'agent') {
    if (channel === 'console') return 'Agent (tool console)';
    return 'Agent';
  }
  if (actor === 'human') return 'Human';
  return 'System';
}

export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0).length;
}

/** Plain-English labels for company profile fields, shared by the activity log and the owner brief. */
export const COMPANY_FIELD_LABELS: Record<string, string> = {
  name: 'Company name',
  dbeCertified: 'DBE certified',
  railYears: 'Years of rail experience',
  comparableRailProjects: 'Comparable rail projects',
  singleProjectBondingUsd: 'Single-project bonding',
  aggregateBondingUsd: 'Aggregate bonding',
  jvPartnerConfirmed: 'Qualified JV partner confirmed',
  jvCombinedBondingUsd: 'Combined JV bonding',
  availableProjectManagers: 'Available project managers',
  safetyRecord: 'Safety record',
  backlogUtilizationPct: 'Backlog utilization',
  accessibilityStationProjects: 'Accessibility-station projects',
  completedHousingDevelopments: 'Completed housing developments',
};

export function fieldLabel(field: string): string {
  return COMPANY_FIELD_LABELS[field] ?? field;
}

/** Human-readable value for a profile field: money in $M, booleans as Yes/No, percentages with a sign. */
export function formatFieldValue(field: string, value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (field.endsWith('Usd')) return formatUsd(value);
    if (field.endsWith('Pct')) return `${value}%`;
    return String(value);
  }
  return value;
}

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
