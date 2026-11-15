import type { Language } from '../data/articles';
import type { PracticeMode, PracticeRecord } from './models';
import { splitCharacters } from './scoring';

export type ShareCardData = { siteName: string; siteUrl: string; language: Language; mode: PracticeMode; duration: number; elapsedMs: number | null;
  speed: number; accuracy: number; correctCpm?: number; nickname: string; title: string; personalBest: boolean };
export type ShareCardOptions = { showNickname: boolean; showTitle: boolean; theme: 'light' | 'dark'; locale?: 'zh' | 'en' };

export function makeShareCardData(record: PracticeRecord, siteUrl: string, nickname: string, personalBest: boolean, correctCpm?: number): ShareCardData {
  let url: URL;
  try { url = new URL(siteUrl); } catch { throw new Error('站点地址无法读取'); }
  if (!['http:', 'https:'].includes(url.protocol) || !['zh', 'en'].includes(record.language) || (record.mode !== undefined && !['timed', 'article'].includes(record.mode)) ||
    !Number.isFinite(record.speed) || record.speed < 0 || !Number.isFinite(record.accuracy) || record.accuracy < 0 || record.accuracy > 100 ||
    !Number.isFinite(record.duration) || record.duration <= 0) throw new Error('成绩数据无法读取');
  return { siteName: 'TypeLune', siteUrl: url.origin, language: record.language, mode: record.mode ?? 'timed', duration: record.duration,
    elapsedMs: typeof record.elapsedMs === 'number' && Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0 ? record.elapsedMs : null,
    speed: record.speed, accuracy: record.accuracy, ...(record.language === 'en' && typeof correctCpm === 'number' && Number.isFinite(correctCpm) && correctCpm >= 0 && { correctCpm }), nickname, title: record.article?.title ?? '', personalBest };
}

export function truncateCanvasText(value: string, maxWidth: number, measure: (text: string) => number) {
  if (measure(value) <= maxWidth) return value;
  const suffix = '…';
  if (measure(suffix) > maxWidth) return '';
  const chars = splitCharacters(value);
  let low = 0; let high = chars.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(chars.slice(0, middle).join('') + suffix) <= maxWidth) low = middle; else high = middle - 1;
  }
  return chars.slice(0, low).join('') + suffix;
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 18, 23, Math.PI * .5, Math.PI * 1.5); ctx.arc(25, 5, 30, Math.PI, Math.PI * 1.95);
  ctx.arc(54, 17, 23, Math.PI * 1.05, Math.PI * .5); ctx.closePath(); ctx.fill(); ctx.restore();
}
function timeText(milliseconds: number | null) {
  if (milliseconds === null) return '—';
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData, options: ShareCardOptions) {
  const t = (zh:string,en:string)=> options.locale === 'en' ? en : zh;
  canvas.width = 1200; canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法生成图片');
  const dark = options.theme === 'dark';
  const color = dark ? { top: '#171b3a', bottom: '#35315c', panel: '#252942', ink: '#f1efff', muted: '#cac5e4', accent: '#c5b5ff', cloud: 'rgba(191,182,255,.10)', border: '#68618e' }
    : { top: '#e8f5ff', bottom: '#ebe5fa', panel: '#fffefe', ink: '#37335e', muted: '#746c8f', accent: '#7560bd', cloud: 'rgba(255,255,255,.62)', border: '#d2c7ec' };
  const gradient = ctx.createLinearGradient(0, 0, 1200, 630); gradient.addColorStop(0, color.top); gradient.addColorStop(1, color.bottom);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 630);
  cloud(ctx, 30, 62, 2.1, color.cloud); cloud(ctx, 962, 444, 2.3, color.cloud); cloud(ctx, 970, 50, 1.3, color.cloud);
  rounded(ctx, 58, 48, 1084, 534, 32); ctx.fillStyle = color.panel; ctx.fill(); ctx.strokeStyle = color.border; ctx.lineWidth = 2; ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = color.accent; ctx.font = '700 31px system-ui, sans-serif'; ctx.fillText(data.siteName, 108, 110);
  ctx.textAlign = 'right'; ctx.fillStyle = color.muted; ctx.font = '500 22px system-ui, sans-serif';
  ctx.fillText(truncateCanvasText(data.siteUrl, 480, (text) => ctx.measureText(text).width), 1090, 110);
  ctx.textAlign = 'left'; ctx.fillStyle = color.ink; ctx.font = '700 36px system-ui, sans-serif';
  const title = options.showTitle && data.title ? data.title : t("练习成绩","Practice result");
  ctx.fillText(truncateCanvasText(title, data.personalBest ? 740 : 980, (text) => ctx.measureText(text).width), 108, 185);
  if (data.personalBest) {
    rounded(ctx, 900, 152, 190, 48, 24); ctx.fillStyle = dark ? '#51447c' : '#eee8fb'; ctx.fill();
    ctx.fillStyle = color.accent; ctx.font = '700 20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t("个人最佳","Personal best"), 995, 176); ctx.textAlign = 'left';
  }
  ctx.fillStyle = color.muted; ctx.font = '600 22px system-ui, sans-serif'; ctx.fillText(data.language === 'zh' ? t("速度 · 字/分","Speed · chars/min") : t("速度 · WPM","Speed · WPM"), 110, 255); ctx.fillText(t("准确率","Accuracy"), 680, 255);
  ctx.fillStyle = color.accent; ctx.font = '700 88px system-ui, sans-serif';
  ctx.fillText(truncateCanvasText(String(data.speed), 460, (text) => ctx.measureText(text).width), 105, 330);
  ctx.fillText(truncateCanvasText(`${data.accuracy}%`, 400, (text) => ctx.measureText(text).width), 675, 330);
  if (data.correctCpm !== undefined) { ctx.fillStyle = color.muted; ctx.font = '500 20px system-ui, sans-serif'; ctx.fillText(t(`${data.correctCpm} 正确字符/分`,`${data.correctCpm} correct chars/min`), 110, 382); }
  ctx.strokeStyle = color.border; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(110, 413); ctx.lineTo(1090, 413); ctx.stroke();
  ctx.fillStyle = color.ink; ctx.font = '600 25px system-ui, sans-serif';
  const language = data.language === 'zh' ? t("中文","Chinese") : 'English';
  const mode = data.mode === 'article' ? t("整篇","Full article") : t(`限时 ${data.duration / 60} 分钟`, `Timed ${data.duration / 60} min`);
  ctx.fillText(`${language}  ·  ${mode}  ·  ${t("用时","Time")} ${timeText(data.elapsedMs)}`, 110, 458);
  ctx.fillStyle = color.muted; ctx.font = '500 22px system-ui, sans-serif'; ctx.fillText(t("个人成绩","Personal result"), 110, 525);
  if (options.showNickname && data.nickname.trim()) {
    ctx.textAlign = 'right'; ctx.fillText(truncateCanvasText(data.nickname.trim(), 600, (text) => ctx.measureText(text).width), 1090, 525);
  }
}
