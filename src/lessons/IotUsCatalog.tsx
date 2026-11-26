import {CollectionDownload} from './CollectionDownload';
import {CollectionMaterials, type ExerciseId} from './CollectionMaterials';
import {practices} from './collectionPlans';
import type {PracticeKey} from './collectionSimulation';
import {extraProjects} from './CollectionProgram';
import {useState} from 'react';
import {appAsset} from '../platform/assets';
import {download} from '../project/archive';
import type {Project} from '../project/model';
import titles from './iotUsTitles.json';
import {PilotCard, programUrl, type RunnableId, type Edition} from './IotUsPilot';

export const tracks = {iot: 'Internet stvari', us: 'Ugradbeni sustavi'} as const;
export type Track = keyof typeof tracks;
export type Collection = Track | 'urs' | 'urs-lv' | 'intro';
const asset = (name: string) => appAsset('zbirke/P0/' + name);
const word = (edition: 'Arduino' | 'MicroPython') => asset('LV_P0_' + edition + '_v14.docx');
export const workFile = 'zbirka.json';
export function collectionWork(project: Project): {track:Track; exercise:RunnableId} | undefined {
  if (!project.files[workFile] || project.language !== 'micropython') return;
  try {
    const data = JSON.parse(project.files[workFile]);
    if ((data?.exercise === 'P0' || data?.exercise === 'V1.4' || extraProjects.includes(data?.exercise)) && data.edition === 'MicroPython' &&
      data.instructions === 'v14' && (data.track === 'iot' || data.track === 'us')) {
      return {track:data.track, exercise:data.exercise};
    }
  } catch { return; }
}

export function sequence(track: Track) {
  const ids = Object.keys(titles) as (keyof typeof titles)[];
  const chapter = (n: number) => ids.filter(id => id.startsWith('V' + n + '.'));
  return [...chapter(1), ...(track === 'iot' ? chapter(2) : [...chapter(3), 'V2.S' as const]), ...chapter(4)];
}

export function IotUsCatalog({track, busy, open, simulate, initialEdition, initialExercise}: {simulate:(key:PracticeKey)=>void;initialEdition?:Edition;track: Track; busy: boolean; initialExercise?:ExerciseId; open: (track: Track, exercise:RunnableId) => void}) {
  const order = sequence(track);
  const available: ExerciseId[] = ['P0',...order];
  const key = 'labos.zbirka.v14.' + track;
  function prior(field:string) { try{return localStorage.getItem(key+'.'+field)}catch{return null} }
  function remember(field:string,value:string) { try{localStorage.setItem(key+'.'+field,value)}catch{} }
  const [edition, setEdition] = useState<Edition>(initialEdition ?? (prior('edition')==='Arduino'?'Arduino':'MicroPython'));
  const [id,setId] = useState<ExerciseId>(() => {
    const saved=prior('exercise') as ExerciseId;
    return initialExercise ?? (available.includes(saved)?saved:'P0');
  });
  const pilot=id==='P0'||id==='V1.4'||id==='V2.1'||id==='V3.1';
  return <section className="urs-catalog" aria-label={tracks[track]}>
    <h3>{tracks[track]} · 3. razred</h3>
    <div className="urs-filters"><label>Programska izvedba <select value={edition} onChange={event => {setEdition(event.target.value as Edition);remember('edition',event.target.value)}}>
      <option>MicroPython</option><option value="Arduino">Arduino/C++</option>
    </select></label>
    <label>Vježba <select value={id} onChange={e=>{setId(e.target.value as ExerciseId);remember('exercise',e.target.value)}}>{available.map(code=><option key={code} value={code}>{code} · {titles[code]}</option>)}</select></label></div>
    <h4>{id} · {titles[id]}</h4>
    <p>{practices[id].task}</p>
    <button className="primary" disabled={busy} onClick={()=>simulate({track,exercise:id,edition})}>Otvori vježbu i simulaciju</button>
    <details><summary>Radni list, programi za školsku postaju i dodatne upute</summary>
    {id==='P0' ? <>
    <p>Učitaj program, promijeni poruku i nakon ponovnog pokretanja prepoznaj vlastiti ispis. Za uvod je predviđen jedan sat VPUP-a u temi 1.1.</p>
    {edition === 'MicroPython' ? <>
      <p>ESP32-S3 DevKitC-1 N16R8 · 44 priključka. Ispis možeš uvježbati u pregledniku. Za praktični dokaz trebaju ti pločica i podatkovni USB kabel.</p>
      <button className="primary" disabled={busy} onClick={() => open(track,'P0')}>Otvori ili nastavi P0 · MicroPython</button>
      <p><CollectionDownload href={word('MicroPython')}>Učenički Word · MicroPython</CollectionDownload></p>
    </> : <>
      <p>ESP32-S3-CAM N16R8 · 40 priključaka. Na školskoj postaji koristi proširni adapter i pločicu s odspojenom kamerom.</p>
      <ol><li>Preuzmi program i učenički Word. Otvori program u Arduino IDE-u i prihvati stvaranje mape istog naziva ako je IDE ponudi.</li>
        <li>U Wordu prati korak 1 za odabir profila i porta. Pokreni Verify i Upload. Otvori Serial Monitor na 115200 i pritisni RESET.</li>
        <li>Pričekaj dva retka, promijeni MESSAGE, spremi program pa ponovi prijenos i RESET. U isti Word unesi dokaze 1–3. Za nastavak otvori svoju spremljenu datoteku .ino u IDE-u.</li></ol>
      <div className="lesson-inline-actions"><CollectionDownload href={asset('01_Poruka.ino')}>Početni program za Arduino IDE</CollectionDownload>
        <CollectionDownload href={word('Arduino')}>Učenički Word · Arduino</CollectionDownload></div>
    </>}
    </> : (id==='V1.4'||id==='V2.1'||id==='V3.1') && <PilotCard key={id} id={id} edition={edition} busy={busy} open={()=>open(track,'V1.4')}/>}
    {edition==='MicroPython' && (id==='V1.2'||id==='V1.3'||id==='V4.2'||id==='V4.3') &&
      <button className="primary" disabled={busy} onClick={()=>open(track,id==='V4.2'?'V4.3':id)}>{id.startsWith('V4')?'Otvori zajednički projekt V4.2 i V4.3':'Otvori ili nastavi '+id+' · MicroPython'}</button>}
    </details>
    <CollectionMaterials key={id+edition} id={id} edition={edition} pilot={pilot} usPreparation={track==='us'&&id==='V3.7'}/>
    <details className="catalog-technical"><summary>Redoslijed zbirke · {order.length + 1} vježbi</summary>
      <p>P0 je uključen u temu 1.1. Putanja ima 65 sati VPUP-a i 75 sati UTR-a, uz 60 sati samostalnih aktivnosti učenika.</p>
      <ol>{order.map(id => <li key={id}><b>{id}</b> · {titles[id]}
        {track === 'us' && id === 'V3.7' && <p>U temi 3.7 slijede dva sata vođene pripreme iz V2.1 i dijela V2.3, zatim dva sata V2.S i tri sata individualne provjere.</p>}
      </li>)}</ol>
      <CollectionDownload href={appAsset('zbirke/Popis_vjezbi_IoT_US.csv')}>Preuzmi nastavnički popis za obje zbirke (CSV)</CollectionDownload>
    </details>
  </section>;
}

