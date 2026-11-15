// Run all eight URS17 routes in the exact versioned Workers in the final dist.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import {prepareRun} from '../src/runtime/adapter';
import {buildFile} from '../public/arduino-contract.mjs';
import {exportZip,importProject} from '../src/project/archive';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),release=resolve('dist/app/'+manifest.build);
const avr=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(avr);
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>{const p=String(input).replace(/^\/app\/[^/]+\//,'');if(p.startsWith('/')||p.includes('..'))throw Error('Nedopušten testni resurs');return new Response(readFileSync(resolve(release,p)));};
const results:any[]=[];
try{
 for(const target of ['micropython','s3-cpp','uno','nano']as UrsTarget[])for(const mode of ['input','output']as const){
  console.log('Starting '+target+'/'+mode);
  const p=importProject(exportZip(await createUrsProject('levels',mode==='input'?'levelInput':'levelOutput',target)),'URS17.zip'),snapshot=prepareRun(p),artifact=p.language==='arduino-cpp'?JSON.parse(p.files[buildFile(p)]):null;
  const path=target==='micropython'?release+'/worker.mjs':target==='s3-cpp'?release+'/s3-worker.mjs':resolve('dist'+avr.url);
  const w=new Worker(new URL('./sd-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(path).href}});
  let output='',phase=0,lastFrame:any;const at=performance.now(),observations:any[]=[],s3=target==='micropython'||target==='s3-cpp';
  const expected=[0,1,0];
  try{
   await new Promise<void>((done,reject)=>{
    const timer=setTimeout(()=>reject(Error(`${target}/${mode} URS17 timeout: ${output.slice(-800)}`)),20000);
    const fail=(e:Error)=>{clearTimeout(timer);mkdirSync('docs/stage22g-evidence',{recursive:true});writeFileSync('docs/stage22g-evidence/worker-failure.json',JSON.stringify({target,mode,output,frame:lastFrame,message:e.message},null,2)+'\n');reject(Error(target+'/'+mode+': '+e.message));};
    w.on('error',fail);
    w.on('message',e=>{
     if(e.type==='simulation')lastFrame=e;
     if(e.type==='error'){fail(Error(e.message));return;}
     if(e.type==='console')output=(output+e.text).slice(-12000);
     if(e.type!=='simulation'||phase>=3)return;
     const d=e.levelShifters?.level1,led=e.leds?.led1,ch=d?.channels[0];
     if(!d?.powered||ch?.level==null||!led)return;
     if(e.diagnostics.some((d:any)=>d.severity==='error')){fail(Error(JSON.stringify(e.diagnostics)));return;}
     const on=led.currentMa>.5?1:0;
     if(on!==expected[phase])return;
     if(mode==='input'&&ch.level!==(phase===1?0:1))return;
     if(mode==='output'&&ch.level!==on)return;
     const highInput=mode==='input'?(s3?5:3.3):(s3?3.3:5),highOutput=mode==='input'?(s3?3.3:5):(s3?5:3.3);
     try{assert(Math.abs(ch.inputVolts-(ch.level?highInput:0))<.02);assert(Math.abs(ch.outputVolts-(ch.level?highOutput:0))<.02);}catch(err){fail(err as Error);return;}
     observations.push({phase,timeMs:e.timeMs,direction:d.direction,inputVolts:ch.inputVolts,outputVolts:ch.outputVolts,logic:ch.level,ledCurrentMa:led.currentMa});
     phase++;if(phase===3){clearTimeout(timer);done();}else if(mode==='input')w.postMessage({type:'input',session:227,component:'sw1',pressed:phase===1});
    });
    if(target==='micropython')w.postMessage({type:'run',session:227,code:snapshot.source,machine:readFileSync(release+'/machine.py','utf8'),files:snapshot.files,config:{circuit:snapshot.circuit}});
    else if(target==='s3-cpp')w.postMessage({type:'run',session:227,project:p,artifact,circuit:snapshot.circuit});
    else w.postMessage({type:'run',session:227,hex:artifact.hex,circuit:snapshot.circuit,adcChannels:target==='nano'?8:6,staticRamBytes:artifact.staticRamBytes});
   });
   const observationMs=performance.now()-at,stopAt=performance.now();await w.terminate();const stopMs=performance.now()-stopAt;assert(stopMs<500);
   results.push({target,mode,status:'pass',build:manifest.build,observationMs,stopMs,observations,console:output});
  }finally{await w.terminate();}
 }
}finally{globalThis.fetch=originalFetch;}
mkdirSync('docs/stage22g-evidence',{recursive:true});writeFileSync('docs/stage22g-evidence/packaged-levels.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({target,mode,status,build,observationMs,stopMs})=>({target,mode,status,build,observationMs,stopMs}))));
