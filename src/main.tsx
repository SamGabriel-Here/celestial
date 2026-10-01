import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/chivo/latin-300.css';
import '@fontsource/chivo/latin-400.css';
import '@fontsource/chivo/latin-600.css';
import '@fontsource/chivo/latin-800.css';
import '@fontsource/chivo-mono/latin-400.css';
import '@fontsource/chivo-mono/latin-500.css';
import './styles.css';
import { App } from './app/App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
