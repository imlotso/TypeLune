import React from 'react';
import { PerformanceInsights } from './PerformanceInsights';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './features.css';
import './background.css';
import { I18nProvider } from './lib/i18n';

createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><App /><PerformanceInsights /></I18nProvider></React.StrictMode>);
