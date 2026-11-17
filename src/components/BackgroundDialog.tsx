import { fetchDailyWallpaper, wallpaperDisplay } from '../lib/daily-wallpaper';
import { wallpaperStyles, wallpaperStyleNames, type WallpaperStyle } from '../lib/wallpaper-policy';
import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { ArrowCounterClockwise } from '@phosphor-icons/react/ArrowCounterClockwise';
import { defaultBackground, prepareBackgroundImage, prepareBackgroundUploadPreview, type BackgroundConfig, type BackgroundTheme, type BackgroundImage } from '../lib/background';
import { uploadBackground, discardBackgroundUpload } from '../lib/background-upload';
import { Dialog } from './Dialog';

type Props = {
  theme: BackgroundTheme;
  value?: BackgroundConfig;
  autoMode?: 'off' | WallpaperStyle;
  adaptive?: boolean;
  ownerId?: string | null;
  useSiteDefault?: boolean;
  siteDefaultValue?: BackgroundConfig;
  onSave: (value: BackgroundConfig | undefined, autoMode?: 'off' | WallpaperStyle, adaptive?: boolean, followSite?:boolean) => Promise<void>;
  onClose: () => void;
};

export function BackgroundDialog({ theme, value, onSave, onClose, autoMode = 'off', adaptive = true, ownerId, useSiteDefault, siteDefaultValue }: Props) {
  const { t, locale } = useI18n();

  const [automatic, setAutomatic] = useState(autoMode);
  const [followingSite,setFollowingSite]=useState(useSiteDefault??false);
  const [adaptDisplay, setAdaptDisplay] = useState(adaptive);
  const [display, setDisplay] = useState(wallpaperDisplay);
  const seen = useRef<string[]>([]);
  const [pendingDaily, setPendingDaily] = useState<WallpaperStyle>();
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | undefined>(undefined);
  const generation = useRef(0);
  const mounted = useRef(true);
  const savingRef = useRef(false);
  const [uploadFile,setUploadFile]=useState<File>();
  const staged=useRef<{id:string;file:File;image?:BackgroundImage}|undefined>(undefined);
  const blobUrls=useRef(new Set<string>());
  function discardStaged(){const current=staged.current;staged.current=undefined;if(current&&ownerId)void discardBackgroundUpload(ownerId,current.id).catch(()=>{});}

  useEffect(() => {
    mounted.current = true;
    const protectSaving = (event: BeforeUnloadEvent) => {
      if (!savingRef.current) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectSaving);
    return () => { window.removeEventListener('beforeunload', protectSaving); mounted.current = false; generation.current++; operation.current?.abort();discardStaged();for(const url of blobUrls.current)URL.revokeObjectURL(url); };
  }, []);
  useEffect(() => { if (!dirty) setDraft(value); }, [value, dirty]);
  useEffect(() => {
    const resize = () => { const next = wallpaperDisplay(); setDisplay(current => current.width === next.width && current.height === next.height ? current : next); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  function cancelProcessing() {
    generation.current++;
    operation.current?.abort();
    setProcessing(false);setPendingDaily(undefined);
  }
  function close() {
    if (savingRef.current) return;
    cancelProcessing();
    onClose();
  }
  async function choose(file?: File) {
    if (!file || savingRef.current) return;
    cancelProcessing();
    const current = generation.current;
    const controller = new AbortController();
    operation.current = controller;
    setError(''); setProcessing(true);
    try {
      const image = ownerId?await prepareBackgroundUploadPreview(file,controller.signal):await prepareBackgroundImage(file, controller.signal);
      if(image.image.startsWith('blob:'))blobUrls.current.add(image.image);
      if (!mounted.current || current !== generation.current) return;
      setAutomatic('off');
      setFollowingSite(false);
      discardStaged();setUploadFile(ownerId?file:undefined);
      setDraft((previous) => { const next = { ...previous ?? defaultBackground(theme,image), ...image }; delete next.daily; return next; });
      setDirty(true);
    } catch (problem) {
      if (mounted.current && current === generation.current && !controller.signal.aborted) setError(problem instanceof Error ? problem.message : t("图片处理失败", "Could not process image"));
    } finally {
      if (mounted.current && current === generation.current) setProcessing(false);
    }
  }
  async function daily(kind: WallpaperStyle, another = false) {
    cancelProcessing(); const current=generation.current; const controller=new AbortController();operation.current=controller;
    setError('');setProcessing(true);setPendingDaily(kind);
    try {const background=await fetchDailyWallpaper(kind,theme,controller.signal,{ display: adaptDisplay ? display : undefined, exclude: another && draft?.daily ? [draft.daily.id, ...seen.current] : undefined });
      if(mounted.current&&current===generation.current){discardStaged();setUploadFile(undefined);setFollowingSite(false);seen.current=[...new Set([background.daily?.id, ...seen.current].filter((id): id is string => !!id))].slice(0,12);setDraft(previous=>({...previous,...background,...(previous?{fit:previous.fit,positionX:previous.positionX,positionY:previous.positionY,blur:previous.blur,shade:previous.shade}:{})}));setAutomatic(kind);setDirty(true);}
    }catch(e){if(mounted.current&&current===generation.current)setError(t('每日壁纸暂不可用，当前背景已保留','Daily wallpaper unavailable. Current background retained.'));}
    finally{if(mounted.current&&current===generation.current){setProcessing(false);setPendingDaily(undefined);}}
  }
  function drop(event: DragEvent) {
    event.preventDefault(); setDragging(false);
    if (savingRef.current) return;
    if (event.dataTransfer.files.length !== 1) { setError(t("一次选择一张图片", "Choose one image at a time")); return; }
    void choose(event.dataTransfer.files[0]);
  }
  function change(patch: Partial<BackgroundConfig>) {
    setDraft((previous) => previous && { ...previous, ...patch });
    setDirty(true);
  }
  async function save() {
    if (!dirty || processing || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    try {
      let next=draft;
      if(ownerId&&uploadFile&&next){
        if(staged.current?.file!==uploadFile)staged.current={id:crypto.randomUUID(),file:uploadFile};
        const current=staged.current!;
        if(!current.image){const controller=new AbortController();operation.current=controller;current.image=await uploadBackground(uploadFile,ownerId,current.id,controller.signal);}
        next={...next,...current.image};if(mounted.current)setDraft(next);
      }
      if(!mounted.current)return;
      if(useSiteDefault===undefined)await onSave(next,automatic,adaptDisplay);else await onSave(next,automatic,adaptDisplay,followingSite);
      staged.current=undefined;setUploadFile(undefined);
      if (mounted.current) onClose();
    } catch (problem) {
      if (mounted.current) setError(problem instanceof Error ? problem.message : t("背景保存失败", "Could not save background"));
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  const sliders = [
    ['positionX', t("水平位置", "Horizontal position"), 100, '%'], ['positionY', t("垂直位置", "Vertical position"), 100, '%'], ['blur', t("模糊", "Blur"), 12, 'px'], ['shade', t("遮罩", "Overlay"), 80, '%'],
  ] as const;

  return <Dialog title={theme === 'dark' ? t("夜间背景", "Dark mode background") : t("日间背景", "Light mode background")} onClose={close} dismissible={!saving} className="background-dialog">
    <form className="background-editor" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <div className="background-editor-content">
      <div className={`background-preview${dragging ? ' is-dragging' : ''}`} data-theme={theme}
        onDragOver={(event) => { event.preventDefault(); if (!saving) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={drop}>
        <img alt={t("背景预览", "Background preview")} referrerPolicy="no-referrer" src={draft?.image ?? siteDefaultValue?.image ?? '/assets/lake-default.webp'}
          style={{ objectFit: draft?.fit ?? 'cover', objectPosition: `${draft?.positionX ?? 50}% ${draft?.positionY ?? 50}%`, filter: `blur(${draft?.blur ?? 0}px)` }} />
        <div className="background-shade" style={{ opacity: (draft?.shade ?? 0) / 100 }} />
        <div className="background-preview-sample" aria-hidden="true" style={{background:theme==='dark'?`rgba(32,37,58,${(draft?.panelOpacity??95)/100})`:`rgba(255,255,255,${(draft?.panelOpacity??97)/100})`,backdropFilter:`blur(${draft?.panelBlur??0}px)`,borderColor:`color-mix(in srgb,var(--typing-border) ${draft?.borderOpacity??100}%,transparent)`}}><span>TypeLune</span><i /><i /></div>
      </div>
      <fieldset className="settings-group wallpaper-options" disabled={saving||processing}><legend>Wallhaven</legend>
        <label className="profile-visibility"><input type="checkbox" checked={automatic!=='off'||!!pendingDaily} onChange={event=>{if(event.target.checked)void daily('nature');else{setAutomatic('off');setDirty(true);}}}/>{t('每日自动更新壁纸','Update wallpaper daily')}</label>
        <label>{t('图片偏好','Image preference')}<select value={pendingDaily??(automatic==='off'?'nature':automatic)} onChange={event=>void daily(event.target.value as WallpaperStyle)}>{wallpaperStyleNames.map(style=><option key={style} value={style}>{t(wallpaperStyles[style].zh,wallpaperStyles[style].en)}</option>)}</select></label>
        <label className="settings-check"><input type="checkbox" checked={adaptDisplay} onChange={event=>{setAdaptDisplay(event.target.checked);setDirty(true);}} />{t('显示器自适应','Adapt to display')}<small>{adaptDisplay ? `${display.width} × ${display.height}` : t('固定尺寸','Fixed size')}</small></label>
        <div className="wallpaper-fetch-actions"><button type="button" className="outline-button" onClick={()=>void daily(automatic==='off'?'nature':automatic)}>{t('获取今日壁纸','Get today’s wallpaper')}</button>
          {draft?.daily && <button type="button" className="outline-button" onClick={()=>void daily(draft.daily!.kind,true)}>{t('换一张','Another wallpaper')}</button>}</div>
        {draft?.daily&&<a href={'https://wallhaven.cc/w/'+draft.daily.id} target="_blank" rel="noopener noreferrer">{t('图片来源：Wallhaven','Source: Wallhaven')} ↗</a>}
      </fieldset>
      <div className="background-file-row" onDragOver={(event) => event.preventDefault()} onDrop={drop}>
        <input ref={input} hidden aria-label={t("背景图片", "Background image")} type="file" accept="image/jpeg,image/png,image/webp" disabled={saving}
          onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void choose(file); }} />
        <button type="button" className="outline-button" disabled={saving} onClick={() => input.current?.click()}><ImageSquare size={18} aria-hidden="true" />{t("上传图片", "Upload image")}</button>
        <span className="feature-muted">JPG / PNG / WebP · 10 MB</span>
      </div>
      {processing && <p className="feature-muted" role="status">{pendingDaily ? t("正在获取壁纸…", "Fetching wallpaper…") : t("正在处理图片…", "Processing image…")}</p>}
      {draft && <>
        <div className="background-file-info"><span>{draft.name}</span><span>{draft.width} × {draft.height}</span></div>
        <fieldset className="background-controls" disabled={saving || processing}>
          <legend className="sr-only">{t("背景显示", "Background display")}</legend>
          <label className="background-fit">{t("显示方式", "Image fit")}<select value={draft.fit} onChange={(event) => change({ fit: event.target.value as BackgroundConfig['fit'] })}><option value="cover">{t("填满", "Fill")}</option><option value="contain">{t("完整显示", "Fit entire image")}</option></select></label>
          <div className="background-ranges">{sliders.map(([key, label, max, unit]) => <label className="settings-range" key={key}>
            <span>{label}</span><input type="range" aria-label={label} min={0} max={max} step={1} value={draft[key]} onChange={(event) => change({ [key]: event.target.valueAsNumber })} /><span aria-hidden="true">{draft[key]}{unit}</span>
          </label>)}</div>
          <div className="background-ranges background-surface-controls">
            {([
              ['panelOpacity', t('容器透明度','Panel transparency'), 100, theme==='dark'?95:97],
              ['workspaceOpacity', t('工作区透明度','Workspace transparency'), 100, theme==='dark'?95:92],
              ['panelBlur', t('容器毛玻璃','Panel blur'), 24, 0],
              ['borderOpacity', t('边框强度','Border strength'), 100, 100],
            ] as const).map(([key,label,max,fallback])=>{
              const opacity=key==='panelOpacity'||key==='workspaceOpacity';const value=draft[key]??fallback;const shown=opacity?100-value:value;
              return <label className="settings-range" key={key}><span>{label}</span><input type="range" aria-label={label} min={0} max={max} step={1} value={shown} onChange={event=>change({[key]:opacity?100-event.target.valueAsNumber:event.target.valueAsNumber})}/><span aria-hidden="true">{shown}{key==='panelBlur'?'px':'%'}</span></label>;
            })}
          </div>
        </fieldset>
      </>}
      {error && <p className="form-error" role="alert">{<SystemMessage text={error} />}</p>}
      </div>
      <div className="background-editor-actions">
        <button type="button" className="text-button" disabled={saving || (!draft && !processing)} onClick={() => { cancelProcessing();discardStaged();setUploadFile(undefined);setFollowingSite(true);setDraft(undefined); setAutomatic('off'); setDirty(true); setError(''); }}><ArrowCounterClockwise size={17} aria-hidden="true" />{t("恢复默认", "Restore default")}</button>
        <div><button type="button" className="outline-button" disabled={saving} onClick={close}>{t("取消", "Cancel")}</button><button className="primary-button" disabled={!dirty || processing || saving}>{saving ? t("保存中…", "Saving…") : t("保存", "Save")}</button></div>
      </div>
    </form>
  </Dialog>;
}
