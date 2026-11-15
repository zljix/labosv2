// Final release Workers, exact source-bound WASM, live input and forced Stop.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {s3ProtocolExamples} from '../src/runtime/s3ProtocolExamples';
import {s3CompletionExamples} from '../src/runtime/s3CompletionExamples';
import {compileCircuit} from '../src/circuit/compile';
import type {Circuit} from '../src/circuit/model';
type Key=keyof typeof s3ProtocolExamples|keyof typeof s3CompletionExamples;
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),release=resolve('dist/app/'+manifest.build);
const artifacts=JSON.parse(readFileSync(release+'/s3-examples.json','utf8')),results:any[]=[];
function summary(f:any){if(!f)return f;const v=structuredClone(f);for(const d of Object.values(v.tfts??{})as any[]){const p=d.pixels;d.pixels={length:p.length,nonzero:p.filter(Boolean).length,sha256:createHash('sha256').update(JSON.stringify(p)).digest('hex'),corners:[p[0],p.at(-1)]};}return v;}
const open=(p:ReturnType<typeof s3ExampleProject>,id:string,pin:string)=>{const c=p.circuit as Circuit;c.wires=c.wires.filter(w=>!(w.to.component===id&&w.to.pin===pin));};
async function execute(key:Key,edit?:(p:ReturnType<typeof s3ExampleProject>)=>void,wantError?:RegExp,wantText?:RegExp){
 const p=s3ExampleProject(key);edit?.(p);const w=new Worker(new URL('./s3-built-worker.mjs',import.meta.url),{workerData:{path:release+'/s3-worker.mjs'}});
 let output='',frame:any,carry='',error='',phase=0,done=false;const marks:any[]=[],timers:any[]=[];
 const input=(component:string,values:any)=>w.postMessage({type:'input',session:224,component,...values});
 const press=(n:number,cmd=70,hold=350)=>input('irRemote',{irPress:n,irCommand:cmd,irHoldMs:hold});
 try{
  await new Promise<void>((ok,bad)=>{
   const timer=setTimeout(()=>bad(Error(key+' packaged timeout '+output)),40000);
   const finish=()=>{if(done)return;done=true;clearTimeout(timer);ok();};
   w.on('error',x=>{clearTimeout(timer);bad(x);});
   w.on('message',v=>{
    try{
     if(v.type==='error'){error=v.message;if(wantError){assert.match(error,wantError);finish();}else{clearTimeout(timer);bad(Error(error));}return;}
     if(v.type==='simulation')frame=v;
     if(v.type==='console'){output+=v.text;carry+=v.text;let at;while((at=carry.indexOf('\n'))>=0){
      const line=carry.slice(0,at).trim();carry=carry.slice(at+1);marks.push({line,frame:summary(frame)});
      if(wantError||wantText)continue;
      if((key==='irNEC'||key==='irPulses')&&line==='S3 IR READY')press(1);
      if(key==='irLED'&&line==='S3 IR READY LED=0')press(1,69,0);
      else if(key==='irLED'&&line==='S3 LED=50 R=0')press(2,70,350);
      if(key==='spiDashboard'&&phase===0&&line.includes('SPI DASH T=24.00')){phase=1;input('bmpSPI',{temperature:-10,pressure:90000});}
      if(['bmp180','bmp280','am2320'].includes(key)&&phase===0&&line.includes(' T=')){phase=1;input(key+'1',{temperature:key==='am2320'?31.2:-10,...(key==='am2320'?{humidity:67.8}:{pressure:90000})});}
      if(key==='touchRaw'&&phase===0&&line.includes('TOUCH RAW')){phase=1;input('touch1',{touchDown:true,touchX:239,touchY:319,touchPressure:100});}
      if(key==='touchCalibration'){
       if(line==='CAL TARGET 20 20'||line==='CAL TARGET 219 299'){const first=line==='CAL TARGET 20 20';input('touch1',{touchDown:true,touchX:first?20:219,touchY:first?20:299,touchPressure:50});timers.push(setTimeout(()=>input('touch1',{touchDown:false}),200));}
       else if(line.startsWith('CAL READY '))input('touch1',{touchDown:true,touchX:120,touchY:160,touchPressure:50});
      }
      if(key==='touchRotation'){
       if(line==='TOUCH ROT READY')input('touch1',{touchDown:true,touchX:60,touchY:80,touchPressure:50});
       else if(line.startsWith('TOUCH ROT=')){phase++;input('touch1',{touchDown:false});if(phase<4)timers.push(setTimeout(()=>input('touch1',{touchDown:true,touchX:60,touchY:80,touchPressure:50}),300));}
      }
     }}
     if(wantError)return;
     if(wantText){if(wantText.test(output))finish();return;}
     // Console and frame notifications are independent. Check both as needed.
     const t=frame?.tfts?.tft1;
     if((key==='irNEC'||key==='irPulses')&&output.includes('S3 NEC A=0 C=70 R=1'))finish();
     if(key==='irLED'&&output.includes('S3 LED=90 R=1')&&Math.abs(frame?.gpios['7']?.duty/65535-229/255)<.001)finish();
     if(key==='irTransmit'&&output.includes('S3 IR TX A=0 C=69 REPEATS=2')&&frame?.infrared.irRx.transitions>=76)finish();
     if(key==='tftGraphics'&&output.includes('TFT GRAPHICS READY')&&t?.pixels[0]===0xf800&&t?.pixels[42]===0x07e0&&t?.pixels[85]===31)finish();
     if(key==='tftRotation'&&output.includes('TFT ROT=3')&&t?.written>60000)finish();
     if(key==='bmp280SPI'&&output.includes('BMP280 SPI T=24.00 P=101325'))finish();
     if(key==='spiDashboard'&&output.includes('SPI DASH T=-10.00 P=90000')&&Math.abs(frame?.sensors.bmpSPI.measuredPressure-90000)<2)finish();
     if((key==='bmp180'||key==='bmp280')&&output.includes(key.toUpperCase()+' T=-10.00 P='))finish();
     if(key==='am2320'&&output.includes('AM2320 T=31.20 RH=67.80'))finish();
     if(key==='ds18Errors'&&output.includes('NAKON CEKANJA:')&&output.includes('T=25.0000'))finish();
     if(key==='tmSegments'&&output.includes('TM SEGMENT bit=7')&&frame?.tmDisplays.tm1.bytes[1]===128)finish();
     if(key==='tmClock'&&output.includes('TM CLOCK=12:35'))finish();
     if(key==='iliGraphics'&&output.includes('ILI GRAPHICS READY')&&t?.pixels[0]===0xf800&&t?.pixels.at(-1)===0xf81f)finish();
     if(key==='iliRotation'&&output.includes('ILI ROT=3 320x240')&&t?.written>300000)finish();
     if(key==='touchRaw'&&output.includes('X=3900 Y=3850 Z1=2000 Z2=2595 IRQ=0'))finish();
     if(key==='touchCalibration'&&/CAL POINT 1(19|20) 1(59|60)/.test(output))finish();
     if(key==='touchRotation'&&phase===4)finish();
    }catch(x){clearTimeout(timer);bad(x);}
   });
   w.postMessage({type:'run',session:224,project:p,artifact:artifacts[key],circuit:compileCircuit(p.circuit as Circuit)});
  });
  if(!wantError&&!wantText)assert.equal(frame.diagnostics.filter((d:any)=>d.severity==='error').length,0);
  const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);
  results.push({key,fault:!!(wantError||wantText),status:'pass',version:manifest.version,build:manifest.build,error,stopMs,console:output,frame:summary(frame),marks});
 }finally{for(const t of timers)clearTimeout(t);await w.terminate();}
}
for(const key of [...Object.keys(s3ProtocolExamples),...Object.keys(s3CompletionExamples)]as Key[])await execute(key);
await execute('irNEC',p=>open(p,'irRx','OUT'),/Nepobuđen/);
await execute('bmp280SPI',p=>open(p,'bmpSPI','MISO'),undefined,/ID\/SPOJ ERROR/);
await execute('irNEC',p=>p.files['lab_s3_nec.h']+='\n// edited\n',/hash|izvor|odgovara/i);
mkdirSync('docs/stage22d-evidence',{recursive:true});writeFileSync('docs/stage22d-evidence/packaged-s3-protocols.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({key,fault,status,stopMs})=>({key,fault,status,stopMs}))));

