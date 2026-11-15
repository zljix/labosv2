import {DHT_KINDS,type Circuit,type Part,type LiveInput} from './model';
import type {SimulationFrame} from './compile';
export function DHTControls({circuit,onInput,simulation}:{circuit:Circuit;onInput:(p:Part,v:LiveInput)=>void;simulation?:SimulationFrame}){
 return <>{circuit.components.filter(p=>DHT_KINDS.includes(p.kind)).map(p=>{const f=simulation?.timedSensors?.[p.id],legacy=p.kind==='dht11';return <div className="environment-controls" key={p.id}>
  <div><b>{p.label} · DHT OKOLIŠ</b><small>{legacy?'Stariji profil: 1 °C / 1 %RH; najmanje 1 s':'Profil DHT22: 0,1 °C / 0,1 %RH; najmanje 2 s'}</small></div>
  <label>Temperatura <output>{p.properties.temperature?.toFixed(legacy?0:1)} °C</output><input aria-label={`Temperatura ${p.label}`} type="range" min={legacy?0:-40} max={legacy?50:80} step={legacy?1:.1} value={p.properties.temperature} onChange={e=>onInput(p,{temperature:Number(e.target.value)})}/></label>
  <label>Relativna vlaga <output>{p.properties.humidity?.toFixed(legacy?0:1)} %</output><input aria-label={`Vlaga ${p.label}`} type="range" min={legacy?20:0} max={legacy?90:100} step={legacy?1:.1} value={p.properties.humidity} onChange={e=>onInput(p,{humidity:Number(e.target.value)})}/></label>
  <label>Pokus pogreške<select aria-label={`Pokus pogreške ${p.label}`} value={p.properties.dhtFault} onChange={e=>onInput(p,{dhtFault:e.target.value as LiveInput['dhtFault']})}><option value="none">Uredan prijenos</option><option value="checksum">Pogrešan kontrolni zbroj</option><option value="timeout">Bez odgovora · timeout</option></select></label>
  {f&&<output aria-label={`Stanje protokola ${p.label}`}>{f.powered?f.reason:'Provjeri napajanje'} · Prijenosi: {f.sample}</output>}
  {!!f?.trace.length&&<details><summary>Posljednji niz impulsa · {f.bytes.length*8} bitova</summary><p>DATA je otvoreni odvod: senzor povlači LOW, a vanjski otpornik daje HIGH. Odgovor: 80 µs LOW / 80 µs HIGH. Bit: 50 µs LOW, zatim 27 µs za 0 ili 70 µs za 1.</p><code>{f.bytes.map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ')}</code><p>Peti bajt je zbroj prva četiri modulo 256. Ovo su poslani bajtovi; prihvaćanje i izračun rezultata vidi u konzoli programa.</p></details>}
 </div>;})}</>;
}
