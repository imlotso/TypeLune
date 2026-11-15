import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ImageSquare } from '@phosphor-icons/react/ImageSquare';
import { ArrowCounterClockwise } from '@phosphor-icons/react/ArrowCounterClockwise';
import { defaultBackground, prepareBackgroundImage, type BackgroundConfig, type BackgroundTheme } from '../lib/background';
import { Dialog } from './Dialog';

type Props = {
  theme: BackgroundTheme;
  value?: BackgroundConfig;
  onSave: (value: BackgroundConfig | undefined) => Promise<void>;
  onClose: () => void;
};

export function BackgroundDialog({ theme, value, onSave, onClose }: Props) {
  const { t, locale } = useI18n();

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

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current++; operation.current?.abort(); };
  }, []);
  useEffect(() => { if (!dirty) setDraft(value); }, [value, dirty]);

  function cancelProcessing() {
    generation.current++;
    operation.current?.abort();
    setProcessing(false);
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
      const image = await prepareBackgroundImage(file, controller.signal);
      if (!mounted.current || current !== generation.current) return;
      setDraft((previous) => ({ ...previous ?? defaultBackground(theme, image), ...image }));
      setDirty(true);
    } catch (problem) {
      if (mounted.current && current === generation.current && !controller.signal.aborted) setError(problem instanceof Error ? problem.message : t("图片处理失败", "Could not process image"));
    } finally {
      if (mounted.current && current === generation.current) setProcessing(false);
    }
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
      await onSave(draft);
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
      <div className={`background-preview${dragging ? ' is-dragging' : ''}`} data-theme={theme}
        onDragOver={(event) => { event.preventDefault(); if (!saving) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={drop}>
        <img alt={t("背景预览", "Background preview")} src={draft?.image ?? `/assets/cloud-room${theme === 'dark' ? '-night' : ''}.png`}
          style={{ objectFit: draft?.fit ?? 'cover', objectPosition: `${draft?.positionX ?? 50}% ${draft?.positionY ?? 50}%`, filter: `blur(${draft?.blur ?? 0}px)` }} />
        <div className="background-shade" style={{ opacity: (draft?.shade ?? 0) / 100 }} />
        <div className="background-preview-sample" aria-hidden="true"><span>TypeLune</span><i /><i /></div>
      </div>
      <div className="background-file-row" onDragOver={(event) => event.preventDefault()} onDrop={drop}>
        <input ref={input} hidden aria-label={t("背景图片", "Background image")} type="file" accept="image/jpeg,image/png,image/webp" disabled={saving}
          onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void choose(file); }} />
        <button type="button" className="outline-button" disabled={saving} onClick={() => input.current?.click()}><ImageSquare size={18} aria-hidden="true" />{draft ? t("更换图片", "Replace image") : t("选择图片", "Choose image")}</button>
        <span className="feature-muted">JPG / PNG / WebP · 10 MB</span>
      </div>
      {processing && <p className="feature-muted" role="status">{t("正在处理图片…", "Processing image…")}</p>}
      {draft && <>
        <div className="background-file-info"><span>{draft.name}</span><span>{draft.width} × {draft.height}</span></div>
        <fieldset className="background-controls" disabled={saving || processing}>
          <legend className="sr-only">{t("背景显示", "Background display")}</legend>
          <label className="background-fit">{t("显示方式", "Image fit")}<select value={draft.fit} onChange={(event) => change({ fit: event.target.value as BackgroundConfig['fit'] })}><option value="cover">{t("填满", "Fill")}</option><option value="contain">{t("完整显示", "Fit entire image")}</option></select></label>
          <div className="background-ranges">{sliders.map(([key, label, max, unit]) => <label className="settings-range" key={key}>
            <span>{label}</span><input type="range" aria-label={label} min={0} max={max} step={1} value={draft[key]} onChange={(event) => change({ [key]: event.target.valueAsNumber })} /><span aria-hidden="true">{draft[key]}{unit}</span>
          </label>)}</div>
        </fieldset>
      </>}
      {error && <p className="form-error" role="alert">{<SystemMessage text={error} />}</p>}
      <div className="background-editor-actions">
        <button type="button" className="text-button" disabled={saving || (!draft && !processing)} onClick={() => { cancelProcessing(); setDraft(undefined); setDirty(true); setError(''); }}><ArrowCounterClockwise size={17} aria-hidden="true" />{t("恢复默认", "Restore default")}</button>
        <div><button type="button" className="outline-button" disabled={saving} onClick={close}>{t("取消", "Cancel")}</button><button className="primary-button" disabled={!dirty || processing || saving}>{saving ? t("保存中…", "Saving…") : t("保存", "Save")}</button></div>
      </div>
    </form>
  </Dialog>;
}
