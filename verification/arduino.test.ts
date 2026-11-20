import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {once} from 'node:events';
import {UNO,NANO} from '../src/boards/profiles';
import {newProject,clone,parseProject,type Project} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {unzipSync,strFromU8} from 'fflate';
import {AVR_BUILD_FILE,AVR_LIBRARY_FILE,AVR_LIBRARIES,inputHash,libraryManifest,selectedLibraries,validateArtifact,buildInput,validArduinoPath} from '../public/avr-contract.mjs';
import {compileProject,parseDiagnostics} from '../scripts/avr-compile.mjs';
import {createBridge} from '../scripts/avr-serve.mjs';
import {cachedBuild,rememberBuild,clearBuildCache,arduinoSubmission,readArduinoWork} from '../src/runtime/arduinoBuild';
import {compilerLink} from '../src/runtime/useArduinoCompiler';
import {AVREngine} from '../src/runtime/avrEngine';
import {compileCircuit} from '../src/circuit/compile';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
const real=!!process.env.LAB_ARDUINO_CLI;
const old=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const program=`#include <Bounce2.h>
#include "pomoc.h"
Bounce2::Button tipkalo;
void setup(){Serial.begin(9600);tipkalo.attach(2,INPUT_PULLUP);tipkalo.interval(5);tipkalo.setPressedState(LOW);pinMode(13,OUTPUT);Serial.println(poruka());}
void loop(){tipkalo.update();digitalWrite(13,tipkalo.isPressed());}
`;
function multi(board:typeof UNO|typeof NANO=UNO){const p=newProject(program,'Više datoteka',board);p.files['pomoc.h']='#pragma once\nconst char* poruka();\n';p.files['src/pomoc.cpp']='#include "../pomoc.h"\nconst char* poruka(){return "ETAPA9";}\n';p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'Bounce2',version:'2.72'}]);return p;}
const results:Record<string,any>={};

