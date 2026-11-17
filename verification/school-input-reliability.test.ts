import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import registry from '../school/grader/profiles.json';
import prior from './fixtures/24o-grading-profiles.json';
import seeds from './fixtures/24p-seeds.json';
import {gradeJob} from '../school/grader/official';
import {buttonSchedule} from '../school/grader/input-scenarios';
import {introductoryProject,alternateIntroductory,jobFor} from './school-introductory-fixture';
import {gradingSupport} from '../school/grader/coverage';

const profile=registry.profiles.find(p=>p.id==='24P-v2-button@2')!;
const old=registry.profiles.find(p=>p.id==='24O-v2-button@1')!;
const evidence:any[]=[];
async function run(label:string,code:string|undefined,seed:string,alternate=false,p:any=profile) {
  const project=alternate?alternateIntroductory(introductoryProject('button'),'button'):introductoryProject('button');
  if(code)project.files['main.py']=code;
  const job=jobFor(project,p,seed),result=await gradeJob(job,{root:process.cwd()});
  evidence.push({label,profileId:p.id,snapshotHash:job.snapshotHash,contractHash:job.contractHash,seed,result});
  assert.equal(result.status,'evaluated',JSON.stringify(result));return result;
}
const program=(expression:string,delay=20)=>`from machine import Pin\nfrom time import sleep_ms,ticks_ms\nb=Pin(5,Pin.IN,Pin.PULL_UP)\nl=Pin(4,Pin.OUT)\nwhile True:\n l.value(${expression})\n sleep_ms(${delay})\n`;
const timer=program('(ticks_ms() // 650) % 2');
const functionCode='from machine import Pin\nfrom time import sleep_ms\nbutton=Pin(5,Pin.IN,Pin.PULL_UP)\nled=Pin(4,Pin.OUT)\ndef active():\n return button.value()==0\nwhile True:\n led.value(active())\n sleep_ms(300)\n';
test.after(()=>{
  mkdirSync('docs/stage24p-evidence',{recursive:true});
  writeFileSync('docs/stage24p-evidence/input-reliability.json',JSON.stringify({format:'labosv2-input-reliability',version:1,sourceCommit:process.env.GITHUB_SHA??null,seeds,results:evidence},null,2)+'\n');
});
test('24P schedules vary initial level, transition times and long holds; all 79 previous contracts remain identical',()=>{
  assert.equal(prior.profiles.length,79);assert.deepEqual(registry.profiles.slice(0,79),prior.profiles);
  assert.equal(gradingSupport('intro/button','micropython').profileId,profile.id);
  const schedules=seeds.map(s=>buttonSchedule(s,720,1150));
  assert.equal(new Set(schedules.map(s=>JSON.stringify(s))).size,32);
  assert.equal(new Set(schedules.map(s=>s[0].pressed)).size,2);
  for(const schedule of schedules){assert.equal(schedule.length,9);assert.equal(schedule[1].pressed,schedule[2].pressed);assert.equal(schedule[3].pressed,schedule[4].pressed);assert(schedule[2].durationMs>=1440);}
  assert.notDeepEqual(buttonSchedule('0'.repeat(64),720,1150),buttonSchedule('0'.repeat(63)+'1',720,1150));
});
test('24P V2: reference, independent function at 300ms and other GPIO/algorithm pass all 32 saved seeds; timer and wrong algorithms fail',{timeout:300000},async()=>{
  for(const seed of seeds){
    const positive=await Promise.all([run('reference',undefined,seed),run('function-300ms',functionCode,seed),run('alternative-GPIO-250ms',undefined,seed,true)]);
    for(const r of positive)assert.equal(r.points,10,JSON.stringify(r));
    const negative=await Promise.all([
      run('timer-650ms',timer,seed),run('constant-led',program('1'),seed),
      run('inverted',program('b.value()'),seed),
    ]);
    for(const r of negative)assert.deepEqual(r.criteria.map((c:any)=>c.points),[3,0,0],JSON.stringify(r));
    const firstOnly=await run('first-press-only','from machine import Pin\nfrom time import sleep_ms\nb=Pin(5,Pin.IN,Pin.PULL_UP)\nl=Pin(4,Pin.OUT)\nseen=False\nwhile True:\n if not b.value(): seen=True\n l.value(seen)\n sleep_ms(20)\n',seed);
    assert.equal(firstOnly.criteria[2].points,0,JSON.stringify(firstOnly));
    const stopped=await run('stops-tracking',program('not b.value() if ticks_ms()<3600 else 0'),seed);
    assert.equal(stopped.criteria[2].points,0,JSON.stringify(stopped));
  }
});
test('24P V2: three identical jobs retain identical samples and criteria; legacy timer is still executed by its old contract',async()=>{
  const rows=[];for(let n=0;n<3;n++)rows.push(await run('repeat',undefined,seeds[0]));
  for(const r of rows.slice(1)){assert.deepEqual(r.samples,rows[0].samples);assert.deepEqual(r.criteria,rows[0].criteria);}
  assert.equal((await run('legacy-known-limitation',timer,'5'.repeat(64),false,old)).points,10);
});
test('24P V2: missing signal or common ground fails and a repaired snapshot recovers',async()=>{
  for(const pin of ['A1','B1']){
    const project=introductoryProject('button');if(project.circuit.kind!=='editable')throw Error('editable');
    const button=project.circuit.components.find(c=>c.kind==='button')!;
    const before=project.circuit.wires.length;
    project.circuit.wires=project.circuit.wires.filter(w=>![w.from,w.to].some(e=>e.component===button.id&&e.pin===pin));
    assert(project.circuit.wires.length<before,'missing test wire '+pin);
    const result=await gradeJob(jobFor(project,profile,seeds[0]),{root:process.cwd()});
    assert.equal(result.points,0,JSON.stringify(result));
  }
  assert.equal((await run('repaired',undefined,seeds[0])).points,10);
});

test('24P V2: a fast independent polling loop retains its early response throughout a long hold',async()=>{
  assert.equal((await run('fast-polling-1ms',program('not b.value()',1),seeds[0])).points,10);
});
