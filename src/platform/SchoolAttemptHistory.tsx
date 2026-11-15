import {useRef,useState} from 'react';
import {SchoolApi} from './schoolSync';
import {gradingLabel} from './SchoolGrading';

export default function SchoolAttemptHistory({api,attemptId,select}:{api:SchoolApi;attemptId:number;select:(id:number)=>Promise<void>}){
  const [rows,setRows]=useState<any[]>([]),[visible,setVisible]=useState(false),[next,setNext]=useState<number>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const epoch=useRef(0);
  async function load(before?:number){
    const tick=++epoch.current;setBusy(true);setError('');
    try{const s=await api.request('attempt-history&id='+attemptId+(before?'&before='+before:''));if(tick!==epoch.current)return;
      setRows(old=>before?[...old,...s.attempts]:s.attempts);setNext(s.hasMore?s.nextBefore:undefined);setVisible(true);
    }catch(e){if(tick===epoch.current){setError((e as Error).message);if([401,403].includes((e as any).status))setRows([]);}}
    finally{if(tick===epoch.current)setBusy(false);}
  }
  return <section className="school-attempt-history" aria-label="Povijest školskih pokušaja">
    <button disabled={busy} onClick={()=>void load()}>Povijest pokušaja / osvježi</button>
    {visible&&<><ul>{rows.map(row=><li key={row.attempt.id}><b>Pokušaj {row.attempt.number}</b> · {row.attempt.status==='locked'?'Zaključano':row.attempt.number>1?'Dorada dopuštena':'U radu'} · revizija {row.attempt.revision}
      <p>{gradingLabel(row.submission?.grading??row.attempt.grading)}{row.submission?' · predaja #'+row.submission.id:''}</p>
      {row.reopening&&<p>Razlog dorade: {row.reopening.reason}</p>}
      <button disabled={busy} onClick={()=>{setBusy(true);void select(row.attempt.id).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Pregledaj pokušaj {row.attempt.number}</button>
    </li>)}</ul>{next&&<button disabled={busy} onClick={()=>void load(next)}>Stariji pokušaji</button>}
    <button onClick={()=>{++epoch.current;setVisible(false);setBusy(false);}}>Zatvori povijest pokušaja</button></>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
