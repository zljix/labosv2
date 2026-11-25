import type {Project} from '../project/model';

// The v14 starter files use quoted literals for station credentials. Keep the local working copy intact.
export function cleanCollectionSources(project:Project) {
  if(!project.files['zbirka.json'])return;
  const settings=/(\b(?:WIFI_PASSWORD|WIFI_LOZINKA|MQTT_LOZINKA|MQTT_PASSWORD|API_KEY|PRISTUPNI_KLJUC)\b\s*(?:\[\s*\])?\s*=\s*)("(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*')/g;
  for(const [key,value] of Object.entries(project.files)){
    if(!/\.(?:py|ino|cpp|h|txt|md)$/.test(key))continue;
    project.files[key]=value.replace(settings,(whole,prefix:string,literal:string)=>
      literal.length===2||/^["']UPISI_/.test(literal)?whole:prefix+literal[0]+'UKLONJENO'+literal[0]);
  }
}
