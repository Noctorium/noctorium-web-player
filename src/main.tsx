import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { live } from './live';
import './styles.css';
import './skins.css';

live.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
