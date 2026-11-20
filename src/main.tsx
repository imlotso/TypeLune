import React from 'react';
import { PerformanceInsights } from './PerformanceInsights';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './features.css';
import './background.css';
import './revisions.css';
import './results.css';
import './admin-session.css';
import { I18nProvider } from './lib/i18n';

if (/^\/admin\/?$/.test(window.location.pathname)) void import('./components/AdminWorkspace').catch(() => {});

createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><App /><PerformanceInsights /></I18nProvider></React.StrictMode>);
