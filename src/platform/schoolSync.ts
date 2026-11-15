import {clone,parseProject,type Project} from '../project/model';
import {appAsset} from './assets';

export const SCHOOL_BINDING_FILE='school-attempt.json';
export interface SchoolBinding {
  format:'labosv2-school-attempt';version:1;origin:string;userId:number;attemptId:number;assignmentId:number;
  projectId:string;revision:number;fingerprint:string;savedAt?:string;status?:'in_progress'|'locked';
}
export interface SchoolSubmission {id:number;attemptId:number;revision:number;contentHash:string;taskVersionId:number;rubricHash:string;submittedAt:string;grading:any}
export interface SchoolWorkState {
  attempt:{id:number;assignmentId:number;studentId:number;revision:number;status:string;number?:number;savedAt:string;grading?:any};
  assignment:any;student:{id:number;username:string;displayName:string};
  snapshot:{revision:number;project:Project;contentHash:string;savedAt:string;grading?:any};
  submission?:SchoolSubmission|null;reopening?:{previousAttemptId:number;submissionId:number;reason:string;openedBy:number;openedAt:string}|null;
}
export class SchoolApiError extends Error {
  constructor(message:string,public status:number,public code:string){super(message);}
}
export class SchoolApi {
  private token='';
  constructor(private transport:typeof fetch=(...args)=>fetch(...args)){}
  async request(action:string,body?:unknown):Promise<any>{
    const response=await this.transport(appAsset('api/index.php?action='+action),{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',
      headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':this.token},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    let data:any;try{data=await response.json();}catch{throw new SchoolApiError('Školski servis nije dostupan na ovoj adresi.',response.status,'unavailable');}
    if(data?.application!=='labosv2')throw new SchoolApiError('Otvori adresu školskog poslužitelja.',response.status,'unavailable');
    if(data.csrfToken)this.token=data.csrfToken;
    if(!response.ok)throw new SchoolApiError(data.error?.message??'Zahtjev nije uspio.',response.status,data.error?.code??'request');
    return data;
  }
  async session(userId?:number){
    const state=await this.request('session');
    if(!state.user||(userId!==undefined&&state.user.id!==userId))throw new SchoolApiError('Prijavi se računom učenika kojem pripada ovaj rad. Lokalna kopija je sačuvana.',401,'account_changed');
    if(state.user.mustChangePassword)throw new SchoolApiError('Najprije promijeni privremenu lozinku u školskom računu.',403,'password_change_required');
    return state;
  }
  async save(binding:SchoolBinding,body:unknown){await this.session(binding.userId);return (await this.request('save-work',body)).saved;}
}

export function readSchoolBinding(p:Project):SchoolBinding|undefined {
  try{
    const raw=p.files[SCHOOL_BINDING_FILE];if(!raw||raw.length>2048)return;
    const b=JSON.parse(raw);
    if(b.format!=='labosv2-school-attempt'||b.version!==1||typeof b.origin!=='string'||b.origin.length>300||typeof b.projectId!=='string'
      ||!/^[A-Za-z0-9-]{8,80}$/.test(b.projectId)||!['userId','attemptId','assignmentId','revision'].every(k=>Number.isSafeInteger(b[k])&&b[k]>0)
      ||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint)
      ||(b.status!==undefined&&!['in_progress','locked'].includes(b.status))
      ||(b.savedAt!==undefined&&(typeof b.savedAt!=='string'||!Number.isFinite(Date.parse(b.savedAt)))))return;
    return b;
  }catch{return;}
}
export function schoolSnapshot(p:Project,b:SchoolBinding):Project {
  const next=clone(p);next.id=b.projectId;delete next.files[SCHOOL_BINDING_FILE];return parseProject(next);
}
export async function schoolFingerprint(p:Project):Promise<string>{
  const next:any=clone(p);delete next.files[SCHOOL_BINDING_FILE];delete next.id;delete next.updatedAt;delete next.revision;
  const stable=(value:any):any=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(next))));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function prepareSchoolAttempt(state:SchoolWorkState,origin=location.origin):Promise<Project>{
  const p=parseProject(state.snapshot.project);const projectId=p.id;p.id=crypto.randomUUID();
  const b:SchoolBinding={format:'labosv2-school-attempt',version:1,origin,userId:state.attempt.studentId,attemptId:state.attempt.id,assignmentId:state.attempt.assignmentId,
    projectId,revision:state.snapshot.revision,status:state.attempt.status==='locked'?'locked':'in_progress',savedAt:state.snapshot.savedAt,fingerprint:await schoolFingerprint(p)};
  p.files[SCHOOL_BINDING_FILE]=JSON.stringify(b);return parseProject(p);
}
export function detachedSchoolProject(project:Project):Project {
  const p=clone(project);p.id=crypto.randomUUID();delete p.files[SCHOOL_BINDING_FILE];p.title=(p.title.slice(0,73)+' — lokalna kopija').slice(0,100);return parseProject(p);
}