export function P0Instructions({track, project, run, edit, catalog}: {
  track: Track; project: Project; run: () => void; edit: () => void; catalog: () => void;
}) {
  return <article className="lesson-content"><div className="lesson-title"><div>
    <span className="lesson-kicker">{tracks[track]} · MicroPython · 1 sat VPUP-a</span>
    <h2>P0 · {titles.P0}</h2></div><button onClick={catalog}>Moja zbirka</button></div>
    <section><h3>1 · Predvidi ispis</h3><p>Program šalje tekst u konzolu. MESSAGE određuje poruku, a REPORT_MS razmak između dviju poruka u milisekundama. Koliko ćeš sekundi čekati kad je REPORT_MS jednak 2000?</p></section>
    <section><h3>2 · Isprobaj u pregledniku</h3><p>Pokreni program i pričekaj dva retka s istom porukom. Zaustavi ga, otvori main.py i u navodnicima uz MESSAGE upiši vlastitu oznaku. Ostavi REPORT_MS na 2000 i ponovno pokreni program.</p>
      <div className="lesson-inline-actions"><button onClick={run}>Pokreni P0</button><button onClick={edit}>Otvori main.py</button></div></section>
    <section><h3>3 · Prenesi program na pločicu</h3><p>Preuzmi Word i svoj trenutačni program. Na školskoj postaji slijedi korake 1–3 iz Worda. Najprije na pločici pokreni izvorni program, a zatim svoju izmjenu. U Thonnyju spremi program na uređaj kao main.py i pritisni RESET.</p>
      <div className="lesson-inline-actions"><CollectionDownload href={word('MicroPython')}>Učenički Word v14</CollectionDownload>
        <CollectionDownload href={programUrl('P0','MicroPython')}>Početni program</CollectionDownload>
        <button onClick={() => download('main.py', project.files[project.entryFile], 'text/plain')}>Preuzmi moj main.py</button></div>
      <p>U Word priloži fotografiju i odabrani port, dva retka izvornog programa s pločice te izmijenjene postavke i dva vlastita retka nakon RESET-a.</p>
    </section></article>;
}
