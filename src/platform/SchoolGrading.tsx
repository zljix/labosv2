import {useEffect,useRef,useState} from 'react';
import {SchoolApi,type SchoolBinding} from './schoolSync';
import SchoolFeedback from './SchoolFeedback';
import {schoolTime} from './SchoolWork';
import {gradingObservations} from './gradingObservations';

const labels:Record<string,string>={not_enabled:'Ova inačica zadatka nema službeno bodovanje.',unsupported:'Provjera za ovaj cilj još nije podržana.',not_requested:'Provjera nije u redu. Zatraži provjeru spremljene revizije.',queued:'Spremljena revizija čeka provjeru.',running:'Provjera spremljene revizije je u tijeku.',technical_error:'Tehnička pogreška servisa. Bodovi nisu dodijeljeni.',execution_limit:'Dosegnuto je ograničenje izvođenja. Bodovi nisu dodijeljeni.',superseded:'Provjeru je zamijenila novija spremljena revizija.'};
const legacyInputProfiles=['24O-v2-button@1','24B-button-led@1','23E-button-led@1','24O-v5-regulator@1','24I-regulator@1'];
export function gradingLabel(g:any):string{
  if(!g)return 'Još nema potvrđenog rezultata';
  if(g.teacherReview?.action==='correct')return `${g.teacherReview.points} / ${g.teacherReview.maxPoints} bodova · nastavnička korekcija`;
  if(g.points!==null&&g.points!==undefined)return `${g.points} / ${g.maxPoints} potvrđenih bodova${g.status==='program_error'?' · pogreška programa':''}`;
  return labels[g.status]??'Rezultat nije dostupan.';
}
export function GradingReport({grading}:{grading:any}){
  const report=grading?.report,review=grading?.teacherReview;
  const observations=report?gradingObservations(report,grading?.profileId):[];
  return <div className="school-grade-result"><strong>{gradingLabel(grading)}</strong>
    <p className="lesson-small">Funkcionalni bodovi potvrđuju ponašanje programa i sklopa prema objavljenim kriterijima. Obrazloženje, samostalnost i demonstriranu promjenu pregledava nastavnik zasebno; bodovi se ovdje ne pretvaraju automatski u ocjenu.</p>
    {legacyInputProfiles.includes(grading?.profileId??report?.profileId)&&<p role="note">Ova ranija rubrika tipkala ili regulatora ima poznato ograničenje: unaprijed pripremljen vremenski izlaz može proći bez ovisnosti o upravljačkom ulazu. Izvorni rezultat ostaje sačuvan. Nastavnik može zabilježiti dodatni pregled ili obrazloženu korekciju; za novu dodjelu dostupna je odgovarajuća 24P rubrika.</p>}
    {grading?.revision&&<p>Rezultat pripada spremljenoj reviziji {grading.revision}.</p>}
    {review&&<p>{review.action==='correct'?`Izvorni automatski bodovi: ${grading.points??'nema potvrđenog rezultata'}${grading.points==null?'':' / '+grading.maxPoints}.`:'Vraćeno je automatsko bodovanje.'} {review.reason}<br/><small>{review.author.displayName} · {schoolTime(review.createdAt)}</small></p>}
    {(report?.message||grading?.message)&&<p>{report?.message??grading.message}</p>}
    {report?.criteria&&<details><summary>Kriteriji i objašnjenja</summary><ul>{report.criteria.map((c:any)=><li key={c.id}><b>{c.points} / {c.maxPoints}</b> · {c.description}<br/><small>{c.explanation}</small></li>)}</ul></details>}
    {observations.length>0&&<details><summary>Opažanja po scenarijima</summary><ul>{observations.map((s,i)=><li key={i}>{s.title}: {s.status==='passed'?'potvrđen':s.status==='failed'?'nije potvrđen':'zabilježena opažanja'}<ul>{s.details.map((line,j)=><li key={j}>{line}</li>)}</ul></li>)}</ul></details>}
  </div>;
}
export default function SchoolGrading({binding,revision,saved,rubric,expanded=true}:{expanded?:boolean;binding:SchoolBinding;revision:number;saved:boolean;rubric?:any}){
  const api=useRef(new SchoolApi()),[grading,setGrading]=useState<any>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    let cancelled=false,running=false;
    setGrading(undefined);setError('');
    async function poll(){
      if(running||cancelled||document.visibilityState==='hidden'||binding.origin!==location.origin)return;running=true;
      try{await api.current.session(binding.userId);const s=await api.current.request('grading&id='+binding.attemptId+'&revision='+revision);
        if(!cancelled){setGrading(s.grading);setError('');}}
      catch(e){if(!cancelled){setError((e as Error).message);if([401,403].includes((e as any).status))setGrading(undefined);}}
      finally{running=false;}
    }
    void poll();const timer=setInterval(()=>void poll(),5000);const visible=()=>{if(document.visibilityState==='visible')void poll();};document.addEventListener('visibilitychange',visible);
    return()=>{cancelled=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
  },[binding.attemptId,binding.userId,binding.origin,revision]);
  return <section className="school-grading" aria-label="Moji službeni bodovi"><h4>Moji bodovi</h4>
    {rubric&&<details className="school-published-contract" hidden={!expanded}><summary>Objavljeni službeni uvjeti ove dodjele · {rubric.profileId??'opisna rubrika'}</summary><p>{rubric.instructions}</p>{Array.isArray(rubric.criteria)&&<ul>{rubric.criteria.map((c:any)=><li key={c.id}>{c.description} · {c.maxPoints} bodova</li>)}</ul>}</details>}
    <div role="status" aria-live="polite">{expanded?<GradingReport grading={grading}/>:<p><strong>{gradingLabel(grading)}</strong>{grading?.revision?` · spremljena revizija ${grading.revision}`:''}</p>}</div>
    {!saved&&<p>Ovo je rezultat prethodno spremljene revizije. Lokalne izmjene još nemaju potvrđene bodove.</p>}
    {error&&<p role="alert">{error}</p>}
    {expanded&&grading&&!['not_enabled','unsupported'].includes(grading.status)&&<button disabled={busy||!saved||['queued','running'].includes(grading.status)} onClick={()=>{
      setBusy(true);setError('');void(async()=>{try{await api.current.session(binding.userId);const value=await api.current.request('request-grade',{attemptId:binding.attemptId,expectedRevision:revision,requestKey:crypto.randomUUID()});setGrading(value.grading);}catch(e){setError((e as Error).message);}finally{setBusy(false);}})();
    }}>Provjeri spremljenu reviziju / ponovi</button>}
    <p hidden={!expanded} className="lesson-small">Bodove potvrđuje školski poslužitelj za prikazanu reviziju. Završetak zaključava sadržaj; provjera može završiti naknadno.</p>
    <div hidden={!expanded}><SchoolFeedback attemptId={binding.attemptId} revision={revision}/></div>
  </section>;
}
