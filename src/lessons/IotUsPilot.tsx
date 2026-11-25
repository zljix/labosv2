import {CollectionDownload} from './CollectionDownload';
import {useState} from 'react';
import {appAsset} from '../platform/assets';
import {download} from '../project/archive';
import type {Project} from '../project/model';
import titles from './iotUsTitles.json';

export type PilotId = 'P0' | 'V1.4' | 'V2.1' | 'V3.1';
export type RunnableId = 'P0' | 'V1.4' | import('./CollectionProgram').ExtraProject;
export type Edition = 'MicroPython' | 'Arduino';
const programs = {'P0':'01_Poruka', 'V1.4':'01_Senzor', 'V2.1':'01_HTTP', 'V3.1':'01_Pinovi'};
export function pilotAsset(id: PilotId, name: string) {
  return appAsset('zbirke/' + id.replace('.', '_') + '/' + name);
}
export function programUrl(id: PilotId, edition: Edition) {
  return pilotAsset(id, programs[id] + (edition === 'Arduino' ? '.ino' : '.py'));
}
const wordUrl = (id: PilotId, edition: Edition) => pilotAsset(id, 'LV_' + id.replace('.', '_') + '_' + edition + '_v14.docx');

function Materials({id, edition}: {id: PilotId; edition: Edition}) {
  return <p className="lesson-inline-actions">
    <CollectionDownload href={programUrl(id,edition)}>{programs[id]}{edition === 'Arduino' ? '.ino' : '.py'}</CollectionDownload>
    <CollectionDownload href={wordUrl(id,edition)}>Učenički Word · {edition}</CollectionDownload>
    {edition==='Arduino' && id!=='V3.1' && <CollectionDownload href={appAsset('zbirke/Arduino_biblioteke_pilot.zip')}>Biblioteke za pripremu postaje (ZIP)</CollectionDownload>}
  </p>;
}

function Wiring({id}: {id: 'V1.4' | 'V2.1'}) {
  return <details><summary>{id === 'V1.4' ? 'Shema spajanja DS18B20' : 'Shema pripremljenog modela'}</summary>
    <img style={{maxWidth:'100%',height:'auto'}} src={pilotAsset(id,'Shema.png')} alt={id === 'V1.4'
      ? 'VDD na 3V3, GND na GND, DQ na GPIO4. Otpornik 4,7 kΩ između DQ i 3V3.'
      : 'Električne veze modela sa senzorom temperature, LED-om i servom, prema učeničkom Wordu.'}/>
  </details>;
}

