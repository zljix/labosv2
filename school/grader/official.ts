import {isIntroductoryContract,validIntroductoryConfig} from './introductory';
import {isLevelContract,validLevelConfig} from './levels';
import {isRadioContract,gradeRadio} from './radio-official';
import {isOpticalContract,validOpticalConfig} from './optical';
import {isStorageContract,validStorageConfig} from './storage';
import {isTouchContract,validTouchConfig} from './touch';
import {isEnvironmentContract,validEnvironmentConfig} from './environment';
import {isDisplayContract,validDisplayConfig} from './displays';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseProject} from '../../src/project/model';
import {compileCircuit} from '../../src/circuit/compile';
import {UNO,NANO,S3} from '../../src/boards/profiles';
import {inputHash,validateArtifact,buildInput} from '../../public/avr-contract.mjs';
import {inputHash as s3InputHash,validateArtifact as validateS3Artifact} from '../../public/s3-contract.mjs';
import {jobBinding,validContractJob} from './contract';
import {sandboxCommand,runSandbox} from './sandbox.mjs';
import registry from './profiles.json';
import {isAnalogContract,validAnalogConfig} from './analog';
import {isSensorContract,validSensorConfig} from './sensors';
import {isEventContract,validEventConfig} from './events';
import {isActuatorContract,validActuatorConfig} from './actuators';
import {isStepperContract,validStepperConfig} from './steppers';

