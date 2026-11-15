import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gradeJob,digest} from '../school/grader/official';
import registry from '../school/grader/profiles.json';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import type {Project} from '../src/project/model';

const root=process.cwd();
async function projectFor(key:string,target:UrsTarget='micropython'){
  const original=globalThis.fetch;
  try{globalThis.fetch=async(p:any)=>new Response(readFileSync('public/'+String(p).replace(/^\/app\/[^/]+\//,'')));
    const [lesson,variant]=key.split('/');return await createUrsProject(lesson,variant,target);
  }finally{globalThis.fetch=original;}
}
export function jobFor(project:Project,index=0){const p=registry.profiles[index],projectJson=JSON.stringify(project);return {
  format:'labosv2-grading-job',version:1,checkerVersion:p.checkerVersion??registry.checkerVersion,profileId:p.id,target:project.language==='micropython'?'micropython':project.board.id.includes('nano')?'nano':'uno',
  rubric:{profileId:p.id,criteria:p.criteria},seed:'1'.repeat(64),projectJson,snapshotHash:digest(projectJson),rubricHash:'2'.repeat(64)};}
const pyThreshold='from machine import Pin, ADC\nfrom time import sleep_ms\na=ADC(Pin(1),atten=ADC.ATTN_11DB)\nl=Pin(4,Pin.OUT)\nwhile True:\n l.value(a.read_u16()>=32768)\n sleep_ms(20)\n';
test('23E real isolated MicroPython: all three pilots, alternate solutions and distinct seeds',async()=>{
  for(let index=0;index<3;index++){
    const p=await projectFor(registry.profiles[index].taskKey);if(index===1)p.files['main.py']=pyThreshold;
    const job=jobFor(p,index),r=await gradeJob(job,{root});assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10);assert.equal(r.authority,'server-verified');assert.equal(r.snapshotHash,job.snapshotHash);
    const alternate=structuredClone(p);alternate.files['main.py']='# Drugo ispravno rješenje\n'+alternate.files['main.py'];
    if(index===0)alternate.files['main.py']='from machine import Pin\nimport time\nu=Pin(5,Pin.IN,Pin.PULL_UP)\nl=Pin(4,Pin.OUT)\nwhile True:\n l.value(1-u.value())\n time.sleep_ms(15)\n';
    if(index===0&&alternate.circuit.kind==='editable'){
      const board=alternate.circuit.components.find(p=>p.kind==='board')!.id;
      for(const wire of alternate.circuit.wires)for(const terminal of [wire.from,wire.to])if(terminal.component===board)terminal.pin=({'J1.4':'J1.7','J1.5':'J1.6'} as Record<string,string>)[terminal.pin]??terminal.pin;
      alternate.files['main.py']=alternate.files['main.py'].replace('Pin(5,','Pin(6,').replace('Pin(4,','Pin(7,');
    }
    if(index===1)alternate.files['main.py']=pyThreshold.replace('a.read_u16()>=32768','a.read()>=2048');
    if(index===2)alternate.files['main.py']=alternate.files['main.py'].replace('%.2f','%.1f');
    if(alternate.circuit.kind==='editable')for(const part of alternate.circuit.components){part.x+=50;part.y+=40;}
    const changed=jobFor(alternate,index);changed.seed='a'.repeat(64);
    const a=await gradeJob(changed,{root});assert.equal(a.points,10,JSON.stringify(a));
    if(index===2)assert.notDeepEqual(r.samples,a.samples);
  }
});
test('23E real Uno/Nano exact-source button and I2C pilots ignore incoming forged binaries',async()=>{
  for(const target of ['uno','nano'] as const)for(const index of [0,2]){
    const p=await projectFor(registry.profiles[index].taskKey,target);p.files['avr-build.json']='{"hex":"FORGED","points":999}';
    const r=await gradeJob(jobFor(p,index),{root});assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'trusted-catalogue-exact-source');
  }
});
test('23E wrong code, threshold boundary, stale sensor and disconnected I2C do not receive full points',async()=>{
  const button=await projectFor('gpio/button');button.files['main.py']='from machine import Pin\nfrom time import sleep_ms\nl=Pin(4,Pin.OUT,value=0)\nwhile True:\n print("points=10")\n sleep_ms(10)\n';
  const r=await gradeJob(jobFor(button),{root});assert.equal(r.status,'evaluated');assert.equal(r.points,3);assert.equal(r.criteria[1].points,0);
  const analog=await projectFor('gpio/adc');analog.files['main.py']=pyThreshold.replace('>=32768','>32776');
  const a=await gradeJob(jobFor(analog,1),{root});assert.equal(a.points,8,JSON.stringify(a));assert.equal(a.criteria[2].points,0);
  const sensor=await projectFor('weather/bmp280');sensor.files['main.py']=sensor.files['main.py'].replace('    temperatura, vrijednost = senzor.read()','    temperatura, vrijednost = 24, 101325');
  const s=await gradeJob(jobFor(sensor,2),{root});assert.equal(s.points,0,JSON.stringify(s));
  const disconnected=await projectFor('weather/bmp280');if(disconnected.circuit.kind==='editable')disconnected.circuit.wires=disconnected.circuit.wires.filter(w=>w.from.pin!=='SDA'&&w.to.pin!=='SDA');
  const d=await gradeJob(jobFor(disconnected,2),{root});assert.equal(d.points,0,JSON.stringify(d));
});
test('23E checker rejects altered binding, unsupported target and stale AVR artefact',async()=>{
  const p=await projectFor('gpio/button');const j=jobFor(p);
  assert.equal((await gradeJob({...j,projectJson:j.projectJson+' '},{root})).status,'unsupported');
  assert.equal((await gradeJob({...j,target:'s3-cpp'},{root})).points,null);
  const avr=await projectFor('gpio/button','uno');avr.files['main.ino']+='\n// source differs\n';
  const r=await gradeJob(jobFor(avr),{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);
});
test('23E rubric binding is independent of database JSON object-key order',async()=>{
  const j=jobFor(await projectFor('gpio/button'));
  j.rubric.criteria=j.rubric.criteria.map(c=>({maxPoints:c.maxPoints,description:c.description,id:c.id}));
  const r=await gradeJob(j,{root});assert.equal(r.points,10,JSON.stringify(r));
});
test('23E no guest JavaScript access to Node, checker, stimulus or process stdout',async()=>{
  const p=await projectFor('gpio/button');
  for(const code of ['import js\njs.process.stdout.write("FORGED")','import js\njs.Module.labHost.input({})','import js\njs.eval("process.stdout.write(123)")']){
    p.files['main.py']=code;const r=await gradeJob(jobFor(p),{root});assert.equal(r.status,'program_error',JSON.stringify(r));assert.notEqual(r.points,10);
  }
});
test('23E syntax error is separate from a timeout or infrastructure failure',async()=>{
  const p=await projectFor('gpio/button');p.files['main.py']='while :\n';const syntax=await gradeJob(jobFor(p),{root});assert.equal(syntax.status,'program_error');assert.equal(syntax.points,0);
  p.files['main.py']='while True:\n pass\n';const busy=await gradeJob(jobFor(p),{root,timeoutMs:700});assert.equal(busy.status,'execution_limit');assert.equal(busy.points,null);
});
test('23E isolated local compiler validates new source for all three Uno/Nano pilots',{skip:!process.env.LAB_GRADING_COMPILER_TEST,timeout:180000},async()=>{
  for(const target of ['uno','nano'] as const)for(let index=0;index<3;index++){
    const p=await projectFor(registry.profiles[index].taskKey,target);
    if(index===0)p.files['main.ino']='void setup(){pinMode(2,INPUT_PULLUP);pinMode(9,OUTPUT);}\nvoid loop(){digitalWrite(9,!digitalRead(2));delay(15);}\n';
    else if(index===1)p.files['main.ino']='void setup(){pinMode(9,OUTPUT);}\nvoid loop(){digitalWrite(9,analogRead(A0)>=512);delay(20);}\n';
    else p.files['main.ino']+='\n// New source, compiled in isolation\n';
    const r=await gradeJob(jobFor(p,index),{root,compile:true,cli:process.env.LAB_ARDUINO_CLI,data:process.env.LAB_ARDUINO_DATA});assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
  }
});
