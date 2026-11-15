import {localTerminals,partInfo,type Part,type Circuit} from './model';
import type {SimulationFrame} from './compile';
import {download} from '../project/archive';
type Motor=NonNullable<SimulationFrame['steppers']>['motors'][string];
function Dial({m,label}:{m?:Motor;label:string}){
 const angle=m?.idealAngle??0;
 return <svg viewBox="0 0 130 130" width="110" height="110" role="img" aria-label={`${label}: idealni zbroj ${angle.toFixed(3)} stupnjeva${m?.positionCertain===false?'; položaj osovine nepoznat':''}`}>
  <circle cx="65" cy="65" r="52" fill="#e8efe8" stroke="#5d7775" strokeWidth="3"/>
  {Array.from({length:12},(_,i)=><path key={i} d="M65 18v7" stroke="#5d7775" strokeWidth="2" transform={`rotate(${i*30} 65 65)`}/>)}
  <path d="M65 65V26" stroke={m?.positionCertain===false?'#b07a25':'#087f8c'} strokeWidth="5" strokeLinecap="round" transform={`rotate(${angle%360} 65 65)`}/><circle cx="65" cy="65" r="8" fill="#3b5355"/>
 </svg>;
}
export function StepperBody({p,simulation}:{p:Part;simulation?:SimulationFrame}){
 const d=simulation?.steppers?.drivers[p.id],m=simulation?.steppers?.motors[p.id],{width:w,height:h}=partInfo(p);
 return <><rect x="6" y="6" width={w-12} height={h-18} rx="12" fill={p.kind==='a4988'?'#38675b':'#4b5d65'} stroke="#284647" strokeWidth="3"/>
  {p.kind==='stepperMotor'?<><svg x="50" y="15" width="130" height="130"><Dial m={m} label={p.label}/></svg><text x={w/2} y="172" textAnchor="middle" fill="#eff4e8" fontSize="16">{m?m.idealAngle.toFixed(3)+'°':'BIPOLARNI MOTOR'}</text><text x={w/2} y="194" textAnchor="middle" fill="#e6ecd7" fontSize="11">{p.properties.fullSteps} punih koraka/okret</text><text x={w/2} y="212" textAnchor="middle" fill="#f7cc88" fontSize="10">{m?.positionCertain===false?'OSOVINA: POLOŽAJ NEPOZNAT':'IDEALNI ZBROJ KORAKA'}</text></>:<><rect x="120" y="78" width="120" height="110" rx="7" fill="#263e3f"/><text x={w/2} y="122" textAnchor="middle" fill="#eaf3e5" fontSize="24">A4988</text><text x={w/2} y="155" textAnchor="middle" fill="#c8e5cf" fontSize="16">{d?'1/'+d.resolution:'STEP / DIR'}</text><text x={w/2} y="215" textAnchor="middle" fill="#eaf3e5" fontSize="13">{d?`${d.accepted} valjanih STEP`:'VDD + VMOT odvojeno'}</text><text x={w/2} y="241" textAnchor="middle" fill="#eaf3e5" fontSize="11">{d?.enabled?'IZLAZI ON':'IZLAZI OFF'}</text></>}
  {localTerminals(p).map(t=><g key={t.pin}><text x={t.x===0?12:t.x===w?w-12:t.x} y={t.y+(p.kind==='stepperMotor'?20:4)} textAnchor={t.x===0?'start':t.x===w?'end':'middle'} fill={p.kind==='stepperMotor'?'var(--text)':'#f0f4df'} fontSize="11">{t.pin}</text></g>)}
 </>;
}
export function StepperMonitor({circuit,simulation}:{circuit:Circuit;simulation?:SimulationFrame}){
 const motors=circuit.components.filter(p=>p.kind==='stepperMotor');if(!motors.length)return null;
 return <div className="stepper-monitor" aria-label="Koračni pogon">{motors.map(p=>{const m=simulation?.steppers?.motors[p.id],d=m?.driver?simulation?.steppers?.drivers[m.driver]:null;return <div key={p.id}><Dial m={m} label={p.label}/><div><b>{p.label} · {p.properties.fullSteps} koraka/okret</b><output aria-label={`Idealni kut ${p.label}`}>{m?m.idealAngle.toFixed(3)+'°':'—'}</output><small>Idealni zbroj pogonskih koraka · {d?'1/'+d.resolution:'čeka program'}</small><small>{m?.reason??'Pokreni program'}</small>{d&&<small>Translator {d.translatorTicks/16} punih koraka · {d.reason}</small>}</div></div>;})}</div>;
}
export function StepperMeasurements({simulation,parts}:{simulation:SimulationFrame;parts:Map<string,{label:string}>}){
 const s=simulation.steppers;if(!s||!Object.keys(s.drivers).length)return null;
 function csv(){const rows=[['komponenta','vrijeme_us','operacija','vrijednost'],...Object.entries(s!.drivers).flatMap(([id,d])=>d.trace.map(t=>[id,t.timeUs.toFixed(3),t.operation,t.value]))];const quote=(v:string)=>'"'+v.replaceAll('"','""')+'"';download('A4988_koraci.csv',new TextEncoder().encode('\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n'),'text/csv;charset=utf-8');}
 return <details className="measurement-log"><summary>A4988 · STEP, mikrostep i položaj</summary><p>ENABLE HIGH gasi izlaze, translator nastavlja brojiti. RESET/SLEEP vraćaju električni Home; to ne referencira osovinu. Prikazan kut zbroj je idealnih pogonskih koraka od početka sesije. Nakon propuštene pobude položaj osovine nije potvrđen. Fazne vrijednosti su normalizirani ciljevi DAC-a, bez jedinice A ili V. Stop čuva snimku i posljednjih 128 događaja po driveru; novi Run/Reset počinje novu sesiju.</p><button onClick={csv}>Preuzmi A4988 CSV</button>
  {Object.entries(s.drivers).map(([id,d])=><div key={id}><h3>{parts.get(id)?.label??id} · {id}</h3><p>{d.reason} · mikrostep 1/{d.resolution} · translator {d.translatorTicks/16} punih koraka · rastući bridovi {d.rising}, valjani {d.accepted}, ignorirani {d.ignored}, odbijeni {d.rejected}</p><p>Faza A: {d.phaseA?.toFixed(4)??'Hi-Z'} · faza B: {d.phaseB?.toFixed(4)??'Hi-Z'}</p><table><thead><tr><th>µs</th><th>Operacija</th><th>Vrijednost</th></tr></thead><tbody>{d.trace.slice(-12).reverse().map((t,i)=><tr key={i}><td>{t.timeUs.toFixed(3)}</td><td>{t.operation}</td><td>{t.value}</td></tr>)}</tbody></table></div>)}
  <table><thead><tr><th>Motor</th><th>Idealni zbroj</th><th>Osovina</th><th>Spoj</th></tr></thead><tbody>{Object.entries(s.motors).map(([id,m])=><tr key={id}><td>{parts.get(id)?.label??id}</td><td>{m.idealAngle.toFixed(3)}°</td><td>{m.positionCertain?'Idealni model':'Nepoznat položaj'}</td><td>{m.connected?`${m.driver}; polaritet ${m.orientation}`:'Neispravan / nedostaje'}</td></tr>)}</tbody></table>
 </details>;
}
