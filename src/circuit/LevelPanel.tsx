import type {SimulationFrame} from './compile';
import type {Part} from './model';
export function LevelMeasurements({simulation,parts}:{simulation:SimulationFrame;parts:Map<string,Part>}) {
 const entries=Object.entries(simulation.levelShifters??{});
 if(!entries.length)return null;
 const volts=(v:number|null)=>v===null?'Neodređeno':v.toLocaleString('hr-HR',{minimumFractionDigits:2,maximumFractionDigits:3})+' V';
 return <section aria-label="Pretvornik logičkih razina"><h3>Pretvornik razina · SN74LVC2T45</h3><p>Dva aktivna push-pull kanala dijele DIR. A i B imaju odvojene naponske domene. Tablica prikazuje trenutačni uzorak GPIO-a; ne mjeri fizičku brzinu ni strujni kapacitet.</p>{entries.map(([id,d])=><div key={id}><p><b>{parts.get(id)?.label??id}</b> · {d.direction??'Smjer neodređen'} · VCCA {volts(d.vcca)} · VCCB {volts(d.vccb)} · DIR {volts(d.dir)}</p><p>{d.reason}</p><table><thead><tr><th>Kanal</th><th>Ulaz</th><th>Opaženi ulaz</th><th>Izlaz</th><th>Zadani izlaz modela</th><th>Logika</th></tr></thead><tbody>{d.channels.map((c,i)=><tr key={i}><td>{i+1}</td><td>{c.input}</td><td>{volts(c.inputVolts)}</td><td>{c.output}</td><td>{volts(c.outputVolts)}</td><td>{c.level??'?'}</td></tr>)}</tbody></table></div>)}</section>;
}
