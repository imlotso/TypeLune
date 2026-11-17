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
  const migrating=!!background?.daily&&background.image.startsWith('data:');
  if(!ready||(!migrating&&kind==='off')||(background&&!background.daily))return;
  const day=new Date().toISOString().slice(0,10);
  const resolution=`${display.width}x${display.height}`;
  if(!migrating&&background?.daily?.day===day&&background.daily.kind===kind&&(!adaptive||background.daily.resolution===resolution))return;
  const controller=new AbortController();
  fetchDailyWallpaper(migrating?background!.daily!.kind:kind==='off'?'nature':kind,theme,controller.signal,{display:adaptive?display:undefined,...(migrating&&{id:background!.daily!.id})}).then(async result=>{
   if(controller.signal.aborted)return;
   await mutateWorkspaceValue(ownerId,'background',theme,(current,items)=>{
    const saved=workspaceSettings(items);
    if(controller.signal.aborted||(saved.wallpapers?.[theme]??'off')!==kind||(saved.wallpaperAdaptive?.[theme]!==false)!==adaptive||current?.image!==background?.image)return current;
    return {...result,...(migrating&&current?.daily&&{daily:{...result.daily!,day:current.daily.day}}),...(current?{fit:current.fit,positionX:current.positionX,positionY:current.positionY,blur:current.blur,shade:current.shade,...(current.panelOpacity!==undefined&&{panelOpacity:current.panelOpacity}),...(current.workspaceOpacity!==undefined&&{workspaceOpacity:current.workspaceOpacity}),...(current.panelBlur!==undefined&&{panelBlur:current.panelBlur}),...(current.borderOpacity!==undefined&&{borderOpacity:current.borderOpacity})}:{})};
   });
  }).catch(()=>{/* Retain the current image and retry next hour. Manual retry is available in settings. */});
  return()=>controller.abort();
 },[ownerId,theme,kind,background?.image,ready,tick,adaptive,display.width,display.height]);
}
