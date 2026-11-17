import {wallpaperImageSource,wallpaperImageSet} from '../lib/wallpaper-image';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { BackgroundConfig } from '../lib/background';
import { useI18n } from '../lib/i18n';
import { AccountAvatar } from './AccountAvatar';
type Profile = {id:string;displayName:string;avatar:string|null;joinedAt:number;profilePublic:boolean;stats:{language:string;rounds:number;elapsedMs:number;bestSpeed:number;accuracy:number}[];backgrounds:Record<string,BackgroundConfig>};
export function PublicProfile({id,onBack}:{id:string;onBack:()=>void}) {
 const {t,locale}=useI18n();const [data,setData]=useState<{id:string;value:Profile}>();const [error,setError]=useState('');const [revision,setRevision]=useState(0);
 useEffect(()=>{setError('');const controller=new AbortController();api<Profile>('/api/profiles/'+encodeURIComponent(id),{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setData({id,value});}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[id,revision]);
 const profile=data?.id===id?data.value:undefined;
 return <section className="content-panel feature-panel public-profile"><button className="text-button" onClick={onBack}>{t('返回排行榜','Back to rankings')}</button>{error?<><h1>{t('用户资料不可查看','Profile unavailable')}</h1><p className="feature-muted">{t('该用户已关闭公开资料，或账号不存在。','This profile is private or unavailable.')}</p><button className="outline-button" onClick={()=>setRevision(n=>n+1)}>{t('重试','Retry')}</button></>:!profile?<p role="status">{t('加载中…','Loading…')}</p>:<>
 <header className="public-profile-heading"><AccountAvatar avatar={profile.avatar} size={88}/><div><h1>{profile.displayName}</h1><p className="feature-muted">{t('加入于 ','Joined ')}{new Date(profile.joinedAt).toLocaleDateString(locale==='zh'?'zh-CN':'en-US')}</p>{!profile.profilePublic&&<span>{t('仅自己可见','Only you can view this profile')}</span>}</div></header>
 <h2>{t('在线练习统计','Online practice statistics')}</h2><div className="profile-stats">{profile.stats.length?profile.stats.map(row=><article key={row.language}><h3>{row.language==='zh'?t('中文','Chinese'):'English'}</h3><p className="feature-muted">{t('最高速度','Best speed')}</p><strong>{Number(row.bestSpeed||0).toFixed(1)} {row.language==='zh'?t('字符/分钟','chars/min'):'WPM'}</strong><p>{row.rounds} {t('轮练习','rounds')} · {Math.round(row.elapsedMs/6000)/10} {t('分钟','minutes')}</p><p>{t('平均准确率','Average accuracy')} {Number(row.accuracy||0).toFixed(1)}%</p></article>):<p className="feature-muted">{t('暂无已完成的在线练习','No completed online practice yet')}</p>}</div>
 <h2>{t('正在使用的壁纸','Wallpapers')}</h2><div className="profile-wallpapers">{(['light','dark'] as const).map(theme=><figure key={theme}><img src={wallpaperImageSource(profile.backgrounds[theme]?.image||'/assets/lake-default.webp')} srcSet={wallpaperImageSet(profile.backgrounds[theme]?.image||'/assets/lake-default.webp')} sizes="(max-width: 800px) 100vw, 800px" alt={theme==='light'?t('日间壁纸','Day wallpaper'):t('夜间壁纸','Night wallpaper')}/><figcaption>{theme==='light'?t('日间','Day'):t('夜间','Night')}{profile.backgrounds[theme]?.daily&&<a href={'https://wallhaven.cc/w/'+profile.backgrounds[theme].daily!.id} target="_blank" rel="noopener noreferrer">Wallhaven ↗</a>}</figcaption></figure>)}</div>
 </>}</section>;
}
