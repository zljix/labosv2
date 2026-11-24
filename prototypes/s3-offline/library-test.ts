import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {s3ExampleProject} from '../../src/runtime/s3Examples';
import {environmentExample} from './environment-example';
import {browserInput,S3_LIBRARY_NAMES,validateArtifact} from '../../public/s3-contract.mjs';
import {libraryManifest,AVR_LIBRARY_FILE,sha256} from '../../public/avr-contract.mjs';
import {compileFiles} from './compiler.mjs';
import {compileCircuit} from '../../src/circuit/compile';
import {createS3Engine} from '../../public/s3-engine.mjs';

const core=JSON.parse(await readFile('release/core.json','utf8'));
const checked=new Set();
for(const key of ['regulator','sensors','lcd','dht11','ds18Multi','oled64','oled32','bounce','multi'] as const){
  const project=key==='multi'?environmentExample():s3ExampleProject(key==='bounce'?'button':key);
  if (key==='bounce') {
    project.files['main.ino']='#include <Bounce2.h>\nBounce key; void setup(){key.attach(5,INPUT_PULLUP);Serial.begin(9600);} void loop(){key.update();Serial.println(key.read());delay(100);}';
    project.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'Bounce2',version:'2.72'}]);
  }
  const input=browserInput(project);
  const libs=[];
  for(const lib of input.toolchain.libraries){
    const pack=JSON.parse(await readFile('release/lib-'+lib.name+'.json','utf8'));
    assert.equal(pack.digest,lib.digest);
    libs.push({...pack,name:lib.name});
    checked.add(lib.name);
  }
  const bytes=await compileFiles(input.files,core,libs);
  assert(bytes.length < 80000);
  if(key==='multi'||key==='oled32'||key==='oled64'){
    const events=[];
    const engine=await createS3Engine(bytes,compileCircuit(project.circuit),event=>events.push(event),{fast:true});
    try{await engine.run(1);}finally{engine.stop();}
    const frames=events.filter(e=>e.type==='simulation');
    assert(frames.some(e=>Object.values(e.displays).some(d=>d.bytes?.some(Boolean))));
    if(key==='multi')assert.match(events.filter(e=>e.type==='console').map(e=>e.text).join(''),/T=24.0 C, RH=50.0/);
  }
  if(key==='multi'){
    const artifact={format:'esp32-lab-s3-build',version:3,boardId:input.boardId,fqbn:input.fqbn,
      boardProfile:input.boardProfile,toolchain:input.toolchain,inputHash:await sha256(JSON.stringify(input)),
      wasmHash:await sha256(bytes),wasm:Buffer.from(bytes).toString('base64'),wasmBytes:bytes.length,memoryBytes:2097152};
    await validateArtifact(project,artifact);
    for(const path of ['ispis.ino','mjerenje.h','src/interval.c','src/prikaz.cpp']){
      const changed=structuredClone(project);
      changed.files[path]+='\n// izmjena';
      await assert.rejects(validateArtifact(changed,artifact),/Izvor je promijenjen/);
    }
    const changed=structuredClone(project);
    delete changed.files[AVR_LIBRARY_FILE];
    await assert.rejects(validateArtifact(changed,artifact),/bibliotekama/);
    const bad={...input.files,'src/interval.c':'int f(void){return ; invalid_token;}'};
    await assert.rejects(compileFiles(bad,core,libs),/src\/interval\.c:1:/);
  }
  console.log(key,bytes.length,'B');
}
assert.deepEqual([...checked].sort(),[...S3_LIBRARY_NAMES].sort());
