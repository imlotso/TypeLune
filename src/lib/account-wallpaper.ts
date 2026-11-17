import type {BackgroundConfig,BackgroundTheme} from './background';
import type {WallpaperStyle} from './wallpaper-policy';
import {fetchWorkspace} from './workspace-fetch';
import {readWorkspace,newerWorkspaceItems,wallpaperUpdates,mergeRemoteWorkspace,sameWorkspaceValue} from './workspace';

/** Commit to the server before publishing a replacement in the browser. */
export async function saveAccountWallpaper(owner:string,theme:BackgroundTheme,background:BackgroundConfig|undefined,automatic:'off'|WallpaperStyle,adaptive:boolean|undefined,followSite=false,sync:()=>Promise<void>){
  await sync();
  const cloud=await fetchWorkspace(owner);const before=await readWorkspace(owner);
  const pending=newerWorkspaceItems(before,cloud.items).some(item=>item.kind==='settings'||item.kind==='background'&&item.id===theme);
  if(pending)throw new Error('请先同步账号设置');
  const updates=wallpaperUpdates(cloud.items,owner,theme,background,automatic,adaptive,followSite,cloud.serverTime,cloud.generation);
  const saved=await fetchWorkspace(owner,{items:updates,generation:cloud.generation});
  const actual=saved.items.filter(item=>updates.some(update=>update.kind===item.kind&&update.id===item.id));
  if(actual.length!==updates.length||updates.some(update=>{const item=actual.find(item=>item.kind===update.kind&&item.id===update.id)!;return !!item.deleted!==!!update.deleted||!sameWorkspaceValue(update.kind,item.value!,update.value!);}))throw new Error('云端背景保存尚未确认，请重试');
  await mergeRemoteWorkspace(owner,saved.items,saved.serverTime,new AbortController().signal,true,before,saved.generation);
}
