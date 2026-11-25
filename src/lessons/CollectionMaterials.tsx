import {OfflineReading} from './OfflineReading';
import {zipSync} from 'fflate';
import {useEffect, useState} from 'react';
import {appAsset} from '../platform/assets';
import {download} from '../project/archive';
import {CollectionDownload} from './CollectionDownload';
import type {Edition} from './IotUsPilot';
import titles from './iotUsTitles.json';

export type ExerciseId = keyof typeof titles;
type Block = {text:string} | {img:string; alt:string} | {table:string[][]};
type Sheet = {
  hours:string; goal:string; service:string; topic:string; note:string; files:Record<string,string>;
  intro:Block[]; steps:{title:string; items:Block[]}[];
};
export const collectionAsset = (path:string) => appAsset('zbirke/'+path);

function Blocks({items}:{items:Block[]}) {
  return <>{items.map((item,i) => {
    if ('img' in item) return <img key={i} loading="lazy" style={{maxWidth:'100%',height:'auto'}} src={collectionAsset(item.img)} alt={item.alt}/>;
    if ('table' in item) return <div key={i} style={{overflowX:'auto'}}><table><thead><tr>{item.table[0].map((v,k)=><th key={k}>{v}</th>)}</tr></thead>
      <tbody>{item.table.slice(1).map((row,j)=><tr key={j}>{row.map((v,k)=><td key={k}>{v}</td>)}</tr>)}</tbody></table></div>;
    return <p key={i}>{item.text.startsWith('DOKAZ ') ? <strong>{item.text}</strong> : item.text}</p>;
  })}</>;
}

function downloadServices(id:ExerciseId,edition:Edition) {
  if(id.startsWith('V2.')) {
    if(edition==='Arduino')return ['Arduino_C2'];
    if(id==='V2.1'||id==='V2.2')return ['MicroPython_C2_HTTP'];
    return id==='V2.3'?['MicroPython_C2_HTTP','MicroPython_C2_MQTT']:['MicroPython_C2_MQTT'];
  }
  if(['V4.4','V4.5','V4.6'].includes(id))return [edition+'_C4'];
  return [];
}

async function bundle(sheet:Sheet, id:ExerciseId, edition:Edition) {
  const entries=await Promise.all(Object.entries(sheet.files).map(async ([name,path])=>{
    const response=await fetch(collectionAsset(path));
    if(!response.ok)throw Error(name);
    return [name,new Uint8Array(await response.arrayBuffer())] as const;
  }));
  download(id.replace('.','_')+'_'+edition+'_v14.zip',zipSync(Object.fromEntries(entries),{level:0}),'application/zip');
}

export function CollectionMaterials({id,edition,pilot,usPreparation}:{id:ExerciseId;edition:Edition;pilot:boolean;usPreparation:boolean}) {
  const [sheet,setSheet]=useState<Sheet>();
  const [failed,setFailed]=useState(false);
  const [packing,setPacking]=useState(false);
  const [packError,setPackError]=useState(false);
  const dir=id.replace('.','_');
  useEffect(()=>{
    const controller=new AbortController();
    fetch(collectionAsset(dir+'/'+edition+'.json'),{signal:controller.signal})
      .then(r=>{if(!r.ok)throw Error();return r.json() as Promise<Sheet>})
      .then(setSheet).catch(()=>{if(!controller.signal.aborted)setFailed(true)});
    return ()=>controller.abort();
  },[dir,edition]);
  if(failed)return <p role="alert">Uputa se nije učitala. Ponovno otvori vježbu uz pokrenut lokalni poslužitelj.</p>;
  if(!sheet)return <p role="status">Učitavanje učeničke upute…</p>;
  const word=Object.values(sheet.files).find(path=>path.endsWith('.docx'))!;
  return <>
    {!pilot && <>
      <p><strong>{sheet.goal}</strong></p>
      <p>{sheet.hours} · {edition==='Arduino'?'ESP32-S3-CAM N16R8':'ESP32-S3 DevKitC-1 N16R8'}</p>
      <p>Tema {sheet.topic}. {sheet.service}.</p>
      <OfflineReading id={id}/>
      <details><summary>Priprema za vježbu</summary><Blocks items={sheet.intro}/></details>
      {sheet.steps.map(step=><details key={step.title}><summary>{step.title}</summary><Blocks items={step.items}/></details>)}
      <p><CollectionDownload href={collectionAsset(word)}>Učenički Word · {edition}</CollectionDownload></p>
    </>}
    {usPreparation && <details><summary>Mrežna priprema za V2.S · 2 sata u temi 3.7</summary>
      <p>U drugom koraku V2.1 prati uzorak do aplikacije i poveži ga s uređajem, pokretanjem i rednim brojem. U prvom i drugom koraku V2.3 usporedi tko šalje HTTP zahtjev, tko objavljuje poruku MQTT i kako prepoznaješ potvrdu iste naredbe. Nakon pripreme otvori V2.S u ovoj zbirci.</p>
      {['V2_1','V2_3'].map(d=><p key={d}><CollectionDownload href={collectionAsset(d+'/LV_'+d+'_'+edition+'_v14.docx')}>Cijeli Word za mrežnu pripremu · {d.replace('_','.')}</CollectionDownload></p>)}
    </details>}
    {id==='V4.3' && <p>Upotrijebi svoju dovršenu biblioteku iz V4.2 za oba programa. Na postaji zadrži istu mapu biblioteke dok prelaziš iz A u B.</p>}
    <button disabled={packing} onClick={async()=>{
      setPacking(true);setPackError(false);
      try{await bundle(sheet,id,edition)}catch{setPackError(true)}finally{setPacking(false)}
    }}>{packing?'Priprema ZIP-a…':'Preuzmi Word i početne datoteke (ZIP)'}</button>
    {packError && <p role="alert">Preuzimanje nije uspjelo. Ponovno otvori lokalni poslužitelj i pokušaj još jednom.</p>}
    {!pilot && <details><summary>Datoteke i priprema postaje</summary>
      {Object.entries(sheet.files).filter(([name])=>!name.endsWith('.docx')).map(([name,path])=><p key={name}><CollectionDownload href={collectionAsset(path)}>{name}</CollectionDownload></p>)}
      {downloadServices(id,edition).map(service=><p key={service}><CollectionDownload href={collectionAsset('prilozi/'+service+'.zip')}>Školska usluga · {service.replaceAll('_',' ')}</CollectionDownload></p>)}
      {edition==='Arduino' && <p><CollectionDownload href={collectionAsset('prilozi/Arduino_biblioteke.zip')}>Arduino biblioteke iz školskog kompleta</CollectionDownload></p>}
    </details>}
  </>;
}
