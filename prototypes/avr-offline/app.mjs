import {installPackage,packageStatus,PACKED_BYTES} from './package.mjs';
import {validateResult,normalizeInput} from './compiler.mjs';
import {LIBRARIES,normalizeLibraries} from './libraries.mjs';
import {EXAMPLES} from './examples.mjs';
import {readProject,projectInput,updateProject,projectBundle,IMPORT_LIMIT} from './project-bridge.ts';
const $=id=>document.getElementById(id);
const storageKey='labos-avr-offline-prototype-project-v1';
let libraries=[];
let files=structuredClone(EXAMPLES.blink.files), active='main.ino', result=null, simulation=null, worker=null, timer=null, job=0, ready=false, project=null, importTicket=0;
let restoreError='';
try {const saved=JSON.parse(localStorage.getItem(storageKey));if(saved){const input=normalizeInput(saved);if(saved.project)project=updateProject(projectInput(saved.project).project,input);files=input.files;libraries=input.libraries;$('board').value=input.board;}}catch{restoreError='Spremljeni projekt nije valjan. Izvorni spremljeni zapis nije obrisan; uvezi sigurnosnu kopiju.';}
const input=()=>({board:$('board').value,files:structuredClone(files),libraries:structuredClone(libraries)});
function currentProject(){return project?updateProject(project,input()):null;}
function projectInfo(){
  $('board').disabled=!!project;$('example').disabled=!!project;
  $('export-project').disabled=!project;$('export-result').disabled=!project||!result;
  $('detach-project').disabled=!project;
  $('project-status').textContent=project?`${project.title} · sklop i ostale datoteke ostaju u projektu. Simulacija koristi uvezeni sklop; graf ispod prikazuje samo D13.`:'Uvezi projekt JSON iz Labosa ili prethodno spremljeni rezultat prototipa. Podržani su Uno/Nano projekti s bibliotekama iz popisa ispod.';
}
function persist(){try{if(project)project=currentProject();localStorage.setItem(storageKey,JSON.stringify({...input(),...(project?{project}:{})}));return true;}catch{$('status').textContent='Preglednik nije spremio izmjene. Preuzmi projekt ili kopiraj kod prije zatvaranja.';return false;}}
function clearOutput(){simulation=null;$('circuit-result').textContent='Sklop još nije pokrenut.';$('serial').textContent='Izmijenjeni program još nije pokrenut.';$('led').classList.remove('on');$('transitions').textContent='';$('wave').getContext('2d').clearRect(0,0,800,100);}
function invalidate(){importTicket++;result=null;projectInfo();clearOutput();$('run').disabled=true;$('diagnostics').textContent='Izvor je promijenjen; potrebno je novo prevođenje.';$('status').textContent='Izmijenjeni program još nije preveden.';if(worker)cancel('Izvor je promijenjen. Posao je prekinut.');persist();}
function libraryControls(){
  $('libraries').replaceChildren();
  for(const lib of LIBRARIES){
    const label=document.createElement('label'),box=document.createElement('input');
    box.type='checkbox';box.value=lib.name;box.checked=libraries.some(x=>x.name===lib.name);
    box.onchange=()=>{
      let next=libraries.filter(x=>x.name!==lib.name);
      if(box.checked){
        if(lib.name==='U8g2'||lib.name==='U8g2_12832')next=next.filter(x=>x.name!=='U8g2'&&x.name!=='U8g2_12832');
        if(lib.name==='DallasTemperature'&&!next.some(x=>x.name==='OneWire'))next.push(LIBRARIES.find(x=>x.name==='OneWire'));
        next.push(lib);
      }else if(lib.name==='OneWire')next=next.filter(x=>x.name!=='DallasTemperature');
      libraries=normalizeLibraries(next);libraryControls();invalidate();
    };
    label.append(box,document.createTextNode(lib.name+' '+lib.version));$('libraries').append(label);
  }
}
function tabs(){
  $('tabs').replaceChildren();
  for(const name of Object.keys(files)){
    const button=document.createElement('button');button.textContent=name;button.role='tab';button.setAttribute('aria-selected',String(name===active));button.onclick=()=>{active=name;tabs();};$('tabs').append(button);
  }
  $('code').value=files[active];$('code').setAttribute('aria-label','Izvorni kod: '+active);
}
$('code').oninput=()=>{files[active]=$('code').value;invalidate();};
$('board').onchange=invalidate;
$('example').onchange=()=>{libraries=[];libraryControls();files=structuredClone(EXAMPLES[$('example').value].files);active='main.ino';invalidate();tabs();};
function end(){worker?.terminate();worker=null;clearTimeout(timer);$('cancel').disabled=true;$('compile').disabled=!ready;}
function cancel(message='Posao je prekinut.'){importTicket++;job++;end();result=null;projectInfo();$('run').disabled=true;clearOutput();$('status').textContent=message;}
$('cancel').onclick=()=>cancel();
async function runJob(type) {
  if(worker)return;
  let snapshot,projectSnapshot;
  try{snapshot=input();projectSnapshot=currentProject();}catch(e){cancel();$('diagnostics').textContent=e.message;return;}
  const durationMs=Number($('duration').value);
  const id=++job;
  if(type==='compile'){result=null;projectInfo();clearOutput();$('diagnostics').textContent='Pripremam lokalne datoteke prevoditelja…';}
  $('compile').disabled=true;$('run').disabled=true;$('cancel').disabled=false;
  $('status').textContent=type==='compile'?'Prevodim u pregledniku…':`Simuliram ${durationMs/1000} sekunde…`;
  worker=new Worker(new URL('worker.js',location.href));
  const fail=message=>{if(id!==job)return;end();result=null;projectInfo();clearOutput();$('run').disabled=true;$('status').textContent='Program nije pokrenut.';$('diagnostics').textContent=message;};
  timer=setTimeout(()=>{cancel('Posao je prekinut nakon 60 sekundi.');},60000);
  worker.onerror=e=>fail(e.message || 'Pogreška radnog procesa.');
  worker.onmessage=async({data})=>{
    if(id!==job)return;
    if(data.type==='progress'){$('status').textContent='Prevodim: '+data.tool;return;}
    if(data.type==='error'){fail(data.message);return;}
    try{
      if(data.type==='compiled'){
        await validateResult(input(),data.result);
        if(id!==job)return;
        result=data.result;end();projectInfo();$('run').disabled=false;
        $('status').textContent='Prevedeno lokalno. Spremno za simulaciju.';
        $('diagnostics').textContent=`Vrijeme: ${result.elapsedMs} ms\nFlash: ${result.flashBytes} B\nStatički SRAM: ${result.staticRamBytes} B\nHEX SHA-256: ${result.hexHash}\n\n${result.diagnostics.join('\n') || 'Bez pogrešaka.'}`;
      }else if(data.type==='simulated'){
        await validateResult(input(),result);
        if(id!==job)return;
        simulation=data.result;end();$('run').disabled=false;
        $('serial').textContent=simulation.serial || '(Program nema serijskog ispisa.)';
        const samples=simulation.samples, transitions=samples.filter((s,i)=>i&&s.level!==samples[i-1].level).length;
        $('transitions').textContent=`· ${transitions} promjena u ${simulation.durationMs/1000} s`;$('led').classList.toggle('on',!!samples.at(-1)?.level);
        const ctx=$('wave').getContext('2d');ctx.clearRect(0,0,800,100);ctx.strokeStyle='#08796e';ctx.lineWidth=2;ctx.beginPath();
        samples.forEach((s,i)=>{const x=s.ms/simulation.durationMs*800,y=s.level?20:80;if(i){ctx.lineTo(x,samples[i-1].level?20:80);ctx.lineTo(x,y);}else ctx.moveTo(x,y);});ctx.stroke();
        $('status').textContent=simulation.faults.length?'Simulacija je prijavila pogrešku.':'Simulacija dovršena: izvršen je upravo prevedeni HEX.';
        if(project){
          const frame=simulation.lastFrame;
          $('circuit-result').textContent=[...Object.entries(frame?.leds??{}).map(([id,led])=>`${id}: ${led.currentMa.toFixed(2)} mA`),...Object.entries(frame?.servos??{}).map(([id,s])=>`${id}: ${s.angle===null?'nema valjanih impulsa':s.angle.toFixed(1)+'°'}`),...Object.entries(frame?.displays??{}).map(([id,d])=>`${id}: ${d.lines?d.lines.join(' / '):(d.bytes??[]).filter(Boolean).length+' bajtova slike različitih od nule'}`),...(frame?.diagnostics??[]).map(d=>d.message),...simulation.faults.map(e=>e.message)].join('\n')||'Uvezeni sklop izvršen je bez prijavljenih poruka.';
        }
      }
    }catch(e){fail(e.message);}
  };
  worker.postMessage({type,input:snapshot,result,durationMs,...(projectSnapshot?{project:projectSnapshot}:{})});
}
$('compile').onclick=()=>runJob('compile');$('run').onclick=()=>runJob('simulate');
$('import-project').onclick=()=>$('project-file').click();
$('project-file').onchange=async()=>{
  const file=$('project-file').files[0];$('project-file').value='';if(!file)return;
  const ticket=++importTicket;
  try{
    if(file.size>IMPORT_LIMIT)throw Error('Projekt JSON prelazi 2 MiB.');
    const loaded=await readProject(await file.text());
    if(ticket!==importTicket)throw Error('Program je izmijenjen tijekom uvoza. Ponovi uvoz ako želiš zamijeniti trenutni program.');
    cancel();project=loaded.project;files=loaded.input.files;libraries=loaded.input.libraries;libraryControls();$('board').value=loaded.input.board;active='main.ino';result=loaded.result;
    tabs();projectInfo();const saved=persist();$('run').disabled=!result;
    if(saved)$('status').textContent=result?'Projekt i rezultat provjereni su. Pokretanje je ručno.':'Projekt je uvezen. Prevedi ga offline.';
    $('diagnostics').textContent=result?'Uvezen je provjeren rezultat prototipa.':'Projekt još nije preveden ovim prototipom.';
  }catch(e){$('project-status').textContent=e.message;}
};
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-project').onclick=()=>{try{download('labos-projekt.json',currentProject());}catch(e){$('project-status').textContent=e.message;}};
$('export-result').onclick=async()=>{try{const p=currentProject(),r=result,bundle=await projectBundle(p,r);if(result!==r)throw Error('Program je izmijenjen. Ponovno prevedi prije izvoza.');download('labos-offline-prototip.json',bundle);}catch(e){$('project-status').textContent=e.message;}};
$('detach-project').onclick=()=>{cancel();project=null;projectInfo();persist();$('status').textContent='Uređuješ izdvojenu kopiju izvora. Izvorna uvezena datoteka ostala je nepromijenjena.';};
async function storageInfo(){try{const s=await navigator.storage.estimate();$('storage-info').textContent=`Zauzeto na ovoj adresi: ${(s.usage/1048576).toFixed(1)} MiB · kvota: ${(s.quota/1048576).toFixed(1)} MiB. Paket se čuva komprimiran.`;}catch{$('storage-info').textContent='Paket se čuva komprimiran.';}}
$('prepare').onclick=async()=>{
  $('prepare').disabled=true;$('compile').disabled=true;
  try {
    await shellReady;
    await installPackage((done,total)=>{$('progress').value=done/total;$('package-status').textContent=`Spremam prevoditelj: ${(done/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MiB`;});
    ready=true;$('progress').value=1;$('package-status').textContent='Aplikacija i prevoditelj spremljeni su. Možeš isključiti mrežu.';
  }catch(e){ready=false;$('package-status').textContent=e.name==='QuotaExceededError'?'Nema dovoljno prostora u pregledniku. Projekt je sačuvan; pripremu paketa možeš nastaviti kada bude prostora.':e.message;}
  finally{$('prepare').disabled=false;$('compile').disabled=!ready||!!worker;await storageInfo();}
};
const network=()=>{$('network').textContent=navigator.onLine?'Mreža je uključena':'Mreža je isključena';};
window.addEventListener('online',network);window.addEventListener('offline',network);network();libraryControls();tabs();projectInfo();if(restoreError)$('project-status').textContent=restoreError;
const shellReady=(async()=>{
  if(!('serviceWorker' in navigator))throw Error('Ovaj preglednik ne podržava offline aplikaciju.');
  await navigator.serviceWorker.register('./sw.js',{scope:'./'});
  await navigator.serviceWorker.ready;
})();
// Read-only evidence hook for repeatable prototype verification, never an execution shortcut.
window.labosPrototype={getState:()=>structuredClone({input:input(),project:currentProject(),result,simulation,ready,busy:!!worker})};
try{await shellReady;await packageStatus();ready=true;$('progress').value=1;$('package-status').textContent='Aplikacija i prevoditelj dostupni su iz spremljenog paketa.';}
catch(e){$('package-status').textContent=`Za prvi offline rad pripremi paket (${(PACKED_BYTES/1048576).toFixed(1)} MiB).`;}
$('compile').disabled=!ready;
await storageInfo();
