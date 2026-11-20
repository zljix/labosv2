import type {CompileContext} from '../platform/schoolCompiler';
import {readSchoolBinding} from '../platform/schoolSync';
import IdentityInput from '../platform/IdentityInput';
import {STUDENT_NAME_LIMIT,CLASS_NAME_LIMIT} from '../project/identity';
import {appAsset} from '../platform/assets';
import {useEffect,useRef,useState} from 'react';
import type {Project} from '../project/model';
import {AVR_LIBRARIES,libraryManifest} from '../../public/avr-contract.mjs';
import {buildFile,buildInput,validateArtifact,selectedLibraries,memoryDescription} from '../../public/arduino-contract.mjs';
import {S3_LIBRARY_NAMES} from '../../public/s3-contract.mjs';
import {download,safeFilename,exportZip} from '../project/archive';
import {arduinoSubmission,cachedBuild,rememberBuild,clearBuildCache,readArduinoWork,projectWithBuild,type BuildDiagnostic} from './arduinoBuild';
import type {ArduinoCompiler} from './useArduinoCompiler';
import './arduino.css';

export function ArduinoBuildPanel({project,importBuild,compiler,setLibraries,goTo,consoleText,compileContext,offline=false}:{project:Project;importBuild:(text:string,input:string)=>void;compiler:ArduinoCompiler;setLibraries:(text:string)=>void;goTo:(d:BuildDiagnostic)=>void;consoleText:string;compileContext?:CompileContext;offline?:boolean}){
  const file=useRef<HTMLInputElement>(null),current=useRef(project),mounted=useRef(true);current.current=project;
  const [status,setStatus]=useState('Provjera programa…'),[valid,setValid]=useState(false),[busy,setBusy]=useState(false),[link,setLink]=useState(''),[messages,setMessages]=useState<BuildDiagnostic[]>([]),[log,setLog]=useState(''),[work,setWork]=useState(()=>readArduinoWork(project));
  const [librarySelectionError,setLibrarySelectionError]=useState('');
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;compiler.cancel();};},[]);
  useEffect(()=>{
    let active=true;setValid(false);setMessages([]);setLog('');setLibrarySelectionError('');
    const raw=project.files[buildFile(project)];
    void(async()=>{try{let a;try{a=await validateArtifact(project,JSON.parse(raw??'null'));}catch{a=await cachedBuild(project);}if(!a)throw Error('Nema prevedenog programa za ovaj izvor.');if(active){setValid(true);setStatus(`Program odgovara izvoru · ${memoryDescription(a)}`);setMessages(a.messages??[]);setLog(a.diagnostics??'');}}catch(e){if(active){setStatus((e as Error).message);setMessages([]);setLog('');}}})();
    return()=>{active=false;};
  },[project]);
  async function accept(snapshot:Project,a:any){
    const expected=JSON.stringify(buildInput(snapshot));await validateArtifact(snapshot,a);
    if(!mounted.current)return;
    if(current.current.id!==snapshot.id||JSON.stringify(buildInput(current.current))!==expected)throw Error('Izvor, pločica ili biblioteke promijenjeni su tijekom prevođenja. Rezultat nije primijenjen.');
    importBuild(JSON.stringify(a),expected);await rememberBuild(snapshot,a);setValid(true);setMessages(a.messages??[]);setLog(a.diagnostics??'');
  }
  async function compile(){
    setBusy(true);setValid(false);setMessages([]);setLog('');setStatus('Prevođenje programa…');const snapshot=structuredClone(current.current);
    try{let saved:any=null;try{saved=await validateArtifact(snapshot,JSON.parse(snapshot.files[buildFile(snapshot)]??'null'));}catch{}saved??=await cachedBuild(snapshot);const result=saved?{artifact:saved,cached:true}:await compiler.compile(snapshot,compileContext);await accept(snapshot,result.artifact);if(mounted.current)setStatus(result.cached?'Učitan je provjereni rezultat istog izvora, cilja i biblioteka. Zatvori prozor pa pokreni program.':'Program je preveden i spremljen. Zatvori prozor pa pokreni program.');}
    catch(e){if(mounted.current){const ds=(e as Error&{diagnostics?:BuildDiagnostic[]}).diagnostics??[];setStatus(ds.length?'Prevođenje nije uspjelo. Otvori označeni redak, ispravi kôd pa ponovi.':(e as Error).message);setMessages(ds);setLog((e as Error).message);setValid(false);}}
    finally{if(mounted.current)setBusy(false);}
  }
  async function load(selected?:File){
    if(!selected)return;setBusy(true);
    try{if(selected.size>131072)throw Error('Rezultat prevođenja prelazi 128 KiB.');const snapshot=current.current;await accept(snapshot,JSON.parse(await selected.text()));setStatus('Prevedeni program je uvezen. Zatvori prozor pa pokreni simulaciju.');}
    catch(e){setStatus((e as Error).message);setValid(false);}finally{setBusy(false);}
  }
  let libraries:ReturnType<typeof selectedLibraries>=[],libraryError='';try{libraries=selectedLibraries(project);}catch(e){libraryError=(e as Error).message;}
  const s3=project.runtimeProfile.id==='arduino-s3-wasm';
  const sourceMessages=messages.filter(d=>Object.hasOwn(project.files,d.file)||d.severity==='error'),externalCount=messages.length-sourceMessages.length;
  async function submit(){
    setBusy(true);try{const snapshot=current.current,p=await arduinoSubmission(await projectWithBuild(snapshot),work,consoleText);if(current.current.revision!==snapshot.revision||current.current.id!==snapshot.id)throw Error('Projekt je promijenjen. Ponovi pripremu predaje.');download(safeFilename(p.title)+'_predaja.zip',exportZip(p),'application/zip');setStatus('ZIP za predaju sadrži izvor, sklop, prevedeni program, tvoje podatke, opažanja i serijski zapis.');}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="arduino-build">
    <details open={!offline}><summary hidden={!offline}>Školski i lokalni prevoditelj</summary>
    <p className={valid?'build-valid':'build-pending'} role="status">{status}</p>
    <section className="compiler-connect">
      <h3>Gdje se program prevodi?</h3>
      <label>Prevoditelj <select value={compiler.mode} disabled={busy} onChange={e=>compiler.setMode(e.target.value as 'school'|'local')}><option value="school">Školski poslužitelj</option><option value="local">Lokalni prevoditelj na ovom računalu</option></select></label>
      {compiler.mode==='school'&&<><p>U školskoj instalaciji dovoljan je preglednik i prijavljeni račun. Izvor se prevodi na poslužitelju, a program pokrećeš u svojem simulatoru.</p><p role="status">{busy?compiler.schoolStatus:(compiler.capabilities.targets?.[project.board.id]?.ready?'Školski prevoditelj za ovu pločicu je spreman.':compiler.capabilities.targets?.[project.board.id]?.message??compiler.capabilities.message??'Provjera dostupnosti…')}</p><button disabled={busy} onClick={()=>void compiler.refreshSchool()}>Provjeri dostupnost</button>{compiler.capabilities.queue&&<p>Red: {compiler.capabilities.queue.map((q:any)=>`${q.status==='running'?'prevođenje':'čekanje'} ${q.jobs}`).join(' · ')||'prazan'}</p>}</>}
      {compiler.mode==='local'&&<>
      <h3>Lokalni prevoditelj</h3><p>Jednom pripremi prevoditelj na računalu. Nakon povezivanja ovaj gumb šalje točan izvor lokalnom prevoditelju i vraća rezultat u projekt.</p>
      <p className="compiler-connection" role="status">{compiler.message}</p>
      {compiler.connection!=='connected'?<>
        <ol><li><a href={appAsset('arduino-development-bridge.zip')} download>Preuzmi paket prevoditelja</a>, raspakiraj ga i prati README. {s3?'S3: Clang 19.1.7, WASM linker i Binaryen 120.':'Uno/Nano: Node.js 22+, Arduino CLI 1.3.1.'}</li><li>{s3?<>Postavi alate prema README pa pokreni <b>Pokreni.cmd</b></>:<>Jednom pokreni <b>Pripremi.cmd</b>, a zatim <b>Pokreni.cmd</b></>} (Linux/macOS: uputa u README).</li><li>Kopiraj ispisanu vezu u polje. Povezivanje otvara lokalnu karticu; ostavi je otvorenu.</li></ol>
        <form onSubmit={e=>{e.preventDefault();try{compiler.connect(link);setLink('');}catch(err){setStatus((err as Error).message);}}} className="compiler-pair">
          <label htmlFor="compiler-link">Veza iz prozora prevoditelja</label><input id="compiler-link" type="password" autoComplete="off" placeholder="http://127.0.0.1:8765/#…" value={link} onChange={e=>setLink(e.target.value)} required disabled={busy}/><button disabled={busy||!link.trim()||compiler.connection==='connecting'}>Poveži prevoditelj</button>
        </form>
      </>:<button onClick={compiler.disconnect} disabled={busy}>Odspoji prevoditelj</button>}
      </>}
      <div className="build-actions"><button className="primary" disabled={busy||!!libraryError||readSchoolBinding(compileContext?.parent??project)?.status==='locked'} onClick={()=>void compile()}>{busy?'Prevođenje…':'Prevedi program'}</button>{busy&&<button onClick={compiler.cancel}>Otkaži prevođenje</button>}<button disabled={busy} onClick={()=>{try{clearBuildCache();setStatus('Predmemorija prevoditelja u ovom pregledniku je obrisana. Spremljeni projekti ostaju dostupni.');}catch{setStatus('Brisanje predmemorije nije dostupno.');}}}>Očisti predmemoriju</button></div>
      <p className="build-small">Provjereni rezultat istog izvora može se ponovno pokrenuti. Na GitHub Pagesu koristi pripremljene primjere ili odaberi lokalni prevoditelj. Školsko prevođenje dostupno je na školskoj adresi; privremeni rezultat ne mijenja službene bodove.</p>
    </section>
    </details>
    <details open className="library-picker"><summary>Biblioteke i datoteke programa</summary>
      <p>Biblioteka je skup gotovih C++ funkcija. Odabir se sprema u projekt i određuje rezultat prevođenja. <code>Wire</code> i <code>SPI</code> dostupni su u deklariranom opsegu odabranog izvršnog profila. {s3&&<>S3 traži izričite pinove u begin(). Priloženi C++ izvori trebaju deklaracije funkcija prije uporabe; nema automatskog dodavanja prototipova.</>}</p>
      {libraryError&&<p role="alert">{libraryError}</p>}
      {librarySelectionError&&<p role="alert">{librarySelectionError}</p>}
      {AVR_LIBRARIES.filter(lib=>!s3||S3_LIBRARY_NAMES.includes(lib.name)).map(lib=><label key={lib.name}><input type="checkbox" checked={libraries.some((x:{name:string})=>x.name===lib.name)} disabled={busy} onChange={e=>{try{const next=libraries.filter((x:{name:string})=>x.name!==lib.name);if(e.target.checked)next.push({name:lib.name,version:lib.version,digest:lib.digest});setLibraries(libraryManifest(next));setLibrarySelectionError('');setMessages([]);setLog('');}catch(err){setLibrarySelectionError((err as Error).message);setStatus((err as Error).message);}}}/><b>{lib.name} {lib.version}</b> · {s3?lib.description.replace('DS18B20 na D2.','DS18B20 na odabranom GPIO-u.').replace('HW/SW I2C','HW I2C; SW I2C nije deklariran'):lib.description} U kôdu: <code>#include &lt;{lib.header}&gt;</code></label>)}
      <p className="build-small">{s3?<>S3 koristi vlastiti funkcionalni API; dostupne su samo ovdje navedene provjerene biblioteke. DHT 1.4.6, OneWire 2.3.8 / DallasTemperature 4.0.6 i U8g2 2.37.1 sada imaju provjerene primjere. Odaberi U8g2 ili U8g2_12832 prema zaslonu; priložen je font 6×10. S3 U8g2 koristi HW I2C (Wire); SW I2C nije deklariran. DS18B20 zahtijeva obje biblioteke i vanjski pull-up na 3,3 V. AVR Servo i ESP32 Wi-Fi/FreeRTOS ostaju nepodržani. Pripremljeni S3 primjeri rade i bez lokalnog prevoditelja.</>:<>Bounce2 je provjerena za Uno/Nano GPIO i vrijeme. Model tipkala daje idealne promjene stanja; mehaničko poskakivanje kontakata nije simulirano. LabAHT10, U8g2 i Servo sada imaju primjere za Uno/Nano. U8g2 zadržava profil 128 × 64. Za 128 × 32 odaberi U8g2_12832 umjesto U8g2; priložen je font 6×10. LabLCD1602 koristi potvrđeno PCF8574 mapiranje i 100 kHz. DS18B20 koristi OneWire 2.3.8 i DallasTemperature 4.0.6; odaberi obje biblioteke. Preuzmi novi paket prevoditelja ako koristiš raniju etapu.</>}</p>
      <p>Za više datoteka dodaj <code>pomoc.h</code> i <code>{offline?'pomoc.cpp':'src/pomoc.cpp'}</code> gumbom + uz kartice editora. Uključi header s <code>#include "pomoc.h"</code>. {offline?<>U offline prototipu dodatne C/C++ datoteke stavi u korijen, uz <code>main.ino</code>; podmape još nisu podržane.</>:<>Datoteke u <code>src/</code> prevode se zajedno s <code>main.ino</code>.</>}</p>
    </details>
    {sourceMessages.length>0&&<section className="build-messages" aria-label="Poruke prevoditelja"><h3>Poruke prevoditelja</h3>{sourceMessages.map((d,i)=><div key={i}><button disabled={!Object.hasOwn(project.files,d.file)} onClick={()=>goTo(d)}>{d.file}:{d.line}:{d.column}</button> <b>{d.severity==='warning'?'Upozorenje':d.severity==='note'?'Napomena':'Pogreška'}</b>: {d.message}</div>)}</section>}
    {externalCount>0&&<p className="build-small">Poruke iz Arduino corea ili biblioteka: {externalCount}. Dostupne su u cijelom zapisu prevođenja.</p>}
    {!!log&&<details><summary>Cijeli zapis prevođenja</summary><pre className="compiler-log">{log}</pre></details>}
    <details><summary>Ručni uvoz i izvoz</summary><div className="build-actions"><button disabled={busy} onClick={()=>download(safeFilename(project.title)+'.json',JSON.stringify(project,null,2),'application/json')}>Preuzmi projekt JSON</button><button disabled={busy} onClick={()=>file.current?.click()}>Uvezi prevedeni program</button></div><input ref={file} type="file" accept=".json" hidden onChange={e=>{void load(e.target.files?.[0]);e.target.value='';}}/><p>I dalje možeš koristiti <code>{s3?'node scripts/s3-compile.mjs projekt.json rezultat.s3.json':'node scripts/avr-compile.mjs projekt.json rezultat.avr.json'}</code> i ručno uvesti rezultat.</p></details>
    <details className="arduino-submission"><summary>Predaja Arduino projekta</summary><p>Prvo prevedi i pokreni program, zatim opiši opažanje. ZIP se može ponovno otvoriti gumbom Uvezi projekt. Nastavnik pregledava kôd, sklop i opažanja te pokreće program.</p><form onSubmit={e=>{e.preventDefault();void submit();}}><label>Ime i prezime<IdentityInput value={work.student} limit={STUDENT_NAME_LIMIT} required onChange={value=>setWork({...work,student:value})}/></label><label>Razred ili grupa<IdentityInput value={work.group} limit={CLASS_NAME_LIMIT} required onChange={value=>setWork({...work,group:value})}/></label><label>Što program radi i što si provjerio<textarea value={work.observations} maxLength={4000} required onChange={e=>setWork({...work,observations:e.target.value})}/></label><button disabled={busy||!valid}>Preuzmi ZIP za predaju</button></form></details>
    <details><summary>Opseg izvršnog modela</summary>{s3?<p>Stvarno prevedeni C++ u WebAssemblyju. Funkcionalni GPIO/ADC/PWM, Serial, Wire i SPI; nije Xtensa, ESP-IDF ni Espressif Arduino core. Virtualno vrijeme napreduje s API pozivima i čekanjem; nema ciklusne točnosti, Wi-Fi-ja, BLE-a, RTOS-a, hardverskih prekida ni dinamičkog heapa. 2 MiB WASM memorije nisu mjerenje SRAM-a stvarnog ESP32. WASM nije firmware. Izvoz za pravi cilj provjeri zasebnim prevođenjem.</p>:<p>ATmega328P, 16 MHz, 2 KiB SRAM; GPIO, ADC, tri timera, PWM, vanjski prekidi i UART. Etapa 11 dodaje LM35, TEMT6000, NTC, KY-023 te definirane Lab AO/DO i DO ulaze; za njih nisu potrebne dodatne biblioteke. ADC referenca DEFAULT je 5 V, INTERNAL 1,1 V; napajanje senzora ostaje zasebno. TWI i software I2C upravljaju AHT10 i OLED-om SSD1306; Servo koristi stvarne Timer1 impulse. AHT10 ima zasebnu sabirnicu. SRAM prikazuje statičke podatke i najmanji razmak stoga do njih; to nije provjera dinamičkog heapa. SPI uređaji koriste stvarne bajtove i odvojene CS priključke; nepovezani MISO vraća 0xFF. Brzina virtualnog vremena ovisi o računalu. Školski poslužitelj može prevesti izvor za simulator. Prijenos programa na fizičku pločicu nije dio ove isporuke.</p>}</details>
  </div>;
}
export function ArduinoSerial({running,send}:{running:boolean;send:(text:string)=>void}){
  const [value,setValue]=useState(''),[ending,setEnding]=useState('');
  return <form className="arduino-serial" onSubmit={e=>{e.preventDefault();if(running&&value){send(value+ending);setValue('');}}}>
    <label htmlFor="serial-text">Serijski unos</label><input id="serial-text" value={value} maxLength={128} onChange={e=>setValue(e.target.value)} placeholder="npr. 1, 0 ili b" disabled={!running}/>
    <select aria-label="Završetak retka" value={ending} onChange={e=>setEnding(e.target.value)}><option value="">Bez završetka</option><option value={'\n'}>LF</option><option value={'\r\n'}>CR + LF</option></select>
    <button disabled={!running||!value}>Pošalji</button>
  </form>;
}
