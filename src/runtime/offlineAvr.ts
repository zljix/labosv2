import type {Project} from '../project/model';
import {readSchoolBinding} from '../platform/schoolSync';
import {importProject} from '../project/archive';
import {projectInput,readProject,BUNDLE_FORMAT} from '../../prototypes/avr-offline/project-bridge';
import {validateResult} from '../../prototypes/avr-offline/compiler.mjs';
export const OFFLINE_AVR = typeof __OFFLINE_AVR_PROTOTYPE__ !== 'undefined' && __OFFLINE_AVR_PROTOTYPE__;
const PREFIX='labos-integrated-avr-v1:';
const memory=new Map<string,unknown>();
type Store=Pick<Storage,'getItem'|'setItem'>;
export function offlineInput(project:Project){
  if(readSchoolBinding(project))throw Error('Offline prototip koristi samostalan projekt; školski rad prevodi se postojećim školskim postupkom.');
  return projectInput(project).input;
}
export function offlineIdentity(project:Project){return JSON.stringify({id:project.id,input:offlineInput(project)});}
export function prefersOffline(project:Project,storage?:Store){
  try{return memory.has(project.id)||(storage??localStorage).getItem(PREFIX+project.id)!==null;}catch{return memory.has(project.id);}
}
// Invalidate before starting, including before failures and cancellation. Never
// silently fall back to an earlier CLI artifact or an older offline program.
export function beginOffline(project:Project,storage?:Store){
  offlineInput(project);memory.set(project.id,null);
  try{(storage??localStorage).setItem(PREFIX+project.id,'null');}catch{}
}
export function preferStandard(project:Project){memory.delete(project.id);try{localStorage.removeItem(PREFIX+project.id);}catch{}}
export async function saveOffline(project:Project,result:unknown,storage?:Store){
  await validateResult(offlineInput(project),result);
  const copy=structuredClone(result);memory.set(project.id,copy);
  try{(storage??localStorage).setItem(PREFIX+project.id,JSON.stringify(copy));return true;}catch{return false;}
}
export async function loadOffline(project:Project,storage?:Store){
  const input=offlineInput(project);
  let result=memory.get(project.id);
  if(result===undefined)try{result=JSON.parse((storage??localStorage).getItem(PREFIX+project.id)??'null');}catch{}
  return validateResult(input,result);
}
export class OfflineCompileTask {
  private cancelPending?:()=>void;
  constructor(private factory:()=>Worker,private timeoutMs=60000){}
  cancel(){this.cancelPending?.();}
  compile(project:Project,progress:(tool:string)=>void=()=>{}):Promise<any>{
    this.cancel();const input=offlineInput(project);
    return new Promise((resolve,reject)=>{
      let worker:Worker;try{worker=this.factory();}catch(e){reject(e);return;}
      let finished=false;
      const finish=(error?:Error,result?:unknown)=>{
        if(finished)return;finished=true;clearTimeout(timer);worker.terminate();
        if(this.cancelPending===cancel)this.cancelPending=undefined;
        error?reject(error):resolve(result);
      };
      const cancel=()=>finish(Error('Prevođenje je otkazano.'));
      const timer=setTimeout(()=>finish(Error('Prevođenje je prekoračilo 60 sekundi.')),this.timeoutMs);
      this.cancelPending=cancel;
      worker.onerror=e=>finish(Error(e.message||'Radni proces prevoditelja nije dostupan.'));
      worker.onmessage=({data})=>{
        if(finished)return;
        if(data.type==='progress')progress(String(data.tool));
        else if(data.type==='error')finish(Error(String(data.message)));
        else if(data.type==='compiled')void validateResult(input,data.result).then(()=>finish(undefined,data.result),e=>finish(e));
      };
      try{worker.postMessage({type:'compile',input});}catch(e){finish(e as Error);}
    });
  }
}

export async function importIntegratedProject(bytes:Uint8Array,name:string){
  if(bytes.length>2*1024*1024)throw Error('Najveća veličina paketa je 2 MiB.');
  if(name.toLowerCase().endsWith('.json')){
    const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),value=JSON.parse(text);
    if(value?.format===BUNDLE_FORMAT){const parsed=await readProject(text);offlineInput(parsed.project);return {project:parsed.project,result:parsed.result};}
  }
  return {project:importProject(bytes,name),result:null};
}
