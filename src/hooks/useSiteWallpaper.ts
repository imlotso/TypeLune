import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { isBackgroundConfig, type BackgroundConfig, type BackgroundTheme } from '../lib/background';
import { wallpaperRequestTimeoutMs } from '../lib/wallpaper-policy';

type Snapshot = { enabled: boolean; background: BackgroundConfig | null; nextChangeAt: number | null; serverTime: number; retryAfterMs: number };
export function useSiteWallpaper(theme: BackgroundTheme, ready: boolean) {
  const [background,setBackground]=useState<BackgroundConfig>();
  useEffect(()=>{
    if(!ready)return;
    let disposed=false,running=false;let timer:ReturnType<typeof setTimeout>;let controller:AbortController|undefined;
    const refresh=async()=>{
      if(disposed||running)return;running=true;clearTimeout(timer);controller=new AbortController();let delay=60_000;
      try{
        const value=await api<Snapshot>('/api/site/wallpaper?theme='+theme,{signal:controller.signal,timeoutMs:wallpaperRequestTimeoutMs});
        if(disposed)return;
        if(typeof value.enabled!=='boolean'||(value.background!==null&&!isBackgroundConfig(value.background)))throw new Error('Invalid wallpaper');
        if(!value.enabled)setBackground(undefined);else if(value.background)setBackground(value.background);
        delay=Math.min(60_000,Math.max(1000,value.retryAfterMs||60_000));
        if(value.enabled&&value.nextChangeAt&&Number.isFinite(value.serverTime))delay=Math.min(delay,Math.max(1000,value.nextChangeAt-value.serverTime+250));
      }catch{/* Keep the last working default while the service recovers. */}
      finally{running=false;if(!disposed)timer=setTimeout(()=>void refresh(),delay);}
    };
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};
    void refresh();document.addEventListener('visibilitychange',visible);
    return()=>{disposed=true;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visible);};
  },[theme,ready]);
  return useMemo(()=>background?{...background,shade:theme==='dark'?45:25}:undefined,[background,theme]);
}