export type SyncPhase='checking'|'saved'|'pending'|'saving'|'error'|'conflict'|'locked';
export interface SyncState {phase:SyncPhase;message:string;revision:number;savedAt?:string}
interface PendingSave {attemptId:number;expectedRevision:number;requestKey:string;project:Project;fingerprint:string}
interface SyncOptions {
  api:Pick<SchoolApi,'save'>;binding:SchoolBinding;
  onState:(state:SyncState)=>void;onConfirm:(binding:SchoolBinding)=>void;
  now?:()=>number;later?:(fn:()=>void,ms:number)=>any;cancel?:(id:any)=>void;
}
// A mounted editor owns its base revision. It never adopts another tab's base.
export class SchoolSynchronizer {
  private binding:SchoolBinding;private phase:SyncPhase='checking';private savedAt?:string;
  private latest?:{project:Project;fingerprint:string};private pending?:PendingSave;private timer:any;private dirtySince?:number;
  private running=false;private disposed=false;private generation=0;
  private inFlight?:Promise<void>;private message='';
  private now:()=>number;private later:(fn:()=>void,ms:number)=>any;private cancel:(id:any)=>void;
  constructor(private options:SyncOptions){this.binding=clone(options.binding);this.savedAt=options.binding.savedAt;this.now=options.now??Date.now;this.later=options.later??setTimeout;this.cancel=options.cancel??clearTimeout;}
  private state(phase:SyncPhase,message:string){this.phase=phase;this.message=message;if(!this.disposed)this.options.onState({phase,message,revision:this.binding.revision,savedAt:this.savedAt});}
  private clear(){if(this.timer!==undefined)this.cancel(this.timer);this.timer=undefined;}
  private schedule(ms?:number){this.clear();if(this.disposed||this.running||this.phase==='conflict')return;
    this.timer=this.later(()=>{this.timer=undefined;void this.save();},ms??Math.max(0,Math.min(3000,15000-(this.now()-(this.dirtySince??this.now())))));}
  async update(project:Project){
    const generation=++this.generation;
    try{
      const snapshot=schoolSnapshot(project,this.binding),fingerprint=await schoolFingerprint(snapshot);
      if(this.disposed||generation!==this.generation)return;
      this.latest={project:snapshot,fingerprint};
      if(this.phase==='conflict')return;
      if(!this.pending&&fingerprint===this.binding.fingerprint){this.dirtySince=undefined;this.clear();if(!this.running)this.state('saved','Spremljeno na školskom poslužitelju');return;}
      this.dirtySince??=this.now();
      if(!this.running){this.state('pending','Izmjene su lokalne; čekam potvrdu poslužitelja');this.schedule();}
    }catch(error){this.state('error',(error as Error).message);}
  }
  async save(){
    if(this.inFlight)return this.inFlight;
    const work=this.performSave();this.inFlight=work;
    try{await work;}finally{if(this.inFlight===work)this.inFlight=undefined;}
  }
  private async performSave(){
    this.clear();if(this.disposed||this.running||this.phase==='conflict'||!this.latest)return;
    if(!this.pending&&this.latest.fingerprint===this.binding.fingerprint){this.state('saved','Spremljeno na školskom poslužitelju');return;}
    this.pending??={attemptId:this.binding.attemptId,expectedRevision:this.binding.revision,requestKey:crypto.randomUUID(),project:clone(this.latest.project),fingerprint:this.latest.fingerprint};
    const pending=this.pending;this.running=true;this.state('saving','Spremanje na školski poslužitelj…');
    try{
      const {fingerprint,...body}=pending;
      const saved=await this.options.api.save(this.binding,body);
      if(this.disposed)return;
      if(saved.attemptId!==this.binding.attemptId||saved.revision!==pending.expectedRevision+1||saved.currentRevision<saved.revision)throw Error('Poslužitelj nije potvrdio očekivanu reviziju. Ponovi spremanje.');
      this.binding={...this.binding,revision:saved.revision,fingerprint,savedAt:saved.savedAt};this.savedAt=saved.savedAt;this.pending=undefined;this.dirtySince=undefined;
      this.options.onConfirm(clone(this.binding));
      if(saved.currentRevision>saved.revision)this.state('conflict','Poslani rad je sačuvan, ali postoji i novija revizija. Pregledaj obje verzije.');
      else if(this.latest?.fingerprint!==fingerprint){this.dirtySince=this.now();this.state('pending','Nove izmjene još su lokalne');}
      else this.state('saved','Spremljeno na školskom poslužitelju');
    }catch(error){
      if(this.disposed)return;
      const e=error as SchoolApiError;
      this.state(e.code==='revision_conflict'||e.code==='attempt_locked'?'conflict':'error',e instanceof SchoolApiError?e.message:'Nije spremljeno na školskom poslužitelju. Izmjene su lokalne; provjeri vezu i ponovi spremanje.');
      if(!(e instanceof SchoolApiError)||e.status>=500)this.scheduleAfterRun=15000;
    }finally{
      this.running=false;
      if(!this.disposed&&!this.conflicted()){
        if(this.scheduleAfterRun!==undefined){const wait=this.scheduleAfterRun;this.scheduleAfterRun=undefined;this.schedule(wait);}
        else if(this.phase==='pending')this.schedule();
      }
    }
  }
  private conflicted(){return this.phase==='conflict';}
  private scheduleAfterRun?:number;
  async flush(project:Project):Promise<SchoolBinding>{
    const fingerprint=await schoolFingerprint(project);
    await this.update(project);
    // Join an existing autosave first, then drain any newer local edit. A
    // failed acknowledgement retains its original request key for a retry.
    do{
      await this.save();
      if(this.disposed||this.phase==='conflict'||this.phase==='error')throw Error(this.message||'Spremanje nije potvrđeno.');
    }while(this.pending||this.binding.fingerprint!==this.latest?.fingerprint);
    this.clear();
    if(this.binding.fingerprint!==fingerprint)throw Error('Rad je izmijenjen tijekom završetka. Ponovno otvori završni sažetak.');
    return clone(this.binding);
  }
  async useLocalAfterReview(remote:SchoolWorkState){
    if(this.running||this.disposed||remote.attempt.id!==this.binding.attemptId||remote.snapshot.revision!==remote.attempt.revision)throw Error('Ponovno učitaj posljednju poslužiteljsku reviziju.');
    this.pending=undefined;this.binding={...this.binding,revision:remote.attempt.revision,fingerprint:await schoolFingerprint(remote.snapshot.project)};
    this.options.onConfirm(clone(this.binding));this.state('pending','Spremam odabranu lokalnu verziju nakon pregleda');await this.save();
  }
  stop(){this.disposed=true;++this.generation;this.clear();}
}
