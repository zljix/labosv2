import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SchoolCompilerClient} from '../src/platform/schoolCompiler';
import {SchoolApiError,schoolFingerprint} from '../src/platform/schoolSync';
import {projectWithBuild,rememberBuild} from '../src/runtime/arduinoBuild';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {UNO} from '../src/boards/profiles';
import {buildInput} from '../public/arduino-contract.mjs';
import {probeProject,targets,compileInteractive} from '../school/compiler/runner.mjs';

test('25A readiness probes use valid exact-source inputs for Uno, Nano and S3',()=>{
 for(const board of targets){const p=probeProject(board),input=buildInput(p);assert.equal(input.boardId,board);assert.match((input.files as any)['main.ino'],/731/);}
});
test('25A isolated runner never falls back to executing source on host',async()=>{
 const r=await compileInteractive(probeProject(targets[0]),{root:process.cwd()});
 assert.equal(r.status,'technical_error');assert(!('artifact'in r));
});
const project=()=>probeProject(targets[0]) as any;
test('25A network loss retries identical POST; wrong node cannot be accepted',async()=>{
 const calls:any[]=[];let count=0;
 const api={session:async()=>({user:{id:1}}),request:async(action:string,body?:any)=>{calls.push({action,body});
  if(++count===1)throw new TypeError('network');return {job:{id:7,status:'compiled',nodeId:'wrong-node',node:'A',target:targets[0]}};}};
 const c=new SchoolCompilerClient(api,async()=>{});
 await assert.rejects(c.compile(project(),undefined,()=>{}),/drugom čvoru/);
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
});
test('25A progress, cancellation and terminal diagnostic keep source position',async()=>{
 const states:string[]=[];let polls=0;
 const api={session:async()=>({}),request:async()=>({job:{id:4,nodeId:project().id,node:'A',target:targets[0],status:++polls===1?'queued':polls===2?'running':'compile_error',result:{message:'bad source',diagnostics:[{file:'main.ino',line:2,column:7,severity:'error',message:'expected ;'}]}}})};
 await assert.rejects(new SchoolCompilerClient(api,async()=>{}).compile(project(),undefined,s=>states.push(s)),(e:any)=>e.message==='bad source'&&e.diagnostics[0].line===2);
 assert(states.includes('U redu čekanja'));assert(states.includes('Prevođenje'));
});
test('25A disabled target fails promptly; 401 is never retried',async()=>{
 for(const [status,code] of [[503,'compiler_disabled'],[401,'account_changed']] as const){let n=0;const c=new SchoolCompilerClient({session:async()=>({}),request:async()=>{n++;throw new SchoolApiError('unavailable',status,code);}},async()=>{});await assert.rejects(c.compile(project(),undefined,()=>{}),/unavailable/);assert.equal(n,1);}
});
test('25A cancel during lost/late POST cancels returned job and never installs it',async()=>{
 let resolvePost:(v:any)=>void=()=>{};const actions:any[]=[];
 const c=new SchoolCompilerClient({session:async()=>({}),request:async(a:string,b?:any)=>{actions.push(a);if(a==='compile')return new Promise(r=>resolvePost=r);return {};}});
 const result=c.compile(project(),undefined,()=>{});await new Promise(r=>setImmediate(r));await c.cancel();
 resolvePost({job:{id:8}});await assert.rejects(result,/otkazano/);assert.deepEqual(actions,['compile','cancel-compile']);
});
test('25A source errors do not expose unrelated compiler path diagnostics',async()=>{
 const p=probeProject(targets[2]);
 const r=await compileInteractive(p,{root:process.cwd(),run:async()=>({status:'compile_error',message:'error',diagnostics:[{file:'main.ino',line:3},{file:'/toolchain/private',line:1}]})});
 assert.equal(r.status,'compile_error');assert.deepEqual(r.diagnostics,[{file:'main.ino',line:3}]);
});

test('25A temporary build powers a run copy without changing work fingerprint or revision',async()=>{
 const p=arduinoExampleProject('blink',UNO),a=JSON.parse(readFileSync('public/avr-examples.json','utf8'))[UNO].blink;
 delete p.files['avr-build.json'];const before=JSON.stringify(p),fingerprint=await schoolFingerprint(p);
 const map=new Map();const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)};
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
 try{await rememberBuild(p,a);const run=await projectWithBuild(p);assert.equal(JSON.parse(run.files['avr-build.json']).inputHash,a.inputHash);assert.equal(JSON.stringify(p),before);assert.equal(await schoolFingerprint(p),fingerprint);assert.equal(run.revision,p.revision);
 p.files['main.ino']+='\n// changed';await assert.rejects(projectWithBuild(p),/Najprije prevedi/);
 }finally{delete (globalThis as any).localStorage;}
});

test('25A invalid user library selection is a program input error, not a failed toolchain',async()=>{
 const p:any=probeProject(targets[0]);p.files['arduino-libraries.json']='invalid';const r=await compileInteractive(p,{root:process.cwd()});assert.equal(r.status,'compile_error');
});
