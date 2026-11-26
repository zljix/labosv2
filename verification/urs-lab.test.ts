import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {labForProject, labIds, createUrsLab, stationCode, ursLabSheets, type LabId} from '../src/lessons/ursLab';
import {parseProject} from '../src/project/model';
import type {ProjectCircuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {compileCircuit, type SimulationFrame} from '../src/circuit/compile';
import {AVREngine} from '../src/runtime/avrEngine';
import {Session} from '../public/session.mjs';

function editable(circuit:ProjectCircuit) {
  assert(circuit.kind === 'editable');
  return circuit;
}
const read = (file:string) => readFileSync('public' + file);
globalThis.fetch = async input => new Response(read(String(input)));
test('17 independent lab worksheets retain the three original tasks, Word, source and executable projects', async () => {
  assert.equal(labIds.length, 17);
  for (const id of labIds) {
    const project = parseProject(await createUrsLab(id));
    const sheet = ursLabSheets[id];
    assert.equal(labForProject(project), id);
    assert.equal(sheet.tasks.filter(Boolean).length, 3);
    assert.equal(read('/zbirke/urs-lv/' + id + '/' + sheet.word).subarray(0,2).toString(), 'PK');
    assert.deepEqual(checkCircuit(editable(project.circuit)).diagnostics.filter(d => d.severity === 'error'), [], id);
    if (id !== 'LV16') assert.equal(stationCode(project.files['main.ino']), read('/zbirke/urs-lv/' + id + '/' + sheet.files[0]).toString().replace(/\r\n/g,'\n'));
  }
  assert.match(ursLabSheets.LV12.tasks[2], /P1/);
});

async function nano(id:LabId) {
  const p = await createUrsLab(id);
  const binary = JSON.parse(p.files['avr-build.json']);
  let frame!:SimulationFrame, serial = '';
  const engine = new AVREngine(binary.hex, compileCircuit(editable(p.circuit),'avr'), event => {
    if (event.type === 'simulation') frame = event;
    if (event.type === 'console') serial += event.text;
  }, 8, binary.staticRamBytes);
  function advance(ms:number) {
    const end = engine.cpu.cycles + ms * 16000;
    while (engine.cpu.cycles < end) {
      engine.runCycles(Math.min(64000,end - engine.cpu.cycles));
      engine.frame();
    }
    return frame;
  }
  return {engine, advance, text:() => serial};
}

test('LV10 receives the virtual NEC command and LV12 drives the display and relay on the worksheet pins', async () => {
  const ir = await nano('LV10');
  try {
    ir.advance(100);
    ir.engine.input({component:'irRemote', irPress:1, irCommand:69, irHoldMs:0});
    ir.advance(230);
    assert.match(ir.text(), /adresa=0x0 naredba=0x45/);
  } finally {ir.engine.dispose();}
  const counter = await nano('LV12');
  try {
    assert.equal(counter.advance(100).actuators!.relays.relej.energized,false);
    counter.engine.input({component:'tipka4', pressed:true});
    const frame = counter.advance(160);
    assert.equal(frame.actuators!.relays.relej.energized,true);
    const display = Object.values(frame.tmDisplays!)[0];
    assert(display.on && display.bytes.some(Boolean));
  } finally {counter.engine.dispose();}
});

test('LV14 potentiometer and STOP change the motor command', async () => {
  const motor = await nano('LV14');
  try {
    motor.advance(260);
    motor.engine.input({component:'pot',position:100});
    motor.advance(270);
    assert.match(motor.text(),/PWM=255 RAD/);
    motor.engine.input({component:'tipka2',pressed:true});
    motor.advance(300);
    assert.match(motor.text(),/PWM=0 STOP/);
  } finally {motor.engine.dispose();}
});

test('LV15 and LV15B count electrical steps from the compiled worksheet sketch', async () => {
  for (const id of ['LV15','LV15B'] as const) {
    const lab = await nano(id);
    try {
      lab.advance(100);
      lab.engine.input({component:'tipka4',pressed:true});
      const s = lab.advance(id === 'LV15' ? 1760 : 800);
      assert.match(lab.text(),/GOTOVO/);
      if (id === 'LV15') assert.deepEqual(s.avr?.coils,{commands:512,steps:512,errors:0});
      else assert.equal(Object.values(s.steppers!.drivers)[0].accepted,100);
    } finally {lab.engine.dispose();}
  }
});

function worker() {
  const w = new Worker(new URL('./node-worker.mjs',import.meta.url));
  const shim:any = {postMessage:(data:any)=>w.postMessage(data), terminate:()=>w.terminate()};
  w.on('message',data=>shim.onmessage?.({data}));
  w.on('error',error=>shim.onerror?.(error));
  return shim;
}
test('LV16 executes the edited Structured Text and responds to START, STOP and loss of protection in the VM', async () => {
  const p = await createUrsLab('LV16');
  p.files['deklaracije.txt'] = p.files['deklaracije.txt'].replace('END_VAR','Ready : BOOL;\nT1 : TON;\nEND_VAR');
  p.files['program.txt'] += '\nReady := StopOK AND ProtectionOK AND NOT Motor;\nT1(IN := Motor, PT := T#100ms);';
  const session = new Session(worker,read('/machine.py').toString(),p.files[p.entryFile],{circuit:compileCircuit(editable(p.circuit))},()=>{},p.files);
  async function observe(pattern:RegExp) {
    session.text = '';
    await session.wait((s:any)=>s.status === 'error' || pattern.test(s.text),12000);
    assert.notEqual(session.status,'error',JSON.stringify(session.events.at(-1)));
    assert.match(session.text,pattern);
  }
  try {
    await observe(/MOTOR=0 .*READY=1/);
    session.input({component:'tipka4',pressed:true});
    await observe(/MOTOR=1 .*T1.Q=1/);
    session.input({component:'tipka5',pressed:true});
    await observe(/MOTOR=0 .*STOPOK=0 T1.Q=0/);
    session.input({component:'tipka5',pressed:false});
    await observe(/MOTOR=0 .*READY=1 START=1/);
    session.input({component:'tipka4',pressed:false});
    await observe(/START=0/);
    session.input({component:'tipka4',pressed:true});
    await observe(/MOTOR=1/);
    session.input({component:'tipka6',pressed:true});
    await observe(/MOTOR=0 PROTECTIONOK=0 READY=0/);
  } finally {await session.stop();}
});