test('legacy builds stay valid; library version and bytes enter the exact input hash',async()=>{
 for(const board of [UNO,NANO] as const){const p=arduinoExampleProject('blink',board);await validateArtifact(p,old[board].blink);const h=await inputHash(p);p.files[AVR_LIBRARY_FILE]=libraryManifest([]);assert.equal(await inputHash(p),h);p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'Bounce2',version:'2.72'}]);assert.notEqual(await inputHash(p),h);assert.equal(buildInput(p).toolchain.libraries[0].digest,AVR_LIBRARIES[0].digest);await assert.rejects(()=>validateArtifact(p,old[board].blink));}
});
test('unknown libraries, duplicate names, wrong versions and invalid source paths fail',()=>{
 const p=multi();for(const libraries of [[{name:'UnknownSensor',version:'1.0.0'}],[{name:'Bounce2',version:'0'}],[{name:'Bounce2',version:'2.72'},{name:'Bounce2',version:'2.72'}]]){p.files[AVR_LIBRARY_FILE]=JSON.stringify({format:'esp32-lab-arduino-libraries',version:1,libraries});assert.throws(()=>buildInput(p));}
 for(const path of ['lib/a.cpp','src/a.ino','../a.h','LabSketch.ino','src/src/a.ino'])assert.equal(validArduinoPath(path),false);
 for(const path of ['pomoc.h','src/pomoc.cpp','src/device/foo.h','extra.ino'])assert.equal(validArduinoPath(path),true);
});
test('browser cache validates artifacts and never reuses stale or corrupted data',async()=>{
 const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
 const p=arduinoExampleProject('adc',NANO),a=old[NANO].adc;await rememberBuild(p,a,storage);assert.equal((await cachedBuild(p,storage))?.hexHash,a.hexHash);p.files['main.ino']+='\n// novo';assert.equal(await cachedBuild(p,storage),null);p.files['main.ino']=p.files['main.ino'].replace('\n// novo','');assert.equal((await cachedBuild(p,storage))?.inputHash,a.inputHash);map.set([...map.keys()][0],JSON.stringify([{...a,hexHash:'broken'}]));assert.equal(await cachedBuild(p,storage),null);clearBuildCache(storage);assert.equal(map.size,0);
});
test('structured diagnostics retain source, line, column, warnings and notes',()=>{
 const ds=parseDiagnostics('main.ino:4:7: error: missing semicolon\nsrc/pomoc.cpp:2: warning: unused\nmain.ino:3:1: note: here');assert.equal(ds.length,3);assert.deepEqual(ds[0],{file:'main.ino',line:4,column:7,severity:'error',message:'missing semicolon'});assert.equal(ds[1].column,1);assert.equal(ds[2].severity,'note');
});
test('pairing accepts only loopback links with a session code',()=>{
 const code='a'.repeat(64);assert.equal(compilerLink('http://127.0.0.1:8765/#'+code).origin,'http://127.0.0.1:8765');for(const s of ['https://evil.example/#'+code,'http://localhost:8765/#'+code,'http://127.0.0.1:8765/?x=1#'+code,'http://127.0.0.1:8765/#bad','http://a:b@127.0.0.1:8765/#'+code])assert.throws(()=>compilerLink(s));
});
test('Arduino submission preserves a stopped reopenable full project, work and exact build',async()=>{
 const p=arduinoExampleProject('button',UNO);p.files[AVR_BUILD_FILE]=JSON.stringify(old[UNO].button);
 const work={student:'Probni Učenik',group:'4.f',observations:'Tipkalo i serijski unos mijenjaju LED.'};const submitted=await arduinoSubmission(p,work,'LED=1\n'),loaded=importProject(exportZip(submitted),'predaja.zip');assert.deepEqual(readArduinoWork(loaded),work);await validateArtifact(loaded,JSON.parse(loaded.files[AVR_BUILD_FILE]));assert.equal(loaded.files['arduino-konzola.txt'],'LED=1\n');assert(!p.files['arduino-predaja.json']);
 const altered=clone(p);altered.files['main.ino']+='\n// promjena';await assert.rejects(()=>arduinoSubmission(altered,work,''));await assert.rejects(()=>arduinoSubmission(p,{...work,student:''},''));await assert.rejects(()=>arduinoSubmission(p,{...work,observations:''},''));
});
test('Arduino IDE export describes pinned libraries and preserves all C++ sources',()=>{
 const p=multi(),zip=unzipSync(exportSketch(p));assert(strFromU8(zip['LabSketch/README.txt']).includes('Bounce2@2.72'));assert.equal(strFromU8(zip['LabSketch/src/pomoc.cpp']),p.files['src/pomoc.cpp']);assert.equal(strFromU8(zip['LabSketch/LabSketch.ino']),p.files['main.ino']);
});

