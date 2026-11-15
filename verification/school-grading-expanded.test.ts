import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gradeJob,digest} from '../school/grader/official';
import registry from '../school/grader/profiles.json';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import type {Project} from '../src/project/model';

const root=process.cwd(),newProfiles=registry.profiles.filter(p=>p.id.startsWith('23G-'));
async function starter(taskKey:string,target:UrsTarget='micropython'){
  const original=globalThis.fetch;globalThis.fetch=async(p:any)=>new Response(readFileSync('public/'+String(p).replace(/^\/app\/[^/]+\//,'')));
  try{const [lesson,variant]=taskKey.split('/');return await createUrsProject(lesson,variant,target);}finally{globalThis.fetch=original;}
}
function solution(p:Project){
  if(p.files['urs-vjezba.json']?.includes('blink')){
    const file=p.language==='micropython'?'main.py':'main.ino';
    p.files[file]=p.language==='micropython'?'from machine import Pin\nfrom time import sleep_ms\nl=Pin(4,Pin.OUT)\nwhile True:\n l.on()\n sleep_ms(250)\n l.off()\n sleep_ms(750)\n':
      'void setup(){pinMode(9,OUTPUT);}\nvoid loop(){digitalWrite(9,HIGH);delay(250);digitalWrite(9,LOW);delay(750);}\n';
  }
  return p;
}
function jobFor(p:Project,profile:typeof newProfiles[number]){const projectJson=JSON.stringify(p);return {
  format:'labosv2-grading-job',version:1,checkerVersion:profile.checkerVersion,profileId:profile.id,
  target:p.language==='micropython'?'micropython':p.board.id.includes('nano')?'nano':'uno',rubric:{profileId:profile.id,criteria:profile.criteria},
  seed:'5'.repeat(64),projectJson,snapshotHash:digest(projectJson),rubricHash:'2'.repeat(64)};}

test('23G isolated MicroPython: LED timing, LM35 and BMP180; distinct seeds and alternate sources',{timeout:120000},async()=>{
  for(const profile of newProfiles){
    const p=solution(await starter(profile.taskKey));
    const r=await gradeJob(jobFor(p,profile),{root});assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));
    const alternate=structuredClone(p);alternate.files['main.py']='# Neovisno drugo rješenje\n'+alternate.files['main.py'];
    if(profile.kind==='blink')alternate.files['main.py']=alternate.files['main.py'].replace('l.on()','l.value(True)').replace('l.off()','l.value(False)');
    if(profile.kind==='lm35')alternate.files['main.py']='from machine import Pin,ADC\nimport time\na=ADC(Pin(1),atten=ADC.ATTN_11DB)\nwhile True:\n print("T=%.2f" % (a.read()*310/4095))\n time.sleep_ms(200)\n';
    if(alternate.circuit.kind==='editable')for(const part of alternate.circuit.components){part.x+=30;part.y+=20;}
    const j=jobFor(alternate,profile);j.seed='a'.repeat(64);
    const a=await gradeJob(j,{root});assert.equal(a.points,10,JSON.stringify(a));
    if(profile.kind!=='blink')assert.notDeepEqual(a.samples,r.samples);
  }
});
test('23G negative programs and physical connections cannot earn full points',{timeout:120000},async()=>{
  const blink=newProfiles[0],p=solution(await starter(blink.taskKey));
  p.files['main.py']=p.files['main.py'].replace('250','500').replace('750','500');
  const wrongTiming=await gradeJob(jobFor(p,blink),{root});assert.equal(wrongTiming.points,8,JSON.stringify(wrongTiming));assert.equal(wrongTiming.criteria[2].points,0);
  p.files['main.py']='from machine import Pin\nfrom time import sleep_ms\nl=Pin(4,Pin.OUT,value=1)\nwhile True:\n sleep_ms(100)\n';
  assert.equal((await gradeJob(jobFor(p,blink),{root})).points,3);
  const lm35=newProfiles[1];for(const code of ['from time import sleep_ms\nwhile True:\n print("T=25.0")\n sleep_ms(200)\n',
    'from machine import Pin,ADC\nfrom time import sleep_ms\na=ADC(Pin(1),atten=ADC.ATTN_11DB)\nt=a.read_uv()/10000\nwhile True:\n print("T=%.2f"%t)\n sleep_ms(200)\n']){
    const s=await starter(lm35.taskKey);s.files['main.py']=code;const r=await gradeJob(jobFor(s,lm35),{root});assert(r.points<10,JSON.stringify(r));assert.equal(r.criteria[1].points,0);
  }
  for(const profile of newProfiles){
    const s=solution(await starter(profile.taskKey));assert.equal(s.circuit.kind,'editable');
    if(s.circuit.kind==='editable')s.circuit.wires=s.circuit.wires.filter(w=>![w.from.pin,w.to.pin].includes(profile.kind==='sensor'?'SDA':profile.kind==='lm35'?'OUT':'A'));
    const r=await gradeJob(jobFor(s,profile),{root});assert.equal(r.points,0,JSON.stringify(r));
  }
  const s=await starter(lm35.taskKey);if(s.circuit.kind==='editable')for(const wire of s.circuit.wires)if(wire.to.pin==='VCC')wire.from.pin='J1.1';
  const r=await gradeJob(jobFor(s,lm35),{root});assert.equal(r.points,0,JSON.stringify(r));
  const slow=await starter(lm35.taskKey);slow.files['main.py']=slow.files['main.py'].replace('sleep_ms(300)','sleep_ms(600)');
  assert.notEqual((await gradeJob(jobFor(slow,lm35),{root})).points,10);
  const bmp=newProfiles[2],sensor=await starter(bmp.taskKey);sensor.files['main.py']=sensor.files['main.py'].replace('temperatura, vrijednost = senzor.read()','temperatura, vrijednost = 25, 100000');
  assert.equal((await gradeJob(jobFor(sensor,bmp),{root})).points,0);
  const stale=await starter(bmp.taskKey);stale.files['main.py']=stale.files['main.py'].replace('sleep_ms(2100)','sleep_ms(4000)');
  assert.notEqual((await gradeJob(jobFor(stale,bmp),{root})).points,10);
});
test('23G exact-source Uno/Nano sensor examples; changed source requires the compiler',{timeout:120000},async()=>{
  for(const target of ['uno','nano'] as const)for(const profile of newProfiles){
    const p=await starter(profile.taskKey,target);p.files['avr-build.json']='{"hex":"FORGED","points":99}';
    const r=await gradeJob(jobFor(p,profile),{root});assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,profile.kind==='blink'?8:10,JSON.stringify(r));
    p.files['main.ino']+='\n// New source requires a new isolated compilation.\n';
    const changed=await gradeJob(jobFor(p,profile),{root});assert.equal(changed.status,'unsupported');assert.equal(changed.points,null);
  }
});
test('23G new Uno/Nano source is compiled independently for each new rubric',{
  skip:!process.env.LAB_GRADING_COMPILER_TEST,timeout:180000},async()=>{
  for(const target of ['uno','nano'] as const)for(const profile of newProfiles){
    const p=solution(await starter(profile.taskKey,target));p.files['main.ino']+='\n// Independently compiled 23G source.\n';
    const r=await gradeJob(jobFor(p,profile),{root,compile:true,cli:process.env.LAB_ARDUINO_CLI,data:process.env.LAB_ARDUINO_DATA});
    assert.equal(r.status,'evaluated',JSON.stringify(r));assert.equal(r.points,10,JSON.stringify(r));assert.equal(r.provenance.method,'isolated-source-compilation');
  }
});
test('23G version binding preserves old rubrics and rejects unapproved checker/target pairs',async()=>{
  const profile=newProfiles[1],p=await starter(profile.taskKey),j=jobFor(p,profile);
  for(const change of [{checkerVersion:'23E.1'},{target:'s3-cpp'},{profileId:'23E-bmp280@1'}]){
    const r=await gradeJob({...j,...change},{root});assert.equal(r.status,'unsupported');assert.equal(r.points,null);
  }
});
