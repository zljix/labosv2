import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import {verifyLibraryFiles} from '../scripts/avr-compile.mjs';
import {UNO,NANO,S3} from '../src/boards/profiles';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {AVREngine} from '../src/runtime/avrEngine';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {checkCircuit} from '../src/circuit/netlist';
import {parseCircuit,type Circuit} from '../src/circuit/model';
import {peripheralCircuit} from '../src/circuit/peripheralExamples';
import {exportZip,importProject} from '../src/project/archive';
import {AVR_BUILD_FILE,AVR_LIBRARIES,validateArtifact,sha256,libraryManifest} from '../public/avr-contract.mjs';
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const fixtures=JSON.parse(readFileSync('verification/stage10a-fixtures.json','utf8'));
const keys=['aht10','oled','servo','regulator'] as const;
function open(key:typeof keys[number],board:typeof UNO|typeof NANO=UNO,edit?:(c:Circuit)=>void){
  const p=arduinoExampleProject(key,board);if(p.circuit.kind!=='editable')throw Error();edit?.(p.circuit);
  const a=artifacts[board][key],events:any[]=[],e=new AVREngine(a.hex,compileCircuit(p.circuit,'avr'),x=>events.push(x),board===NANO?8:6,a.staticRamBytes);
  return {p,e,events};
}
const text=(events:any[])=>events.filter(x=>x.type==='console').map(x=>x.text).join('');
const last=(events:any[])=>events.filter(x=>x.type==='simulation').at(-1) as SimulationFrame;
function advance(e:AVREngine,ms:number){e.runCycles(ms*16000);e.frame();}
function until(e:AVREngine,events:any[],predicate:()=>boolean,limit=5000){for(let ms=0;ms<limit;ms+=100){advance(e,100);if(predicate())return;}throw Error('Virtual timeout: '+text(events)+' '+JSON.stringify(last(events)?.diagnostics));}
function remove(c:Circuit,id:string,pin:string){c.wires=c.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));}

