import {type Circuit,type Part,type LiveInput} from './model';
import type {SimulationFrame} from './compile';
export function OneWireControls({circuit,onInput,simulation}:{circuit:Circuit;onInput:(p:Part,v:LiveInput)=>void;simulation?:SimulationFrame}){
 return <>{circuit.components.filter(p=>p.kind==='ds18b20').map(p=>{const f=simulation?.oneWireDevices?.[p.id];return <div className="environment-controls" key={p.id}>
  <div><b>{p.label} · 1-WIRE OKOLIŠ</b><small>ROM: {p.properties.rom} · VDD {p.properties.moduleVoltage} V</small></div>
  <label>Temperatura okoliša <output>{p.properties.temperature?.toFixed(4)} °C</output><input aria-label={`Temperatura ${p.label}`} type="range" min={-55} max={125} step={.0625} value={p.properties.temperature} onChange={e=>onInput(p,{temperature:Number(e.target.value)})}/></label>
  <label>Pokus pogreške<select aria-label={`Pokus pogreške ${p.label}`} value={p.properties.oneWireFault} onChange={e=>onInput(p,{oneWireFault:e.target.value as LiveInput['oneWireFault']})}><option value="none">Uredan prijenos</option><option value="crc">Pogrešan CRC scratchpada</option><option value="disconnected">Odspojen DQ · bez odgovora</option></select></label>
  {f&&<output aria-label={`Stanje protokola ${p.label}`}>{!f.powered?'Provjeri napajanje':f.fault==='disconnected'?'DQ odspojen':f.reason} · {f.resolution} bita · Pretvorbe: {f.sample}</output>}
  <details><summary>ROM, scratchpad i vrijeme pretvorbe</summary><p>ROM ima 8 bajtova: 0x28, serijski broj i CRC-8. Tri izvoda: GND, DQ, VDD. Više senzora dijeli DQ i jedan vanjski pull-up od 4,7 kΩ. DHT koristi drugi protokol.</p><p>9/10/11/12 bita: do 93,75/187,5/375/750 ms. Početni registar +85 °C ili prethodna temperatura mogu imati valjan CRC. Svjež rezultat zahtijeva završenu pretvorbu; CRC provjerava prijenos. Korak 0,0625 °C pri 12 bita nije točnost fizičkog senzora.</p>
   {f&&<><code>{f.scratchpad.map(b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ')}</code><p>Trenutačni registar modela, uz odabrani pokus CRC-a. Prihvaćeno očitanje vidi u konzoli programa.</p><ol>{f.trace.slice(-8).map((v,i)=><li key={i}>{v.operation}{v.value===undefined?'':' · 0x'+v.value.toString(16).toUpperCase()}</li>)}</ol></>}
  </details>
 </div>;})}</>;
}
