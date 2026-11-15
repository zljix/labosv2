import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {levelInput,evaluateLevelShifters} from '../public/level-shifter.mjs';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {compileCircuit} from '../src/circuit/compile';
import {buildNets,checkCircuit} from '../src/circuit/netlist';
import {parseCircuit,makePart,localTerminals,keyOf,type Circuit} from '../src/circuit/model';
import {levelCircuit} from '../src/circuit/levelExamples';
import {exampleCircuit} from '../src/circuit/examples';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import {exportZip,importProject} from '../src/project/archive';
import {validateArtifact,buildFile} from '../public/arduino-contract.mjs';
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>{const path=String(input).replace(/^\/app\/[^/]+\//,'');if(path.startsWith('/')||path.includes('..'))throw Error('Nedopušten testni resurs');return new Response(readFileSync(resolve('public',path)));};
test.after(()=>{globalThis.fetch=originalFetch;});
const fixture=(mode:'input'|'output'='input')=>levelCircuit(exampleCircuit(mode==='input'?'button':'blink'),mode);
function open(c:Circuit,logicVoltage=3.3){const events:any[]=[],config=compileCircuit(c,logicVoltage===5?'avr':'micropython');const h=createCircuitHost((e:any)=>events.push(e),{circuit:config,logicVoltage,manualPublish:true});return {h,config,frame:()=>{h.flush();return events.filter(e=>e.type==='simulation').at(-1);}};}
function wire(c:Circuit,id:string,from:string,to:string){const e=(s:string)=>{const [component,pin]=s.split(':');return {component,pin};};c.wires.push({id,from:e(from),to:e(to),color:'#087f8c',points:[]});}
function unplug(c:Circuit,pin:string){c.wires=c.wires.filter(w=>![w.from,w.to].some(e=>e.component==='level1'&&e.pin===pin));}
const near=(v:number,target:number)=>assert(Math.abs(v-target)<.02,`${v} != ${target}`);

for(const [supply,low,high]of [[3.3,.8,2],[5,1.5,3.5]])test(`TI input thresholds at ${supply} V preserve the undefined region`,()=>{
 assert.equal(levelInput(0,supply),0);assert.equal(levelInput(low,supply),0);assert.equal(levelInput(high,supply),1);assert.equal(levelInput(supply,supply),1);
 for(const v of [low+.01,(low+high)/2,high-.01,null,NaN,Infinity,-1,6])assert.equal(levelInput(v,supply),null);
});
test('package pins are explicit, topology stays separated and project import preserves identity',()=>{
 const p=makePart('levelShifter',0,0,'chip');assert.deepEqual(localTerminals(p).map(t=>t.pin),['VCCA','A1','A2','GND','VCCB','B1','B2','DIR']);
 const c=fixture(),g=buildNets(c);assert.notEqual(g.byTerminal.get('level1:A1'),g.byTerminal.get('level1:B1'));assert.deepEqual(parseCircuit(c),c);assert(!checkCircuit(c).diagnostics.some(d=>d.severity==='error'));
 const cfg=compileCircuit(c);assert.equal(cfg.levelShifters.length,1);assert.notEqual(cfg.levelShifters[0].a[0],cfg.levelShifters[0].b[0]);
});
test('5 V tipkalo is read at 3.3 V, while the original LED follows actual GPIO writes',()=>{
 const t=open(fixture());try{t.h.mode(5,0,1);t.h.mode(4,1,0,0);assert.equal(t.h.read(5,1),1);let f=t.frame();near(f.levelShifters.level1.channels[0].inputVolts,5);near(f.gpios[5].volts,3.3);assert.equal(f.levelShifters.level1.direction,'B → A');
 t.h.input({component:'sw1',pressed:true});assert.equal(t.h.read(5,1),0);t.h.write(4,1);f=t.frame();assert(f.leds.led1.currentMa>4);near(f.gpios[5].volts,0);assert.equal(f.diagnostics.length,0);
 t.h.input({component:'sw1',pressed:false});assert.equal(t.h.read(5,1),1);t.h.write(4,0);assert.equal(t.frame().leds.led1.currentMa,0);}finally{t.h.dispose();}
});
test('3.3 V GPIO output becomes 5 V before the LED resistor without merging supplies',()=>{
 const t=open(fixture('output'));try{t.h.mode(4,1,0,1);let f=t.frame();const ch=f.levelShifters.level1.channels[0];near(ch.inputVolts,3.3);near(ch.outputVolts,5);assert(f.leds.led1.currentMa>9&&f.leds.led1.currentMa<10);assert(!f.diagnostics.length);
 t.h.write(4,0);f=t.frame();assert.equal(f.leds.led1.currentMa,0);near(f.levelShifters.level1.channels[0].outputVolts,0);}finally{t.h.dispose();}
});
test('output fixture has a defined LOW before the AVR has configured any GPIO',()=>{
 const t=open(fixture('output'));try{t.h.mode(0,0);const f=t.frame();assert.equal(f.levelShifters.level1.channels[0].level,0);assert.equal(f.leds.led1.currentMa,0);assert(!f.diagnostics.some((d:any)=>d.severity==='error'));}finally{t.h.dispose();}
});
test('translator output still requires an LED series resistor',()=>{
 const c=fixture('output');wire(c,'noResistor','level1:B1','led1:A');assert.throws(()=>compileCircuit(c),/serijskog otpornika/);
});
test('both channels work independently with their shared DIR',()=>{
 const c=fixture('output');unplug(c,'A2');wire(c,'second','esp32:J1.6','level1:A2');const t=open(c);try{t.h.mode(4,1,0,1);t.h.mode(6,1,0,0);let f=t.frame();assert.deepEqual(f.levelShifters.level1.channels.map((v:any)=>v.level),[1,0]);t.h.write(6,1);t.h.write(4,0);f=t.frame();assert.deepEqual(f.levelShifters.level1.channels.map((v:any)=>v.level),[0,1]);near(f.levelShifters.level1.channels[1].outputVolts,5);}finally{t.h.dispose();}
});
test('DIR can be driven by GPIO and reverses both channels with no automatic direction inference',()=>{
 const d={id:'x',vcca:0,vccb:1,gnd:2,dir:3,a:[4,5],b:[6,7]},v=[3.3,5,0,3.3,3.3,0,0,5];let r=evaluateLevelShifters([d],v,()=>true);assert.deepEqual(r.drives.map((x:any)=>[x.net,x.volts]),[[6,5],[7,0]]);v[3]=0;r=evaluateLevelShifters([d],v,()=>true);assert.deepEqual(r.drives.map((x:any)=>[x.net,x.volts]),[[4,0],[5,3.3]]);
});
for(const pin of ['VCCA','VCCB','GND'])test(`missing ${pin} releases the model outputs; restoring the wire recovers`,()=>{
 const c=fixture('output');unplug(c,pin);const t=open(c);try{t.h.mode(4,1,0,1);const f=t.frame();assert.equal(f.levelShifters.level1.powered,false);assert.equal(f.levelShifters.level1.channels[0].outputVolts,null);assert.equal(f.leds.led1.currentMa,0);}finally{t.h.dispose();}
 const r=open(fixture('output'));try{r.h.mode(4,1,0,1);assert(r.frame().leds.led1.currentMa>9);}finally{r.h.dispose();}
});
for(const pin of ['VCCA','VCCB'])test(`${pin} at GND invokes power isolation rather than forwarding the source`,()=>{
 const c=fixture('output');unplug(c,pin);const board=c.components.find(p=>p.kind==='board')!,gnd=localTerminals(board).find(t=>t.role==='ground')!;wire(c,'off',board.id+':'+gnd.pin,'level1:'+pin);const t=open(c);try{t.h.mode(4,1,0,1);assert.equal(t.frame().levelShifters.level1.channels[0].outputVolts,null);assert.equal(t.frame().leds.led1.currentMa,0);}finally{t.h.dispose();}
});
for(const pin of ['DIR','B2'])test(`floating ${pin} is reported as unknown and cannot certify a transfer`,()=>{
 const c=fixture();unplug(c,pin);const t=open(c);try{t.h.mode(5,0,1);assert.equal(t.h.read(5,1),1);const f=t.frame();assert(f.diagnostics.some((d:any)=>d.code==='level-shifter-input'));assert.equal(f.levelShifters.level1.channels[pin==='DIR'?0:1].level,null);}finally{t.h.dispose();}
});
test('3.3 V on the 5 V input is between TI thresholds, not silently HIGH',()=>{
 const c=fixture();unplug(c,'B1');wire(c,'weak','esp32:J1.1','level1:B1');const t=open(c);try{t.h.mode(5,0,1);assert.equal(t.h.read(5,1),1);assert(t.frame().diagnostics.some((d:any)=>d.code==='level-shifter-input'));assert.equal(t.frame().levelShifters.level1.channels[0].level,null);}finally{t.h.dispose();}
});
test('external opposing GPIO drive raises a conflict instead of overriding the translated output',()=>{
 const t=open(fixture());try{t.h.mode(5,1,0,0);assert(t.frame().diagnostics.some((d:any)=>d.code==='output-conflict'));}finally{t.h.dispose();}
});
test('5 V translated output onto an S3 input reports overvoltage even in input mode',()=>{
 const c=fixture('output');wire(c,'unsafe','level1:B1','esp32:J1.5');const t=open(c);try{t.h.mode(4,1,0,1);t.h.mode(5,0);assert(t.frame().diagnostics.some((d:any)=>d.code==='level-shifter-gpio-overvoltage'));assert.equal(t.h.read(5),-2);}finally{t.h.dispose();}
});
test('static checks reject wrong supply, bypass, protocol endpoints and cascades',()=>{
 let c=fixture();unplug(c,'VCCA');wire(c,'wrong','esp32:J1.21','level1:VCCA');assert.throws(()=>compileCircuit(c),/VCCA/);
 c=fixture();wire(c,'bypass','level1:A1','level1:B1');assert.throws(()=>compileCircuit(c),/odvojene/);
 c=fixture();c.components.push(makePart('aht10',800,0,'sensor'));wire(c,'i2c','level1:B1','sensor:SDA');assert.throws(()=>compileCircuit(c),/I2C/);
 c=fixture();c.components.push(makePart('levelShifter',800,0,'other'));wire(c,'cascade','level1:B1','other:A1');assert.throws(()=>compileCircuit(c),/kaskadu/);
});
for(const target of ['micropython','s3-cpp','uno','nano']as UrsTarget[])for(const mode of ['input','output']as const)test(`URS17 ${mode}/${target}: exact source artifact, both domains and ZIP round trip`,async()=>{
 const p=await createUrsProject('levels',mode==='input'?'levelInput':'levelOutput',target);assert(p.circuit.kind==='editable');const circuit=p.circuit as Circuit;assert.equal(circuit.components.filter(p=>p.kind==='levelShifter').length,1);assert.deepEqual(importProject(exportZip(p),'level.zip'),p);assert(p.files['urs-upute.md'].includes('SN74LVC2T45'));
 if(p.language==='arduino-cpp')await validateArtifact(p,JSON.parse(p.files[buildFile(p)]));
 const t=open(circuit,target==='uno'||target==='nano'?5:3.3),gpio=target==='uno'||target==='nano'?(mode==='input'?2:9):(mode==='input'?5:4);
 try{if(mode==='input'){t.h.mode(gpio,0,1);assert.equal(t.h.read(gpio,1),1);t.h.input({component:'sw1',pressed:true});assert.equal(t.h.read(gpio,1),0);}else{t.h.mode(gpio,1,0,1);assert(t.frame().leds.led1.currentMa>2);t.h.write(gpio,0);assert.equal(t.frame().leds.led1.currentMa,0);}assert(!t.frame().diagnostics.some((d:any)=>d.severity==='error'));}finally{t.h.dispose();}
});
