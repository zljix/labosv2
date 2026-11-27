import {createUrsLab, labIds, labTitle, ursLabSheets} from '../src/lessons/ursLab';
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
      expected:'Zabilježi početni i izmijenjeni pokus te odgovori na pitanje za bodovanje. U Word upiši opažanja sa školske postaje.',concepts:[],questions:[practices[id as keyof typeof titles].question],criteria:['Postupak i tehnička ispravnost','Praktični dokazi iz učeničkog Worda','Objašnjenje opažanja i zaključak'],targets:Object.keys(templates),templates}};
  }
  yield* schoolUrsLabs();
}

async function* schoolUrsLabs() {
  for (const id of labIds) {
    const sheet = ursLabSheets[id];
    const key = 'urs-lv/' + id;
    const plc = id === 'LV16', target = plc ? 'micropython' : 'nano';
    const filename = 'urs-lv-' + id + '-' + target + '.json';
    const project = await createUrsLab(id);
    yield {starter:{filename,project,key:key + '/' + target}};
    const word = readFileSync('public/zbirke/urs-lv/' + id + '/' + sheet.word);
    yield {entry:{
      set:'urs-lv', key, lessonId:id, variantId:'urs-lv', code:id, title:sheet.title,
      variantTitle:labTitle + ' · P1–P3', guideVersion:'v7', wordHashes:{[target]:createHash('sha256').update(word).digest('hex')},
      goal:sheet.goals[0], before:plc ? 'Structured Text · model PLC-a u Labosu i CODESYS na postaji.' : 'Arduino Nano classic · 90 min.',
      change:sheet.tasks.map((task,i) => 'P' + (i + 1) + ' · ' + task).join('\n'), fault:'',
      expected:'Spremi P1, P2 i P3 za zasebnu provjeru. Predaj Word s cijelim programom i opažanjima iza svakog podzadatka.',
      concepts:[], questions:sheet.questions, criteria:sheet.tasks.map((task,i) => 'P' + (i + 1) + ' · ' + task),
      targets:[target], templates:{[target]:filename}
    }};
  }
}
