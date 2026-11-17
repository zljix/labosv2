import {useEffect,useRef,useState} from 'react';
import {SchoolApi} from './schoolSync';
import {schoolTime} from './SchoolWork';

export default function SchoolFeedback({attemptId,revision,staff=false,archived=false,changed}:{attemptId:number;revision:number;staff?:boolean;archived?:boolean;changed?:()=>void}){
  const api=useRef(new SchoolApi()),epoch=useRef(0),requestKey=useRef<{body:string;key:string}|undefined>(undefined);
  const [reviews,setReviews]=useState<any[]>([]),[last,setLast]=useState(0),[next,setNext]=useState<number>(),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState(''),[action,setAction]=useState('comment'),[points,setPoints]=useState('');
  useEffect(()=>{++epoch.current;setReviews([]);setLoaded(false);setLast(0);setNext(undefined);setReason('');setPoints('');setAction('comment');setBusy(false);setError('');return()=>{++epoch.current;};},[attemptId,revision]);
  async function load(before?:number){
    const tick=++epoch.current;setBusy(true);setError('');
    try{await api.current.session();const s=await api.current.request('work-feedback&id='+attemptId+'&revision='+revision+(before?'&before='+before:''));
      if(tick!==epoch.current)return;setReviews(old=>before?[...old,...s.reviews]:s.reviews);setLast(s.latestReviewId);setNext(s.hasMore?s.nextBefore:undefined);setLoaded(true);
    }catch(e){if(tick===epoch.current){setError((e as Error).message);if([401,403].includes((e as any).status)){setReviews([]);setLoaded(false);}}}
    finally{if(tick===epoch.current)setBusy(false);}
  }
  async function save(){
    const tick=epoch.current;setBusy(true);setError('');
    const body={attemptId,revision,action,reason,points:action==='correct'?Number(points):null,expectedReviewId:last};
    const serialized=JSON.stringify(body);if(requestKey.current?.body!==serialized)requestKey.current={body:serialized,key:crypto.randomUUID()};
    try{await api.current.session();const s=await api.current.request('review-work',{...body,requestKey:requestKey.current!.key});
      if(tick!==epoch.current)return;setReviews(s.reviews);setLast(s.latestReviewId);setNext(s.hasMore?s.nextBefore:undefined);setReason('');changed?.();
    }catch(e){if(tick===epoch.current){setError((e as Error).message);if([401,403].includes((e as any).status)){setReviews([]);setLoaded(false);}}}
    finally{if(tick===epoch.current)setBusy(false);}
  }
  return <section className="school-feedback" aria-label="Povratna informacija nastavnika">
    {staff&&<p>Pregled razumijevanja zabilježi komentarom: učenikovo objašnjenje, samostalna promjena i demonstracija. Javna rješenja služe vježbanju. Za samostalnu provjeru novog funkcionalnog zahtjeva objavi odgovarajuću novu rubriku; tekstna napomena ne mijenja automatski provjeravač.</p>}
    <button disabled={busy} onClick={()=>void load()}>Komentari i povijest korekcija / osvježi</button>
    {loaded&&<><p>Zapisi pripadaju reviziji {revision}. Izvorni automatski rezultat i raniji zapisi ostaju sačuvani.</p>
      {!reviews.length&&<p>Za ovu reviziju još nema komentara.</p>}
      <ul>{reviews.map(r=><li key={r.id}><b>{r.action==='correct'?`Nastavnička korekcija: ${r.points} / ${r.maxPoints}`:r.action==='restore'?'Vraćeno automatsko bodovanje':'Komentar'}</b><p>{r.reason}</p><small>{r.author.displayName} · {schoolTime(r.createdAt)}</small></li>)}</ul>
      {next&&<button disabled={busy} onClick={()=>void load(next)}>Stariji zapisi</button>}
      {staff&&!archived&&<form onSubmit={e=>{e.preventDefault();void save();}}><label>Vrsta zapisa<select disabled={busy} value={action} onChange={e=>setAction(e.target.value)}><option value="comment">Komentar</option><option value="correct">Korekcija ukupnih bodova</option><option value="restore">Vrati automatsko bodovanje</option></select></label>
        {action==='correct'&&<label>Novi bodovi unutar objavljenog maksimuma<input type="number" min="0" step="0.01" value={points} required disabled={busy} onChange={e=>setPoints(e.target.value)}/></label>}
        <label>{action==='comment'?'Komentar za učenika':'Obvezan razlog promjene'}<textarea value={reason} maxLength={2000} required disabled={busy} onInput={e=>setReason(e.currentTarget.value)}/></label>
        <button disabled={busy||!reason.trim()}>Spremi zapis uz ovu reviziju</button></form>}
      {archived&&<p>Arhivirana godina: zapisi su dostupni za čitanje.</p>}
    </>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
