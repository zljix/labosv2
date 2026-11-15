import {OpticalMeasurements} from './OpticalPanel';
import {SDMeasurements} from './SDPanel';
import {RTCMeasurements} from './RTCPanel';
import {TFTDisplay,SPIMeasurements} from './SPIPanel';
import {StepperMonitor,StepperMeasurements} from './StepperPanel';
import {ActuatorMeasurements} from './ActuatorPanel';
import {TMMonitor,TMMeasurements} from './TM1637Panel';
import {IRMeasurements} from './IRPanel';
import {EncoderMeasurements} from './EncoderPanel';
import {useMemo} from 'react';
import type {Circuit} from './model';
import type {SimulationFrame} from './compile';
import {download} from '../project/archive';

export function PixelDisplay({bytes=[],contrast=255,height=64,label='OLED 128 × 64'}:{bytes?:number[];contrast?:number;height?:number;label?:string}){
 const path=useMemo(()=>{
  let out='';
  for(let y=0;y<height;y++)for(let x=0;x<128;){
   if(!((bytes[x+(y>>3)*128]??0)&(1<<(y&7)))){x++;continue;}
   const start=x;while(x<128&&((bytes[x+(y>>3)*128]??0)&(1<<(y&7))))x++;
   out+=`M${start} ${y}h${x-start}v1h${start-x}z`;
  }return out;
 },[bytes,height]);
 return <svg className="pixel-display" width="128" height={height} viewBox={`0 0 128 ${height}`} role="img" aria-label={label} shapeRendering="crispEdges"><rect width="128" height={height} fill="#081e25"/><path d={path} fill="#b4f6ec" opacity={.15+.85*contrast/255}/></svg>;
}
export function CharacterDisplay({display:d,label='LCD1602'}:{display?:SimulationFrame['displays'][string];label?:string}){
 const cells=d?.cells??Array(32).fill(32),cx=d?.cursorColumn??40,cy=d?.cursorRow??0;
 return <svg className="character-display" width="290" height="76" viewBox="0 0 290 76" role="img" aria-label={`${label}: ${(d?.lines??['','']).join(' / ')}`}>
  <title>{(d?.lines??['','']).join(' / ')}</title><rect width="290" height="76" rx="3" fill={d?.backlight?'#b7d96c':'#61704a'}/>
  {cells.map((code,i)=>{const x=9+i%16*17,y=8+Math.floor(i/16)*34;
   return <g key={i} fill="#25351b">{code<16?Array.from({length:8},(_,row)=>Array.from({length:5},(_,col)=>((d?.cgram?.[(code%8)*8+row]??0)&(1<<(4-col)))?<rect key={row*5+col} x={x+col*2.6} y={y+row*2.6} width="2.3" height="2.3"/>:null)):code===255?<rect x={x} y={y} width="13" height="21"/>:<text x={x} y={y+19} fontFamily="monospace" fontSize="21" textLength="13" lengthAdjust="spacingAndGlyphs">{String.fromCharCode(code)}</text>}</g>;
  })}
  {d?.powered&&d.on&&cx<16&&<g fill="#25351b">{d.cursor&&<rect x={9+cx*17} y={30+cy*34} width="13" height="2"/>}{d.blink&&d.blinkOn&&<rect x={9+cx*17} y={8+cy*34} width="13" height="21"/>}</g>}
 </svg>;
}
export function PeripheralPanel({circuit,simulation}:{circuit:Circuit;simulation?:SimulationFrame}){
 const tfts=circuit.components.filter(p=>(p.kind==='st7735'||p.kind==='ili9341')&&!circuit.components.some(t=>t.kind==='xpt2046'&&t.properties.touchDisplay===p.id));
 const tms=circuit.components.filter(p=>p.kind==='tm1637');
 const displays=circuit.components.filter(p=>['ssd1306','ssd1306_32','lcd1602'].includes(p.kind)),servos=circuit.components.filter(p=>p.kind==='servo'||p.kind==='sg90');
 if(!tfts.length&&!tms.length&&!displays.length&&!servos.length&&!circuit.components.some(p=>p.kind==='stepperMotor'))return null;
 return <div className="peripheral-panel" aria-label="Zaslon i aktuatori">
  {tfts.map(p=>{const d=simulation?.tfts?.[p.id];return <div className="tft-monitor" key={p.id}><div><b>{p.label} · {p.kind==='ili9341'?'240 × 320':'128 × 128'}</b><small>{!d?'Čeka program':!d.powered?'Bez napajanja':!d.backlight?'BL isključen':d.sleep?'Sleep':d.on?'RGB565 · SPI':'Display OFF'}</small></div><TFTDisplay width={p.kind==='ili9341'?240:128} height={p.kind==='ili9341'?320:128} pixels={d?.pixels} label={`${p.label}: stvarni pikseli iz SPI upisa`}/></div>;})}
  <StepperMonitor circuit={circuit} simulation={simulation}/>
  {tms.map(p=><TMMonitor key={p.id} part={p} display={simulation?.tmDisplays?.[p.id]}/>)}
  {displays.map(p=>{const d=simulation?.displays[p.id],height=p.kind==='ssd1306_32'?32:64;return <div className="oled-monitor" key={p.id}><div><b>{p.label} · {p.kind==='lcd1602'?'16 × 2':`128 × ${height}`}</b><small>{d?d.powered?(d.on?'Uključen':'Zaslon isključen'):'Bez napajanja':'Čeka program'}{p.kind==='lcd1602'&&d?.powered?` · svjetlo ${d.backlight?'uključeno':'isključeno'}`:''}</small></div>{p.kind==='lcd1602'?<CharacterDisplay display={d} label={p.label}/>:<PixelDisplay bytes={d?.bytes} contrast={d?.contrast} height={height} label={`${p.label}: stvarni pikseli iz I2C upisa`}/>}</div>;})}
  {servos.map(p=>{const s=simulation?.servos[p.id];return <div className="servo-monitor" key={p.id}><b>{p.label}</b><svg viewBox="0 0 120 70" role="img" aria-label={`Položaj ${p.label}: ${s?.angle==null?'nema valjane naredbe':s.angle.toFixed(1)+' stupnjeva'}`}><path d="M10 60a50 50 0 0 1 100 0" fill="none" stroke="var(--line)" strokeWidth="4"/><path d="M60 60V15" stroke="var(--teal)" strokeWidth="4" strokeLinecap="round" transform={`rotate(${(s?.angle??90)-90} 60 60)`} opacity={s?.angle==null?.2:1}/><circle cx="60" cy="60" r="5" fill="var(--teal)"/></svg><output aria-label={`Kut ${p.label}`}>{s?.angle==null?'—':`${s.angle.toFixed(1)}°`}</output><small>{s?.reason??'Pokreni program'}</small>{s?.pulseUs!=null&&<small>{s.freq?.toFixed(2)} Hz · {s.pulseUs.toFixed(1)} µs</small>}</div>;})}
 </div>;
}
export function PeripheralMeasurements({simulation,parts}:{simulation:SimulationFrame;parts:Map<string,{label:string}>}){
 const records=simulation.measurements;
 function csv(){
  const rows=['vrijeme_ms,komponenta,uzorak,temperatura_C,relativna_vlaga_postotak,tlak_Pa',...records.map(r=>[r.timeMs,r.component,r.sample,r.temperature?.toFixed(4)??'',r.humidity?.toFixed(4)??'',r.pressure?.toFixed(2)??''].join(','))];
  download('Senzori_mjerenja.csv',new TextEncoder().encode('\uFEFF'+rows.join('\r\n')+'\r\n'),'text/csv;charset=utf-8');
 }
 return <>
  <OpticalMeasurements simulation={simulation} parts={parts}/>
  <SPIMeasurements simulation={simulation}/>
  <StepperMeasurements simulation={simulation} parts={parts}/>
  <ActuatorMeasurements simulation={simulation} parts={parts}/>
  <SDMeasurements simulation={simulation}/><RTCMeasurements simulation={simulation} parts={parts}/>
  <TMMeasurements simulation={simulation} parts={parts}/>
  <IRMeasurements simulation={simulation} parts={parts}/>
  <EncoderMeasurements simulation={simulation} parts={parts}/>
  {simulation.avr&&<><p>AVR: {simulation.avr.cycles.toLocaleString('hr-HR')} ciklusa · UART {simulation.avr.uartBaud} baud · na čekanju {simulation.avr.rxPending} bajtova.</p>{simulation.avr.memory&&<p>SRAM: statički podaci {simulation.avr.memory.staticBytes} B / 2048 B · najmanji razmak stoga do statičkih podataka {simulation.avr.memory.minFreeToStatic} B. Dinamički heap nije uračunat.</p>}<details className="measurement-log"><summary>AVR TWI / SPI · registarski prijenosi</summary><p>TWI prenosi stvarne bajtove I2C senzora i SSD1306; software I2C prikazan je u zajedničkom I2C zapisu. SPI koristi stvarne registarske bajtove; TFT i BMP280 imaju zajednički zapis niže.</p><table><thead><tr><th>Vrijeme (µs)</th><th>Sučelje</th><th>Operacija</th><th>Bajt</th><th>Rezultat</th></tr></thead><tbody>{simulation.avr.busTrace.slice(-20).map((t,i)=><tr key={i}><td>{t.timeUs.toFixed(1)}</td><td>{t.kind}</td><td>{t.operation}</td><td>{t.value===undefined?'—':'0x'+t.value.toString(16).padStart(2,'0')}</td><td>{t.result??'—'}</td></tr>)}</tbody></table></details></>}
  {!!Object.keys(simulation.sensors).length&&<><h3>Očitanja senzora</h3><table><thead><tr><th>Senzor</th><th>Napajanje / status</th><th>Temperatura</th><th>Relativna vlaga</th><th>Tlak</th></tr></thead><tbody>{Object.entries(simulation.sensors).map(([id,s])=><tr key={id}><td>{parts.get(id)?.label}</td><td>{!s.powered?'Bez napajanja':s.busy?'Pretvorba…':s.calibrated?'Spreman':'Inicijaliziraj'}</td><td>{s.measuredTemperature==null?'—':s.measuredTemperature.toFixed(2)+' °C'}</td><td>{s.measuredHumidity==null?'—':s.measuredHumidity.toFixed(2)+' %'}</td><td>{s.measuredPressure==null?'—':(s.measuredPressure/100).toFixed(2)+' hPa'}</td></tr>)}</tbody></table></>}
  {!!Object.keys(simulation.servos).length&&<><h3>Servo · zadani položaj</h3><table><thead><tr><th>Servo</th><th>Kut</th><th>Impuls</th><th>Stanje</th></tr></thead><tbody>{Object.entries(simulation.servos).map(([id,s])=><tr key={id}><td>{parts.get(id)?.label}</td><td>{s.angle==null?'—':s.angle.toFixed(1)+'°'}</td><td>{s.pulseUs==null?'—':s.pulseUs.toFixed(1)+' µs'}</td><td>{s.reason}</td></tr>)}</tbody></table></>}
  <details className="measurement-log"><summary>Zapis mjerenja · {records.length} / 200</summary><p>Zapisuje pročitane uzorke senzora. Tlak se izvozi u Pa, a prikazuje u hPa; BMP senzori ne mjere vlagu. AM2320 vraća prethodni uzorak. Čuva posljednjih 200 uzoraka ove sesije. Zaustavi čuva rezultate za CSV; Run, Reset i promjena sklopa počinju novi zapis. Preuzmi CSV prije novog pokretanja.</p><button onClick={csv} disabled={!records.length}>Preuzmi mjerenja CSV</button><table><thead><tr><th>Vrijeme (s)</th><th>Senzor</th><th>Uzorak</th><th>°C</th><th>% RH</th><th>hPa</th></tr></thead><tbody>{records.slice(-20).reverse().map(r=><tr key={r.component+':'+r.sample}><td>{(r.timeMs/1000).toFixed(2)}</td><td>{parts.get(r.component)?.label}</td><td>{r.sample}</td><td>{r.temperature?.toFixed(2)??'—'}</td><td>{r.humidity?.toFixed(2)??'—'}</td><td>{r.pressure==null?'—':(r.pressure/100).toFixed(2)}</td></tr>)}</tbody></table><small>Prikaz: posljednjih 20; CSV: sva zadržana očitanja.</small></details>
  <details className="measurement-log"><summary>I2C prijenosi · {simulation.i2cTrace.length} / 100</summary><p>Posljednjih 100 prijenosa, najviše prvih 16 bajtova svakog prijenosa. Scan se ne zapisuje.</p><table><thead><tr><th>Vrijeme</th><th>Sabirnica / adresa</th><th>Smjer / duljina</th><th>Bajtovi (hex)</th><th>Odgovor</th></tr></thead><tbody>{simulation.i2cTrace.slice(-20).reverse().map((t,i)=><tr key={i}><td>{(t.timeMs/1000).toFixed(2)} s</td><td>{t.bus} / 0x{t.address.toString(16)}</td><td>{t.operation} · {t.length} B</td><td className="trace-bytes">{t.bytes.map(b=>b.toString(16).padStart(2,'0')).join(' ')}{t.length>16?' …':''}</td><td>{t.result}</td></tr>)}</tbody></table></details>
 </>;
}
