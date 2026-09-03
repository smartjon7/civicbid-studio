import { FOOTER_TEXT, SOURCE_URL } from './uiText';

export function Footer() {
  return (
    <footer className="app-footer">
      <p>
        {FOOTER_TEXT}{' '}
        <a href={SOURCE_URL} target="_blank" rel="noreferrer noopener">
          Source code (MIT)
        </a>
      </p>
    </footer>
  );
}
