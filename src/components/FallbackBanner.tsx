import { Glyph } from './Glyph';

export function FallbackBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fallback-banner" role="note">
      <Glyph kind="warning" />
      <span>
        WebMCP site tools are not exposed by this browser. Everything still works by hand, and the Tool Console runs the same tools here; for the live agent
        experience open this page in ChatGPT&apos;s browser or Chrome 149+ with WebMCP enabled.
      </span>
      <button type="button" className="btn btn-quiet btn-sm" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
