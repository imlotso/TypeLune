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
    <footer className="site-footer site-footer-updated">
      <div className="footer-links">{links.map(([page, label]) => <button key={page} className="text-button" disabled={!ready} onClick={() => onNavigate(page)}>{label}</button>)}
        {available && <button className="text-button support-button" onClick={() => { setOpen(true); load(); }}>{t('支持 TypeLune', 'Support TypeLune')}</button>}
      </div>
      <span className="site-attribution">Powered by <a href="https://www.sitetalk.net" target="_blank" rel="noopener noreferrer">SiteTalk</a></span>
    </footer>
    {open && <Dialog title={t('支持 TypeLune', 'Support TypeLune')} onClose={() => setOpen(false)} className="support-dialog">
      {loading ? <p role="status">{t('正在读取收款码…', 'Loading payment codes…')}</p> : error ? <div><p role="alert" className="form-error">{t('收款码暂时无法读取', 'Payment codes are unavailable')}</p><button className="outline-button" onClick={load}>{t('重试', 'Retry')}</button></div> : !available ? <p role="status">{t('收款码尚未配置', 'No payment codes are configured')}</p> : <>
        <div className={'support-codes' + (!support?.alipay || !support?.wechat ? ' support-single' : '')}>
          {support?.alipay && <figure><figcaption className="support-alipay">{t('支付宝', 'Alipay')}</figcaption><div className="support-image"><img src={support.alipay.dataUrl} alt={t('支付宝收款码', 'Alipay payment QR code')} /></div></figure>}
          {support?.wechat && <figure><figcaption className="support-wechat">{t('微信', 'WeChat Pay')}</figcaption><div className="support-image"><img src={support.wechat.dataUrl} alt={t('微信收款码', 'WeChat payment QR code')} /></div></figure>}
        </div>
        <p className="support-note">{t('金额自定。付款前请核对收款方与金额。', 'Choose your amount. Verify the recipient and amount before paying.')}</p>
      </>}
    </Dialog>}
  </>;
}
