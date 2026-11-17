import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import registry from '../school/grader/profiles.json';
import seeds from './fixtures/24p-seeds.json';
import {gradeJob} from '../school/grader/official';
import {introductoryProject,alternateIntroductory} from './school-introductory-fixture';
import {starter,jobFor} from './school-contract-fixture';
import {wrongAnalog} from './school-analog-fixture';
import {wrongSensor} from './school-sensors-fixture';
import {wrongEvent} from './school-events-fixture';
import {wrongTouch} from './school-touch-fixture';
import {wrongRadio,radioStarter} from './school-radio-fixture';

const results:any[]=[];
async function run(label:string,project:any,p:any,seed=seeds[0]){
 const job=jobFor(project,p,seed),r=await gradeJob(job,{root:process.cwd()});
 results.push({label,profileId:p.id,target:job.target,seed,snapshotHash:job.snapshotHash,contractHash:job.contractHash,result:r});return r;
}
const profile=(id:string)=>registry.profiles.find(p=>p.id===id)!;
test.after(()=>{mkdirSync('docs/stage24p-evidence',{recursive:true});writeFileSync('docs/stage24p-evidence/interactive-audit.json',JSON.stringify({format:'labosv2-interactive-audit',version:1,sourceCommit:process.env.GITHUB_SHA??null,results},null,2)+'\n');});
function timedRegulator(p:any,duration:number){
 const replacement=`servo.angle([0,90,90,0,0,90,0,0,90,90,0,0,90,0][min(13,ticks_ms()//${duration})])`;
 const code=p.files['main.py'];p.files['main.py']='from time import ticks_ms\n'+code.replace('servo.angle(kut)',replacement);
 assert.notEqual(p.files['main.py'],'from time import ticks_ms\n'+code);return p;
}
test('24P regulator audit: preserved old timer exploit and new sensor-dependent contracts; references and alternatives across eight seeds',{timeout:300000},async()=>{
 for(const [oldId,newId]of [['24O-v5-regulator@1','24P-v5-regulator@2'],['24I-regulator@1','24P-regulator@2']]){
  const old=profile(oldId),p=profile(newId),make=()=>oldId.startsWith('24O')?Promise.resolve(introductoryProject('regulator')):starter(p.taskKey);
  const oldReplay=await run('legacy-timer-limitation',timedRegulator(await make(),old.contract!.scenario.stageDurationMs!),old,'5'.repeat(64));assert.equal(oldReplay.points,10);
  for(const seed of seeds.slice(0,8)){
   const correct=await run('reference',await make(),p,seed);assert.equal(correct.points,10,JSON.stringify(correct));
   const replay=await run('servo-ignores-temperature',timedRegulator(await make(),old.contract!.scenario.stageDurationMs!),p,seed);
   assert.deepEqual(replay.criteria.map((c:any)=>c.points),[3,0,0],JSON.stringify(replay));
  }
  if(newId.includes('v5'))assert.equal((await run('alternative-GPIO',alternateIntroductory(await make(),'regulator'),p)).points,10);
 }
});
test('24P general URS button uses seeded inputs on all four targets; unchanged old replay stays reproducible',{timeout:120000},async()=>{
 const p=profile('24P-button-led@2');
 for(const target of p.targets)assert.equal((await run('reference',await starter(p.taskKey,target as any),p)).points,10);
 const old=profile('24B-button-led@1'),timer=await starter(old.taskKey);timer.files['main.py']='from machine import Pin\nfrom time import sleep_ms,ticks_ms\nb=Pin(5,Pin.IN,Pin.PULL_UP)\nl=Pin(4,Pin.OUT)\nwhile True:\n l.value((ticks_ms()//250)%2)\n sleep_ms(10)\n';
 assert.equal((await run('legacy-timer-limitation',timer,old)).points,10);
 for(const seed of seeds.slice(0,8))assert.deepEqual((await run('timer-250ms',timer,p,seed)).criteria.map((c:any)=>c.points),[3,0,0]);
});
test('24P wider interactive audit rejects representative frozen, omitted, partial and forged outputs',{timeout:180000},async()=>{
 for(const [id,mutate]of [
  ['24C-adc-pwm@1',(p:any)=>wrongAnalog(p,'adc')],
  ['24D-dht22@1',(p:any)=>wrongSensor(p)],
  ['24E-ky040@1',(p:any)=>wrongEvent(p,'ky040')],
  ['24E-irLED@1',(p:any)=>wrongEvent(p,'irLED')],
  ['24J-touchRaw@1',(p:any)=>wrongTouch(p,'touchRaw')],
 ] as const){const p=profile(id),r=await run('negative-'+p.taskKey,mutate(await starter(p.taskKey)),p);assert.equal(r.criteria[1].points,0,JSON.stringify(r));assert.equal(r.criteria[2].points,0);}
 const p=profile('24M-radio@1'),r=await run('negative-radio',wrongRadio(await radioStarter()),p);assert(r.points<10,JSON.stringify(r));
});

test('24P V1 exact official timing stays distinct from the broader auxiliary local estimate',async()=>{
 const p=profile('24O-v1-led-time@1');
 for(const [on,off,points]of [[250,750,10],[300,700,8],[226,774,10],[225,775,8]]){
  const project=introductoryProject('led-time');project.files['main.py']=project.files['main.py'].replace('sleep_ms(250)',`sleep_ms(${on})`).replace('sleep_ms(750)',`sleep_ms(${off})`);
  const r=await run(`official-timing-${on}-${off}`,project,p);assert.equal(r.points,points,JSON.stringify(r));
 }
});
