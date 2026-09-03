/**
 * Status chips. Each pairs a colour, a glyph, and visible text.
 */
import type { Actor, Channel, Recommendation, RequirementStatus, RiskStatus, Severity } from '../store/types';
import { actorLabel, recommendationLabel } from '../domain/format';
import { Glyph, type GlyphKind } from './Glyph';

const RECOMMENDATION_STYLE: Record<Recommendation, { tone: string; glyph: GlyphKind }> = {
  go: { tone: 'go', glyph: 'check' },
  conditional_go: { tone: 'conditional', glyph: 'warning' },
  no_go: { tone: 'no-go', glyph: 'cross' },
};

export function RecommendationChip({
  recommendation,
  capped = false,
  rawScore,
  size = 'md',
}: {
  recommendation: Recommendation;
  capped?: boolean;
  rawScore?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const style = RECOMMENDATION_STYLE[recommendation];
  return (
    <span className={`chip chip-${style.tone} chip-${size}`}>
      <Glyph kind={style.glyph} />
      <span>{recommendationLabel(recommendation)}</span>
      {capped && rawScore !== undefined ? <span className="chip-note">capped from {rawScore}</span> : null}
    </span>
  );
}

const REQUIREMENT_STYLE: Record<RequirementStatus, { label: string; tone: string; glyph: GlyphKind }> = {
  satisfied: { label: 'Satisfied', tone: 'ok', glyph: 'check' },
  gap: { label: 'Gap', tone: 'bad', glyph: 'cross' },
  at_risk: { label: 'At risk', tone: 'warn', glyph: 'warning' },
  assigned: { label: 'Assigned', tone: 'info', glyph: 'arrow' },
  complete: { label: 'Complete', tone: 'ok', glyph: 'double-check' },
};

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  const style = REQUIREMENT_STYLE[status];
  return (
    <span className={`badge badge-${style.tone}`}>
      <Glyph kind={style.glyph} />
      <span>{style.label}</span>
    </span>
  );
}

const SEVERITY_STYLE: Record<Severity, { tone: string; glyph: GlyphKind }> = {
  low: { tone: 'neutral', glyph: 'dot' },
  medium: { tone: 'warn', glyph: 'warning' },
  high: { tone: 'bad', glyph: 'warning' },
  critical: { tone: 'critical', glyph: 'cross' },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = SEVERITY_STYLE[severity];
  return (
    <span className={`badge badge-${style.tone}`}>
      <Glyph kind={style.glyph} />
      <span>{severity.charAt(0).toUpperCase() + severity.slice(1)}</span>
    </span>
  );
}

const RISK_STATUS_STYLE: Record<RiskStatus, { label: string; tone: string; glyph: GlyphKind }> = {
  open: { label: 'Open', tone: 'warn', glyph: 'warning' },
  mitigating: { label: 'Mitigating', tone: 'info', glyph: 'arrow' },
  resolved: { label: 'Resolved', tone: 'ok', glyph: 'check' },
};

export function RiskStatusBadge({ status }: { status: RiskStatus }) {
  const style = RISK_STATUS_STYLE[status];
  return (
    <span className={`badge badge-${style.tone}`}>
      <Glyph kind={style.glyph} />
      <span>{style.label}</span>
    </span>
  );
}

const ACTOR_GLYPH: Record<Actor, GlyphKind> = { agent: 'agent', human: 'human', system: 'system' };

export function ActorBadge({ actor, channel }: { actor: Actor; channel?: Channel }) {
  return (
    <span className={`badge badge-actor badge-actor-${actor}`}>
      <Glyph kind={ACTOR_GLYPH[actor]} />
      <span>{actorLabel(actor, channel)}</span>
    </span>
  );
}

export function ReadWriteBadge({ readOnly }: { readOnly: boolean }) {
  return (
    <span className={`badge ${readOnly ? 'badge-neutral' : 'badge-info'}`}>
      <Glyph kind={readOnly ? 'read' : 'write'} />
      <span>{readOnly ? 'Read' : 'Write'}</span>
    </span>
  );
}

export function HumanActionTag() {
  return (
    <span className="badge badge-human-action">
      <Glyph kind="lock" />
      <span>Human action required</span>
    </span>
  );
}
