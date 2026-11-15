// Exercise the exact release-relative Worker, Python drivers and compiled bytes.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {s3ExampleProject} from '../src/runtime/s3Examples.ts';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples.ts';
import {sdExamples,sdCircuit} from '../src/circuit/sdExamples.ts';
import {compileCircuit} from '../src/circuit/compile.ts';
import {UNO,NANO} from '../src/boards/profiles.ts';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),release=`dist/app/${manifest.build}`;
const s3=JSON.parse(readFileSync(release+'/s3-examples.json','utf8')),avr=JSON.parse(readFileSync(release+'/avr-examples.json','utf8'));
const avrFile=manifest.files.find(f=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(avrFile);
const results=[];
for(const [kind,key,board]of [['mp','sdFiles'],['mp','sdLogger'],['s3','sdFiles'],['s3','sdLogger'],['avr','sdLogger',UNO],['avr','sdLogger',NANO]]){
 const p=kind==='s3'?s3ExampleProject(key):kind==='avr'?arduinoExampleProject(key,board):null;
 const path=kind==='mp'?resolve(release+'/worker.mjs'):kind==='s3'?resolve(release+'/s3-worker.mjs'):resolve('dist'+avrFile.url);
 const w=new Worker(new URL('./sd-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(path).href}});
 let output='',frame;const start=performance.now();
 try{
  await new Promise((done,reject)=>{
   const timer=setTimeout(()=>reject(Error(kind+' '+key+' timeout '+output.slice(-600))),60000);
   w.on('error',e=>{clearTimeout(timer);reject(e);});
   w.on('message',e=>{if(e.type==='error'){clearTimeout(timer);reject(Error(e.message));return;}if(e.type==='console')output+=e.text;if(e.type==='simulation')frame=e;const sd=frame?.sdCards?.sd1;
    const good=sd?.initialized&&sd.writes>0&&sd.errors===0&&(key==='sdFiles'?output.includes('SD FILE BYTES=28')&&sd.files.some(f=>f.name==='LAB.TXT'&&f.size===28):/SD CSV 1,2026-/.test(output)&&sd.files.some(f=>f.name==='LOG.CSV'&&f.size>50));
    if(good){clearTimeout(timer);done();}
   });
   const circuit=compileCircuit(kind==='mp'?sdCircuit(key):p.circuit,kind==='avr'?'avr':'micropython');
   if(kind==='mp'){const files=Object.fromEntries(['lab_sdcard.py','lab_fat16.py','lab_ds1302.py'].map(n=>[n,readFileSync(release+'/drivers/'+n,'utf8')]));w.postMessage({type:'run',session:191,code:sdExamples[key].code,machine:readFileSync(release+'/machine.py','utf8'),files,config:{circuit}});}
   else if(kind==='s3')w.postMessage({type:'run',session:191,project:p,artifact:s3[key],circuit});
   else w.postMessage({type:'run',session:191,hex:avr[board][key].hex,circuit,adcChannels:board===NANO?8:6,staticRamBytes:avr[board][key].staticRamBytes});
  });
  const observationMs=performance.now()-start,at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);assert.equal(frame.diagnostics.filter(d=>d.severity==='error').length,0);
  results.push({kind,key,board:board??'esp32-s3',status:'pass',build:manifest.build,observationMs,stopMs,console:output,sd:frame.sdCards.sd1});
 }finally{await w.terminate();}
}
writeFileSync('docs/stage19b-evidence/packaged-sd.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({kind,key,board,status,observationMs,stopMs})=>({kind,key,board,status,observationMs,stopMs}))));
