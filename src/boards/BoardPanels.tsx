import {appAsset} from '../platform/assets';
import {useState} from 'react';
import {BOARDS,S3,UNO,getBoard,languageName,type BoardId,type Language} from './profiles';
import {SUPPORT_CATALOG,componentSupport,statusName} from './support';
import {runtimeAvailability} from '../runtime/profiles';
import {boardChangePreview} from '../project/derive';
import type {Project} from '../project/model';
import './boards.css';
import {supportOpenTasks,exerciseCoverage,supportEvidence} from './supportReport';
import type {UrsTarget} from '../lessons/ursCatalog';

export function BoardFields({value,onChange,language:chosen,onLanguageChange}:{value:BoardId;onChange:(id:BoardId)=>void;language?:Language;onLanguageChange?:(l:Language)=>void}) {
  const profile=getBoard(value),language=chosen&&profile.languages.includes(chosen)?chosen:profile.languages[0],status=runtimeAvailability(value,language);
  return <div className="board-fields">
    <label>Pločica<select aria-label="Pločica projekta" value={value} onChange={e=>onChange(e.target.value as BoardId)}>{Object.values(BOARDS).map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
    <label>Programski jezik<select aria-label="Programski jezik projekta" value={language} onChange={e=>onLanguageChange?.(e.target.value as Language)}>{(['micropython','arduino-cpp'] as Language[]).map(l=><option key={l} value={l} disabled={!profile.languages.includes(l)}>{languageName(l)}{profile.languages.includes(l)?'':' · nije podržano'}</option>)}</select></label>
    <p className="board-spec">{profile.description}</p>
    <p className={status.available?'board-ready':'board-planned'} role="status">{status.message}</p>
  </div>;
}
export function BoardChangePanel({project,busy,create,error}:{project:Project;busy:boolean;create:(id:BoardId,l:Language)=>void;error:string}) {
  const [target,setTarget]=useState<BoardId>(project.board.id),[language,setLanguage]=useState<Language>(project.language),preview=boardChangePreview(project,target),same=target===project.board.id&&language===project.language;
  return <div className="board-change">
    <p>Odaberi pločicu za izvedenu kopiju projekta. Nova kopija dobiva vlastiti naziv, pohranu i povijest.</p>
    <BoardFields value={target} language={language} onLanguageChange={setLanguage} onChange={id=>{setTarget(id);if(!getBoard(id).languages.includes(language))setLanguage(getBoard(id).languages[0]);}}/>
    {!same&&<><table className="board-comparison"><thead><tr><th>Svojstvo</th><th>Sada</th><th>Nova kopija</th></tr></thead><tbody>
      <tr><th>Pločica</th><td>{preview.from.title}</td><td>{preview.to.title}</td></tr>
      <tr><th>Jezik</th><td>{languageName(project.language)}</td><td>{languageName(language)}</td></tr>
      <tr><th>Logika</th><td>{preview.from.logicVoltage.toLocaleString('hr-HR')} V</td><td>{preview.to.logicVoltage.toLocaleString('hr-HR')} V</td></tr>
      <tr><th>ADC</th><td>{preview.from.adc.bits} bita</td><td>{preview.to.adc.bits} bita</td></tr>
      <tr><th>Početni program</th><td>{project.entryFile}</td><td>{language==='micropython'?'main.py':'main.ino'}</td></tr>
    </tbody></table>
    {target===project.board.id?<p>Nova jezična kopija čuva isti sklop i sve vodiče. Izvori oba jezika ostaju sačuvani; program napiši zasebno u novoj početnoj datoteci.</p>:<><ul>{preview.notes.map(n=><li key={n}>{n}</li>)}</ul>
    <details><summary>Vodiči koji se odspajaju u kopiji: {preview.detachedWires.length}</summary>{preview.detachedWires.length?<ul>{preview.detachedWires.map(w=><li key={w.id}>{w.pins.join(' ↔ ')} · {w.id}</li>)}</ul>:<p>Nema vodiča priključenih na pločicu.</p>}</details></>}</>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions"><button className="primary" disabled={same||busy} onClick={()=>create(target,language)}>{busy?'Spremanje…':'Stvori izvedenu kopiju'}</button></div>
  </div>;
}
export function SupportMatrix({board,language}:{board:BoardId;language:Language}) {
  const [selected,setSelected]=useState(board),[lang,setLang]=useState(language),[query,setQuery]=useState('');
  const target:UrsTarget=selected===S3?(lang==='micropython'?'micropython':'s3-cpp'):selected===UNO?'uno':'nano';
  return <div className="support-matrix"><p>Status vrijedi za odabranu pločicu, jezik i navedeni upravljački program. Provjereno označava razvojne provjere funkcionalnog modela u objavljenom opsegu.</p>
    <div className="matrix-filters"><label>Pločica<select value={selected} onChange={e=>setSelected(e.target.value as BoardId)}>{Object.values(BOARDS).map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label><label>Jezik<select value={lang} onChange={e=>setLang(e.target.value as Language)}><option value="micropython">MicroPython</option><option value="arduino-cpp">Arduino C/C++</option></select></label><label>Pronađi komponentu<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="npr. BMP280, motor, TFT…"/></label></div>
    <p><a href={appAsset('urs-podrska.csv')} download>Preuzmi cijelu matricu · četiri izvršna cilja · CSV</a></p>
    <div className="matrix-scroll"><table><thead><tr><th>Komponenta</th><th>Status</th><th>Upravljački program, opseg i vježbe</th></tr></thead><tbody>{SUPPORT_CATALOG.filter(i=>(i.title+' '+i.group).toLocaleLowerCase('hr').includes(query.toLocaleLowerCase('hr'))).map(item=>{const support=componentSupport(item,selected,lang),valid=!(selected!==S3&&lang==='micropython');return <tr key={item.id}><td><b>{item.title}</b><small>{item.group}</small></td><td><span className={`support-status ${support.status}`}>{statusName[support.status]}</span></td><td>{item.driver}<small>{support.detail}</small>{valid&&<small>Vježbe: {exerciseCoverage(item,target).join(', ')||'Otvorena stavka'}. Podloga: {supportEvidence(item,target)}</small>}</td></tr>;})}</tbody></table></div>
    <details><summary>Otvorene stavke i uvjeti stabilne inačice</summary><ul>{supportOpenTasks.map(t=><li key={t}>{t}</li>)}</ul></details>
    <p>Status vrijedi samo za navedeni profil, driver i način rada. Moduli na 5 V koriste izričito označene carrier izvedbe; provjeri stvarni adapter. Matrica i razvojne provjere ne zamjenjuju učenički pilot.</p>
  </div>;
}
