import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {unzipSync,strFromU8} from 'fflate';
import {S3,UNO,NANO,BOARDS,requirePinUse} from '../src/boards/profiles';
import {SUPPORT_CATALOG,componentSupport} from '../src/boards/support';
import {newProject,parseProject,clone,editProject,type Project} from '../src/project/model';
import {deriveProject,boardChangePreview} from '../src/project/derive';
import {ProjectStore} from '../src/project/storage';
import {emptyCircuit,makePart,parseCircuit,localTerminals,type Circuit} from '../src/circuit/model';
import {buildNets,checkCircuit} from '../src/circuit/netlist';
import {exampleCircuit} from '../src/circuit/examples';
import {compileCircuit} from '../src/circuit/compile';
import {prepareRun} from '../src/runtime/adapter';
import {runtimeAvailability} from '../src/runtime/profiles';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';

function legacy(p:Project,version=2):any {
  const copy:any=clone(p);copy.schemaVersion=version;
  for(const field of ['language','runtimeProfile','entryFile','nodeId','target'])delete copy[field];
  if(version===1)copy.circuit={kind:'stage0-fixture',components:[],wires:[]};
  return copy;
}
const connect=(c:Circuit,a:string,p:string,b:string,q:string)=>c.wires.push({id:'w'+c.wires.length,from:{component:a,pin:p},to:{component:b,pin:q},color:'#087f8c',points:[]});