function HttpExercise({edition}: {edition: Edition}) {
  const [choice, setChoice] = useState('');
  const mp = edition === 'MicroPython';
  const boot = mp ? 'boot' : 'boot_id', temp = mp ? 'temp_c' : 'temperature_c';
  const records = [
    {device:'u07',boot:'000000000000001b',seq:12,temp:24.5},
    {device:'u07',boot:'000000000000001a',seq:12,temp:24.5},
    {device:'u08',boot:'000000000000001a',seq:12,temp:24.5},
  ];
  return <>
    <p>3 sata UTR-a. Prije rada pripremi provjereni model iz C1. Uređaj šalje mjerenje HTTP zahtjevom, a usluga ga prikazuje u aplikaciji.</p>
    <h4>Priprema bez mreže · ogledni zapisi</h4>
    <p>U lokalnom ispisu čitaš tri oznake. <code>device</code> označuje uređaj, <code>{boot}</code> jedno pokretanje, a <code>seq</code> uzorak unutar tog pokretanja.</p>
    <p><b>Lokalni zapis</b><br/><code>device=u07 · {boot}=000000000000001a · seq=12 · {temp}=24.5</code></p>
    <table><thead><tr><th>Mrežni zapis</th><th>device</th><th>{boot}</th><th>seq</th><th>°C</th></tr></thead>
      <tbody>{records.map((r,i)=><tr key={i}><th>{i+1}</th><td>{r.device}</td><td>{r.boot}</td><td>{r.seq}</td><td>{r.temp.toLocaleString('hr-HR')}</td></tr>)}</tbody></table>
    <label>Koji mrežni zapis pripada lokalnom uzorku? <select value={choice} onChange={e=>setChoice(e.target.value)}>
      <option value="">Odaberi zapis</option>{records.map((_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
    {choice && <p role="status">{choice==='2' ? 'Točno. Podudaraju se uređaj, pokretanje i redni broj uzorka.' : choice==='1' ? 'Usporedi zadnju znamenku oznake pokretanja. Broj uzorka može se ponoviti nakon RESET-a.' : 'Provjeri oznaku uređaja. Dvije pločice mogu prikazati istu temperaturu.'}</p>}
    <p>Za drugi ogledni primjer usluga je zaprimila naredbu OPEN s brojem 7. Potvrda (ACK) je odgovor uređaja na tu naredbu.</p>
    <p><code>{mp ? 'queued=7 → ack_id=7, ack_command=OPEN, ack_result=PRIHVACENO' : 'command.cmd_id=7, command.command=OPEN → ack.cmd_id=7, ack.accepted=true, ack.reason=OK'}</code></p>
    <p>Iz potvrde možeš zaključiti da je uređaj prihvatio naredbu. Fizički položaj na školskoj postaji opažaš zasebno.</p>
    <h4>Pokus na školskoj mreži</h4>
    <ol><li>Na računalu pokrenite HTTP uslugu za {edition}. U postavke programa pločice upiši dodijeljeni ID, mrežne podatke i {mp ? 'LAN adresu računala u HTTP_POSLUZITELJ te 8080 u HTTP_PORT' : 'punu adresu http://IP_RACUNALA:8080 u HTTP_POSLUZITELJ'}. Prati korak 1 iz Worda.</li>
      <li>U aplikaciji odaberi svoj uređaj. Usporedi tri nova valjana uzorka i u Word nacrtaj put mjerenja od uređaja do korisnika.</li>
      <li>Predvidi cilj, zatim redom pošalji OPEN, CLOSE i AUTO. Za svaku naredbu zabilježi njezin broj, potvrdu i opažanje. Prije predaje ukloni zaporke i ključeve iz ispisa.</li></ol>
    <Wiring id="V2.1"/><Materials id="V2.1" edition={edition}/>
    <details><summary>Priprema nastavničkog računala</summary>
      <p>Raspakiraj paket u jednu mapu. Na odobrenoj školskoj mreži pokreni sljedeću naredbu u toj mapi uz Python 3.10 ili noviji. U Windowsima možeš upotrijebiti <code>py -3</code> umjesto <code>python3</code>.</p>
      <p><code>{mp ? 'python3 http_server.py --host 0.0.0.0 --port 8080' : 'python3 http_posluzitelj.py --port 8080'}</code></p>
      <p>Na tom računalu otvori <code>http://127.0.0.1:8080/</code>. Pločica se povezuje na LAN adresu računala. Odaberi jednu izvedbu za port 8080.{!mp && ' Upravljački ključ iz konzole unosi se u nadzornu ploču. HTML i Python datoteka moraju ostati zajedno.'}</p>
      {!mp && <p>U Arduino IDE-u koristi jezgru ESP32 3.3.12 i biblioteke OneWire 2.3.8, DallasTemperature 4.0.5 i ArduinoJson 7.4.3. Raspakiraj paket biblioteka i u IDE redom uvezi tri pojedinačna ZIP-a.</p>}
      <CollectionDownload href={pilotAsset('V2.1','HTTP_'+edition+'.zip')}>HTTP poslužitelj za {edition} (ZIP)</CollectionDownload>
    </details>
  </>;
}

function Documentation({edition}: {edition: Edition}) {
  const mp = edition === 'MicroPython';
  return <>
    <p>2 sata UTR-a. Pripremi nenapajanu pločicu, DS18B20 i dodijeljeni servo. Otvori izvorni program radi čitanja oznaka. Tijekom vježbe oprema ostaje bez napajanja.</p>
    <p><b>{mp ? 'ESP32-S3 DevKitC-1 N16R8 · 44 priključka' : 'ESP32-S3-CAM N16R8 · 40 priključaka'}</b></p>
    <p>GPIO je oznaka signala. Položaj kontakta pronađi na crtežu za točnu reviziju pločice, a zatim ga označi na vlastitoj fotografiji.</p>
    <table><thead><tr><th>Veza u modelu</th><th>Oznaka</th>{mp && <th>DevKitC-1 v1.1</th>}</tr></thead><tbody>
      {([['Podatkovni vod DS18B20','GPIO4','J1/4'],['Signal serva','GPIO14','J1/20'],['Upravljanje LED-om','GPIO21','J3/18'],['Napajanje senzora','3V3','J1/1 ili J1/2'],['Zajednička masa','GND','npr. J1/22']]).map(([role,pin,header])=><tr key={pin}><td>{role}</td><td>{pin}</td>{mp && <td>{header}</td>}</tr>)}</tbody></table>
    {!mp && <p>Za fizičke položaje koristi karticu svojeg CAM modula i oznake njegove revizije. Ako ih ne možeš povezati, zabilježi koji podatak nastavnik treba potvrditi.</p>}
    <p>U prvi obrazac u Wordu upiši oznake pločice, kućište senzora, radni raspon i vrijeme pretvorbe. Uz svaki podatak navedi dokument, reviziju i stranicu. Apsolutna granica označuje krajnje dopušteno opterećenje komponente. Za projekt odaberi vrijednost iz radnog raspona.</p>
    <p>U drugi obrazac upiši podatke za stvarni model serva i odobrene impulse s kartice postaje. Nacrtaj tok signala od senzora prema izlazima, zatim dodaj izvore napajanja i zajedničku masu.</p>
    <Materials id="V3.1" edition={edition}/>
    <details><summary>Dokumentacija komponenti</summary><ul>
      {mp && <li><a target="_blank" rel="noreferrer" href="https://docs.espressif.com/projects/esp-idf/en/v5.2/esp32s3/hw-reference/esp32s3/user-guide-devkitc-1.html">Espressif · DevKitC-1 v1.1, tablice J1 i J3</a></li>}
      <li><a target="_blank" rel="noreferrer" href="https://www.analog.com/media/en/technical-documentation/data-sheets/DS18B20.pdf">Analog Devices · DS18B20, kućišta i električne karakteristike (PDF)</a></li>
      <li><a target="_blank" rel="noreferrer" href="https://www.pololu.com/product/2818">FEETECH FS90 · specifikacija za postaje s tim modelom</a></li>
    </ul><p>Za drugi model serva ili pločice koristi dokumentaciju s pripadajuće školske postaje.</p></details>
  </>;
}

export function PilotCard({id,edition,busy,open}: {id: Exclude<PilotId,'P0'>;edition: Edition;busy:boolean;open:()=>void}) {
  if (id==='V2.1') return <HttpExercise key={edition} edition={edition}/>;
  if (id==='V3.1') return <Documentation edition={edition}/>;
  return <>
    <p>1 sat UTR-a. Nakon uvoda u priključke i mjerenje prikupi pet novih očitanja, odredi raspon temperatura i ispitaj kako REQUEST_MS utječe na razmak uzoraka.</p>
    <p>Pripremi DS18B20, otpornik 4,7 kΩ i vodiče. VDD spoji na 3V3, GND na GND, DQ na GPIO4, a otpornik između DQ i 3V3. Prije spajanja provjeri raspored izvoda svojeg kućišta prema kartici postaje.</p>
    <Wiring id="V1.4"/>
    {edition==='MicroPython' ? <button className="primary" disabled={busy} onClick={open}>Otvori ili nastavi V1.4 · MicroPython</button>
      : <p>Na školskoj ESP32-S3-CAM koristi označeni GPIO4, uz odspojenu kameru. Izvor za ovu vježbu predviđa izravan spoj. Za postaju s adapterom najprije potvrdi odgovarajući kontakt. U Arduino IDE-u koristi OneWire 2.3.8 i DallasTemperature 4.0.5. Otvori Serial Monitor na 115200.</p>}
    <Materials id="V1.4" edition={edition}/>
  </>;
}

function sampleWindow(output:string) {
  const samples = new Map<number,{seq:number;time:number;temp:number}>();
  for(const line of output.split('\n')) {
    const match=/^seq:\s*(\d+)\s+t_ms:\s*(\d+)\s+.*?KORIGIRANO_C:\s*(-?[\d.]+)\s+STATUS:\s*VALJANO\b/.exec(line);
    if(!match) continue;
    const seq=Number(match[1]), time=Number(match[2]), temp=Number(match[3]);
    if(Number.isFinite(temp)) samples.set(seq,{seq,time,temp});
  }
  return [...samples.values()].slice(-5);
}

export function TemperatureWork({project,output,saveNotes,run,edit,catalog}: {project:Project;output:string;saveNotes:(notes:string)=>void;run:()=>void;edit:()=>void;catalog:()=>void}) {
  const samples=sampleWindow(output);
  return <article className="lesson-content"><div className="lesson-title"><h2>V1.4 · {titles['V1.4']}</h2><button onClick={catalog}>Moja zbirka</button></div>
    <h3>1 · Predvidi i pokreni</h3><p>Koliko sekundi odgovara intervalu REQUEST_MS = 2000? Pokreni spojeni model. Tijekom pokusa u sklopu možeš promijeniti temperaturu virtualnog senzora.</p>
    <div className="lesson-inline-actions"><button onClick={run}>Pokreni V1.4</button><button onClick={edit}>Otvori main.py</button></div>
    <h3>2 · Prepoznaj pet novih očitanja</h3><p>Tablica prikazuje posljednjih pet različitih valjanih uzoraka iz konzole. Isti seq i t_ms pripadaju istom mjerenju čak i kada se redak ponovno ispiše.</p>
    <table><caption>Simulacija · novi valjani uzorci</caption><thead><tr><th>seq</th><th>t_ms (ms)</th><th>Temperatura (°C)</th></tr></thead>
      <tbody>{samples.map(s=><tr key={s.seq}><td>{s.seq}</td><td>{s.time}</td><td>{s.temp.toLocaleString('hr-HR',{maximumFractionDigits:4})}</td></tr>)}</tbody></table>
    {!samples.length && <p>Pričekaj prvi valjani uzorak nakon pokretanja.</p>}
    <p>Zaustavi pokus kad prikupiš pet uzoraka. Pronađi najmanju i najveću temperaturu pa od najveće oduzmi najmanju.</p>
    <h3>3 · Promijeni interval</h3><p>Postavi REQUEST_MS na 3000, ponovno pokreni program i pričekaj tri nova uzorka. Oduzmi vremena susjednih uzoraka. Usporedi dobivena dva razmaka s očekivanjem.</p>
    <label className="lesson-answer">Bilješke iz simulacije · pet temperatura, raspon i dva nova razmaka
      <textarea rows={3} maxLength={2000} value={project.files['mjerenje.txt'] ?? ''} onChange={e=>saveNotes(e.target.value)}/>
    </label><p className="lesson-small">Bilješke se spremaju uz projekt i ulaze u izvoz njegova ZIP-a.</p>
    <h3>4 · Dovrši na školskoj postaji</h3><p>Slijedi korake u Wordu i priloži fotografiju stvarnog spoja, pet stvarnih očitanja te opažanja prije i nakon promjene uvjeta. U Thonnyju na uređaj prenesi samo glavni program kao main.py.</p>
    <Wiring id="V1.4"/><Materials id="V1.4" edition="MicroPython"/>
    <button onClick={()=>download('main.py',project.files[project.entryFile],'text/plain')}>Preuzmi moj main.py</button>
  </article>;
}
