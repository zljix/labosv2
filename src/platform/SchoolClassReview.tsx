import {useEffect,useRef,useState} from 'react';
import {parseProject,type Project} from '../project/model';
import {SchoolApi,detachedSchoolProject,type SchoolWorkState} from './schoolSync';
import SchoolSnapshot from './SchoolSnapshot';
import {schoolTime} from './SchoolWork';
import {appAsset} from './assets';
import {GradingReport,gradingLabel} from './SchoolGrading';
import SchoolAttemptHistory from './SchoolAttemptHistory';
import SchoolFeedback from './SchoolFeedback';
import SchoolReports from './SchoolReportsView';

const statuses:Record<string,string>={not_started:'Nije započeto',in_progress:'U radu',locked:'Zaključano',reopened:'Dorada dopuštena'};
export default function SchoolClassReview({open}:{open:(p:Project)=>Promise<void>}){
  const api=useRef(new SchoolApi()),epoch=useRef(0),selection=useRef(0);
  const [user,setUser]=useState<any>(),[classes,setClasses]=useState<any[]>([]),[classId,setClassId]=useState(''),[assignments,setAssignments]=useState<any[]>([]),
    [assignmentId,setAssignmentId]=useState(''),[rows,setRows]=useState<any[]>([]),[checked,setChecked]=useState<number>(),[serverTime,setServerTime]=useState(''),
    [message,setMessage]=useState('Provjeravam školski pregled…'),[error,setError]=useState(''),[status,setStatus]=useState(''),[query,setQuery]=useState(''),
    [detail,setDetail]=useState<SchoolWorkState>(),[revisions,setRevisions]=useState<any[]>([]),[busy,setBusy]=useState(false),[hasMore,setHasMore]=useState(false),[after,setAfter]=useState(''),[previous,setPrevious]=useState<string[]>([]),[next,setNext]=useState(''),[age,setAge]=useState(0);
  const [reason,setReason]=useState(''),[reopenMessage,setReopenMessage]=useState('');
  const [showReports,setShowReports]=useState(false),[selectionReason,setSelectionReason]=useState('');
  const assessmentRequest=useRef<{body:string;key:string}|undefined>(undefined);
  const reopenRequest=useRef<{attemptId:number;reason:string;key:string}|undefined>(undefined);
  const desired=new URL(location.href).searchParams;
  useEffect(()=>{
    let cancelled=false;
    void(async()=>{try{
      const s=await api.current.session();if(cancelled)return;
      if(s.user.role==='student'){setMessage('Školski pregled radova dostupan je nastavniku.');return;}
      if(!s.features?.centralStorage){setMessage('Ova instalacija još nema središnje spremanje.');return;}
      const result=await api.current.request('classes');if(cancelled)return;setUser(s.user);setClasses(result.classes);
      setClassId(String(result.classes.find((c:any)=>String(c.id)===desired.get('schoolReview'))?.id??result.classes[0]?.id??''));setMessage('');
    }catch{if(!cancelled)setMessage('Za pregled posljednjih spremljenih radova prijavi se na školskom poslužitelju.');}})();
    return()=>{cancelled=true;++epoch.current;++selection.current;};
  },[]);
  useEffect(()=>{
    const tick=++epoch.current;++selection.current;setRows([]);setDetail(undefined);setBusy(false);setAssignments([]);setAssignmentId('');setAfter('');setPrevious([]);setChecked(undefined);setError('');
    if(!classId)return;
    void api.current.request('assignments&classId='+classId).then(s=>{if(tick!==epoch.current)return;setAssignments(s.assignments);setAssignmentId(String(s.assignments.find((a:any)=>String(a.id)===desired.get('schoolExercise'))?.id??s.assignments[0]?.id??''));}).catch(e=>{if(tick===epoch.current)setError(e.message);});
  },[classId]);
  useEffect(()=>{
    const tick=++epoch.current;++selection.current;setRows([]);setDetail(undefined);setBusy(false);setChecked(undefined);setError('');
    if(!assignmentId)return;
    let cancelled=false,inFlight=false;
    const poll=async()=>{
      if(inFlight||cancelled||document.visibilityState==='hidden')return;inFlight=true;
      try{
        const s=await api.current.request('class-work&assignmentId='+assignmentId+(after?'&after='+after:''));
        if(cancelled||tick!==epoch.current)return;
        setRows(s.rows);setChecked(Date.now());setServerTime(s.serverTime);setError('');setHasMore(s.hasMore);setNext(s.nextAfter?String(s.nextAfter):'');
      }catch(e){if(!cancelled&&tick===epoch.current){setError((e as Error).message+' Prikazani podatci mogu biti zastarjeli.');
        if((e as any).status===401||(e as any).status===403){setRows([]);setDetail(undefined);setBusy(false);++selection.current;
          setUser(undefined);setMessage((e as any).status===401?'Prijava je završila. Prijavi se ponovno za školski pregled.':'Pristup razredu više nije dostupan. Ponovno otvori školski pregled.');}
      }}finally{inFlight=false;}
    };
    const visible=()=>{if(document.visibilityState==='visible')void poll();};
    void poll();const timer=setInterval(()=>void poll(),5000);document.addEventListener('visibilitychange',visible);
    return()=>{cancelled=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[assignmentId,after]);
  useEffect(()=>{if(!checked)return;setAge(0);const timer=setInterval(()=>setAge(Math.max(0,Math.floor((Date.now()-checked)/1000))),1000);return()=>clearInterval(timer);},[checked]);
  async function inspect(id:number,revision?:number){
    const tick=++selection.current;setBusy(true);setError('');
    try{
      const s=await api.current.request('attempt&id='+id+(revision?'&revision='+revision:''));parseProject(s.snapshot.project);
      const history=await api.current.request('attempt-revisions&id='+id);
      if(tick!==selection.current)return;setDetail(s);setRevisions(history.revisions);setReason('');setSelectionReason('');setReopenMessage('');
    }catch(e){if(tick===selection.current)setError((e as Error).message);}finally{if(tick===selection.current)setBusy(false);}
  }
  function exportSnapshot(){if(!detail)return;const url=URL.createObjectURL(new Blob([JSON.stringify(detail.snapshot.project,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='skolski-rad-'+detail.attempt.id+'-r'+detail.snapshot.revision+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function selectAssessment(automatic=false){
    if(!detail?.submission)return;const tick=selection.current;setBusy(true);setError('');
    const body={assignmentId:detail.assignment.id,studentId:detail.student.id,submissionId:automatic?null:detail.submission.id,reason:selectionReason};
    const text=JSON.stringify(body);if(assessmentRequest.current?.body!==text)assessmentRequest.current={body:text,key:crypto.randomUUID()};
    try{await api.current.session();const s=await api.current.request('select-assessment',{...body,requestKey:assessmentRequest.current!.key});if(tick===selection.current)setReopenMessage(s.message);}
    catch(e){if(tick===selection.current)setError((e as Error).message);}finally{if(tick===selection.current)setBusy(false);}
  }
  async function reopen(){
    if(!detail?.submission||busy)return;const tick=selection.current;
    setBusy(true);setError('');setReopenMessage('');
    const old=reopenRequest.current;
    if(old?.attemptId!==detail.attempt.id||old.reason!==reason)reopenRequest.current={attemptId:detail.attempt.id,reason,key:crypto.randomUUID()};
    try{await api.current.session();const work=await api.current.request('reopen-attempt',{attemptId:detail.attempt.id,submissionId:detail.submission.id,reason,requestKey:reopenRequest.current!.key});
      if(tick===selection.current)setReopenMessage('Dopušten je pokušaj '+work.attempt.number+'. Predaja #'+detail.submission.id+' ostaje zaključana. Učenik otvara najnoviji pokušaj.');
    }catch(e){if(tick===selection.current)setError((e as Error).message);}finally{if(tick===selection.current)setBusy(false);}
  }
  const visible=rows.filter(r=>(!status||r.status===status)&&(r.student.displayName+' '+r.student.username).toLocaleLowerCase('hr').includes(query.toLocaleLowerCase('hr')));
  return <section className="school-class-review" aria-label="Školski pregled spremljenih radova"><h3>Školski pregled rada</h3>
    {message&&<p>{message} <a href={appAsset('school.html#account')}>Školski račun</a></p>}
    {user&&<><div className="school-sync-actions"><label>Razred<select value={classId} onChange={e=>setClassId(e.target.value)}><option value="">Odaberi razred</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name} · {c.schoolYear}</option>)}</select></label>
      <label>Vježba<select value={assignmentId} onChange={e=>{setAssignmentId(e.target.value);setAfter('');setPrevious([]);}}><option value="">Odaberi dodijeljenu vježbu</option>{assignments.map(a=><option key={a.id} value={a.id}>{a.task.definition.code} · {a.task.definition.variantTitle} · v{a.task.version} · {a.target}</option>)}</select></label></div>
      <button onClick={()=>setShowReports(!showReports)}>{showReports?'Sakrij postignuća i izvještaje':'Postignuća i izvještaji / izvozi'}</button>
      {showReports&&<SchoolReports classId={classId} assignments={assignments} user={user} inspect={inspect}/>}
      <p aria-live="off">{checked?'Pregled osvježen prije '+age+' s · poslužitelj: '+schoolTime(serverTime):'Odaberi razred i vježbu za pregled.'} Osvježavanje svakih 5 s prikazuje posljednje spremljene snimke.</p>
      {error&&<p role="alert" className="review-warning">{error}</p>}
      <div className="school-sync-actions"><label>Pronađi učenika<input value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Svi statusi</option>{Object.entries(statuses).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label></div>
      <div className="school-work-table"><table><thead><tr><th>Učenik</th><th>Status</th><th>Pokušaj / revizija / spremljeno</th><th>Bodovanje</th><th>Rad</th></tr></thead><tbody>{visible.map(r=><tr key={r.student.id}><td>{r.student.displayName}<br/><small>{r.student.username}{r.student.active?'':' · neaktivan račun'}</small></td><td>{statuses[r.status]??r.status}</td><td>{r.attempt?<>Pokušaj {r.attempt.number} · r{r.attempt.revision}<br/>{schoolTime(r.attempt.savedAt)}</>:'—'}</td><td>{gradingLabel(r.attempt?.grading)}{r.lastSubmission&&<p>Posljednja zaključana: #{r.lastSubmission.id} · {gradingLabel(r.lastSubmission.grading)}</p>}</td><td>{r.attempt&&<button disabled={busy} onClick={()=>void inspect(r.attempt.id)}>Pregledaj snimku</button>}</td></tr>)}</tbody></table></div>
      {checked&&!visible.length&&<p>Nema učenika za odabrani prikaz.</p>}
      <div className="school-sync-actions">{!!previous.length&&<button onClick={()=>{const copy=[...previous];setAfter(copy.pop()!);setPrevious(copy);}}>Prethodnih 200</button>}{hasMore&&<button onClick={()=>{setPrevious([...previous,after]);setAfter(next);}}>Sljedećih 200</button>}</div>
      {detail&&<article className="school-work-detail"><h4>{detail.student.displayName} · pokušaj {detail.attempt.number} · revizija {detail.snapshot.revision}</h4><p>{schoolTime(detail.snapshot.savedAt)} · identitet iz prijavljenog računa · upute v{detail.assignment.task.version}</p>
        {detail.submission&&<p>Zaključana predaja #{detail.submission.id} · r{detail.submission.revision} · {schoolTime(detail.submission.submittedAt)}</p>}
        {detail.reopening&&<p>Dorada predaje #{detail.reopening.submissionId}: {detail.reopening.reason} · {schoolTime(detail.reopening.openedAt)}</p>}
        <p>Ovo je snimka odabrane revizije. Otvaranje pregleda ne pokreće učenikov program; popis učenika nastavlja se osvježavati.</p>
        <label>Sačuvane revizije (posljednjih 100)<select value={detail.snapshot.revision} disabled={busy} onChange={e=>void inspect(detail.attempt.id,Number(e.target.value))}>{revisions.map(r=><option key={r.revision} value={r.revision}>r{r.revision} · {schoolTime(r.savedAt)}</option>)}</select></label>
        <details><summary>Objavljene upute i kriteriji ove dodjele</summary><p>{detail.assignment.task.definition.goal}</p><p>{detail.assignment.task.definition.teacherNotes}</p><ul>{detail.assignment.task.rubric.criteria.map((c:any)=><li key={c.id}>{c.description}{c.maxPoints===null?'':' · najviše '+c.maxPoints+' bodova'}</li>)}</ul></details>
        <GradingReport grading={detail.snapshot.grading}/>
        <SchoolFeedback key={detail.attempt.id+':'+detail.snapshot.revision} attemptId={detail.attempt.id} revision={detail.snapshot.revision} staff archived={detail.assignment.archived} changed={()=>{void inspect(detail.attempt.id,detail.snapshot.revision);}}/>
        <SchoolSnapshot project={parseProject(detail.snapshot.project)} label="Posljednja odabrana snimka"/>
        {detail.submission&&!detail.assignment.archived&&<div className="school-reopen"><label>Razlog dopuštanja dorade<textarea value={reason} maxLength={1000} onInput={e=>setReason(e.currentTarget.value)}/></label>
          <button disabled={busy||!reason.trim()||!!reopenMessage} onClick={()=>void reopen()}>Dopusti doradu kao novi pokušaj</button>{reopenMessage&&<p role="status">{reopenMessage}</p>}</div>}
        {detail.submission&&!detail.assignment.archived&&<details><summary>Odabir predaje za izvještaje</summary><p>Zadano se koristi posljednja zaključana predaja. Drugu možeš odabrati uz razlog; raniji odabir ostaje u evidenciji.</p><label>Razlog odabira<textarea value={selectionReason} maxLength={1000} onChange={e=>setSelectionReason(e.target.value)}/></label><button disabled={busy||!selectionReason.trim()} onClick={()=>void selectAssessment()}>Koristi ovu zaključanu predaju</button><button disabled={busy||!selectionReason.trim()} onClick={()=>void selectAssessment(true)}>Vrati posljednju zaključanu predaju</button></details>}
        <SchoolAttemptHistory key={detail.attempt.id} api={api.current} attemptId={detail.attempt.id} select={async id=>{await inspect(id);}}/>
        <div className="school-sync-actions"><button onClick={()=>void inspect(detail.attempt.id)}>Učitaj najnoviju snimku</button><button onClick={exportSnapshot}>Preuzmi ovu reviziju kao JSON</button><button disabled={busy} onClick={()=>{setBusy(true);void open(detachedSchoolProject(parseProject(detail.snapshot.project))).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Otvori zasebnu kopiju za pokus</button><button onClick={()=>{++selection.current;setDetail(undefined);setBusy(false);}}>Zatvori snimku</button></div>
      </article>}
    </>}
  </section>;
}
