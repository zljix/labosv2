import {ursLessons,ursTargets,variantAvailable,type UrsTarget} from '../../src/lessons/ursCatalog';
import {lessons} from '../../src/lessons/catalog';
import registry from './profiles.json';

const families:Record<string,[string,string]>={
  gpio:['inputs','Osnovni ulazi i senzori'],regulator:['actuators','Aktuatori i regulacija'],
  weather:['inputs','Osnovni ulazi i senzori'],analog:['inputs','Osnovni ulazi i senzori'],
  dht:['inputs','Osnovni ulazi i senzori'],onewire:['inputs','Osnovni ulazi i senzori'],
  encoder:['inputs','Osnovni ulazi i senzori'],ir:['inputs','Osnovni ulazi i senzori'],
  actuators:['actuators','Aktuatori i regulacija'],stepper:['actuators','Aktuatori i regulacija'],
  displays:['displays','Zasloni i dodir'],spi:['displays','Zasloni i dodir'],touch:['displays','Zasloni i dodir'],
  storage:['storage','RTC i SD'],optical:['inputs','Osnovni ulazi i senzori'],radio:['radio','Dva radio čvora'],
  levels:['inputs','Osnovni ulazi i senzori'],i2cLevels:['inputs','Osnovni ulazi i senzori'],
};

export function gradingSupport(taskKey:string,target:string){
  const profile=[...registry.profiles].reverse().find(p=>p.taskKey===taskKey&&p.targets.includes(target));
  return profile?{status:'supported' as const,profileId:profile.id,checkerVersion:profile.checkerVersion,
    title:profile.title,instructions:profile.instructions,criteria:profile.criteria,maxPoints:profile.criteria.reduce((n,c)=>n+c.maxPoints,0),
    reason:'Dostupna je verzionirana poslužiteljska provjera za ovaj cilj.',
    requirement:target==='micropython'?'Školski Linux provjeravač s izoliranim izvođenjem izvora.':
      'Za promijenjeni Arduino izvor uključi lokalno izolirano prevođenje. Bez prevoditelja vrijedi samo točan izvor iz pouzdanog kataloga.',
    evidence:profile.id.startsWith('24H-')?'verification/school-displays.test.ts':profile.id.startsWith('24G-')?'verification/school-steppers.test.ts':profile.id.startsWith('24F-')?'verification/school-actuators.test.ts':profile.id.startsWith('24E-')?'verification/school-events.test.ts':profile.id.startsWith('24D-')?'verification/school-sensors.test.ts':profile.id.startsWith('24C-')?'verification/school-analog.test.ts':profile.id.startsWith('24B-')?'verification/school-contract.test.ts':profile.id.startsWith('23E-')?'verification/school-grading.test.ts':'verification/school-grading-expanded.test.ts'}:
    {status:'unsupported' as const,profileId:null,checkerVersion:null,title:null,instructions:null,criteria:[],maxPoints:null,
    reason:target==='s3-cpp'?'Službeni provjeravač još nema adapter za ESP32-S3 C++.':
      'Ova varijanta još nema objavljenu funkcionalnu provjeru za odabrani cilj.',
    requirement:'Simulator i pripremni kriteriji ostaju dostupni. Službeni bodovi nisu dodijeljeni.',evidence:null};
}

export function gradingCoverage(sourceVersion:string){
  const rows=ursLessons.flatMap(lesson=>lesson.variants.flatMap(variant=>
    (Object.keys(ursTargets) as UrsTarget[]).filter(target=>variantAvailable(variant,target)).map(target=>{
      const key=lesson.id+'/'+variant.id;
      if(!families[lesson.id])throw Error('Nedostaje obitelj bodovanja za temu '+lesson.id);
      const [family,familyTitle]=families[lesson.id];
      return {id:key+'/'+target,taskKey:key,code:'URS'+String(lesson.number).padStart(2,'0'),
        lessonId:lesson.id,lessonTitle:lesson.title,variantId:variant.id,variantTitle:variant.title,
        target,targetTitle:ursTargets[target].label,family,familyTitle,goal:lesson.goal,
        preparationCriteria:lesson.criteria,change:lesson.change,fault:lesson.fault,expected:lesson.expected,
        grading:gradingSupport(key,target)};
    })));
  const introductory=lessons.map(l=>({code:'V'+l.number,lessonId:l.id,title:l.title,target:'micropython',
    status:'local-only',maxPoints:null,criteria:l.criteria,
    reason:'Početna vježba ima lokalnu povratnu informaciju. Nije objavljena kao službena školska rubrika; ne nasljeđuje bodove slične URS vježbe.'}));
  return {format:'labosv2-grading-coverage',version:1,sourceVersion,
    summary:{themes:ursLessons.length,variants:ursLessons.reduce((n,l)=>n+l.variants.length,0),
      combinations:rows.length,supported:rows.filter(r=>r.grading.status==='supported').length,
      unsupported:rows.filter(r=>r.grading.status==='unsupported').length,introductory:introductory.length},rows,introductory};
}

export function gradingCoverageCSV(coverage:ReturnType<typeof gradingCoverage>){
  const quote=(v:unknown)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const header=['Skup','Tema','Varijanta','Cilj','Status','Rubrika','Najviše bodova','Kriteriji','Uvjet / ograničenje'];
  const rows=coverage.rows.map(r=>['URS',r.code+' · '+r.lessonTitle,r.variantTitle,r.targetTitle,
    r.grading.status==='supported'?'Podržano':'Nije podržano',r.grading.profileId,r.grading.maxPoints,
    r.grading.status==='supported'?r.grading.criteria.map(c=>c.description+' ('+c.maxPoints+')').join(' | '):
      r.preparationCriteria.join(' | '),r.grading.reason+' '+r.grading.requirement]);
  for(const l of coverage.introductory)rows.push(['Početne',l.code+' · '+l.title,'',l.target,'Samo lokalna provjera',null,null,l.criteria.join(' | '),l.reason] as any);
  return '\uFEFF'+[header,...rows].map(row=>row.map(quote).join(';')).join('\r\n')+'\r\n';
}
