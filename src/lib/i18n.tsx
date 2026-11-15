import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
export type UiLocale='zh'|'en';
export const localeStorageKey='typelune.ui-locale.v1';
export function resolveLocale(saved: string|null,languages:readonly string[]):UiLocale { return saved==='zh'||saved==='en'?saved:languages[0]?.toLowerCase().startsWith('zh')?'zh':'en'; }
export function translate(zh:string,en:string,locale:UiLocale){return locale==='zh'?zh:en;}
const fallback={locale:'zh' as UiLocale,setLocale:(_locale:UiLocale)=>{},t:(zh:string,_en:string)=>zh};
const I18nContext=createContext(fallback);
export function I18nProvider({children}:{children:ReactNode}) {
 const [locale,setLocaleState]=useState<UiLocale>(()=>{let saved=null;try{saved=localStorage.getItem(localeStorageKey)}catch{}return resolveLocale(saved,typeof navigator==='undefined'?[]:navigator.languages?.length?navigator.languages:[navigator.language]);});
 const setLocale=(next:UiLocale)=>{setLocaleState(next);try{localStorage.setItem(localeStorageKey,next)}catch{}};
 useEffect(()=>{document.documentElement.lang=locale==='zh'?'zh-CN':'en';},[locale]);
 useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===localeStorageKey)setLocaleState(resolveLocale(event.newValue,navigator.languages));};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 const value=useMemo(()=>({locale,setLocale,t:(zh:string,en:string)=>translate(zh,en,locale)}),[locale]);
 return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n(){return useContext(I18nContext);}
