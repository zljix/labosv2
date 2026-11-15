import {localTerminals,type Circuit,type Part,type LiveInput} from './model';
import type {SimulationFrame} from './compile';
import {download} from '../project/archive';

export function EncoderBody({p,simulation}:{p:Part;simulation?:SimulationFrame}) {
 const f=simulation?.encoders?.[p.id];
 return <><rect x="4" y="4" width="212" height="168" rx="10" fill="#253e48" stroke="#61757a" strokeWidth="3"/>
  <rect x="55" y="21" width="110" height="104" rx="8" fill="#b6c4c7" stroke="#748b91" strokeWidth="3"/>
  <circle cx="110" cy="70" r="37" fill={f?.sw===0?'#7c9b9d':'#d3dede'} stroke="#546d74" strokeWidth="3"/><path d="M110 39V65" stroke="#48626b" strokeWidth="6" strokeLinecap="round"/>
  <text x="110" y="147" textAnchor="middle" fill="#deebe5" fontSize="15">KY-040</text>
  {[['CLK',f?.clk,42],['DT',f?.dt,178]].map(([name,value,x])=><g key={String(name)}><circle cx={Number(x)} cy="80" r="7" fill={value===0?'#3d5860':value===1?'#cbe7ad':'#708486'}/><text x={Number(x)} y="101" textAnchor="middle" fill="#deebe5" fontSize="10">{name}</text></g>)}
  {localTerminals(p).map(t=><g key={t.pin}><path d={`M${t.x} 170v20`} stroke="#b3c1bb" strokeWidth="4"/><text x={t.x} y="209" textAnchor="middle" fill="var(--text)" fontSize="10">{t.label}</text></g>)}
 </>;
}
export function EncoderControls({circuit,onInput,simulation,running}:{circuit:Circuit;onInput:(p:Part,v:LiveInput)=>void;simulation?:SimulationFrame;running:boolean}) {
 return <>{circuit.components.filter(p=>p.kind==='ky040').map(p=>{
  const f=simulation?.encoders?.[p.id],target=p.properties.encoderPosition??0;
  const busyLimit=running&&f&&Math.abs(target-f.position)>=20;
  return <div className="environment-controls encoder-controls" key={p.id}>
   <div><b>{p.label} · VRTNJA</b><small>{running?'Zadani koraci stvaraju niz CLK/DT bridova':'Početni mehanički položaj; brojač programa kreće od 0'}</small></div>
   <div className="encoder-turns" role="group" aria-label={`Vrtnja ${p.label}`}>
    {[-5,-1,1,5].map(delta=><button key={delta} disabled={!!busyLimit||Math.abs(target+delta)>10000} aria-label={`${delta>0?'CW':'CCW'} ${Math.abs(delta)} ${p.label}`} onClick={()=>onInput(p,{encoderPosition:target+delta})}>{delta<0?'↶':'↷'} {delta>0?'+':''}{delta}</button>)}
   </div>
   <output aria-label={`Mehanički položaj ${p.label}`}>{running&&f?`Mehanički položaj: ${f.position} · cilj ${target}${f.busy?' · vrtnja…':''}`:`Početni mehanički položaj: ${target}`}</output>
   <button aria-label={`Tipkalo ${p.label}`} aria-pressed={p.properties.pressed} onClick={()=>onInput(p,{pressed:!p.properties.pressed})}>{p.properties.pressed?'Otpusti SW':'Pritisni SW'}</button>
   <label><input aria-label={`Poskakivanje ${p.label}`} type="checkbox" checked={p.properties.encoderBounce} onChange={e=>onInput(p,{encoderBounce:e.target.checked})}/>Sintetsko poskakivanje · nove promjene</label>
   {f&&<output aria-label={`Signali ${p.label}`}>Kontakti CLK/DT/SW: {f.clk}/{f.dt}/{f.sw} · GPIO očitanja i brojač vidi u programu</output>}
   <details><summary>Kako nastaje jedan korak?</summary><p>Ovo je inkrementalni enkoder: dva digitalna signala kodiraju pomak. U ovom profilu CW je 11 → 01 → 00 → 10 → 11, CCW obrnuto. Jedan zadržni korak ima četiri brida. Promjena redoslijeda CLK/DT mijenja predznak brojanja; stvarne izvedbe mogu imati drukčiji broj zadržnih položaja.</p><p>CLK/DT imaju 10 kΩ prema VCC. SW pritiskom zatvara kontakt na GND i nema pull-up: program mora postaviti PULL_UP / INPUT_PULLUP. Mehanički položaj u modelu nije vrijednost pročitana programom. Nakon ponovnog pokretanja program ne zna početni fizički položaj.</p><p>Program treba često čitati signale. Dugi sleep, spor ispis i I2C crtanje mogu propustiti bridove. Gray dekoder odbacuje nemoguće skokove; ne može obnoviti propušten pomak. Opcionalni pokus vraća kontakt između novog i starog stanja tijekom 800 µs, bez fizičkog RC/šuma. Promjena postavke vrijedi za novo zadanu vrtnju.</p></details>
  </div>;
 })}</>;
}
export function EncoderMeasurements({simulation,parts}:{simulation:SimulationFrame;parts:Map<string,{label:string}>}) {
 const entries=Object.entries(simulation.encoders??{});if(!entries.length)return null;
 function csv(){const rows=['komponenta,vrijeme_us,CLK,DT,SW,mehanicki_polozaj',...entries.flatMap(([id,f])=>f.trace.map(t=>[id,t.timeUs,t.clk,t.dt,t.sw,t.position].join(',')))];download('KY040_kontakti.csv',new TextEncoder().encode('\uFEFF'+rows.join('\r\n')+'\r\n'),'text/csv;charset=utf-8');}
 return <details className="measurement-log"><summary>KY-040 · kontakti i mehanički položaj</summary><p>Zapis modeliranih kontakata, posljednjih 128 promjena po enkoderu. To nisu potvrđena programska očitanja; usporedi s konzolom. Zaustavi čuva zapis, novo pokretanje ga briše.</p><button onClick={csv}>Preuzmi kontakte CSV</button>
  {entries.map(([id,f])=><div key={id}><b>{parts.get(id)?.label} · položaj {f.position}, cilj {f.targetPosition}</b><table><thead><tr><th>Vrijeme (µs)</th><th>CLK</th><th>DT</th><th>SW</th><th>Položaj</th></tr></thead><tbody>{f.trace.slice(-12).map((t,i)=><tr key={i}><td>{t.timeUs.toFixed(1)}</td><td>{t.clk}</td><td>{t.dt}</td><td>{t.sw}</td><td>{t.position}</td></tr>)}</tbody></table></div>)}
 </details>;
}
