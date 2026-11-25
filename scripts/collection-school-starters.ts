import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {newProject} from '../src/project/model';
import {S3} from '../src/boards/profiles';
import {environmentCircuit,loadEnvironmentDrivers} from '../src/circuit/environmentExamples';
import {ledCircuit,libraryFiles} from '../src/lessons/CollectionProgram';
import titles from '../src/lessons/iotUsTitles.json';
import {sequence,tracks,type Track} from '../src/lessons/IotUsCatalog';

export async function* schoolCollections() {
  for(const track of Object.keys(tracks) as Track[]) for(const id of ['P0',...sequence(track)]) {
    const folder=id.replace('.','_'), key=track+'/'+id;
    const templates:Record<string,string>={},words:Record<string,string>={};
    for(const edition of ['Arduino','MicroPython'] as const){
      const mp=edition==='MicroPython',target=mp?'micropython':'s3-cpp';
      const sheet=JSON.parse(readFileSync('public/zbirke/'+folder+'/'+edition+'.json','utf8'));
      const inputs=Object.entries(sheet.files) as [string,string][];
      const word=inputs.find(([name])=>name.endsWith('.docx'))!;
      words[target]=createHash('sha256').update(readFileSync('public/zbirke/'+word[1])).digest('hex');
      const project=newProject('',tracks[track]+' · '+id+' · '+edition,S3,mp?'micropython':'arduino-cpp');
      const files=inputs.filter(([name])=>/\.(py|ino|h|cpp)$/.test(name));
      const main=files.find(([name])=>name.endsWith(mp?'.py':'.ino'))!;
      for(const [name,path] of files){
        const filename=path===main[1]?project.entryFile:name.split('/').map(s=>/^\d/.test(s)?'p'+s:s).join('/');
        project.files[filename]=readFileSync('public/zbirke/'+path,'utf8');
      }
      if(mp && (id==='V4.2'||id==='V4.3')){
        project.files={'main.py':'import provjera',...await libraryFiles()};
      }
      if(!mp && id==='V4.3'){
        for(const name of ['VentModelUcenik.cpp','VentModelUcenik.h','LabHardware.h'])
          project.files['VentModelUcenik/'+name]=readFileSync('public/zbirke/V4_2/Arduino/VentModelUcenik/'+name,'utf8');
      }
      if(mp && id==='V1.4'){
        project.circuit=environmentCircuit('ds18b20');Object.assign(project.files,await loadEnvironmentDrivers('ds18b20'));
      }
      if(mp && (id==='V1.2'||id==='V1.3'))project.circuit=ledCircuit();
      const exercise=mp && id==='V4.2'?'V4.3':id;
      project.files['zbirka.json']=JSON.stringify({track,exercise,edition,instructions:'v14'});
      const filename=track+'-'+folder+'-'+target+'.json';
      templates[target]=filename;
      yield {starter:{filename,project,key:key+'/'+target}};
    }
    const sheet=JSON.parse(readFileSync('public/zbirke/'+folder+'/MicroPython.json','utf8'));
    yield {entry:{set:track,key,lessonId:id,variantId:track,code:id,title:titles[id as keyof typeof titles],variantTitle:tracks[track],
      guideVersion:'v14',wordHashes:words,goal:sheet.goal,before:sheet.hours,change:'Korake i dokaze pronađi u dodijeljenom učeničkom Wordu.',fault:'',
      expected:'Predaj dopunjeni Word i izvor za svoju izvedbu.',concepts:[],questions:[],criteria:['Postupak i tehnička ispravnost','Praktični dokazi iz učeničkog Worda','Objašnjenje opažanja i zaključak'],targets:Object.keys(templates),templates}};
  }
}
