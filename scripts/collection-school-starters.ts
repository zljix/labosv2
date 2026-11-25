import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createPractice} from '../src/lessons/collectionSimulation';
import {practices} from '../src/lessons/collectionPlans';
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
      const project=await createPractice({track,exercise:id as keyof typeof titles,edition});
      // Preserve physical station work separately from the executable simulator source.
      const station=inputs.filter(([name])=>/\.(py|ino|cpp|h)$/.test(name));
      if(id==='V4.3' && !mp)for(const name of ['LabHardware.h','VentModelUcenik.h','VentModelUcenik.cpp']){
        station.push(['VentModelUcenik/'+name,'V4_2/Arduino/VentModelUcenik/'+name]);
      }
      for(const [name,path] of station){
        const extension=name.split('.').pop()!;
        const stem=name.slice(0,-extension.length-1).split('/').map(part=>part.replace(/^(?=\d)/,'p')).join('/');
        project.files['postaja/'+extension+'/'+stem+'.txt']=readFileSync('public/zbirke/'+path,'utf8');
      }
      const filename=track+'-'+folder+'-'+target+'.json';
      templates[target]=filename;
      yield {starter:{filename,project,key:key+'/'+target}};
    }
    const sheet=JSON.parse(readFileSync('public/zbirke/'+folder+'/MicroPython.json','utf8'));
    yield {entry:{set:track,key,lessonId:id,variantId:track,code:id,title:titles[id as keyof typeof titles],variantTitle:tracks[track],
      guideVersion:'v14',wordHashes:words,goal:sheet.goal,before:sheet.hours,change:practices[id as keyof typeof titles].change,fault:'',
      expected:'Predaj dopunjeni Word i izvor za svoju izvedbu.',concepts:[],questions:[practices[id as keyof typeof titles].question],criteria:['Postupak i tehnička ispravnost','Praktični dokazi iz učeničkog Worda','Objašnjenje opažanja i zaključak'],targets:Object.keys(templates),templates}};
  }
}
