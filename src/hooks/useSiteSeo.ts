import { useEffect, useState } from 'react';
import { loadSiteSeo, siteSeoSettings, subscribeSiteSeo } from '../lib/seo';
export function useSiteSeo() {
  const [settings, setSettings] = useState(siteSeoSettings);
  useEffect(() => { const unsubscribe = subscribeSiteSeo(() => setSettings(siteSeoSettings())); void loadSiteSeo(); return unsubscribe; }, []);
  return settings;
}
