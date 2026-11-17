import { useEffect, useState } from 'react';
import { fetchDailyWallpaper } from '../lib/daily-wallpaper';
import { type BackgroundConfig, type BackgroundTheme } from '../lib/background';
import type { ReaderSettings } from '../lib/models';
import { mutateWorkspaceValue, workspaceSettings } from '../lib/workspace';
export function useDailyWallpaper(ownerId: string | null, theme: BackgroundTheme, settings: ReaderSettings, background: BackgroundConfig | undefined, ready: boolean) {
 const [tick,setTick]=useState(0); const kind=settings.wallpapers?.[theme]??'off';
 useEffect(()=>{const timer=window.setInterval(()=>setTick(n=>n+1),3600000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  if(!ready||kind==='off'||(background&&!background.daily))return;
  const day=new Date().toISOString().slice(0,10);
  if(background?.daily?.day===day&&background.daily.kind===kind)return;
  const controller=new AbortController();
  fetchDailyWallpaper(kind,theme,controller.signal).then(async result=>{
   if(controller.signal.aborted)return;
   await mutateWorkspaceValue(ownerId,'background',theme,(current,items)=>{
    if(controller.signal.aborted||workspaceSettings(items).wallpapers?.[theme]!==kind||current?.image!==background?.image)return current;
    return {...result,...(current?{fit:current.fit,positionX:current.positionX,positionY:current.positionY,blur:current.blur,shade:current.shade}:{})};
   });
  }).catch(()=>{/* Retain the current image and retry next hour. Manual retry is available in settings. */});
  return()=>controller.abort();
 },[ownerId,theme,kind,background?.image,ready,tick]);
}
