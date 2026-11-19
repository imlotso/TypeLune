import {ResultLayout} from './components/ResultLayout';
import {GuestNicknameField} from './components/GuestNicknameField';
import {saveSurfaceAppearance} from './lib/workspace';
import {effectiveSurface,surfaceStyle,type SurfaceAppearance} from './lib/surface-appearance';
import {saveAccountWallpaper} from './lib/account-wallpaper';
import { StatsView } from './components/StatsView';
import { RecordsView } from './components/RecordsView';
import { MistakesView } from './components/MistakesView';
import { DraftsView } from './components/DraftsView';
import { PublicArticleView } from './components/PublicArticleView';
import { ArticleLibrary } from './components/ArticleLibrary';
import { PageLoadBoundary } from './components/PageLoadBoundary';
import { preserveLanguageAddress, updatePageMetadata } from './lib/seo';
import { CourseLayout } from './components/CourseLayout';
import { saveWallpaper } from './lib/workspace';
import { pathForProfile, profileIdFromPath } from './lib/routes';
import { useDailyWallpaper } from './hooks/useDailyWallpaper';
import { useSiteWallpaper } from './hooks/useSiteWallpaper';
import type { BackgroundConfig } from './lib/background';
import { SystemMessage } from './components/SystemMessage';
import { useI18n } from './lib/i18n';
import { LanguageToggle } from './components/LanguageToggle';
import { WorkspaceI18nProvider } from './components/WorkspaceI18nProvider';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft } from '@phosphor-icons/react/ArrowLeft';
import { ShareNetwork } from '@phosphor-icons/react/ShareNetwork';
import { ArrowCounterClockwise } from '@phosphor-icons/react/ArrowCounterClockwise';
import { ArrowRight } from '@phosphor-icons/react/ArrowRight';
import { BookOpen } from '@phosphor-icons/react/BookOpen';
import { CaretDown } from '@phosphor-icons/react/CaretDown';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { Clock } from '@phosphor-icons/react/Clock';
import { Cloud } from '@phosphor-icons/react/Cloud';
import { Crosshair } from '@phosphor-icons/react/Crosshair';
import { Keyboard } from '@phosphor-icons/react/Keyboard';
import { Palette } from '@phosphor-icons/react/Palette';
import { Pause } from '@phosphor-icons/react/Pause';
import { Play } from '@phosphor-icons/react/Play';
import { Trophy } from '@phosphor-icons/react/Trophy';
import { BrandLogo } from './components/BrandLogo';
import { guestNicknamePrefix, validGuestNickname } from './lib/leaderboard';
import { AccountDialog } from './components/AccountDialog';
import { AccountMenu } from './components/AccountMenu';
import { CommandPalette, type Command } from './components/CommandPalette';
import { BackgroundDialog } from './components/BackgroundDialog';
import { AppearanceDialog } from './components/AppearanceDialog';
import { RoomBackground } from './components/RoomBackground';
import { AuthDialog } from './components/AuthDialog';
import { Dialog } from './components/Dialog';
import { EnglishSpeed } from './components/EnglishSpeed';
import { ScoreStatusView } from './components/ScoreStatusView';
import { FeedbackView, newFeedbackDraft, type FeedbackDraft } from './components/FeedbackView';
import { GuestImportDialog } from './components/GuestImportDialog';
import { PracticeLines } from './components/PracticeLines';
import { PersonalDataView } from './components/PersonalDataView';
import { PersonalBestComparison } from './components/PersonalBestComparison';
import { PaceIndicator } from './components/PaceIndicator';
import { PresetsDialog } from './components/PresetsDialog';
import { SettingsTransferDialog } from './components/SettingsTransferDialog';
import { ShareCardDialog } from './components/ShareCardDialog';
import { SpecialTrainingDialog } from './components/SpecialTrainingDialog';
import { LogoutDialog } from './components/LogoutDialog';
import { WorkspaceRecoveryDialog } from './components/WorkspaceRecoveryDialog';
import type { CapacityDestination } from './components/WorkspaceCapacity';
import { SettingsDialog } from './components/SettingsDialog';
import { SiteInfoView } from './components/SiteInfoView';
import { articles, type Difficulty, type Language } from './data/articles';
import { LessonsView, LessonGuide, LessonResult } from './components/LessonsView';
import { AssessmentPanel } from './components/AssessmentPanel';
import { assessmentArticle, isAssessmentArticle, isWeakKeyArticle } from './lib/assessment';
import { SiteFooter } from './components/SiteFooter';
import { lessonArticle, lessonCopy, lessonForArticle, type Lesson } from './lib/lessons';
import { canDiscardSavedDraft, continuationDraftId, deleteLocalHistory, discardSavedDraft, draftAwaitingStart, hasUnloadedLocalHistory, localHistory, practiceDraftId, readDraft, readDrafts, recoveryDraftFromSaved, savedPracticeFromLegacy, usePractice, type PracticeDraft } from './hooks/usePractice';
import { useWorkspace } from './hooks/useWorkspace';
import { useSiteFeatures } from './hooks/useSiteFeatures';
import { usePublicPageVisit } from './hooks/usePublicPageVisit';
import { useScoreStatus } from './hooks/useScoreStatus';
import { shortcutNames, useShortcuts, type ShortcutAction } from './hooks/useShortcuts';
import { api, apiPages, ApiError, type User } from './lib/api';
import { catalogSnapshotKey, compareDraftProgress, defaultPace, sameCompletedDraftProgress, sameDraftSnapshot, staleDraftBase, type ArticleSnapshot, type PaceSettings, type PracticePreset, type PracticeRecord, type PresetReading, type ReaderSettings, type SavedPractice } from './lib/models';
import type { PracticeSettingsFile } from './lib/practice-settings';
import { calculatePace, selectPaceTarget } from './lib/pace';
import { browserStatisticsTimeZone } from './lib/long-term-stats';
import { comparePersonalBest } from './lib/personal-best';
import { makeShareCardData } from './lib/share-card';
import { readableCharacter } from './lib/practice-lines';
import { countTyping, scoreFromCounts, splitCharacters } from './lib/scoring';
import { createRoundMistakeDrill } from './lib/analysis';
import { resolveTheme, themeStorageKey, type Theme } from './lib/theme';
import { allowLocalAccount, deleteWorkspaceDrafts, deleteWorkspaceValue, DraftDeletedError, isLocalAccountBlocked, isWorkspaceDraftDeleted, isWorkspaceFallbackDraft, localAccountBlockPrefix, markWorkspaceDraftFallback, mutateWorkspaceValue, putWorkspaceValue, readBlockedWorkspace, readWorkspace, workspaceValue } from './lib/workspace';
import { cancelLocalCleanup, finishLocalCleanup, pendingLocalCleanups, prepareLocalCleanup } from './lib/local-account-cleanup';
import { localPracticeRawFingerprint } from './lib/local-practice-unsynced';
import { resetWorkspaceFromCloud, WorkspaceResetIncompleteError } from './lib/workspace-recovery';
import { collectGuestImport } from './lib/guest-import';
import { readPagedHistory } from './lib/history';
import { deletePracticeRecords } from './lib/history-delete';
import { recordMatchesSavedRecovery, recoveryMatchesRecord } from './lib/result-recovery';
import { legacyConflictId, mergePracticeRecords, stableRecordId } from './lib/records';
import { articleIdFromPath, feedbackIdFromPath, mainRoute, navigationEntryIndex, navigationIndex, navigationState, pathForArticle, pathForFeedback, pathForRecord, pathForView, recordIdFromPath, type MainRoute, type MainView } from './lib/routes';

type View = MainRoute;
type PendingLoad = { legacy: PracticeDraft } | { draft: SavedPractice; newRound?: boolean; recoverCompleted?: boolean };

const builtIns: ArticleSnapshot[] = articles.map(({ content, ...article }) => ({ ...article, text: content, custom: false }));
const builtInById = new Map(builtIns.map((article) => [article.id, article]));
const AdminWorkspace = lazy(() => import('./components/AdminWorkspace').then(module => ({ default: module.AdminWorkspace })));

const PublicProfile = lazy(() => import('./components/PublicProfile').then(module => ({ default: module.PublicProfile })));
const RankingView = lazy(() => import('./components/RankingView').then(module => ({ default: module.RankingView })));