test('v1/v2 migration retains source, circuit, identity and settings without mutating input',()=>{
  const p=newProject('from helper import text\nprint(text)','Stari školski projekt');
  p.files['helper.py']='text="Živio svijet"';p.circuit=exampleCircuit('button');p.settings.activeFile='helper.py';p.settings.theme='dark';
  for(const version of [1,2]){
    const old=legacy(p,version),before=JSON.stringify(old),migrated=parseProject(old);
    assert.equal(migrated.schemaVersion,3);assert.equal(migrated.board.id,S3);assert.equal(migrated.language,'micropython');
    assert.equal(migrated.id,old.id);assert.equal(migrated.revision,old.revision);assert.deepEqual(migrated.files,old.files);
    assert.deepEqual(migrated.circuit,old.circuit);assert.deepEqual(migrated.settings,old.settings);
    assert.equal(JSON.stringify(old),before);assert.deepEqual(parseProject(migrated),migrated);
    assert.equal(prepareRun(migrated).source,p.files['main.py']);
  }
});
test('existing raw IndexedDB row migrates on read and preserves old snapshot until an explicit save',async()=>{
  const name='legacy-'+crypto.randomUUID(),store=await ProjectStore.open(name),p=legacy(newProject('print(77)'));
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const row={id:p.id,document:p,storageRevision:4,history:[{id:'old',savedAt:p.createdAt,label:'Stara snimka',project:clone(p)}]};
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(row);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  const read=(await store.get(p.id))!;assert.equal(read.document.schemaVersion,3);assert.equal(read.storageRevision,4);assert.equal(read.history[0].project.schemaVersion,2);
  const saved=await store.save(editProject(read.document,n=>{n.title='Migrirana kopija';}),4,'Izmjena');
  assert.equal(saved.storageRevision,5);assert.equal(saved.history[0].project.schemaVersion,2);assert.equal(saved.document.files['main.py'],'print(77)');store.close();db.close();
});
test('project rejects mixed boards, future profiles, wrong languages, entrypoint and runtime target',()=>{
  const p=newProject(undefined,'Uno',UNO);
  for(const mutation of [
    {language:'micropython'}, {runtimeProfile:{id:'micropython-wasm',version:1}}, {runtimeProfile:{id:'arduino-avr',version:2}},
    {entryFile:'main.py'}, {nodeId:'second'}, {target:{fqbn:'arduino:avr:nano'}}, {schemaVersion:4},
    {board:{...p.board,profileVersion:'99'}}, {circuit:emptyCircuit(NANO)}, {circuit:emptyCircuit(S3)},
    {circuit:{kind:'stage0-fixture',components:[],wires:[]}}, {files:{'main.py':'print(1)'}},
  ])assert.throws(()=>parseProject({...p,...mutation}));
  assert.throws(()=>parseProject({...legacy(newProject()),board:p.board}));
  assert.deepEqual(parseProject(p),p);
});
test('Uno/Nano pin profiles preserve aliases, PWM, ADC-only pins and distinct MCU mappings',()=>{
  assert.equal(BOARDS[NANO].pins.length,30);assert.equal(BOARDS[UNO].pins.length,32);
  for(const id of [UNO,NANO] as const){
    assert.deepEqual(BOARDS[id].pwmPins,[3,5,6,9,10,11]);
    assert.equal(requirePinUse(id,'A4','sda').gpio,18);assert.equal(requirePinUse(id,'A5','scl').gpio,19);
    assert.equal(requirePinUse(id,'D8','output').mcuPin,'PB0');
    assert.throws(()=>requirePinUse(id,'D8','pwm'));
    const c=emptyCircuit(id),b=c.components[0].id,g=buildNets(c);
    assert.ok(g.connected({component:b,pin:'GND'},{component:b,pin:'GND2'}));
    if(id===UNO){assert.ok(g.connected({component:b,pin:'A4'},{component:b,pin:'SDA'}));assert.equal(requirePinUse(UNO,'SDA','adc').gpio,18);assert.ok(!checkCircuit(c).diagnostics.some(d=>d.code==='gpio-shared'));}
  }
  for(const pin of ['A6','A7']){
    assert.equal(requirePinUse(NANO,pin,'adc').role,'analog');
    for(const cap of ['input','output','pwm']as const)assert.throws(()=>requirePinUse(NANO,pin,cap),/Samo analogni/);
    assert.throws(()=>requirePinUse(UNO,pin,'adc'));
  }
  const c=emptyCircuit(NANO),b=c.components[0].id;
  assert.ok(checkCircuit(c,[{endpoint:{component:b,pin:'A6'},level:1}]).diagnostics.some(d=>d.code==='analog-only'));
  assert.throws(()=>parseCircuit({...c,wires:[{id:'bad',from:{component:b,pin:'D20'},to:{component:b,pin:'GND'},color:'#334155',points:[]}]}));
});
test('electrical checks distinguish 5 V AVR input from 3.3 V ESP32 and 3.3 V-only modules',()=>{
  for(const id of [S3,UNO,NANO] as const){
    const c=emptyCircuit(id),b=c.components[0].id,pin=id===S3?'J1.4':'D4',power=id===S3?'J1.21':'5V';
    connect(c,b,pin,b,power);
    assert.equal(checkCircuit(c).diagnostics.some(d=>d.code==='gpio-overvoltage'),id===S3);
    connect(c,b,power,b,id===S3?'J1.22':'GND');assert.ok(checkCircuit(c).diagnostics.some(d=>d.code==='power-short'));
  }
  const c=emptyCircuit(UNO),b=c.components[0].id;c.components.push(makePart('aht10',500,80,'sensor'));
  connect(c,b,'5V','sensor','VCC');connect(c,b,'A4','sensor','SDA');
  const d=checkCircuit(c).diagnostics;assert.ok(d.some(d=>d.code==='device-overvoltage'));assert.ok(d.some(d=>d.code==='logic-domain'));
});
test('board derivation saves an independent source-preserving project and detaches every old board wire',()=>{
  const p=newProject('print("Izvorni kôd")');p.circuit=exampleCircuit('button');p.files['main.ino']='// Postojeći C++\nvoid setup() {}\nvoid loop() {}';
  const before=clone(p),preview=boardChangePreview(p,NANO),next=deriveProject(p,NANO);
  assert.ok(preview.detachedWires.length>0);assert.equal(preview.from.logicVoltage,3.3);assert.equal(preview.to.logicVoltage,5);
  assert.notEqual(next.id,p.id);assert.equal(next.revision,0);assert.deepEqual(next.files,p.files);assert.equal(next.entryFile,'main.ino');
  assert.deepEqual(p,before);assert.equal(next.circuit.kind,'editable');
  if(next.circuit.kind==='editable'&&p.circuit.kind==='editable'){
    const oldBoard=p.circuit.components.find(p=>p.kind==='board')!;
    assert.deepEqual(next.circuit.wires,p.circuit.wires.filter(w=>w.from.component!==oldBoard.id&&w.to.component!==oldBoard.id));
    assert.equal(next.circuit.components.length,p.circuit.components.length);
  }
  const back=deriveProject(next,S3);assert.equal(back.files['main.py'],p.files['main.py']);assert.equal(back.files['main.ino'],p.files['main.ino']);
  assert.throws(()=>deriveProject(p,S3));
});
test('breadboard 1–60 separates 30/31 rails, groups and centre channel without changing old 1–30',()=>{
  const c=emptyCircuit(NANO),bb=makePart('breadboard',300,80,'bb');bb.properties.breadboardColumns=60;c.components.push(bb);
  const g=buildNets(c),connected=(a:string,b:string)=>g.connected({component:'bb',pin:a},{component:'bb',pin:b});
  assert.equal(localTerminals(bb).length,840);assert.ok(connected('a60','e60'));assert.ok(!connected('e60','f60'));assert.ok(!connected('a59','a60'));
  assert.ok(connected('tp1','tp30'));assert.ok(connected('tp31','tp60'));assert.ok(!connected('tp30','tp31'));assert.ok(!connected('tp1','tn1'));
  connect(c,'bb','tp30','bb','tp31');assert.ok(buildNets(c).connected({component:'bb',pin:'tp1'},{component:'bb',pin:'tp60'}));
  assert.deepEqual(parseCircuit(c),c);assert.equal(localTerminals(makePart('breadboard')).length,420);
});
test('Arduino ZIP/JSON and IDE sketch preserve sources; runtime has an AVR-only circuit path',()=>{
  for(const id of [UNO,NANO] as const){
    const p=newProject(undefined,'Sketch',id);p.files['helper.h']='#pragma once';p.files['src/helper.cpp']='#include "../helper.h"';p.files['notes.py']='print("zapis")';
    assert.deepEqual(importProject(exportZip(p),'p.zip'),p);assert.deepEqual(importProject(new TextEncoder().encode(JSON.stringify(p)),'p.json'),p);
    const files=unzipSync(exportSketch(p));assert.ok(files['LabSketch/LabSketch.ino']);assert.ok(files['LabSketch/src/helper.cpp']);assert.ok(!files['LabSketch/notes.py']);
    assert.equal(strFromU8(files['LabSketch/LabSketch.ino']),p.files['main.ino']);assert.ok(strFromU8(files['LabSketch/README.txt']).includes(p.target.fqbn!));
    assert.equal(runtimeAvailability(id,'arduino-cpp').available,true);assert.equal(prepareRun(p).project.runtimeProfile.id,'arduino-avr');
    assert.throws(()=>compileCircuit(p.circuit as Circuit),/AVR/);
  }
  assert.throws(()=>exportSketch(newProject()));
});
test('support status depends on board, language and implemented model; planned devices remain planned',()=>{
  for(const board of [UNO,NANO] as const)for(const item of SUPPORT_CATALOG){assert.equal(componentSupport(item,board,'arduino-cpp').status,['i2cLevel','level','nrf','max30102','sd','rtc','xpt2046','ili9341','bmp280spi','st7735','stepper','power','relay','activeBuzzer','audio','sg90','dc','tm1637','ir','ky040','ds18b20','dht11','dht22','lm35','temt6000','ntc','ky023','flame','sound','breadboard','gpio','aht10','ssd1306','servo','bmp180','bmp280','am2320','oled32','lcd1602'].includes(item.id)?'experimental':'planned');assert.equal(componentSupport(item,board,'micropython').status,'unsupported');}
  const existing=SUPPORT_CATALOG.find(i=>i.id==='aht10')!,future=SUPPORT_CATALOG.find(i=>i.id==='buzzer')!;
  assert.equal(componentSupport(existing,S3,'micropython').status,'verified');assert.equal(componentSupport(future,S3,'micropython').status,'planned');
  assert.equal(componentSupport(existing,S3,'arduino-cpp').status,'experimental');
  const sd=SUPPORT_CATALOG.find(i=>i.id==='sd')!;assert.equal(componentSupport(sd,S3,'micropython').status,'experimental');assert.equal(componentSupport(sd,S3,'arduino-cpp').status,'experimental');
  const rtc=SUPPORT_CATALOG.find(i=>i.id==='rtc')!;assert.equal(componentSupport(rtc,S3,'micropython').status,'experimental');assert.equal(componentSupport(rtc,S3,'arduino-cpp').status,'experimental');
  const touch=SUPPORT_CATALOG.find(i=>i.id==='xpt2046')!;assert.equal(componentSupport(touch,S3,'micropython').status,'experimental');assert.equal(componentSupport(touch,S3,'arduino-cpp').status,'experimental');
  const ili=SUPPORT_CATALOG.find(i=>i.id==='ili9341')!;assert.equal(componentSupport(ili,S3,'micropython').status,'experimental');assert.equal(componentSupport(ili,S3,'arduino-cpp').status,'experimental');
});
