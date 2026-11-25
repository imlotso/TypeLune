import type {CSSProperties} from 'react';
import type {BackgroundConfig,BackgroundTheme} from './background.js';
export type SurfaceAppearance={panelOpacity?:number;workspaceOpacity?:number;panelBlur?:number;borderOpacity?:number;headerOpacity?:number};
export const surfaceKeys=['panelOpacity','workspaceOpacity','panelBlur','borderOpacity','headerOpacity'] as const;
const builtinDefaults:Record<BackgroundTheme,Required<SurfaceAppearance>>={
  light:{panelOpacity:84,workspaceOpacity:76,panelBlur:16,borderOpacity:100,headerOpacity:78},
  dark:{panelOpacity:84,workspaceOpacity:78,panelBlur:16,borderOpacity:100,headerOpacity:78},
};
let siteSurfaceDefaults:Record<BackgroundTheme,Required<SurfaceAppearance>>={
  light:{...builtinDefaults.light},
  dark:{...builtinDefaults.dark},
};
export function setSiteSurfaceDefaults(next:{light:Required<SurfaceAppearance>;dark:Required<SurfaceAppearance>}){
  siteSurfaceDefaults={light:{...builtinDefaults.light,...pickSurface(next.light)},dark:{...builtinDefaults.dark,...pickSurface(next.dark)}};
}
export function isSurfaceAppearance(value:unknown):value is SurfaceAppearance{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.entries(value).every(([key,value])=>surfaceKeys.includes(key as typeof surfaceKeys[number])&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=(key==='panelBlur'?24:100));}
export function pickSurface(value:SurfaceAppearance):SurfaceAppearance{return Object.fromEntries(surfaceKeys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));}
export function effectiveSurface(theme:BackgroundTheme,value?:SurfaceAppearance,legacy?:BackgroundConfig):Required<SurfaceAppearance>{return{...siteSurfaceDefaults[theme],...(legacy?pickSurface(legacy):{}),...value};}
export function surfaceStyle(value:Required<SurfaceAppearance>):CSSProperties{return{'--wallpaper-panel-opacity':value.panelOpacity/100,'--wallpaper-workspace-opacity':value.workspaceOpacity/100,'--wallpaper-panel-blur':`${value.panelBlur}px`,'--wallpaper-border-opacity':`${value.borderOpacity}%`,'--wallpaper-header-opacity':value.headerOpacity/100} as CSSProperties;}
