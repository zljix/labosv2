import {useState} from 'react';
import {practices} from './collectionPlans';
import type {PracticeKey} from './collectionSimulation';
import titles from './iotUsTitles.json';
import type {Project} from '../project/model';

export function PracticePanel({lesson,project,consoleText,run,circuit,edit,save,catalog}:{
  lesson:PracticeKey;project:Project;consoleText:string;run:()=>void;circuit:()=>void;
  edit:(path:string)=>void;save:(name:string,text:string)=>void;catalog:()=>void;
}){
  const {exercise,edition}=lesson,plan=practices[exercise],library=edition==='Arduino'?'ventil.h':'ventil.py';
  const [feedback,setFeedback]=useState('');
  const observed=project.files['pocetni-pokus.txt']||'',changed=project.files['izmijenjeni-pokus.txt']||'';
  function record(name:string){
    const lines=consoleText.trim().split('\n').filter(line=>line && !line.startsWith('ESP32-S3 funkcionalni WASM ·')).slice(-12).join('\n');
    if(!lines){setFeedback('Pokreni program i pričekaj prvi ispis.');return;}
    save(name,lines);setFeedback('Ispis je spremljen u projekt.');
  }
  return <article className="lesson-content"><div className="lesson-title"><div>
    <span className="lesson-kicker">{lesson.track==='iot'?'Internet stvari':'Ugradbeni sustavi'} · {edition} · ESP32-S3</span>
    <h2>{exercise} · {titles[exercise]}</h2></div><button onClick={catalog}>Moja zbirka</button></div>
    {plan.rig==='network'&&<p>Naredbe dolaze iz niza PORUKE u programu. Lokalni model prikazuje događaje razmjene bez prijave na Wi-Fi ili školsku uslugu.</p>}
    <section><h3>1 · Predvidi i pokreni</h3><p>{plan.task}</p>
      <div className="lesson-inline-actions"><button className="primary" onClick={run}>Pokreni simulaciju</button><button onClick={circuit}>Otvori sklop i ulaze</button></div>
      <p>U prikazu sklopa mijenjaj dostupne ulaze dok program radi. Za prespajanje zaustavi program, promijeni vodič i pokreni ponovno.</p>
      <button onClick={()=>record('pocetni-pokus.txt')}>Zabilježi početni ispis</button>
      {observed&&<pre>{observed}</pre>}
    </section>
    <section><h3>2 · Promijeni i ponovi</h3><p>{plan.change}</p>
      {edition==='Arduino'&&<p>Nakon promjene programa ili biblioteke ponovno prevedi kod za simulaciju.</p>}
      <div className="lesson-inline-actions"><button onClick={()=>edit(project.entryFile)}>Uredi {project.entryFile}</button>
        {library in project.files&&<button onClick={()=>edit(library)}>Uredi {library}</button>}
        <button onClick={()=>record('izmijenjeni-pokus.txt')}>Zabilježi ispis nakon promjene</button></div>
      {changed&&<pre>{changed}</pre>}
    </section>
    <section><h3>3 · Objasni rezultat</h3><label>{plan.question}
      <textarea maxLength={3000} value={project.files['zakljucak.txt']??''} onChange={e=>save('zakljucak.txt',e.target.value)}/></label>
      <button onClick={()=>setFeedback(!observed?'Nedostaje ispis početnog pokusa.':!changed?'Nedostaje ispis nakon promjene.':observed===changed?'Ispisi su jednaki. Provjeri je li očekivana promjena vidljiva i objasni rezultat.':!project.files['zakljucak.txt']?.trim()?'Dodaj objašnjenje na temelju svojih dvaju ispisa.':'Oba ispisa i tvoj zaključak spremljeni su u projektu. Nastavnik može pregledati objašnjenje.')}>Provjeri zapis pokusa</button>
      <p role="status">{feedback}</p>
    </section></article>;
}
