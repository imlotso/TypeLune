import { useAdminEdits } from '../AdminNavigationGuard';
import { SystemMessage } from '../SystemMessage';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { SupportSnapshot } from '../../../server/support-settings';
import { useI18n } from '../../lib/i18n';
import { ApiError } from '../../lib/api';
import { adminWrite, LoadState, useAdminResource, type AdminProps } from './common';

function SupportForm({ownerId,initial,reload}:AdminProps & {initial:SupportSnapshot;reload:()=>void}) {
 const {t}=useI18n(); const [saved,setSaved]=useState(initial); const [settings,setSettings]=useState(initial.settings);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[message,setMessage]=useState('');
 const mounted=useRef(true),pending=useRef(false);const dirty=JSON.stringify(settings)!==JSON.stringify(saved.settings);
 useAdminEdits(dirty,busy);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(!dirty&&!busy)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty,busy]);
 async function upload(key:'alipay'|'wechat',file?:File){
  if(!file||pending.current)return;
  setError('');setMessage('');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1024*1024){setError(t('请选择 1 MiB 以内的 PNG、JPG 或 WebP','Choose a PNG, JPG or WebP up to 1 MiB'));return;}
  pending.current=true;setBusy(true);
  try{const dataUrl=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error(t('图片读取失败','Could not read image')));r.readAsDataURL(file);});
   if(mounted.current)setSettings(old=>({...old,[key]:{dataUrl}}));
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:t('读取失败','Read failed'));}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 async function save(e:FormEvent){e.preventDefault();if(pending.current||!dirty||conflict)return;pending.current=true;setBusy(true);setError('');setMessage('');
  try{const result=await adminWrite<SupportSnapshot>(ownerId,'/support',{settings,revision:saved.revision});if(mounted.current){setSaved(result);setSettings(result.settings);setMessage(t('已保存','Saved'));}}
  catch(e){if(mounted.current){setConflict(e instanceof ApiError&&e.status===409);setError(e instanceof Error?e.message:t('保存失败','Save failed'));}}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 return <form className="feature-form" onSubmit={save}>
  <fieldset className="settings-group" disabled={busy||conflict}><legend>{t('支持 TypeLune','Support TypeLune')}</legend>
  <label className="settings-check"><input type="checkbox" checked={settings.enabled} onChange={e=>{setMessage('');setSettings(old=>({...old,enabled:e.target.checked}));}}/>{t('显示捐赠入口','Show support button')}</label>
  <p>{t('图片保存后可公开展示。请仅上传您要公开的收款码。','Saved images can be publicly displayed. Only upload payment codes you intend to publish.')}</p>
  <div className="feature-form-pair">{(['alipay','wechat'] as const).map(key=><div key={key}>
   <label>{key==='alipay'?t('支付宝收款码','Alipay QR code'):t('微信收款码','WeChat Pay QR code')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(key,file);}}/></label>
   {settings[key]&&<><img src={settings[key].dataUrl} alt={key==='alipay'?t('支付宝收款码预览','Alipay QR preview'):t('微信收款码预览','WeChat Pay QR preview')} style={{maxWidth:220,maxHeight:220,objectFit:'contain',background:'#fff'}}/><button type="button" className="outline-button" onClick={()=>{setMessage('');setSettings(old=>({...old,[key]:null}));}}>{t('移除','Remove')}</button></>}
  </div>)}</div>
  <p>{t('PNG / JPG / WebP，单张不超过 1 MiB，最大 2048 × 2048 像素。','PNG / JPG / WebP, up to 1 MiB and 2048 × 2048 pixels per image.')}</p></fieldset>
  {error&&<p role="alert"><SystemMessage text={error}/></p>}{message&&<p role="status">{message}</p>}
  <button className="outline-button" disabled={!dirty||busy||conflict}>{busy?t('保存中','Saving'):t('保存','Save')}</button>
  {conflict&&<button type="button" className="outline-button" onClick={()=>{if(window.confirm(t('放弃未保存修改并重新加载？','Discard unsaved changes and reload?')))reload();}}>{t('重新加载','Reload')}</button>}
 </form>;
}
export function SupportSettingsPanel(props:AdminProps){
 const resource=useAdminResource<SupportSnapshot>(props.ownerId,'/support');
 return resource.data?<SupportForm {...props} key={props.ownerId+':'+resource.data.revision} initial={resource.data} reload={resource.retry}/>:<LoadState error={resource.error} retry={resource.retry}/>;
}
