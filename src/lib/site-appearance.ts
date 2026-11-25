export type ThemePalette = {
  bgFrom: string;
  bgVia: string;
  bgTo: string;
  workspaceBg: string;
  panelBg: string;
  accent: string;
  text: string;
  muted: string;
};

export type ThemeSurfaceDefaults = {
  headerOpacity: number;
  workspaceOpacity: number;
  panelOpacity: number;
  panelBlur: number;
  borderOpacity: number;
};

export type SiteThemeAppearance = {
  palette: ThemePalette;
  surface: ThemeSurfaceDefaults;
};

export type SiteAppearanceSettings = {
  light: SiteThemeAppearance;
  dark: SiteThemeAppearance;
};

export type SiteAppearanceSnapshot = {
  settings: SiteAppearanceSettings;
  revision: number;
};

/** Exact Matte Apple Space Silver (low-glare v1) defaults. */
export function defaultSiteAppearance(): SiteAppearanceSettings {
  return {
    light: {
      palette: {
        bgFrom: '#bfc3cb',
        bgVia: '#cdd0d7',
        bgTo: '#b9bdc6',
        workspaceBg: '#d6d9df',
        panelBg: '#eaedf1',
        accent: '#0066cc',
        text: '#1d1d1f',
        muted: '#52565f',
      },
      surface: {
        headerOpacity: 78,
        workspaceOpacity: 76,
        panelOpacity: 84,
        panelBlur: 16,
        borderOpacity: 100,
      },
    },
    dark: {
      palette: {
        bgFrom: '#141416',
        bgVia: '#18181b',
        bgTo: '#141416',
        workspaceBg: '#1c1c1f',
        panelBg: '#222226',
        accent: '#0a84ff',
        text: '#f5f5f7',
        muted: '#a1a1a6',
      },
      surface: {
        headerOpacity: 78,
        workspaceOpacity: 78,
        panelOpacity: 84,
        panelBlur: 16,
        borderOpacity: 100,
      },
    },
  };
}

export const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function darkenHex(hex: string, ratio: number): string {
  const clean = hex.replace('#', '');
  const r = Math.max(0, Math.min(255, Math.round(Number.parseInt(clean.slice(0, 2), 16) * (1 - ratio))));
  const g = Math.max(0, Math.min(255, Math.round(Number.parseInt(clean.slice(2, 4), 16) * (1 - ratio))));
  const b = Math.max(0, Math.min(255, Math.round(Number.parseInt(clean.slice(4, 6), 16) * (1 - ratio))));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function isDefaultSiteAppearance(settings: SiteAppearanceSettings): boolean {
  return JSON.stringify(settings) === JSON.stringify(defaultSiteAppearance());
}

/**
 * Generates CSS variable overrides for the site-wide default palette configured by the administrator.
 * Returns empty string when settings match the built-in Matte Space Silver defaults.
 */
export function buildSiteAppearanceCss(settings: SiteAppearanceSettings): string {
  if (isDefaultSiteAppearance(settings)) return '';
  const l = settings.light.palette;
  const d = settings.dark.palette;
  const lWsRgb = hexToRgbTriplet(l.workspaceBg);
  const lPanelRgb = hexToRgbTriplet(l.panelBg);
  const dWsRgb = hexToRgbTriplet(d.workspaceBg);
  const dPanelRgb = hexToRgbTriplet(d.panelBg);
  const lAccentHover = darkenHex(l.accent, 0.14);
  const dAccentHover = darkenHex(d.accent, 0.12);
  return `:root {
  color: ${l.text};
  background: ${l.bgVia};
  --typing-text: ${l.text};
  --typing-muted: ${l.muted};
  --typing-accent: ${l.accent};
  --wallpaper-surface: ${lWsRgb};
  --wallpaper-panel-surface: ${lPanelRgb};
}
.room-background-default {
  background-color: ${l.bgVia};
  background-image:
    radial-gradient(ellipse 72% 48% at 50% 0%, rgba(255,255,255,.22), transparent 72%),
    radial-gradient(ellipse 60% 44% at 86% 92%, rgba(255,255,255,.16), transparent 72%),
    linear-gradient(155deg, ${l.bgFrom} 0%, ${l.bgVia} 50%, ${l.bgTo} 100%),
    url('/assets/lake-default.webp');
}
.site-header { background: ${l.workspaceBg}; color: ${l.text}; }
.brand, .site-header nav button { color: ${l.text}; }
.primary-button { background: ${l.accent}; }
.primary-button:hover { background: ${lAccentHover}; }
.text-button, .article-meta a, .practice-title svg, .site-info a { color: ${l.accent}; }
[data-theme='dark'] {
  color: ${d.text};
  background: ${d.bgFrom};
  --typing-text: ${d.text};
  --typing-muted: ${d.muted};
  --typing-accent: ${d.accent};
  --wallpaper-surface: ${dWsRgb};
  --wallpaper-panel-surface: ${dPanelRgb};
}
[data-theme='dark'] .room-background-default {
  background-color: ${d.bgFrom};
  background-image:
    radial-gradient(ellipse 72% 48% at 50% 0%, rgba(255,255,255,.04), transparent 72%),
    linear-gradient(155deg, ${d.bgFrom} 0%, ${d.bgVia} 50%, ${d.bgTo} 100%),
    url('/assets/lake-default.webp');
}
[data-theme='dark'] .site-header { background: ${d.workspaceBg}; color: ${d.text}; }
[data-theme='dark'] .brand, [data-theme='dark'] .site-header nav button { color: ${d.text}; }
[data-theme='dark'] .primary-button { background: ${d.accent}; }
[data-theme='dark'] .primary-button:hover { background: ${dAccentHover}; }
[data-theme='dark'] .text-button, [data-theme='dark'] .article-meta a, [data-theme='dark'] .practice-title svg, [data-theme='dark'] .site-info a { color: ${d.accent}; }
`;
}
