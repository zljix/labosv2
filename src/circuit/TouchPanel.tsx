import {useRef,type PointerEvent} from 'react';
import {TFTDisplay} from './SPIPanel';
import {localTerminals,type Circuit,type Part,type LiveInput} from './model';
import type {SimulationFrame} from './compile';
export function TouchBody({p,simulation}:{p:Part;simulation?:SimulationFrame}){
 const f=simulation?.touches?.[p.id];
 return <><rect width="340" height="177" rx="10" fill="#296d64" stroke="#174c48" strokeWidth="3"/><rect x="125" y="32" width="90" height="65" fill="#20303e" stroke="#92b6a4"/>
 <text x="170" y="69" textAnchor="middle" fontSize="15" fill="#e1f0e6">XPT2046</text><text x="170" y="122" textAnchor="middle" fontSize="12" fill="#d5ece1">{p.properties.moduleVoltage} V carrier · 12-bit SPI</text>
 <text x="170" y="150" textAnchor="middle" fontSize="12" fill="#d5ece1">{f?`IRQ ${f.irq??'—'} · ${f.conversions} pretvorbi`:'Zaseban CS · sirove koordinate'}</text>
 {localTerminals(p).map(t=><g key={t.pin}><path d={`M${t.x} 177v13`} stroke="#aab9b6" strokeWidth="4"/><text x={t.x} y="210" textAnchor="middle" fill="var(--text)" fontSize="10">{t.pin}</text></g>)}</>;
}
function TouchControl({p,circuit,onInput,simulation,running}:{p:Part;circuit:Circuit;onInput:(p:Part,v:LiveInput)=>void;simulation?:SimulationFrame;running:boolean}){
 const active=useRef<number|null>(null),f=simulation?.touches?.[p.id];
 const display=circuit.components.find(t=>t.kind==='ili9341'&&t.id===p.properties.touchDisplay);
 const update=(e:PointerEvent<HTMLDivElement>,down:boolean)=>{
  const r=e.currentTarget.getBoundingClientRect();
  onInput(p,{touchDown:down,touchX:Math.max(0,Math.min(239,Math.round((e.clientX-r.left)*239/r.width))),touchY:Math.max(0,Math.min(319,Math.round((e.clientY-r.top)*319/r.height)))});
 };
 const release=()=>{if(active.current!==null){active.current=null;onInput(p,{touchDown:false});}};
 return <section className="touch-controls" aria-label={`Dodir ${p.label}`}>
 <div className="touch-heading"><b>{p.label} · DODIR</b><span>{display?`Panel uz ${display.label}`:'Samostalan ulaz 240 × 320'}</span><small>{running?'Pritisni, povuci i otpusti. Tipkovnica: klizači i gumb.':'Pokreni program za dodir mišem ili prstom. Klizači zadaju početni položaj.'}</small></div>
 <div className="touch-content">
 <div className={`touch-surface ${running?'':'touch-idle'}`} aria-label={`Dodirna površina ${p.label}`} onPointerDown={e=>{if(!running||active.current!==null||e.button!==0)return;e.preventDefault();active.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);update(e,true);}} onPointerMove={e=>{if(active.current===e.pointerId)update(e,true);}} onPointerUp={e=>{if(active.current!==e.pointerId)return;release();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={release} onLostPointerCapture={release}>
  <TFTDisplay width={240} height={320} pixels={display?simulation?.tfts?.[display.id]?.pixels:undefined} label={display?`${display.label}: pikseli iz SPI-ja pod dodirnim slojem`:'Samostalan dodirni panel'}/>
  <span className={`touch-reticle ${p.properties.touchDown?'touch-pressed':''}`} style={{left:`${(p.properties.touchX??120)*100/239}%`,top:`${(p.properties.touchY??160)*100/319}%`}} aria-hidden="true"/>
 </div>
 <div className="touch-settings">
 {(['touchX','touchY','touchPressure']as const).map((key,i)=><label key={key}>{['Fizički X','Fizički Y','Relativni pritisak'][i]} <output>{p.properties[key]}{i===2?' %':''}</output><input type="range" min="0" max={[239,319,100][i]} step="1" aria-label={`${['Dodir X','Dodir Y','Pritisak'][i]} ${p.label}`} value={p.properties[key]} onChange={e=>onInput(p,{[key]:Number(e.target.value)})}/></label>)}
 <button disabled={!running} aria-label={`Zadrži dodir ${p.label}`} aria-pressed={p.properties.touchDown} onClick={()=>onInput(p,{touchDown:!p.properties.touchDown})}>{p.properties.touchDown?'Otpusti dodir':'Pritisni dodir'}</button>
 <output>{!f?'Čeka program':!f.powered?'Provjeri napajanje i masu':`PENIRQ ${f.irq} · PD ${f.pd} · ${f.conversions} pretvorbi`}</output>
 {f&&<small>Modelirani ADC ulaz: X {f.raw.x}, Y {f.raw.y}, Z1 {f.raw.z1}, Z2 {f.raw.z2}.<br/>Posljednja SPI pretvorba: {f.last.channel??'—'} = {f.last.value??'—'}. To nije programska kalibrirana koordinata.</small>}
 <details><summary>Od sirovog dodira do tipkala</summary><p>Ovaj sloj šalje samo pobudu senzoru. Program čita X/Y/Z1/Z2 preko MISO-a, određuje dodir iz Z1+4095−Z2, kalibrira koordinate i provjerava je li točka unutar tipkala. Pogrešna kalibracija ili rotacija zato daje pogrešan odziv.</p><p>Fizička površina ostaje 240×320. Lab krajevi su X 200–3900 i Y 250–3850; ne vrijede za svaki fizički modul. Pritisak je relativna sintetska veličina. CS mora biti odvojen od TFT-a, IRQ je opcionalni ulaz. Sva četiri primjera imaju vidljivi Python/C++ driver.</p></details>
 </div></div></section>;
}
export function TouchControls(props:{circuit:Circuit;onInput:(p:Part,v:LiveInput)=>void;simulation?:SimulationFrame;running:boolean}){
 return <>{props.circuit.components.filter(p=>p.kind==='xpt2046').map(p=><TouchControl key={p.id} {...props} p={p}/>)}</>;
}
