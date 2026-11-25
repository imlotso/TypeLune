import { useEffect, useRef, useState } from 'react';
import { useAdminNavigation } from '../components/AdminNavigationGuard';

export const adminTabs = ['overview', 'users', 'articles', 'scores', 'feedback', 'settings', 'appearance', 'footer', 'nicknames', 'seo', 'support', 'mail', 'audit'] as const;
export type AdminTab = typeof adminTabs[number];
export function readAdminTab(search = window.location.search): AdminTab {
  const value = new URLSearchParams(search).get('tab');
  return adminTabs.includes(value as AdminTab) ? value as AdminTab : 'overview';
}
const key = '__typeLuneAdminEntry';
type Entry = { session: string; index: number };
function entry(state: unknown): Entry | undefined {
  const value = state && typeof state === 'object' ? (state as Record<string, unknown>)[key] : undefined;
  if (!value || typeof value !== 'object') return;
  const item = value as Entry;
  return typeof item.session === 'string' && Number.isSafeInteger(item.index) ? item : undefined;
}
const address = (tab: AdminTab) => `/admin?tab=${tab}`;
const withEntry = (value: Entry) => ({ ...(window.history.state && typeof window.history.state === 'object' ? window.history.state : {}), [key]: value });

export function useAdminRoute() {
  const leave = useAdminNavigation();
  const [tab, setTab] = useState(readAdminTab);
  const current = useRef({ tab, entry: entry(window.history.state) ?? { session: `admin-${Date.now()}-${Math.random()}`, index: 0 } });
  const restoring = useRef(false);
  useEffect(() => {
    window.history.replaceState(withEntry(current.current.entry), '', address(current.current.tab));
    const pop = () => {
      if (restoring.current) { restoring.current = false; return; }
      const target = entry(window.history.state);
      const next = readAdminTab();
      const adminPath = /^\/admin\/?$/.test(window.location.pathname);
      const accepted = leave(() => {
        if (!adminPath) { window.location.reload(); return; }
        const nextEntry = target?.session === current.current.entry.session ? target : { ...current.current.entry, index: current.current.entry.index + 1 };
        current.current = { tab: next, entry: nextEntry };
        window.history.replaceState(withEntry(nextEntry), '', address(next));
        setTab(next);
      });
      if (!accepted) {
        const previous = current.current;
        if (target?.session === previous.entry.session && target.index !== previous.entry.index) {
          restoring.current = true;
          window.history.go(previous.entry.index - target.index);
        } else {
          // An unmarked history entry has no reliable direction. Keep its content
          // intact and append the retained editor rather than overwriting it.
          window.history.pushState(withEntry(previous.entry), '', address(previous.tab));
        }
      }
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [leave]);
  const navigate = (next: AdminTab) => {
    if (next === current.current.tab || restoring.current) return;
    leave(() => {
      const nextEntry = { ...current.current.entry, index: current.current.entry.index + 1 };
      window.history.pushState(withEntry(nextEntry), '', address(next));
      current.current = { tab: next, entry: nextEntry };
      setTab(next);
    });
  };
  return [tab, navigate] as const;
}
