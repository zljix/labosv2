import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {i2cLevelRoute} from '../public/i2c-level-shifter.mjs';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {compileCircuit} from '../src/circuit/compile';
import {buildNets,checkCircuit} from '../src/circuit/netlist';
import {makePart,parseCircuit,localTerminals,type Circuit} from '../src/circuit/model';
import {environmentCircuit} from '../src/circuit/environmentExamples';
import {i2cLevelCircuit} from '../src/circuit/i2cLevelExamples';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import {exportZip,importProject} from '../src/project/archive';
import {validateArtifact,buildFile} from '../public/arduino-contract.mjs';

const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>{const path=String(input).replace(/^\/app\/[^/]+\//,'');if(path.startsWith('/')||path.includes('..'))throw Error('Nedopušten testni resurs');return new Response(readFileSync(resolve('public',path)));};
test.after(()=>{globalThis.fetch=originalFetch;});
const fixture=()=>i2cLevelCircuit(environmentCircuit('bmp280'));
const wire=(c:Circuit,id:string,from:string,to:string)=>{const endpoint=(s:string)=>{const [component,pin]=s.split(':');return {component,pin};};c.wires.push({id,from:endpoint(from),to:endpoint(to),color:'#087f8c',points:[]});};
const unplug=(c:Circuit,id:string,pin:string)=>{c.wires=c.wires.filter(w=>![w.from,w.to].some(e=>e.component===id&&e.pin===pin));};
function open(c:Circuit,voltage=3.3){const events:any[]=[],config=compileCircuit(c,voltage===5?'avr':'micropython');const h=createCircuitHost((e:any)=>events.push(e),{circuit:config,logicVoltage:voltage,manualPublish:true});return {h,config,frame:()=>{h.flush();return events.filter(e=>e.type==='simulation').at(-1);}};}
const near=(v:number,n:number)=>assert(Math.abs(v-n)<.002,`${v} != ${n}`);
const converter=(c:Circuit)=>c.components.find(p=>p.kind==='i2cLevelShifter')!;
const sensor=(c:Circuit)=>c.components.find(p=>p.kind==='bmp280')!;
const ground=(c:Circuit)=>{const b=c.components.find(p=>p.kind==='board')!;return b.id+':'+localTerminals(b).find(t=>t.role==='ground')!.pin;};

test('explicit carrier pins, pull-up property and four independent signal nets survive parsing',()=>{
 const c=fixture(),d=converter(c),g=buildNets(c);
 assert.deepEqual(localTerminals(d).map(t=>t.pin),['LV','SDA_L','SCL_L','GND','HV','SDA_H','SCL_H']);
 assert.equal(new Set(['SDA_L','SCL_L','SDA_H','SCL_H'].map(pin=>g.byTerminal.get(d.id+':'+pin))).size,4);
 assert.deepEqual(parseCircuit(c),c);assert.deepEqual(checkCircuit(c).diagnostics,[]);
 const bad=structuredClone(c);delete converter(bad).properties.pullups;assert.throws(()=>parseCircuit(bad),/pull-up/);
});
test('routing requires both named channels on the same converter; no crossed or split path',()=>{
 const ds=[{id:'a',low:[1,2],high:[3,4]},{id:'b',low:[5,6],high:[7,8]}];
 assert.deepEqual(i2cLevelRoute(ds,[1,2],[3,4]),{direct:false,id:'a',fromVoltage:3.3,toVoltage:5});
 assert.equal(i2cLevelRoute(ds,[3,4],[1,2])?.toVoltage,3.3);
 assert.equal(i2cLevelRoute(ds,[1,2],[4,3]),null);assert.equal(i2cLevelRoute(ds,[1,6],[3,8]),null);
 assert.equal(i2cLevelRoute(ds,[1,2],[7,8]),null);assert.equal(i2cLevelRoute(ds,[1,2],[1,2])?.direct,true);
});
test('idle HIGH voltages stay at 3.3/5 V while real register writes and reads cross the converter',()=>{
 const c=fixture(),t=open(c),d=sensor(c);try{
  assert.equal(t.h.i2cConfig(0,8,9,100000),0);assert(t.h.i2cProbe(0,0x76));
  assert.equal(t.h.i2cTx(0,0x76,Uint8Array.of(0xd0),false),1);
  assert.deepEqual(Array.from(t.h.i2cRx(0,0x76,1,true)),[0x58]);
  const f=t.frame(),s=f.i2cLevelShifters.i2cLevel1;assert(s.powered);for(const ch of s.channels){near(ch.lowVolts,3.3);near(ch.highVolts,5);assert(ch.idle);assert(!ch.pulledLow);}
  assert(f.sensors[d.id].powered);assert(f.i2cTrace.some((r:any)=>r.operation==='R'&&r.bytes[0]===0x58));assert.equal(f.diagnostics.length,0);
 }finally{t.h.dispose();}
});
for(const pin of ['SDA_L','SCL_L','SDA_H','SCL_H'])test(`${pin}: a remote open-drain LOW reaches the other domain and release restores both HIGH levels`,()=>{
 const c=fixture(),b=makePart('button',950,500,'low');c.components.push(b);wire(c,'contact','low:A1','i2cLevel1:'+pin);wire(c,'return','low:B1',ground(c));
 const t=open(c);try{t.h.i2cConfig(0,8,9,100000);assert(t.h.i2cProbe(0,0x76));t.h.input({component:'low',pressed:true});
  const f=t.frame(),ch=f.i2cLevelShifters.i2cLevel1.channels[pin.startsWith('SDA')?0:1];near(ch.lowVolts,0);near(ch.highVolts,0);assert(ch.pulledLow);assert(!t.h.i2cProbe(0,0x76));
  t.h.input({component:'low',pressed:false});assert(t.h.i2cProbe(0,0x76));const restored=t.frame().i2cLevelShifters.i2cLevel1.channels;for(const x of restored){near(x.lowVolts,3.3);near(x.highVolts,5);}
 }finally{t.h.dispose();}
});
for(const pin of ['LV','HV','GND'])test(`missing ${pin} cannot be certified by phantom pull-up power; restoring the wire recovers ACK`,()=>{
 const c=fixture();unplug(c,'i2cLevel1',pin);const t=open(c);try{t.h.i2cConfig(0,8,9,100000);assert(!t.h.i2cProbe(0,0x76));assert(t.h.i2cTx(0,0x76,Uint8Array.of(0xd0),true)<0);assert(!t.frame().i2cLevelShifters.i2cLevel1.powered);}finally{t.h.dispose();}
 const good=open(fixture());try{good.h.i2cConfig(0,8,9,100000);assert(good.h.i2cProbe(0,0x76));}finally{good.h.dispose();}
});
test('disabling converter pull-ups leaves the board domain floating even if the remote module has pull-ups',()=>{
 const c=fixture();converter(c).properties.pullups=false;const t=open(c);try{t.h.i2cConfig(0,8,9,100000);assert(!t.h.i2cProbe(0,0x76));const ch=t.frame().i2cLevelShifters.i2cLevel1.channels[0];assert.equal(ch.lowVolts,null);near(ch.highVolts,5);}finally{t.h.dispose();}
});
test('external pull-ups on each domain restore an otherwise completely floating bus',()=>{
 const c=fixture(),d=converter(c);d.properties.pullups=false;sensor(c).properties.pullups=false;
 for(const [i,pin]of ['SDA_L','SCL_L','SDA_H','SCL_H'].entries()){
  const r=makePart('resistor',900,400+i*90,'pull'+i);r.properties.resistance=4700;c.components.push(r);
  wire(c,'r'+i,r.id+':1',d.id+':'+(pin.endsWith('_L')?'LV':'HV'));wire(c,'s'+i,r.id+':2',d.id+':'+pin);
 }
 const t=open(c);try{t.h.i2cConfig(0,8,9,400000);assert(t.h.i2cProbe(0,0x76));assert(t.frame().i2cLevelShifters.i2cLevel1.channels.every((c:any)=>c.idle));}finally{t.h.dispose();}
});
test('the converter supplies pull-ups when module pull-ups are disabled',()=>{
 const c=fixture();sensor(c).properties.pullups=false;const t=open(c);try{t.h.i2cConfig(0,8,9,100000);assert(t.h.i2cProbe(0,0x76));}finally{t.h.dispose();}
});
test('active HIGH against remote LOW reports a conflict instead of a valid logic transfer',()=>{
 const c=fixture(),b=makePart('button',900,400,'low');c.components.push(b);wire(c,'contact','low:A1','i2cLevel1:SDA_H');wire(c,'return','low:B1',ground(c));
 const t=open(c);try{t.h.input({component:'low',pressed:true});t.h.mode(8,1,0,1);assert(t.frame().diagnostics.some((d:any)=>d.code==='i2c-shifter-output-conflict'));}finally{t.h.dispose();}
});
test('active HIGH on an idle I2C net blocks ACK and a new input configuration recovers',()=>{
 const t=open(fixture());try{t.h.i2cConfig(0,8,9,100000);t.h.mode(8,1,0,1);assert(!t.h.i2cProbe(0,0x76));t.h.mode(8,0,0);assert(t.h.i2cProbe(0,0x76));}finally{t.h.dispose();}
});
test('a wrong external 5 V pull-up on the low GPIO domain is caught by runtime voltage checks',()=>{
 const c=fixture(),r=makePart('resistor',900,500,'wrongPull');r.properties.resistance=330;c.components.push(r);
 wire(c,'wrongRail','wrongPull:1','i2cLevel1:HV');wire(c,'wrongSignal','wrongPull:2','i2cLevel1:SDA_L');
 const t=open(c);try{t.h.i2cConfig(0,8,9,100000);assert(!t.h.i2cProbe(0,0x76));assert(t.frame().diagnostics.some((d:any)=>d.code==='i2c-shifter-gpio-overvoltage'));}finally{t.h.dispose();}
});
test('Nano A6/A7 cannot be used as the digital I2C side of a converter',async()=>{
 const p=await createUrsProject('i2cLevels','i2cBmp280','nano'),c=p.circuit as Circuit,board=c.components.find(p=>p.kind==='board')!;
 wire(c,'analogOnly',board.id+':A6','i2cLevel1:SDA_H');assert.throws(()=>compileCircuit(c,'avr'),/Nano A6\/A7/);
});
for(const pin of ['SDA_H','SCL_H'])test(`open ${pin} gives no ACK even though both converter sides still read HIGH`,()=>{
 const c=fixture();unplug(c,'i2cLevel1',pin);const t=open(c);try{t.h.i2cConfig(0,8,9,100000);assert(!t.h.i2cProbe(0,0x76));assert(t.frame().i2cLevelShifters.i2cLevel1.channels.every((c:any)=>c.idle));}finally{t.h.dispose();}
});
test('missing peripheral VCC or GND still prevents ACK behind a fully powered converter',()=>{
 for(const pin of ['VCC','GND']){const c=fixture();unplug(c,sensor(c).id,pin);const t=open(c);try{t.h.i2cConfig(0,8,9,100000);assert(!t.h.i2cProbe(0,0x76));assert(t.frame().i2cLevelShifters.i2cLevel1.powered);}finally{t.h.dispose();}}
});
test('static checks reject swapped signal labels, bypass, wrong supply/domain, protocol and cascade',()=>{
 let c=fixture();wire(c,'bypass','i2cLevel1:SDA_L','i2cLevel1:SDA_H');assert.throws(()=>compileCircuit(c),/odvojene/);
 c=fixture();unplug(c,'i2cLevel1','LV');wire(c,'wrong','i2cLevel1:HV','i2cLevel1:LV');assert.throws(()=>compileCircuit(c),/LV traži/);
 c=fixture();wire(c,'domain','esp32:J1.5','i2cLevel1:SDA_H');assert.throws(()=>compileCircuit(c),/GPIO pločice/);
 c=fixture();const w=c.wires.find(w=>w.id==='i2cLevel_SDA')!;w.to.pin='SCL';assert.throws(()=>compileCircuit(c),/zamijenjeni/);
 c=fixture();c.components.push(makePart('bmp280_spi',900,500,'spi'));wire(c,'spi','spi:SCK','i2cLevel1:SCL_H');assert.throws(()=>compileCircuit(c),/SPI/);
 c=fixture();c.components.push(makePart('i2cLevelShifter',900,500,'other'));wire(c,'chain','other:SDA_L','i2cLevel1:SDA_H');assert.throws(()=>compileCircuit(c),/Kaskada/);
});
function addLocalDevice(c:Circuit,kind:'bmp280'|'aht10'){
 const p=makePart(kind,900,500,'local');c.components.push(p);
 wire(c,'localVcc','local:VCC','i2cLevel1:LV');wire(c,'localGnd','local:GND',ground(c));
 wire(c,'localSDA','local:SDA','i2cLevel1:SDA_L');wire(c,'localSCL','local:SCL','i2cLevel1:SCL_L');
}
test('same-address devices across a converter remain an address collision',()=>{
 const c=fixture();addLocalDevice(c,'bmp280');assert.throws(()=>compileCircuit(c),/dijele I2C adresu/);
});
test('AHT10 retains its exclusive-bus rule across both voltage domains',()=>{
 const c=fixture();addLocalDevice(c,'aht10');assert.throws(()=>compileCircuit(c),/zasebnu I2C sabirnicu/);
});
test('different addresses may coexist on both sides without losing routing or ID bytes',()=>{
 const c=fixture();addLocalDevice(c,'bmp280');c.components.find(p=>p.id==='local')!.properties.address=0x77;const t=open(c);try{
  t.h.i2cConfig(0,8,9,100000);for(const address of [0x76,0x77]){assert(t.h.i2cProbe(0,address));t.h.i2cTx(0,address,Uint8Array.of(0xd0),false);assert.deepEqual(Array.from(t.h.i2cRx(0,address,1,true)),[0x58]);}
 }finally{t.h.dispose();}
});
for(const target of ['micropython','s3-cpp','uno','nano']as UrsTarget[])for(const id of ['i2cBmp280','i2cOled32'])test(`URS18 ${id}/${target}: exact retained source/artifact, opposite domain and ZIP round trip`,async()=>{
 const p=await createUrsProject('i2cLevels',id,target);assert.equal(p.circuit.kind,'editable');const c=p.circuit as Circuit,d=c.components.find(p=>p.kind==='bmp280'||p.kind==='ssd1306_32')!;
 assert.equal(d.properties.moduleVoltage,target==='uno'||target==='nano'?3.3:5);assert.deepEqual(importProject(exportZip(p),'i2c.zip'),p);
 assert(p.files['urs-upute.md'].includes('Otvoreni odvod'));assert(p.files['urs-upute.md'].includes('AN10441'));assert(!checkCircuit(c).diagnostics.length);
 const base=await createUrsProject(id==='i2cBmp280'?'weather':'displays',id==='i2cBmp280'?'bmp280':'oled32',target);
 for(const [name,source]of Object.entries(base.files).filter(([name])=>/\.(py|ino|h)$/.test(name)))assert.equal(p.files[name],source,name);
 if(p.language==='arduino-cpp'){await validateArtifact(p,JSON.parse(p.files[buildFile(p)]));assert.equal(p.files[buildFile(p)],base.files[buildFile(base)]);}
 const t=open(c,target==='uno'||target==='nano'?5:3.3);try{t.h.i2cConfig(0,target==='uno'||target==='nano'?18:8,target==='uno'||target==='nano'?19:9,100000);assert(t.h.i2cProbe(0,id==='i2cBmp280'?0x76:0x3c));assert(t.frame().i2cLevelShifters.i2cLevel1.powered);}finally{t.h.dispose();}
});
