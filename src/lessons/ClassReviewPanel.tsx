import SchoolClassReview from '../platform/SchoolClassReview';
import {useState} from 'react';
import type {Project} from '../project/model';
import {LIMITS} from '../project/model';
import {download,safeFilename} from '../project/archive';
import {getUrsLesson,targetForProject,ursTargets} from './ursCatalog';
import {readUrsWork} from './ursWork';
import {APP_VERSION} from '../platform/assets';
import {REVIEW_LIMITS,inspectUrsSubmission,addReviewEntry,editReviewNote,setReviewVerdict,reviewVerdicts,reviewRecords,exportReviewReport,importReviewReport,restoreReviewReport,reviewCSV,reviewedProject,exportReviewedProject,emptyReviewSession,type ReviewSession,type ReviewVerdict} from './classReview';
import './classReview.css';

interface Props {session:ReviewSession;change:(s:ReviewSession)=>void;busy:boolean;setBusy:(b:boolean)=>void;current:Project;open:(p:Project)=>Promise<void>}
export default function ClassReviewPanel({session,change,busy,setBusy,current,open}:Props){
 const [query,setQuery]=useState(''),[group,setGroup]=useState(''),[verdict,setVerdict]=useState(''),[message,setMessage]=useState(''),[problems,setProblems]=useState<string[]>([]);
 const setSelected=(id:string)=>change({...session,selected:id});
 const matches=(e:ReviewSession['entries'][number],q:string,g:string,v:string)=>(!g||e.work.group===g)&&(!v||e.review.verdict===v)&&[e.work.student,e.filename,e.work.group,getUrsLesson(e.work.lessonId)!.title,e.work.variantId].join(' ').toLocaleLowerCase('hr').includes(q.trim().toLocaleLowerCase('hr'));
 const filters=session.entries.filter(e=>matches(e,query,group,verdict));
 const entry=session.entries.find(e=>e.contentHash===session.selected)??filters[0],lesson=entry&&getUrsLesson(entry.work.lessonId)!;
 function filterTo(q:string,g:string,v:string){setQuery(q);setGroup(g);setVerdict(v);setSelected(session.entries.find(e=>matches(e,q,g,v))?.contentHash??'');}
 const stamp={current:'Podudara se s programom i sklopom',missing:'Pregled sadržaja nedostaje',stale:'Program ili sklop promijenjen je nakon zapisa'};
 async function action(fn:()=>Promise<void>){setBusy(true);setMessage('');try{await fn();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function addFiles(files:File[]){
  if(!files.length)return;
  await action(async()=>{
   if(files.length>REVIEW_LIMITS.files||files.reduce((n,f)=>n+f.size,0)>REVIEW_LIMITS.totalBytes)throw Error('Odaberi do 30 datoteka, ukupno do 64 MiB. Svaki paket smije imati najviše 2 MiB.');
   let next=session,added=0;const issues:string[]=[];
   for(const file of files){try{
    if(file.size>LIMITS.archiveBytes)throw Error('Paket je veći od 2 MiB.');
    const item=await inspectUrsSubmission(new Uint8Array(await file.arrayBuffer()),file.name);
    next=addReviewEntry(next,item);added++;if(!entry&&added===1)next={...next,selected:item.contentHash};
    change(next);
   }catch(e){issues.push(file.name+': '+(e as Error).message);}}
   setProblems(issues);setMessage(`Učitano: ${added}. Preskočeno: ${issues.length}. Programi nisu pokrenuti.`);
  });
 }
 async function restore(file?:File){
  if(!file)return;
  await action(async()=>{
   if(file.size>REVIEW_LIMITS.reportBytes)throw Error('Evidencija smije imati najviše 512 KiB.');
   const records=importReviewReport(await file.text()),result=restoreReviewReport(session,records);change(result.session);
   setProblems(result.conflicts.map(name=>name+': zadržana je postojeća bilješka; uvezeni zapis je različit.'));
   setMessage(`Evidencija učitana: ${records.length-result.conflicts.length} zapisa. Bilješke se povezuju isključivo s jednakim sadržajem predaje. Uvezeni status ostaje ručni zapis.`);
  });
 }
 function update(fn:()=>ReviewSession){try{change(fn());setMessage('');}catch(e){setMessage((e as Error).message);}}
 const downloadReport=()=>{try{download('URS_evidencija_razreda.json',exportReviewReport(session,APP_VERSION),'application/json');change({...session,dirty:false});setMessage('Evidencija je pripremljena za preuzimanje. Sačuvaj JSON i izvorne predaje za nastavak pregleda.');}catch(e){setMessage((e as Error).message);}};
 return <section className="class-review" aria-label="Pregled URS predaja razreda">
  <SchoolClassReview open={open}/><details className="school-local-review"><summary>Lokalni uvoz i ručna evidencija predaja</summary><p className="review-intro">Učitaj URS ZIP-ove ili JSON projekte i pregledaj odgovore, opažanja i sklopove. Evidencija ostaje u ovoj otvorenoj aplikaciji. Za nastavak preuzmi JSON evidencije, zatim pri novom otvaranju ponovno učitaj evidenciju i izvorne predaje.</p>
  <p className="lesson-small">Učitavanje provjerava format, popunjenost i podudaranje sadržaja. Nastavnički status upisuješ nakon vlastitog pregleda i pokusa. Hash i uvezeni zapis ne potvrđuju ispravnost programa ili autorstvo. Početne V1–V5 pregledavaju se pojedinačno.</p>
  <fieldset disabled={busy} className="review-imports"><legend>1 · Učitaj radove</legend>
   <label>Predaje ZIP / JSON · do 30 odjednom<input type="file" multiple accept=".zip,.json,application/zip,application/json" onChange={e=>{const files=Array.from(e.currentTarget.files??[]);e.currentTarget.value='';void addFiles(files);}}/></label>
   <label>Nastavi iz JSON evidencije<input type="file" accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void restore(file);}}/></label>
   <button disabled={!readUrsWork(current)} onClick={()=>void action(async()=>{const item=await inspectUrsSubmission(new TextEncoder().encode(JSON.stringify(current)),safeFilename(current.title)+'.json');change({...addReviewEntry(session,item),selected:item.contentHash});setMessage('Otvoreni URS projekt dodan je kao snimka. Daljnje izmjene u laboratoriju ne mijenjaju ovu predaju.');})}>Dodaj otvoreni URS projekt</button>
  </fieldset>
  <p role="status" aria-live="polite" className="review-status">{busy?'Obrađujem predaje…':message||(!reviewRecords(session).length?'Najprije učitaj predaje ili sačuvanu evidenciju.':`${session.entries.length} učitanih predaja · ${session.entries.filter(e=>e.review.verdict==='pending').length} na čekanju · ${session.dirty?'evidencija ima nespremljene promjene':'evidencija nije mijenjana nakon izvoza'}`)}</p>
  {!!problems.length&&<details className="review-problems" open><summary>Preskočene datoteke ili sukobi · {problems.length}</summary><ul>{problems.map((p,i)=><li key={i}>{p}</li>)}</ul></details>}
  {!!session.waiting.length&&<details className="review-waiting"><summary>Zapisi bez učitane predaje · {session.waiting.length}</summary><p>Ponovno odaberi izvorne ZIP-ove. Izmijenjen program, sklop, odgovor ili opažanje čini drugu predaju; bilješka se tada ne prenosi.</p><ul>{session.waiting.map(r=><li key={r.contentHash}>{r.student||'Bez imena'} · {r.filename} · {reviewVerdicts[r.verdict]}</li>)}</ul></details>}
  {!!session.entries.length&&<>
   <div className="review-filters"><label>Pretraži radove<input value={query} onChange={e=>filterTo(e.target.value,group,verdict)} placeholder="Učenik, naziv, vježba…"/></label><label>Razred / grupa<select aria-label="Razred ili grupa" value={group} onChange={e=>filterTo(query,e.target.value,verdict)}><option value="">Svi razredi</option>{[...new Set(session.entries.map(e=>e.work.group))].sort().filter(Boolean).map(g=><option key={g}>{g}</option>)}</select></label><label>Status<select aria-label="Status pregleda" value={verdict} onChange={e=>filterTo(query,group,e.target.value)}><option value="">Svi statusi</option>{Object.entries(reviewVerdicts).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label></div>
   <div className="review-layout"><nav aria-label="Učitane predaje" className="review-list">{filters.map(e=>{const l=getUrsLesson(e.work.lessonId)!;return <button key={e.contentHash} aria-pressed={entry?.contentHash===e.contentHash} onClick={()=>setSelected(e.contentHash)}><b>{e.work.student||'Ime nije upisano'}</b><span>{e.work.group||'Grupa nije upisana'} · URS{String(l.number).padStart(2,'0')} · {ursTargets[targetForProject(e.project)].label}</span><small>{reviewVerdicts[e.review.verdict]} · odgovori {e.answered}/{e.work.answers.length} · opažanja {e.observed}/3</small>{e.snapshot!=='current'&&<small className="review-warning">{stamp[e.snapshot]}</small>}</button>;})}{!filters.length&&<p>Nema predaja za odabrane filtre.</p>}</nav>
   {entry&&lesson&&<article className="review-detail" key={entry.contentHash} aria-label="Odabrana predaja">
    <p className="lesson-kicker">2 · PREGLEDAJ I ZAPIŠI OPAŽENO</p>{!filters.includes(entry)&&<p role="status">Odabrani rad ostaje otvoren; više ne odgovara aktivnim filtrima.</p>}<h3>{entry.work.student||'Ime nije upisano'} · {entry.work.group||'Grupa nije upisana'}</h3><p><b>URS{String(lesson.number).padStart(2,'0')} · {lesson.title}</b><br/>{lesson.variants.find(v=>v.id===entry.work.variantId)!.title} · {ursTargets[targetForProject(entry.project)].label}{entry.project.radio&&` · čvor B: ${ursTargets[targetForProject(entry.project.radio.peer)].label}`}</p><p className="review-filename">{entry.filename}</p>
    <p className={entry.snapshot==='current'?'review-check':'review-warning'}>{stamp[entry.snapshot]}. Odgovori {entry.answered}/{entry.work.answers.length}; opažanja {entry.observed}/3.</p>
    <button disabled={busy} className="primary" onClick={()=>void action(async()=>{const p=entry.review.verdict==='pending'?entry.project:await reviewedProject(entry);await open(p);})}>Otvori za pokus u laboratoriju</button><p className="lesson-small">Otvara zaustavljenu kopiju. Nakon pregleda ponovno otvori Pregled razreda i upiši bilješku. Izmijeniš li sadržaj, novu inačicu dodaj gumbom iznad; prethodna ostaje zasebno.</p>
    <details><summary>Odgovori i tri opažanja</summary><dl>{([['baseline','Početni pokus'],['change','Promjena'],['fault','Pogreška i oporavak']]as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{entry.work.observations[key]||'Nije upisano.'}</dd></div>)}{lesson.questions.map((q,i)=><div key={q}><dt>{i+1}. {q}</dt><dd>{entry.work.answers[i]||'Nije odgovoreno.'}</dd></div>)}</dl></details>
    <details><summary>Kriteriji pregleda i uvezeni nastavnički zapis</summary><ul>{lesson.criteria.map(c=><li key={c}>{c}</li>)}</ul>{entry.work.review?<><p>{entry.embeddedReview==='current'?'Uvezeni zapis podudara se sa sadržajem.':'Uvezeni zapis odnosi se na raniji sadržaj.'} {entry.work.review.verdict==='reviewed'?'Pregledano':'Potrebna dorada'} · {entry.work.review.recordedAt}</p><p className="review-note-text">{entry.work.review.note}</p></>:<p>U predaji nema nastavničkog zapisa.</p>}<p>Uvezeni zapis ne postavlja status ovog pregleda. Zapiši vlastito opažanje.</p></details>
    <label className="lesson-answer">Bilješka ovog pregleda<textarea disabled={busy} maxLength={3000} rows={4} value={entry.review.note} onChange={e=>update(()=>editReviewNote(session,entry.contentHash,e.target.value))} placeholder="Što si pregledao, ponovno pokrenuo i opazio? Što učenik treba doraditi?"/></label><p className="lesson-small">Izmjena bilješke vraća status na čekanje. Potvrdi završni zapis jednim od gumba.</p>
    <div className="lesson-inline-actions">{(['revise','reviewed','pending']as ReviewVerdict[]).map(v=><button key={v} disabled={busy} aria-pressed={entry.review.verdict===v} onClick={()=>update(()=>setReviewVerdict(session,entry.contentHash,v))}>{v==='pending'?'Vrati na čekanje':reviewVerdicts[v]}</button>)}</div>
    <p><b>{reviewVerdicts[entry.review.verdict]}</b>{entry.review.recordedAt&&` · ${entry.review.recordedAt}`} · {entry.origin==='imported'?'uvezeni ručni zapis':'ručni zapis ovog pregleda'}</p>
    <div className="lesson-inline-actions"><button disabled={busy||entry.review.verdict==='pending'} onClick={()=>void action(async()=>{download(safeFilename(entry.work.student||entry.project.title)+'_URS_pregled.zip',await exportReviewedProject(entry),'application/zip');setMessage('Projekt s bilješkom pripremljen je za preuzimanje. Izvorna predaja ostaje sačuvana u ovom pregledu.');})}>Preuzmi projekt s bilješkom ZIP</button><button disabled={busy} onClick={()=>{change({...session,entries:session.entries.filter(e=>e!==entry),waiting:session.waiting.filter(r=>r.contentHash!==entry.contentHash),dirty:true});setMessage('Predaja je uklonjena iz ovog pregleda. Izvorna datoteka ostaje na tvojem uređaju.');}}>Ukloni iz pregleda</button></div>
   </article>}</div>
  </>}
  <div className="review-exports"><h3>3 · Sačuvaj evidenciju</h3><p>JSON čuva bilješke za nastavak, a CSV daje tablični pregled. Izvorni programi i sklopovi ostaju u učeničkim ZIP-ovima; sačuvaj ih zajedno s evidencijom. Izvoz obuhvaća sve predaje i zapise bez učitanih predaja, neovisno o filtrima.</p><div className="lesson-inline-actions"><button disabled={busy||!reviewRecords(session).length} className="primary" onClick={downloadReport}>Preuzmi evidenciju JSON</button><button disabled={busy||!reviewRecords(session).length} onClick={()=>{download('URS_evidencija_razreda.csv',reviewCSV(session),'text/csv;charset=utf-8');setMessage('CSV cijele evidencije pripremljen je za preuzimanje. Za nastavak s bilješkama sačuvaj i JSON.');}}>Preuzmi pregled CSV</button><button disabled={busy||!reviewRecords(session).length} onClick={()=>{change(emptyReviewSession());setProblems([]);setGroup('');setQuery('');setVerdict('');setMessage('Otvoren je prazan pregled. Za vraćanje učitaj sačuvanu evidenciju i izvorne predaje.');}}>Započni prazan pregled</button></div></div>
 </details></section>;
}
