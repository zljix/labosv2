import {useEffect,useRef,useState} from 'react';
import type {Project} from '../project/model';
import {parseProject} from '../project/model';
import {appAsset} from './assets';
import SchoolSnapshot from './SchoolSnapshot';
import SchoolGrading from './SchoolGrading';
import {SchoolApi,SchoolSynchronizer,readSchoolBinding,prepareSchoolAttempt,detachedSchoolProject,type SyncState,type SchoolWorkState,type SchoolBinding} from './schoolSync';

export const schoolTime=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('hr-HR',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Zagreb'}).format(new Date(value))+' (Zagreb)':'Vrijeme prethodne potvrde nije dostupno';

export default function SchoolWork({project,confirm,open}:{project:Project;confirm:(binding:SchoolBinding)=>void;open:(p:Project)=>Promise<void>}){
  const binding=readSchoolBinding(project),current=useRef(project);current.current=project;
  const callbacks=useRef({confirm,open});callbacks.current={confirm,open};
  const initializeRef=useRef<(()=>Promise<void>)|undefined>(undefined);
  const api=useRef(new SchoolApi()),engine=useRef<SchoolSynchronizer|undefined>(undefined);
  const [state,setState]=useState<SyncState>({phase:'checking',message:'Provjeravam školski račun…',revision:binding?.revision??0});
  const [remote,setRemote]=useState<SchoolWorkState>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!binding)return;
    let cancelled=false;
    const initialize=async()=>{
      try{
        if(binding.origin!==location.origin)throw Error('Ovaj je rad vezan uz drugu školsku adresu. Otvori izvornu školsku adresu ili nastavi u zasebnoj lokalnoj kopiji.');
        const session=await api.current.session(binding.userId);
        if(!session.features?.centralStorage)throw Error('Ova školska instalacija još ne podržava središnje spremanje.');
        if(cancelled)return;
        const sync=new SchoolSynchronizer({api:api.current,binding,onState:setState,onConfirm:b=>callbacks.current.confirm(b)});
        engine.current=sync;await sync.update(current.current);
      }catch(e){if(!cancelled)setState(s=>({...s,phase:'error',message:(e as Error).message}));}
    };
    initializeRef.current=initialize;void initialize();
    const online=()=>{if(engine.current)void engine.current.save();else void initialize();};
    const suspend=()=>{void engine.current?.save();};
    const visible=()=>{if(document.visibilityState==='hidden')suspend();};
    window.addEventListener('online',online);window.addEventListener('pagehide',suspend);document.addEventListener('visibilitychange',visible);
    return()=>{cancelled=true;engine.current?.stop();engine.current=undefined;window.removeEventListener('online',online);window.removeEventListener('pagehide',suspend);document.removeEventListener('visibilitychange',visible);};
  },[]);
  useEffect(()=>{void engine.current?.update(project);},[project]);
  useEffect(()=>{
    if(!binding||state.phase==='saved')return;
    const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[state.phase]);
  if(!binding)return null;
  async function act(work:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await work();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function review(){await api.current.session(binding!.userId);const value=await api.current.request('attempt&id='+binding!.attemptId);parseProject(value.snapshot.project);setRemote(value);}
  return <section className={'school-sync school-sync-'+state.phase} aria-label="Spremanje školskog rada">
    <div className="school-sync-top"><strong role="status" aria-live="polite">{state.message}</strong><a href={appAsset('school.html#account')}>Školski račun</a></div>
    <p>Posljednja potvrđena revizija: {state.revision} · {schoolTime(state.savedAt)}. {state.phase==='saved'?'Rad je sačuvan u bazi.':'Izmjene zadržavaš u ovom pregledniku; dostupni su ZIP i JSON izvoz.'}</p>
    <SchoolGrading binding={binding} revision={state.revision} saved={state.phase==='saved'}/>
    <div className="school-sync-actions">
      <button disabled={busy||state.phase==='saving'||state.phase==='conflict'} onClick={()=>void act(async()=>{if(engine.current)await engine.current.save();else await initializeRef.current?.();})}>Spremi sada / ponovi</button>
      <button disabled={busy} onClick={()=>void act(review)}>Pregledaj poslužiteljsku verziju</button>
      <button disabled={busy||state.phase==='saving'} onClick={()=>void act(async()=>{engine.current?.stop();await callbacks.current.open(detachedSchoolProject(current.current));})}>Nastavi u zasebnoj lokalnoj kopiji</button>
    </div>
    {error&&<p role="alert">{error}</p>}
    {remote&&<details open><summary>Usporedi lokalni rad s poslužiteljskom revizijom {remote.snapshot.revision}</summary>
      <p>Poslužitelj: {schoolTime(remote.snapshot.savedAt)}. Učitavanje za pregled ne pokreće program. Dosadašnje poslužiteljske revizije ostaju sačuvane.</p>
      <div className="school-compare"><SchoolSnapshot project={project} label="Moja lokalna verzija"/><SchoolSnapshot project={parseProject(remote.snapshot.project)} label={'Poslužiteljska revizija '+remote.snapshot.revision}/></div>
      <div className="school-sync-actions"><button disabled={busy||state.phase==='saving'} onClick={()=>void act(async()=>{engine.current?.stop();await callbacks.current.open(await prepareSchoolAttempt(remote));})}>Zadrži lokalnu kopiju i učitaj ovu poslužiteljsku verziju</button>
        {state.phase==='conflict'&&remote.attempt.status==='in_progress'&&<button disabled={busy||!engine.current} onClick={()=>void act(async()=>{await engine.current!.useLocalAfterReview(remote);setRemote(undefined);})}>Nakon pregleda spremi moju lokalnu verziju</button>}
        <button onClick={()=>setRemote(undefined)}>Zatvori usporedbu</button></div>
    </details>}
  </section>;
}
