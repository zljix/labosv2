import {useEffect,useRef,useState} from 'react';
import type {Project} from '../project/model';
import {appAsset} from '../platform/assets';
import {installPackage,packageStatus,PACKED_BYTES} from '../../prototypes/avr-offline/package.mjs';
import {OfflineCompileTask,offlineIdentity,beginOffline,saveOffline,loadOffline,prefersOffline} from './offlineAvr';
import {download,safeFilename} from '../project/archive';
import {projectBundle} from '../../prototypes/avr-offline/project-bridge';

export default function OfflineAvrPanel({project,stop,run}:{project:Project;stop:()=>void;run:()=>void}){
  const base=new URL(appAsset('offline-avr/'),location.href).href;
  const task=useRef(new OfflineCompileTask(()=>new Worker(base+'worker.js')));
  const live=useRef(project);live.current=project;
  const epoch=useRef(0),mounted=useRef(true);
  const [busy,setBusy]=useState(false),[preparing,setPreparing]=useState(false),[ready,setReady]=useState(false),[valid,setValid]=useState(false);
  const [status,setStatus]=useState('Provjera offline paketa…');
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{if(!busy)return;const start=Date.now();setElapsed(0);const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[busy]);
  let identity='',unsupported='';try{identity=offlineIdentity(project);}catch(e){unsupported=(e as Error).message;}
  useEffect(()=>{mounted.current=true;void packageStatus(()=>{},base).then(()=>{if(mounted.current){setReady(true);setStatus('Paket je spremljen. Možeš prevoditi bez mreže.');}},()=>{if(mounted.current)setStatus('Jednom pripremi paket dok si na mreži.');});return()=>{mounted.current=false;epoch.current++;task.current.cancel();};},[]);
  useEffect(()=>{
    const ticket=++epoch.current;task.current.cancel();setBusy(false);setValid(false);
    if(!unsupported)void loadOffline(project).then(()=>{if(ticket===epoch.current&&mounted.current)setValid(true);},()=>{});
  },[identity,unsupported]);
  async function prepare(){
    setPreparing(true);setReady(false);
    try{await installPackage((done:number,total:number)=>{if(mounted.current)setStatus(`Spremanje paketa: ${Math.round(done/total*100)} %`);},base);if(mounted.current){setReady(true);setStatus('Paket je spremljen. Možeš prevoditi bez mreže.');}}
    catch(e){if(mounted.current)setStatus((e as Error).message+' Ponovi pripremu paketa.');}
    finally{if(mounted.current)setPreparing(false);}
  }
  async function compile(){
    stop();const snapshot=structuredClone(live.current),key=offlineIdentity(snapshot),ticket=++epoch.current;
    beginOffline(snapshot);setBusy(true);setValid(false);setStatus('Prevođenje u pregledniku…');
    try{
      const phases:Record<string,string>={cc1plus:'Prevođenje C++ izvora',cc1:'Prevođenje C izvora','avr-as':'Sastavljanje strojnog koda','avr-ld':'Povezivanje programa i biblioteka',objcopy:'Priprema izvršnog programa'};
      const result=await task.current.compile(snapshot,tool=>{if(ticket===epoch.current&&mounted.current)setStatus((phases[tool]??'Priprema prevoditelja')+'…');});
      if(!mounted.current||ticket!==epoch.current||offlineIdentity(live.current)!==key)return;
      const persisted=await saveOffline(snapshot,result);
      if(!mounted.current||ticket!==epoch.current||offlineIdentity(live.current)!==key)return;
      setValid(true);setStatus(`Prevedeno · Flash ${result.flashBytes} B · statički SRAM ${result.staticRamBytes} B. ${persisted?'Rezultat je spremljen za ponovno otvaranje.':'Spremi projekt; rezultat nije moguće sačuvati nakon zatvaranja preglednika.'}`);
    }catch(e){if(mounted.current&&ticket===epoch.current)setStatus((e as Error).message);}
    finally{if(mounted.current&&ticket===epoch.current)setBusy(false);}
  }
  async function exportResult(){try{const p=live.current;download(safeFilename(p.title)+'_offline.json',JSON.stringify(await projectBundle(p,await loadOffline(p)),null,2),'application/json');}catch(e){setValid(false);setStatus((e as Error).message);}}
  return <section className="compiler-connect offline-avr-panel" aria-label="Offline Arduino prototip">
    <h3>Prevođenje u pregledniku · eksperimentalna beta</h3>
    <p>Za Uno i klasični Nano. Jednom spremi paket ({(PACKED_BYTES/1048576).toFixed(2)} MiB), zatim uređuj i prevodi program bez mreže. Biblioteke odaberi u odjeljku ispod.</p>
    <p>Za ponovno otvaranje cijelog Labosa bez mreže pripremi i aplikaciju kroz <b>Status i offline</b>.</p>
    <p><a href={appAsset('compiler-sources.html')} target="_blank" rel="noopener">Izvori i licence prevoditelja</a></p>
    {unsupported&&<p role="alert">{unsupported}</p>}
    <pre role="status" className="compiler-log" data-testid="offline-avr-status">{status}</pre>
    {busy&&<p role="status">Prevođenje traje {elapsed} s. Možeš ga prekinuti bez promjene izvornog koda.</p>}
    <div className="build-actions">
      <button disabled={preparing||busy} onClick={()=>void prepare()}>{preparing?'Spremanje paketa…':ready?'Provjeri i dopuni paket':'Pripremi offline prevoditelj'}</button>
      <button disabled={!ready||busy||preparing||!!unsupported} onClick={()=>void compile()}>Prevedi u pregledniku</button>
      {busy&&<button onClick={()=>task.current.cancel()}>Prekini offline prevođenje</button>}
      <button disabled={!valid||busy||!!unsupported||!prefersOffline(project)} onClick={run}>Pokreni offline rezultat</button>
      <button disabled={!valid||busy||!!unsupported||!prefersOffline(project)} onClick={()=>void exportResult()}>Izvezi prototipni rezultat</button>
    </div>
    <p className="build-small">Jedan main.ino i dodatne C/C++ datoteke u korijenu; deklariraj funkcije prije uporabe. Prototipni rezultat služi simulaciji i zasebnom izvozu. Službena predaja i bodovanje koriste postojeći školski postupak.</p>
  </section>;
}
