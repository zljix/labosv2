import {useEffect,useRef,useState} from 'react';
import {SchoolApi} from './schoolSync';
import {achievementCsv,achievementProjects} from './schoolReports';
import {download} from '../project/archive';
import {schoolTime} from './SchoolWork';

export default function SchoolReports({classId,assignments,user,inspect}:{classId:string;assignments:any[];user:any;inspect:(id:number,revision?:number)=>Promise<void>}){
  const api=useRef(new SchoolApi()),epoch=useRef(0);
  const [students,setStudents]=useState<any[]>([]),[studentId,setStudentId]=useState(''),[assignmentId,setAssignmentId]=useState(''),[report,setReport]=useState<any>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState(''),[note,setNote]=useState('');
  const filter='classId='+classId+(studentId?'&studentId='+studentId:'')+(assignmentId?'&assignmentId='+assignmentId:'');
  useEffect(()=>{let active=true;setStudents([]);setStudentId('');setAssignmentId('');setReason('');
    if(classId)void api.current.request('class&id='+classId).then(s=>{if(active)setStudents(s.class.students);}).catch(e=>{if(active)setError(e.message);});
    return()=>{active=false;};},[classId]);
  useEffect(()=>{++epoch.current;setReport(undefined);setError('');setNote('');setBusy(false);return()=>{++epoch.current;};},[filter]);
  async function load(cursor?:any){
    const tick=++epoch.current;setBusy(true);setError('');
    try{await api.current.session();const r=await api.current.request('achievements&'+filter+(cursor?'&afterAssignment='+cursor.afterAssignment+'&afterStudent='+cursor.afterStudent:''));
      if(tick!==epoch.current)return;setReport(r);
    }catch(e){if(tick===epoch.current){setError((e as Error).message);setReport(undefined);}}finally{if(tick===epoch.current)setBusy(false);}
  }
  async function exportReport(projects=false){
    const tick=++epoch.current;setBusy(true);setError('');setNote('Pripremam izvoz…');
    try{
      await api.current.session();const full=await api.current.request('export-achievements&'+filter);
      if(tick!==epoch.current)return;
      const filename='Postignuca-'+classId;
      if(projects){
        const refs=new Map<string,{id:number;revision:number}>();
        for(const row of full.rows){if(row.currentAttempt)refs.set(row.currentAttempt.id+':'+row.currentAttempt.revision,{id:row.currentAttempt.id,revision:row.currentAttempt.revision});if(row.submission)refs.set(row.submission.attemptId+':'+row.submission.revision,{id:row.submission.attemptId,revision:row.submission.revision});}
        if(refs.size>100)throw Error('Projektni ZIP podržava do 100 snimki. Odaberi učenika ili vježbu pa ponovi izvoz.');
        const works=[];let bytes=0;
        for(const ref of refs.values()){
          const w=await api.current.request('attempt&id='+ref.id+'&revision='+ref.revision);if(tick!==epoch.current)return;
          bytes+=JSON.stringify(w.snapshot.project).length;if(bytes>30000000)throw Error('Izvoz projekata prelazi 30 MB. Suzi odabir.');
          works.push(w);setNote('Pripremam snimku '+works.length+' / '+refs.size+'…');
        }
        download(filename+'.zip',achievementProjects(full,works),'application/zip');
      }else download(filename+'.csv',achievementCsv(full),'text/csv;charset=utf-8');
      setNote('Preuzet je cijeli odabrani opseg: '+full.rows.length+' zapisa. Izvještaj: '+schoolTime(full.serverTime)+'.');
    }catch(e){if(tick===epoch.current){setError((e as Error).message);setNote('');if([401,403].includes((e as any).status))setReport(undefined);}}
    finally{if(tick===epoch.current)setBusy(false);}
  }
  async function archive(archived:boolean){
    if(!report)return;const tick=epoch.current;setBusy(true);setError('');
    try{await api.current.session();const s=await api.current.request('archive-year',{schoolYear:report.class.schoolYear,archived,reason});if(tick!==epoch.current)return;setNote(s.message);setReport({...report,class:{...report.class,archived}});setReason('');}
    catch(e){if(tick===epoch.current)setError((e as Error).message);}finally{if(tick===epoch.current)setBusy(false);}
  }
  return <section className="school-reports" aria-label="Postignuća i izvještaji"><h4>Postignuća i izvještaji</h4>
    <p>Evidencija koristi posljednju zaključanu predaju ili nastavnikov zabilježeni odabir. Otvorena dorada prikazuje se zasebno. Nezapočeto, provjera na čekanju i nepodržano bodovanje imaju prazne bodove.</p>
    <div className="school-sync-actions"><label>Učenik<select disabled={busy} value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Svi učenici razreda</option>{students.map(s=><option key={s.id} value={s.id}>{s.displayName} · {s.username}</option>)}</select></label>
      <label>Vježba za izvještaj<select disabled={busy} value={assignmentId} onChange={e=>setAssignmentId(e.target.value)}><option value="">Sve dodjele razreda</option>{assignments.map(a=><option key={a.id} value={a.id}>{a.task.definition.code} · {a.task.definition.variantTitle} · v{a.task.version} · {a.target}</option>)}</select></label></div>
    <div className="school-sync-actions"><button disabled={busy||!classId} onClick={()=>void load()}>Prikaži / osvježi postignuća</button><button disabled={busy||!classId} onClick={()=>void exportReport()}>Preuzmi cijeli odabir CSV</button><button disabled={busy||!classId} onClick={()=>void exportReport(true)}>Preuzmi evidenciju i projekte ZIP</button></div>
    {note&&<p role="status">{note}</p>}{error&&<p role="alert">{error}</p>}
    {report&&<><p>{report.class.name} · {report.class.schoolYear}{report.class.archived?' · arhivirana godina':''} · {schoolTime(report.serverTime)} · prikaz do 100 zapisa. CSV uključuje cijeli odabir, najviše 5000 zapisa.</p>
      <div className="school-work-table"><table><thead><tr><th>Učenik / vježba</th><th>Rad u tijeku</th><th>Predaja za evidenciju</th><th>Bodovi / podrijetlo</th><th>Pregled</th></tr></thead><tbody>{report.rows.map((r:any)=><tr key={r.student.id+':'+r.assignment.id}><td>{r.student.displayName}<br/>{r.assignment.code} · {r.assignment.title} · {r.assignment.target}</td><td>{({not_started:'Nije započeto',in_progress:'U radu',locked:'Zaključano',reopened:'Dorada dopuštena'} as any)[r.status]}{r.currentAttempt&&<p>Pokušaj {r.currentAttempt.number} · r{r.currentAttempt.revision}</p>}</td><td>{r.submission?'#'+r.submission.id+' · r'+r.submission.revision:'Nema zaključane predaje'}{r.selection?.submissionId&&<p>Odabrao/la {r.selection.author}: {r.selection.reason}</p>}</td><td>{r.assessment.points===null?'Čeka rezultat / ručni pregled':r.assessment.points+' / '+r.assessment.maxPoints}{r.assessment.source==='teacher'?' · nastavnik':r.assessment.source==='automatic'?' · automatski':''}</td><td>{r.currentAttempt&&<button disabled={busy} onClick={()=>void inspect(r.currentAttempt.id)}>Aktualni rad</button>}{r.submission&&<button disabled={busy} onClick={()=>void inspect(r.submission.attemptId,r.submission.revision)}>Vrednovana predaja</button>}</td></tr>)}</tbody></table></div>
      {!report.rows.length&&<p>Nema zapisa za odabrani opseg.</p>}{report.hasMore&&<button disabled={busy} onClick={()=>void load(report.next)}>Sljedećih 100 zapisa</button>}
      {user.role==='admin'&&<details><summary>Arhiviranje cijele školske godine</summary><p>Arhiviranje zaustavlja nove radove i izmjene u svim razredima godine {report.class.schoolYear}. Pregledi i izvozi ostaju dostupni. Ponovno otvaranje godine ne otključava predaje.</p><label>Razlog<textarea disabled={busy} value={reason} required maxLength={1000} onChange={e=>setReason(e.target.value)}/></label><button disabled={busy||!reason.trim()} onClick={()=>void archive(!report.class.archived)}>{report.class.archived?'Ponovno otvori godinu':'Arhiviraj godinu '+report.class.schoolYear}</button></details>}
    </>}
  </section>;
}
