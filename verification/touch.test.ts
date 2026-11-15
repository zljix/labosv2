import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {touchCircuit,touchExamples,type TouchExample} from '../src/circuit/touchExamples';
import {cppXPT2046} from '../src/circuit/touchDriver';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {checkCircuit} from '../src/circuit/netlist';
import {parseCircuit,terminals,type Circuit} from '../src/circuit/model';
import {S3,UNO,NANO} from '../src/boards/profiles';
import {newProject,parseProject} from '../src/project/model';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {validateArtifact} from '../public/avr-contract.mjs';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {Session} from '../dist/session.mjs';
const keys=Object.keys(touchExamples)as TouchExample[];
const frame=(events:any[])=>events.filter(e=>e.type==='simulation').at(-1)as SimulationFrame;
const files=Object.fromEntries(['lab_ili9341.py','lab_xpt2046.py'].map(n=>[n,readFileSync('public/drivers/'+n,'utf8')]));
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
mkdirSync('docs/stage17b-evidence',{recursive:true});
function evidence(name:string,output:string,s:SimulationFrame,extra={}){
 const {pixels,...tft}=s.tfts!.tft1;
 writeFileSync('docs/stage17b-evidence/'+name+'.json',JSON.stringify({console:output,touch:s.touches,tft,pixels:{length:pixels.length,nonzero:pixels.filter(Boolean).length,sha256:createHash('sha256').update(JSON.stringify(pixels)).digest('hex')},leds:s.leds,diagnostics:s.diagnostics,memory:s.avr?.memory,...extra},null,2)+'\n');
}
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
const python=(key:TouchExample,code:string=touchExamples[key].code)=>new Session(factory,readFileSync('public/machine.py','utf8'),code,{circuit:compileCircuit(touchCircuit(key))},()=>{},files);
const ready=async(s:Session,mark:string)=>{await s.wait((s:Session)=>s.text.includes(mark)||s.status==='error',60000);assert.notEqual(s.status,'error',s.text+' '+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));};
const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function pyTouch(s:Session,x:number,y:number,down=true,pressure=50){s.input({component:'touch1',touchX:x,touchY:y,touchDown:down,touchPressure:pressure});await delay(150);}
function fixture(edit=(c:Circuit)=>{}){
 const c=touchCircuit('touchRaw');edit(c);let now=200000;const events:any[]=[];
 const h=createCircuitHost((e:any)=>{events.push(e);if(events.length>12)events.shift();},{circuit:compileCircuit(c),logicVoltage:3.3,nowUs:()=>now,manualPublish:true});
 for(const [p,v]of [[10,1],[7,1],[9,0],[8,1],[12,0],[11,0]])h.mode(p,1,0,v);h.mode(13,0);h.mode(2,0);
 const set=(p:number,v:number)=>h.write(p,v),bus={sck:12,mosi:11,miso:13,freq:1000000,mode:0,firstbit:0};
 const xfer=(tx:number[],override={})=>Array.from(h.spiTransfer({...bus,...override},Uint8Array.from(tx)))as number[];
 const read=(command:number)=>{set(7,0);const rx=xfer([command,0,0]);set(7,1);return (rx[1]*256+rx[2])>>3;};
 const input=(data={touchDown:true,touchX:120,touchY:160,touchPressure:50})=>h.input({component:'touch1',...data});
 const snap=()=>{h.flush();return frame(events);};
 return {c,h,set,xfer,read,input,snap,wait:(us:number)=>{now+=us;}};
}
test('four examples on S3/Uno/Nano preserve exact drivers, sources, inputs and artifacts through JSON/ZIP/IDE',async()=>{
 assert.equal(cppXPT2046,readFileSync('public/drivers/lab_xpt2046.h','utf8'));
 for(const b of [S3,UNO,NANO]as const)for(const key of keys){
  const p=b===S3?newProject(touchExamples[key].code,touchExamples[key].title):arduinoExampleProject(key,b);p.circuit=touchCircuit(key,b);if(b===S3)Object.assign(p.files,files);
  assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.deepEqual(checkCircuit(p.circuit).diagnostics,[]);
  assert.deepEqual(importProject(exportZip(p),'touch.zip'),parseProject(p));
  if(b!==S3){assert.equal(p.files['lab_xpt2046.h'],cppXPT2046);await validateArtifact(p,artifacts[b][key]);assert(exportSketch(p).length>0);assert(artifacts[b][key].staticRamBytes<600);}
 }
});
test('raw 12-bit X/Y endpoints, Z1/Z2, leading null/trailing zeros and split transfers are actual SPI bytes',()=>{
 const f=fixture();try{f.input({touchDown:true,touchX:239,touchY:319,touchPressure:100});assert.deepEqual([f.read(0xd0),f.read(0x90),f.read(0xb0),f.read(0xc0)],[3900,3850,2000,2595]);
 f.set(7,0);assert.deepEqual(f.xfer([0xd0]),[0]);const [hi]=f.xfer([0]),[lo]=f.xfer([0]);assert.equal((hi*256+lo)>>3,3900);assert.equal(hi&128,0);assert.equal(lo&7,0);f.set(7,1);
 f.input({touchDown:true,touchX:0,touchY:0,touchPressure:0});assert.equal(f.read(0xd0),200);assert.equal(f.read(0x90),250);assert.equal(f.read(0xb0),0);assert.equal(f.read(0xc0),4095);assert.equal(f.snap().tfts!.tft1.written,0);
 }finally{f.h.dispose();}
});
test('byte-aligned pipelining returns the previous conversion while a new command starts',()=>{
 const f=fixture();try{f.input();f.set(7,0);const rx=f.xfer([0xb1,0,0xc1,0,0xd0,0,0]);f.set(7,1);assert.equal((rx[1]*256+rx[2])>>3,1000);assert.equal((rx[3]*256+rx[4])>>3,3345);assert.equal((rx[5]*256+rx[6])>>3,2058);assert.equal(f.snap().touches!.touch1.conversions,3);}finally{f.h.dispose();}
});
test('release has zero pressure score and active LOW PENIRQ follows touch and PD0',()=>{
 const f=fixture();try{assert.equal(f.h.read(2),1);f.input();assert.equal(f.h.read(2),0);assert.equal(f.read(0xb1),1000);assert.equal(f.h.read(2),1);f.read(0xd0);assert.equal(f.h.read(2),0);f.input({touchDown:false,touchX:120,touchY:160,touchPressure:50});assert.equal(f.h.read(2),1);assert.equal(f.read(0xb0)+4095-f.read(0xc0),0);}finally{f.h.dispose();}
});
test('optional IRQ can be disconnected while SPI polling still works; output HIGH IRQ conflicts on press',()=>{
 const f=fixture(c=>{c.wires=c.wires.filter(w=>!(w.to.component==='touch1'&&w.to.pin==='IRQ'));});try{f.input();assert.equal(f.read(0xd0),2058);assert.equal(f.snap().diagnostics.length,0);}finally{f.h.dispose();}
 const g=fixture();try{g.h.mode(2,1,0,1);g.input();assert(g.snap().diagnostics.some(d=>d.code==='touch-irq-conflict'));}finally{g.h.dispose();}
});
test('missing power, ground, SCK, MOSI or CS cannot yield a valid ADC conversion',()=>{
 for(const pin of ['VCC','GND','SCK','MOSI','CS']){const f=fixture(c=>{c.wires=c.wires.filter(w=>!(w.to.component==='touch1'&&w.to.pin===pin));});try{f.input();assert.equal(f.read(0xd0),8191,pin);assert.equal(f.snap().touches!.touch1.conversions,0,pin);}finally{f.h.dispose();}}
});
test('missing MISO yields 0xFF with diagnosis; CS HIGH does not start conversion',()=>{
 const f=fixture(c=>{c.wires=c.wires.filter(w=>!(w.to.component==='touch1'&&w.to.pin==='MISO'));});try{f.input();assert.equal(f.read(0xd0),8191);assert(f.snap().diagnostics.some(d=>/MISO/.test(d.message)));}finally{f.h.dispose();}
 const g=fixture();try{g.input();assert.deepEqual(g.xfer([0xd0,0,0]),[255,255,255]);assert.equal(g.snap().touches!.touch1.conversions,0);}finally{g.h.dispose();}
});
test('CS deassert discards incomplete conversion data, preserving the input',()=>{
 const f=fixture();try{f.input();f.set(7,0);f.xfer([0xd0]);f.set(7,1);f.set(7,0);assert.deepEqual(f.xfer([0,0]),[0,0]);f.set(7,1);assert.equal(f.read(0xd0),2058);}finally{f.h.dispose();}
});
for(const override of [{mode:1},{mode:2},{mode:3},{firstbit:1},{freq:4000000}])test('unsupported touch SPI setting '+JSON.stringify(override),()=>{
 const f=fixture();try{f.input();f.set(7,0);assert.deepEqual(f.xfer([0xd0,0,0],override),[255,255,255]);f.set(7,1);assert.equal(f.snap().touches!.touch1.conversions,0);assert(f.snap().diagnostics.some(d=>/XPT2046/.test(d.message)));}finally{f.h.dispose();}
});
for(const cmd of [0xd8,0xd4,0xd2,0xa0,0xe0,0x80])test('unsupported ADC command 0x'+cmd.toString(16)+' is diagnosed',()=>{
 const f=fixture();try{f.input();f.read(cmd);assert.equal(f.snap().touches!.touch1.conversions,0);assert(f.snap().diagnostics.some(d=>/podržani su/.test(d.message)));}finally{f.h.dispose();}
});
test('shared TFT+touch CS collision rejects transfers, distinct CS leave TFT RAM unchanged',()=>{
 const f=fixture();try{f.input();f.set(10,0);assert.equal(f.read(0xd0),8191);assert.equal(f.snap().touches!.touch1.conversions,0);assert(f.snap().diagnostics.some(d=>/Istodobno/.test(d.message)));f.set(10,1);assert.equal(f.read(0xd0),2058);assert.equal(f.snap().tfts!.tft1.written,0);}finally{f.h.dispose();}
});
test('carrier voltage mismatch, signal shorts and Nano analog-only pins are rejected; invalid input cannot enter project',()=>{
 const n=touchCircuit('touchRaw',NANO);n.wires.find(w=>w.to.component==='touch1'&&w.to.pin==='MISO')!.from.pin='A6';assert.throws(()=>compileCircuit(n,'avr'),/digitalni/);
 const u=touchCircuit('touchRaw',UNO);Object.assign(u.components.find(p=>p.kind==='xpt2046')!.properties,{moduleVoltage:3.3,logicVoltage:3.3});assert.throws(()=>compileCircuit(u,'avr'),/prilagodbom/);
 const s=touchCircuit('touchRaw');s.wires.find(w=>w.to.component==='touch1'&&w.to.pin==='MISO')!.from.pin=s.wires.find(w=>w.to.component==='touch1'&&w.to.pin==='CS')!.from.pin;assert.throws(()=>compileCircuit(s),/odvojene/);
 for(const value of [-1,240,NaN]){const c=touchCircuit('touchRaw');c.components.find(p=>p.kind==='xpt2046')!.properties.touchX=value;assert.throws(()=>parseCircuit(c),/ulaz dodira/);}
 const f=fixture();try{f.h.input({component:'touch1',touchX:999,touchY:-5,touchPressure:NaN,touchDown:true});assert.equal(f.read(0xd0),3900);assert.equal(f.read(0x90),250);assert.equal(f.read(0xb0),1000);}finally{f.h.dispose();}
});
test('real MicroPython raw input, live pressure change, release and Stop retention',async()=>{
 const s=python('touchRaw');try{await ready(s,'TOUCH RAW X=0 Y=0 Z1=0 Z2=4095 IRQ=1');await pyTouch(s,239,319,true,100);await ready(s,'X=3900 Y=3850 Z1=2000 Z2=2595 IRQ=0');await pyTouch(s,0,0,false);await ready(s,'X=0 Y=0 Z1=0 Z2=4095 IRQ=1');const f=frame(s.events);assert.equal(f.diagnostics.length,0);evidence('python-raw',s.text,f);const before=frame(s.events);assert(await s.stop()<500);assert.equal(frame(s.events),before);}finally{await s.stop();}
});
test('real Python endpoint calibration handles four inverse rotations, reversal, clipping and zero-span rejection',async()=>{
 const s=python('touchRaw',`from lab_xpt2046 import calibrate\nassert calibrate(200,250)==(0,0)\nassert calibrate(3900,3850)==(239,319)\nassert calibrate(200,250,1)==(0,239)\nassert calibrate(200,250,2)==(239,319)\nassert calibrate(200,250,3)==(319,0)\nassert calibrate(200,250,0,(3900,200,3850,250))==(239,319)\nassert calibrate(0,4095)==(0,319)\nfor args in ((0,(1,1,2,3)),(4,(200,3900,250,3850))):\n    try:\n        calibrate(200,250,args[0],args[1])\n        assert False\n    except ValueError:\n        pass\nfrom lab_xpt2046 import XPT2046\nassert not XPT2046.valid((8191,8191,8191,8191))\nassert not XPT2046.valid((0,0,0,0))\nassert XPT2046.valid((2058,2056,1000,3345))\nprint('CAL API PASS')\n`);try{await ready(s,'CAL API PASS');assert.equal(frame(s.events).touches!.touch1.conversions,0);}finally{await s.stop();}
});
test('real MicroPython two-point calibration captures SPI samples and tracks a third point',async()=>{
 const s=python('touchCalibration');try{await ready(s,'CAL TARGET 20 20');await pyTouch(s,20,20);await pyTouch(s,20,20,false);await ready(s,'CAL TARGET 219 299');await pyTouch(s,219,299);await pyTouch(s,219,299,false);await ready(s,'CAL READY');await pyTouch(s,120,160);await ready(s,'CAL POINT 120 160');const f=frame(s.events);assert.equal(f.diagnostics.length,0);evidence('python-calibration',s.text,f);}finally{await s.stop();}
});
test('real MicroPython rejects a repeated calibration target instead of silently accepting it',async()=>{
 const s=python('touchCalibration');try{await ready(s,'CAL TARGET 20 20');await pyTouch(s,20,20);await pyTouch(s,20,20,false);await ready(s,'CAL TARGET 219 299');await pyTouch(s,20,20);await pyTouch(s,20,20,false);await s.wait((s:Session)=>s.status==='error',10000);assert(s.events.some((e:any)=>e.type==='error'&&/Pogresne tocke/.test(e.message)),JSON.stringify(s.events.filter((e:any)=>e.type==='error')));}finally{await s.stop();}
});
test('real MicroPython hit-test drives wired LED through SPI; hold/drag/outside do not retoggle',async()=>{
 const s=python('touchButton');try{await ready(s,'TOUCH BUTTON READY');await pyTouch(s,120,160);await ready(s,'TOUCH LED=1');assert(frame(s.events).leds.touchLED.brightness>.1);await pyTouch(s,130,170);await pyTouch(s,5,5);assert.equal((s.text.match(/TOUCH LED=/g)??[]).length,1);await pyTouch(s,5,5,false);await pyTouch(s,5,5);assert.equal((s.text.match(/TOUCH LED=/g)??[]).length,1);await pyTouch(s,5,5,false);await pyTouch(s,120,160);await ready(s,'TOUCH LED=0');await s.wait(()=>frame(s.events).leds.touchLED.brightness===0,10000);const f=frame(s.events);assert.equal(f.diagnostics.length,0);assert(f.tfts!.tft1.written>76800);evidence('python-button',s.text,f);}finally{await s.stop();}
});
test('wrong program calibration misses a valid-looking button and matched rotation 1 restores the hit',async()=>{
 const s=python('touchButton',touchExamples.touchButton.code.replace('CALIBRATION = (200, 3900, 250, 3850)','CALIBRATION = (3000, 3900, 250, 3850)'));try{await ready(s,'TOUCH BUTTON READY');await pyTouch(s,120,160);assert(!s.text.includes('TOUCH LED='));assert.equal(frame(s.events).leds.touchLED.brightness,0);}finally{await s.stop();}
 const r=python('touchButton',touchExamples.touchButton.code.replace('ROTATION = 0','ROTATION = 1'));try{await ready(r,'TOUCH BUTTON READY');await pyTouch(r,79,120);await ready(r,'TOUCH LED=1');assert(frame(r.events).leds.touchLED.brightness>.1);}finally{await r.stop();}
});
test('real MicroPython four rotations map the same physical origin to different logical coordinates',async()=>{
 const s=python('touchRotation');try{await ready(s,'TOUCH ROT READY');for(const [r,x,y]of [[0,0,0],[1,0,239],[2,239,319],[3,319,0]]){await pyTouch(s,0,0);await ready(s,`TOUCH ROT=${r} X=${x} Y=${y}`);await ready(s,`TOUCH SCREEN ${(r+1)%4}`);await pyTouch(s,0,0,false);}const f=frame(s.events);assert.equal(f.diagnostics.length,0);evidence('python-rotation',s.text,f);}finally{await s.stop();}
});
function avr(board:typeof UNO|typeof NANO,key:TouchExample){
 const a=artifacts[board][key],events:any[]=[];let output='';
 const e=new AVREngine(a.hex,compileCircuit(touchCircuit(key,board),'avr'),(v:any)=>{events.push(v);if(events.length>20)events.shift();if(v.type==='console')output+=v.text;},board===NANO?8:6,a.staticRamBytes);
 const run=(cycles=800000)=>{e.runCycles(cycles);e.frame();};
 const until=(mark:string)=>{for(let i=0;i<350&&!(output.includes(mark)&&output.slice(output.indexOf(mark)).includes('\n'));i++)run();assert(output.includes(mark),output);};
 const input=(x:number,y:number,down=true,pressure=50)=>{e.input({component:'touch1',touchX:x,touchY:y,touchDown:down,touchPressure:pressure});run(4000000);};
 return {e,run,until,input,get output(){return output;},snap:()=>frame(events)};
}
for(const board of [UNO,NANO]as const)for(const key of keys)test(`${board}: compiled ${key} really reads ADC and controls state with bounded SRAM`,()=>{
 const f=avr(board,key);try{
  if(key==='touchRaw'){f.until('TOUCH RAW X=0');f.input(239,319,true,100);f.until('X=3900 Y=3850 Z1=2000 Z2=2595 IRQ=0');f.input(0,0,false);}
  if(key==='touchCalibration'){f.until('CAL TARGET 20 20');f.input(20,20);f.input(20,20,false);f.until('CAL TARGET 219 299');f.input(219,299);f.input(219,299,false);f.until('CAL READY');f.input(120,160);f.until('CAL POINT ');const point=f.output.match(/CAL POINT (\d+) (\d+)/)!;assert(Math.abs(Number(point[1])-120)<=1&&Math.abs(Number(point[2])-160)<=1,f.output);}
  if(key==='touchButton'){f.until('TOUCH BUTTON READY');f.input(120,160);f.until('TOUCH LED=1');assert(f.snap().leds.touchLED.brightness>.1);f.input(120,160);assert.equal((f.output.match(/TOUCH LED=/g)??[]).length,1);f.input(120,160,false);f.input(120,160);f.until('TOUCH LED=0');assert.equal(f.snap().gpios['6'].level,0);f.run();assert.equal(f.snap().leds.touchLED.brightness,0);}
  if(key==='touchRotation'){f.until('TOUCH ROT READY');for(const [r,x,y]of [[0,0,0],[1,0,239],[2,239,319],[3,319,0]]){f.input(0,0);f.until(`TOUCH ROT=${r} X=${x} Y=${y}`);f.until(`TOUCH SCREEN ${(r+1)%4}`);f.input(0,0,false);}}
  const s=f.snap();assert.equal(s.diagnostics.length,0,JSON.stringify(s.diagnostics));assert(s.touches!.touch1.conversions>0);assert(s.avr!.memory!.minFreeToStatic>300);evidence((board===UNO?'uno-':'nano-')+key,f.output,s,{flashBytes:artifacts[board][key].flashBytes,staticRamBytes:artifacts[board][key].staticRamBytes});
 }finally{f.e.dispose();}
});
test('packaged Nano Worker handles live touch, renders the result and can be stopped within 500 ms',async()=>{
 const m=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=m.files.find((x:any)=>/^\/assets\/avrWorker-.*\.js$/.test(x.url)),a=artifacts[NANO].touchButton,events:any[]=[];let output='',sent=false;
 const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
 try{await new Promise<void>((ok,bad)=>{const timer=setTimeout(()=>bad(Error('touch Worker timeout')),60000);w.on('error',bad);w.on('message',e=>{events.push(e);if(events.length>25)events.shift();if(e.type==='console')output+=e.text;if(e.type==='error'){clearTimeout(timer);bad(Error(e.message));}if(!sent&&output.includes('TOUCH BUTTON READY')){sent=true;w.postMessage({type:'input',session:171,component:'touch1',touchX:120,touchY:160,touchDown:true});}if(output.includes('TOUCH LED=1')&&frame(events)?.leds.touchLED.brightness>.1){clearTimeout(timer);ok();}});w.postMessage({type:'run',session:171,hex:a.hex,circuit:compileCircuit(touchCircuit('touchButton',NANO),'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});});const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);evidence('packaged-nano-worker',output,frame(events),{version:m.version,build:m.build,stopMs,scope:'Node/Linux packaged Worker'});}finally{await w.terminate();}
});