test('all eight new Uno/Nano builds match source, pinned library hashes and ZIP round-trip',async()=>{
  for(const board of [UNO,NANO] as const)for(const key of keys){
    const p=arduinoExampleProject(key,board),a=artifacts[board][key];await validateArtifact(p,a);
    assert(a.staticRamBytes<1024);p.files[AVR_BUILD_FILE]=JSON.stringify(a);
    const next=importProject(exportZip(p),'periferija.zip');await validateArtifact(next,JSON.parse(next.files[AVR_BUILD_FILE]));
    assert.deepEqual(next.circuit,p.circuit);assert.deepEqual(parseCircuit(p.circuit),p.circuit);
    assert.equal(checkCircuit(p.circuit as Circuit).diagnostics.length,0);
  }
  const lock=JSON.parse(readFileSync('vendor/arduino/lock.json','utf8'));
  for(const lib of AVR_LIBRARIES){const pinned=lock[lib.name];assert.equal(pinned.digest,lib.digest);assert.equal(await sha256(JSON.stringify(pinned.files)),lib.digest);for(const [path,hash]of Object.entries(pinned.files))assert.equal(await sha256(readFileSync('vendor/arduino/'+lib.name+'/'+path)),hash);}
});
for(const board of [UNO,NANO] as const)test(`${board}: real Wire + U8g2 GPIO pages + Timer1 Servo follow live hysteresis`,()=>{
  const {e,events}=open('regulator',board),start=performance.now();
  try{
    until(e,events,()=>text(events).includes('T=24.00 RH=50.00 Servo=0'));
    const initial=last(events),pixels=initial.displays.oled1.bytes;
    assert(pixels.some(Boolean));assert.equal(initial.servos.servo1.angle,0);
    assert(initial.i2cTrace.some(t=>t.bus===0&&t.address===0x38&&t.operation==='R'&&t.length===6));
    assert(initial.i2cTrace.some(t=>t.bus!==0&&t.address===0x3c&&t.operation==='W'&&t.bytes[0]===0x40));
    const observations=[];
    for(const [temperature,humidity,angle]of [[30,70,90],[27,60,90],[25,40,0]]){
      e.input({component:'aht1',temperature,humidity});
      until(e,events,()=>text(events).includes(`T=${temperature.toFixed(2)} RH=${humidity.toFixed(2)} Servo=${angle}`));
      const f=last(events);assert(Math.abs(f.servos.servo1.angle!-angle)<1);assert(Math.abs(f.sensors.aht1.measuredTemperature!-temperature)<.001);
      assert.notDeepEqual(f.displays.oled1.bytes,pixels);assert.equal(f.diagnostics.length,0);
      observations.push({temperature,humidity,servo:f.servos.servo1,pixelBytes:f.displays.oled1.bytes.filter(Boolean).length});
    }
    assert(e.cpu.data[0x81]&2,'Servo configures Timer1 prescaler /8');
    assert(last(events).avr!.memory!.minFreeToStatic>500);
    assert(e.cpu.data.length===2304);
    writeFileSync(`docs/stage10a-evidence/${board===UNO?'uno':'nano'}-regulator.json`,JSON.stringify({platform:process.platform,wallMs:performance.now()-start,virtualMs:e.cpu.cycles/16000,staticSRAM:artifacts[board].regulator.staticRamBytes,memory:last(events).avr!.memory,observations,console:text(events)},null,2)+'\n');
  }finally{e.dispose();}
});
test('AHT10 uses AVR virtual time for busy and data; missing pins/power/pullups never supply a sample',()=>{
  const ok=open('aht10');try{advance(ok.e,250);const f=last(ok.events);assert.equal(f.measurements.length,1);assert(f.i2cTrace.some(t=>t.operation==='R'&&t.bytes[0]===136));assert.match(text(ok.events),/T=24.00 C RH=50.00/);}finally{ok.e.dispose();}
  for(const pin of ['VCC','GND','SDA','SCL','pullups']){
    const {e,events}=open('aht10',UNO,c=>{if(pin==='pullups')c.components.find(p=>p.id==='aht1')!.properties.pullups=false;else remove(c,'aht1',pin);});
    try{advance(e,400);assert.equal(last(events).measurements.length,0,pin);assert.match(text(events),/provjeri spoj|nema mjerenja/);assert(last(events).diagnostics.length>0,pin);}finally{e.dispose();}
  }
});
test('OLED GPIO address, cable order and power affect real pixels; wrong address cannot paint text',()=>{
  for(const kind of ['address','swapped','VCC','pullups']){
    const {e,events}=open('oled',UNO,c=>{
      const p=c.components.find(p=>p.id==='oled1')!;
      if(kind==='address')p.properties.address=0x3d;
      else if(kind==='pullups')p.properties.pullups=false;
      else if(kind==='VCC')remove(c,'oled1','VCC');
      else for(const w of c.wires)for(const end of [w.from,w.to])if(end.component==='oled1'&&['SDA','SCL'].includes(end.pin))end.pin=end.pin==='SDA'?'SCL':'SDA';
    });
    try{advance(e,1400);assert(last(events).displays.oled1.bytes.every(b=>b===0),kind);}finally{e.dispose();}
  }
});
test('Servo position comes from edge width and period; absent power/ground/signal suppress position',()=>{
  const good=open('servo');try{
    advance(good.e,200);assert(good.events.some(x=>x.type==='simulation'&&x.servos.servo1.angle===0));
    advance(good.e,650);assert(Math.abs(last(good.events).servos.servo1.angle!-90)<1);
    advance(good.e,700);assert(Math.abs(last(good.events).servos.servo1.angle!-180)<1);
    assert(last(good.events).servos.servo1.freq!>49&&last(good.events).servos.servo1.freq!<51);
  }finally{good.e.dispose();}
  for(const pin of ['V+','GND','SIG']){const {e,events}=open('servo',UNO,c=>remove(c,'servo1',pin));try{advance(e,200);assert.equal(last(events).servos.servo1.angle,null,pin);}finally{e.dispose();}}
});
test('old 3.3 V profiles survive; domain mixing and shared AHT10 bus stay explicit failures',()=>{
  const old=peripheralCircuit();assert.equal(checkCircuit(old).diagnostics.length,0);assert(!old.components.some(p=>p.properties.moduleVoltage===5));
  const p=arduinoExampleProject('regulator',UNO),c=p.circuit as Circuit;
  c.components.find(p=>p.id==='aht1')!.properties.moduleVoltage=3.3;
  assert.throws(()=>compileCircuit(c,'avr'),/3,3 V/);
  c.components.find(p=>p.id==='aht1')!.properties.moduleVoltage=5;
  for(const w of c.wires)if(w.to.component==='oled1'&&w.to.pin==='SDA')w.from.pin='A4';else if(w.to.component==='oled1'&&w.to.pin==='SCL')w.from.pin='A5';
  assert.throws(()=>compileCircuit(c,'avr'),/zasebnu/);
  assert.throws(()=>parseCircuit({...c,components:c.components.map(p=>p.id==='oled1'?{...p,properties:{...p.properties,moduleVoltage:12}}:p)}));
});
test('SRAM monitor detects stack crossing static data; library changes reject the compiled program',async()=>{
  const p=arduinoExampleProject('regulator',UNO),a=artifacts[UNO].regulator,events:any[]=[];
  const e=new AVREngine(a.hex,compileCircuit(p.circuit as Circuit,'avr'),v=>events.push(v),6,a.staticRamBytes);
  try{e.cpu.SP=256+a.staticRamBytes-1;assert.throws(()=>e.runCycles(10),/SRAM/);}finally{e.dispose();}
  p.files['arduino-libraries.json']=libraryManifest([{name:'Servo',version:'1.2.2'}]);await assert.rejects(()=>validateArtifact(p,a),/bibliotekama/);
});
test('real U8g2 hardware I2C also paints pixels; software I2C master reads ACK and all six AHT bytes',async()=>{
  for(const key of ['hardwareOled','softwareAht']){
    const {project,artifact}=fixtures[key];await validateArtifact(project,artifact);const events:any[]=[];
    const e=new AVREngine(artifact.hex,compileCircuit(project.circuit,'avr'),v=>events.push(v),6,artifact.staticRamBytes);
    try{
      advance(e,1000);const f=last(events);assert.equal(f.diagnostics.length,0);
      if(key==='hardwareOled'){assert(f.displays.oled1.bytes.some(Boolean));assert(f.i2cTrace.some(t=>t.bus===0&&t.address===0x3c));}
      else {assert.match(text(events),/SOFT ACK=1/);assert.match(text(events),/BYTES=8,128,0,5,235,133,/);assert.equal(f.measurements.length,1);assert(f.i2cTrace.some(t=>t.bus!==0&&t.operation==='R'&&t.length===6));}
    }finally{e.dispose();}
  }
});
test('Servo and analogWrite share actual Timer1: unsupported simultaneous PWM is not idealised as healthy',async()=>{
  const {project,artifact}=fixtures.timerConflict;await validateArtifact(project,artifact);const events:any[]=[];
  const e=new AVREngine(artifact.hex,compileCircuit(project.circuit,'avr'),v=>events.push(v),6,artifact.staticRamBytes);
  try{advance(e,250);const f=last(events);assert(Math.abs(f.servos.servo1.angle!-90)<1);assert(f.leds.led1.brightness<.1);assert.notEqual(e.cpu.data[0x80]&3,1);assert.match(text(events),/share Timer1/);}finally{e.dispose();}
});
test('compiler library verification rejects extra source files and symbolic links as well as edited bytes',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'lab-library-test-'));
  const pinned={files:{'header.h':await sha256('original\n')}};
  try{
    await writeFile(join(directory,'header.h'),'original\n');await verifyLibraryFiles(directory,pinned);
    await writeFile(join(directory,'extra.cpp'),'void inserted() {}');await assert.rejects(()=>verifyLibraryFiles(directory,pinned),/popis/);await rm(join(directory,'extra.cpp'));
    await writeFile(join(directory,'header.h'),'edited\n');await assert.rejects(()=>verifyLibraryFiles(directory,pinned),/Izmijenjena/);
    await rm(join(directory,'header.h'));await symlink('/dev/null',join(directory,'header.h'));await assert.rejects(()=>verifyLibraryFiles(directory,pinned),/poveznica/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('production AVR Worker executes the integrated Nano program, accepts live input and stops promptly',async()=>{
  const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);
  const p=arduinoExampleProject('regulator',NANO),a=artifacts[NANO].regulator,events:any[]=[];
  const worker=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
  let pending:{check:()=>boolean;ok:()=>void;bad:(e:Error)=>void}|undefined;
  const wait=(check:()=>boolean)=>new Promise<void>((ok,bad)=>{if(check()){ok();return;}const timer=setTimeout(()=>{pending=undefined;bad(Error('Production peripheral Worker timeout: '+text(events)));},15000);pending={check,ok:()=>{clearTimeout(timer);pending=undefined;ok();},bad:e=>{clearTimeout(timer);pending=undefined;bad(e);}};});
  worker.on('message',e=>{events.push(e);if(e.type==='error')pending?.bad(Error(e.message));else if(pending?.check())pending.ok();});worker.on('error',e=>pending?.bad(e));
  try{
    worker.postMessage({type:'run',session:77,hex:a.hex,circuit:compileCircuit(p.circuit as Circuit,'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});
    await wait(()=>text(events).includes('T=24.00 RH=50.00 Servo=0'));
    worker.postMessage({type:'input',session:77,component:'aht1',temperature:30,humidity:70});
    await wait(()=>text(events).includes('T=30.00 RH=70.00 Servo=90'));
    assert(Math.abs(last(events).servos.servo1.angle!-90)<1);assert.equal(last(events).avr!.memory!.staticBytes,911);
    const at=performance.now();await worker.terminate();const stopMs=performance.now()-at;assert(stopMs<500);
    writeFileSync('docs/stage10a-evidence/production-worker.json',JSON.stringify({version:manifest.version,build:manifest.build,board:NANO,console:text(events),memory:last(events).avr!.memory,stopMs,stopLimitMs:500,scope:'Node/Linux production bundle Worker; not school-PC timing'},null,2)+'\n');
  }finally{await worker.terminate();}
});
