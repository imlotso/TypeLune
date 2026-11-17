import {useI18n} from '../lib/i18n';
import {useEffect,useState,type ReactNode} from 'react';
import {isBackgroundConfig,type BackgroundConfig,type BackgroundTheme} from '../lib/background';
import {wallpaperImageSource,wallpaperImageSet} from '../lib/wallpaper-image';

export function RoomBackground({theme,background,adaptive=true,children}:{theme:BackgroundTheme;background?:BackgroundConfig;adaptive?:boolean;children:ReactNode}){
 const {t}=useI18n();
 const [loaded,setLoaded]=useState<BackgroundConfig>();const [failed,setFailed]=useState<string>();const [retries,setRetries]=useState(0);
 const current=isBackgroundConfig(background)?background:undefined;
 useEffect(()=>{setFailed(undefined);setRetries(0);},[current?.image]);
 useEffect(()=>{if(!failed||retries>=2)return;const timer=setTimeout(()=>{setRetries(n=>n+1);setFailed(undefined);},15_000);return()=>clearTimeout(timer);},[failed,retries]);
 const active=current?(failed===current.image?(loaded?{...current,image:loaded.image,name:loaded.name,width:loaded.width,height:loaded.height,daily:loaded.daily}:undefined):current):undefined;
 const previous=active&&loaded&&active.image!==loaded.image?loaded:undefined;
 const style=(value:BackgroundConfig)=>({objectFit:value.fit,objectPosition:`${value.positionX}% ${value.positionY}%`,filter:`blur(${value.blur}px)`});
 return <main className={`room${active?' room-custom':''}`}>
  {!active&&<div className="room-default-background" aria-hidden="true"/>}
  {active&&<div className="custom-background" data-theme={theme} aria-hidden="true">
   {previous&&<img src={wallpaperImageSource(previous.image)} srcSet={wallpaperImageSet(previous.image,adaptive)} sizes="100vw" alt="" style={style(active)}/>}
   <img key={active.image} data-testid="custom-background-image" src={wallpaperImageSource(active.image)} srcSet={wallpaperImageSet(active.image,adaptive)} sizes="100vw" alt="" referrerPolicy="no-referrer" onLoad={()=>setLoaded(active)} onError={()=>setFailed(active.image)} style={{...style(active),...(previous?{opacity:0,position:'absolute',inset:0}:{})}}/>
   <div className="background-shade" style={{opacity:active.shade/100}}/>
  </div>}
  {children}
  {failed&&<div className="wallpaper-load-status" role="status"><span>{t('壁纸暂时无法加载，已保留当前背景','Wallpaper unavailable. Current background retained.')}</span><button type="button" className="text-button" onClick={()=>{setRetries(0);setFailed(undefined);}}>{t('重试壁纸','Retry wallpaper')}</button></div>}
  {active?.daily&&<a className="wallpaper-credit" href={'https://wallhaven.cc/w/'+active.daily.id} target="_blank" rel="noopener noreferrer">Wallhaven ↗</a>}
 </main>;
}