const recordViews: View[] = ['history', 'mistakes', 'stats', 'lessons'];
const authChangeKey = 'cloudtyping.auth-change.v1';

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function initialTheme(): Theme {
  let saved: string | null = null;
  try { saved = localStorage.getItem(themeStorageKey); } catch { /* The system preference is still available. */ }
  return resolveTheme(saved, typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

function legacyArticle(draft: PracticeDraft): ArticleSnapshot {
  const builtIn = builtInById.get(draft.articleId);
  if (draft.article) return { ...draft.article, text: draft.target };
  if (builtIn?.text === draft.target && builtIn.title === draft.title) return builtIn;
  return { id: draft.articleId, title: draft.title, text: draft.target, language: draft.language, difficulty: draft.difficulty, custom: draft.custom };
}

export function App() {
  const { t, locale } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accountNotice, setAccountNotice] = useState('');
  const [identityEpoch, setIdentityEpoch] = useState(0);
  const [pendingCleanup, setPendingCleanup] = useState<string[]>(pendingLocalCleanups);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const currentUser = useRef<User | null>(null);
  const [feedbackResume, setFeedbackResume] = useState<{ ownerId: string; draft: FeedbackDraft }>();
  const [guestOfferOwner, setGuestOfferOwner] = useState<string>();
  const pendingFeedback = useRef<FeedbackDraft | undefined>(undefined);
  const [previewOwner, setPreviewOwner] = useState<string>();
  const request = useRef<AbortController | null>(null);
  const changeUser = useCallback((next: User | null) => {
    request.current?.abort();
    const fromGuest = !currentUser.current;
    currentUser.current = next;
    setGuestOfferOwner(next && fromGuest ? next.id : undefined);
    if (next) { try { cancelLocalCleanup(next.id); } catch { allowLocalAccount(next.id); } setPendingCleanup(pendingLocalCleanups()); }
    try { localStorage.setItem(authChangeKey, `${Date.now()}-${Math.random()}`); } catch { /* The current tab still changes account. */ }
    setAccountNotice('');
    const handoff = next && pendingFeedback.current ? { ownerId: next.id, draft: pendingFeedback.current } : undefined;
    setFeedbackResume(handoff);
    pendingFeedback.current = undefined;
    setPreviewOwner(undefined);
    const path = next?.isAdmin ? (/^\/admin\/?$/.test(window.location.pathname) ? `/admin${window.location.search}` : '/admin') : !next ? '/' : handoff ? (feedbackIdFromPath(window.location.pathname) ? window.location.pathname : '/feedback') : mainRoute(window.location.pathname) === 'notfound' ? '/' : window.location.pathname;
    window.history.replaceState(null, '', path);
    setUser(next);
    setAuthReady(true);
  }, []);
  const updateUser = useCallback((next: User) => {
    request.current?.abort();
    if (currentUser.current?.id === next.id) {
      if (!next.isAdmin) setPreviewOwner(undefined);
      currentUser.current = next;
    }
    setUser((current) => current?.id === next.id ? next : current);
  }, []);
  async function retryCleanup() {
    setCleanupBusy(true);
    let failed = false;
    for (const owner of pendingLocalCleanups()) {
      try { await finishLocalCleanup(owner); } catch { failed = true; }
    }
    setPendingCleanup(pendingLocalCleanups());
    setAccountNotice(failed ? t("本机数据仍未完全清理，请检查浏览器存储后重试", "Local cleanup is incomplete. Check browser storage and retry.") : t("本机账号数据已清理", "Local account data cleared"));
    setCleanupBusy(false);
  }

  useEffect(() => {
    function checkAccount() {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      api<{ user: User | null }>('/api/me', { timeoutMs: 3000, signal: controller.signal }).then(({ user: current }) => {
        if (!controller.signal.aborted) {
          const accepted = current && !isLocalAccountBlocked(current.id) ? current : null;
          if (!accepted?.isAdmin || !currentUser.current?.isAdmin || accepted.id !== currentUser.current.id) setPreviewOwner(undefined);
          currentUser.current = accepted;
          setUser(accepted);
        }
      }).catch(() => {}).finally(() => {
        if (!controller.signal.aborted) setAuthReady(true);
      });
    }
    checkAccount();
    window.addEventListener('focus', checkAccount);
    const storage = (event: StorageEvent) => {
      if (event.key?.startsWith(localAccountBlockPrefix) && event.newValue === null) allowLocalAccount(event.key.slice(localAccountBlockPrefix.length));
      if (event.key === authChangeKey || event.key?.startsWith(localAccountBlockPrefix)) { setIdentityEpoch((value) => value + 1); checkAccount(); }
    };
    window.addEventListener('storage', storage);
    return () => {
      request.current?.abort();
      window.removeEventListener('focus', checkAccount);
      window.removeEventListener('storage', storage);
    };
  }, []);

  const inAdministration = !!user?.isAdmin && previewOwner !== user.id;
  useEffect(() => {
    if (!authReady || !user) return;
    if (inAdministration) updatePageMetadata('/admin', locale);
    if (inAdministration && window.location.pathname !== '/admin') window.history.replaceState(null, '', '/admin');
    else if (!inAdministration && /^\/admin\/?$/.test(window.location.pathname)) window.history.replaceState(null, '', '/');
  }, [authReady, user?.id, user?.isAdmin, inAdministration, locale]);
  if (!authReady && /^\/admin\/?$/.test(window.location.pathname)) return <div className="administration-session" role="status"><Cloud size={32} aria-hidden="true" />{t("正在读取账号…", "Loading account…")}</div>;
  if (inAdministration && user) return <PageLoadBoundary key={user.id} message={t("页面加载失败", "Could not load this page")} retryLabel={t("重新载入", "Reload")}><Suspense fallback={<div role="status" aria-live="polite">{t("正在读取账号…", "Loading account…")}</div>}><AdminWorkspace key={user.id} user={user} onLogout={() => changeUser(null)} onPreview={() => { window.history.replaceState(null, '', '/'); setPreviewOwner(user.id); }} /></Suspense></PageLoadBoundary>;
  return <PracticeApp key={`${user ? `account:${user.id}` : 'guest'}:${identityEpoch}`} user={user} authReady={authReady} onUser={changeUser}
    accountNotice={accountNotice} onAccountReauthentication={(message) => { changeUser(null); setAccountNotice(message); }}
    onSignedOutNotice={(message) => { setPendingCleanup(pendingLocalCleanups()); if (!currentUser.current) setAccountNotice(message); }}
    onWorkspaceReset={() => setIdentityEpoch((value) => value + 1)}
    guestImportOffer={!!user && guestOfferOwner === user.id} onDismissGuestImport={() => setGuestOfferOwner(undefined)}
    pendingCleanup={pendingCleanup.length} cleanupBusy={cleanupBusy} onRetryCleanup={() => void retryCleanup()}
    feedbackResume={feedbackResume && user && feedbackResume.ownerId === user.id ? feedbackResume.draft : undefined}
    onFeedbackHandoff={(draft) => { pendingFeedback.current = draft; }} onCancelFeedbackHandoff={() => { pendingFeedback.current = undefined; }}
    onUpdateUser={updateUser} onAdministration={user?.isAdmin ? () => setPreviewOwner(undefined) : undefined} />;
}

function PracticeApp(props: Omit<Parameters<typeof PracticeAppContent>[0], 'workspace'>) {
  const workspace = useWorkspace(props.user?.id ?? null, props.authReady);
  return <WorkspaceI18nProvider ownerId={props.user?.id ?? null} workspace={workspace}><PracticeAppContent {...props} workspace={workspace} /></WorkspaceI18nProvider>;
}

function PracticeAppContent({ workspace, user, authReady, onUser, onUpdateUser, accountNotice, onAccountReauthentication, onSignedOutNotice, onWorkspaceReset, guestImportOffer, onDismissGuestImport, pendingCleanup, cleanupBusy, onRetryCleanup, feedbackResume, onFeedbackHandoff, onCancelFeedbackHandoff, onAdministration }: { workspace: ReturnType<typeof useWorkspace>; user: User | null; authReady: boolean; onUser: (user: User | null) => void; onUpdateUser: (user: User) => void; accountNotice: string; onAccountReauthentication: (message: string) => void; onSignedOutNotice: (message: string) => void; onWorkspaceReset: () => void; guestImportOffer: boolean; onDismissGuestImport: () => void; pendingCleanup: number; cleanupBusy: boolean; onRetryCleanup: () => void; feedbackResume?: FeedbackDraft; onFeedbackHandoff: (draft: FeedbackDraft) => void; onCancelFeedbackHandoff: () => void; onAdministration?: () => void }) {
  const { t, locale } = useI18n();
  const difficultyNames: Record<Difficulty, string> = { beginner: t("入门", "Beginner"), intermediate: t("进阶", "Intermediate"), advanced: t("挑战", "Advanced") };
const languageNames: Record<Language, string> = { zh: t("中文", "Chinese"), en: 'English' };
  const ownerId = user?.id ?? null;

  const site = useSiteFeatures();
  const [selection, setSelection] = useState(builtIns[0]);
  const [publicArticles, setPublicArticles] = useState(builtIns);
  const [routeCatalog, setRouteCatalog] = useState<ArticleSnapshot[]>([]);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const refreshCatalog = useCallback(() => setCatalogRevision((revision) => revision + 1), []);
  const [guestTheme, setGuestTheme] = useState(initialTheme);
  const authCompleted = useRef(false);
  const [directAdmin] = useState(() => /^\/admin\/?$/.test(window.location.pathname));
  const [view, setView] = useState<View>(() => feedbackResume ? 'feedback' : directAdmin ? 'practice' : mainRoute(window.location.pathname));
  usePublicPageVisit(window.location.pathname, authReady && !user?.isAdmin);
  useEffect(() => { updatePageMetadata(window.location.pathname, locale); }, [view, locale]);
  const profileReturn = useRef('/rankings');
  const [routeProfileId, setRouteProfileId] = useState(() => profileIdFromPath(window.location.pathname));
  const [routeArticleId, setRouteArticleId] = useState(() => articleIdFromPath(window.location.pathname));
  const [routeRecordId, setRouteRecordId] = useState(() => recordIdFromPath(window.location.pathname));
  const [routeFeedbackId, setRouteFeedbackId] = useState(() => feedbackIdFromPath(window.location.pathname));
  const currentPath = useRef(window.location.pathname + window.location.search + window.location.hash);
  useEffect(() => { const update = () => { currentPath.current = window.location.pathname + window.location.search + window.location.hash; }; window.addEventListener('typelune:locale-url', update); return () => window.removeEventListener('typelune:locale-url', update); }, []);
  const currentHistoryIndex = useRef(0);
  const currentEntryIndex = useRef(navigationEntryIndex());
  const restoringHistory = useRef(false);
  const pendingHistoryAction = useRef<(() => void) | undefined>(undefined);
  const popRoute = useRef<() => void>(() => {});
  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft>(() => feedbackResume ?? newFeedbackDraft());
  const [adminLoginDismissed, setAdminLoginDismissed] = useState(false);
  const [minutesText, setMinutesText] = useState<string>();
  const [pendingTheme, setPendingTheme] = useState<Theme>();
  const [customDraft, setCustomDraft] = useState('');
  const [customError, setCustomError] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [showSpecialTraining, setShowSpecialTraining] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showSettingsTransfer, setShowSettingsTransfer] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showBackground, setShowBackground] = useState<Theme>();
  const [showAppearance, setShowAppearance] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [libraryInitialTab, setLibraryInitialTab] = useState<'all' | 'favorites' | 'private'>('all');
  const [focused, setFocused] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [accountGuard, setAccountGuard] = useState({ busy: false, dirty: false });
  const accountReturn = useRef<MainView>('practice');
  const [showLogout, setShowLogout] = useState<{ clear: boolean }>();
  const [showRecovery, setShowRecovery] = useState<'generation' | 'conflict'>();
  const [showGuestImport, setShowGuestImport] = useState(false);
  const [hasGuestData, setHasGuestData] = useState(false);
  const [confirmPractice, setConfirmPractice] = useState<{ action: 'restart' | 'finish'; resumeOnCancel: boolean } | null>(null);
  const [nickname, setNickname] = useState(guestNicknamePrefix);
  const [rankMessage, setRankMessage] = useState('');
  const [rankSubmitted, setRankSubmitted] = useState(false);
  const [scoreStatusRevision, setScoreStatusRevision] = useState(0);
  const [mistakeRepeats, setMistakeRepeats] = useState('3');
  const [busy, setBusy] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [feedback, setFeedback] = useState(accountNotice);
  const [pendingLoad, setPendingLoad] = useState<PendingLoad>();
  const [remoteHistory, setRemoteHistory] = useState<PracticeRecord[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [historyCheckedFor, setHistoryCheckedFor] = useState<string>();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [localRecordVersion, setLocalRecordVersion] = useState(0);
  const bootstrapped = useRef(false);
  const interacted = useRef(false);
  const navigation = useRef(false);
  const rankRequest = useRef(0);
  const moreMenu = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const focusButton = useRef<HTMLButtonElement>(null);
  const focusRoot = useRef<HTMLDivElement>(null);
  const live = useRef(true);
  const { language, difficulty, title: articleTitle, text } = selection;
  const selectedLesson = lessonForArticle(selection);
  const selectedAssessment = isAssessmentArticle(selection);
  const selectedWeakKeys = isWeakKeyArticle(selection);
  const selectedTraining = !!selectedLesson || selectedAssessment || selectedWeakKeys;
  const displayTitle = selectedLesson ? lessonCopy(selectedLesson.title, locale) : selectedAssessment ? assessmentArticle(locale).title : selectedWeakKeys ? t('薄弱键短练习', 'Weak-key practice') : articleTitle;
  const selectedMode = selectedTraining ? 'article' : workspace.settings.mode;
  const selectedStrict = selectedTraining ? false : workspace.settings.strict;
  const publicById = useMemo(() => new Map(publicArticles.map((article) => [article.id, catalogSnapshotKey(article)])), [publicArticles]);
  const selectedCatalogKey = useMemo(() => catalogSnapshotKey(selection), [selection]);
  const catalog = useMemo(() => [...publicArticles, ...workspace.privateArticles], [publicArticles, workspace.privateArticles]);
  const availableArticles = useMemo(() => catalog.filter((article) => article.language === language && article.difficulty === difficulty), [catalog, difficulty, language]);
  const configuredMinutes = minutesText ?? String(workspace.settings.minutes);
  const minutes = Number(configuredMinutes);
  const validDuration = /^\d+$/.test(configuredMinutes) && minutes >= 1 && minutes <= 60;
  const duration = validDuration ? minutes * 60 : workspace.settings.minutes * 60;
  const theme = user ? pendingTheme ?? workspace.settings.theme : guestTheme;
  const siteWallpaper = useSiteWallpaper(theme,authReady);
  const [surfacePreview,setSurfacePreview]=useState<{theme:'light'|'dark';value:SurfaceAppearance}>();
  const followsSite=(mode:'light'|'dark')=>workspace.settings.wallpaperFollowSite?.[mode]!==false;
  const siteBackground=(mode:'light'|'dark')=>siteWallpaper?{...siteWallpaper,shade:mode==='dark'?45:25}:undefined;
  const backgroundFor=(mode:'light'|'dark')=>followsSite(mode)?(siteWallpaper?{...siteBackground(mode)!,...workspace.settings.backgroundPresentation?.[mode]}:undefined):workspace.backgrounds[mode]??siteBackground(mode);
  const editorBackground=(mode:'light'|'dark')=>({...backgroundFor(mode)??{image:'/assets/lake-default.webp',name:'TypeLune',width:2560,height:1440,fit:'cover' as const,positionX:50,positionY:50,blur:0,shade:mode==='dark'?40:20},...effectiveSurface(mode,workspace.settings.surfaceAppearance?.[mode],backgroundFor(mode))});
  const editorValue=useMemo(()=>showBackground?editorBackground(showBackground):undefined,[showBackground,siteWallpaper,workspace.backgrounds.light,workspace.backgrounds.dark,workspace.settings.surfaceAppearance,workspace.settings.backgroundPresentation,workspace.settings.wallpaperFollowSite]);
  const activeSurface=effectiveSurface(theme,surfacePreview?.theme===theme?surfacePreview.value:workspace.settings.surfaceAppearance?.[theme],backgroundFor(theme));
  useDailyWallpaper(ownerId, theme, workspace.settings, workspace.backgrounds[theme], authReady && workspace.ready && (!ownerId || workspace.cloudLoaded) && !showBackground);
  const ready = authReady && workspace.ready;
  const adminLogin = directAdmin && authReady && !user && !adminLoginDismissed;
  const reportSaveError = useCallback(() => { if (live.current) setFeedback(t("无法保存进度，请复制输入后再关闭页面", "Progress could not be saved. Copy your input before closing.")); }, []);
  const paceSettings = workspace.settings.pace ?? defaultPace;
  const paceRecords = useMemo(() => {
    if (!paceSettings.enabled || paceSettings.source === 'custom') return [];
    const deleted = new Set(workspace.deletedRecordIds);
    return mergePracticeRecords(localHistory().filter((record) => (record.ownerId ?? null) === ownerId), remoteHistory, workspace.records).filter((record) => !deleted.has(stableRecordId(record)));
  }, [ownerId, remoteHistory, workspace.records, workspace.deletedRecordIds, localRecordVersion, paceSettings.enabled, paceSettings.source]);
  const paceReference = useMemo<PracticeRecord>(() => ({ recordId: '__pace_reference__', language, difficulty, duration, mode: workspace.settings.mode,
    strict: workspace.settings.strict, offset: 0, speed: 0, accuracy: 0, finishedAt: 0, article: selection }), [language, difficulty, duration, workspace.settings.mode, workspace.settings.strict, selection]);
  const selectedPaceTarget = useMemo(() => !user || paceSettings.source === 'custom' || historyLoaded
    ? selectPaceTarget(paceReference, paceRecords, paceSettings) : undefined, [user, paceSettings, historyLoaded, paceReference, paceRecords]);
  const saveWorkspaceDraft = useCallback((draft: SavedPractice) => mutateWorkspaceValue(draft.ownerId, 'draft', draft.id, (previous) => previous &&
    (staleDraftBase(draft, previous) || compareDraftProgress(previous, draft) > 0 || (compareDraftProgress(previous, draft) === 0 && !sameDraftSnapshot(previous, draft))) ? previous : draft), []);

  const practice = usePractice({
    article: selection, articleId: selection.id, title: displayTitle, text, language, difficulty, duration,
    custom: selection.custom || publicById.get(selection.id) !== selectedCatalogKey,
    guardCatalog: true, onCatalogStale: refreshCatalog, ownerId,
    guestOnlineAllowed: site.features?.guestPracticeEnabled,
    paceTarget: selectedPaceTarget,
    mode: selectedMode, strict: selectedStrict, autoPause: workspace.settings.autoPause,
    onRecord(record) {
      setLocalRecordVersion((version) => version + 1);
      if (record.recordId) void putWorkspaceValue(record.ownerId ?? null, 'record', record.recordId, record).catch(reportSaveError);
    },
    onReplaceRecord(id, owner) {
      void deleteWorkspaceValue(owner, 'record', id).catch(reportSaveError);
    },
    onDraft(draft) {
      return saveWorkspaceDraft(draft).catch((error: unknown) => {
        if (error instanceof DraftDeletedError) throw error;
        reportSaveError();
        throw error;
      });
    },
    async onParkDraft(draft) {
      try {
        await saveWorkspaceDraft(draft);
        await markWorkspaceDraftFallback(draft.ownerId, draft);
        return true;
      } catch { return false; }
    },
    isWorkspaceFallback: (id, owner) => isWorkspaceFallbackDraft(owner, id),
    isDraftDeleted: (id, owner) => isWorkspaceDraftDeleted(owner, id),
    onRemoveDraft(id, owner) {
      void deleteWorkspaceValue(owner, 'draft', id).catch(reportSaveError);
    },
  }, null);
  const { phase, target, typed, result } = practice;
  const resultTraining = !!lessonForArticle(result?.record?.article) || isAssessmentArticle(result?.record?.article) || isWeakKeyArticle(result?.record?.article);
  const resultStatus = useScoreStatus(result?.attemptId, ownerId, !!result && !result.offline && showResult, scoreStatusRevision);
  const roundDrillAvailable = useMemo(() => result?.record ? createRoundMistakeDrill(result.record, 1) : undefined, [result]);
  const roundDrill = useMemo(() => result?.record ? createRoundMistakeDrill(result.record, Number(mistakeRepeats)) : undefined, [result, mistakeRepeats]);
  const currentResult = useRef(result);
  currentResult.current = result;
  const locked = !['ready', 'finished'].includes(phase);
  const currentMode = phase === 'ready' ? selectedMode : practice.mode;
  const currentDuration = phase === 'ready' ? duration : practice.duration;
  const currentStrict = phase === 'ready' ? selectedStrict : practice.strict;
  const canStart = ready && !pendingLoad && !accountBusy && !locked && (validDuration || currentMode === 'article');
  const typedCharacters = useMemo(() => splitCharacters(typed), [typed]);
  const targetCharacters = useMemo(() => splitCharacters(target), [target]);
  const { correct, total } = useMemo(() => countTyping(targetCharacters, typedCharacters, practice.offset), [targetCharacters, typedCharacters, practice.offset]);
  const previewScore = useMemo(() => scoreFromCounts(correct, total, Math.max(practice.elapsedMs / 1000, 0.1)), [correct, total, practice.elapsedMs]);
  const activePaceTarget = phase === 'ready' ? selectedPaceTarget : practice.paceTarget;
  const paceProgress = activePaceTarget !== undefined && phase !== 'ready' ? calculatePace(previewScore.correct, practice.elapsedMs, activePaceTarget, language) : undefined;
  const clockMs = currentMode === 'article' ? practice.elapsedMs : Math.max(0, currentDuration * 1000 - practice.elapsedMs);
  const practiceNotice = feedback || practice.feedback || (!locked && currentMode === 'timed' && !validDuration ? t("时长须为 1–60 分钟的整数。", "Enter a whole number from 1 to 60 minutes.") : '') ||
    (!user && phase === 'ready' && !selection.custom && site.features?.guestPracticeEnabled === false ? t("游客在线练习已关闭，本轮仅本机保存。", "Guest online practice is disabled. This session is saved locally.") : '');
  const mistakes = useMemo(() => typedCharacters.flatMap((character, index) => index >= practice.offset && character !== targetCharacters[index] ? [{ index, expected: targetCharacters[index], actual: character }] : []), [typedCharacters, targetCharacters, practice.offset]);

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);
  useEffect(() => { if (accountNotice) setFeedback(accountNotice); }, [accountNotice]);
  useEffect(() => {
    let active = true;
    if (!user || !guestImportOffer) { setHasGuestData(false); return; }
    void collectGuestImport(user.id).then((plan) => { if (active) setHasGuestData(plan.items.length > 0); }).catch(() => { if (active) setHasGuestData(true); });
    return () => { active = false; };
  }, [user?.id, guestImportOffer]);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogState('loading');
    void apiPages<ArticleSnapshot>('/api/articles', 'articles', { signal: controller.signal }).then((published) => {
      if (!Array.isArray(published) || published.some((article) => !article || typeof article.id !== 'string' || typeof article.title !== 'string' || typeof article.text !== 'string' || article.custom !== false || !['zh', 'en'].includes(article.language) || !['beginner', 'intermediate', 'advanced'].includes(article.difficulty))) throw new Error(t("文章目录无法读取", "Could not load articles"));
      if (controller.signal.aborted) return;
      setRouteCatalog(published); setCatalogState('ready');
      if (!published.length) return;
      setPublicArticles(published);
      if (!interacted.current) setSelection((current) => current === builtIns[0] ? published[0] : current);
    }).catch(() => { if (!controller.signal.aborted) setCatalogState('error'); });
    return () => controller.abort();
  }, [catalogRevision]);

  useEffect(() => {
    if (!ready || bootstrapped.current || (ownerId && !workspace.cloudLoaded)) return;
    bootstrapped.current = true;
    const deleted = new Set(workspace.deletedDraftIds);
    const preferred = readDraft(ownerId);
    const recoverable = (draft: PracticeDraft) => !draftAwaitingStart(draft) && !deleted.has(practiceDraftId(draft.recordId));
    const legacy = preferred && recoverable(preferred) ? preferred : readDrafts(ownerId).find(recoverable);
    if (!interacted.current && phase === 'ready' && legacy) {
      const synced = workspace.drafts.find((draft) => draft.recordId === legacy.recordId && draft.article.id === legacy.articleId &&
        draft.article.text === legacy.target && draft.duration === legacy.duration && draft.mode === (legacy.mode ?? 'timed') && draft.strict === !!legacy.strict);
      const localSnapshot = savedPracticeFromLegacy(legacy);
      if (synced && (compareDraftProgress(synced, localSnapshot) > 0 ||
        (compareDraftProgress(synced, localSnapshot) === 0 && !sameDraftSnapshot(synced, localSnapshot)))) {
        setSelection(synced.article); setPendingLoad({ draft: synced });
      } else {
        setSelection(legacyArticle(legacy)); setPendingLoad({ legacy });
      }
    }
  }, [ready, ownerId, phase, workspace.cloudLoaded, workspace.deletedDraftIds]);

  const loadCurrent = useRef(practice);
  loadCurrent.current = practice;
  useEffect(() => {
    if (!pendingLoad) return;
    setPendingLoad(undefined);
    if ('legacy' in pendingLoad) void loadCurrent.current.loadLegacy(pendingLoad.legacy);
    else if (pendingLoad.recoverCompleted) void loadCurrent.current.loadCompletedSaved(pendingLoad.draft);
    else void loadCurrent.current.loadSaved(pendingLoad.draft, { newRound: pendingLoad.newRound });
  }, [pendingLoad]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (pendingTheme === workspace.settings.theme) setPendingTheme(undefined);
  }, [pendingTheme, workspace.settings.theme]);

  useEffect(() => {
    if (minutesText !== undefined && validDuration && minutes === workspace.settings.minutes) setMinutesText(undefined);
  }, [minutes, minutesText, validDuration, workspace.settings.minutes]);

  useEffect(() => {
    if (result) { setRankMessage(result.submitted ? t("已提交，正在确认排行状态。", "Submitted. Checking leaderboard status.") : ''); setRankSubmitted(!!result.submitted); setShowResult(true); }
  }, [result]);
  useEffect(() => {
    if (resultStatus.status && ['pending', 'ranked', 'published', 'rejected', 'removed'].includes(resultStatus.status.state)) {
      setRankSubmitted(true); setRankMessage('');
    }
  }, [resultStatus.status]);

  useEffect(() => {
    const needsPaceHistory = view === 'practice' && paceSettings.enabled && paceSettings.source !== 'custom';
    if (!ownerId || (!recordViews.includes(view) && !result && !needsPaceHistory)) return;
    const controller = new AbortController();
    setHistoryError(false); setHistoryLoaded(false);
    const loaded: PracticeRecord[] = [];
    void readPagedHistory(ownerId, { signal: controller.signal, onPage: (entries) => loaded.push(...entries) }).then((entries) => {
      if (!controller.signal.aborted) { setRemoteHistory(entries); setHistoryCheckedFor(result?.recordId); setHistoryLoaded(true); }
    }).catch(() => {
      if (!controller.signal.aborted) { setRemoteHistory(loaded); setHistoryError(true); setHistoryCheckedFor(result?.recordId); setHistoryLoaded(true); }
    });
    return () => controller.abort();
  }, [view, ownerId, result, paceSettings.enabled, paceSettings.source, historyRevision]);

  useEffect(() => {
    if (!workspace.ready || !workspace.deletedRecordIds.length) return;
    try { if (deleteLocalHistory(ownerId, [...workspace.deletedRecordIds], [...workspace.deletedLocalConflictIds], workspace.deletedLocalConflictBases)) setLocalRecordVersion((version) => version + 1); }
    catch { reportSaveError(); }
  }, [ownerId, workspace.ready, workspace.deletedRecordIds, workspace.deletedLocalConflictIds, workspace.deletedLocalConflictBases, reportSaveError]);

  useEffect(() => {
    if (view !== 'stats' || !workspace.settingsReady || workspace.settings.statisticsTimezone || (ownerId && !workspace.cloudLoaded)) return;
    void workspace.ensureStatisticsTimezone(browserStatisticsTimeZone()).catch(reportSaveError);
  }, [view, ownerId, workspace.settingsReady, workspace.cloudLoaded, workspace.settings.statisticsTimezone, workspace.ensureStatisticsTimezone, reportSaveError]);

  const records = useMemo(() => {
    if (!authReady) return [];
    const local = localHistory().filter((record) => (record.ownerId ?? null) === ownerId);
    const deleted = new Set(workspace.deletedRecordIds);
    const conflicts = new Set(Object.values(workspace.deletedLocalConflictBases));
    return mergePracticeRecords(local, remoteHistory, workspace.records).filter((record) => !deleted.has(stableRecordId(record)) &&
      !(conflicts.size && record.legacyLocalIds?.length && conflicts.has(legacyConflictId(record))));
  }, [authReady, ownerId, remoteHistory, workspace.records, workspace.deletedRecordIds, workspace.deletedLocalConflictBases, localRecordVersion, result, view]);
  async function deleteRecords(selected: PracticeRecord[]) {
    if (ownerId && (!workspace.cloudLoaded || !historyLoaded || historyError)) throw new Error(t("记录仍在读取，请稍后重试", "Records are loading. Try again shortly."));
    const current = selected.map((record) => records.find((entry) => stableRecordId(entry) === stableRecordId(record) &&
      (!record.legacyLocalIds?.length || legacyConflictId(entry) === legacyConflictId(record))));
    if (current.some((record) => !record)) throw new Error(t("记录已更新，请重新选择后删除", "Records changed. Select them again before deleting."));
    const ids = new Set(await deletePracticeRecords(ownerId, current as PracticeRecord[]));
    if (!live.current) return;
    setRemoteHistory((current) => current.filter((record) => !ids.has(stableRecordId(record))));
    setLocalRecordVersion((version) => version + 1);
    if (ownerId) void workspace.sync();
  }
  const shareData = useMemo(() => {
    if (!result?.record) return undefined;
    const complete = !hasUnloadedLocalHistory() && (!user || (historyCheckedFor === result.recordId && !historyError && workspace.cloudLoaded && workspace.syncState === 'synced'));
    const comparison = comparePersonalBest(result.record, records);
    try { return makeShareCardData(result.record, window.location.origin, user ? user.displayName || user.username : nickname, complete && comparison?.improvement != null, result.score.cpm); }
    catch { return undefined; }
  }, [result, records, user, nickname, historyCheckedFor, historyError, workspace.cloudLoaded, workspace.syncState]);

  const draftBox = useMemo(() => {
    if (!ready || (view !== 'drafts' && view !== 'history' && view !== 'lessons')) return { drafts: [], completed: [] };
    const drafts = new Map(workspace.drafts.map((draft) => [draft.recordId, draft]));
    const deleted = new Set(workspace.deletedDraftIds);
    const completed: PracticeDraft[] = [];
    for (const draft of readDrafts(ownerId)) {
      if (draftAwaitingStart(draft) || deleted.has(practiceDraftId(draft.recordId))) continue;
      if (draft.completed) {
        const synced = drafts.get(draft.recordId);
        const local = savedPracticeFromLegacy(draft);
        if (synced && !sameCompletedDraftProgress(synced, local) && (compareDraftProgress(synced, local) > 0 ||
          (compareDraftProgress(synced, local) === 0 && !sameDraftSnapshot(synced, local)))) continue;
        drafts.delete(draft.recordId);
        completed.push(draft);
      } else if (!drafts.has(draft.recordId) && !deleted.has(practiceDraftId(draft.recordId))) {
        drafts.set(draft.recordId, savedPracticeFromLegacy(draft));
      }
    }
    return { drafts: [...drafts.values()], completed };
  }, [ready, view, ownerId, workspace.drafts, workspace.deletedDraftIds]);

  useEffect(() => {
    if (!showMore) return;
    const closeOutside = (event: PointerEvent) => {
      if (!moreMenu.current?.contains(event.target as Node)) setShowMore(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setShowMore(false); moreButton.current?.focus(); }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [showMore]);

  useEffect(() => {
    if (!focused) return;
    focusButton.current?.focus();
    let wasFullscreen = document.fullscreenElement === focusRoot.current;
    const fullscreenChange = () => {
      if (document.fullscreenElement === focusRoot.current) wasFullscreen = true;
      else if (wasFullscreen) setFocused(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !showResult && !showShare && !confirmPractice && !showSettings && !showPresets && !showSettingsTransfer && !showCommands && !showAppearance && !showBackground && !showRecovery && !showGuestImport && !showSpecialTraining) exitFocus();
    };
    document.addEventListener('fullscreenchange', fullscreenChange);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenChange);
      document.removeEventListener('keydown', escape);
    };
  }, [focused, showResult, showShare, confirmPractice, showSettings, showPresets, showSettingsTransfer, showCommands, showAppearance, showBackground, showRecovery, showGuestImport, showSpecialTraining]);

  function exitFocus() {
    setFocused(false);
    if (document.fullscreenElement === focusRoot.current) void document.exitFullscreen?.().catch(() => {});
  }

  function enterFocus() {
    setShowSettings(false);
    commitView('practice');
    setFocused(true);
    try { void focusRoot.current?.requestFullscreen?.().catch(() => {}); } catch { /* Embedded preview still uses focus layout. */ }
  }

  function changeTheme(next: Theme) {
    if (next === theme) return;
    if (user) {
      setPendingTheme(next);
      void workspace.updateSettings({ theme: next }).catch(() => {
        setPendingTheme((pending) => pending === next ? undefined : pending);
        reportSaveError();
      });
      return;
    }
    setGuestTheme(next);
    try { localStorage.setItem(themeStorageKey, next); } catch { /* The current view still changes. */ }
  }

  function updateSettings(patch: Partial<ReaderSettings>) {
    if (patch.minutes !== undefined) setMinutesText(String(patch.minutes));
    if (phase === 'finished' && (patch.mode !== undefined || patch.strict !== undefined || patch.minutes !== undefined)) {
      resetPractice(selection, true);
    }
    return workspace.updateSettings(patch).catch((problem: unknown) => { reportSaveError(); throw problem; });
  }

  async function applyPracticeConfiguration(choice: { language: Language; difficulty: Difficulty; mode: ReaderSettings['mode']; minutes: number; strict: boolean; autoPause: boolean; reading?: PresetReading; pace?: PaceSettings; shortcutsEnabled?: boolean }, presets?: PracticePreset[]) {
    const nextArticle = selection.language === choice.language && selection.difficulty === choice.difficulty ? selection :
      publicArticles.find((article) => article.language === choice.language && article.difficulty === choice.difficulty);
    if (!nextArticle) throw new Error(t("该语言和难度暂无文章", "No articles for this language and difficulty"));
    if (locked && !await practice.park(true)) throw new Error(t("当前进度保存失败，请重试", "Could not save progress. Please retry."));
    try {
      await workspace.updateSettings({ mode: choice.mode, minutes: choice.minutes, strict: choice.strict, autoPause: choice.autoPause, ...(choice.pace && { pace: choice.pace }),
        ...(choice.shortcutsEnabled !== undefined && { shortcutsEnabled: choice.shortcutsEnabled }),
        ...(choice.reading ?? {}), ...(presets && { presets }) });
    } catch (problem) { practice.releaseParkedLease(); throw problem; }
    if (!live.current) return;
    setMinutesText(String(choice.minutes));
    resetPractice(nextArticle, true);
    setFeedback(presets ? t("设置已导入，本机已保存。", "Settings imported and saved locally.") : t("预设已应用。", "Preset applied."));
    commitView('practice'); setShowPresets(false); setShowSettingsTransfer(false);
  }

  async function importPracticeConfiguration(file: PracticeSettingsFile) {
    const { language: selectedLanguage, difficulty: selectedDifficulty, mode, minutes, strict, autoPause, pace, shortcutsEnabled, fontSize, lineHeight, visibleLines, showTimer, showSpeed, showAccuracy } = file.settings;
    await applyPracticeConfiguration({ language: selectedLanguage, difficulty: selectedDifficulty, mode, minutes, strict, autoPause, pace, shortcutsEnabled,
      reading: { fontSize, lineHeight, visibleLines, showTimer, showSpeed, showAccuracy } }, file.presets);
  }

  function resetPractice(article = selection, keepDraft = false) {
    interacted.current = true;
    ++rankRequest.current;
    setBusy(false);
    setSelection(article);
    practice.reset(article.text, { keepDraft });
    setShowResult(false);
    setRankMessage('');
    setRankSubmitted(false);
    setFeedback('');
  }

  async function afterPark(action: () => void | Promise<void>) {
    if (navigation.current) return;
    navigation.current = true;
    interacted.current = true;
    try {
      if (locked && !await practice.park()) {
        if (phase === 'starting' || phase === 'finishing') setFeedback(t("练习保存中…", "Saving practice…"));
        return;
      }
      ++rankRequest.current;
      setBusy(false);
      const pending = live.current ? action() : undefined;
      if (pending) await pending;
    } finally {
      navigation.current = false;
    }
  }

  function commitAddress(path: string, next: View) {
    path = preserveLanguageAddress(path);
    const pathname = new URL(path, window.location.origin).pathname;
    if (window.location.pathname + window.location.search + window.location.hash !== path) {
      currentHistoryIndex.current++;
      window.history.pushState(navigationState(window.history.state, currentHistoryIndex.current), '', path);
    }
    currentPath.current = window.location.pathname + window.location.search + window.location.hash;
    currentEntryIndex.current = navigationEntryIndex();
    setView(next); setRouteProfileId(profileIdFromPath(window.location.pathname)); setRouteArticleId(articleIdFromPath(pathname)); setRouteRecordId(recordIdFromPath(pathname)); setRouteFeedbackId(feedbackIdFromPath(pathname));
  }
  function commitView(next: MainView) { commitAddress(pathForView(next), next); }

  function openPublicArticle(id: string) {
    void afterPark(() => { setShowResult(false); setFeedback(''); commitAddress(pathForArticle(id), 'article'); });
  }

  function openProfile(id: string) { void afterPark(() => { profileReturn.current = view === 'rankings' ? window.location.pathname + window.location.search + window.location.hash : '/rankings'; setShowResult(false); commitAddress(pathForProfile(id), 'profile'); }); }
  function openRecord(id: string) { commitAddress(pathForRecord(id), 'history'); }
  function openFeedback(id: string) { commitAddress(pathForFeedback(id), 'feedback'); }

  function navigate(next: MainView) {
    if (restoringHistory.current) { pendingHistoryAction.current = () => navigate(next); return; }
    setShowMore(false);
    if (next === view && window.location.pathname === pathForView(next)) return;
    void afterPark(() => { setShowResult(false); setFeedback(''); if (next === 'library') setLibraryInitialTab('all'); if (focused && next !== 'practice') exitFocus(); commitView(next); });
  }

  function manageCapacity(destination: CapacityDestination) {
    void afterPark(() => {
      if (destination === 'favorite' || destination === 'article') {
        setLibraryInitialTab(destination === 'favorite' ? 'favorites' : 'private');
        commitView('library');
      } else if (destination === 'draft') commitView('drafts');
      else if (destination === 'record') commitView('history');
      else setShowBackground(destination === 'background-light' ? 'light' : 'dark');
    });
  }

  popRoute.current = () => {
    if (restoringHistory.current) {
      restoringHistory.current = false;
      const pending = pendingHistoryAction.current; pendingHistoryAction.current = undefined;
      if (pending) queueMicrotask(pending);
      return;
    }
    const nextPath = window.location.pathname;
    const nextAddress = nextPath + window.location.search + window.location.hash;
    const targetIndex = navigationIndex(window.history.state);
    const targetEntryIndex = navigationEntryIndex();
    const restoreAddress = () => {
      if (targetEntryIndex !== undefined && currentEntryIndex.current !== undefined && targetEntryIndex !== currentEntryIndex.current) {
        restoringHistory.current = true;
        window.history.go(currentEntryIndex.current - targetEntryIndex);
      } else if (targetIndex !== undefined && targetIndex !== currentHistoryIndex.current) {
        restoringHistory.current = true;
        window.history.go(currentHistoryIndex.current - targetIndex);
      } else {
        // An unmarked history entry has no reliable direction or distance in
        // older browsers. Leave it intact and keep the current view in memory.
        setFeedback(t("无法保存进度，请复制输入后再关闭页面", "Progress could not be saved. Copy your input before closing."));
      }
    };
    // Browser back first dismisses a dialog, allowing its own unsaved-change
    // confirmation to run before the underlying view can be replaced.
    const accountDialog = view === 'account' && !!user;
    const routedDialog = (view === 'history' && !!routeRecordId) || (accountDialog && !accountGuard.busy && !accountGuard.dirty);
    if (document.querySelector('[role="dialog"]') && !routedDialog) {
      restoreAddress();
      if (!accountDialog || !accountGuard.busy) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    let applied = false;
    void afterPark(() => {
      const next = mainRoute(nextPath);
      setShowMore(false); setShowResult(false); setFeedback('');
      if (focused && next !== 'practice') exitFocus();
      setView(next); setRouteProfileId(profileIdFromPath(window.location.pathname)); setRouteArticleId(articleIdFromPath(nextPath)); setRouteRecordId(recordIdFromPath(nextPath)); setRouteFeedbackId(feedbackIdFromPath(nextPath));
      const settledAddress = window.location.pathname + window.location.search + window.location.hash;
      currentPath.current = settledAddress;
      currentEntryIndex.current = targetEntryIndex;
      if (targetIndex !== undefined) currentHistoryIndex.current = targetIndex;
      else window.history.replaceState(navigationState(window.history.state, currentHistoryIndex.current), '', settledAddress);
      applied = true;
    }).finally(() => { if (!applied && live.current) restoreAddress(); });
  };
  useEffect(() => {
    currentHistoryIndex.current = navigationIndex(window.history.state) ?? 0;
    currentEntryIndex.current = navigationEntryIndex();
    if (navigationIndex(window.history.state) === undefined) window.history.replaceState(navigationState(window.history.state, currentHistoryIndex.current), '', window.location.href);
    const pop = () => popRoute.current();
    const syncLocaleAddress = () => { currentPath.current = window.location.pathname + window.location.search + window.location.hash; };
    window.addEventListener('popstate', pop);
    window.addEventListener('typelune:locale-url', syncLocaleAddress);
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('typelune:locale-url', syncLocaleAddress); };
  }, []);

  function openSettings() {
    setShowMore(false);
    void afterPark(() => setShowSettings(true));
  }

  function openCommands() {
    setShowMore(false);
    void afterPark(() => setShowCommands(true));
  }

  function selectLesson(lesson: Lesson) { selectArticle(lessonArticle(lesson, locale)); }

  function selectArticle(article: ArticleSnapshot) {
    void afterPark(() => {
      resetPractice(article, true);
      commitView('practice');
    });
  }

  function continueDraft(draft: SavedPractice, newRound = false) {
    void afterPark(() => {
      setShowResult(false);
      setFeedback('');
      setSelection(draft.article);
      const legacy = !newRound && readDrafts(ownerId).find((item) => item.legacy && item.recordId === draft.recordId);
      setPendingLoad(legacy ? { legacy } : { draft, newRound });
      commitView('practice');
    });
  }

  function continueRecord(record: PracticeRecord) {
    if (!record.article || record.typed == null) return;
    const article = record.article;
    const continuationId = record.recordId ? continuationDraftId(record.recordId) : undefined;
    const saved = workspace.drafts.find((draft) => draft.id === continuationId);
    const typed = splitCharacters(record.typed);
    const expected = splitCharacters(article.text);
    const wrong = record.strict ? typed.findIndex((character, index) => character !== expected[index]) : -1;
    const offset = wrong >= 0 ? wrong : typed.length;
    if (saved && (saved.offset >= offset || splitCharacters(saved.typed).length >= typed.length)) {
      continueDraft(saved);
      return;
    }
    const recordId = `resume-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const draft: SavedPractice = {
      id: practiceDraftId(recordId), article, typed: record.typed, elapsedMs: 0, backspaces: 0, duration: record.duration,
      mode: record.mode ?? 'timed', strict: !!record.strict, offset, recordId,
      ownerId, savedAt: Date.now(), offline: true,
    };
    continueDraft(draft, true);
  }

  function recoverCompletedDraft(draft: PracticeDraft, rankingOnly = false) {
    void afterPark(() => {
      const latest = readDrafts(ownerId).find((item) => item.recordId === draft.recordId && item.completed);
      if (!latest || !sameCompletedDraftProgress(savedPracticeFromLegacy(latest), savedPracticeFromLegacy(draft))) { setFeedback(t("恢复资料已变化，请重新查看", "Recovery data changed. Check again.")); return; }
      if (rankingOnly) {
        const available = practice.describeResultRecovery(latest);
        if (!available.available) { setFeedback(available.reason); return; }
      }
      setShowResult(false); setFeedback(''); setSelection(legacyArticle(latest));
      setPendingLoad({ legacy: latest }); commitView('practice');
    });
  }
  function recoverSynchronizedResult(record: PracticeRecord, saved: SavedPractice) {
    void afterPark(async () => {
      let latest: SavedPractice | undefined;
      try { latest = workspaceValue(await readWorkspace(ownerId), 'draft', saved.id); }
      catch { setFeedback(t("恢复资料无法读取", "Could not read recovery data")); return; }
      if (!live.current) return;
      if (!latest || latest.ownerId !== ownerId || !recordMatchesSavedRecovery(record, latest)) { setFeedback(t("恢复资料已变化，请重新查看", "Recovery data changed. Check again.")); return; }
      if (practice.isStoredDraftLeased(latest.recordId)) { setFeedback(t("进度正在其他页面使用", "Progress is in use in another tab")); return; }
      const available = practice.describeResultRecovery(recoveryDraftFromSaved(latest));
      if (!available.available) { setFeedback(available.reason); return; }
      setShowResult(false); setFeedback(''); setSelection(latest.article);
      setPendingLoad({ draft: latest, recoverCompleted: true }); commitView('practice');
    });
  }
  function recoveryForRecord(record: PracticeRecord) {
    if (record.article?.custom || (record.offset ?? 0) > 0) return { available: false, reason: t("个人练习不参与排行", "Private practice is not ranked") };
    const matches = draftBox.completed.filter((draft) => recoveryMatchesRecord(draft, record.recordId));
    for (const draft of matches) {
      const result = practice.describeResultRecovery(draft);
      if (result.available) return { available: true, recover: () => recoverCompletedDraft(draft, true) };
    }
    if (matches.length) {
      const result = practice.describeResultRecovery(matches[0]);
      return { available: false, reason: result.available ? t("此设备没有可用或一致的恢复资料", "No matching recovery data on this device") : result.reason };
    }
    if (ownerId) {
      for (const saved of workspace.drafts.filter((draft) => recordMatchesSavedRecovery(record, draft))) {
        if (practice.isStoredDraftLeased(saved.recordId)) return { available: false, reason: t("进度正在其他页面使用", "Progress is in use in another tab") };
        const result = practice.describeResultRecovery(recoveryDraftFromSaved(saved));
        if (result.available) return { available: true, recover: () => recoverSynchronizedResult(record, saved) };
        return { available: false, reason: result.reason };
      }
    }
    return { available: false, reason: t("此设备没有可用或一致的恢复资料", "No matching recovery data on this device") };
  }

  async function deleteDrafts(drafts: SavedPractice[]) {
    let applied = false;
    await afterPark(async () => {
      await deleteWorkspaceDrafts(ownerId, drafts, () => {
        if (!drafts.every(canDiscardSavedDraft)) throw new Error(t('所选草稿正在其他页面使用，请关闭后重试', 'A selected draft is open in another tab. Close it and try again.'));
      });
      if (drafts.some(draft => draft.id === practice.draftId)) resetPractice(selection, true);
      const cleaned = drafts.map(discardSavedDraft).every(Boolean);
      if (!cleaned) throw new Error(t('草稿已删除，本机缓存清理失败，请重试', 'Drafts deleted; local cache cleanup failed. Try again.'));
      applied = true;
    });
    if (!applied) throw new Error(t('练习保存中，请稍后重试', 'Practice is saving. Try again shortly.'));
  }

  function nextArticle() {
    if (locked) return;
    const index = availableArticles.findIndex((article) => article.id === selection.id);
    resetPractice(availableArticles[(index + 1) % availableArticles.length] ?? publicArticles[0], true);
  }

  async function requestPracticeAction(action: 'restart' | 'finish') {
    const resumeOnCancel = phase === 'running';
    if (resumeOnCancel && !await practice.pause()) return;
    setConfirmPractice({ action, resumeOnCancel });
  }

  function cancelPracticeAction() {
    const resume = confirmPractice?.resumeOnCancel;
    setConfirmPractice(null);
    if (resume) void practice.resume();
  }

  function changeLanguage(next: Language) {
    if (locked || next === language) return;
    resetPractice(publicArticles.find((item) => item.language === next && item.difficulty === difficulty) ?? publicArticles[0], true);
  }

  function changeDifficulty(next: Difficulty) {
    if (locked || next === difficulty) return;
    resetPractice(publicArticles.find((item) => item.language === language && item.difficulty === next) ?? publicArticles[0], true);
  }

  function changeDuration(event: ChangeEvent<HTMLInputElement>) {
    if (locked) return;
    const value = event.target.value;
    setMinutesText(value);
    if (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 60) {
      void workspace.updateSettings({ minutes: Number(value) }).catch(reportSaveError);
    }
    if (phase === 'finished') resetPractice(selection, true);
  }

  function changeArticle(event: ChangeEvent<HTMLSelectElement>) {
    const article = catalog.find((item) => item.id === event.target.value);
    if (article && !locked) resetPractice(article, true);
  }

  function useCustomText() {
    const value = customDraft.replace(/\r\n?/g, '\n').trim().normalize('NFC');
    if (!value || value.length > 20000) { setCustomError(t("请输入 1–20,000 个字符。", "Enter 1–20,000 characters.")); return; }
    setCustomError('');
    setShowCustom(false);
    resetPractice({ id: 'custom', title: t("自定义文字", "Custom text"), text: value, language, difficulty, custom: true }, true);
  }

  async function submitRank() {
    if (!result?.attemptId) return;
    if (!user && site.features?.guestLeaderboardEnabled === false) { setRankMessage(t("游客上榜已关闭", "Guest leaderboard submissions are disabled")); return; }
    if (!user && !validGuestNickname(nickname)) { setRankMessage(t("游客昵称须以 visitor 开头，最多 16 个字符", "Guest names must start with visitor and use at most 16 characters")); return; }
    const attemptId = result.attemptId;
    const request = ++rankRequest.current;
    const current = () => live.current && rankRequest.current === request && currentResult.current?.attemptId === attemptId;
    setBusy(true); setRankMessage('');
    try {
      const submit = () => api<{ status: string }>('/api/leaderboard', { method: 'POST', headers: practice.getClaimHeaders(), body: { attemptId, nickname } });
      let data: { status: string };
      try { data = await submit(); }
      catch (error) {
        if (!current() || !(error instanceof ApiError && (error.status === 404 || error.code === 'SCORE_EXPIRED')) || !await practice.recoverForRanking(attemptId)) throw error;
        if (!current()) return;
        data = await submit();
      }
      if (!current()) return;
      if (data.status !== 'review' && data.status !== 'ranked') throw new Error(t("提交结果无法确认，请重试", "Could not confirm submission. Please retry."));
      setRankMessage(data.status === 'review' ? t("已提交，待复核。", "Submitted for review.") : t("已提交，正在确认排行状态。", "Submitted. Checking leaderboard status."));
      setRankSubmitted(true); setScoreStatusRevision((value) => value + 1);
      practice.markRankSubmitted(attemptId);
    } catch (problem) { if (current()) { setRankMessage((problem as Error).message); setRankSubmitted(false); setScoreStatusRevision((value) => value + 1); } }
    finally { if (current()) setBusy(false); }
  }

  const canChangeAccount = authReady && !pendingLoad && !accountBusy &&
    ['ready', 'running', 'paused', 'finished'].includes(phase);

  async function changeAccount() {
    if (!canChangeAccount) return;
    await afterPark(() => { if (user) setShowLogout({ clear: false }); else setShowAuth(true); });
  }

  async function finishLogout(clear: boolean, options?: { rawFingerprint: string; riskAcknowledged: boolean }) {
    if (!user) return;
    const id = user.id;
    setAccountBusy(true);
    let blocked = false;
    let workspaceBefore = '';
    let checkedWorkspace: Awaited<ReturnType<typeof readBlockedWorkspace>> | undefined;
    const fingerprint = (items: Awaited<ReturnType<typeof readBlockedWorkspace>>) => JSON.stringify([...items].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)));
    try {
      if (clear) {
        prepareLocalCleanup(id); blocked = true;
        const items = await readBlockedWorkspace(id);
        const dirty = items.filter((item) => item.serverRevision === undefined || item.baseUpdatedAt === undefined || item.updatedAt !== item.baseUpdatedAt).length;
        if (!options || localPracticeRawFingerprint(id) !== options.rawFingerprint ||
          (dirty > 0 && (!options.riskAcknowledged || (workspace.pendingCount !== null && dirty > workspace.pendingCount)))) {
          throw new Error(t("本机资料已变化或有新的未同步项目，请重新检查", "Local data changed or new items are unsynced. Check again."));
        }
        checkedWorkspace = items;
        workspaceBefore = fingerprint(items);
      }
      await api('/api/auth/logout', { method: 'POST', body: {}, headers: { 'X-Workspace-Owner': id } });
      onUser(null);
      if (clear) {
        try {
          if (!blocked) throw new Error(t("无法保护本机数据清理", "Could not safely prepare local cleanup"));
          if (localPracticeRawFingerprint(id) !== options?.rawFingerprint || fingerprint(await readBlockedWorkspace(id)) !== workspaceBefore) {
            cancelLocalCleanup(id);
            onSignedOutNotice(t("已退出；本机资料在清理期间发生变化，未清除。请重新登录后同步或导出。", "Signed out. Local data changed during cleanup and was kept. Sign in to sync or export it."));
            return;
          }
          await finishLocalCleanup(id, checkedWorkspace);
          onSignedOutNotice(t("已退出并清除此设备的账号数据", "Signed out and cleared account data on this device"));
        } catch (problem) {
          if (problem instanceof Error && problem.message === t("本机资料已变化", "Local data changed")) {
            cancelLocalCleanup(id);
            onSignedOutNotice(t("已退出；本机资料在清理期间发生变化，未清除。请重新登录后同步或导出。", "Signed out. Local data changed during cleanup and was kept. Sign in to sync or export it."));
          } else onSignedOutNotice(t("已退出，但本机数据未能完全清理；可重新登录后重试", "Signed out, but local cleanup is incomplete. Sign in and retry."));
        }
      }
    } catch (problem) {
      if (blocked) { try { cancelLocalCleanup(id); } catch { allowLocalAccount(id); } void workspace.sync(); }
      throw problem;
    } finally { if (live.current) setAccountBusy(false); }
  }

  async function deleteAccount(password: string) {
    if (!user) return;
    const id = user.id;
    prepareLocalCleanup(id);
    try {
      await api('/api/account/delete', { method: 'POST', headers: { 'X-Workspace-Owner': id }, body: { currentPassword: password } });
    } catch (problem) {
      if (problem instanceof ApiError && problem.status >= 400 && problem.status < 500) {
        try { cancelLocalCleanup(id); } catch { allowLocalAccount(id); }
        throw problem;
      }
      onUser(null);
      onSignedOutNotice(t("注销结果无法确认，请重新登录确认，或重试清理本机数据", "Could not confirm account deletion. Sign in to check or retry local cleanup."));
      return;
    }
    onUser(null);
    try { await finishLocalCleanup(id); onSignedOutNotice(t("账号已注销，本机账号数据已清理", "Account deleted and local account data cleared")); }
    catch { onSignedOutNotice(t("账号已注销，但本机数据未能完全清理；请重试清理", "Account deleted, but local cleanup is incomplete. Retry cleanup.")); }
  }

  async function resetWorkspace() {
    if (!user) return;
    try { await resetWorkspaceFromCloud(user.id); onWorkspaceReset(); }
    catch (problem) {
      if (problem instanceof WorkspaceResetIncompleteError) { onUser(null); onSignedOutNotice(problem.message); return; }
      throw problem;
    }
  }

  const canCommand = authReady && !accountBusy && !pendingLoad && ['ready', 'running', 'paused', 'finished'].includes(phase);
  function dispatchShortcut(action: ShortcutAction) {
    if (!live.current || !canCommand) return false;
    if (action === 'pause') {
      if (phase === 'running') { void practice.pause(); return true; }
      if (phase === 'paused') { void practice.resume(); return true; }
      return false;
    }
    if (action === 'restart') {
      if (phase === 'running' || phase === 'paused') { void requestPracticeAction('restart'); return true; }
      if (phase === 'ready' || phase === 'finished') { resetPractice(selection, true); return true; }
      return false;
    }
    if (action === 'settings') { if (user && !workspace.settingsReady) return false; openSettings(); return true; }
    if (action === 'commands') { openCommands(); return true; }
    if (focused) exitFocus();
    navigate(action);
    return true;
  }
  useShortcuts(workspace.settings.shortcutsEnabled !== false, dispatchShortcut);

  const matchingArticle = availableArticles.find((article) => article.id === selection.id);
  const snapshotOption = !matchingArticle || matchingArticle.title !== selection.title || matchingArticle.text !== selection.text;
  const selectedOption = snapshotOption ? 'current-snapshot' : selection.id;
  const source = selection.source && /^https?:\/\//iu.test(selection.source.url) ? selection.source : undefined;
  const filters = <>
    <div className="top-filters">
      <div className="segmented language-switch" role="group" aria-label={t("练习语言", "Practice language")}>
        {(['zh', 'en'] as const).map((item) => <button key={item} disabled={locked} aria-pressed={language === item} onClick={() => changeLanguage(item)}>{languageNames[item]}</button>)}
      </div>
      <span className="filter-divider" aria-hidden="true" />
      {currentMode === 'timed' ? <label className="duration-input"><Clock size={21} /><span>{t("测试时间", "Duration")}</span><input type="number" min="1" max="60" step="1" aria-label={t("测试时间（分钟）", "Duration in minutes")} aria-invalid={!locked && !validDuration} value={phase === 'ready' ? configuredMinutes : String(currentDuration / 60)} disabled={locked || (!!user && !workspace.settingsReady)} onChange={changeDuration} /><span>{t("分钟", "min")}</span></label> : <span className="count-chip">{t("整篇", "Full article")}</span>}
      {currentStrict && <span className="count-chip">{t("严格纠错", "Strict correction")}</span>}
    </div>
    <div className="detail-filters">
      <div className="article-choice"><label className="article-picker"><BookOpen size={24} /><span>{t("选择文章", "Article")}</span><span className="select-wrap"><select value={selectedOption} disabled={locked} onChange={changeArticle} aria-label={t("选择练习文章", "Choose practice article")}>{snapshotOption && <option value="current-snapshot">{selection.title}</option>}{availableArticles.map((article) => <option key={article.id} value={article.id}>{article.title}{article.author ? ` · ${article.author}` : ''}</option>)}</select><CaretDown aria-hidden="true" size={17} /></span></label><button className="text-button custom-button" disabled={locked} onClick={() => { setCustomDraft(selection.id === 'custom' ? text : ''); setCustomError(''); setShowCustom(true); }}>{t("自定义文字", "Custom text")}</button><button className="text-button custom-button" disabled={!canCommand} onClick={() => void afterPark(() => setShowSpecialTraining(true))}>{t("专项练习", "Focused drills")}</button></div>
      <div className="difficulty-picker"><span>{t("难度：", "Level:")}</span><div className="segmented difficulty-switch" role="group" aria-label={t("选择难度", "Difficulty")}>{(['beginner', 'intermediate', 'advanced'] as const).map((item) => <button key={item} disabled={locked} aria-pressed={difficulty === item} onClick={() => changeDifficulty(item)}>{difficultyNames[item]}</button>)}</div></div>
    </div>
  </>;

  const actionNames = { lessons: t("新手课程", "Learn"), library: t("文章库", "Library"), practice: t("练习", "Practice"), rankings: t("排行榜", "Rankings"), history: t("我的记录", "History") } as const;
  const secondaryNames = { drafts: t("草稿箱", "Drafts"), mistakes: t("错字本", "Mistakes"), stats: t("统计", "Statistics") } as const;
  const commandList: Command[] = [
    { id: 'lessons', label: t('新手课程', 'Beginner course'), shortcut: '', disabled: !canCommand, run: () => navigate('lessons') },
    { id: 'pause', label: phase === 'running' ? t("暂停练习", "Pause practice") : t("继续练习", "Resume practice"), shortcut: shortcutNames.pause, disabled: !canCommand || (phase !== 'running' && phase !== 'paused'), run: () => { dispatchShortcut('pause'); } },
    { id: 'restart', label: t("重新开始", "Restart"), shortcut: shortcutNames.restart, disabled: !canCommand, run: () => { dispatchShortcut('restart'); } },
    { id: 'settings', label: t("练习设置", "Practice settings"), shortcut: shortcutNames.settings, disabled: !canCommand || (!!user && !workspace.settingsReady), run: () => { dispatchShortcut('settings'); } },
    ...(['practice', 'library', 'rankings', 'history'] as const).map((id) => ({ id, label: actionNames[id], shortcut: shortcutNames[id], disabled: !canCommand, run: () => { dispatchShortcut(id); } })),
  ];

  return <div className={`app-shell${focused ? ' app-focused' : ''}`} ref={focusRoot} style={surfaceStyle(activeSurface)}>
    {!focused && <header className="site-header">
      <a className="brand" href={preserveLanguageAddress('/')} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate('practice');}} aria-label={t("TypeLune 首页", "TypeLune home")}><BrandLogo /></a>
      <nav aria-label={t("主要导航", "Main navigation")}>
        {(['practice', 'lessons', 'library', 'rankings', 'history'] as const).map((item) => <button key={item} className={view === item ? 'nav-active' : ''} aria-current={view === item ? 'page' : undefined} onClick={() => navigate(item)}>{actionNames[item]}</button>)}
        <div className="more-nav" ref={moreMenu}>
          <button ref={moreButton} className={view === 'drafts' || view === 'mistakes' || view === 'stats' ? 'nav-active' : ''} aria-expanded={showMore} aria-controls={showMore ? 'practice-more' : undefined} onClick={() => setShowMore((value) => !value)}>{t("更多", "More")} <CaretDown size={12} aria-hidden="true" /></button>
          {showMore && <div className="more-popover" id="practice-more">
            {(Object.keys(secondaryNames) as Array<keyof typeof secondaryNames>).map((item) => <button key={item} aria-current={view === item ? 'page' : undefined} onClick={() => { moreButton.current?.focus(); navigate(item); }}>{secondaryNames[item]}</button>)}
            <button disabled={!!user && !workspace.settingsReady} onClick={() => { moreButton.current?.focus(); openSettings(); }}>{t("设置", "Settings")}</button>
            <button disabled={!canCommand} onClick={() => { moreButton.current?.focus(); openCommands(); }}>{t("功能面板", "Commands")}</button>
          </div>}
        </div>
        <LanguageToggle />
        <button className="theme-button" disabled={!!user && !workspace.settingsReady} aria-haspopup="dialog" onClick={() => { void afterPark(() => setShowAppearance(true)); }}><Palette size={20} aria-hidden="true" /><span>{t('外观', 'Appearance')}</span></button>
        {user ? <AccountMenu onProfile={() => openProfile(user.id)} user={user} disabled={!canChangeAccount} onAccount={() => { accountReturn.current = view === 'article' ? 'library' : view === 'profile' || view === 'notfound' || view === 'account' ? 'practice' : view; navigate('account'); }} onRecords={() => navigate('history')} onData={() => navigate('data')} onFeedback={() => navigate('feedback')}
          onLogout={() => void changeAccount()} onAdministration={onAdministration ? () => void afterPark(onAdministration) : undefined} /> : <button className="account-button" disabled={!canChangeAccount} onClick={() => void changeAccount()}>{t("登录", "Sign in")}</button>}
      </nav>
    </header>}
    <RoomBackground theme={theme} background={backgroundFor(theme)} adaptive={workspace.settings.wallpaperAdaptive?.[theme]!==false}>
      <div className="workspace">
        {!user && pendingCleanup > 0 && <div className="cleanup-warning" role="alert"><span>{t("本机账号缓存清理未完成。", "Local account cleanup is incomplete.")}</span><button className="outline-button" disabled={cleanupBusy} onClick={onRetryCleanup}>{t("重试清理", "Retry cleanup")}</button></div>}
        {user && guestImportOffer && hasGuestData && view !== 'data' && <div className="cleanup-warning" role="status"><span>{t("有游客资料可导入。", "Guest data is available to import.")}</span><button className="outline-button" onClick={() => void afterPark(() => setShowGuestImport(true))}>{t("导入游客资料", "Import guest data")}</button><button className="text-button" onClick={onDismissGuestImport}>{t("稍后", "Later")}</button></div>}
        {site.error && <div className="cleanup-warning" role="status"><span>{t("站点配置读取失败：", "Could not load site settings:")}{<SystemMessage text={site.error} />}</span><button className="outline-button" onClick={site.retry}>{t("重试", "Retry")}</button></div>}
        {view === 'practice' && <>
          {focused ? <div className="focus-actions"><button ref={focusButton} className="outline-button feature-action-button" onClick={exitFocus}>{t("退出专注", "Exit focus")}</button><button className="outline-button feature-action-button" disabled={!canCommand} onClick={openCommands}>{t("功能面板", "Commands")}</button></div> : selectedTraining ? null : filters}
          <CourseLayout active={!!selectedLesson} guide={selectedLesson && <LessonGuide lesson={selectedLesson} character={targetCharacters[typedCharacters.length]} onBack={() => navigate('lessons')} />}>
          {(selectedAssessment || selectedWeakKeys) && <section className="lesson-guide" aria-label={t('训练说明', 'Training guide')}><div className="lesson-guide-top"><button className="text-button" onClick={() => navigate('lessons')}>{t('课程目录', 'Course outline')}</button><span>{displayTitle}</span></div><p>{t('英文全文 · 非严格模式 · 不参与排行', 'Full English text · non-strict · unranked')}</p></section>}
          {(workspace.settings.showTimer !== false || workspace.settings.showAccuracy !== false || workspace.settings.showSpeed !== false) && <div className="status-row">
            {workspace.settings.showTimer !== false && <span><Clock size={23} /> {currentMode === 'article' ? t("用时", "Elapsed") : t("剩余时间", "Remaining")}：<b data-testid="remaining-time">{formatTime(clockMs)}</b></span>}
            {workspace.settings.showAccuracy !== false && <span><Crosshair size={23} />  {t("准确率：", "Accuracy:")}{total ? `${previewScore.accuracy}%` : '—'}</span>}
            {workspace.settings.showSpeed !== false && (language === 'en' ? <EnglishSpeed score={total ? previewScore : undefined} display="live" />
              : <span><Keyboard size={23} />  {t("字 / 分钟：", "Chars / min:")}{total ? previewScore.cpm : '—'}</span>)}
          </div>}
          {(phase === 'ready' ? paceSettings.enabled : paceSettings.enabled || practice.paceTarget !== undefined) && <PaceIndicator language={language} target={activePaceTarget} secondsAhead={paceProgress?.secondsAhead}
            notice={phase === 'ready' && user && paceSettings.source !== 'custom' && !historyLoaded ? t("正在读取配速目标…", "Loading pace target…") : phase === 'ready' ? t("暂无同条件成绩", "No matching results yet") : t("本轮未启用配速", "Pace is off for this round")}
            partial={phase === 'ready' && paceSettings.source !== 'custom' && (!user || historyLoaded) && (!!historyError || (!!user && (!workspace.cloudLoaded || workspace.syncState !== 'synced')) || hasUnloadedLocalHistory())} />}
          <div className="progress-row"><span>{t("文章字数：", "Article chars:")}<b data-testid="article-count">{targetCharacters.length}</b></span><span>{t("已打字数：", "Typed:")}<b data-testid="typed-count">{typedCharacters.length}</b></span><span>{t("当前错误：", "Errors:")}<b data-testid="error-count">{previewScore.total - previewScore.correct}</b></span><span>{t("退格：", "Backspaces:")}<b data-testid="backspace-count">{practice.backspaces}</b></span></div>
          {practiceNotice && <p className="practice-notice" role="status">{<SystemMessage text={practiceNotice} />}</p>}
          {!user && site.features?.guestLeaderboardEnabled === false && <p className="practice-notice" role="status">{t("游客上榜已关闭。", "Guest leaderboard submissions are disabled.")}</p>}
          <section className="typing-panel" aria-label={t("文章练习", "Typing practice")}>
            <div className="practice-heading">
              <div className="practice-title"><BookOpen size={22} aria-hidden="true" /><div>
                <h1>{displayTitle}</h1>
                {target === text && (selection.author || selection.theme || source) && <p className="article-meta">
                  {selection.author && <span>{selection.author}</span>}
                  {selection.theme && <span>{selection.theme}</span>}
                  {source && <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.name} aria-label={`查看《${displayTitle}》原文`}>{t("查看原文", "View source")}</a>}
                  {!selection.custom && publicById.get(selection.id) === selectedCatalogKey && <button className="text-button" disabled={!authReady} onClick={() => void afterPark(() => { setFeedbackDraft(newFeedbackDraft({ id: selection.id, title: selection.title, snapshotKey: selectedCatalogKey, position: '', wrongText: '' })); commitView('feedback'); })}>{t("文章纠错", "Report article")}</button>}
                </p>}
              </div></div>
              <div className="practice-actions">
                {phase === 'running' ? <button className="primary-button start-button" onClick={() => void practice.pause()}><Pause size={18} weight="fill" aria-hidden="true" />  {t("暂停练习", "Pause practice")}</button>
                  : phase === 'paused' ? <button className="primary-button start-button" disabled={!ready || accountBusy} onClick={() => void practice.resume()}><Play size={18} weight="fill" aria-hidden="true" />  {t("继续练习", "Resume practice")}</button>
                    : phase === 'ready' ? null : <button className="primary-button start-button" onClick={() => resetPractice(selection, true)} disabled={phase !== 'finished' || !canStart}>
                      {phase === 'starting' ? t("准备中…", "Preparing…") : phase === 'restoring' ? t("恢复进度中…", "Restoring progress…") : phase === 'pausing' ? t("正在暂停…", "Pausing…") : phase === 'resuming' ? t("正在继续…", "Resuming…") : phase === 'finishing' ? t("正在结算…", "Finishing…") : t("再练一次", "Try again")}
                    </button>}
                {(phase === 'running' || phase === 'paused') && <><button className="text-button restart-button" onClick={() => void requestPracticeAction('restart')}><ArrowCounterClockwise size={18} aria-hidden="true" />{t("重新开始", "Restart")}</button><button className="text-button" onClick={() => void requestPracticeAction('finish')}>{t("结束练习", "Finish")}</button></>}
                {phase === 'ready' && !focused && !selectedTraining && <button className="text-button" onClick={nextArticle}>{t("换一篇", "Change article")} <ArrowRight size={16} aria-hidden="true" /></button>}
                {phase === 'finished' && <button className="text-button" onClick={() => setShowResult(true)}>{t("查看本次成绩", "View result")}</button>}
              </div>
            </div>
            <PracticeLines practice={practice} title={displayTitle} reader={workspace.settings} canStart={canStart} onStart={() => { interacted.current = true; setFeedback(''); }} />
          </section>
          </CourseLayout>
        </>}
        <PageLoadBoundary key={view} message={t("页面加载失败", "Could not load this page")} retryLabel={t("重新载入", "Reload")}><Suspense fallback={<section className="content-panel feature-panel" role="status">{t("正在读取…", "Loading…")}</section>}>
        {view === 'lessons' && <LessonsView records={records} drafts={draftBox.drafts} ownerId={ownerId} onSelect={selectLesson} onResume={(draft) => continueDraft(draft)} onTraining={selectArticle} />}
        {view !== 'practice' && feedback && <p className="form-error view-error" role="alert"><SystemMessage text={feedback} /></p>}
        {historyError && recordViews.includes(view) && <p className="form-error view-error" role="status">{t("连接失败，显示已读取的记录。", "Connection failed. Showing loaded records.")}</p>}
        {recordViews.includes(view) && hasUnloadedLocalHistory() && <p className="form-error view-error" role="status">{t("部分本机旧版记录或文章快照无法完整读取。", "Some legacy local records or article snapshots could not be fully read.")}</p>}
        {view === 'library' && <ArticleLibrary isSignedIn={!!user} onLogin={() => setShowAuth(true)} initialTab={libraryInitialTab} articles={catalog} favorites={workspace.favorites} onOpenArticle={openPublicArticle} onToggleFavorite={(id) => void workspace.toggleFavorite(id).catch(reportSaveError)} onSelect={selectArticle} onSave={(article) => workspace.put('article', article.id, article)} onDelete={(id) => workspace.remove('article', id)} />}
        {view === 'article' && (() => {
          const article = catalogState === 'ready' ? routeCatalog.find((item) => item.id === routeArticleId) : catalogState === 'error' ? builtIns.find((item) => item.id === routeArticleId) : undefined;
          if (article) return <PublicArticleView key={article.id} article={article} offline={catalogState === 'error'} onPractice={() => selectArticle(article)} onBack={() => navigate('library')} />;
          if (catalogState === 'loading') return <section className="content-panel feature-panel"><p role="status">{t("正在读取文章…", "Loading article…")}</p></section>;
          if (catalogState === 'error') return <section className="content-panel feature-panel"><p className="form-error" role="alert">{t("文章暂不可用", "Article unavailable")}</p><button type="button" className="outline-button" onClick={refreshCatalog}>{t("重试", "Retry")}</button></section>;
          return <section className="content-panel feature-panel"><div className="content-heading"><h1>{t("文章未找到", "Article not found")}</h1></div><button type="button" className="outline-button" onClick={() => navigate('library')}>{t("返回文章库", "Back to library")}</button></section>;
        })()}
        {view === 'profile' && routeProfileId && <PublicProfile key={routeProfileId+':'+ownerId} id={routeProfileId} onBack={() => void afterPark(() => commitAddress(profileReturn.current, 'rankings'))}/>}
        {view === 'rankings' && authReady && <RankingView onProfile={openProfile} initial={{ language, difficulty, duration, mode: currentMode, strict: currentStrict }} articles={publicArticles} isAdmin={false} ownerId={ownerId} onAddressChange={(address) => { currentPath.current = address; }} />}
        {view === 'history' && <RecordsView records={records} ownerId={ownerId} onReplay={selectArticle} onContinue={continueRecord} onDelete={deleteRecords} routeRecordId={routeRecordId}
          routeLoading={!workspace.ready || (!!ownerId && !historyLoaded)} routePartial={historyError || !!workspace.error || (!!ownerId && (!workspace.cloudLoaded || workspace.syncState !== 'synced')) || hasUnloadedLocalHistory()}
          onOpenRecord={openRecord} onCloseRecord={() => commitView('history')} onRetryRecords={() => { setHistoryRevision((revision) => revision + 1); void workspace.sync(); }} recoveryFor={recoveryForRecord} />}
        {view === 'drafts' && <DraftsView drafts={draftBox.drafts} onResume={(draft) => continueDraft(draft)} onDelete={deleteDrafts}
          recovery={draftBox.completed.map((draft) => ({
            id: draft.recordId, title: draft.title, savedAt: draft.savedAt,
            recover: () => recoverCompletedDraft(draft),
          }))}
        />}
        {view === 'mistakes' && <MistakesView records={records} states={workspace.settings.mistakeStates ?? {}} onStatus={(id, status) => void workspace.updateMistakeState(id, status).catch((problem: unknown) => {
          if (live.current) setFeedback(problem instanceof Error ? problem.message : t("错字状态保存失败", "Could not save mistake status"));
        })} onPractice={selectArticle} />}
        {view === 'stats' && <StatsView records={records} coverage={!ready || (!!ownerId && !historyLoaded) ? 'loading' : historyError || !!workspace.error || (!!ownerId && (!workspace.cloudLoaded || workspace.syncState !== 'synced')) || hasUnloadedLocalHistory() ? 'partial' : ownerId ? 'complete' : 'local'} timeZone={workspace.settings.statisticsTimezone ?? browserStatisticsTimeZone()} timeZoneProvisional={!workspace.settings.statisticsTimezone} goalMinutes={workspace.settings.dailyGoalMinutes ?? 0} onSaveCalendar={workspace.settingsReady ? workspace.updateSettings : undefined}
          onOpenRecord={(id) => void afterPark(() => commitAddress(pathForRecord(id), 'history'))} />}
        {view === 'feedback' && <FeedbackView onClose={()=>navigate('practice')} ownerId={ownerId} draft={feedbackDraft} setDraft={setFeedbackDraft} routeFeedbackId={routeFeedbackId} onOpenFeedback={openFeedback} onCloseFeedback={() => commitView('feedback')} onLogin={(draft) => { onFeedbackHandoff(draft); setShowAuth(true); }} />}
        {view === 'account' && !user && <section className="content-panel feature-panel"><div className="content-heading"><h1>{t("账号设置", "Account settings")}</h1></div>{authReady ? <><p>{t("请先登录", "Please sign in")}</p><button type="button" className="outline-button" onClick={() => setShowAuth(true)}>{t("登录", "Sign in")}</button></> : <p role="status">{t("正在读取账号…", "Loading account…")}</p>}</section>}
        {view === 'data' && !user && <section className="content-panel feature-panel"><div className="content-heading"><h1>{t("个人数据", "Personal data")}</h1></div>{authReady ? <><p>{t("请先登录", "Please sign in")}</p><button type="button" className="outline-button" onClick={() => setShowAuth(true)}>{t("登录", "Sign in")}</button></> : <p role="status">{t("正在读取账号…", "Loading account…")}</p>}</section>}
        {view === 'data' && user && <PersonalDataView user={user} onClear={() => setShowLogout({ clear: true })} onCompacted={() => setShowRecovery('generation')} onGuestImport={() => setShowGuestImport(true)} onManageCapacity={manageCapacity} onResetSettings={() => workspace.remove('settings', 'preferences')} />}
        {view === 'notfound' && <section className="content-panel feature-panel"><div className="content-heading"><h1>{t("页面未找到", "Page not found")}</h1></div><button type="button" className="outline-button" onClick={() => navigate('practice')}>{t("返回练习", "Back to practice")}</button></section>}
        {(view === 'help' || view === 'about' || view === 'privacy' || view === 'terms') && <SiteInfoView page={view} onFeedback={() => navigate('feedback')} />}
        </Suspense></PageLoadBoundary>
      </div>
    </RoomBackground>
    {!focused && <SiteFooter ready={authReady} onNavigate={navigate} />}
    {showCustom && <Dialog title={t("自定义练习文字", "Custom practice text")} onClose={() => setShowCustom(false)}>
      <label className="custom-editor">{t("练习文字", "Practice text")}<textarea aria-label={t("自定义文章内容", "Custom article content")} value={customDraft} maxLength={20000} onChange={(event) => setCustomDraft(event.target.value)} /></label>
      {customError && <p className="form-error" role="alert">{customError}</p>}
      <div className="result-actions"><span className="custom-count">{splitCharacters(customDraft).length}  {t("/ 20000 字符", "/ 20000 characters")}</span><button className="primary-button" onClick={useCustomText}>{t("使用这段文字", "Use this text")}</button></div>
    </Dialog>}
    {showSpecialTraining && <SpecialTrainingDialog language={language} onClose={() => setShowSpecialTraining(false)} onSelect={(article) => { setShowSpecialTraining(false); selectArticle(article); }} />}
    {(showAuth || adminLogin) && <AuthDialog onClose={() => { setShowAuth(false); onCancelFeedbackHandoff(); setAdminLoginDismissed(true); if (directAdmin && !authCompleted.current) { window.history.replaceState(null, '', '/'); currentPath.current = '/'; } }} onLogin={(next) => { authCompleted.current = true; onUser(next); }} registrationEnabled={site.features?.registrationEnabled} />}
    {view === 'account' && user && <AccountDialog user={user} onClose={() => navigate(accountReturn.current)} onUpdate={onUpdateUser} onSignedOut={onAccountReauthentication} onDelete={deleteAccount} onGuardChange={setAccountGuard} />}
    {showLogout && user && <LogoutDialog user={user} initialClear={showLogout.clear} pendingCount={workspace.pendingCount} syncState={workspace.syncState} syncError={workspace.error} drafts={workspace.drafts} records={workspace.records} onSync={workspace.sync} onLogout={finishLogout} onClose={() => setShowLogout(undefined)} />}
    {showSettings && <SettingsDialog settings={{ ...workspace.settings, minutes: locked ? currentDuration / 60 : duration / 60, mode: locked ? currentMode : workspace.settings.mode, strict: locked ? currentStrict : workspace.settings.strict }} language={language} onChange={updateSettings} locked={locked} onClose={() => setShowSettings(false)} onFocus={enterFocus} focused={focused} syncState={workspace.syncState} syncError={workspace.error} pendingCount={workspace.pendingCount} cloudCount={workspace.cloudCount} lastSyncedAt={workspace.lastSyncedAt} recoveryReason={workspace.recoveryReason} onRecovery={() => { if (workspace.recoveryReason) { setShowSettings(false); setShowRecovery(workspace.recoveryReason); } }} onSync={() => void workspace.sync()} isSignedIn={!!user} onPresets={() => { setShowSettings(false); setShowPresets(true); }} onSettingsTransfer={() => { setShowSettings(false); setShowSettingsTransfer(true); }} onCommands={() => { setShowSettings(false); setShowCommands(true); }} />}
    {showPresets && <PresetsDialog settings={{ ...workspace.settings, minutes: locked ? currentDuration / 60 : duration / 60, mode: locked ? currentMode : workspace.settings.mode, strict: locked ? currentStrict : workspace.settings.strict }} language={language} difficulty={difficulty} onAction={workspace.changePresets} onApply={(preset) => applyPracticeConfiguration(preset)} onClose={() => setShowPresets(false)} />}
    {showSettingsTransfer && <SettingsTransferDialog settings={{ ...workspace.settings, minutes: locked ? currentDuration / 60 : duration / 60, mode: locked ? currentMode : workspace.settings.mode, strict: locked ? currentStrict : workspace.settings.strict }} language={language} difficulty={difficulty} onImport={importPracticeConfiguration} onClose={() => setShowSettingsTransfer(false)} />}
    {showCommands && <CommandPalette commands={commandList} shortcutsEnabled={workspace.settings.shortcutsEnabled !== false} onClose={() => setShowCommands(false)} />}
    {showRecovery && user && <WorkspaceRecoveryDialog user={user} reason={showRecovery} onReset={resetWorkspace} onClose={() => setShowRecovery(undefined)} />}
    {showGuestImport && user && <GuestImportDialog ownerId={user.id} syncState={workspace.syncState} cloudLoaded={workspace.cloudLoaded} onSync={workspace.sync} onClose={() => {
      setShowGuestImport(false);
      void collectGuestImport(user.id).then((plan) => setHasGuestData(plan.items.length > 0)).catch(() => setHasGuestData(true));
    }} onRecovery={workspace.recoveryReason ? () => { setShowGuestImport(false); setShowRecovery(workspace.recoveryReason!); } : undefined} />}
    {showAppearance && <AppearanceDialog theme={theme} surface={activeSurface} disabled={!workspace.settingsReady} onSurface={patch=>{void saveSurfaceAppearance(ownerId,theme,patch).catch(reportSaveError);}} onResetSurface={()=>{void saveSurfaceAppearance(ownerId,theme,effectiveSurface(theme)).catch(reportSaveError);}} onTheme={changeTheme} onClose={() => setShowAppearance(false)} onBackground={backgroundTheme => { setShowAppearance(false); setShowBackground(backgroundTheme); }} />}
    {showBackground && <BackgroundDialog ownerId={ownerId} useSiteDefault={followsSite(showBackground)} siteDefaultValue={siteBackground(showBackground)} autoMode={workspace.settings.wallpapers?.[showBackground]} adaptive={workspace.settings.wallpaperAdaptive?.[showBackground]} theme={showBackground} value={editorValue} onPreview={value=>setSurfacePreview({theme:showBackground,value:value??effectiveSurface(showBackground)})} onClose={()=>{setShowBackground(undefined);setSurfacePreview(undefined);}} onSave={async (background, automatic, adaptive,followSite) => {
      if(ownerId && !workspace.cloudLoaded && !workspace.hasSavedSettings) throw new Error(t('请先同步账号设置','Sync account settings first'));
      if(ownerId)await saveAccountWallpaper(ownerId,showBackground,background,automatic??'off',adaptive,followSite,workspace.sync);
      else await saveWallpaper(null,showBackground,background,automatic??'off',adaptive,followSite);
    }} />}
    {confirmPractice && <Dialog title={confirmPractice.action === 'restart' ? t("重新开始本次练习？", "Restart this practice?") : t("结束本次练习？", "Finish this practice?")} onClose={cancelPracticeAction}>
      {confirmPractice.action === 'restart' && <p className="dialog-intro">{t("本次输入和计时将被清除。", "Current input and timing will be cleared.")}</p>}
      {phase === 'restoring' && <p className="dialog-intro" role="status">{t("恢复中…", "Restoring…")}</p>}
      <div className="result-actions">
        <button className="outline-button" disabled={phase !== 'paused'} onClick={cancelPracticeAction}>{t("继续当前练习", "Continue practice")}</button>
        <button className="primary-button" disabled={phase !== 'paused'} onClick={() => {
          const action = confirmPractice.action;
          setConfirmPractice(null);
          if (action === 'restart') resetPractice(catalog.find((article) => article.id === selection.id) ?? selection);
          else void practice.finish();
        }}>{confirmPractice.action === 'restart' ? t("确认重新开始", "Restart practice") : t("结束并查看成绩", "Finish and view result")}</button>
      </div>
    </Dialog>}
    {showResult && result && <Dialog title={t("练习成绩", "Practice result")} className="result-dialog" onClose={() => setShowResult(false)}
      leadingAction={<button type="button" className="icon-button result-back" aria-label={t("返回练习", "Back to practice")} onClick={() => setShowResult(false)}><ArrowLeft size={22} aria-hidden="true" /></button>}>
      <ResultLayout key={result.recordId ?? result.elapsedMs} result={result} article={result.record?.article ?? selection} typed={typedCharacters.length} offset={practice.offset}
        status={<>{result.offline ? <>{practice.canRetryOnline ? <><p className="dialog-intro">{t("成绩尚未同步", "Result not yet synced")}</p><p className="score-status">{t("可恢复提交", "Submission can be recovered")}</p></> : <p className="dialog-intro">{!result.custom && result.elapsedMs < 1000 ? t("用时不足 1 秒，不参与排行", "Under 1 second. Not ranked.") : t("个人练习，不参与排行", "Private practice. Not ranked.")}</p>}</> :
        resultStatus.status ? <ScoreStatusView status={resultStatus.status} /> : resultStatus.loading ? <p role="status">{t("正在读取成绩状态…", "Loading result status…")}</p> : <div><p className="form-error" role="alert">{resultStatus.error || t("成绩状态暂不可用", "Result status unavailable")}</p><button type="button" className="text-button" onClick={resultStatus.retry}>{t("重试状态", "Retry status")}</button></div>}</>} comparison={<>{result.record && result.score.total > 0 && <PersonalBestComparison current={result.record} records={records} coverage={!user ? (hasUnloadedLocalHistory() ? 'partial' : 'local') :
        historyCheckedFor !== result.recordId ? 'loading' : historyError || !workspace.cloudLoaded || workspace.syncState !== 'synced' || hasUnloadedLocalHistory() ? 'partial' : 'complete'} />}</>} course={<>{result.record && <LessonResult record={result.record} onSelect={selectLesson} onReview={selectArticle} onCourse={() => navigate('lessons')} />}
      {result.record && isAssessmentArticle(result.record.article) && <AssessmentPanel records={[result.record, ...records]} ownerId={ownerId} onSelect={selectArticle} />}
      {result.record && (isAssessmentArticle(result.record.article) || isWeakKeyArticle(result.record.article)) && <button className="text-button" onClick={() => navigate('lessons')}>{t('课程目录', 'Course outline')}</button>}</>} mistakes={<>{result.record && (result.record.mistakesTruncated || (result.record.mistakes?.length ?? 0) >= 500) && <p className="feature-muted" role="status">{t("错字样本可能不完整", "Mistake samples may be incomplete")}</p>}
      {roundDrillAvailable && <div className="round-mistake-actions">
        <label>{t("重复次数", "Repetitions")}<input type="number" min={1} max={10} step={1} value={mistakeRepeats} aria-invalid={!roundDrill} onChange={(event) => setMistakeRepeats(event.target.value)} /></label>
        <button className="outline-button" disabled={!roundDrill} onClick={() => { if (roundDrill) selectArticle(roundDrill); }}>{t("练习本轮错字", "Practice these mistakes")}</button>
      </div>}
      {mistakes.length > 0 && <details className="mistake-review"><summary>{t("错字回看 ·", "Review mistakes ·")} {mistakes.length > 30 ? `前 30 / ${mistakes.length}` : mistakes.length}  {t("处", "items")}</summary><ul>{mistakes.slice(0, 30).map((mistake) => <li key={mistake.index}><span>{t("第", "#")} {mistake.index + 1}  {t("字", "chars")}</span><span>{t("原文", "Source")} <b>{readableCharacter(mistake.expected)}</b></span><span>{t("输入", "Input")} <del>{readableCharacter(mistake.actual)}</del></span></li>)}</ul></details>}
      {mistakes.length===0 && <p className="feature-muted">{t("本轮没有可回看的错字", "No mistakes to review this round")}</p>}</>} leaderboard={<>{practice.canRetryOnline && <div className="rank-submit"><button className="primary-button" disabled={phase === 'restoring'} onClick={() => void practice.retryOnline()}>{phase === 'restoring' ? t("正在恢复…", "Restoring…") : t("重试上榜", "Retry submission")}</button></div>}
      {practice.canRetryOnline && practice.feedback && <p className="form-error" role="alert"><SystemMessage text={practice.feedback} /></p>}
      {!result.offline && result.eligible && !rankSubmitted && (!resultStatus.status || resultStatus.status.state === 'not_submitted') && <div className="rank-submit">
        {!user && <GuestNicknameField value={nickname} blocked={rankMessage==='昵称含有不允许使用的词，请更换昵称'} onChange={value=>{setNickname(value);setRankMessage('');}}/>}
        <button className="primary-button" disabled={busy || resultStatus.loading || (!user && (!validGuestNickname(nickname) || site.features?.guestLeaderboardEnabled === false))} onClick={() => void submitRank()}><Trophy size={20} /> {busy ? t("提交中…", "Submitting…") : t("提交到排行榜", "Submit to leaderboard")}</button>
        {!user && site.features?.guestLeaderboardEnabled === false && <p className="form-error" role="status">{t("游客上榜已关闭。", "Guest leaderboard submissions are disabled.")}</p>}
      </div>}
      {rankMessage && (!rankSubmitted || !resultStatus.status) && <p className={rankSubmitted ? 'form-notice' : 'form-error'} role={rankSubmitted ? 'status' : 'alert'}>{rankSubmitted && <CheckCircle size={18} />} <SystemMessage text={rankMessage}/></p>}</>} actions={<><div className={`result-actions result-navigation${result.continuation ? ' with-continuation' : ''}`}>
        {result.continuation && <button className="primary-button" onClick={() => continueDraft(result.continuation!)}><Play size={17} weight="fill" aria-hidden="true" />{t("继续本篇", "Continue article")}</button>}
        <button className="outline-button" onClick={() => resetPractice(selection, true)}><ArrowCounterClockwise size={19} aria-hidden="true" />{t("再练一次", "Try again")}</button>
        {!focused && !resultTraining && <button className="text-button" onClick={nextArticle}>{t("下一篇", "Next article")} <ArrowRight size={16} aria-hidden="true" /></button>}
        {!focused && !resultTraining && <button className="text-button" onClick={() => navigate('rankings')}>{t("排行榜", "Rankings")}</button>}
            {result.record && <><button className="outline-button result-share" disabled={!shareData} onClick={() => { setShowResult(false); setShowShare(true); }}><ShareNetwork size={17} aria-hidden="true" />{t("分享成绩", "Share result")}</button></>}
      {result.record && !shareData && <p className="form-error" role="status">{t("无法生成分享卡", "Could not create share card")}</p>}
      </div></>}/>
    </Dialog>}
    {showShare && shareData && <ShareCardDialog data={shareData} theme={theme} onClose={() => { setShowShare(false); setShowResult(true); }} />}
  </div>;
}
