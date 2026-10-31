import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Offline after first load: the service worker caches the app shell. Needs HTTPS or localhost.
if ('serviceWorker' in navigator && location.search.indexOf('nosw') < 0) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { /* no HTTPS: app still works online */ }));
}
