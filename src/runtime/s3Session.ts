import type {RuntimeHandle} from './adapter';
import type {SimulationConfig} from '../circuit/compile';
import type {Project} from '../project/model';
let serial=0;
export class S3Session implements RuntimeHandle {
 readonly id=++serial;private stopped=false;private worker:Worker;
 constructor(factory:()=>Worker,project:Project,artifact:any,circuit:SimulationConfig,observe:(event:any)=>void){
  this.worker=factory();this.worker.onmessage=({data})=>{if(!this.stopped&&data.session===this.id)observe(data);};
  this.worker.onerror=e=>{if(!this.stopped)observe({type:'error',message:e.message||'ESP32-S3 WASM Worker nije dostupan.'});};
  this.worker.postMessage({type:'run',session:this.id,project,artifact,circuit});
 }
 input(data:Record<string,unknown>){if(!this.stopped)this.worker.postMessage({...data,type:'input',session:this.id});}
 stop(){if(this.stopped)return;this.stopped=true;this.worker.terminate();}
}
