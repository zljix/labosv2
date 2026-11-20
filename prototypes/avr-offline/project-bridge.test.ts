import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,copyFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {newProject,parseProject,clone} from '../../src/project/model';
import {UNO,NANO,S3} from '../../src/boards/profiles';
import {arduinoExampleProject} from '../../src/runtime/arduinoExamples';
import {validateArtifact,libraryManifest} from '../../public/avr-contract.mjs';
import {projectInput,updateProject,projectBundle,readProject,validateProjectResult} from './project-bridge';
import {compile,unpackSDK} from './compiler.mjs';
import {simulate} from './simulation';
import runtime from './runtime-manifest.json' with {type:'json'};

const dir=resolve('.build/avr-toolchain'),require=createRequire(import.meta.url);
for(const name of ['cc1','cc1plus','avr-as','avr-ld','objcopy'])await copyFile(dir+'/'+name+'.js',dir+'/'+name+'.cjs');
const sdk=unpackSDK(await readFile(dir+'/'+runtime.sdkFile)),factory=async(name:string)=>require(dir+'/'+name+'.cjs');
const source='void setup(){pinMode(9,OUTPUT);digitalWrite(9,HIGH);Serial.begin(9600);Serial.println("PROJECT_BRIDGE");} void loop(){}';
function fixture(board:typeof UNO|typeof NANO=UNO){const p=arduinoExampleProject('blink',board);p.files['main.ino']=source;p.files['biljeske.md']='Čuvaj učenikova opažanja.';p.files['avr-build.json']='{"old":"keep unchanged"}';return p;}

await writeFile('.build/avr-project-fixture.json',JSON.stringify(fixture()));

test('real Labos projects compile and simulate their own circuit for Uno and Nano',async()=>{
  for(const board of [UNO,NANO] as const){
    const original=fixture(board),before=JSON.stringify(original),{input,project}=projectInput(original);
    const result=await compile(input,{sdk,factory}),simulation=await simulate(input,result,project);
    assert.match(simulation.serial,/PROJECT_BRIDGE/);assert.deepEqual(simulation.faults,[]);
    assert.equal(simulation.projectId,original.id);assert(simulation.lastFrame.leds.led1.currentMa>4);
    const disconnected=clone(project);if(disconnected.circuit.kind!=='editable')throw Error('fixture');disconnected.circuit.wires=[];
    const open=await simulate(input,result,disconnected);assert.equal(open.lastFrame.leds.led1.currentMa,0);
    const bundle=await projectBundle(project,result),restored=await readProject(JSON.stringify(bundle));
    assert.deepEqual(restored.project,project);assert.equal(restored.result.hexHash,result.hexHash);
    assert.deepEqual(parseProject(restored.project).circuit,project.circuit);assert.equal(JSON.stringify(original),before);
    await assert.rejects(()=>validateArtifact(project,result));
    const edit=updateProject(project,{...input,files:{...input.files,'main.ino':source+'\n// new source'}});
    assert.equal(edit.files['avr-build.json'],project.files['avr-build.json']);assert.equal(edit.files['biljeske.md'],project.files['biljeske.md']);
    assert.deepEqual(edit.circuit,project.circuit);assert.equal(edit.revision,project.revision+1);
    await assert.rejects(()=>validateProjectResult(edit,input,result),/ne odgovaraju/);
    await assert.rejects(()=>readProject(JSON.stringify({...bundle,project:edit})),/promijenjeni/);
    await assert.rejects(()=>readProject(JSON.stringify({...bundle,result:{...result,packageHash:'wrong'}})),/promijenjeni/);
    await assert.rejects(()=>readProject(JSON.stringify({...bundle,result:{...result,hex:result.hex+'bad'}})),/Oštećen/);
    const off=clone(project);off.settings.powered=false;await assert.rejects(()=>simulate(input,result,off),/napajanje/);
  }
});

test('unsupported targets, libraries, extra ino, src paths and two-node projects fail without mutation',()=>{
  const p=fixture(),before=JSON.stringify(p);
  for(const files of [
    {'arduino-libraries.json':libraryManifest([{name:'Servo',version:'1.2.2'}]).replace('1.2.2','9.9.9')},
    {'arduino-libraries.json':'broken'}, {'other.ino':'void helper(){}'}, {'src/helper.cpp':'int helper(){return 1;}'},
  ])assert.throws(()=>projectInput({...p,files:{...p.files,...files}}));
  assert.throws(()=>projectInput(newProject(undefined,'S3',S3,'arduino-cpp')),/Uno/);
  assert.throws(()=>projectInput(newProject()),/Uno/);
  const peer=fixture(NANO);assert.throws(()=>projectInput({...p,schemaVersion:4,radio:{version:1,peer}}),/dva čvora/);
  assert.throws(()=>updateProject(p,{...projectInput(p).input,board:'nano'}),/Pločica/);
  assert.equal(JSON.stringify(p),before);
});

test('project round trip preserves ancillary files and rejects invalid imports and oversized edits',async()=>{
  const p=fixture(),{input}=projectInput(p);
  assert.deepEqual((await readProject(JSON.stringify(p))).project,parseProject(p));
  assert.deepEqual(updateProject(p,input),parseProject(p));
  await assert.rejects(()=>readProject('{broken'),/JSON/);
  await assert.rejects(()=>readProject(' '.repeat(2*1024*1024+1)),/2 MiB/);
  await assert.rejects(()=>readProject(JSON.stringify({format:'labos-avr-offline-project',version:2})),/inačica/);
  assert.throws(()=>updateProject(p,{...input,files:{'main.ino':'x'.repeat(131073)}}),/128 KiB/);
  assert.throws(()=>projectInput({...p,target:{fqbn:'wrong'}}));
  assert.throws(()=>projectInput({...p,runtimeProfile:{id:'arduino-avr',version:9}}));
});
