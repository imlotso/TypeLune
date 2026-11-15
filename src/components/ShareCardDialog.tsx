import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { drawShareCard, type ShareCardData } from '../lib/share-card';
import { Dialog } from './Dialog';

export function ShareCardDialog({ data, theme, onClose }: { data: ShareCardData; theme: 'light' | 'dark'; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [showNickname, setShowNickname] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [nickname, setNickname] = useState(data.nickname);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  function draw() {
    if (!canvas.current) throw new Error(t("无法生成图片", "Could not create image"));
    drawShareCard(canvas.current, { ...data, nickname }, { showNickname, showTitle, theme, locale });
    return canvas.current;
  }
  useEffect(() => { try { draw(); } catch (problem) { setError(problem instanceof Error ? problem.message : t("无法生成图片", "Could not create image")); } }, [data, nickname, showNickname, showTitle, theme, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  function imageBlob() {
    const image = draw();
    return new Promise<Blob>((resolve, reject) => {
      try { image.toBlob((blob) => blob ? resolve(blob) : reject(new Error(t("无法生成图片", "Could not create image"))), 'image/png'); }
      catch { reject(new Error(t("无法生成图片", "Could not create image"))); }
    });
  }
  async function download() {
    setBusy(true); setError(''); setNotice('');
    try {
      const url = URL.createObjectURL(await imageBlob());
      const link = document.createElement('a'); link.href = url; link.download = 'typing-result.png'; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(t("已开始下载", "Download started"));
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("下载失败", "Download failed")); }
    finally { setBusy(false); }
  }
  async function copy() {
    setBusy(true); setError(''); setNotice('');
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error(t("当前浏览器不支持复制图片，请下载", "This browser cannot copy images. Download instead."));
      const item = new ClipboardItem({ 'image/png': imageBlob() });
      await navigator.clipboard.write([item]);
      setNotice(t("图片已复制", "Image copied"));
    } catch { setError(t("复制图片不可用或失败，请下载", "Could not copy image. Download instead.")); }
    finally { setBusy(false); }
  }
  const description = `${data.language === 'zh' ? t("中文", "Chinese") : 'English'}，${data.mode === 'article' ? t("整篇", "Full article") : t(`限时 ${data.duration / 60} 分钟`, `Timed ${data.duration / 60} min`)}，${data.speed} ${data.language === 'zh' ? t("字/分", "chars/min") : 'WPM'}${data.correctCpm !== undefined ? t(`，${data.correctCpm} 正确字符/分`, `, ${data.correctCpm} correct chars/min`) : ''}${t("，准确率 ", ", accuracy ")}${data.accuracy}%`;
  return <Dialog title={t("分享成绩", "Share result")} onClose={onClose} dismissible={!busy}>
    <div className="feature-form share-card">
      <canvas ref={canvas} width={1200} height={630} role="img" aria-label={t(`成绩卡预览：${description}`,`Result card preview: ${description}`)} />
      <label className="settings-check"><input type="checkbox" checked={showNickname} onChange={(event) => setShowNickname(event.target.checked)} />{t("显示昵称", "Show nickname")}</label>
      {showNickname && <label>{t("昵称", "Nickname")}<input value={nickname} maxLength={32} onChange={(event) => setNickname(event.target.value)} /></label>}
      <label className="settings-check"><input type="checkbox" checked={showTitle} disabled={!data.title} onChange={(event) => setShowTitle(event.target.checked)} />{t("显示文章标题", "Show article title")}</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => void copy()}>{t("复制图片", "Copy image")}</button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void download()}>{t("下载图片", "Download image")}</button></div>
    </div>
  </Dialog>;
}
