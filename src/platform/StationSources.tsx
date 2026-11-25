import {useState} from 'react';
import {byteLength,LIMITS,type Project} from '../project/model';

export function StationSources({project,replace}:{project:Project;replace:(path:string,code:string)=>void}){
  const station=Object.keys(project.files).filter(name=>name.startsWith('postaja/'));
  const files=station.length?station:Object.keys(project.files).filter(name=>/\.(py|ino|cpp|h)$/.test(name));
  const [selected,setSelected]=useState(station[0]??project.entryFile as string),[message,setMessage]=useState('');
  function original(path:string){
    if(!path.startsWith('postaja/'))return path;
    const [,ext,...parts]=path.split('/');
    return parts.map(part=>part.replace(/^p(?=\d)/,'')).join('/').replace(/\.txt$/,'.'+ext);
  }
  const extension=original(selected).split('.').pop();
  return <details><summary>Unesi svoj program sa školske postaje</summary>
    <p>Odaberi koju datoteku u pokušaju zamjenjuješ. Zatim učitaj svoju spremljenu datoteku iz Thonnyja ili Arduino IDE-a. Za biblioteku i višedatotečne zadatke ponovi za svaki izmijenjeni izvor.</p>
    <label>Datoteka u pokušaju <select value={selected} onChange={e=>setSelected(e.target.value)}>{files.map(name=><option key={name} value={name}>{original(name)}</option>)}</select></label>
    <label>Učitaj izmijenjeni izvor <input type="file" accept={'.'+extension} onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file)return;
      try{
        if(file.size>LIMITS.fileBytes || extension!==file.name.split('.').pop())throw Error('Odaberi izvor iste vrste, do 128 KiB.');
        const code=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
        if(byteLength(code)>LIMITS.fileBytes)throw Error('Datoteka prelazi 128 KiB.');
        replace(selected,code);setMessage('Učitano u '+original(selected)+'. Provjeri sadržaj prije zaključavanja.');
      }catch(err){setMessage((err as Error).message)}
    }}/></label><p role="status">{message}</p></details>;
}
