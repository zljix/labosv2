import type {Project} from '../project/model';

// The v14 starter files use quoted literals for station credentials. Keep the local working copy intact.
export function cleanCollectionSources(project:Project) {
  if(!project.files['zbirka.json'])return;
  const settings=/(\b(?:WIFI_PASSWORD|WIFI_LOZINKA|MQTT_LOZINKA|MQTT_PASSWORD|API_KEY|PRISTUPNI_KLJUC)\b\s*(?:\[\s*\])?\s*=\s*)("(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*')/g;
  const redact=(value:string)=>value.replace(settings,(whole,prefix:string,literal:string)=>
    literal.length===2||/^["']UPISI_/.test(literal)?whole:prefix+literal[0]+'UKLONJENO'+literal[0]);
  for(const [key,value] of Object.entries(project.files)){
    if(/^(pokus-(prije|poslije)|P[123])-build\.json$/.test(key)){delete project.files[key];continue;}
    if(/^(pokus-(prije|poslije)|P[123]-sklop)\.json$/.test(key)){
      try{
        const snapshot=JSON.parse(value);
        if(snapshot.files&&typeof snapshot.files==='object'){
          for(const [name,source] of Object.entries(snapshot.files))if(typeof source==='string')snapshot.files[name]=redact(source);
          project.files[key]=JSON.stringify(snapshot);
        }
      }catch{delete project.files[key];}
      continue;
    }
    if(!/\.(?:py|ino|cpp|h|txt|md)$/.test(key))continue;
    project.files[key]=redact(value);
  }
}
