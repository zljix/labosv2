import {localTerminals,type Part} from './model';
import type {SimulationFrame} from './compile';
import {download} from '../project/archive';
type Display=NonNullable<SimulationFrame['tmDisplays']>[string];
const segments=[['a','M8 4h25l-4 5H12Z'],['b','M34 7l-2 25-5-4 2-17Z'],['c','M31 36l-2 25-5-5 2-17Z'],['d','M3 62h24l-4-5H8Z'],['e','M1 36l5 4-2 17-5 4Z'],['f','M4 7l5 5-2 16-5 4Z'],['g','M7 30h20l4 4-5 4H6l-4-4Z']];
export function SevenSegment({display:d,label='TM1637'}:{display?:Display;label?:string}){
 const active=d?.powered&&d.on,bytes=d?.bytes??[0,0,0,0];
 const digits=[0x3f,6,0x5b,0x4f,0x66,0x6d,0x7d,7,0x7f,0x6f];
 const text=bytes.slice(0,4).map((b,i)=>{const v=b&127,n=digits.indexOf(v);return(n>=0?String(n):v===0?' ':v===64?'-':'?')+(i===1&&d?.colon?':':'');}).join('');
 return <svg className="tm-display" viewBox="0 0 220 78" width="220" height="78" role="img" aria-label={`${label}: ${active?text:'isključen'}`}>
  <title>{label} · {active?text:'isključen'} · svjetlina {d?.brightness??0}/7</title><rect width="220" height="78" rx="5" fill="#160c13"/>
  {bytes.slice(0,4).map((b,i)=><g key={i} transform={`translate(${16+i*47+(i>1?10:0)} 5)`}>{segments.map(([name,path],bit)=><path key={name} d={path} fill={active&&(b&(1<<bit))?'#ff514d':'#311720'} opacity={active&&(b&(1<<bit))?.2+.8*(d?.duty??0)/(14/16):.65}/>)}</g>)}
  {[27,49].map(y=><circle key={y} cx="111" cy={y} r="3" fill={active&&d?.colon?'#ff514d':'#311720'} opacity={active&&d?.colon ? .2+.8*d.duty/(14/16) : .65}/>)}
 </svg>;
}
export function TMBody({p,simulation}:{p:Part;simulation?:SimulationFrame}){
 const d=simulation?.tmDisplays?.[p.id];
 return <><rect x="4" y="2" width="322" height="165" rx="9" fill="#235b77" stroke="#113e57" strokeWidth="3"/>
  <svg x="19" y="13" width="292" height="103" viewBox="0 0 220 78"><SevenSegment display={d} label={p.label}/></svg>
  <text x="165" y="136" fill="#eef3e8" fontSize="15" textAnchor="middle">TM1637 · 4 znamenke</text><text x="165" y="153" fill="#dfd9ba" fontSize="10" textAnchor="middle">VCC 5 V · LV {p.properties.logicVoltage} V · prilagodnik</text>
  {localTerminals(p).map(t=><g key={t.pin}><path d={`M${t.x} 167v13`} stroke="#becac5" strokeWidth="4"/><text x={t.x} y="198" textAnchor="middle" fill="var(--text)" fontSize="11">{t.pin}</text></g>)}</>;
}
export function TMMonitor({part,display:d}:{part:Part;display?:Display}){
 return <div className="oled-monitor"><div><b>{part.label} · 4 znamenke</b><small>{!d?'Čeka program':!d.powered?'Bez napajanja':d.on?`Svjetlina ${d.brightness}/7 · omjer ${d.duty*16}/16`:'Prikaz isključen; memorija sačuvana'}</small></div><SevenSegment display={d} label={part.label}/></div>;
}
export function TMMeasurements({simulation,parts}:{simulation:SimulationFrame;parts:Map<string,{label:string}>}){
 const entries=Object.entries(simulation.tmDisplays??{});if(!entries.length)return null;
 function csv(){const rows=['komponenta,vrijeme_us,operacija,vrijednost',...entries.flatMap(([id,d])=>d.trace.map(t=>[id,t.timeUs.toFixed(3),t.operation,t.value??''].join(',')))];download('TM1637_prijenosi.csv',new TextEncoder().encode('\uFEFF'+rows.join('\r\n')+'\r\n'),'text/csv;charset=utf-8');}
 return <details className="measurement-log"><summary>TM1637 · CLK/DIO, ACK i segmenti</summary><p>LSB prvi; deveti takt potvrđuje ACK. 0x40 automatski povećava adresu, 0x44 je fiksna, 0xC0–0xC5 odabire memoriju, 0x80–0x8F upravlja prikazom. Vidljive su četiri znamenke; dvotočka je bit 7 druge. Svjetlina 0 nije OFF. Posljednjih 128 događaja po modulu; novi Run briše zapis, Stop ga čuva.</p><button onClick={csv} disabled={!entries.some(([,d])=>d.trace.length)}>Preuzmi TM1637 CSV</button>
 {entries.map(([id,d])=><div key={id}><h3>{parts.get(id)?.label??id}</h3><p>{d.reason} · bajtovi: {d.bytes.map(v=>v.toString(16).padStart(2,'0')).join(' ')} · primljeno {d.received} · pogreške {d.errors}</p><table><thead><tr><th>Vrijeme (µs)</th><th>Događaj</th><th>Vrijednost (hex)</th></tr></thead><tbody>{d.trace.slice(-24).reverse().map((t,i)=><tr key={i}><td>{t.timeUs.toFixed(1)}</td><td>{t.operation}</td><td>{t.value===undefined?'—':'0x'+t.value.toString(16).padStart(2,'0')}</td></tr>)}</tbody></table></div>)}</details>;
}
