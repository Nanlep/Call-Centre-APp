import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App, { ErrorBoundary } from './App.tsx';
import './index.css';
import { Toaster } from 'sonner';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Toaster position="top-right" theme="dark" />
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
