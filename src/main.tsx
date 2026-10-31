import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Offline after first load: the service worker caches the app shell. Needs HTTPS or localhost.
if ('serviceWorker' in navigator && location.search.indexOf('nosw') < 0) {
  // crypto.ts awaits libsodium, so this module can run after the window 'load' event already fired
  const reg = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* no HTTPS: app still works online */ });
  if (document.readyState === 'complete') reg(); else addEventListener('load', reg);
}
