import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import registry from '../school/grader/profiles.json';
import {gradeJob} from '../school/grader/official';
import {starter,solution,jobFor,compilerOptions} from './school-contract-fixture';
import {alternateEnvironment} from './school-environment-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';

const target=process.env.LAB_REMEDIATION_CPP_TARGET as UrsTarget,results:any[]=[];
test('24P fresh isolated C++ compilation: independent correct algorithms and timer-only errors',{skip:!target,timeout:600000},async()=>{
 assert(['s3-cpp','uno','nano'].includes(target));
 async function check(label:string,project:any,profile:any,expected:number){
  const job=jobFor(project,profile),report=await gradeJob(job,compilerOptions());
  results.push({label,profileId:profile.id,target,seed:job.seed,snapshotHash:job.snapshotHash,contractHash:job.contractHash,result:report});
  assert.equal(report.status,'evaluated',JSON.stringify(report));assert.equal(report.points,expected,JSON.stringify(report));
  assert.equal(report.provenance?.method,'isolated-source-compilation');
 }
 for(const id of ['24P-button-led@2','24P-regulator@2','24B-led-timing@1']){
  const p=registry.profiles.find(p=>p.id===id)!,original=await starter(p.taskKey,target);
  const correct=id==='24P-regulator@2'?alternateEnvironment(original,'regulator'):solution(original,p,true);
  correct.files['main.ino']='// Independent 24P source compilation\n'+correct.files['main.ino'];
  await check('independent-correct-source',correct,p,10);
  if(id==='24P-button-led@2'){
   const wrong=await starter(p.taskKey,target),s3=target==='s3-cpp',led=s3?4:9,button=s3?5:2;
   wrong.files['main.ino']=`void setup(){pinMode(${button},INPUT_PULLUP);pinMode(${led},OUTPUT);}void loop(){digitalWrite(${led},(millis()/250)%2);delay(10);}\n`;
   await check('timer-ignores-button',wrong,p,3);
  }
  if(id==='24P-regulator@2'){
   const wrong=await starter(p.taskKey,target),s3=target==='s3-cpp',code=wrong.files['main.ino'];
   const values='0,90,90,0,0,90,0,0,90,90,0,0,90,0';
   wrong.files['main.ino']=s3?code.replace('int pulse=opened?1500:500;',`static const int scripted[]={${values}};int stage=millis()/3000;int pulse=scripted[stage<14?stage:13]?1500:500;`):
    code.replace('int kut = otvoreno ? 90 : 0;',`static const int scripted[]={${values}};int stage=millis()/3000;int kut=scripted[stage<14?stage:13];`);
   assert.notEqual(wrong.files['main.ino'],code);await check('timer-ignores-temperature',wrong,p,3);
  }
 }
 mkdirSync('docs/stage24p-evidence',{recursive:true});
 writeFileSync(`docs/stage24p-evidence/compiled-${target}.json`,JSON.stringify({format:'labosv2-remediation-cpp',version:1,sourceCommit:process.env.GITHUB_SHA??null,target,results},null,2)+'\n');
});
