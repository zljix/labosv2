import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {sandboxCommand,runSandbox} from '../grader/sandbox.mjs';
import {buildInput,validateArtifact} from '../../public/arduino-contract.mjs';
import {AVR_TARGETS} from '../../public/avr-contract.mjs';
import {S3_BOARD,S3_FQBN} from '../../public/s3-contract.mjs';
export const targets=[...Object.keys(AVR_TARGETS),S3_BOARD];
export function probeProject(boardId){
  const avr=AVR_TARGETS[boardId];
  return {id:'compiler-probe-25A',language:'arduino-cpp',entryFile:'main.ino',board:{id:boardId,profileVersion:avr?.profile??'0.0.1'},runtimeProfile:{id:avr?'avr8js':'arduino-s3-wasm',version:1},target:{fqbn:avr?.fqbn??S3_FQBN},files:{'main.ino':'void setup(){pinMode(13,OUTPUT);}\nvoid loop(){digitalWrite(13,HIGH);delay(731);digitalWrite(13,LOW);delay(269);}\n'}};
}
/** @param {any} project @param {{root:string,cli?:string,data?:string,s3Toolchain?:string,clang?:string,opt?:string,signal?:AbortSignal,run?:Function}} options */
export async function compileInteractive(project,{root,cli,data,s3Toolchain,clang='clang++-19',opt='wasm-opt',signal,run=runSandbox}){
  const start=performance.now();let input;
  try{input=buildInput(project);}catch(error){return {status:'compile_error',message:String(error.message).slice(0,2000),diagnostics:[]};}
  try{
    const s3=project.board.id===S3_BOARD;
    const command=sandboxCommand(root,resolve(root,'school/grader',s3?'s3-compile-child.mjs':'compile-child.mjs'),
      s3?{s3Compiler:true,toolchainRoot:s3Toolchain,bounded:true}:{compiler:true,cli,data,bounded:true});
    const r=await run(command,s3?{project,clang,opt}:project,90000,signal);
    if(r.status==='compiled'){
      await validateArtifact(project,r.artifact);
      return {status:'compiled',artifact:r.artifact,durationMs:Math.round(performance.now()-start),toolchain:input.toolchain};
    }
    if(r.status==='compile_error')return {status:'compile_error',message:String(r.message??r.diagnostic??'Pogreška u programu.').slice(-16000),diagnostics:(r.diagnostics??[]).filter(d=>Object.hasOwn(input.files,d.file)).slice(0,50),durationMs:Math.round(performance.now()-start)};
    return {status:'technical_error',message:'Servis nedostupan: provjeri zaključane alate i izolaciju.'};
  }catch(error){return {status:'technical_error',message:signal?.aborted?'Prevođenje je prekinuto.':'Servis nedostupan ili prekoračeno ograničenje prevođenja.',durationMs:Math.round(performance.now()-start)};}
}
export async function probeCompilers(options){
  const result={};
  for(const board of targets){const r=await compileInteractive(probeProject(board),options);result[board]={ready:r.status==='compiled',message:r.status==='compiled'?'Spremno':r.message,durationMs:r.durationMs??null};}
  return result;
}