for(const board of [UNO,NANO] as const)test('real blank '+board+' project, multiple files and pinned Bounce2 compile and execute',{skip:!real},async()=>{
 const p=multi(board),a=await compileProject(p);await validateArtifact(p,a);assert(a.staticRamBytes<=2048);p.files[AVR_BUILD_FILE]=JSON.stringify(a);const reopened=importProject(exportZip(p),'novi.zip');await validateArtifact(reopened,a);
 const c=arduinoExampleProject('button',board).circuit,events:any[]=[],e=new AVREngine(a.hex,compileCircuit(c as any,'avr'),event=>events.push(event),board===NANO?8:6);
 const advance=(ms:number)=>{for(let cycles=ms*16000;cycles>0;cycles-=64000){e.runCycles(Math.min(64000,cycles));e.frame();}};
 try{advance(100);assert.match(events.filter(x=>x.type==='console').map(x=>x.text).join(''),/ETAPA9/);assert.equal(events.filter(x=>x.type==='simulation').at(-1).gpios['13'].level,0);e.input({component:'sw1',pressed:true});advance(30);assert.equal(events.filter(x=>x.type==='simulation').at(-1).gpios['13'].level,1);e.input({component:'sw1',pressed:false});advance(30);assert.equal(events.filter(x=>x.type==='simulation').at(-1).gpios['13'].level,0);}finally{e.dispose();}
 results[board]={project:p,artifact:a};mkdirSync('docs/stage9-evidence',{recursive:true});writeFileSync('docs/stage9-evidence/'+(board===UNO?'uno':'nano')+'-multi.json',JSON.stringify({project:p,artifact:a},null,2));
});
test('real compiler rejects an unselected library and locates an error in src/',{skip:!real},async()=>{
 const p=multi();delete p.files[AVR_LIBRARY_FILE];await assert.rejects(()=>compileProject(p),/Bounce2.h/);p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'Bounce2',version:'2.72'}]);p.files['src/pomoc.cpp']='#include "../pomoc.h"\nconst char* poruka(){return nepoznato;}\n';try{await compileProject(p);assert.fail('Should reject invalid code');}catch(e:any){assert(e.diagnostics.some((d:any)=>d.file==='src/pomoc.cpp'&&d.line===2&&d.severity==='error'));writeFileSync('docs/stage9-evidence/diagnostics.json',JSON.stringify({message:e.message,diagnostics:e.diagnostics},null,2));}
});
test('local bridge enforces authentication/origin and hash cache for a real compile',{skip:!real},async()=>{
 let calls=0;const bridge=createBridge({port:0,site:'http://127.0.0.1:4173',compile:async(...args:any[])=>{calls++;return (compileProject as any)(...args);}}),info:any=await bridge.start(),url='http://127.0.0.1:'+info.port;
 const headers={Authorization:'Bearer '+bridge.token,'Content-Type':'application/json'};
 try{
  assert.equal((await fetch(url+'/v1/status')).status,401);
  assert.equal((await fetch(url+'/v1/status',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
  const health=await (await fetch(url+'/v1/status',{headers})).json();assert.equal(health.format,'esp32-lab-compiler');
  const p=newProject('void setup(){Serial.begin(9600);Serial.println("BRIDGE9");}\nvoid loop(){}','Od praznog',UNO);
  const post=async(project:Project)=>{const r=await fetch(url+'/v1/compile',{method:'POST',headers,body:JSON.stringify({project})});assert.equal(r.status,200);return r.json();};
  const first=await post(p);assert.equal(first.cached,false);await validateArtifact(p,first.artifact);const second=await post(p);assert.equal(second.cached,true);assert.equal(calls,1);
  p.files['main.ino']+='\n// drugi izvor';assert.equal((await post(p)).cached,false);assert.equal(calls,2);results.bridge={firstHash:first.artifact.inputHash,calls};writeFileSync('docs/stage9-evidence/http.json',JSON.stringify({status:'passed',unauthenticated:401,foreignOrigin:403,cached:second.cached,calls},null,2));
 }finally{bridge.server.closeAllConnections();bridge.server.close();await once(bridge.server,'close');}
});
test('local bridge rejects overlapping compiles and invalid source paths',async()=>{
 let finish:()=>void=()=>{};const gate=new Promise<void>(resolve=>finish=resolve);const bridge=createBridge({port:0,compile:async()=>{await gate;return old[UNO].blink;}}),info:any=await bridge.start(),url='http://127.0.0.1:'+info.port,headers={Authorization:'Bearer '+bridge.token,'Content-Type':'application/json'},p=arduinoExampleProject('blink',UNO);
 try{const first=fetch(url+'/v1/compile',{method:'POST',headers,body:JSON.stringify({project:p})});await new Promise(resolve=>setTimeout(resolve,40));const next=await fetch(url+'/v1/compile',{method:'POST',headers,body:JSON.stringify({project:p})});assert.equal(next.status,409);finish();assert.equal((await first).status,200);p.files['../../hack.cpp']='x';const bad=await fetch(url+'/v1/compile',{method:'POST',headers,body:JSON.stringify({project:p})});assert.equal(bad.status,422);}finally{finish();bridge.server.closeAllConnections();bridge.server.close();await once(bridge.server,'close');}
});
