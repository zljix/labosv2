import {ANALOG_KINDS,type Circuit,type LiveInput,type Part} from './model';
import type {SimulationFrame} from './compile';
const ranges={temperature:[-20,100,.5],illuminance:[0,2000,1],axisX:[0,100,1],axisY:[0,100,1],stimulus:[0,100,1]} as const;
const labels={temperature:'Temperatura',illuminance:'Nominalno osvjetljenje',axisX:'Os X',axisY:'Os Y',stimulus:'Relativna pobuda'} as const;
export function AnalogControls({circuit,onInput,simulation}:{circuit:Circuit;onInput:(p:Part,v:LiveInput)=>void;simulation?:SimulationFrame}){
 return <>{circuit.components.filter(p=>ANALOG_KINDS.includes(p.kind)).map(p=>{
  const keys=p.kind==='lm35'||p.kind==='ntc'?['temperature']:p.kind==='temt6000'?['illuminance']:p.kind==='ky023'?['axisX','axisY']:['stimulus'];
  const frame=simulation?.analogInputs?.[p.id];
  return <div key={p.id} className="environment-controls"><div><b>{p.label} · ULAZ</b><small>{frame?(frame.powered?'Napajanje valjano':'Provjeri napajanje'):p.kind==='ky023'?'Mrtvu zonu i smjer određuje program':p.kind==='sound'?'Digitalni profil; bez mikrofona i dB':'Početna vrijednost spremljena u projekt'}</small></div>
   {keys.map(k=>{const key=k as keyof typeof ranges,[lo,hi,step]=p.kind==='lm35'?[2,150,.5]:ranges[key];return <label key={key}>{labels[key]} <output>{p.properties[key]} {key==='temperature'?'°C':key==='illuminance'?'lx · model':'%'}</output><input aria-label={`${labels[key]} ${p.label}`} type="range" min={lo} max={hi} step={step} value={p.properties[key]} onChange={e=>onInput(p,{[key]:Number(e.target.value)})}/></label>;})}
   {p.kind==='ky023'&&<button aria-label={`Tipkalo ${p.label}`} aria-pressed={p.properties.pressed} onClick={()=>onInput(p,{pressed:!p.properties.pressed})}>{p.properties.pressed?'Otpusti SW':'Pritisni SW'}</button>}
   {frame&&<output>{Object.entries(frame.volts).map(([pin,v])=>`${pin}: ${v===null?'nepobuđen':v.toFixed(3)+' V'}`).join(' · ')}{frame.resistance!==undefined&&` · NTC ${Math.round(frame.resistance)} Ω`}{frame.active!==undefined&&` · DO ${frame.active?'LOW / aktivno':'HIGH'}`}</output>}
  </div>;
 })}</>;
}
export function AnalogBody({p,simulation}:{p:Part;simulation?:SimulationFrame}){
 const joystick=p.kind==='ky023',w=joystick?240:p.kind==='flame'?210:180,h=joystick?190:150;
 const f=simulation?.analogInputs?.[p.id],pins=joystick?['VCC','GND','VRX','VRY','SW']:p.kind==='flame'?['VCC','GND','AO','DO']:p.kind==='sound'?['VCC','GND','DO']:['VCC','GND',p.kind==='lm35'?'OUT':'AO'];
 return <><rect width={w} height={h-12} rx="10" fill="#2f6573" stroke="#204a55" strokeWidth="3"/>
  {joystick?<><circle cx={w/2} cy="66" r="42" fill="#1e303b" stroke="#709a9c"/><path d={`M120 66L${80+(p.properties.axisX??50)*.8} ${26+(p.properties.axisY??50)*.8}`} stroke="#bac9c8" strokeWidth="9"/><circle cx={80+(p.properties.axisX??50)*.8} cy={26+(p.properties.axisY??50)*.8} r="18" fill={p.properties.pressed?'#d59218':'#556575'}/></>:<><circle cx={w/2} cy="43" r="23" fill={p.kind==='flame'&&f?.active?'#e4a44b':p.kind==='sound'?'#b0bdc2':'#253c49'} stroke="#8db3b4" strokeWidth="2"/><text x={w/2} y="49" textAnchor="middle" fontSize="13" fill="#e6f2eb">{p.kind==='sound'?'MIC':p.kind==='ntc'?'R(T)':p.kind==='lm35'?'10mV':'IR/L'}</text></>}
  <text x={w/2} y={joystick?130:89} textAnchor="middle" fontSize="15" fill="#e6f2eb">{p.kind==='ky023'?'KY-023':p.kind.toUpperCase()}</text>
  <text x={w/2} y={h-27} textAnchor="middle" fontSize="11" fill="#d4e7e0">{p.properties.moduleVoltage} V · {p.kind==='sound'?'DO / LOW':p.kind==='ntc'?`${p.properties.r25} Ω / B${p.properties.beta}`:'profil Lab'}</text>
  {pins.map((pin,i)=>{const x=20+i*(w-40)/(pins.length-1);return <g key={pin}><path d={`M${x} ${h-12}v12`} stroke="#a5b4ad" strokeWidth="4"/><text x={x} y={h+17} textAnchor="middle" fontSize="10" fill="var(--text)">{pin}</text></g>;})}
 </>;
}
