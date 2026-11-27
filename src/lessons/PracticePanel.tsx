import {trialFile,trialSnapshot,responseFile} from '../grading/snapshot';
import {captureBuild,localBuildFile} from '../grading/local';
import {practiceCriteria} from '../grading/practiceCriteria';
import {answerChoices} from '../grading/collections';
import type {LiveInput} from '../circuit/model';
import {useState} from 'react';
import {practices} from './collectionPlans';
import type {PracticeKey} from './collectionSimulation';
import titles from './iotUsTitles.json';
import type {Project} from '../project/model';

export function PracticePanel({lesson,project,consoleText,run,circuit,edit,save,catalog,runSource,inputs}:{
  lesson:PracticeKey;project:Project;consoleText:string;run:()=>void;circuit:()=>void;
  runSource?:Project;inputs:Record<string,LiveInput>;edit:(path:string)=>void;save:(files:Record<string,string>)=>void;catalog:()=>void;
}){
  const {exercise,edition}=lesson,plan=practices[exercise],library=edition==='Arduino'?'ventil.h':'ventil.py';
  const [feedback,setFeedback]=useState('');
  const observed=project.files['pocetni-pokus.txt']||'',changed=project.files['izmijenjeni-pokus.txt']||'';
  const criteria=practiceCriteria[exercise];
  async function record(name:string,index:number){
    try{
    if(!runSource||trialSnapshot(runSource)!==trialSnapshot(project)){setFeedback('Pokreni trenutačnu inačicu programa i sklopa prije spremanja pokusa.');return;}
    const lines=consoleText.trim().split('\n').filter(line=>line && !line.startsWith('ESP32-S3 funkcionalni WASM ·')).slice(-12).join('\n');
    if(!lines){setFeedback('Pokreni program i pričekaj prvi ispis.');return;}
    const files:Record<string,string>={[name]:lines,[trialFile(index)]:trialSnapshot(runSource,inputs)};
    const artifact=await captureBuild(runSource);
    if(artifact)files[localBuildFile(false,index)]=JSON.stringify(artifact);
    save(files);setFeedback('Spremljeni su program, sklop, ulazi i ispis toga pokusa.');
    }catch(e){setFeedback((e as Error).message);}
  }
  return <article className="lesson-content"><div className="lesson-title"><div>
    <span className="lesson-kicker">{lesson.track==='iot'?'Internet stvari':'Ugradbeni sustavi'} · {edition} · ESP32-S3</span>
    <h2>{exercise} · {titles[exercise]}</h2></div><button onClick={catalog}>Moja zbirka</button></div>
    {plan.rig==='network'&&<p>Naredbe dolaze iz niza PORUKE u programu. Lokalni model prikazuje događaje razmjene bez prijave na Wi-Fi ili školsku uslugu.</p>}
    <section><h3>1 · Predvidi i pokreni</h3><p>{plan.task}</p>
      <div className="lesson-inline-actions"><button className="primary" onClick={run}>Pokreni simulaciju</button><button onClick={circuit}>Otvori sklop i ulaze</button></div>
      <p>U prikazu sklopa mijenjaj dostupne ulaze dok program radi. Za prespajanje zaustavi program, promijeni vodič i pokreni ponovno.</p>
      <p><b>Za 3 boda.</b> {criteria.baseline}</p>
      <button onClick={()=>void record('pocetni-pokus.txt',0)}>Zabilježi početni pokus</button>
      {observed&&<pre>{observed}</pre>}
    </section>
    <section><h3>2 · Promijeni i ponovi</h3><p>{plan.change}</p>
      <p><b>Za 5 bodova.</b> {criteria.change}</p>
      {edition==='Arduino'&&<p>Nakon promjene programa ili biblioteke ponovno prevedi kod za simulaciju.</p>}
      <div className="lesson-inline-actions"><button onClick={()=>edit(project.entryFile)}>Uredi {project.entryFile}</button>
        {library in project.files&&<button onClick={()=>edit(library)}>Uredi {library}</button>}
        <button onClick={()=>void record('izmijenjeni-pokus.txt',1)}>Zabilježi izmijenjeni pokus</button></div>
      {changed&&<pre>{changed}</pre>}
    </section>
    <section><h3>3 · Objasni rezultat</h3><label>{plan.question}
      <textarea maxLength={3000} value={project.files['zakljucak.txt']??''} onChange={e=>save({'zakljucak.txt':e.target.value})}/></label>
      <label className="lesson-answer">{criteria.question} · 2 boda
        <select value={project.files[responseFile]??''} onChange={e=>save({[responseFile]:e.target.value})}>
          <option value="">Odaberi odgovor</option>{answerChoices(exercise).map(c=><option value={c.value} key={c.value}>{c.text}</option>)}
        </select></label>
      <p role="status">{feedback}</p>
    </section></article>;
}
