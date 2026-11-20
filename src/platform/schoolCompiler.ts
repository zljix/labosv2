import type {Project} from '../project/model';
import {buildInput,validateArtifact} from '../../public/arduino-contract.mjs';
import {SchoolApi,SchoolApiError,readSchoolBinding} from './schoolSync';
export type CompileContext={parent:Project;node:'A'|'B'};
export class SchoolCompilerClient {
  private active?:{cancelled:boolean;id?:number;requestKey:string;body:any};
  constructor(private api:Pick<SchoolApi,'session'|'request'>=new SchoolApi(),private wait=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms))){}
  async capabilities(){await this.api.session();return this.api.request('compiler-capabilities');}
  async compile(project:Project,context:CompileContext|undefined,onStatus:(s:string)=>void){
    if(this.active)throw Error('Prevođenje je već u tijeku.');
    const binding=readSchoolBinding(context?.parent??project);
    if(binding?.status==='locked')throw Error('Predaja je zaključana.');
    if(binding&&binding.origin!==location.origin)throw Error('Otvori školsku adresu kojoj pripada ovaj rad.');
    buildInput(project);
    const source=Object.fromEntries(Object.entries(project.files).filter(([path])=>/\.(ino|c|cpp|h|hpp)$/.test(path)||path==='arduino-libraries.json'));
    const body={project:{id:project.id,board:project.board,target:project.target,runtimeProfile:project.runtimeProfile,entryFile:project.entryFile,language:project.language,files:source},node:context?.node??'A',attemptId:binding?.attemptId,requestKey:crypto.randomUUID()};
    const task={cancelled:false,id:undefined as number|undefined,requestKey:body.requestKey,body};this.active=task;
    const deadline=Date.now()+11*60*1000;
    try{
      await this.api.session(binding?.userId);onStatus('U redu čekanja');
      let job:any;
      while(Date.now()<deadline){
        if(task.cancelled)throw Error('Prevođenje je otkazano.');
        try{
          // Lost POST replies retry with the original key and identical payload.
          job=(await this.api.request(task.id?'compile-status&id='+task.id:'compile',task.id?undefined:body)).job;
          if(!job||!Number.isSafeInteger(job.id))throw Error('Neispravan odgovor prevoditelja.');
          task.id=job.id;
          if(task.cancelled){await this.api.request('cancel-compile',{id:task.id});throw Error('Prevođenje je otkazano.');}
          if(job.nodeId!==project.id||job.node!==(context?.node??'A')||job.target!==project.board.id)throw Error('Rezultat pripada drugom čvoru.');
          if(job.status==='compiled'){await validateArtifact(project,job.result.artifact);if(task.cancelled)throw Error('Prevođenje je otkazano.');onStatus('Spremno za pokretanje');return {artifact:job.result.artifact,cached:false};}
          if(!['queued','running'].includes(job.status))throw Object.assign(new SchoolApiError(job.result?.message??({'cancelled':'Prevođenje je otkazano.','expired':'Rezultat je istekao. Ponovi prevođenje.'}[job.status as string]??'Servis nedostupan. Ponovi prevođenje.'),422,'compile_finished'),{diagnostics:job.result?.diagnostics??[]});
          onStatus(job.status==='queued'?'U redu čekanja':'Prevođenje');
        }catch(error){
          if(task.cancelled)throw Error('Prevođenje je otkazano.');
          if(error instanceof SchoolApiError&&(error.status<500||['compiler_unavailable','compiler_disabled'].includes(error.code)))throw error;
          // Contract/validation failures must never be treated as a lost network reply.
          if(!(error instanceof SchoolApiError)&&!(error instanceof TypeError)&&!['TimeoutError','AbortError'].includes((error as Error).name))throw error;
          onStatus('Veza je prekinuta; čekam oporavak istog zahtjeva…');
        }
        await this.wait(1000);
      }
      await this.cancel();throw Error('Isteklo je čekanje na školski prevoditelj. Ponovi zahtjev.');
    }finally{if(this.active===task)this.active=undefined;}
  }
  async cancel(){const task=this.active;if(!task)return;task.cancelled=true;if(task.id)try{await this.api.request('cancel-compile',{id:task.id});}catch{/* Server lease and wall timeout bound disconnected cancellation. */}}
}
