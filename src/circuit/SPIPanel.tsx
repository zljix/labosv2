import {useEffect,useRef} from 'react';
import type {SimulationFrame} from './compile';
import {download} from '../project/archive';
export function TFTDisplay({pixels=[],width=128,height=128,label='TFT ST7735 · 128 × 128'}:{pixels?:number[];width?:number;height?:number;label?:string}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const ctx=ref.current?.getContext('2d');if(!ctx)return;const image=ctx.createImageData(width,height);for(let i=0;i<width*height;i++){const c=pixels[i]??0;image.data[i*4]=Math.round(((c>>11)&31)*255/31);image.data[i*4+1]=Math.round(((c>>5)&63)*255/63);image.data[i*4+2]=Math.round((c&31)*255/31);image.data[i*4+3]=255;}ctx.putImageData(image,0,0);},[pixels,width,height]);
 return <canvas ref={ref} className="tft-pixels" width={width} height={height} role="img" aria-label={label}/>;
}
export function SPIMeasurements({simulation:s}:{simulation:SimulationFrame}){
 const trace=s.spiTrace??[];
 if(!trace.length&&!Object.keys(s.tfts??{}).length&&!Object.keys(s.touches??{}).length)return null;
 function csv(){const rows=['vrijeme_us,uredaj,operacija,bajt_hex,rezultat',...trace.map(t=>[t.timeUs.toFixed(2),t.device,t.operation,t.value.toString(16).padStart(2,'0'),JSON.stringify(t.result)].join(','))];download('SPI_prijenosi.csv',new TextEncoder().encode('\uFEFF'+rows.join('\r\n')+'\r\n'),'text/csv;charset=utf-8');}
 return <details className="measurement-log"><summary>SPI · TFT, dodir i registri · {s.spiBytes??0} bajtova</summary>
  <p>Posljednjih 100 zabilježenih događaja; naredbe i prvi podatak skupnog TFT upisa, svaki BMP280 i XPT2046 bajt. Prijenos je funkcionalan po bajtu; nije prikaz fizičkih SCK bridova. Stop čuva zapis, Run/Reset počinju novu sesiju.</p>
  {Object.entries(s.tfts??{}).map(([id,d])=><p key={id}>{id}: {d.width} × {d.height} · {d.written} RGB565 piksela · MADCTL 0x{d.madctl.toString(16)} · prozor {d.window.join(', ')} · {d.sleep?'sleep':d.on?'display ON':'display OFF'} · BL {d.backlight?'ON':'OFF'}</p>)}
  {Object.entries(s.touches??{}).map(([id,t])=><p key={id}>{id}: XPT2046 · {t.powered?'napajanje uredno':'bez napajanja'} · PENIRQ {t.irq??'—'} · {t.conversions} stvarnih ADC pretvorbi · posljednji kanal {t.last.channel??'—'} = {t.last.value??'—'}. Kalibrirane koordinate ispisuje program.</p>)}
  <button onClick={csv} disabled={!trace.length}>Preuzmi SPI CSV</button>
  <table><thead><tr><th>µs</th><th>Uređaj</th><th>Operacija</th><th>HEX</th><th>Rezultat</th></tr></thead><tbody>{trace.slice(-20).map((t,i)=><tr key={i}><td>{t.timeUs.toFixed(1)}</td><td>{t.device}</td><td>{t.operation}</td><td>{t.value.toString(16).padStart(2,'0')}</td><td>{t.result}</td></tr>)}</tbody></table>
 </details>;
}
