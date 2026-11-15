// Retained U8g2 software-I2C source must also discover a translated GPIO bus.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createUrsProject} from '../src/lessons/ursCatalog';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {UNO,NANO} from '../src/boards/profiles';
import {compileCircuit} from '../src/circuit/compile';
import type {Circuit} from '../src/circuit/model';
import {validateArtifact} from '../public/avr-contract.mjs';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),release=resolve('dist/app/'+manifest.build);
const avr=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(avr);
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>{const path=String(input).replace(/^\/app\/[^/]+\//,'');if(path.startsWith('/')||path.includes('..'))throw Error('Nedopušten testni resurs');return new Response(readFileSync(resolve(release,path)));};
const artifacts=JSON.parse(readFileSync(release+'/avr-examples.json','utf8')),results:any[]=[];
try{
 for(const [target,board]of [['uno',UNO],['nano',NANO]]as const){
  const template=await createUrsProject('i2cLevels','i2cOled32',target),c=template.circuit as Circuit;
  // Use the retained 128x64 SW-I2C program, so adjust geometry and actual pins.
  c.components.find(p=>p.id==='display1')!.kind='ssd1306';
  for(const w of c.wires)for(const e of [w.from,w.to])if(e.component===c.components.find(p=>p.kind==='board')!.id){if(e.pin==='A4')e.pin='D6';if(e.pin==='A5')e.pin='D7';}
  const p=arduinoExampleProject('oled',board),a=artifacts[board].oled;p.circuit=c;await validateArtifact(p,a);
  const worker=new Worker(new URL('./sd-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+avr.url)).href}});
  try{
   let lastFrame:any;
   const result=await new Promise<any>((done,reject)=>{
    const timer=setTimeout(()=>{mkdirSync('docs/stage22h-evidence',{recursive:true});writeFileSync('docs/stage22h-evidence/software-failure.json',JSON.stringify({target,frame:lastFrame},null,2)+'\n');reject(Error(target+': software-I2C timeout'));},60000);
    const fail=(e:Error)=>{clearTimeout(timer);reject(e);};worker.on('error',fail);
    worker.on('message',e=>{
     if(e.type==='error'){fail(Error(e.message));return;}if(e.type!=='simulation')return;lastFrame=e;
     const d=e.displays.display1,b=e.i2cLevelShifters.i2cLevel1;
     if(!d?.on||!d.powered||d.bytes.length!==1024||!d.bytes[6*128+127]||!d.bytes[5*128])return;
     if(e.diagnostics.some((x:any)=>x.severity==='error')){fail(Error(JSON.stringify(e.diagnostics)));return;}
     const bytes=d.bytes.filter(Boolean).length;if(bytes<100)return;
     assert(e.i2cTrace.some((t:any)=>t.bus!==0&&t.address===0x3c&&t.operation==='W'));
     clearTimeout(timer);done({target,status:'pass',build:manifest.build,timeMs:e.timeMs,geometry:[d.width,d.height],nonzeroBytes:bytes,channels:b.channels,trace:e.i2cTrace});
    });
    worker.postMessage({type:'run',session:229,hex:a.hex,circuit:compileCircuit(c,'avr'),adcChannels:target==='nano'?8:6,staticRamBytes:a.staticRamBytes});
   });
   results.push(result);console.log(target+': translated GPIO6/7 software I2C passed');
  }finally{await worker.terminate();}
 }
}finally{globalThis.fetch=originalFetch;}
mkdirSync('docs/stage22h-evidence',{recursive:true});writeFileSync('docs/stage22h-evidence/packaged-i2c-software.json',JSON.stringify(results,null,2)+'\n');
