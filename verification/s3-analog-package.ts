// Executes the actual versioned Worker and artifacts shipped in dist.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {compileCircuit} from '../src/circuit/compile';
import type {Circuit} from '../src/circuit/model';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8'));
const artifacts=JSON.parse(readFileSync(`dist/app/${manifest.build}/s3-examples.json`,'utf8'));
const results:any[]=[];
const n=(line:string,k:string)=>Number(line.match(new RegExp('(?:^| )'+k+'=(-?[0-9.]+)'))?.[1]);
const close=(a:number,b:number,t=.15)=>Math.abs(a-b)<t;
const specs={
 lm35:{prefix:'S3 LM35 ',inputs:[{component:'lm351',temperature:75}],initial:(l:string)=>close(n(l,'T'),25),changed:(l:string)=>close(n(l,'T'),75)},
 temt6000:{prefix:'S3 TEMT6000 ',inputs:[{component:'temt60001',illuminance:2000}],initial:(l:string)=>n(l,'ADC')===660,changed:(l:string)=>n(l,'ADC')===4095&&n(l,'SAT')===1},
 ntc:{prefix:'S3 NTC ',inputs:[{component:'ntc1',temperature:50}],initial:(l:string)=>close(n(l,'T'),25),changed:(l:string)=>close(n(l,'T'),50)},
 ky023:{prefix:'S3 JOY ',inputs:[{component:'ky0231',axisX:100,axisY:0,pressed:true}],initial:(l:string)=>n(l,'NX')===0&&n(l,'NY')===0&&n(l,'SW')===1,changed:(l:string)=>n(l,'X')===4095&&n(l,'Y')===0&&n(l,'SW')===0&&n(l,'SATX')===1},
 flame:{prefix:'S3 FLAME ',inputs:[{component:'flame1',stimulus:75}],initial:(l:string)=>n(l,'ADC')===4095&&n(l,'DO')===1,changed:(l:string)=>n(l,'ADC')===1090&&n(l,'DO')===0},
 sound:{prefix:'S3 SOUND ',inputs:[{component:'sound1',stimulus:75}],initial:(l:string)=>n(l,'DO')===1,changed:(l:string)=>n(l,'DO')===0},
 analogCompare:{prefix:'S3 COMPARE ',inputs:[{component:'lm351',temperature:50},{component:'ntc1',temperature:50}],initial:(l:string)=>close(n(l,'LM35'),25)&&close(n(l,'NTC'),25),changed:(l:string)=>close(n(l,'LM35'),50)&&close(n(l,'NTC'),50)},
 dualInputs:{prefix:'S3 DUAL ',inputs:[{component:'pot1',position:80},{component:'pot2',position:20},{component:'sw2',pressed:true}],initial:(l:string)=>n(l,'A')===1090&&n(l,'B')===3269&&n(l,'S1')===1&&n(l,'S2')===1,changed:(l:string)=>n(l,'A')===3487&&n(l,'B')===872&&n(l,'S1')===1&&n(l,'S2')===0},
};
for(const key of Object.keys(specs) as (keyof typeof specs)[]){
 const spec=specs[key],p=s3ExampleProject(key),w=new Worker(new URL('./s3-built-worker.mjs',import.meta.url),{workerData:{path:resolve(`dist/app/${manifest.build}/s3-worker.mjs`)}});
 let text='',frame:any,stage=0;
 try{
  await new Promise<void>((done,reject)=>{
   const timer=setTimeout(()=>reject(Error(`${key}: timeout ${text}`)),15000);
   w.on('error',e=>{clearTimeout(timer);reject(e);});
   w.on('message',e=>{
    if(e.type==='error'){clearTimeout(timer);reject(Error(e.message));return;}
    if(e.type==='simulation')frame=e;if(e.type!=='console')return;text+=e.text;
    const lines=text.split(/\r?\n/).filter(l=>l.startsWith(spec.prefix)),last=lines.at(-1)??'';
    if(stage===0&&spec.initial(last)){stage=1;for(const input of spec.inputs)w.postMessage({type:'input',session:222,...input});}
    else if(stage===1&&spec.changed(last)){stage=2;clearTimeout(timer);done();}
   });
   w.postMessage({type:'run',session:222,project:p,artifact:artifacts[key],circuit:compileCircuit(p.circuit as Circuit)});
  });
  assert.equal(stage,2);assert(frame);assert.equal(frame.diagnostics.filter((d:any)=>d.severity==='error').length,0);
  const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);
  results.push({key,status:'pass',version:manifest.version,build:manifest.build,stopMs,console:text,analogInputs:frame.analogInputs,inputs:spec.inputs});
 }finally{await w.terminate();}
}
// The bundled Worker must reject an open sensor signal, not show the UI stimulus.
const p=s3ExampleProject('lm35'),c=p.circuit as Circuit;c.wires=c.wires.filter(w=>w.to.pin!=='OUT');
const w=new Worker(new URL('./s3-built-worker.mjs',import.meta.url),{workerData:{path:resolve(`dist/app/${manifest.build}/s3-worker.mjs`)}});
try{
 let text='',diagnostics:any[]=[];
 const error=await new Promise<string>((done,reject)=>{
  const timer=setTimeout(()=>reject(Error('Open signal Worker timeout')),10000);
  w.on('error',e=>{clearTimeout(timer);reject(e);});w.on('message',e=>{if(e.type==='console')text+=e.text;if(e.type==='simulation')diagnostics=e.diagnostics;if(e.type==='error'){clearTimeout(timer);done(e.message);}});
  w.postMessage({type:'run',session:223,project:p,artifact:artifacts.lm35,circuit:compileCircuit(c)});
 });
 assert.match(error,/Nepobuđen/);assert(!/T=\d/.test(text));assert(diagnostics.some(d=>d.code==='input-signal-open'));
 results.push({key:'lm35-open-signal',status:'pass',version:manifest.version,build:manifest.build,error,console:text,diagnostics});
}finally{await w.terminate();}
mkdirSync('docs/stage22b-evidence',{recursive:true});writeFileSync('docs/stage22b-evidence/packaged-s3-analog.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({key,status,stopMs})=>({key,status,stopMs}))));
