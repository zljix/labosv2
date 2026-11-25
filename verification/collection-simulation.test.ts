import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {practices,type ExerciseId} from '../src/lessons/collectionPlans';
import {readPractice} from '../src/lessons/collectionSimulation';
import {checkCircuit} from '../src/circuit/netlist';
import {compileCircuit} from '../src/circuit/compile';
import {Session} from '../dist/session.mjs';
import {createS3Engine} from '../public/s3-engine.mjs';
import {validateArtifact,wasmBytes} from '../public/s3-contract.mjs';

const root='.build/school-catalog/';
const catalog=JSON.parse(readFileSync(root+'catalog.json','utf8')).entries;
const markers={console:'Pozdrav iz Labosa',blink:'LED ON',light:'ADC:',pwm:'PWM %:',servo:'impuls_us:',temperature:'T_C:',calibration:'ispravljeno:',compare:'razlika:',model:'CLOSE',alarm:'alarm:',network:'PRIHVACENO',library:'cilj:'};
const machine=readFileSync('public/machine.py','utf8');
function worker(){
  const w=new Worker(new URL('./node-worker.mjs',import.meta.url));
  const shim:any={postMessage:(v:any)=>w.postMessage(v),terminate:()=>w.terminate()};
  w.on('message',data=>shim.onmessage?.({data}));w.on('error',e=>shim.onerror?.(e));
  return shim;
}
const exercised=new Set<string>();
for(const entry of catalog.filter((e:any)=>['iot','us'].includes(e.set))){
  for(const [edition,file] of Object.entries(entry.templates)){
    const p=JSON.parse(readFileSync(root+file,'utf8')),k=readPractice(p)!;
    const rig=practices[entry.lessonId as ExerciseId].rig;
    const circuit=compileCircuit(p.circuit);
    test(entry.key+' '+edition+' opens the matching validated project',async()=>{
      assert.equal(k.track,entry.set);assert.equal(k.exercise,entry.lessonId);
      assert.equal(k.edition,edition==='micropython'?'MicroPython':'Arduino');
      assert.deepEqual(checkCircuit(p.circuit).diagnostics.map(d=>d.code),rig==='console'?['empty']:[]);
      if(edition==='s3-cpp')await validateArtifact(p,JSON.parse(p.files['s3-build.json']));
    });
    const source=p.files[p.entryFile];
    if(exercised.has(source))continue;
    exercised.add(source);
    test(entry.key+' '+edition+' executes '+rig,async()=>{
      const expected=markers[rig];
      if(edition==='micropython'){
        const s=new Session(worker,machine,source,{circuit},()=>{},p.files);
        try{
          await s.wait((v:any)=>v.status==='error'||v.text.includes(expected)||/Pogreska|GRESKA/.test(v.text),15000);
          assert.equal(s.status,'running',JSON.stringify(s.events.at(-1)));
          assert(s.text.includes(expected),s.text);
          if(rig==='model'){
            s.input({component:'ds1',temperature:30});
            await s.wait((v:any)=>v.text.includes('OPEN'),9000);
          }
        }finally{await s.stop();}
      }else{
        let output='';
        const e=await createS3Engine(wasmBytes(JSON.parse(p.files['s3-build.json']).wasm),circuit,(v:any)=>{
          if(v.type==='console')output+=v.text;
        },{fast:true});
        try{
          await e.run(rig==='network'?8:1);
          assert(output.includes(expected),output);
          if(rig==='network')for(const message of ['DUPLIKAT','STARA','NEPOZNATA','OFFLINE','WAIT'])assert(output.includes(message),output);
        }finally{e.stop();}
      }
    });
  }
}
