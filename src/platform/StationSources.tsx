import {useState} from 'react';
import {byteLength,LIMITS,type Project} from '../project/model';

export function StationSources({project,replace}:{project:Project;replace:(path:string,code:string)=>void}){
  const files=Object.keys(project.files).filter(name=>/\.(py|ino|cpp|h)$/.test(name));
  const [selected,setSelected]=useState(project.entryFile as string),[message,setMessage]=useState('');
  return <details><summary>Unesi svoj program sa školske postaje</summary>
    <p>Odaberi koju datoteku u pokušaju zamjenjuješ. Zatim učitaj svoju spremljenu datoteku iz Thonnyja ili Arduino IDE-a. Za biblioteku i višedatotečne zadatke ponovi za svaki izmijenjeni izvor.</p>
    <label>Datoteka u pokušaju <select value={selected} onChange={e=>setSelected(e.target.value)}>{files.map(name=><option key={name}>{name}</option>)}</select></label>
    <label>Učitaj izmijenjeni izvor <input type="file" accept={'.'+selected.split('.').pop()} onChange={async e=>{
      const file=e.target.files?.[0];e.target.value='';if(!file)return;
      try{
        if(file.size>LIMITS.fileBytes || selected.split('.').pop()!==file.name.split('.').pop())throw Error('Odaberi izvor iste vrste, do 128 KiB.');
        const code=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
        if(byteLength(code)>LIMITS.fileBytes)throw Error('Datoteka prelazi 128 KiB.');
        replace(selected,code);setMessage('Učitano u '+selected+'. Provjeri sadržaj prije zaključavanja.');
      }catch(err){setMessage((err as Error).message)}
    }}/></label><p role="status">{message}</p></details>;
}
