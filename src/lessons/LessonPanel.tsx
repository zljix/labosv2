import {appAsset} from '../platform/assets';
import { useEffect, useState } from 'react';
import type { Project } from '../project/model';
import { getLesson, lessons, readWork, type LessonWork } from './catalog';
import { readResult, sourceHash } from './verify';
import './lessons.css';
import {UrsCatalog} from './UrsPanel';
import {ursLessons,type UrsTarget} from './ursCatalog';

export function LessonCatalog({open,busy,openUrs,initialTarget,reviewClass}:{open:(id:string,solution?:boolean)=>void;busy:boolean;openUrs:(lesson:string,variant:string,target:UrsTarget,peer:UrsTarget)=>void;initialTarget:UrsTarget;reviewClass:()=>void}) {
  const [collection,setCollection]=useState<'intro'|'urs'>('urs');
  return <div className="lesson-catalog">
    <div className="lesson-inline-actions" role="group" aria-label="Zbirka vježbi"><button aria-pressed={collection==='intro'} onClick={()=>setCollection('intro')}>Početnih pet vježbi · V1–5</button><button aria-pressed={collection==='urs'} onClick={()=>setCollection('urs')}>URS zbirka · {ursLessons.length} tema</button><button disabled={busy} onClick={reviewClass}>Pregled predaja razreda</button></div>
    {collection==='urs'?<UrsCatalog busy={busy} open={openUrs} initialTarget={initialTarget}/>:<>
    <p>Pet koraka od izlaza do regulatora. Svaka vježba otvara novi lokalni projekt s uputama i početnim kodom.</p>
    <div className="lesson-cards">{lessons.map(l=><button className="lesson-card" key={l.id} onClick={()=>open(l.id)} disabled={busy}>
      <span className="lesson-number">{String(l.number).padStart(2,'0')}</span><span><strong>{l.title}</strong><small>{l.goal}</small><em>{l.minutes} · upute, zadatak i provjera</em></span><span aria-hidden="true">›</span>
    </button>)}</div>
    <details className="teacher-reference"><summary>Nastavnički uzorci i priprema pilota</summary><p>Uzorci otvaraju zaseban riješeni projekt za pripremu nastave. Učenički projekt ostaje sačuvan. Uzorci su dostupni u ovoj lokalnoj beti, bez odvojenih korisničkih uloga.</p><div className="lesson-inline-actions">{lessons.map(l=><button key={l.id} disabled={busy} onClick={()=>open(l.id,true)}>V{l.number} · uzorak</button>)}</div><a href={appAsset('pilot.html')} target="_blank" rel="noreferrer">Otvori obrazac za stvarni pilot ↗</a></details></>}
  </div>;
}
interface Props {
  project:Project; change:(work:LessonWork)=>void; busy:boolean; progress:string;
  run:()=>void; cancel:()=>void; submit:()=>void; circuit:()=>void; catalog:()=>void;
  teacher:boolean; toggleTeacher:()=>void; importReview:()=>void;
}
export default function LessonPanel({project:p,change,busy,progress,run,cancel,submit,circuit,catalog,teacher,toggleTeacher,importReview}:Props) {
  const work=readWork(p),l=work&&getLesson(work.lessonId),r=readResult(p);
  const [fresh,setFresh]=useState(false);
  useEffect(()=>{let active=true;setFresh(false);if(r)void sourceHash(p).then(h=>{if(active)setFresh(h===r.sourceHash);}).catch(()=>{});return()=>{active=false;};},[p]);
  if(!work||!l)return <div className="lesson-empty"><span className="lesson-kicker">UČENJE KROZ POKUS</span><h2>Odaberi nastavnu vježbu.</h2><p>Upute uvode svaki novi pojam prije primjene. Početnih pet vježbi ima automatsku provjeru programa; URS zbirka dodaje vođene pokuse i ručna opažanja.</p><button className="primary" onClick={catalog}>Otvori katalog vježbi</button><button onClick={importReview}>Uvezi predaju za pregled</button>{p.files['vjezba.json']&&<p role="alert">Podaci vježbe nisu podržani ili su neispravni. Kôd i sklop možeš pregledati u Sastavljanju.</p>}</div>;
  const passed=r?.checks.filter(c=>c.passed).length??0;
  return <article className="lesson-content" aria-label={`Vježba ${l.number}: ${l.title}`}>
    <div className="lesson-title"><div><span className="lesson-kicker">VJEŽBA {l.number} / 5 · {l.minutes}</span><h2>{l.title}</h2></div><button onClick={catalog}>Sve vježbe</button></div>
    <p className="lesson-goal">{l.goal}</p>
    <div className="lesson-mode"><button aria-pressed={teacher} onClick={toggleTeacher}>{teacher?'Nastavnikov pregled':'Učenički rad'} ⇄</button>{teacher&&<button onClick={importReview}>Uvezi predaju</button>}</div>
    {teacher&&<section className="teacher-note"><h3>Pregled učeničkog paketa</h3><p><b>{work.student||'Ime nije upisano'}</b> · {work.group||'Razred nije upisan'}</p><p>Pregledaj odgovore, kôd i veze. Uvezeni zapis je učenikova lokalna tvrdnja; hash potvrđuje podudaranje sadržaja, ne autentičnost. Klikni <b>Ponovi provjeru na ovom računalu</b> za novo izvršavanje ugrađenog scenarija.</p><button onClick={circuit}>Pregledaj sklop i kôd</button></section>}
    <section><h3>1 · Prije početka</h3><p>{l.before}</p><dl className="lesson-concepts">{l.concepts.map(c=><div key={c.term}><dt>{c.term}</dt><dd>{c.explanation}</dd></div>)}</dl></section>
    <section><h3>2 · Spojevi i vođeni primjer</h3><table><thead><tr><th>Priključci / veza</th><th>Objašnjenje</th></tr></thead><tbody>{l.connections.map(([a,b])=><tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody></table><p className="lesson-small">Predloženi GPIO-i odgovaraju početnom kodu. Možeš koristiti druge podržane GPIO-e ako prilagodiš kôd i spojeve.</p><pre className="lesson-code"><code>{l.guided}</code></pre><button onClick={circuit}>Otvori Sastavljanje i editor</button></section>
    <section><h3>3 · Samostalni rad</h3><ol>{l.steps.map(s=><li key={s}>{s}</li>)}</ol><details><summary>Pomoć kada ne radi</summary><ul>{l.tips.map(s=><li key={s}>{s}</li>)}</ul></details></section>
    <section className="lesson-check"><h3>4 · Provjera rada</h3><ul>{l.criteria.map(s=><li key={s}>{s}</li>)}</ul><p>Provjera pokreće kopiju trenutačnog koda i sklopa te sama mijenja ulaze. Traje približno 2–25 s. Nacrt i početni okoliš ostaju sačuvani.</p><div className="lesson-inline-actions"><button className="primary" onClick={run} disabled={busy}>{busy?'Provjera je u tijeku…':teacher?'Ponovi provjeru na ovom računalu':'Provjeri rad'}</button>{busy&&<button onClick={cancel}>Prekini provjeru</button>}</div><p role="status" aria-live="polite">{progress}</p>
      {r&&<><p className={`lesson-result-title ${fresh&&passed===r.checks.length?'passed':''}`}><b>{passed}/{r.checks.length}</b> u sačuvanom lokalnom zapisu · {fresh?'odgovara trenutačnom kodu i sklopu':'zapis je zastario — ponovi provjeru'}</p><p className="lesson-small">{new Date(r.finishedAt).toLocaleString('hr-HR')} · Provjera {r.checkerVersion}. Lokalni zapis može se uređivati i nije ovjerena ocjena.</p><div className="lesson-results">{r.checks.map((c,i)=><details key={c.id+i} className={c.passed?'passed':'failed'} open={!c.passed}><summary>{c.passed?'✓':'!'} {c.title} · {c.passed?'prolazi':'potreban ispravak'}</summary><p><b>Očekivano:</b> {c.expected}</p><p><b>Opaženo:</b> {c.observed}</p></details>)}</div></>}
    </section>
    <section><h3>5 · Odgovori i dokazi</h3><p>Ovdje zapiši svoja opažanja. Automatska provjera ne ocjenjuje obrazloženja.</p><div className="lesson-student"><label>Ime i prezime<input value={work.student} maxLength={100} onChange={e=>change({...work,student:e.target.value})} autoComplete="name"/></label><label>Razred / grupa<input value={work.group} maxLength={40} onChange={e=>change({...work,group:e.target.value})}/></label></div>{l.questions.map((q,i)=><label className="lesson-answer" key={q}>{i+1}. {q}<textarea value={work.answers[i]} maxLength={2000} rows={3} onChange={e=>change({...work,answers:work.answers.map((a,j)=>j===i?e.target.value:a)})}/></label>)}</section>
    <section className="lesson-submit"><h3>6 · Predaja</h3><p>ZIP sadrži sklop, sve projektne datoteke, upute, odgovore i zapis provjere. Nakon izmjene koda ili sklopa ponovi provjeru. Moguće je predati i rezultat s pogreškama radi nastavnikove povratne informacije.</p><button className="primary" onClick={submit} disabled={busy}>Preuzmi ZIP za predaju</button><p className="lesson-small">Preuzeti paket sam predaj nastavniku dogovorenim putem. Aplikacija ga ne šalje i ne prikuplja popis učenika.</p></section>
  </article>;
}
