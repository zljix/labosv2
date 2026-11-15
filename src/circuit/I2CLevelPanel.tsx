import type {SimulationFrame} from './compile';
import {localTerminals,type Part} from './model';
const volts=(v:number|null|undefined)=>v==null?'—':v.toLocaleString('hr-HR',{minimumFractionDigits:2,maximumFractionDigits:3})+' V';
export function I2CLevelBody({p,simulation}:{p:Part;simulation?:SimulationFrame}) {
 const state=simulation?.i2cLevelShifters?.[p.id];
 return <><rect x="14" y="8" width="282" height="224" rx="12" fill="#22576b" stroke="#143c50" strokeWidth="3"/>
  <text x="155" y="55" textAnchor="middle" fill="#edf8f5" fontSize="16">I2C · Lab</text>
  <text x="155" y="76" textAnchor="middle" fill="#c5e5e0" fontSize="11">Automatski · bez DIR-a</text>
  {[0,1].map(i=><text key={i} x="155" y={108+i*30} textAnchor="middle" fill="#edf8f5" fontSize="11">{state?`${i?'SCL':'SDA'} ${volts(state.channels[i].lowVolts)} ↔ ${volts(state.channels[i].highVolts)}`:`${i?'SCL':'SDA'} · otvoreni odvod`}</text>)}
  <text x="155" y="175" textAnchor="middle" fill="#c5e5e0" fontSize="11">LV 3,3 V · HV 5 V</text>
  <text x="155" y="198" textAnchor="middle" fill="#edf8f5" fontSize="10">{state?state.powered?'DC + I2C transakcije':'PROVJERI NAPAJANJE':p.properties.pullups?'Pull-up: 4 × 10 kΩ':'Vanjski pull-up potreban'}</text>
  <text x="155" y="218" textAnchor="middle" fill="#c5e5e0" fontSize="10">Zajednička masa · AN10441</text>
  {localTerminals(p).map(t=><g key={t.pin}><path d={`M${t.x} ${t.y}h${t.x===0?14:-14}`} stroke="#b5d4d4" strokeWidth="4"/><text x={t.x===0?20:290} y={t.y-9} textAnchor={t.x===0?'start':'end'} fill="#edf8f5" fontSize="10">{t.label}</text></g>)}</>;
}
export function I2CLevelMeasurements({simulation,parts}:{simulation:SimulationFrame;parts:Map<string,Part>}) {
 const entries=Object.entries(simulation.i2cLevelShifters??{});if(!entries.length)return null;
 return <section aria-label="I2C pretvornik razina"><h3>I2C pretvornik · otvoreni odvod</h3><p>Nema DIR-a. Svaka otpuštena strana ima svoj HIGH; LOW se prenosi u oba smjera. Ovo su DC uzorci, a stvarni ACK i bajtovi nalaze se u I2C zapisu. Tablica ne prikazuje pojedinačne bitove ni RC vrijeme porasta.</p>
 {entries.map(([id,d])=><div key={id}><p><b>{parts.get(id)?.label??id}</b> · LV {volts(d.lv)} · HV {volts(d.hv)}</p><p>{d.reason}</p><table><thead><tr><th>Linija</th><th>Niža domena</th><th>Viša domena</th><th>DC stanje</th></tr></thead><tbody>{d.channels.map(ch=><tr key={ch.name}><td>{ch.name}</td><td>{volts(ch.lowVolts)}</td><td>{volts(ch.highVolts)}</td><td>{!d.powered?'Napajanje nevaljano':ch.pulledLow?'LOW na obje strane':ch.idle?'Otpuštene · dva HIGH napona':'Neodređeno'}</td></tr>)}</tbody></table></div>)}</section>;
}
