import {useEffect,useRef,useState} from 'react';
import type {Project} from '../project/model';
import {parseProject} from '../project/model';
import {appAsset} from './assets';
import SchoolSnapshot from './SchoolSnapshot';
import SchoolGrading from './SchoolGrading';
import SchoolFinish from './SchoolFinish';
import SchoolAttemptHistory from './SchoolAttemptHistory';
import {SchoolApi,SchoolSynchronizer,readSchoolBinding,prepareSchoolAttempt,detachedSchoolProject,type SyncState,type SchoolWorkState,type SchoolBinding} from './schoolSync';

export const schoolTime=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('hr-HR',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Zagreb'}).format(new Date(value))+' (Zagreb)':'Vrijeme prethodne potvrde nije dostupno';

export default function SchoolWork({project,confirm,open,expanded=true,onExpand}:{expanded?:boolean;onExpand?:()=>void;project:Project;confirm:(binding:SchoolBinding)=>void;open:(p:Project)=>Promise<void>}){
  const binding=readSchoolBinding(project),current=useRef(project);current.current=project;
  const callbacks=useRef({confirm,open});callbacks.current={confirm,open};
  const initializeRef=useRef<(()=>Promise<void>)|undefined>(undefined);
  const api=useRef(new SchoolApi()),engine=useRef<SchoolSynchronizer|undefined>(undefined);
  const [state,setState]=useState<SyncState>({phase:'checking',message:'Provjeravam školski račun…',revision:binding?.revision??0});
  const [remote,setRemote]=useState<SchoolWorkState>(),[official,setOfficial]=useState<SchoolWorkState>(),[submissions,setSubmissions]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  function locked(work:SchoolWorkState){
    engine.current?.stop();engine.current=undefined;setOfficial(work);setRemote(undefined);
    callbacks.current.confirm({...readSchoolBinding(current.current)!,status:'locked'});
    setState({phase:'locked',message:'Vježba je zaključana na školskom poslužitelju',revision:work.snapshot.revision,savedAt:work.snapshot.savedAt});
  }
  useEffect(()=>{
    if(!binding)return;
    let cancelled=false;
    const initialize=async()=>{
      try{
        if(binding.origin!==location.origin)throw Error('Ovaj je rad vezan uz drugu školsku adresu. Otvori izvornu školsku adresu ili nastavi u zasebnoj lokalnoj kopiji.');
        const session=await api.current.session(binding.userId);
        if(!session.features?.centralStorage)throw Error('Ova školska instalacija još ne podržava središnje spremanje.');
        if(cancelled)return;
        setSubmissions(!!session.features?.submissions);
        const work:SchoolWorkState=await api.current.request('attempt&id='+binding.attemptId);
        if(cancelled)return;
        setOfficial(work);
        if(work.attempt.status==='locked'){locked(work);return;}
        if(binding.status==='locked')callbacks.current.confirm({...binding,status:'in_progress'});
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
    if(!binding||state.phase==='saved'||state.phase==='locked')return;
    const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[state.phase]);
  if(!binding)return null;
  async function act(work:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await work();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function review(){await api.current.session(binding!.userId);const value=await api.current.request('attempt&id='+binding!.attemptId);parseProject(value.snapshot.project);setRemote(value);}
  const showDetails=expanded||['error','conflict','locked'].includes(state.phase)||!!error||!!remote;
  const isLocked=state.phase==='locked';
  return <section id="school-work" tabIndex={-1} className={'school-sync school-sync-'+state.phase} aria-label="Spremanje školskog rada">
    <div className="school-sync-top"><strong role="status" aria-live="polite">{state.message}</strong><div><button onClick={onExpand} hidden={showDetails}>Moj rad · podrobnosti</button><a href={appAsset('school.html#account')}>Školski račun</a></div></div>
    <p>Posljednja potvrđena revizija: {state.revision} · {schoolTime(state.savedAt)}. {state.phase==='saved'||isLocked?'Rad je sačuvan u bazi.':'Izmjene zadržavaš u ovom pregledniku; dostupni su ZIP i JSON izvoz.'}</p>
    {official?.reopening&&<p>Dorada pokušaja {official.attempt.number}: {official.reopening.reason}. Prethodna predaja #{official.reopening.submissionId} ostaje sačuvana.</p>}
    <SchoolGrading expanded={showDetails} binding={binding} revision={state.revision} saved={state.phase==='saved'||isLocked} rubric={official?.assignment?.task?.rubric}/>
    <div id="my-work" className="school-work-details" hidden={!showDetails}>
    {isLocked&&official?.submission&&<section className="school-locked-submission" aria-label="Zaključana predaja">
      <h4>Predaja #{official.submission.id} · pokušaj {official.attempt.number??1}</h4><p>Potvrđeno {schoolTime(official.submission.submittedAt)} · revizija {official.submission.revision}. Sadržaj je zaključan. Za izmjene nastavnik dopušta novi pokušaj.</p>
      <SchoolSnapshot project={parseProject(official.snapshot.project)} label="Sadržaj zaključane predaje"/>
      <button disabled={busy} onClick={()=>void act(async()=>{await api.current.session(binding.userId);const next=await api.current.request('begin-attempt',{assignmentId:binding.assignmentId});
        if(next.attempt.id===binding.attemptId){setOfficial(next);setError('Nastavnik još nije dopustio novi pokušaj.');return;}await callbacks.current.open(await prepareSchoolAttempt(next));})}>Provjeri dopuštenu doradu / otvori najnoviji pokušaj</button>
    </section>}
    <div className="school-sync-actions">
      {!isLocked&&<button disabled={busy||state.phase==='saving'||state.phase==='conflict'} onClick={()=>void act(async()=>{if(engine.current)await engine.current.save();else await initializeRef.current?.();})}>Spremi sada / ponovi</button>}
      {!isLocked&&submissions&&<SchoolFinish binding={binding} enabled={!busy&&!!engine.current&&state.phase!=='checking'&&state.phase!=='conflict'} api={api.current} project={()=>current.current}
        flush={async p=>{if(!engine.current)throw Error('Spremanje još nije dostupno.');return engine.current.flush(p);}} locked={locked}/>}
      <button disabled={busy} onClick={()=>void act(review)}>Pregledaj poslužiteljsku verziju</button>
      <button disabled={busy||state.phase==='saving'} onClick={()=>void act(async()=>{engine.current?.stop();await callbacks.current.open(detachedSchoolProject(current.current));})}>Nastavi u zasebnoj lokalnoj kopiji</button>
    </div>
    {submissions&&<SchoolAttemptHistory api={api.current} attemptId={binding.attemptId} select={async id=>{await api.current.session(binding.userId);const next=await api.current.request('attempt&id='+id);engine.current?.stop();await callbacks.current.open(await prepareSchoolAttempt(next));}}/>}
    {error&&<p role="alert">{error}</p>}
    {remote&&<details open><summary>Usporedi lokalni rad s poslužiteljskom revizijom {remote.snapshot.revision}</summary>
      <p>Poslužitelj: {schoolTime(remote.snapshot.savedAt)}. Učitavanje za pregled ne pokreće program. Dosadašnje poslužiteljske revizije ostaju sačuvane.</p>
      <div className="school-compare"><SchoolSnapshot project={project} label="Moja lokalna verzija"/><SchoolSnapshot project={parseProject(remote.snapshot.project)} label={'Poslužiteljska revizija '+remote.snapshot.revision}/></div>
      <div className="school-sync-actions"><button disabled={busy||state.phase==='saving'} onClick={()=>void act(async()=>{engine.current?.stop();await callbacks.current.open(await prepareSchoolAttempt(remote));})}>Zadrži lokalnu kopiju i učitaj ovu poslužiteljsku verziju</button>
        {state.phase==='conflict'&&remote.attempt.status==='in_progress'&&<button disabled={busy||!engine.current} onClick={()=>void act(async()=>{await engine.current!.useLocalAfterReview(remote);setRemote(undefined);})}>Nakon pregleda spremi moju lokalnu verziju</button>}
        <button onClick={()=>setRemote(undefined)}>Zatvori usporedbu</button></div>
    </details>}
    </div>
  </section>;
}
