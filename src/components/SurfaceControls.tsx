import type {SurfaceAppearance} from '../lib/surface-appearance';
import {useI18n} from '../lib/i18n';
export function SurfaceControls({value,onChange,onReset}:{value:Required<SurfaceAppearance>;onChange:(value:SurfaceAppearance)=>void;onReset:()=>void}){
 const {t}=useI18n();
 return <div className="surface-controls"><div className="background-ranges background-surface-controls">{([
 ['panelOpacity',t('容器透明度','Panel transparency'),100],['workspaceOpacity',t('工作区透明度','Workspace transparency'),100],['headerOpacity',t('导航栏透明度','Navigation transparency'),100],['panelBlur',t('容器毛玻璃','Panel blur'),24],['borderOpacity',t('边框强度','Border strength'),100],
 ] as const).map(([key,label,max])=>{const opacity=key.endsWith('Opacity')&&key!=='borderOpacity';const shown=opacity?100-value[key]:value[key];return <label className="settings-range" key={key}><span>{label}</span><input type="range" aria-label={label} min={0} max={max} step={1} value={shown} onChange={event=>onChange({[key]:opacity?100-event.target.valueAsNumber:event.target.valueAsNumber})}/><span aria-hidden="true">{shown}{key==='panelBlur'?'px':'%'}</span></label>;})}</div><button type="button" className="text-button surface-reset" onClick={onReset}>{t('重置透明度和效果','Reset transparency and effects')}</button></div>;
}
