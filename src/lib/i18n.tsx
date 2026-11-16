import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { isUiLocalePreference, resolveLocale, type UiLocale, type UiLocalePreference } from './ui-locale';
import type { SyncState } from './models';
export { resolveLocale, type UiLocale, type UiLocalePreference } from './ui-locale';
export const localeStorageKey = 'typelune.ui-locale.v1';
export function translate(zh: string, en: string, locale: UiLocale) { return locale === 'zh' ? zh : en; }
type AccountSync = { state: SyncState; retry: () => Promise<void>; needsRecovery: boolean };
const fallback = { locale: 'zh' as UiLocale, preference: 'auto' as UiLocalePreference, canChange: true, saving: false, saveFailed: false, accountSync: undefined as AccountSync | undefined,
  setLocale: (_locale: UiLocale) => {}, setPreference: (_preference: UiLocalePreference) => {}, t: (zh: string, _en: string) => zh };
const I18nContext = createContext(fallback);
type AccountLocale = { ownerId: string; preference?: UiLocalePreference; canChange: boolean; save: (preference: UiLocalePreference) => Promise<void>; sync?: AccountSync };
type Props = { children: ReactNode; account?: AccountLocale };
function browserLanguages() { return typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]; }
function readGuestPreference(): UiLocalePreference {
  try { const saved = localStorage.getItem(localeStorageKey); return isUiLocalePreference(saved) ? saved : 'auto'; } catch { return 'auto'; }
}

// An identity change discards optimistic UI and old callbacks, not the owner's durable workspace data.
export function I18nProvider(props: Props) { return <LocaleScope key={props.account ? `account:${props.account.ownerId}` : 'guest'} {...props} />; }
function LocaleScope({ children, account }: Props) {
  const parent = useContext(I18nContext);
  const parentLocale = useRef(parent.locale); parentLocale.current = parent.locale;
  const scopeId = useId();
  const [guestPreference, setGuestPreference] = useState(readGuestPreference);
  const [pending, setPending] = useState<UiLocalePreference>();
  const [saveFailed, setSaveFailed] = useState(false);
  const version = useRef(0);
  const mounted = useRef(true);
  const source = account ? account.preference ?? 'auto' : guestPreference;
  const preference = pending ?? source;
  const locale = resolveLocale(preference, browserLanguages());
  const canChange = account?.canChange ?? true;
  const saving = pending !== undefined;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const html = document.documentElement;
    // A guest provider can remain above an account scope for sign-in messages.
    // Its storage events must not change the signed-in document's language.
    if (account) html.dataset.uiLocaleScope = scopeId;
    if (account || !html.dataset.uiLocaleScope) html.lang = locale === 'zh' ? 'zh-CN' : 'en';
    return () => {
      if (account && html.dataset.uiLocaleScope === scopeId) {
        delete html.dataset.uiLocaleScope;
        html.lang = parentLocale.current === 'zh' ? 'zh-CN' : 'en';
      }
    };
  }, [locale, account?.ownerId, scopeId]);
  useEffect(() => {
    if (account) return;
    const sync = (event: StorageEvent) => {
      if (event.key === localeStorageKey || event.key === null) {
        setGuestPreference(isUiLocalePreference(event.newValue) ? event.newValue : 'auto');
        setSaveFailed(false);
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [account?.ownerId]);
  function setPreference(next: UiLocalePreference) {
    if (!isUiLocalePreference(next) || !canChange) return;
    setSaveFailed(false);
    if (!account) {
      setGuestPreference(next);
      try { localStorage.setItem(localeStorageKey, next); } catch { setSaveFailed(true); }
      return;
    }
    const sequence = ++version.current;
    setPending(next);
    const finish = (failed: boolean) => {
      if (!mounted.current || version.current !== sequence) return;
      // The durable writer resolves after publishing its committed workspace.
      // Always release the overlay: a newer same-account value may have arrived
      // before this promise settles, so waiting to observe equality can pin it forever.
      setPending(undefined);
      setSaveFailed(failed);
    };
    try { void account.save(next).then(() => finish(false), () => finish(true)); }
    catch { finish(true); }
  }
  const value = useMemo(() => ({ locale, preference, canChange, saving, saveFailed, accountSync: account?.sync, setPreference,
    setLocale: (next: UiLocale) => setPreference(next), t: (zh: string, en: string) => translate(zh, en, locale) }),
  [locale, preference, canChange, saving, saveFailed, account?.save, account?.sync]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() { return useContext(I18nContext); }
