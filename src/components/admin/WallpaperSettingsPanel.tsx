import { useState, type FormEvent } from 'react';
import { useI18n } from '../../lib/i18n';
import { ApiError } from '../../lib/api';
import { wallpaperStyles, wallpaperStyleNames } from '../../lib/wallpaper-policy';
import type { SiteWallpaperSnapshot, SiteWallpaperSettings } from '../../../server/site-wallpapers';
import { useAdminEdits } from '../AdminNavigationGuard';
import { SystemMessage } from '../SystemMessage';
import { adminWrite, LoadState, useAdminResource, type AdminProps } from './common';

function WallpaperSettingsForm({ ownerId, initial, reload }: AdminProps & { initial: SiteWallpaperSnapshot; reload: () => void }) {
  const { t, locale } = useI18n();
  const [snapshot, setSnapshot] = useState(initial); const [settings, setSettings] = useState<SiteWallpaperSettings>(initial.settings);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false); const [conflict, setConflict] = useState(false);
  const dirty = JSON.stringify(settings) !== JSON.stringify(snapshot.settings); useAdminEdits(dirty,busy);
  const time = (value: number) => new Date(value).toLocaleString(locale==='zh'?'zh-CN':'en-US');
  async function save(event: FormEvent) {
    event.preventDefault(); if(busy||!dirty||!settings.styles.length||conflict)return;setBusy(true);setError('');setSaved(false);
    try { const next=await adminWrite<SiteWallpaperSnapshot>(ownerId,'/wallpaper',{settings,revision:snapshot.revision});setSnapshot(next);setSettings(next.settings);setSaved(true); }
    catch(problem){setConflict(problem instanceof ApiError&&problem.status===409);setError(problem instanceof Error?problem.message:t('保存失败','Could not save'));}finally{setBusy(false);}
  }
  async function refresh() {
    if(busy||dirty||!settings.enabled)return;setBusy(true);setError('');setSaved(false);
    try { const next=await adminWrite<SiteWallpaperSnapshot>(ownerId,'/wallpaper/refresh',{},55_000);setSnapshot(next);if(!next.background)setError(t('暂时没有可用壁纸，请重试','No wallpaper available. Try again.')); }
    catch(problem){setError(problem instanceof Error?problem.message:t('获取失败','Could not retrieve wallpaper'));}finally{setBusy(false);}
  }
  return <form className="feature-form site-wallpaper-settings" onSubmit={save}>
    <fieldset className="settings-group" disabled={busy||conflict}>
      <legend>{t('全站壁纸','Site-wide wallpaper')}</legend>
      <label className="settings-check"><input type="checkbox" checked={settings.enabled} onChange={event=>{setSettings(current=>({...current,enabled:event.target.checked}));setSaved(false);}}/>{t('每 12 小时自动更换','Change automatically every 12 hours')}</label>
      <div className="wallpaper-style-grid" role="group" aria-label={t('壁纸风格','Wallpaper styles')}>{wallpaperStyleNames.map(style=><label className="settings-check" key={style}><input type="checkbox" checked={settings.styles.includes(style)} onChange={event=>{const checked=event.target.checked;setSettings(current=>({...current,styles:checked?[...current.styles,style]:current.styles.filter(value=>value!==style)}));setSaved(false);}}/>{t(wallpaperStyles[style].zh,wallpaperStyles[style].en)}</label>)}</div>
      {!settings.styles.length&&<p className="form-error" role="alert">{t('至少选择一种风格','Select at least one style')}</p>}
      {snapshot.background&&<div className="site-wallpaper-preview"><img src={snapshot.background.image} alt={t('全站壁纸预览','Site wallpaper preview')} referrerPolicy="no-referrer"/><a href={'https://wallhaven.cc/w/'+snapshot.background.daily?.id} target="_blank" rel="noopener noreferrer">Wallhaven ↗</a></div>}
      {snapshot.updatedAt&&<p className="feature-muted">{t('上次更换：','Last changed: ')}{time(snapshot.updatedAt)}</p>}
      {snapshot.nextChangeAt&&<p className="feature-muted">{t('下次更换：','Next change: ')}{time(snapshot.nextChangeAt)}</p>}
    </fieldset>
    {error&&<p className="form-error" role="alert"><SystemMessage text={error}/></p>}{saved&&<p role="status" className="feature-muted">{t('壁纸设置已保存','Wallpaper settings saved')}</p>}
    <div className="feature-actions">{conflict&&<button type="button" className="outline-button" onClick={reload}>{t('重新加载','Reload')}</button>}
      <button type="button" className="outline-button" disabled={busy||dirty||!settings.enabled||conflict} onClick={()=>void refresh()}>{t('立即更换壁纸','Change wallpaper now')}</button>
      <button className="primary-button" disabled={busy||!dirty||!settings.styles.length||conflict}>{busy?t('保存中…','Saving…'):t('保存壁纸设置','Save wallpaper settings')}</button></div>
  </form>;
}

export function WallpaperSettingsPanel({ownerId}:AdminProps){
  const {t}=useI18n();const {data,error,retry}=useAdminResource<SiteWallpaperSnapshot>(ownerId,'/wallpaper');
  return data&&Array.isArray(data.settings?.styles)?<WallpaperSettingsForm ownerId={ownerId} initial={data} reload={retry}/>:<LoadState error={error||(data?t('壁纸设置无法读取','Could not read wallpaper settings'):'')} retry={retry}/>;
}
