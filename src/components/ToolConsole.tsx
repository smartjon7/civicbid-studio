/**
 * Tool Console: runs the registered tool handlers by hand. It is a testing aid
 * for browsers without WebMCP and for end-to-end checks; it is not WebMCP.
 */
import { useEffect, useId, useState } from 'react';
import { formatTime } from '../domain/format';
import { useToolRuntime } from '../store/context';
import type { CivicBidToolResult } from '../webmcp/types';
import { ReadWriteBadge } from './badges';
import { Glyph } from './Glyph';
import { CONSOLE_NOTE } from './uiText';

interface ConsoleRun {
  id: number;
  tool: string;
  at: string;
  result: CivicBidToolResult | null;
  thrown: string | null;
}

const KEEP = 5;

export function ToolConsole({ onClose }: { onClose: () => void }) {
  const runtime = useToolRuntime();
  const idBase = useId();
  const definitions = runtime.definitions;
  const [selectedName, setSelectedName] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<ConsoleRun[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const selected = definitions.find((d) => d.name === selectedName) ?? definitions[0] ?? null;
  const text = selected ? (inputs[selected.name] ?? JSON.stringify(selected.example, null, 2)) : '';
  const reads = definitions.filter((d) => d.readOnly);
  const writes = definitions.filter((d) => !d.readOnly);

  const run = async () => {
    if (!selected || running) return;
    let input: unknown;
    try {
      input = text.trim() === '' ? {} : JSON.parse(text);
    } catch (error) {
      setParseError(`Input is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    setParseError(null);
    setRunning(true);
    const at = new Date().toISOString();
    try {
      const result = await runtime.execute(selected.name, input, 'console');
      setRuns((previous) => [{ id: Date.now(), tool: selected.name, at, result, thrown: null }, ...previous].slice(0, KEEP));
    } catch (error) {
      setRuns((previous) => [{ id: Date.now(), tool: selected.name, at, result: null, thrown: error instanceof Error ? error.message : String(error) }, ...previous].slice(0, KEEP));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="console-drawer" aria-labelledby={`${idBase}-title`}>
      <div className="console-head">
        <h2 id={`${idBase}-title`}>Tool Console</h2>
        <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
      </div>
      <div className="console-body">
        <p className="console-note">{CONSOLE_NOTE}</p>
        <p className="muted">
          Runs through the page's registered tool handlers, the same functions the browser agent calls. Every run is logged as the agent acting through the tool console.
        </p>

        {definitions.length === 0 ? (
          <p className="empty">No tools are registered yet.</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor={`${idBase}-tool`}>Tool</label>
              <select id={`${idBase}-tool`} value={selected?.name ?? ''} onChange={(event) => setSelectedName(event.target.value)}>
                <optgroup label="Read">
                  {reads.map((d) => (
                    <option key={d.name} value={d.name}>{d.title} — {d.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Write">
                  {writes.map((d) => (
                    <option key={d.name} value={d.name}>{d.title} — {d.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            {selected ? (
              <div className="console-tool">
                <div className="tool-row-head">
                  <span className="tool-title">{selected.title}</span>
                  <ReadWriteBadge readOnly={selected.readOnly} />
                  <code className="tool-name">{selected.name}</code>
                </div>
                <p className="tool-desc">{selected.description}</p>
              </div>
            ) : null}
            <div className="field">
              <label htmlFor={`${idBase}-input`}>Input (JSON)</label>
              <textarea
                id={`${idBase}-input`}
                className="console-input"
                value={text}
                spellCheck={false}
                aria-invalid={parseError ? true : undefined}
                onChange={(event) => {
                  if (selected) setInputs((previous) => ({ ...previous, [selected.name]: event.target.value }));
                }}
              />
              {parseError ? <p className="field-error" role="alert">{parseError}</p> : null}
            </div>
            <div className="decision-actions">
              <button type="button" className="btn btn-primary" disabled={!selected || running} onClick={() => { void run(); }}>
                {running ? 'Running' : 'Run'}
              </button>
              {selected ? (
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setInputs((previous) => ({ ...previous, [selected.name]: JSON.stringify(selected.example, null, 2) }))}>
                  Reset to example
                </button>
              ) : null}
            </div>
          </>
        )}

        <h3 className="group-title">Results (last {KEEP})</h3>
        {runs.length === 0 ? (
          <p className="empty">No runs yet.</p>
        ) : (
          <ol className="console-results">
            {runs.map((run, index) => (
              <ConsoleResult key={run.id} run={run} latest={index === 0} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function ConsoleResult({ run, latest }: { run: ConsoleRun; latest: boolean }) {
  const result = run.result;
  const ok = result?.ok === true;
  return (
    <li className={`console-result ${ok ? 'is-ok' : 'is-error'}`}>
      <div className="console-result-head">
        <span className={`badge ${ok ? 'badge-ok' : 'badge-bad'}`}>
          <Glyph kind={ok ? 'check' : 'cross'} />
          <span>{ok ? 'OK' : 'Error'}</span>
        </span>
        <code className="tool-chip">{run.tool}</code>
        {result ? <span className="event-version">v{result.stateVersion}</span> : null}
        <time dateTime={run.at}>{formatTime(run.at)}</time>
      </div>
      {run.thrown ? <p className="field-error">The runtime threw: {run.thrown}</p> : null}
      {result ? (
        <>
          <p className="console-summary">{result.summary}</p>
          {result.error ? (
            <p className="console-error">
              <strong>{result.error.code}</strong>: {result.error.message}
              <br />
              <span className="muted">Recovery: {result.error.recovery}</span>
            </p>
          ) : null}
          {result.warnings && result.warnings.length ? (
            <ul className="list-plain">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {result.changed.length ? <p className="muted">Changed: {result.changed.join(', ')}</p> : null}
          <details>
            <summary>Verification</summary>
            <pre>{JSON.stringify(result.verification, null, 2)}</pre>
          </details>
          {result.data !== undefined ? (
            <details open={latest}>
              <summary>Data</summary>
              <pre>{JSON.stringify(result.data, null, 2)}</pre>
            </details>
          ) : null}
        </>
      ) : null}
    </li>
  );
}
