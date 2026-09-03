import { useToolRuntime, useWebMcpStatus } from '../store/context';
import { ReadWriteBadge } from './badges';
import { Glyph } from './Glyph';
import { firstSentence } from './uiText';

export function SiteToolsPanel({ onClose }: { onClose: () => void }) {
  const runtime = useToolRuntime();
  const status = useWebMcpStatus();
  const definitions = runtime.definitions;
  const discovered = new Set(status.discovered.map((tool) => tool.name));
  const reads = definitions.filter((d) => d.readOnly);
  const writes = definitions.filter((d) => !d.readOnly);

  return (
    <section className="site-tools-panel" aria-labelledby="site-tools-title">
      <div className="panel-head">
        <h2 id="site-tools-title">Site tools</h2>
        <button type="button" className="btn btn-quiet" onClick={onClose}>Close</button>
      </div>
      <p className="muted">
        {status.supported
          ? status.registered
            ? `The browser reports ${status.registeredCount} registered tool${status.registeredCount === 1 ? '' : 's'}.`
            : 'Registering tools with the browser.'
          : 'This browser does not expose WebMCP. The list below is what the page registers when it does.'}
        {status.error ? ` ${status.error}` : ''}
      </p>
      {definitions.length === 0 ? (
        <p className="empty">No tools are registered yet.</p>
      ) : (
        <div className="tool-groups">
          <div>
            <h3 className="group-title">Read ({reads.length})</h3>
            <ul className="tool-list">
              {reads.map((tool) => (
                <ToolRow key={tool.name} name={tool.name} title={tool.title} description={tool.description} readOnly discovered={discovered.has(tool.name)} />
              ))}
            </ul>
          </div>
          <div>
            <h3 className="group-title">Write ({writes.length})</h3>
            <ul className="tool-list">
              {writes.map((tool) => (
                <ToolRow key={tool.name} name={tool.name} title={tool.title} description={tool.description} readOnly={false} discovered={discovered.has(tool.name)} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function ToolRow({ name, title, description, readOnly, discovered }: { name: string; title: string; description: string; readOnly: boolean; discovered: boolean }) {
  return (
    <li className="tool-row">
      <div className="tool-row-head">
        <span className="tool-title">{title}</span>
        <ReadWriteBadge readOnly={readOnly} />
        {discovered ? (
          <span className="badge badge-ok">
            <Glyph kind="check" />
            <span>discovered by the browser</span>
          </span>
        ) : null}
      </div>
      <code className="tool-name">{name}</code>
      <p className="tool-desc">{firstSentence(description)}</p>
    </li>
  );
}
