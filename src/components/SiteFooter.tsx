import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { MainView } from '../lib/routes';
import { Dialog } from './Dialog';
import '../support.css';

type Code = { dataUrl: string };
type Support = { enabled: boolean; alipay?: Code; wechat?: Code };
const validCode = (value: unknown): value is Code => !!value && typeof value === 'object' && 'dataUrl' in value && typeof value.dataUrl === 'string' && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.dataUrl);
function parseSupport(value: Support): Support {
  return { enabled: value.enabled === true, alipay: validCode(value.alipay) ? value.alipay : undefined, wechat: validCode(value.wechat) ? value.wechat : undefined };
}
export function SiteFooter({ ready, onNavigate }: { ready: boolean; onNavigate: (view: MainView) => void }) {
  const { t } = useI18n();
  const [support, setSupport] = useState<Support>();
  const [open, setOpen] = useState(false);
  const [enlarged, setEnlarged] = useState<'alipay' | 'wechat' | null>(null);
  const enlargeButtons = useRef<Partial<Record<'alipay' | 'wechat', HTMLButtonElement | null>>>({});
  const backButton = useRef<HTMLButtonElement>(null);
  const previousCode = useRef<'alipay' | 'wechat' | null>(null);
  useEffect(() => {
    if (enlarged) { previousCode.current = enlarged; backButton.current?.focus(); }
    else if (previousCode.current) { enlargeButtons.current[previousCode.current]?.focus(); previousCode.current = null; }
  }, [enlarged]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | undefined>(undefined);
  const load = () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(false);
    void api<Support>('/api/site/support', { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted) setSupport(parseSupport(value));
    }).catch(() => {
      if (!controller.signal.aborted) { setSupport(undefined); setError(true); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  };
  useEffect(() => { load(); return () => request.current?.abort(); }, []);
  const available = support?.enabled && !!(support.alipay || support.wechat);
  const links: [MainView, string][] = [['help', t('使用帮助', 'Help')], ['feedback', t('功能反馈', 'Feedback')], ['privacy', t('隐私政策', 'Privacy')], ['terms', t('服务条款', 'Terms')], ['about', t('关于与联系', 'About & contact')]];
  return <>
    <footer className="site-footer">
      <nav className="footer-links" aria-label={t('页脚导航', 'Footer navigation')}>{links.map(([page, label]) => <button key={page} className="text-button" disabled={!ready} onClick={() => onNavigate(page)}>{label}</button>)}
        {available && <button className="text-button support-button" onClick={() => { setEnlarged(null); setOpen(true); load(); }}>{t('支持 TypeLune', 'Support TypeLune')}</button>}
      </nav>
      <span className="site-attribution">Powered by <a href="https://www.sitetalk.net" target="_blank" rel="noopener noreferrer">SiteTalk</a></span>
    </footer>
    {open && <Dialog title={t('支持 TypeLune', 'Support TypeLune')} onClose={() => setOpen(false)} className="support-dialog">
      {loading ? <p role="status">{t('正在读取收款码…', 'Loading payment codes…')}</p> : error ? <div><p role="alert" className="form-error">{t('收款码暂时无法读取', 'Payment codes are unavailable')}</p><button className="outline-button" onClick={load}>{t('重试', 'Retry')}</button></div> : !available ? <p role="status">{t('收款码尚未配置', 'No payment codes are configured')}</p> : <>
        {enlarged && support[enlarged] ? <div className="support-expanded">
          <button type="button" className="outline-button" ref={backButton} onClick={() => setEnlarged(null)}>{t('返回收款码列表', 'Back to payment codes')}</button>
          <p>{enlarged === 'alipay' ? t('支付宝', 'Alipay') : t('微信', 'WeChat Pay')}</p>
          <img src={support[enlarged]!.dataUrl} alt={enlarged === 'alipay' ? t('放大的支付宝收款码', 'Enlarged Alipay payment QR code') : t('放大的微信收款码', 'Enlarged WeChat payment QR code')} />
          <p className="support-note">{t('图片完整显示，未裁剪。可滚动查看；付款前请核对收款方。', 'Full image, without cropping. Scroll to view it; verify the recipient before paying.')}</p>
        </div> : <><div className={'support-codes' + (!support?.alipay || !support?.wechat ? ' support-single' : '')}>
          {support?.alipay && <figure><figcaption className="support-alipay">{t('支付宝', 'Alipay')}</figcaption><button type="button" className="support-image support-image-button" ref={element => { enlargeButtons.current.alipay = element; }} aria-label={t('放大查看支付宝收款码', 'Enlarge Alipay payment QR code')} onClick={() => setEnlarged('alipay')}><img src={support.alipay.dataUrl} alt={t('支付宝收款码', 'Alipay payment QR code')} /></button></figure>}
          {support?.wechat && <figure><figcaption className="support-wechat">{t('微信', 'WeChat Pay')}</figcaption><button type="button" className="support-image support-image-button" ref={element => { enlargeButtons.current.wechat = element; }} aria-label={t('放大查看微信收款码', 'Enlarge WeChat payment QR code')} onClick={() => setEnlarged('wechat')}><img src={support.wechat.dataUrl} alt={t('微信收款码', 'WeChat payment QR code')} /></button></figure>}
        </div><p className="support-note">{t('点击收款码可放大查看，便于扫描。', 'Select a payment code to enlarge it for scanning.')}</p></>}
        <p className="support-note">{t('金额自定。付款前请核对收款方与金额。', 'Choose your amount. Verify the recipient and amount before paying.')}</p>
      </>}
    </Dialog>}
  </>;
}
