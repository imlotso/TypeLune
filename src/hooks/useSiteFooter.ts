import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { defaultFooterSettings, type FooterSettings } from '../lib/footer-settings';

let cached: FooterSettings = defaultFooterSettings();
let fetched = false;
const listeners = new Set<(value: FooterSettings) => void>();

function broadcast(next: FooterSettings) {
  cached = next;
  for (const listener of listeners) listener(next);
}

export function applySiteFooter(next: FooterSettings) {
  fetched = true;
  broadcast(next);
}

export async function refreshSiteFooter() {
  try {
    const value = await api<FooterSettings>('/api/site/footer');
    if (value && Array.isArray(value.buttons)) {
      fetched = true;
      broadcast(value);
    }
  } catch {
    // Keep current defaults when unavailable.
  }
}

export function useSiteFooter(): FooterSettings {
  const [settings, setSettings] = useState<FooterSettings>(cached);
  useEffect(() => {
    listeners.add(setSettings);
    if (!fetched) {
      fetched = true;
      void refreshSiteFooter();
    } else {
      setSettings(cached);
    }
    return () => { listeners.delete(setSettings); };
  }, []);
  return settings;
}
