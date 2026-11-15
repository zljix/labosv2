import {useState} from 'react';
import type {Project} from '../project/model';
import {readUrsWork} from '../lessons/ursWork';

export default function SchoolSnapshot({project,label}:{project:Project;label:string}){
  const nodes=[['Čvor A',project],...(project.radio?[['Čvor B',project.radio.peer]]:[])] as [string,Project][];
  const files=nodes.flatMap(([name,p])=>Object.entries(p.files).filter(([path])=>path!=='school-attempt.json').map(([path,text])=>({key:name+'/'+path,name:name+' · '+path,text})));
  const [chosen,setChosen]=useState('');const file=files.find(f=>f.key===chosen)??files.find(f=>f.key.endsWith('/'+project.entryFile))??files[0];
  const work=readUrsWork(project);
  return <section className="school-snapshot" aria-label={label}><h4>{label}</h4><p>{project.title} · {project.board.id}</p>
    {work&&<details><summary>Odgovori i opažanja</summary><dl><dt>Početni pokus</dt><dd>{work.observations.baseline||'Nije upisano'}</dd><dt>Promjena</dt><dd>{work.observations.change||'Nije upisano'}</dd><dt>Kvar i oporavak</dt><dd>{work.observations.fault||'Nije upisano'}</dd>{work.answers.map((a,i)=><div key={i}><dt>Odgovor {i+1}</dt><dd>{a||'Nije upisano'}</dd></div>)}</dl></details>}
    <label>Izvorne datoteke<select value={file?.key??''} onChange={e=>setChosen(e.target.value)}>{files.map(f=><option key={f.key} value={f.key}>{f.name}</option>)}</select></label>
    <pre tabIndex={0} aria-label={'Sadržaj datoteke · '+label}>{file?.text}</pre>
    {nodes.map(([name,p])=><details key={name}><summary>{name} · sklop: {p.circuit.components.length} komponenti i {p.circuit.wires.length} vodiča</summary>
      <ul>{p.circuit.components.map(c=><li key={c.id}>{c.id} · {c.label} · {c.kind}</li>)}</ul>
      <ul>{p.circuit.wires.map(w=><li key={w.id}>{w.from.component}.{w.from.pin} → {w.to.component}.{w.to.pin}</li>)}</ul>
      <details><summary>Položaji, svojstva i putanje vodiča</summary><pre tabIndex={0}>{JSON.stringify(p.circuit,null,2)}</pre></details>
    </details>)}
  </section>;
}
