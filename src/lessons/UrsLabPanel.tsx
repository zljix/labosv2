import {labHints} from '../grading/labCriteria';
import {labSupportSnapshot} from '../grading/snapshot';
import {captureBuild,localBuildFile} from '../grading/local';
import {useState} from 'react';
import {CollectionDownload} from './CollectionDownload';
import {labAsset, labIds, labTitle, levelNames, plcFiles, stationCode, ursLabSheets as sheets, type LabId} from './ursLab';
import type {SimulationFrame} from '../circuit/compile';
import type {Project} from '../project/model';

const trial: Record<LabId,string> = {
  LV01:'Prati pokaznik D13 i poruke u konzoli. Izmjeri razmak između dvaju uključenja.',
  LV02:'U prikazu zaslona pronađi poruku i broj sekundi. Za P2 prati isti kut zaslona nekoliko sekundi.',
  LV03:'U živim ulazima zadaj dvije različite temperature za LM35 i DS18B20. Usporedi očitanja u istom ciklusu.',
  LV04:'Promijeni temperaturu i vlagu svakog senzora zasebno. Pričekaj novi ciklus i usporedi dva retka ispisa.',
  LV05:'Otvori žive ulaze svih pet senzora. U konzoli prati pet temperatura i tri vlažnosti. Pričekaj novi redak nakon svake promjene.',
  LV06:'Pomakni potenciometar na 0 %, 50 % i 100 %. Prati zadani kut, položaj serva i trajanje impulsa.',
  LV07:'Pritisni i otpusti tipkalo. Usporedi boju i tekst na TFT-u sa stanjem releja. Ponovi pokus.',
  LV08:'Mijenjaj klizač potenciometra i tlak BMP180 zasebno. Usporedi OLED i serijski ispis nakon novog mjerenja.',
  LV09:'Mijenjaj osvjetljenje u oba smjera. Zabilježi dva očitanja ADC-a pri kojima se stanje releja promijenilo.',
  LV10:'Pošalji dvije tipke s virtualnog NEC daljinskog. U konzoli očitaj adresu i naredbe koje ćeš upotrijebiti u P1.',
  LV11:'Pomakni razinu od 0 % do 100 % i natrag. Promatraj relej s obje strane praga i između pragova.',
  LV12:'Pritisni i otpusti tipku. Prati četiri znamenke i relej do kraja ciklusa. Za P3 vrati spremljeni program P1.',
  LV13:'Promijeni zadanu temperaturu potenciometrom i očitanje DS18B20 u živim ulazima. Usporedi pragove i relej.',
  LV14:'Kreni s potenciometrom na 0 %, zatim ga povisi. Prati radni omjer i aktiviraj STOP na D2. Za ponovno pokretanje otpusti STOP i prvo vrati potenciometar na nulu.',
  LV15:'Pritisni START i prati četverofaznu pobudu na pokaznicima IN1–IN4. Konzola javlja kraj pomaka. Na postaji izmjeri kut osovine 28BYJ-48 i usporedi ga s predviđanjem.',
  LV15B:'Na A4988 prati broj impulsa, smjer i modelirani kut. Za novi pomak otpusti START pa ga ponovno pritisni.',
  LV16:'U prikazu sklopa pritisni i otpusti Start pa aktiviraj STOP. Ponovi s prekidom zaštite. U konzoli usporedi ulaze s izlazom MOTOR.'
};

function Materials({id}:{id:LabId}) {
  const sheet = sheets[id];
  return <div className="lesson-inline-actions">
    <CollectionDownload href={labAsset(id + '/' + sheet.word)}>Učenički Word · {id}</CollectionDownload>
    {sheet.files.map(file => <CollectionDownload key={file} href={labAsset(id + '/' + file)}>
      {id === 'LV16' ? file.includes('deklaracije') ? 'PLC deklaracije' : 'ST program za CODESYS' : 'Početni program za Arduino IDE'}
    </CollectionDownload>)}
    {id !== 'LV16' && <CollectionDownload href={labAsset('00_Upute_za_programe.md')}>Upute za programe na postaji</CollectionDownload>}
    {id === 'LV05' && <CollectionDownload href={labAsset('AHTxx_1.2.0.zip')}>Knjižnica AHTxx za postaju</CollectionDownload>}
  </div>;
}

