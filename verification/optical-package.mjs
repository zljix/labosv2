// Exact release-relative MP/S3/AVR Workers, not development imports.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {s3ExampleProject} from '../src/runtime/s3Examples.ts';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples.ts';
import {opticalExamples,opticalCircuit} from '../src/circuit/max30102Examples.ts';
import {compileCircuit} from '../src/circuit/compile.ts';
import {UNO,NANO} from '../src/boards/profiles.ts';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),release=`dist/app/${manifest.build}`;
const s3=JSON.parse(readFileSync(release+'/s3-examples.json','utf8')),avr=JSON.parse(readFileSync(release+'/avr-examples.json','utf8'));
const avrFile=manifest.files.find(f=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(avrFile);
const results=[];
for(const [kind,board]of [['mp'],['s3'],['avr',UNO],['avr',NANO]])for(const key of ['opticalFrequency','opticalOverflow']){
 const p=kind==='s3'?s3ExampleProject(key):kind==='avr'?arduinoExampleProject(key,board):null;
 const path=kind==='mp'?resolve(release+'/worker.mjs'):kind==='s3'?resolve(release+'/s3-worker.mjs'):resolve('dist'+avrFile.url);
 const w=new Worker(new URL('./sd-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(path).href}});
 let output='',frame,changed=false;const start=performance.now();
 try{
  await new Promise((done,reject)=>{
   const timer=setTimeout(()=>reject(Error(kind+' '+key+' timeout '+output.slice(-600))),30000);
   w.on('error',e=>{clearTimeout(timer);reject(e);});
   w.on('message',e=>{
    if(e.type==='error'){clearTimeout(timer);reject(Error(e.message));return;}if(e.type==='console')output+=e.text;if(e.type==='simulation')frame=e;
    const optical=frame?.optical?.optical1;
    if(key==='opticalFrequency'&&!changed&&/FREQ=7[0-5]/.test(output)){changed=true;w.postMessage({type:'input',session:201,component:'optical1',opticalRate:120});}
    const good=optical?.powered&&(key==='opticalFrequency'?changed&&/FREQ=1[12][0-9]/.test(output)&&optical.readings.length>0:output.includes('FIFO RECOVERED')&&optical.dropped>0);
    if(good){clearTimeout(timer);done();}
   });
   const circuit=compileCircuit(kind==='mp'?opticalCircuit(key):p.circuit,kind==='avr'?'avr':'micropython');
   if(kind==='mp')w.postMessage({type:'run',session:201,code:opticalExamples[key].code,machine:readFileSync(release+'/machine.py','utf8'),files:{'lab_max30102.py':readFileSync(release+'/drivers/lab_max30102.py','utf8')},config:{circuit}});
   else if(kind==='s3')w.postMessage({type:'run',session:201,project:p,artifact:s3[key],circuit});
   else w.postMessage({type:'run',session:201,hex:avr[board][key].hex,circuit,adcChannels:board===NANO?8:6,staticRamBytes:avr[board][key].staticRamBytes});
  });
  const observationMs=performance.now()-start,at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);assert.equal(frame.diagnostics.filter(d=>d.severity==='error').length,0);
  results.push({kind,key,board:board??'esp32-s3',status:'pass',build:manifest.build,observationMs,stopMs,console:output,optical:frame.optical.optical1});
 }finally{await w.terminate();}
}
writeFileSync('docs/stage20-evidence/packaged-optical.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({kind,key,board,status,observationMs,stopMs})=>({kind,key,board,status,observationMs,stopMs}))));
