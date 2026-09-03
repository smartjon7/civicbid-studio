import { ActivityTimeline } from './ActivityTimeline';
import { BriefStatusCard } from './BriefStatusCard';
import { DecisionCard } from './DecisionCard';

export function RightRail() {
  return (
    <>
      <DecisionCard />
      <BriefStatusCard />
      <ActivityTimeline />
    </>
  );
}
