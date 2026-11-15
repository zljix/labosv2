import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {analogCircuit,analogExamples,type AnalogExample} from '../src/circuit/analogExamples';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {checkCircuit} from '../src/circuit/netlist';
import {makePart,parseCircuit,localTerminals,terminals,type Circuit} from '../src/circuit/model';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {AVREngine} from '../src/runtime/avrEngine';
import {compileProject} from '../scripts/avr-compile.mjs';
import {validateArtifact,AVR_BUILD_FILE} from '../public/avr-contract.mjs';
import {Session} from '../dist/session.mjs';
const keys=Object.keys(analogExamples) as AnalogExample[];
const machine=readFileSync('public/machine.py','utf8'),artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const text=(events:any[])=>events.filter(e=>e.type==='console').map(e=>e.text).join('');
const frame=(events:any[])=>events.filter(e=>e.type==='simulation').at(-1) as SimulationFrame;
function host(key:AnalogExample,board:BoardId=S3,edit=(c:Circuit)=>{}){
 const c=analogCircuit(key,board);edit(c);const events:any[]=[];const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c,board===S3?'micropython':'avr'),logicVoltage:board===S3?3.3:5,adcPins:board===S3?[1,2]:[14,15],manualPublish:true});
 return {h,events,c,frame:()=>{h.flush();return frame(events);}};
}
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function python(key:AnalogExample,code=analogExamples[key].code,c=analogCircuit(key)){return new Session(factory,machine,code,{circuit:compileCircuit(c)});}
async function done(key:AnalogExample,code:string,c=analogCircuit(key),ok=true){const s=python(key,code,c);try{await s.wait((s:Session)=>['done','error'].includes(s.status));assert.equal(s.status,ok?'done':'error',s.text+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));return {text:s.text,frame:frame(s.events)};}finally{await s.stop();}}
function avr(key:AnalogExample,board:typeof UNO|typeof NANO,artifact=artifacts[board][key],edit=(c:Circuit)=>{}){const p=arduinoExampleProject(key,board),c=p.circuit as Circuit;edit(c);const events:any[]=[],e=new AVREngine(artifact.hex,compileCircuit(c,'avr'),x=>events.push(x),board===NANO?8:6,artifact.staticRamBytes);return {e,events};}
function advance(e:AVREngine,ms=350){for(let n=0;n<ms;n+=10){e.runCycles(160000);e.frame();}}
function readout(events:any[],prefix:string){const lines=text(events).split(/\r?\n/).filter(l=>l.startsWith(prefix));return lines.at(-1)??'';}
const num=(s:string,k:string)=>Number(s.match(new RegExp('(?:^| )'+k+'=(-?[0-9.]+)'))?.[1]);

