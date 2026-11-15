import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {s3ExampleProject} from '../src/runtime/s3Examples.ts';
import {compileCircuit} from '../src/circuit/compile.ts';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),artifacts=JSON.parse(readFileSync(`dist/app/${manifest.build}/s3-examples.json`,'utf8'));
const results=[];
for(const key of ['touch','regulator']){
 const p=s3ExampleProject(key),events=[],w=new Worker(new URL('./s3-built-worker.mjs',import.meta.url),{workerData:{path:resolve(`dist/app/${manifest.build}/s3-worker.mjs`)}});
 let text='',frame;
 try{
  await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Pakirani S3 '+key+' nije odgovorio.')),30000);w.on('error',reject);w.on('message',e=>{
   events.push(e);if(e.type==='error'){clearTimeout(timer);reject(Error(e.message));}
   if(e.type==='ready')w.postMessage({type:'input',session:72,...(key==='touch'?{component:'touch1',touchDown:true,touchX:120,touchY:160,touchPressure:50}:{component:'aht1',temperature:31,humidity:70})});
   if(e.type==='console')text+=e.text;if(e.type==='simulation')frame=e;
   if(key==='touch'?text.includes('TOUCH LED=1')&&frame?.leds?.touchLED?.brightness>0:text.includes('S3 T=31.00 RH=70.00 SERVO=90')&&Math.abs(frame?.servos?.servo1?.angle-90)<.3){clearTimeout(timer);done();}
  });w.postMessage({type:'run',session:72,project:p,artifact:artifacts[key],circuit:compileCircuit(p.circuit)});});
  const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);
  const pixels=key==='touch'?frame.tfts.tft1.pixels:frame.displays.oled1.bytes;
  results.push({key,status:'pass',build:manifest.build,stopMs,console:text,pixels:{count:pixels.length,nonzero:pixels.filter(Boolean).length,sha256:createHash('sha256').update(JSON.stringify(pixels)).digest('hex')}});
 }finally{await w.terminate();}
}
writeFileSync((process.env.LAB_PACKAGE_EVIDENCE_DIR??'docs/stage18b-evidence')+'/packaged-workers.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({key,status,stopMs})=>({key,status,stopMs}))));