export function UrsLabCatalog({initial, busy, open}:{initial?:LabId; busy:boolean; open:(id:LabId)=>void}) {
  const [id, setId] = useState<LabId>(() => {
    if (initial) return initial;
    try {
      const last = localStorage.getItem('labos.urs-lv.v7');
      if (last && Object.hasOwn(sheets,last)) return last as LabId;
    } catch { /* Storage may be unavailable in a private session. */ }
    return 'LV01';
  });
  const sheet = sheets[id];
  return <section className="lesson-content urs-lab-catalog">
    <h3>{labTitle}</h3>
    <p>16 vježbi po 90 minuta i dodatna izvedba LV15B. U svakoj vježbi mijenjaš početni program kroz tri podzadatka i zapisuješ rezultat u svoj radni list.</p>
    <label>Vježba <select value={id} onChange={e => {
      const value = e.target.value as LabId;
      setId(value);
      try { localStorage.setItem('labos.urs-lv.v7', value); } catch {}
    }}>{labIds.map(key => <option value={key} key={key}>{key} · {sheets[key].title}</option>)}</select></label>
    <h4>{id} · {sheet.title}</h4>
    <p>{sheet.goals[0]}</p>
    <button className="primary" disabled={busy} onClick={() => open(id)}>Otvori vježbu i simulaciju</button>
    <p className="lesson-small">{id === 'LV16' ? 'PLC · Structured Text · simulator u Labosu ili CODESYS na postaji' : 'Arduino Nano classic · Arduino C++'}</p>
    <details><summary>Tri podzadatka</summary>
      <ol>{sheet.tasks.map((task,i) => <li key={i}><b>P{i + 1} · {levelNames[i]}.</b> {task}</li>)}</ol>
    </details>
    <Materials id={id}/>
  </section>;
}

