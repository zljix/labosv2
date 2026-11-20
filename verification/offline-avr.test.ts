import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,copyFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {UNO,NANO,S3} from '../src/boards/profiles';
import {compile,unpackSDK} from '../prototypes/avr-offline/compiler.mjs';
import runtime from '../prototypes/avr-offline/runtime-manifest.json';
import {OfflineCompileTask,offlineInput,offlineIdentity,beginOffline,saveOffline,loadOffline,prefersOffline,preferStandard,importIntegratedProject} from '../src/runtime/offlineAvr';
import {validateArtifact,libraryManifest,AVR_LIBRARIES} from '../public/avr-contract.mjs';
import {assetURL} from '../prototypes/avr-offline/package.mjs';
const dir=resolve('.build/avr-toolchain'),require=createRequire(import.meta.url);
for(const name of ['cc1','cc1plus','avr-as','avr-ld','objcopy'])await copyFile(dir+'/'+name+'.js',dir+'/'+name+'.cjs');
const sdk=unpackSDK(await readFile(dir+'/'+runtime.sdkFile));
const p=arduinoExampleProject('blink',UNO);
p.files['main.ino']='void setup(){Serial.begin(9600);Serial.println("INTEGRATED_FIXTURE");pinMode(13,OUTPUT);digitalWrite(13,HIGH);}\nvoid loop(){delay(100);}';
const result=await compile(offlineInput(p),{sdk,factory:async(name:string)=>require(dir+'/'+name+'.cjs')});
await writeFile('.build/avr-integrated-fixture.json',JSON.stringify(p));
function store(){const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);}};}
test('integrated result is bound to source, board and libraries, never accepted as CLI',async()=>{
 const s=store();beginOffline(p,s);assert(prefersOffline(p,s));await assert.rejects(()=>loadOffline(p,s));
 assert(await saveOffline(p,result,s));assert.equal((await loadOffline(p,s)).hexHash,result.hexHash);
 const changed=structuredClone(p);changed.files['main.ino']+='\n// edited';await assert.rejects(()=>loadOffline(changed,s));
 const libraries=structuredClone(p);libraries.files['arduino-libraries.json']=libraryManifest([AVR_LIBRARIES.find((l:any)=>l.name==='Bounce2')]);await assert.rejects(()=>loadOffline(libraries,s));
 const nano=arduinoExampleProject('blink',NANO);nano.id=p.id;nano.files['main.ino']=p.files['main.ino'];await assert.rejects(()=>loadOffline(nano,s));
 await assert.rejects(()=>validateArtifact(p,result));
 const before=JSON.stringify(p);beginOffline(p,s);await assert.rejects(()=>loadOffline(p,s));assert.equal(JSON.stringify(p),before);
});
test('corrupted stored program cannot run and UI-only edits do not recompile',async()=>{
 const s=store(),q=structuredClone(p);q.id=crypto.randomUUID();s.setItem('labos-integrated-avr-v1:'+q.id,JSON.stringify({...result,hex:result.hex+'x'}));
 await assert.rejects(()=>loadOffline(q,s),/Oštećen/);
 const ui=structuredClone(p);ui.revision++;ui.files['notes.txt']='notes';ui.settings.activeFile='notes.txt';assert.equal(offlineIdentity(ui),offlineIdentity(p));
});
test('unsupported and school-bound projects rejected before worker launch',()=>{
 const q=structuredClone(p);q.files['src/helper.cpp']='int x=1;';assert.throws(()=>offlineInput(q),/korijenu/);
 const school=structuredClone(p);school.files['school-attempt.json']=JSON.stringify({format:'labosv2-school-attempt',version:1,origin:'https://school.test',projectId:'abcdefgh',userId:1,attemptId:1,assignmentId:1,revision:1,fingerprint:'a'.repeat(64)});
 assert.throws(()=>offlineInput(school),/školski/);
 const s3=structuredClone(p);s3.board.id=S3;assert.throws(()=>offlineInput(s3));
});
class FakeWorker {
 onmessage:any;onerror:any;terminated=false;messages:any[]=[];
 postMessage(m:any){this.messages.push(m);}terminate(){this.terminated=true;}
 send(data:any){this.onmessage({data});}
}
test('cancel terminates worker, rejects job, ignores late output; next compile validates result',async()=>{
 const workers:FakeWorker[]=[];const task=new OfflineCompileTask(()=>{const w=new FakeWorker();workers.push(w);return w as unknown as Worker;});
 const pending=task.compile(p);const rejected=assert.rejects(pending,/otkazano/);task.cancel();await rejected;assert(workers[0].terminated);
 workers[0].send({type:'compiled',result});
 const next=task.compile(p);workers[1].send({type:'compiled',result});assert.equal((await next).hexHash,result.hexHash);assert(workers[1].terminated);
 const bad=task.compile(p);workers[2].send({type:'compiled',result:{...result,inputHash:'bad'}});await assert.rejects(bad,/promijenjeni/);assert(workers[2].terminated);
});
test('timeout and worker errors release the task',async()=>{
 const w=new FakeWorker(),task=new OfflineCompileTask(()=>w as unknown as Worker,10);
 await assert.rejects(task.compile(p),/60 sekundi/);assert(w.terminated);
 const w2=new FakeWorker(),task2=new OfflineCompileTask(()=>w2 as unknown as Worker);
 const promise=task2.compile(p);w2.onerror({message:'broken worker'});await assert.rejects(promise,/broken worker/);assert(w2.terminated);
});
test('package paths match page and classic worker under nested application prefix',()=>{
 assert.equal(assetURL('cc1.js','https://host.test/labos/offline-avr/'),'https://host.test/labos/offline-avr/toolchain/cc1.js');
 assert.equal(assetURL('cc1.js','https://host.test/labos/offline-avr/worker.js'),'https://host.test/labos/offline-avr/toolchain/cc1.js');
});

test('prototype export imports as project and validated separate result',async()=>{
 const {projectBundle}=await import('../prototypes/avr-offline/project-bridge');
 const bundle=await projectBundle(p,result),bytes=new TextEncoder().encode(JSON.stringify(bundle));
 const imported=await importIntegratedProject(bytes,'project_offline.json');
 assert.equal(imported.project.id,p.id);assert.equal(imported.result.hexHash,result.hexHash);
 bundle.result.hex+='x';await assert.rejects(()=>importIntegratedProject(new TextEncoder().encode(JSON.stringify(bundle)),'bad.json'),/Oštećen/);
 const standard=await importIntegratedProject(new TextEncoder().encode(JSON.stringify(p)),'normal.json');assert.equal(standard.result,null);
});

test('selecting the standard compiler removes offline result and run preference',async()=>{
 const previous=globalThis.localStorage,m=new Map<string,string>();
 const storage={getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);}};
 Object.assign(globalThis,{localStorage:storage});
 try{const q=structuredClone(p);q.id=crypto.randomUUID();await saveOffline(q,result);assert(prefersOffline(q));preferStandard(q);assert.equal(prefersOffline(q),false);await assert.rejects(()=>loadOffline(q));}
 finally{Object.assign(globalThis,{localStorage:previous});}
});
