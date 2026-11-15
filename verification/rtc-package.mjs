// Exercise shipped Worker bytes and release-relative module imports.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {s3ExampleProject} from '../src/runtime/s3Examples.ts';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples.ts';
import {compileCircuit} from '../src/circuit/compile.ts';
import {UNO,NANO} from '../src/boards/profiles.ts';
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8'));
const s3=JSON.parse(readFileSync(`dist/app/${manifest.build}/s3-examples.json`,'utf8')),avr=JSON.parse(readFileSync(`dist/app/${manifest.build}/avr-examples.json`,'utf8'));
const avrFile=manifest.files.find(f=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(avrFile);
const results=[];
for(const [kind,key,board]of [['s3','rtcRead'],['s3','rtcSet'],['s3','rtcMemory'],['s3','rtcClock'],['avr','rtcMemory',UNO],['avr','rtcMemory',NANO]]){
 const p=kind==='s3'?s3ExampleProject(key):arduinoExampleProject(key,board),a=kind==='s3'?s3[key]:avr[board][key];
 const w=new Worker(new URL(kind==='s3'?'./s3-built-worker.mjs':'./avr-built-worker.mjs',import.meta.url),{workerData:{path:kind==='s3'?resolve(`dist/app/${manifest.build}/s3-worker.mjs`):pathToFileURL(resolve('dist'+avrFile.url)).href}});
 let output='',frame,powerPhase=0;const start=performance.now();
 try{
  await new Promise((done,reject)=>{
   const timer=setTimeout(()=>reject(Error('RTC Worker timeout '+kind+' '+key+' '+output.slice(-500))),20000);
   w.on('error',e=>{clearTimeout(timer);reject(e);});
   w.on('message',e=>{
    if(e.type==='error'){clearTimeout(timer);reject(Error(e.message));return;}
    if(e.type==='console')output+=e.text;if(e.type==='simulation')frame=e;
    if(key==='rtcRead'&&e.type==='console'){
     if(powerPhase===0&&output.includes('RTC 2026')){powerPhase=1;w.postMessage({type:'input',session:91,component:'rtc1',rtcMainPower:false});}
     else if(powerPhase===1&&output.includes('RTC ERROR')){powerPhase=2;w.postMessage({type:'input',session:91,component:'rtc1',rtcMainPower:true});}
    }
    const good=frame?.rtcDevices?.rtc1?.valid&&frame.rtcDevices.rtc1.received>0&&(key==='rtcSet'?output.includes('2028-2-29 0:0:0'):key==='rtcMemory'?output.includes('RTC RAM=1 WP=1'):key==='rtcClock'?frame.tmDisplays?.tm1?.on&&output.includes('RTC 2026'):/RTC ERROR[\s\S]*RTC 2026/.test(output));
    if(good){clearTimeout(timer);done();}
   });
   const circuit=compileCircuit(p.circuit,kind==='s3'?'micropython':'avr');
   w.postMessage(kind==='s3'?{type:'run',session:91,project:p,artifact:a,circuit}:{type:'run',session:91,hex:a.hex,circuit,adcChannels:board===NANO?8:6,staticRamBytes:a.staticRamBytes});
  });
  const observationMs=performance.now()-start,at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);
  assert.equal(frame.rtcDevices.rtc1.errors,0);assert.equal(frame.diagnostics.filter(d=>d.severity==='error').length,0);
  results.push({kind,key,board:board??p.board.id,status:'pass',build:manifest.build,observationMs,stopMs,console:output,rtc:frame.rtcDevices.rtc1,display:frame.tmDisplays?.tm1});
 }finally{await w.terminate();}
}
writeFileSync('docs/stage19a-evidence/packaged-rtc.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({kind,key,board,status,observationMs,stopMs})=>({kind,key,board,status,observationMs,stopMs}))));
