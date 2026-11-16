export type UiLocale = 'zh' | 'en';
export type UiLocalePreference = UiLocale | 'auto';
export const isUiLocalePreference = (value: unknown): value is UiLocalePreference => value === 'zh' || value === 'en' || value === 'auto';
export function resolveLocale(saved: string | null | undefined, languages: readonly string[]): UiLocale {
  return saved === 'zh' || saved === 'en' ? saved : languages[0]?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
