import { useId, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { fingerTarget, type Finger, type Hand } from '../lib/finger-guide';
import './finger-guide.css';
import handAsset from '../assets/typing-hands.webp';
const positions: Record<string,{x:number;y:number;w:number;label:string}> = {};
function row(chars:string, x:number,y:number) { [...chars].forEach((key,i)=>positions[key]={x:x+i*43,y,w:39,label:key.toUpperCase()}); }
row('`1234567890-=',28,15); row('qwertyuiop[]\\',70,53); row("asdfghjkl;'",87,91); row('zxcvbnm,./',110,129);
positions['shift-left']={x:28,y:129,w:76,label:'Shift'};positions['shift-right']={x:502,y:129,w:85,label:'Shift'};
positions.enter={x:563,y:91,w:64,label:'Enter'}; positions.space={x:180,y:167,w:279,label:'Space'};
export function FingerGuide({character}:{character?:string}) {
 const {t}=useI18n(); const uid=useId().replace(/:/g,''); const [hands,setHands]=useState(true); const [reduced,setReduced]=useState(false);const target=fingerTarget(character);
 const labels={left:t('左手','Left hand'),right:t('右手','Right hand')};
 return <div className={'finger-guide'+(reduced?' finger-guide-static':'')}>
  <svg className="finger-guide-scene" viewBox={hands?'0 0 660 380':'0 0 660 212'} aria-hidden="true">
   <rect x="13" y="5" width="628" height="202" rx="13" className="finger-keyboard-base"/>
   {Object.entries(positions).map(([key,p])=><g key={key} data-key={key} className={'finger-key'+(target?.key===key||target?.shift&&key==='shift-'+target.shift?' finger-key-active':'')}><rect x={p.x} y={p.y} width={p.w} height="32" rx="5"/><text x={p.x+p.w/2} y={p.y+15} textAnchor="middle" dominantBaseline="middle">{key==='space'?t('空格','Space'):p.label}</text>{['f','j'].includes(key)&&<path d={`M ${p.x+15} ${p.y+26} h9`} className="finger-home"/>}</g>)}
   {hands&&<g className="guide-hands">
    <image href={handAsset} x="126" y="181" width="408" height="272"/>
    {(['left','right'] as Hand[]).flatMap(hand => (['little','ring','middle','index','thumb'] as Finger[]).map((finger,i)=>{
      const points = hand==='left' ? [[193,237],[227,221],[260,216],[291,229],[307,292]] : [[467,237],[433,221],[400,216],[369,229],[353,292]];
      const [x,y]=points[i]; const active=target?.hand===hand&&target.finger===finger;const shift=target?.shift===hand&&finger==='little';
      if(!active&&!shift)return null;
      const key=positions[shift?'shift-'+hand:target!.key];
      return <g key={hand+finger} data-finger={hand+'-'+finger}>
        <defs><clipPath id={uid+hand+finger}><ellipse cx={x} cy={y+18} rx="15" ry="34" /></clipPath></defs>
        <g clipPath={'url(#'+uid+hand+finger+')'}><image href={handAsset} x="126" y="181" width="408" height="272" className="guide-hand-press"/></g>
        {key&&<path d={'M '+(key.x+key.w/2)+' '+(key.y+32)+' Q '+x+' '+(y-35)+' '+x+' '+y} className="finger-connection"/>}
        <ellipse cx={x} cy={y} rx="11" ry="15" className="finger-touch guide-finger-target"/>
      </g>;
    }))}
   </g>}
  </svg>
  <div className="finger-guide-controls"><label><input type="checkbox" checked={hands} onChange={e=>setHands(e.target.checked)}/>{t('手形','Hands')}</label><label><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>{t('减少动态','Reduce motion')}</label>{target?.shift&&<span>{target.shift==='left'?t('左 Shift','Left Shift'):t('右 Shift','Right Shift')}</span>}</div>
  <span className="finger-guide-caption">{t('建议指法 · 美式 QWERTY','Suggested fingering · US QWERTY')}{target&&` · ${labels[target.hand]}`}</span>
 </div>;
}
