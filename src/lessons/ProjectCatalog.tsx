import {useState} from 'react';
import type {PracticeKey} from './collectionSimulation';
import {findProjects, groupLabels, projects, targetLabels, type CatalogTarget, type ProjectGroup, type StandaloneKind} from './catalogProjects';
import {UrsCatalog} from './UrsPanel';
import {ursTargets, type UrsTarget} from './ursCatalog';
import type {LabId} from './ursLab';

export interface ProjectActions {
  open:(id:string, solution?:boolean)=>void;
  openUrs:(lesson:string, variant:string, target:UrsTarget, peer:UrsTarget)=>void;
  openLab:(id:LabId)=>void;
  simulate:(practice:PracticeKey)=>void;
  openStandalone:(kind:StandaloneKind, id:string, target:UrsTarget, peer:UrsTarget)=>void;
}
interface Props extends ProjectActions {
  busy:boolean;
  initialTarget:UrsTarget;
  courseMaterials:(practice:PracticeKey)=>void;
}

export function ProjectCatalog({busy, initialTarget, open, openUrs, openLab, simulate, openStandalone, courseMaterials}:Props) {
  const [query,setQuery] = useState('');
  const [group,setGroup] = useState<ProjectGroup|'all'>('all');
  const [board,setBoard] = useState<CatalogTarget|'all'>('all');
  const [selection,setSelection] = useState('');
  const [preferred,setPreferred] = useState<CatalogTarget>(initialTarget);
  const [peer,setPeer] = useState<UrsTarget>('uno');
  const [thematic,setThematic] = useState(false);
  const matches = findProjects(query,group,board);
  const item = matches.find(p => p.key===selection) ?? matches[0];
  const target = board!=='all' ? board : item?.targets.includes(preferred) ? preferred : item?.targets[0];
  const route = item?.route;
  const radio = route?.kind==='radio' || (route?.kind==='guided' && route.variant==='radio');
  const edition = target==='micropython' ? 'MicroPython' : 'Arduino';
  const info = target && target!=='plc' ? item?.editions?.[target] : undefined;

  function launch() {
    if (!route || !target) return;
    if (route.kind==='lab') return openLab(route.id);
    if (target==='plc') return;
    switch (route.kind) {
      case 'intro': return open(route.id);
      case 'guided': return openUrs(route.lesson,route.variant,target,peer);
      case 'practice': return simulate({track:route.track,exercise:route.id,edition});
      default: return openStandalone(route.kind,route.id,target,peer);
    }
  }
  function clearFilters() {
    setQuery(''); setGroup('all'); setBoard('all');
  }
  return <section className="urs-catalog project-catalog" aria-label="Zbirka">
    <h3>Zbirka</h3>
    <label>Pretraži projekte<input type="search" value={query} onChange={e=>setQuery(e.target.value)}
      placeholder="Naziv, oznaka ili komponenta, npr. LV05, OLED ili tipkalo"/></label>
    <div className="urs-filters">
      <label>Skupina<select value={group} onChange={e=>setGroup(e.target.value as typeof group)}>
        <option value="all">Sve skupine</option>
        {Object.entries(groupLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></label>
      <label>Pločica i jezik<select value={board} onChange={e=>setBoard(e.target.value as typeof board)}>
        <option value="all">Sve pločice i jezici</option>
        {Object.entries(targetLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></label>
    </div>
    <p className="lesson-small" role="status">Prikazano projekata: {matches.length} od {projects.length}.</p>
    {item && target && route ? <>
      <label>Projekt<select value={item.key} onChange={e=>setSelection(e.target.value)}>
        {Object.entries(groupLabels).map(([id,label])=>{
          const entries = matches.filter(p=>p.group===id);
          return entries.length>0 && <optgroup key={id} label={label}>{entries.map(p=>
            <option key={p.key} value={p.key}>{p.title}</option>)}</optgroup>;
        })}
      </select></label>
      <div className="variant-preview">
        <span className="lesson-kicker">{groupLabels[item.group]}</span>
        <h4>{info?.title ?? item.title}</h4>
        <p>{info?.hint ?? item.description}</p>
        {route.kind==='lab' && <p>Tri podzadatka izmjene koda · P1, P2 i P3.</p>}
        <div className="project-targets">
          {board==='all' && item.targets.length>1 ?
            <label>{radio?'Pločica čvora A':'Izvedba projekta'}<select value={target} onChange={e=>setPreferred(e.target.value as CatalogTarget)}>
              {item.targets.map(id=><option key={id} value={id}>{targetLabels[id]}</option>)}</select></label> :
            <p>{radio?'Čvor A · ':''}{targetLabels[target]}</p>}
          {radio && <label>Pločica čvora B<select value={peer} onChange={e=>setPeer(e.target.value as UrsTarget)}>
            {Object.keys(ursTargets).map(id=><option key={id} value={id}>{targetLabels[id as UrsTarget]}</option>)}
          </select></label>}
        </div>
        <div className="lesson-inline-actions">
          <button className="primary" disabled={busy} onClick={launch}>Otvori projekt</button>
          {route.kind==='intro' && <button disabled={busy} onClick={()=>open(route.id,true)}>Otvori nastavnički uzorak</button>}
          {route.kind==='practice' && <button onClick={()=>courseMaterials({track:route.track,exercise:route.id,edition})}>Radni list i programi za postaju</button>}
        </div>
      </div>
    </> : <div><p>Nema projekata za taj odabir.</p><button onClick={clearFilters}>Ukloni filtre</button></div>}
    <details className="catalog-technical" onToggle={e=>setThematic(e.currentTarget.open)}>
      <summary>Pregled vođenih pokusa po temama</summary>
      {thematic && <UrsCatalog busy={busy} initialTarget={initialTarget} open={openUrs}/>}
    </details>
  </section>;
}
