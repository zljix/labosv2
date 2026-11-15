import {useEffect,useRef,useState} from 'react';
import {localTerminals,partInfo,type Part,type Circuit} from './model';
import type {SimulationFrame} from './compile';
import {download} from '../project/archive';
export function ActuatorBody({p,simulation}:{p:Part;simulation?:SimulationFrame}){
 const a=simulation?.actuators,{width:w,height:h}=partInfo(p);
 const motor=a?.motors[p.id],relay=a?.relays[p.id],bridge=a?.bridges[p.id],buzzer=a?.buzzers[p.id];
 const title=p.kind==='powerSupply'?`${p.properties.supplyVoltage} V DC`:p.kind==='relay'?relay?.contact??'COM–NC':p.kind==='motor130'?motor?`${motor.direction>0?'↻':motor.direction<0?'↺':'○'} ${motor.relativeSpeed.toFixed(1)} %`:'MOTOR 130':p.kind==='l298n'?'L298N':buzzer?.active?`${buzzer.frequency?.toFixed(0)} Hz`:'PIEZO / TON';
 return <><rect x="8" y="16" width={w-16} height={h-35} rx="12" fill={p.kind==='l298n'?'#864b47':p.kind==='relay'?'#3c6485':p.kind==='powerSupply'?'#354954':'#54615e'} stroke="#263f49" strokeWidth="3"/>
  {p.kind==='l298n'&&Array.from({length:9},(_,i)=><path key={i} d={`M${70+i*30} 45v80`} stroke="#273438" strokeWidth="10"/>)}
  {p.kind==='motor130'&&<circle cx={w/2} cy="60" r="26" fill="#bbc6bf" stroke="#2b4546" strokeWidth="5"/>}
  {(p.kind==='activeBuzzer'||p.kind==='passiveBuzzer')&&<circle cx={w/2} cy="55" r="26" fill={buzzer?.active?'#e2c475':'#243d41'}/>}
  <text x={w/2} y={p.kind==='l298n'?155:110} textAnchor="middle" fill="#eff5ec" fontSize="18">{title}</text>
  {p.kind==='l298n'&&bridge?.channels.map((ch,i)=><text key={i} x={w/2} y={182+i*20} textAnchor="middle" fill="#f1e4dc" fontSize="12">{i?'B':'A'}: {ch.mode}</text>)}
  {p.kind==='relay'&&<text x={w/2} y="145" textAnchor="middle" fill="#f1e4dc" fontSize="12">{p.properties.activeLevel==='low'?'aktivno LOW':'aktivno HIGH'} · LV {p.properties.logicVoltage} V</text>}
  {localTerminals(p).map(t=><text key={t.pin} x={t.x===0?8:t.x===w?w-8:t.x} y={t.y===0?15:t.y===h?h+18:t.y-12} textAnchor={t.x===0?'start':t.x===w?'end':'middle'} fill="var(--text)" fontSize="11">{t.pin}</text>)}
 </>;
}
export function ActuatorMonitor({circuit,simulation,running=false}:{circuit:Circuit;simulation?:SimulationFrame;running?:boolean}){
 const [audible,setAudible]=useState(false),[error,setError]=useState('');
 const context=useRef<AudioContext|null>(null),oscillators=useRef(new Map<string,{osc:OscillatorNode;gain:GainNode}>());
 async function toggle(){
  if(audible){setAudible(false);return;}
  try{const ctx=context.current??new AudioContext();context.current=ctx;await ctx.resume();setAudible(true);setError('');}catch{setError('Reprodukcija zvuka nije dostupna u ovom pregledniku.');}
 }
 const a=simulation?.actuators;
 useEffect(()=>{
  const ctx=context.current;if(!ctx)return;
  const ids=new Set(Object.entries(a?.buzzers??{}).filter(([,s])=>audible&&running&&s.active&&s.frequency).map(([id])=>id));
  for(const [id,n]of oscillators.current)if(!ids.has(id)){n.osc.stop();n.osc.disconnect();n.gain.disconnect();oscillators.current.delete(id);}
  for(const id of ids){let n=oscillators.current.get(id);if(!n){const osc=ctx.createOscillator(),gain=ctx.createGain();gain.gain.value=.025;osc.type='square';osc.connect(gain);gain.connect(ctx.destination);osc.start();n={osc,gain};oscillators.current.set(id,n);}n.osc.frequency.setValueAtTime(a!.buzzers[id].frequency!,ctx.currentTime);}
 },[a,audible,running]);
 useEffect(()=>()=>{for(const n of oscillators.current.values()){n.osc.stop();n.osc.disconnect();n.gain.disconnect();}oscillators.current.clear();void context.current?.close();},[]);
 const parts=new Map(circuit.components.map(p=>[p.id,p]));
 const hasBuzzers=circuit.components.some(p=>['activeBuzzer','passiveBuzzer'].includes(p.kind));
 if(!circuit.components.some(p=>['motor130','relay','l298n','activeBuzzer','passiveBuzzer'].includes(p.kind)))return null;
 return <div className="actuator-monitor" aria-label="Pogoni i zvuk"><div><b>POGONI I ZVUK</b><small>Relativna brzina je naponski pokazatelj; nije RPM.</small></div>{hasBuzzers&&<><button onClick={()=>void toggle()} aria-pressed={audible}>{audible?'Isključi slušanje':'Uključi slušanje'}</button>{error&&<small role="status">{error}</small>}</>}
 {Object.entries(a?.motors??{}).map(([id,s])=><output key={id} aria-label={`Motor ${parts.get(id)?.label}`}>{parts.get(id)?.label} · <b>{s.mode} · {s.relativeSpeed.toFixed(1)} %</b><small>{s.voltage===null?'Hi-Z / otvoreni spoj':s.voltage.toFixed(3)+' V srednje'}</small></output>)}
 {Object.entries(a?.relays??{}).map(([id,s])=><output key={id}>{parts.get(id)?.label} · <b>{s.contact}</b><small>{s.reason}</small></output>)}
 {Object.entries(a?.buzzers??{}).map(([id,s])=><output key={id} aria-label={`Ton ${parts.get(id)?.label}`}>{parts.get(id)?.label} · <b>{s.active?s.frequency!.toFixed(1)+' Hz':'OFF'}</b><small>{s.reason}</small></output>)}
 </div>;
}
export function ActuatorMeasurements({simulation,parts}:{simulation:SimulationFrame;parts:Map<string,{label:string}>}){
 const a=simulation.actuators;if(!a||![a.motors,a.relays,a.buzzers,a.bridges].some(s=>Object.keys(s).length))return null;
 function csv(){const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';const rows=['vrijeme_us,komponenta,operacija,vrijednost',...a!.trace.map(t=>[t.timeUs.toFixed(2),quote(`${parts.get(t.component)?.label??t.component} [${t.component}]`),quote(t.operation),quote(t.value)].join(','))];download('Aktuatori_mjerenja.csv',new TextEncoder().encode('\uFEFF'+rows.join('\r\n')+'\r\n'),'text/csv;charset=utf-8');}
 return <details className="measurement-log" open><summary>Aktuatori · motori, releji i tonovi</summary><p>Motor koristi srednji diferencijalni napon. L298N pokazuje trenutačno stanje svakog kanala; EN LOW je slobodno zaustavljanje, jednaki IN uz EN HIGH koče. Nema struje, mehanike ni akustičke snage. Zapis zadržava 128 događaja i uzoraka prikaza; nije svaki GPIO brid. Stop čuva zapis, novo pokretanje ga resetira.</p>
 <button disabled={!a.trace.length} onClick={csv}>Preuzmi aktuatori CSV</button>
 <table><thead><tr><th>Komponenta</th><th>Stanje</th><th>Vrijednost</th></tr></thead><tbody>
 {Object.entries(a.motors).map(([id,s])=><tr key={id}><td>{parts.get(id)?.label}</td><td>{s.mode}</td><td>{s.relativeSpeed.toFixed(2)} % · {s.voltage?.toFixed(3)??'—'} V</td></tr>)}
 {Object.entries(a.bridges).flatMap(([id,s])=>s.channels.map((ch,i)=><tr key={id+i}><td>{parts.get(id)?.label} {i?'B':'A'}</td><td>{s.powered?ch.mode:'Bez napajanja'}</td><td>{ch.voltage?.toFixed(3)??'Hi-Z'} V trenutačno</td></tr>))}
 {Object.entries(a.relays).map(([id,s])=><tr key={id}><td>{parts.get(id)?.label}</td><td>{s.contact}</td><td>{s.reason}</td></tr>)}
 {Object.entries(a.buzzers).map(([id,s])=><tr key={id}><td>{parts.get(id)?.label}</td><td>{s.active?'ON':'OFF'}</td><td>{s.frequency?.toFixed(2)??'—'} Hz</td></tr>)}
 </tbody></table></details>;
}
