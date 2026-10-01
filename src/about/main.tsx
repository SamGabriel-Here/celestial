import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/jost/latin-300.css';
import '@fontsource/jost/latin-400.css';
import '@fontsource/jost/latin-500.css';
import '../styles.css';
import './about.css';
import { About } from './About';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <About />
  </StrictMode>,
);
