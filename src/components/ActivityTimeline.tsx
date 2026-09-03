import { formatTime } from '../domain/format';
import { useAppState } from '../store/context';
import { ActorBadge } from './badges';

const LIMIT = 80;

export function ActivityTimeline() {
  const activity = useAppState().activity;
  const events = activity.slice(-LIMIT).reverse();

  return (
    <section className="card" aria-labelledby="timeline-title">
      <div className="panel-head">
        <h2 id="timeline-title">Activity</h2>
        <span className="muted">
          {activity.length > LIMIT ? `latest ${LIMIT} of ${activity.length}` : `${activity.length} event${activity.length === 1 ? '' : 's'}`}
        </span>
      </div>
      {events.length === 0 ? (
        <p className="empty">Nothing has happened yet. Every action by you or the agent lands here with its state version.</p>
      ) : (
        <ol className="timeline">
          {events.map((event) => {
            const changed = event.stateVersionBefore !== event.stateVersionAfter;
            return (
              <li key={event.id} className={`event event-${event.actor}`}>
                <div className="event-head">
                  <ActorBadge actor={event.actor} channel={event.channel} />
                  {event.tool ? <code className="tool-chip">{event.tool}</code> : null}
                  <span className="event-version">{changed ? `v${event.stateVersionBefore} to v${event.stateVersionAfter}` : `v${event.stateVersionAfter}`}</span>
                  <time dateTime={event.at}>{formatTime(event.at)}</time>
                </div>
                <p className="event-title">{event.title}</p>
                {event.detail ? <p className="event-detail">{event.detail}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
