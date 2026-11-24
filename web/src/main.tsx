import { render } from 'preact';
import './ui/theme.css';
import { App } from './App';

render(<App />, document.getElementById('app')!);

// Service worker (offline shell). Registered relative to the configured base path.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {});
  });
}

// Test hook used only by the headless screenshot script (mock signed-in state); inert otherwise.
if ((window as any).__ESKYTELL_MOCK_USER__) {
  import('./data/store').then((m) => { (window as any).__eskytell = { setState: m.setState, getState: m.getState, actions: m.actions }; });
}