export const digest=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
export async function gradeJob(job:any,options:{root:string;compile?:boolean;cli?:string;data?:string;timeoutMs?:number;s3Toolchain?:string;clang?:string;opt?:string}) {
  const root=resolve(options.root),started=performance.now();
  const base:any={format:'labosv2-grading-result',version:1,authority:'server-verified',checkerVersion:job.checkerVersion,
    profileId:job.profileId,snapshotHash:job.snapshotHash,rubricHash:job.rubricHash,points:null};
  if(job.version===2)Object.assign(base,jobBinding(job));
  // The fingerprint identifies the actual checker and runtime bytes. No code,
  // console transcript, score or binary from a browser chooses this report.
  const checker=createHash('sha256');
  try{
    for(const file of ['official.mjs','official-child.mjs','radio-child.mjs'])checker.update(await readFile(resolve(root,'.build/school-grader',file)));
    for(const file of ['machine.py','runtime/micropython.mjs','runtime/micropython.wasm','avr-examples.json','s3-examples.json','s3-core-lock.mjs','radio-examples.json'])checker.update(await readFile(resolve(root,'public',file)));
    for(const file of ['scripts/avr-compile.mjs','scripts/s3-compile.mjs','school/grader/compile-child.mjs','school/grader/s3-compile-child.mjs','vendor/arduino/lock.json'])checker.update(await readFile(resolve(root,file)));
  }catch{return {...base,checkerHash:digest('unavailable-checker:'+registry.checkerVersion),status:'technical_error',message:'Provjeravač nije potpuno instaliran. Bodovi nisu dodijeljeni.'};}
  base.checkerHash=checker.digest('hex');
  const profile=registry.profiles.find(p=>p.id===job.profileId);
  if(job.format!=='labosv2-grading-job'||!profile||('contract' in profile?!validContractJob(job,profile):job.version!==1)||job.checkerVersion!==(profile?.checkerVersion??registry.checkerVersion)
    ||!profile.targets.includes(job.target)||!job.rubric||job.rubric.profileId!==profile.id
    ||!Array.isArray(job.rubric.criteria)||job.rubric.criteria.length!==profile.criteria.length
    ||!profile.criteria.every((c,i)=>['id','description','maxPoints'].every(k=>job.rubric.criteria[i]?.[k]===(c as any)[k]))||!(/^[a-f0-9]{64}$/).test(job.seed??'')
    ||typeof job.projectJson!=='string'||digest(job.projectJson)!==job.snapshotHash)
    return {...base,status:'unsupported',message:'Provjeravač ne podržava ovu inačicu zadatka, cilja ili snimke.'};
  const failProgram=(message:string)=>({...base,status:'program_error',points:0,maxPoints:10,message,
    criteria:profile.criteria.map(c=>({...c,points:0,passed:false,explanation:message}))});
  let project;
  try{project=parseProject(JSON.parse(job.projectJson));}catch{return failProgram('Snimka nema valjanu strukturu projekta.');}
  const target=project.language==='micropython'&&project.board.id===S3?'micropython':project.language==='arduino-cpp'&&project.board.id===S3?'s3-cpp':project.language==='arduino-cpp'&&project.board.id===UNO?'uno':project.language==='arduino-cpp'&&project.board.id===NANO?'nano':null;
  if(target===job.target&&isRadioContract(profile))return gradeRadio(project,profile,job.seed,base,options);
  if(!target||target!==job.target||project.radio)return {...base,status:'unsupported',message:'Ovaj cilj još nema službenu provjeru.'};
  try{
    const config=compileCircuit(project.circuit as any,target==='uno'||target==='nano'?'avr':'micropython');
    const sensorKind='sensorKind' in profile?profile.sensorKind:'bmp280';
    const valid=isIntroductoryContract(profile)?validIntroductoryConfig(config,profile.taskKey.split('/')[1]):isLevelContract(profile)?validLevelConfig(config,profile.taskKey.split('/')[1],target==='uno'||target==='nano'?'avr':target):isOpticalContract(profile)?validOpticalConfig(config):isStorageContract(profile)?validStorageConfig(config,profile.taskKey.split('/')[1]):isTouchContract(profile)?validTouchConfig(config,profile.taskKey.split('/')[1]):isEnvironmentContract(profile)?validEnvironmentConfig(config,profile.taskKey.split('/')[1]):isDisplayContract(profile)?validDisplayConfig(config,profile.taskKey.split('/')[1]):isStepperContract(profile)?validStepperConfig(config):isActuatorContract(profile)?validActuatorConfig(config,profile.taskKey.split('/')[1]):isEventContract(profile)?validEventConfig(config,profile.taskKey.split('/')[1]):isSensorContract(profile)?validSensorConfig(config,profile.taskKey.split('/')[1]):isAnalogContract(profile)?validAnalogConfig(config,profile.taskKey.split('/')[1]):profile.kind==='sensor'?config.i2cDevices.length===1&&config.i2cDevices[0].kind===sensorKind:
      profile.kind==='lm35'?config.analogInputs?.length===1&&config.analogInputs[0].kind==='lm35':
      config.leds.length===1&&(profile.kind==='blink'||(profile.kind==='button'?config.buttons.length===1:config.pots.length===1));
    if(project.circuit.kind!=='editable'||!valid)
      return failProgram('Sačuvaj komponente zadane objavljenom provjerom. Pregledaj upute i sklop.');
  }catch{return failProgram('Sklop ima električnu ili strukturnu pogrešku. Pregledaj dijagnostiku sklopa.');}
  try{
    let artifact:any,provenance:any={method:'source-execution'};
    if(target==='s3-cpp'){
      if(options.compile){
        const compiled:any=await runSandbox(sandboxCommand(root,resolve(root,'school/grader/s3-compile-child.mjs'),{s3Compiler:true,toolchainRoot:options.s3Toolchain,bounded:true}),
          {project,clang:options.clang??'clang++-19',opt:options.opt??'wasm-opt'},90000);
        if(compiled.status!=='compiled')return compiled.status==='compile_error'?failProgram('Prevođenje izvora nije uspjelo. Provjeri C++ kod i dopuštene biblioteke.'):
          {...base,status:'technical_error',message:'Zaključani S3 prevoditelj nije dostupan. Bodovi nisu dodijeljeni.'};
        artifact=await validateS3Artifact(project,compiled.artifact);
        provenance={method:'isolated-source-compilation',inputHash:artifact.inputHash,wasmHash:artifact.wasmHash,toolchain:artifact.toolchain,compilerIdentity:compiled.compilerIdentity};
      }else{
        const catalogue=JSON.parse(await readFile(resolve(root,'public/s3-examples.json'),'utf8')),wanted=await s3InputHash(project);
        const entry:any=Object.values(catalogue).find((a:any)=>a.inputHash===wanted);
        if(!entry)return {...base,status:'unsupported',message:'Novi S3 C++ izvor zahtijeva izolirano prevođenje. Učenikov ili stari WASM nije pokrenut.'};
        artifact=await validateS3Artifact(project,entry);
        provenance={method:'trusted-catalogue-exact-source',inputHash:wanted,wasmHash:artifact.wasmHash,toolchain:artifact.toolchain};
      }
    }else if(project.language==='arduino-cpp'){
      if(options.compile){
        const compiled:any=await runSandbox(sandboxCommand(root,resolve(root,'school/grader/compile-child.mjs'),{compiler:true,cli:options.cli,data:options.data,bounded:true}),project,90000);
        if(compiled.status!=='compiled')return {...base,status:compiled.status==='compile_error'?'program_error':'technical_error',...(compiled.status==='compile_error'?failProgram('Prevođenje izvora nije uspjelo. Provjeri kod i dopuštene biblioteke.'):{message:'Prevoditelj nije dostupan.'})};
        artifact=await validateArtifact(project,compiled.artifact);provenance={method:'isolated-source-compilation',inputHash:artifact.inputHash,hexHash:artifact.hexHash,toolchain:artifact.toolchain};
      }else{
        const catalogue=JSON.parse(await readFile(resolve(root,'public/avr-examples.json'),'utf8')),wanted=await inputHash(project);
        const entry:any=Object.values(catalogue[project.board.id]??{}).find((a:any)=>a.inputHash===wanted);
        if(!entry)return {...base,status:'unsupported',message:'Novi Arduino izvor zahtijeva uključeno lokalno prevođenje. Stari artefakt nije pokrenut.'};
        artifact=await validateArtifact(project,entry);provenance={method:'trusted-catalogue-exact-source',inputHash:wanted,hexHash:artifact.hexHash,toolchain:buildInput(project).toolchain};
      }
    }
    const extended=isIntroductoryContract(profile)||isLevelContract(profile)||isOpticalContract(profile)||isStorageContract(profile)||isTouchContract(profile)||isEnvironmentContract(profile)||isDisplayContract(profile)||isSensorContract(profile)||isEventContract(profile)||isActuatorContract(profile)||isStepperContract(profile);
    const report:any=await runSandbox(sandboxCommand(root,resolve(root,'.build/school-grader/official-child.mjs'),{bounded:true,...(extended?{cpuSeconds:58}:{})}),{project,artifact,profile,seed:job.seed},options.timeoutMs??(extended?65000:20000));
    return {...base,...report,provenance,durationMs:Math.round(performance.now()-started)};
  }catch(e){
    const limit=['EXECUTION_LIMIT','OUTPUT_LIMIT','MEMORY_LIMIT'].includes((e as any).code);
    return {...base,status:limit?'execution_limit':'technical_error',message:limit?'Izvođenje je doseglo dopušteno vrijeme, memoriju ili izlaz. Bodovi nisu dodijeljeni.':'Izolirani servis nije dostupan. Bodovi nisu dodijeljeni.',durationMs:Math.round(performance.now()-started)};
  }
}
