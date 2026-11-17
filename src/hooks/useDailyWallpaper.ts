import { useEffect, useState } from 'react';
import { fetchDailyWallpaper, wallpaperDisplay } from '../lib/daily-wallpaper';
import { type BackgroundConfig, type BackgroundTheme } from '../lib/background';
import type { ReaderSettings } from '../lib/models';
import { mutateWorkspaceValue, workspaceSettings } from '../lib/workspace';
export function useDailyWallpaper(ownerId: string | null, theme: BackgroundTheme, settings: ReaderSettings, background: BackgroundConfig | undefined, ready: boolean) {
 const [tick,setTick]=useState(0); const kind=settings.wallpapers?.[theme]??'off';
 const adaptive=settings.wallpaperAdaptive?.[theme]!==false;
 const [display,setDisplay]=useState(wallpaperDisplay);
 useEffect(()=>{
  const resize=()=>{const next=wallpaperDisplay();setDisplay(current=>current.width===next.width&&current.height===next.height?current:next);};
  window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);
 },[]);
 useEffect(()=>{const timer=window.setInterval(()=>setTick(n=>n+1),3600000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  if(!ready||kind==='off'||(background&&!background.daily))return;
  const day=new Date().toISOString().slice(0,10);
  const resolution=`${display.width}x${display.height}`;
  if(background?.daily?.day===day&&background.daily.kind===kind&&(!adaptive||background.daily.resolution===resolution))return;
  const controller=new AbortController();
  fetchDailyWallpaper(kind,theme,controller.signal,{display:adaptive?display:undefined}).then(async result=>{
   if(controller.signal.aborted)return;
   await mutateWorkspaceValue(ownerId,'background',theme,(current,items)=>{
    const saved=workspaceSettings(items);
    if(controller.signal.aborted||saved.wallpapers?.[theme]!==kind||(saved.wallpaperAdaptive?.[theme]!==false)!==adaptive||current?.image!==background?.image)return current;
    return {...result,...(current?{fit:current.fit,positionX:current.positionX,positionY:current.positionY,blur:current.blur,shade:current.shade}:{})};
   });
  }).catch(()=>{/* Retain the current image and retry next hour. Manual retry is available in settings. */});
  return()=>controller.abort();
 },[ownerId,theme,kind,background?.image,ready,tick,adaptive,display.width,display.height]);
}
