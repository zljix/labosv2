import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {compileInteractive} from '../school/compiler/runner.mjs';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {UNO,NANO} from '../src/boards/profiles';
import {AVREngine} from '../src/runtime/avrEngine';
import {compileCircuit} from '../src/circuit/compile';
import {createS3Engine} from '../public/s3-engine.mjs';
import {wasmBytes} from '../public/s3-contract.mjs';
import {libraryManifest} from '../public/avr-contract.mjs';
const target=process.env.LAB_COMPILER_TARGET;
test('25A isolated source compiler: changed timing, repeated compilation and exact error line',{skip:!target,timeout:300000},async()=>{
 const s3=target==='s3-cpp',p=s3?s3ExampleProject('blink'):arduinoExampleProject('blink',target==='nano'?NANO:UNO),pin=s3?4:9;
 p.files['main.ino']=`#include <Bounce2.h>\nBounce2::Button button;\nvoid setup(){pinMode(${pin},OUTPUT);}\nvoid loop(){digitalWrite(${pin},HIGH);delay(731);digitalWrite(${pin},LOW);delay(269);}\n`;
 p.files['arduino-libraries.json']=libraryManifest([{name:'Bounce2',version:'2.72'}]);
 const options={root:process.cwd(),cli:process.env.LAB_ARDUINO_CLI,data:process.env.LAB_ARDUINO_DATA,clang:process.env.LAB_WASM_CXX,opt:process.env.LAB_WASM_OPT};
 const reports=[];
 for(let i=0;i<2;i++){const r=await compileInteractive(p,options);assert.equal(r.status,'compiled',JSON.stringify(r));reports.push({pass:i,durationMs:r.durationMs,toolchain:r.toolchain,bytes:r.artifact.wasmBytes??r.artifact.flashBytes});
  const events:any[]=[];
  if(s3){const e=await createS3Engine(wasmBytes(r.artifact.wasm),compileCircuit(p.circuit as any),(v:any)=>events.push(v),{fast:true});try{await e.run(2);}finally{e.stop();}assert(events.some(v=>v.type==='simulation'&&v.gpios[pin]?.level===0));assert(events.some(v=>v.type==='simulation'&&v.gpios[pin]?.level===1));}
  else{const e=new AVREngine(r.artifact.hex,compileCircuit(p.circuit as any,'avr'),v=>events.push(v),target==='nano'?8:6);const advance=(ms:number)=>{for(let left=ms*16000;left>0;left-=64000){e.runCycles(Math.min(64000,left));e.frame();}};try{advance(650);assert.equal(events.filter(v=>v.type==='simulation').at(-1).gpios[pin].level,1);advance(150);assert.equal(events.filter(v=>v.type==='simulation').at(-1).gpios[pin].level,0);advance(250);assert.equal(events.filter(v=>v.type==='simulation').at(-1).gpios[pin].level,1);}finally{e.dispose();}}
 }
 p.files['main.ino']='void setup(){\n broken syntax here;\n}\nvoid loop(){}\n';const bad=await compileInteractive(p,options);assert.equal(bad.status,'compile_error',JSON.stringify(bad));assert(bad.diagnostics.some((d:any)=>d.file==='main.ino'&&d.line===2));
 mkdirSync('docs/stage25a-evidence',{recursive:true});writeFileSync(`docs/stage25a-evidence/${target}.json`,JSON.stringify({target,reports,diagnostics:bad.diagnostics},null,2)+'\n');
});
