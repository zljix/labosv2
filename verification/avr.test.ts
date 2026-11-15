import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {makePart} from '../src/circuit/model';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {UNO,NANO} from '../src/boards/profiles';
import {arduinoExampleProject,type ArduinoExample} from '../src/runtime/arduinoExamples';
import {compileCircuit} from '../src/circuit/compile';
import {AVREngine} from '../src/runtime/avrEngine';
import {AVRSession} from '../src/runtime/avrSession';
import {clone,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {AVR_BUILD_FILE,inputHash,parseHex,sha256,validateArtifact} from '../public/avr-contract.mjs';
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const fixtureArtifacts=JSON.parse(readFileSync('verification/avr-fixtures.json','utf8'));
function open(key:ArduinoExample,board:typeof UNO|typeof NANO=UNO){
  const p=arduinoExampleProject(key,board),events:any[]=[];
  const e=new AVREngine(artifacts[board][key].hex,compileCircuit(p.circuit as any,'avr'),x=>events.push(x),board===NANO?8:6);
  return {p,e,events};
}
function advance(e:AVREngine,ms:number){for(let left=ms*16000;left>0;left-=64000){e.runCycles(Math.min(64000,left));e.frame();}}
const text=(events:any[])=>events.filter(x=>x.type==='console').map(x=>x.text).join('');
const frame=(events:any[])=>events.filter(x=>x.type==='simulation').at(-1);

test('six real Arduino builds match exact sources and survive full project ZIP import',async()=>{
  for(const board of [UNO,NANO] as const)for(const key of ['blink','button','adc'] as ArduinoExample[]){
    const p=arduinoExampleProject(key,board),a=artifacts[board][key];await validateArtifact(p,a);
    assert(a.flashBytes>100&&a.staticRamBytes>0&&a.staticRamBytes<=2048);
    p.files[AVR_BUILD_FILE]=JSON.stringify(a);const imported=importProject(exportZip(p),'Arduino.zip');await validateArtifact(imported,JSON.parse(imported.files[AVR_BUILD_FILE]));
  }
});
test('source, header and target edits reject stale builds; notes and rewiring retain the code binding',async()=>{
  const p=arduinoExampleProject('blink',UNO),a=artifacts[UNO].blink,hash=await inputHash(p);
  for(const change of [(n:any)=>n.files['main.ino']+='\n// novo', (n:any)=>n.files['helper.h']='#define X 1', (n:any)=>{n.board.id=NANO;n.target.fqbn='arduino:avr:nano:cpu=atmega328';}]){
    const next=clone(p);change(next);await assert.rejects(()=>validateArtifact(next,a));
  }
  const next=clone(p);next.title='Drugi naziv';next.files['biljeske.txt']='Živio';next.circuit.wires=[];assert.equal(await inputHash(next),hash);
  await assert.rejects(()=>validateArtifact(p,{...a,toolchain:{...a.toolchain,cli:'0'}}));
});
test('corrupt hashes, HEX checksums, ranges, duplicate records and missing EOF are refused',async()=>{
  const p=arduinoExampleProject('blink',UNO),a=artifacts[UNO].blink;
  await assert.rejects(()=>validateArtifact(p,{...a,hex:a.hex.replace(/^:10/,':11')}));
  const broken=a.hex.replace(/^:10/,':11'),brokenHash=await sha256(broken);await assert.rejects(()=>validateArtifact(p,{...a,hex:broken,hexHash:brokenHash}));
  const rows=a.hex.trim().split(/\r?\n/);assert.throws(()=>parseHex(rows.slice(0,-1).join('\n')));
  assert.throws(()=>parseHex(rows[0]+'\n'+a.hex));assert.throws(()=>parseHex(a.hex,20));assert.throws(()=>parseHex(a.hex+'\n:00000001FF'));
});
for(const board of [UNO,NANO] as const){
  test(`${board}: compiled delay/millis drives physical D9 and D13 with 2 KiB SRAM`,()=>{
    const {e,events}=open('blink',board);try{advance(e,650);assert.equal(e.cpu.data.length,2304);const s=text(events);assert.match(s,/LED=1 ms=0/);assert.match(s,/LED=0 ms=19[89]/);assert.match(s,/LED=1 ms=40[01]/);const frames=events.filter(x=>x.type==='simulation');assert(frames.some(x=>x.leds.led1.currentMa>4.5));assert(frames.some(x=>x.leds.led1.currentMa===0));assert(frames.some(x=>x.gpios['13'].level===1));assert(frames.some(x=>x.gpios['13'].level===0));}finally{e.dispose();}
  });
  test(`${board}: live INPUT_PULLUP button and UART receive execute the student's program`,()=>{
    const {e,events}=open('button',board);try{
      advance(e,100);assert.match(text(events),/LED=0/);e.input({component:'sw1',pressed:true});advance(e,40);assert(frame(events).leds.led1.currentMa>4.5);
      e.input({component:'sw1',pressed:false});advance(e,40);assert.equal(frame(events).leds.led1.currentMa,0);
      e.input({serial:'1'});advance(e,50);assert.match(text(events),/RX=1/);assert(frame(events).leds.led1.currentMa>4.5);
      e.input({serial:'0b'});advance(e,50);assert.match(text(events),/RX=0/);assert.match(text(events),/RX=b/);assert.equal(frame(events).leds.led1.currentMa,0);
    }finally{e.dispose();}
  });
  test(`${board}: analogRead quantisation and actual Timer1 PWM follow the potentiometer`,()=>{
    const {e,events}=open('adc',board);try{
      advance(e,300);assert.match(text(events),/ADC=51[12] PWM=12[78]/);const half=frame(events);assert(half.leds.led1.currentMa>2.15&&half.leds.led1.currentMa<2.5);assert(half.gpios['9'].freq>485&&half.gpios['9'].freq<495);
      e.input({component:'pot1',position:0});advance(e,200);assert.match(text(events),/ADC=0 PWM=0/);assert.equal(frame(events).leds.led1.currentMa,0);
      e.input({component:'pot1',position:100});advance(e,200);assert.match(text(events),/ADC=1023 PWM=255/);assert(frame(events).leds.led1.currentMa>4.5);
    }finally{e.dispose();}
  });
}
test('Nano A6/A7 are real ADC channels without digital GPIO aliases',()=>{
  const p=arduinoExampleProject('adc',NANO);if(p.circuit.kind!=='editable')throw Error();
  p.circuit.wires.find(w=>w.from.pin==='A0')!.from.pin='A6';const events:any[]=[];
  const e=new AVREngine(fixtureArtifacts.nanoA6.hex,compileCircuit(p.circuit,'avr'),x=>events.push(x),8);
  try{advance(e,200);assert.match(text(events),/ADC=51[12]/);assert.equal(frame(events).gpios['20']?.mode,undefined);}finally{e.dispose();}
});
test('real external interrupt runs on falling edge; TWI NACK and SPI idle byte come from peripherals',()=>{
  const p=arduinoExampleProject('button',UNO),events:any[]=[];
  const e=new AVREngine(fixtureArtifacts.protocols.hex,compileCircuit(p.circuit as any,'avr'),x=>events.push(x));
  try{
    advance(e,120);assert.match(text(events),/TWI=2/);assert.match(text(events),/SPI=255/);assert(e.busTrace.some(x=>x.kind==='TWI'&&x.operation==='address-write'&&x.value===56));assert(e.busTrace.some(x=>x.kind==='SPI'&&x.value===165));
    e.input({component:'sw1',pressed:true});advance(e,40);assert.match(text(events),/IRQ=1/);e.input({component:'sw1',pressed:false});advance(e,40);e.input({component:'sw1',pressed:true});advance(e,40);assert.match(text(events),/IRQ=2/);
  }finally{e.dispose();}
});
test('a runtime output conflict stops before electrical results are trusted',()=>{
  const p=arduinoExampleProject('blink',UNO);if(p.circuit.kind!=='editable')throw Error();
  p.circuit.wires.push({id:'bad',from:{component:'board',pin:'D9'},to:{component:'board',pin:'GND'},color:'#123456',points:[]});
  const e=new AVREngine(artifacts[UNO].blink.hex,compileCircuit(p.circuit,'avr'),()=>{});
  try{assert.throws(()=>advance(e,20),/Sukob/);}finally{e.dispose();}
});
test('force Stop terminates a real busy Worker and rejects its delayed messages; Reset starts fresh',async()=>{
  class Thread {
    onmessage:any;onerror:any;worker:Worker;
    constructor(){this.worker=new Worker(new URL('./avr-node-worker.mjs',import.meta.url),{execArgv:['--import','tsx']});this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',e=>this.onerror?.(e));}
    postMessage(data:any){this.worker.postMessage(data);}terminate(){return this.worker.terminate();}
  }
  const p=arduinoExampleProject('blink',UNO),events:any[]=[],workers:Thread[]=[];
  const factory=()=>{const w=new Thread();workers.push(w);return w as unknown as globalThis.Worker;};
  const wait=async(predicate:()=>boolean)=>{const start=performance.now();while(!predicate()){if(performance.now()-start>5000)throw Error('Worker timeout: '+JSON.stringify(events.filter(e=>e.type==='error')));await new Promise(r=>setTimeout(r,10));}};
  const session=new AVRSession(factory,fixtureArtifacts.busy.hex,compileCircuit(p.circuit as any,'avr'),6,e=>events.push(e));
  try{
    await wait(()=>events.some(e=>e.type==='simulation'&&e.leds.led1.currentMa>4.5));const start=performance.now();session.stop();const stopped=performance.now()-start;assert(stopped<500);writeFileSync('docs/stage8-evidence/stop.json',JSON.stringify({platform:process.platform,engine:process.version,forceStopMs:stopped,limitMs:500,scope:'Node Worker termination call; no school PC claim'},null,2)+'\n');const count=events.length;
    await new Promise(r=>setTimeout(r,60));assert.equal(events.length,count);
    const resetEvents:any[]=[],fresh=new AVRSession(factory,artifacts[UNO].blink.hex,compileCircuit(p.circuit as any,'avr'),6,e=>resetEvents.push(e));
    try{await wait(()=>text(resetEvents).includes('LED=1 ms=0'));}finally{fresh.stop();}
  }finally{session.stop();await Promise.all(workers.map(w=>w.worker.terminate()));}
});

 test('all six PWM pins use three real timers; UART output decodes UTF-8 across frames',()=>{
   const p=arduinoExampleProject('blink',UNO),events:any[]=[],e=new AVREngine(fixtureArtifacts.pwmTimers.hex,compileCircuit(p.circuit as any,'avr'),x=>events.push(x));
   try{advance(e,150);assert.match(text(events),/Živio PWM/);const f=frame(events);for(const n of [3,5,6,9,10,11]){const g=f.gpios[n];assert.equal(g.mode,'PWM');assert(Math.abs(g.duty/65535-.25)<.04);assert(n===5||n===6?g.freq>970&&g.freq<980:g.freq>485&&g.freq<495);}}finally{e.dispose();}
 });
test('production offline package includes AVR examples, toolkit and a runnable compiled Worker',async()=>{
  const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8'));
  const asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);
  assert(manifest.files.some((f:any)=>f.url===`/app/${manifest.build}/avr-examples.json`));
  assert(manifest.files.some((f:any)=>f.url==='/arduino-development-bridge.zip'));
  for(const board of [UNO,NANO] as const){
    const p=arduinoExampleProject('adc',board),events:any[]=[];
    const worker=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
    try{
      const done=new Promise<void>((ok,bad)=>{const timer=setTimeout(()=>bad(Error('Production AVR timeout')),5000);worker.on('error',e=>{clearTimeout(timer);bad(e);});worker.on('message',e=>{events.push(e);if(e.type==='error'){clearTimeout(timer);bad(Error(e.message));}if(e.type==='console'&&text(events).includes('ADC=512 PWM=128')){clearTimeout(timer);ok();}});});
      worker.postMessage({type:'run',session:7,hex:artifacts[board].adc.hex,circuit:compileCircuit(p.circuit as any,'avr'),adcChannels:board===NANO?8:6});await done;
    }finally{await worker.terminate();}
  }
});
