import {useEffect,useRef,useState} from 'react';
import {SchoolApi,type SchoolBinding} from './schoolSync';

const labels:Record<string,string>={not_enabled:'Ova inačica zadatka nema službeno bodovanje.',unsupported:'Provjera za ovaj cilj još nije podržana.',not_requested:'Provjera nije u redu. Zatraži provjeru spremljene revizije.',queued:'Spremljena revizija čeka provjeru.',running:'Provjera spremljene revizije je u tijeku.',technical_error:'Tehnička pogreška servisa. Bodovi nisu dodijeljeni.',execution_limit:'Dosegnuto je ograničenje izvođenja. Bodovi nisu dodijeljeni.',superseded:'Provjeru je zamijenila novija spremljena revizija.'};
export function gradingLabel(g:any):string{
  if(!g)return 'Još nema potvrđenog rezultata';
  if(g.points!==null&&g.points!==undefined)return `${g.points} / ${g.maxPoints} potvrđenih bodova${g.status==='program_error'?' · pogreška programa':''}`;
  return labels[g.status]??'Rezultat nije dostupan.';
}
export function GradingReport({grading}:{grading:any}){
  const report=grading?.report;
  return <div className="school-grade-result"><strong>{gradingLabel(grading)}</strong>
    {grading?.revision&&<p>Rezultat pripada spremljenoj reviziji {grading.revision}.</p>}
    {(report?.message||grading?.message)&&<p>{report?.message??grading.message}</p>}
    {report?.criteria&&<details><summary>Kriteriji i objašnjenja</summary><ul>{report.criteria.map((c:any)=><li key={c.id}><b>{c.points} / {c.maxPoints}</b> · {c.description}<br/><small>{c.explanation}</small></li>)}</ul></details>}
    {report?.samples&&<details><summary>Opažanja po scenarijima</summary><ul>{report.samples.map((s:any)=><li key={s.index}>Pokus {s.index}: {s.passed?'potvrđen':'nije potvrđen'}{s.pressed!==undefined?' · tipkalo '+(s.pressed?'pritisnuto':'otpušteno'):s.position!==undefined?' · potenciometar '+Math.round(s.position*1000)/10+' %':` · ${s.temperature} °C / ${s.pressure} Pa`}</li>)}</ul></details>}
  </div>;
}
export default function SchoolGrading({binding,revision,saved}:{binding:SchoolBinding;revision:number;saved:boolean}){
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
    <div role="status" aria-live="polite"><GradingReport grading={grading}/></div>
    {!saved&&<p>Ovo je rezultat prethodno spremljene revizije. Lokalne izmjene još nemaju potvrđene bodove.</p>}
    {error&&<p role="alert">{error}</p>}
    {grading&&!['not_enabled','unsupported'].includes(grading.status)&&<button disabled={busy||!saved||['queued','running'].includes(grading.status)} onClick={()=>{
      setBusy(true);setError('');void(async()=>{try{await api.current.session(binding.userId);const value=await api.current.request('request-grade',{attemptId:binding.attemptId,expectedRevision:revision,requestKey:crypto.randomUUID()});setGrading(value.grading);}catch(e){setError((e as Error).message);}finally{setBusy(false);}})();
    }}>Provjeri spremljenu reviziju / ponovi</button>}
    <p className="lesson-small">Bodove potvrđuje školski poslužitelj za prikazanu reviziju. Završetak zaključava sadržaj; provjera može završiti naknadno.</p>
  </section>;
}