test('all eight examples preserve input profiles and exact compiled source through ZIP on three boards',async()=>{
 for(const key of keys)for(const board of [S3,UNO,NANO]as const){
  const p=board===S3?newProject(analogExamples[key].code,analogExamples[key].title):arduinoExampleProject(key,board);p.circuit=analogCircuit(key,board);assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.equal(checkCircuit(p.circuit).diagnostics.length,0);
  if(board!==S3){await validateArtifact(p,artifacts[board][key]);p.files[AVR_BUILD_FILE]=JSON.stringify(artifacts[board][key]);}
  const next=importProject(exportZip(p),'inputs.zip');assert.deepEqual(next,parseProject(p));if(board!==S3)await validateArtifact(next,JSON.parse(next.files[AVR_BUILD_FILE]));
 }
});
test('invalid profile values, NaN, wrong LM35 supply and invented sound AO pin are rejected',()=>{
 for(const [key,prop,val]of [['lm35','temperature',-1],['lm35','moduleVoltage',3.3],['temt6000','illuminance',NaN],['ntc','beta',0],['ntc','fixedResistance',0],['ky023','axisX',101],['flame','threshold',99],['sound','stimulus',-1]]as const){const c=analogCircuit(key);(c.components[1].properties as any)[prop]=val;assert.throws(()=>parseCircuit(c));}
 const c=analogCircuit('sound');assert.deepEqual(localTerminals(c.components[1]).map(t=>t.pin),['VCC','GND','DO']);c.wires[2].to.pin='AO';assert.throws(()=>parseCircuit(c));
});
test('LM35 10 mV/C is independent of board ADC reference and respects 5 V supply',()=>{
 for(const board of [S3,UNO,NANO]as const){const t=host('lm35',board);try{const pin=board===S3?1:14;assert.equal(t.h.adc(pin),250000);t.h.input({component:'lm351',temperature:100});assert.equal(t.h.adc(pin),1000000);assert.equal(t.frame().analogInputs!.lm351.powered,true);}finally{t.h.dispose();}}
 const bad=host('lm35',S3,c=>{c.wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.1';});try{assert.equal(bad.h.adc(1),-1);assert(bad.frame().diagnostics.some(d=>d.code==='input-unpowered'));}finally{bad.h.dispose();}
});
test('TEMT6000 nominal light current, 10k loading and supply saturation affect actual network',()=>{
 for(const board of [S3,UNO]as const){const t=host('temt6000',board);try{const pin=board===S3?1:14;assert.equal(t.h.adc(pin),500000);t.h.input({component:'temt60001',illuminance:20});assert.equal(t.h.adc(pin),100000);t.h.input({component:'temt60001',illuminance:2000});assert.equal(t.h.adc(pin),board===S3?3200000:4900000);}finally{t.h.dispose();}}
 const t=host('temt6000',S3,c=>{const r=makePart('resistor',800,100,'load');r.properties.resistance=10000;c.components.push(r);for(const [pin,target]of [['1','AO'],['2','GND']])c.wires.push({id:'load'+pin,from:{component:r.id,pin},to:{component:'temt60001',pin:target},points:[],color:'#334155'});});try{assert.equal(t.h.adc(1),250000);}finally{t.h.dispose();}
});
test('NTC beta equation, divider direction, changed parameters affect the electrical result',()=>{
 const t=host('ntc');try{assert.equal(t.h.adc(1),1650000);t.h.input({component:'ntc1',temperature:50});assert(t.h.adc(1)>860000&&t.h.adc(1)<880000);assert(t.frame().analogInputs!.ntc1.resistance!<3600);}finally{t.h.dispose();}
 const changed=host('ntc',S3,c=>{c.components[1].properties.r25=20000;});try{assert.equal(changed.h.adc(1),2200000);}finally{changed.h.dispose();}
});
test('joystick has two independent axes, passive switch, explicit pull-up and no hidden deadzone',()=>{
 const t=host('ky023');try{t.h.mode(5,0,1);assert.equal(t.h.read(5,1),1);assert.equal(t.h.adc(1),1650000);assert.equal(t.h.adc(2),1650000);t.h.input({component:'ky0231',axisX:100,axisY:0,pressed:true});assert.equal(t.h.adc(1),3300000);assert.equal(t.h.adc(2),0);assert.equal(t.h.read(5,1),0);t.h.input({component:'ky0231',axisX:51,pressed:false});assert(t.h.adc(1)>1682000&&t.h.adc(1)<1684000);assert.equal(t.h.adc(2),0);assert.equal(t.h.read(5,1),1);t.h.mode(5,0);assert.equal(t.h.read(5,0),-1);}finally{t.h.dispose();}
});
for(const key of ['flame','sound']as const)test(`${key}: open-collector active LOW comparator, hysteresis, fresh reset and independent instances`,()=>{
 const t=host(key);try{assert.equal(t.h.read(5),1);for(const [stimulus,want]of [[52,0],[50,0],[48,1],[50,1],[100,0],[0,1]]){t.h.input({component:key+'1',stimulus});assert.equal(t.h.read(5),want);assert.equal(t.frame().analogInputs![key+'1'].active,want===0);}if(key==='flame'){t.h.input({component:'flame1',stimulus:75});assert.equal(t.h.adc(1),825000);}}finally{t.h.dispose();}
 const fresh=host(key);try{assert.equal(fresh.h.read(5),1);}finally{fresh.h.dispose();}
 const pair=host(key,S3,c=>{const p=structuredClone(c.components[1]);p.id='second';c.components.push(p);for(const w of [...c.wires])if(w.to.component===key+'1'){const v=structuredClone(w);v.id+='second';v.to.component='second';if(v.to.pin==='DO')v.from.pin=terminals(c.components[0]).find(t=>t.gpio===6)!.pin;if(v.to.pin==='AO')v.from.pin=terminals(c.components[0]).find(t=>t.gpio===2)!.pin;c.wires.push(v);}});
 try{assert.equal(pair.h.read(6),1);pair.h.input({component:key+'1',stimulus:100});assert.equal(pair.h.read(5),0);assert.equal(pair.h.read(6),1);pair.h.input({component:'second',stimulus:100});assert.equal(pair.h.read(6),0);pair.h.input({component:key+'1',stimulus:0});assert.equal(pair.h.read(5),1);assert.equal(pair.h.read(6),0);}finally{pair.h.dispose();}
});
test('missing VCC/GND/signals, wrong voltage domain and wrong ADC pin cannot silently validate inputs',()=>{
 for(const key of ['lm35','temt6000','ntc','ky023','flame','sound']as const)for(const pin of ['VCC','GND']){const t=host(key,S3,c=>{c.wires=c.wires.filter(w=>w.to.pin!==pin);});try{assert.equal(t.frame().analogInputs![key+'1'].powered,false);assert(t.frame().diagnostics.some(d=>d.code==='input-unpowered'));}finally{t.h.dispose();}}
 const t=host('lm35',S3,c=>{c.wires=c.wires.filter(w=>w.to.pin!=='OUT');});try{assert.equal(t.h.adc(1),-1);assert(t.frame().diagnostics.some(d=>d.code==='adc-floating'));}finally{t.h.dispose();}
 for(const key of ['temt6000','ntc','ky023','flame','sound']as const){const c=analogCircuit(key);c.components[1].properties.moduleVoltage=5;c.wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.21';assert.throws(()=>compileCircuit(c),/prekoračiti/);}
 const wrongPower=analogCircuit('temt6000');wrongPower.wires.find(w=>w.to.pin==='VCC')!.from.pin='J1.21';assert.throws(()=>compileCircuit(wrongPower),/3,3 V spojen je na 5 V/);
 const bad=analogCircuit('lm35');bad.wires.find(w=>w.to.pin==='OUT')!.from.pin='J3.3';assert(checkCircuit(bad).diagnostics.some(d=>d.code==='input-not-adc'));
});
test('two pots and two buttons retain independent live states and input snapshots',()=>{
 const t=host('dualInputs');try{t.h.mode(5,0,1);t.h.mode(6,0,1);assert.equal(t.h.adc(1),825000);assert.equal(t.h.adc(2),2475000);t.h.input({component:'pot1',position:80});t.h.input({component:'sw2',pressed:true});assert.equal(t.h.adc(1),2640000);assert.equal(t.h.adc(2),2475000);assert.equal(t.h.read(5,1),1);assert.equal(t.h.read(6,1),0);assert.equal(t.c.components.find(p=>p.id==='pot1')!.properties.position,25);}finally{t.h.dispose();}
});
test('real MicroPython uses quantized ADC/attenuation, not direct slider temperature',async()=>{
 let r=await done('lm35','from machine import ADC,Pin\na=ADC(Pin(1),atten=ADC.ATTN_11DB)\nassert a.read()==330\nassert abs(a.read_uv()/10000-25)<.1\nprint("LM35_ADC_OK")');assert(r.text.includes('LM35_ADC_OK'));
 const c=analogCircuit('lm35');c.components[1].properties.temperature=100;r=await done('lm35','from machine import ADC,Pin\na=ADC(Pin(1))\nassert a.read()==4095\na.atten(ADC.ATTN_11DB)\nassert 1310<a.read()<1330\nprint("ATTENUATION_USED")',c);assert(r.text.includes('ATTENUATION_USED'));
 r=await done('lm35','from machine import ADC,Pin\nADC(Pin(1)).read()',(()=>{const c=analogCircuit('lm35');c.wires=c.wires.filter(w=>w.to.pin!=='OUT');return c;})(),false);assert.equal(r.frame.analogInputs!.lm351.powered,true);
});
for(const key of keys)test(`real MicroPython ${key}: example runs, reads wires, changes live and stops promptly`,async()=>{
 const s=python(key);try{
  const prefix=key==='ky023'?'X=':key==='analogCompare'?'COMPARE':key==='dualInputs'?'DUAL':key.toUpperCase();await s.wait((s:Session)=>s.text.includes(prefix));const before=s.text.length;
  if(key==='lm35'||key==='ntc')s.input({component:key+'1',temperature:50});
  else if(key==='temt6000')s.input({component:'temt60001',illuminance:20});
  else if(key==='ky023')s.input({component:'ky0231',axisX:0,axisY:100,pressed:true});
  else if(key==='flame'||key==='sound')s.input({component:key+'1',stimulus:80});
  else if(key==='analogCompare'){s.input({component:'lm351',temperature:50});s.input({component:'ntc1',temperature:50});}
  else {s.input({component:'pot1',position:80});s.input({component:'sw2',pressed:true});}
  await s.wait((s:Session)=>s.text.slice(before).includes('\n'));const line=readout(s.events,prefix);
  if(key==='lm35'||key==='ntc')assert(Math.abs(num(line,'T')-50)<.2,line);
  if(key==='temt6000')assert.equal(num(line,'ADC'),132,line);
  if(key==='ky023'){assert.equal(num(line,'X'),0);assert.equal(num(line,'Y'),4095);assert.equal(num(line,'SW'),0);}
  if(key==='flame'||key==='sound')assert.equal(num(line,'DO'),0);
  if(key==='analogCompare'){assert(Math.abs(num(line,'LM35')-50)<.2,line);assert(Math.abs(num(line,'NTC')-50)<.2,line);}
  if(key==='dualInputs'){assert.equal(num(line,'S1'),1);assert.equal(num(line,'S2'),0);}
  assert.equal(frame(s.events).diagnostics.length,0);writeFileSync('docs/stage11-evidence/micropython-'+key+'.json',JSON.stringify({console:s.text,frame:frame(s.events)},null,2)+'\n');
 }finally{assert(await s.stop()<500);}
});
for(const board of [UNO,NANO]as const)test(`${board}: all eight real compiled examples, independent live ADC, axes and thresholds`,()=>{
 const results:any[]=[];for(const key of keys){const {e,events}=avr(key,board);try{advance(e);const prefix=key==='ky023'?'X=':key==='analogCompare'?'COMPARE':key==='dualInputs'?'DUAL':key.toUpperCase(),first=readout(events,prefix);assert(first,JSON.stringify(events));
  if(key==='lm35'||key==='ntc')e.input({component:key+'1',temperature:50});else if(key==='temt6000')e.input({component:'temt60001',illuminance:20});else if(key==='ky023')e.input({component:'ky0231',axisX:0,axisY:100,pressed:true});else if(key==='flame'||key==='sound')e.input({component:key+'1',stimulus:80});else if(key==='analogCompare'){e.input({component:'lm351',temperature:50});e.input({component:'ntc1',temperature:50});}else{e.input({component:'pot1',position:80});e.input({component:'sw2',pressed:true});}advance(e);const line=readout(events,prefix);assert.notEqual(line,first);
  if(key==='lm35'||key==='ntc')assert(Math.abs(num(line,'T')-50)<.3,line);
  if(key==='temt6000')assert.equal(num(line,'ADC'),20,line);
  if(key==='ky023'){assert.equal(num(line,'X'),0);assert.equal(num(line,'Y'),1023);assert.equal(num(line,'SW'),0);assert.equal(num(first,'NX'),0);assert.equal(num(first,'NY'),0);}
  if(key==='flame'||key==='sound')assert.equal(num(line,'DO'),0);
  if(key==='analogCompare'){assert(Math.abs(num(line,'LM35')-50)<.3,line);assert(Math.abs(num(line,'NTC')-50)<.3,line);}
  if(key==='dualInputs'){assert.equal(num(line,'S1'),1);assert.equal(num(line,'S2'),0);}
  assert.equal(frame(events).diagnostics.length,0);results.push({key,console:text(events),frame:frame(events),flash:artifacts[board][key].flashBytes,staticRam:artifacts[board][key].staticRamBytes});
 }finally{e.dispose();}}writeFileSync('docs/stage11-evidence/'+(board===UNO?'uno':'nano')+'-examples.json',JSON.stringify(results,null,2)+'\n');
});
test('real AVR internal 1.1 V reference and Nano A6 work; missing ADC signal reports invalid measurement',{skip:!process.env.LAB_ARDUINO_CLI},async()=>{
 const p=arduinoExampleProject('lm35',NANO);p.files['main.ino']='void setup(){Serial.begin(9600);analogReference(INTERNAL);}\nvoid loop(){Serial.print("REF ADC=");Serial.println(analogRead(A6));delay(100);}\n';const a=await compileProject(p);const t=avr('lm35',NANO,a,c=>{c.wires.find(w=>w.to.pin==='OUT')!.from.pin='A6';});try{advance(t.e,200);assert.equal(num(readout(t.events,'REF'),'ADC'),232);t.e.input({component:'lm351',temperature:150});advance(t.e,200);assert.equal(num(readout(t.events,'REF'),'ADC'),1023);}finally{t.e.dispose();}
 const bad=avr('lm35',UNO,artifacts[UNO].lm35,c=>{c.wires=c.wires.filter(w=>w.to.pin!=='OUT');});try{advance(bad.e);assert(frame(bad.events).diagnostics.some(d=>d.code==='adc-floating'));}finally{bad.e.dispose();}
 writeFileSync('docs/stage11-evidence/internal-reference.json',JSON.stringify({board:NANO,source:p.files['main.ino'],flash:a.flashBytes,staticRam:a.staticRamBytes,adc:232,reference:1.1},null,2)+'\n');
});
test('production Nano Worker changes both analog sensors and forced Stop stays below 500 ms',async()=>{
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);const p=arduinoExampleProject('analogCompare',NANO),a=artifacts[NANO].analogCompare,events:any[]=[];
 const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});let pending:{check:()=>boolean;done:()=>void;fail:(e:Error)=>void}|undefined;
 const wait=(check:()=>boolean)=>new Promise<void>((ok,bad)=>{if(check()){ok();return;}const timer=setTimeout(()=>{pending=undefined;bad(Error('Worker timeout '+text(events)));},15000);pending={check,done:()=>{clearTimeout(timer);pending=undefined;ok();},fail:e=>{clearTimeout(timer);pending=undefined;bad(e);}};});w.on('message',e=>{events.push(e);if(e.type==='error')pending?.fail(Error(e.message));else if(pending?.check())pending.done();});w.on('error',e=>pending?.fail(e));
 try{w.postMessage({type:'run',session:111,hex:a.hex,circuit:compileCircuit(p.circuit as Circuit,'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});await wait(()=>text(events).includes('COMPARE'));w.postMessage({type:'input',session:111,component:'lm351',temperature:50});w.postMessage({type:'input',session:111,component:'ntc1',temperature:50});await wait(()=>{const l=readout(events,'COMPARE');return Math.abs(num(l,'LM35')-50)<.3&&Math.abs(num(l,'NTC')-50)<.3;});const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);writeFileSync('docs/stage11-evidence/production-worker.json',JSON.stringify({version:manifest.version,build:manifest.build,console:text(events),stopMs,scope:'Node/Linux production bundle; not target browser or physical board'},null,2)+'\n');}finally{await w.terminate();}
});
