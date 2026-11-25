import {useState} from 'react';
import {zipSync} from 'fflate';
import {appAsset} from './assets';
import {download,exportZip,safeFilename} from '../project/archive';
import type {Project} from '../project/model';
import {cleanCollectionSources} from './collectionPrivacy';
import type {SchoolWorkState} from './schoolSync';

export const isCollectionTask=(definition:any)=>definition?.set==='iot'||definition?.set==='us';

export function WordReceipt({work}:{work:SchoolWorkState}){
  const submitted=work.submission;
  if(!submitted||submitted.revision!==work.snapshot.revision||!isCollectionTask(work.assignment?.task?.definition))return null;
  return submitted.word?<p><a download href={appAsset('api/index.php?action=submission-word&id='+work.attempt.id+'&revision='+submitted.revision)}>Preuzmi predani Word · {submitted.word.name}</a> · revizija {submitted.revision}</p>
    :<p><strong>Za dopunu</strong> · uz ovu zaključanu reviziju nedostaje učenički Word s dokazima.</p>;
}

export async function encodeWord(file:File) {
  if(!/\.docx$/i.test(file.name)||file.size>12*1024*1024||!file.size)throw Error('Odaberi .docx do 12 MiB.');
  const uri=await new Promise<string>((resolve,reject)=>{
    const r=new FileReader();r.onerror=()=>reject(Error('Datoteku nije moguće pročitati.'));
    r.onload=()=>resolve(String(r.result));r.readAsDataURL(file);
  });
  return {name:file.name,base64:uri.slice(uri.indexOf(',')+1)};
}

export function LocalEvidence({project}:{project:Project}){
  const [error,setError]=useState('');
  return <label>Izvezi projekt s popunjenim Wordom
    <input type="file" accept=".docx" onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file)return;
      try{
        if(file.size>12*1024*1024||!file.name.toLowerCase().endsWith('.docx'))throw Error('Odaberi .docx do 12 MiB.');
        const copy=structuredClone(project);delete copy.files['school-attempt.json'];cleanCollectionSources(copy);
        download(safeFilename(project.title)+'_s_dokazima.zip',zipSync({'projekt.zip':exportZip(copy),['dokazi/'+file.name]:new Uint8Array(await file.arrayBuffer())},{level:0}),'application/zip');setError('');
      }catch(err){setError((err as Error).message)}
    }}/>{error&&<span role="alert">{error}</span>}
  </label>;
}
