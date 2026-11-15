// Run imported URS18 ZIPs in the exact final versioned Workers, including faults.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import {prepareRun} from '../src/runtime/adapter';
import {buildFile} from '../public/arduino-contract.mjs';
import {exportZip,importProject} from '../src/project/archive';
import type {Project} from '../src/project/model';
import type {Circuit} from '../src/circuit/model';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),release=resolve('dist/app/'+manifest.build);
const avr=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(avr);
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>{const path=String(input).replace(/^\/app\/[^/]+\//,'');if(path.startsWith('/')||path.includes('..'))throw Error('Nedopušten testni resurs');return new Response(readFileSync(resolve(release,path)));};
const evidence='docs/stage22h-evidence';mkdirSync(evidence,{recursive:true});
async function run(p:Project,target:UrsTarget,variant:string,fault=false,change=true){
 const snapshot=prepareRun(p),artifact=p.language==='arduino-cpp'?JSON.parse(p.files[buildFile(p)]):null;
 const path=target==='micropython'?release+'/worker.mjs':target==='s3-cpp'?release+'/s3-worker.mjs':resolve('dist'+avr.url);
 const worker=new Worker(new URL('./sd-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(path).href}});
 let output='',lastFrame:any,phase=0,baselineHash='',firstTime=0;const observations:any[]=[];
 const start=performance.now(),oled=variant==='i2cOled32';
 const digest=(bytes:number[])=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
 try{
  await new Promise<void>((done,reject)=>{
   const timer=setTimeout(()=>fail(Error(`timeout: ${output.slice(-800)}`)),20000);
   const fail=(error:Error)=>{clearTimeout(timer);writeFileSync(evidence+'/worker-failure.json',JSON.stringify({target,variant,fault,output,frame:lastFrame,message:error.message},null,2)+'\n');reject(Error(`${target}/${variant}/${fault?'fault':'normal'}: ${error.message}`));};
   const finish=()=>{clearTimeout(timer);done();};
   worker.on('error',fail);
   worker.on('message',e=>{
    if(e.type==='console')output=(output+e.text).slice(-12000);
    if(e.type==='simulation')lastFrame=e;
    if(e.type==='error'){
     if(fault&&/I2C|ACK|ENODEV|19|spoje|napaj/i.test(e.message)&&lastFrame?.i2cLevelShifters?.i2cLevel1?.powered===false){observations.push({error:e.message,powered:false});finish();}else fail(Error(e.message));return;
    }
    if(e.type!=='simulation')return;
    const state=e.i2cLevelShifters?.i2cLevel1;if(!state)return;
    if(fault){
     if(!state.powered&&e.diagnostics.some((d:any)=>d.code==='i2c-transfer')){
      assert(!e.i2cTrace.some((r:any)=>r.result==='ACK'));observations.push({powered:false,diagnostics:e.diagnostics,trace:e.i2cTrace});finish();
     }
     return;
    }
    if(e.diagnostics.some((d:any)=>d.severity==='error')){fail(Error(JSON.stringify(e.diagnostics)));return;}
    if(!state.powered||!state.channels.every((ch:any)=>ch.idle))return;
    for(const ch of state.channels)if(Math.abs(ch.lowVolts-3.3)>.02||Math.abs(ch.highVolts-5)>.02){fail(Error('wrong idle voltage'));return;}
    if(oled){
     const display=e.displays.display1;if(!display?.powered||!display.on||display.bytes.filter(Boolean).length<30)return;
     const hash=digest(display.bytes);
     if(phase===0){baselineHash=hash;firstTime=e.timeMs;observations.push({timeMs:e.timeMs,pixelsSha256:hash,nonzero:display.bytes.filter(Boolean).length,channels:state.channels});phase=1;if(!change)finish();}
     else if(hash!==baselineHash&&e.timeMs-firstTime>=700&&/(COUNT=|brojac=)1\b/.test(output)){
      observations.push({timeMs:e.timeMs,pixelsSha256:hash,nonzero:display.bytes.filter(Boolean).length,channels:state.channels});finish();
     }
    }else{
     const d=e.sensors.bmp2801;if(!d?.sample||d.measuredTemperature==null)return;
     if(phase===0){
      if(Math.abs(d.measuredTemperature-24)>.03||Math.abs(d.measuredPressure-101325)>10)return;
      observations.push({timeMs:e.timeMs,temperature:d.measuredTemperature,pressure:d.measuredPressure,sample:d.sample,channels:state.channels});phase=1;
      if(change)worker.postMessage({type:'input',session:228,component:'bmp2801',temperature:32.5,pressure:90000});else finish();
     }else if(Math.abs(d.measuredTemperature-32.5)<.03&&Math.abs(d.measuredPressure-90000)<10){
      observations.push({timeMs:e.timeMs,temperature:d.measuredTemperature,pressure:d.measuredPressure,sample:d.sample,channels:state.channels});finish();
     }
    }
   });
   if(target==='micropython')worker.postMessage({type:'run',session:228,code:snapshot.source,machine:readFileSync(release+'/machine.py','utf8'),files:snapshot.files,config:{circuit:snapshot.circuit}});
   else if(target==='s3-cpp')worker.postMessage({type:'run',session:228,project:p,artifact,circuit:snapshot.circuit});
   else worker.postMessage({type:'run',session:228,hex:artifact.hex,circuit:snapshot.circuit,adcChannels:target==='nano'?8:6,staticRamBytes:artifact.staticRamBytes});
  });
  const elapsedMs=performance.now()-start,stopAt=performance.now();await worker.terminate();const stopMs=performance.now()-stopAt;assert(stopMs<500);
  return {status:'pass',fault,elapsedMs,stopMs,observations,console:output,trace:lastFrame?.i2cTrace};
 }finally{await worker.terminate();}
}
const results:any[]=[];
try{
 for(const target of ['micropython','s3-cpp','uno','nano']as UrsTarget[])for(const variant of ['i2cBmp280','i2cOled32']){
  console.log(`Starting ${target}/${variant}`);
  const p=importProject(exportZip(await createUrsProject('i2cLevels',variant,target)),'URS18.zip');
  const normal=await run(p,target,variant),broken=structuredClone(p),c=broken.circuit as Circuit;
  c.wires=c.wires.filter(w=>w.id!=='i2cLevel_HV');
  const fault=await run(broken,target,variant,true),recovery=await run(p,target,variant,false,false);
  results.push({target,variant,build:manifest.build,status:'pass',normal,fault,recovery});
  writeFileSync(evidence+'/packaged-i2c-levels.json',JSON.stringify(results,null,2)+'\n');
  console.log(`Passed ${target}/${variant}: live change, missing HV, recovery`);
 }
}finally{globalThis.fetch=originalFetch;}
console.log(JSON.stringify({build:manifest.build,scenarios:results.length,workerRuns:results.length*3,status:'pass'}));
