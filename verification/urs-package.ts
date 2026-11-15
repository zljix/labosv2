// Run projects made by the URS catalogue in the exact released Workers.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import {prepareRun} from '../src/runtime/adapter';
import {buildFile} from '../public/arduino-contract.mjs';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),release=resolve('dist/app/'+manifest.build);
const avr=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(avr);
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>{const p=String(input).replace(/^\/app\/[^/]+\//,'');if(p.startsWith('/')||p.includes('..'))throw Error('Nedopušten testni resurs');return new Response(readFileSync(resolve(release,p)));};
const results=[];
try{
 for(const target of ['micropython','s3-cpp','uno','nano'] as UrsTarget[]){
  const p=await createUrsProject('regulator','regulator',target),snapshot=prepareRun(p),artifact=p.language==='arduino-cpp'?JSON.parse(p.files[buildFile(p)]):null;
  const path=target==='micropython'?release+'/worker.mjs':target==='s3-cpp'?release+'/s3-worker.mjs':resolve('dist'+avr.url);
  const w=new Worker(new URL('./sd-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(path).href}});
  let output='',phase=0;const at=performance.now(),observations:any[]=[];
  const temperatures=[24,29,27,25,27],angles=[0,90,90,0,0];
  try{
   await new Promise<void>((done,reject)=>{
    const timer=setTimeout(()=>reject(Error(`${target} URS regulator timeout: ${output.slice(-600)}`)),45000);
    w.on('error',e=>{clearTimeout(timer);reject(e);});
    w.on('message',e=>{
     if(e.type==='error'){clearTimeout(timer);reject(Error(e.message));return;}
     if(e.type==='console')output=(output+e.text).slice(-12000);
     if(e.type!=='simulation'||phase>=temperatures.length)return;
     const entry=Object.entries(e.sensors??{}).find(([,s]:any)=>s.measuredTemperature!=null),sensor=entry?.[1] as any,servo=Object.values(e.servos??{})[0] as any,display=Object.values(e.displays??{})[0] as any;
     if(!sensor||Math.abs(sensor.measuredTemperature-temperatures[phase])>.1||servo?.angle==null||Math.abs(servo.angle-angles[phase])>2||!display?.on||!display.bytes.some(Boolean))return;
     observations.push({phase,temperature:sensor.measuredTemperature,angle:servo.angle,sample:sensor.sample,timeMs:e.timeMs,displayNonzero:display.bytes.filter(Boolean).length});
     phase++;if(phase===temperatures.length){clearTimeout(timer);done();}else w.postMessage({type:'input',session:222,component:entry![0],temperature:temperatures[phase]});
    });
    if(target==='micropython')w.postMessage({type:'run',session:222,code:snapshot.source,machine:readFileSync(release+'/machine.py','utf8'),files:snapshot.files,config:{circuit:snapshot.circuit}});
    else if(target==='s3-cpp')w.postMessage({type:'run',session:222,project:p,artifact,circuit:snapshot.circuit});
    else w.postMessage({type:'run',session:222,hex:artifact.hex,circuit:snapshot.circuit,adcChannels:target==='nano'?8:6,staticRamBytes:artifact.staticRamBytes});
   });
   const observationMs=performance.now()-at,stopAt=performance.now();await w.terminate();const stopMs=performance.now()-stopAt;assert(stopMs<500);
   assert.deepEqual(observations.map(o=>Math.round(o.angle)),angles);results.push({target,status:'pass',build:manifest.build,observationMs,stopMs,observations,console:output});
  }finally{await w.terminate();}
 }
}finally{globalThis.fetch=originalFetch;}
mkdirSync('docs/stage22-evidence',{recursive:true});writeFileSync('docs/stage22-evidence/packaged-urs.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({target,status,build,observationMs,stopMs})=>({target,status,build,observationMs,stopMs}))));
