import {useEffect,useRef,useState} from 'react';
import {parseProject,type Project} from '../project/model';
import {SchoolApi,schoolFingerprint,type SchoolBinding,type SchoolWorkState} from './schoolSync';
import {GradingReport} from './SchoolGrading';

export default function SchoolFinish({binding,enabled,api,project,flush,locked}:{
  binding:SchoolBinding;enabled:boolean;api:SchoolApi;project:()=>Project;
  flush:(project:Project)=>Promise<SchoolBinding>;locked:(work:SchoolWorkState)=>void;
}){
  const [show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [summary,setSummary]=useState<{work:SchoolWorkState;fingerprint:string;key:string}>();
  const dialog=useRef<HTMLDialogElement>(null),running=useRef(false),request=useRef<{revision:number;key:string}|undefined>(undefined);
  const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{
    if(!show)return;
    const el=dialog.current!,prior=document.activeElement as HTMLElement;
    if(typeof el.showModal==='function')el.showModal();else el.setAttribute('open','');
    return()=>{if(typeof el.close==='function')el.close();prior?.focus();};
  },[show]);
  async function start(){
    if(running.current)return;running.current=true;setShow(true);setBusy(true);setError('');setSummary(undefined);
    try{
      const saved=await flush(project());await api.session(binding.userId);
      const work:SchoolWorkState=await api.request('attempt&id='+binding.attemptId);parseProject(work.snapshot.project);
      if(!active.current)return;
      if(work.attempt.status==='locked'&&work.submission){locked(work);setShow(false);return;}
      if(work.snapshot.revision!==saved.revision||await schoolFingerprint(work.snapshot.project)!==saved.fingerprint
        ||await schoolFingerprint(project())!==saved.fingerprint)throw Error('Rad se promijenio. Pregledaj poslužiteljsku verziju i ponovno otvori završni sažetak.');
      if(request.current?.revision!==saved.revision)request.current={revision:saved.revision,key:crypto.randomUUID()};
      setSummary({work,fingerprint:saved.fingerprint,key:request.current!.key});
    }catch(e){if(active.current)setError((e as Error).message);}
    finally{running.current=false;if(active.current)setBusy(false);}
  }
  async function finish(){
    if(running.current||!summary)return;running.current=true;setBusy(true);setError('');
    try{
      if(await schoolFingerprint(project())!==summary.fingerprint)throw Error('Postoje nove lokalne izmjene. Zatvori sažetak i ponovno odaberi završetak.');
      await api.session(binding.userId);
      const work:SchoolWorkState=await api.request('finish-attempt',{attemptId:binding.attemptId,expectedRevision:summary.work.snapshot.revision,requestKey:summary.key});
      if(!active.current)return;
      if(work.attempt.id!==binding.attemptId||work.attempt.status!=='locked'||!work.submission
        ||work.submission.revision!==summary.work.snapshot.revision||work.submission.contentHash!==summary.work.snapshot.contentHash)throw Error('Potvrda ne odgovara prikazanoj predaji. Ponovi zahtjev za potvrdu.');
      locked(work);setShow(false);
    }catch(e){if(active.current)setError('Završetak još nije potvrđen u ovom pregledniku. '+(e as Error).message+' Ponovi potvrdu ili pregledaj poslužiteljsku verziju.');}
    finally{running.current=false;if(active.current)setBusy(false);}
  }
  const work=summary?.work,g=work?.snapshot.grading;
  return <>
    <button className="primary" disabled={!enabled||busy} onClick={()=>void start()}>Završi i zaključaj vježbu</button>
    {show&&<dialog ref={dialog} className="modal school-finish-modal" aria-labelledby="school-finish-title" onCancel={e=>{e.preventDefault();if(!busy)setShow(false);}}>
      <div className="modal-head"><h2 id="school-finish-title">Završni sažetak predaje</h2></div>
      {busy&&!work&&<p role="status">Spremam posljednje izmjene i čekam potvrdu točne revizije…</p>}
      {work&&<><p><b>{work.student.displayName}</b> · {work.assignment.className} · {work.assignment.task.definition.code} · pokušaj {work.attempt.number??1}</p>
        <p>Zaključavaš reviziju <b>{work.snapshot.revision}</b>, upute v{work.assignment.task.version}, program, sklop, odgovore i početno stanje obaju čvorova i medija gdje postoje.</p>
        <GradingReport grading={g}/>
        {g?.report?.criteria?.some((c:any)=>c.points<c.maxPoints)&&<div><h3>Neostvareni kriteriji</h3><ul>{g.report.criteria.filter((c:any)=>c.points<c.maxPoints).map((c:any)=><li key={c.id}>{c.description} · {c.points} / {c.maxPoints}</li>)}</ul></div>}
        {g?.points==null&&<p>Za ovu reviziju još nema potvrđenih bodova. Završetak čuva sadržaj odmah; podržana provjera može završiti naknadno.</p>}
        <p>Možeš završiti i bez svih bodova. Nakon potvrde rad pregledavaš, a novu doradu dopušta nastavnik.</p>
      </>}
      {error&&<p role="alert">{error}</p>}
      <div className="dialog-actions"><button disabled={busy} onClick={()=>setShow(false)}>Vrati se na rad</button>
        {work&&<button className="primary" disabled={busy} onClick={()=>void finish()}>{busy?'Čekam potvrdu…':'Potvrdi i zaključaj ovu reviziju'}</button>}
        {!work&&!busy&&<button onClick={()=>void start()}>Ponovi spremanje i sažetak</button>}
      </div>
    </dialog>}
  </>;
}
