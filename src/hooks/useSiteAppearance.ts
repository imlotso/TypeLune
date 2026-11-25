import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { buildSiteAppearanceCss, defaultSiteAppearance, type SiteAppearanceSettings } from '../lib/site-appearance';
import { setSiteSurfaceDefaults } from '../lib/surface-appearance';

let cached: SiteAppearanceSettings = defaultSiteAppearance();
let fetched = false;
const listeners = new Set<(value: SiteAppearanceSettings) => void>();

function syncStyleTag(settings: SiteAppearanceSettings) {
  setSiteSurfaceDefaults({ light: settings.light.surface, dark: settings.dark.surface });
  if (typeof document === 'undefined') return;
  const id = 'site-appearance-overrides';
  const css = buildSiteAppearanceCss(settings);
  let node = document.getElementById(id) as HTMLStyleElement | null;
  if (!css) {
    node?.remove();
    return;
  }
  if (!node) {
    node = document.createElement('style');
    node.id = id;
    document.head.appendChild(node);
  }
  if (node.textContent !== css) node.textContent = css;
}

function broadcast(next: SiteAppearanceSettings) {
  cached = next;
  syncStyleTag(next);
  for (const listener of listeners) listener(next);
}

export function applySiteAppearance(next: SiteAppearanceSettings) {
  fetched = true;
  broadcast(next);
}

export async function refreshSiteAppearance() {
  try {
    const value = await api<SiteAppearanceSettings>('/api/site/appearance');
    if (value && value.light?.palette && value.dark?.palette) {
      fetched = true;
      broadcast(value);
    }
  } catch {
    // Keep built-in Matte Space Silver defaults when unavailable.
  }
}

export function useSiteAppearance(): SiteAppearanceSettings {
  const [settings, setSettings] = useState<SiteAppearanceSettings>(cached);
  useEffect(() => {
    listeners.add(setSettings);
    if (!fetched) {
      fetched = true;
      void refreshSiteAppearance();
    } else {
      syncStyleTag(cached);
      setSettings(cached);
    }
    return () => { listeners.delete(setSettings); };
  }, []);
  return settings;
}