interface PanelProps {
  coils?:NonNullable<SimulationFrame['avr']>['coils']; id: LabId; project: Project; run:()=>void; circuit:()=>void; edit:(file:string)=>void;
  catalog:()=>void; change:(label:string, files:Record<string,string>)=>void; compile:()=>void;
}
export function UrsLabPanel({id, project, run, circuit, edit, catalog, change, compile, coils}:PanelProps) {
  const [feedback, setFeedback] = useState('');
  const [confirm, setConfirm] = useState('');
  const sheet = sheets[id], plc = id === 'LV16';
  const files = plc ? plcFiles : [project.entryFile];
  const key = (level:number, i:number) => 'P' + level + '-' + (plc ? plcFiles[i] : 'program.txt');
  let currentSupport:string|undefined;
  try{currentSupport=labSupportSnapshot(project);}catch{/* The save button reports size errors. */}
  function saved(level:number) { return files.every((_,i) => !!project.files[key(level,i)]?.trim()); }
  async function capture(level:number) {
    try{
    if (files.some(f => !project.files[f]?.trim())) {setFeedback('Najprije upiši cijeli program.'); return;}
    const snapshot = Object.fromEntries(files.map((f,i) => [key(level,i), project.files[f]]));
    snapshot['P'+level+'-sklop.json']=labSupportSnapshot(project);
    const artifact=await captureBuild(project);
    if(artifact)snapshot[localBuildFile(true,level-1)]=JSON.stringify(artifact);
    change('Spremanje programa P' + level, snapshot);
    setConfirm(''); setFeedback('Spremljena je inačica programa za P' + level + '.');
    }catch(e){setFeedback((e as Error).message);}
  }
  function restore(level:number) {
    change('Povratak na program P' + level, Object.fromEntries(files.map((f,i) => [f, project.files[key(level,i)]])));
    setConfirm(''); setFeedback('U uređivaču je sada spremljeni program P' + level + '.');
  }
  function sheetCode(level:number) {
    if (plc) return files.map((_,i) => project.files[key(level,i)]).join('\n\n');
    return stationCode(project.files[key(level,0)]);
  }
  return <article className="lesson-content urs-content" aria-label={id + ' laboratorijska vježba'}>
    <div className="lesson-title"><div><span className="lesson-kicker">{labTitle} · 90 min</span><h2>{id} · {sheet.title}</h2></div><button onClick={catalog}>Sve URS vježbe</button></div>
    <p className="lesson-goal">{sheet.goals[0]}</p>
    <details><summary>Priprema i pojmovi</summary>{sheet.theory.map((p,i) => <p key={i}>{p}</p>)}</details>
    <section><h3>Početni program i pokus</h3><p>{trial[id]}</p>
      {['LV07','LV09','LV10','LV11','LV12','LV13'].includes(id) && <p>Kontakti COM, NO i NC u ovoj vježbi ostaju slobodni. U prikazu releja prati pobudu zavojnice.</p>}
      {plc ? <p>Uređuješ deklaracije i tijelo programa u jeziku ST. Labos izvodi ciklus svakih 20 ms. Podržani su BOOL, TIME, TON, logički izrazi i IF/ELSIF/ELSE. STOP i prekid zaštite dok su pritisnuti ukidaju odgovarajuće dopuštenje.</p>
        : <p>Pokreni početni program. Nakon izmjene koda odaberi Prevedi za Nano, zatim ponovno pokreni simulaciju.</p>}
      <div className="lesson-inline-actions"><button className="primary" onClick={run}>Pokreni simulaciju</button>
        <button onClick={circuit}>Otvori sklop i ulaze</button>
        {files.map((f,i) => <button key={f} onClick={() => edit(f)}>{plc ? i === 0 ? 'Uredi deklaracije' : 'Uredi ST program' : 'Uredi početni program'}</button>)}
        {!plc && <button onClick={compile}>Prevedi za Nano</button>}
      </div>
    </section>
    {id === 'LV15' && <section><h3>Pomak prema slijedu pobude</h3>
      <p>Brojilo prati četiri pokaznika pločice ULN2003. Za procjenu kuta uzima početnu fazu 0 i nazivnih 4096 polukoraka po okretaju.</p>
      {coils ? <p>Stabilne pobude: {coils.commands} · Polukoraci sa smjerom: {coils.steps} · Procijenjeni kut: {(coils.steps * 360 / 4096).toLocaleString('hr-HR',{maximumFractionDigits:2})}° · Nepravilan prijelaz: {coils.errors}</p> : <p>Pokreni program i pritisni START.</p>}
    </section>}
    <section><h3>Izmjene programa</h3><p>Nakon svakog pokusa spremi cijelu inačicu programa. U Word je zalijepi neposredno ispod pripadajućeg podzadatka pa dodaj rezultat i odgovore.</p>
      {(id==='LV02'||id==='LV07')&&<label className="lesson-answer">{id==='LV02'?'Ime prikazano na OLED-u':'Inicijali prikazani na TFT-u'}
        <input maxLength={id==='LV02'?20:3} value={project.files['oznaka-prikaza.txt']??''} onChange={e=>change('Oznaka prikaza',{'oznaka-prikaza.txt':e.target.value})}/></label>}
      {sheet.tasks.map((task,i) => {
        const n = i + 1, exists = saved(n);
        const same = exists && currentSupport!==undefined && project.files['P'+n+'-sklop.json']===currentSupport && files.every((f,j) => project.files[f] === project.files[key(n,j)]);
        const note = 'P' + n + '-opazanje.txt';
        return <section key={n} className="urs-lab-task"><h4>P{n} · {levelNames[i]} · {n===3?4:3} boda</h4><p>{task}</p><p><b>Uvjet provjere.</b> {labHints[id][i]}</p>
          <label className="lesson-answer">Opažanje za P{n}<textarea rows={2} maxLength={3000} value={project.files[note] ?? ''}
            onChange={e => change('Opažanje za P' + n, {[note]:e.target.value})}/></label>
          <div className="lesson-inline-actions"><button disabled={same} onClick={() => exists ? setConfirm('save' + n) : capture(n)}>
            {same ? 'Trenutačni program spremljen je za P' + n : 'Spremi trenutačni program za P' + n}</button>
            {exists && !same && <button onClick={() => setConfirm('restore' + n)}>Vrati P{n} u uređivač</button>}
          </div>
          {(confirm === 'save' + n || confirm === 'restore' + n) && <div><p>{confirm === 'save' + n ? 'Zamijeniti prethodno spremljeni program za ovaj podzadatak?' : 'Zamijeniti trenutačni kod u uređivaču ovom spremljenom inačicom?'}</p><button onClick={() => confirm === 'save' + n ? capture(n) : restore(n)}>Potvrdi zamjenu</button> <button onClick={() => setConfirm('')}>Odustani</button></div>}
          {exists && <details><summary>Cijeli program P{n} za Word</summary>
            <textarea aria-label={'Program P' + n + ' za Word'} rows={7} readOnly value={sheetCode(n)} onFocus={e=>e.target.select()}/>
            <button onClick={async () => {
              try { await navigator.clipboard.writeText(sheetCode(n)); setFeedback('Program P' + n + ' kopiran je za Word.'); }
              catch { setFeedback('Označi tekst programa u polju i kopiraj ga u Word.'); }
            }}>Kopiraj program P{n}</button>
          </details>}
        </section>;
      })}
      <p role="status">{feedback}</p>
    </section>
    <section><h3>Radni list za predaju</h3>
      <p>Spremljene inačice programa: {levelNames.filter((_,i) => saved(i + 1)).length} od 3. U popunjenom Wordu predaješ sva tri programa, opažanja i odgovore.</p>
      <Materials id={id}/>
      <details><summary>Pitanja iz radnog lista</summary><ol>{sheet.questions.map((q,i)=><li key={i}>{q.replace(/^\d+\.\s*/, '')}</li>)}</ol></details>
    </section>
  </article>;
}
