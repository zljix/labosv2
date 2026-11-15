// Exercise the exact release Worker and its relative imports from dist/.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {s3ExampleProject} from '../src/runtime/s3Examples.ts';
import {compileCircuit} from '../src/circuit/compile.ts';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8'));
const artifacts=JSON.parse(readFileSync(`dist/app/${manifest.build}/s3-examples.json`,'utf8')),results=[];
for(const key of ['dht22','ds18Multi','ds18Resolution','oled64','oled32']){
 const p=s3ExampleProject(key),w=new Worker(new URL('./s3-built-worker.mjs',import.meta.url),{workerData:{path:resolve(`dist/app/${manifest.build}/s3-worker.mjs`)}});
 let output='',frame,changed=false;const start=performance.now();
 try{
  await new Promise((done,reject)=>{
   const timer=setTimeout(()=>reject(Error('Pakirani S3 '+key+' nije odgovorio.')),30000);
   w.on('error',e=>{clearTimeout(timer);reject(e);});w.on('message',e=>{
    if(e.type==='error'){clearTimeout(timer);reject(Error(e.message));}
    if(e.type==='ready'&&key==='dht22')w.postMessage({type:'input',session:81,component:'dht1',temperature:-12.3,humidity:67.8});
    if(e.type==='console')output+=e.text;if(e.type==='simulation')frame=e;
    const good=key==='dht22'?output.includes('DHT22 T=-12.3 C RH=67.8'):key==='ds18Multi'?['25.0000','-10.1250','60.0000'].every(t=>output.includes('T='+t)):key==='ds18Resolution'?output.includes('BITA=12')&&frame?.oneWireDevices?.ds1?.resolution===12:output.includes('S3 OLED')&&frame?.displays?.display1?.bytes?.some(Boolean);
    if(good&&!changed){changed=true;clearTimeout(timer);done();}
   });
   w.postMessage({type:'run',session:81,project:p,artifact:artifacts[key],circuit:compileCircuit(p.circuit)});
  });
  const observationMs=performance.now()-start,at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);
  const display=frame.displays?.display1?.bytes;
  results.push({key,status:'pass',build:manifest.build,observationMs,stopMs,console:output,...(display?{pixels:{length:display.length,nonzero:display.filter(Boolean).length,sha256:createHash('sha256').update(JSON.stringify(display)).digest('hex')}}:{}),timeMs:frame.timeMs});
 }finally{await w.terminate();}
}
writeFileSync((process.env.LAB_PACKAGE_EVIDENCE_DIR??'docs/stage18b-evidence')+'/packaged-libraries.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({key,status,observationMs,stopMs})=>({key,status,observationMs,stopMs}))));
