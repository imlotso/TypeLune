import { useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { useI18n } from '../lib/i18n';
export function CourseLayout({ guide, children, active }: { guide: ReactNode; children: ReactNode; active: boolean }) {
 const {t}=useI18n();const root=useRef<HTMLDivElement>(null);const [ratio,setRatio]=useState(()=>{try{const saved=Number(localStorage.getItem('typelune.course-width.v1'));return saved>=30&&saved<=52?saved:38;}catch{return 38;}});
 const [dragging,setDragging]=useState(false);
 function resize(value:number){const next=Math.max(30,Math.min(52,value));setRatio(next);try{localStorage.setItem('typelune.course-width.v1',String(next));}catch{/* Current layout remains usable. */}}
 return <div ref={root} className={active?'course-layout':'practice-layout'} style={{'--guide-width':ratio+'%'} as CSSProperties}>
 {active&&<aside className="course-guidance">{guide}</aside>}
 {active&&<div className={'course-divider'+(dragging?' is-dragging':'')} role="separator" tabIndex={0} aria-label={t('调整键位提示宽度','Resize key guide')} aria-orientation="vertical" aria-valuemin={30} aria-valuemax={52} aria-valuenow={Math.round(ratio)}
 onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);}}
 onPointerMove={event=>{if(!event.currentTarget.hasPointerCapture(event.pointerId))return;const box=root.current!.getBoundingClientRect();resize((event.clientX-box.left)/box.width*100);}}
 onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);setDragging(false);}}
 onLostPointerCapture={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)}
 onDoubleClick={()=>resize(38)} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();resize(event.key==='Home'?30:event.key==='End'?52:ratio+(event.key==='ArrowLeft'?-2:2));}}}/>}<div className={active?'course-content':'practice-content'}>{children}</div>
 </div>;
}
