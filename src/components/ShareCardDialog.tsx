import { useEffect, useRef, useState } from 'react';
import { drawShareCard, type ShareCardData } from '../lib/share-card';
import { Dialog } from './Dialog';

export function ShareCardDialog({ data, theme, onClose }: { data: ShareCardData; theme: 'light' | 'dark'; onClose: () => void }) {
  const [showNickname, setShowNickname] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [nickname, setNickname] = useState(data.nickname);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  function draw() {
    if (!canvas.current) throw new Error('无法生成图片');
    drawShareCard(canvas.current, { ...data, nickname }, { showNickname, showTitle, theme });
    return canvas.current;
  }
  useEffect(() => { try { draw(); } catch (problem) { setError(problem instanceof Error ? problem.message : '无法生成图片'); } }, [data, nickname, showNickname, showTitle, theme]); // eslint-disable-line react-hooks/exhaustive-deps
  function imageBlob() {
    const image = draw();
    return new Promise<Blob>((resolve, reject) => {
      try { image.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成图片')), 'image/png'); }
      catch { reject(new Error('无法生成图片')); }
    });
  }
  async function download() {
    setBusy(true); setError(''); setNotice('');
    try {
      const url = URL.createObjectURL(await imageBlob());
      const link = document.createElement('a'); link.href = url; link.download = 'typing-result.png'; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('已开始下载');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '下载失败'); }
    finally { setBusy(false); }
  }
  async function copy() {
    setBusy(true); setError(''); setNotice('');
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('当前浏览器不支持复制图片，请下载');
      const item = new ClipboardItem({ 'image/png': imageBlob() });
      await navigator.clipboard.write([item]);
      setNotice('图片已复制');
    } catch { setError('复制图片不可用或失败，请下载'); }
    finally { setBusy(false); }
  }
  const description = `${data.language === 'zh' ? '中文' : 'English'}，${data.mode === 'article' ? '整篇' : `限时 ${data.duration / 60} 分钟`}，${data.speed} ${data.language === 'zh' ? '字/分' : 'WPM'}${data.correctCpm !== undefined ? `，${data.correctCpm} 正确字符/分` : ''}，准确率 ${data.accuracy}%`;
  return <Dialog title="分享成绩" onClose={onClose} dismissible={!busy}>
    <div className="feature-form share-card">
      <canvas ref={canvas} width={1200} height={630} role="img" aria-label={`成绩卡预览：${description}`} />
      <label className="settings-check"><input type="checkbox" checked={showNickname} onChange={(event) => setShowNickname(event.target.checked)} />显示昵称</label>
      {showNickname && <label>昵称<input value={nickname} maxLength={32} onChange={(event) => setNickname(event.target.value)} /></label>}
      <label className="settings-check"><input type="checkbox" checked={showTitle} disabled={!data.title} onChange={(event) => setShowTitle(event.target.checked)} />显示文章标题</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => void copy()}>复制图片</button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void download()}>下载图片</button></div>
    </div>
  </Dialog>;
}
