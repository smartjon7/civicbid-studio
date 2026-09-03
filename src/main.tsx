import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Placeholder shell — replaced by the full application in a later commit.
function Shell() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 720 }}>
      <h1>CivicBid Studio</h1>
      <p>A shared, auditable public-infrastructure bid room for people and browser agents.</p>
      <p>Deployment shell. The full workspace is on its way.</p>
      <footer style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#555' }}>
        Built for the OpenAI WebMCP Challenge. All agencies, companies, projects, people, and data in this demo are fictional.
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
