import type { ReactNode } from 'react';
import type { useWorkspace } from '../hooks/useWorkspace';
import { I18nProvider } from '../lib/i18n';

export function WorkspaceI18nProvider({ ownerId, workspace, children }: { ownerId: string | null; workspace: ReturnType<typeof useWorkspace>; children: ReactNode }) {
  if (!ownerId) return children;
  // settingsReady alone is insufficient: a failed first GET also sets it true.
  const canChange = workspace.ready && (workspace.cloudLoaded || workspace.hasSavedSettings) && !workspace.recoveryReason;
  return <I18nProvider account={{ ownerId, preference: workspace.settings.uiLocale, canChange,
    sync: { state: workspace.syncState, retry: workspace.sync, needsRecovery: !!workspace.recoveryReason },
    save: (uiLocale) => canChange ? workspace.updateSettings({ uiLocale }) : Promise.reject(new Error('账号设置尚未读取')) }}>{children}</I18nProvider>;
}
