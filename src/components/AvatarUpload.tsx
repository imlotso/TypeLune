import { useRef, useState, useEffect } from 'react';
import { useI18n } from '../lib/i18n';
import { AccountAvatar } from './AccountAvatar';
export function AvatarUpload({ value, onChange, disabled, onProcessingChange }: { value?: string | null; onChange: (value: string | null) => void; disabled: boolean; onProcessingChange?: (value: boolean) => void }) {
 const { t } = useI18n(); const sequence = useRef(0); const [processing,setProcessing]=useState(false); const [error,setError]=useState('');
 useEffect(()=>{onProcessingChange?.(processing);return()=>onProcessingChange?.(false);},[processing,onProcessingChange]);
 useEffect(()=>()=>{sequence.current++;},[]);
 async function choose(file?:File) {
  if(!file)return; const operation=++sequence.current; setError('');setProcessing(true);
  try {
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error(t('请选择不超过 5 MB 的 JPG、PNG 或 WebP','Choose JPG, PNG or WebP up to 5 MB'));
   const bitmap=await createImageBitmap(file);
   try { if(bitmap.width*bitmap.height>16_000_000)throw Error(t('图片尺寸过大','Image dimensions are too large'));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const context=canvas.getContext('2d');if(!context)throw Error(t('无法处理图片','Cannot process image'));
    const side=Math.min(bitmap.width,bitmap.height);context.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);
    if(sequence.current===operation)onChange(canvas.toDataURL('image/webp',.85));
   } finally{bitmap.close();}
  }catch(e){if(sequence.current===operation)setError((e as Error).message);}finally{if(sequence.current===operation)setProcessing(false);}
 }
 return <div className="avatar-editor"><AccountAvatar avatar={value} size={72}/><label className="outline-button">{processing?t('处理中…','Processing…'):t('上传头像','Upload avatar')}<input type="file" aria-label={t('上传头像','Upload avatar')} accept="image/jpeg,image/png,image/webp" disabled={disabled||processing} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void choose(file);}}/></label>{value?.startsWith('data:')&&<button type="button" className="text-button" disabled={disabled||processing} onClick={()=>onChange(null)}>{t('移除头像','Remove avatar')}</button>}{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
