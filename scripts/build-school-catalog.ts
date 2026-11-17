import {teachingLesson,URS_GUIDE_VERSION} from '../src/lessons/ursTeaching';
import {investigationAdvice,schoolInvestigationAdvice} from '../src/lessons/workflow';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ursLessons,ursTargets,variantAvailable,createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import {parseProject,type Project} from '../src/project/model';
import {gradingSupport,gradingCoverage} from '../school/grader/coverage';
import {lessons,createLessonProject} from '../src/lessons/catalog';

// Private, reproducible starter snapshots. PHP never trusts a client-supplied
// lesson/rubric/template and publication copies these bytes into MySQL.
const directory=resolve('.build/school-catalog');
rmSync(directory,{recursive:true,force:true});mkdirSync(directory,{recursive:true});
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>{
  const path=String(input).replace(/^\/app\/[^/]+\//,'');
  if(path.startsWith('/')||path.includes('..'))throw Error('Nedopušten resurs školskog predloška.');
  return new Response(readFileSync(resolve('public',path)));
};
function stable(p:Project,key:string):Project {
  const hex=createHash('sha256').update(key).digest('hex');
  p.id=`${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
  p.createdAt=p.updatedAt='2026-11-15T00:00:00.000Z';p.revision=0;
  if(p.radio)p.radio.peer=stable(p.radio.peer,key+'/peer');
  return parseProject(p);
}
const entries=[];
try {
  for(const base of ursLessons)for(const variant of base.variants){
    const lesson=teachingLesson(base,variant.id,URS_GUIDE_VERSION);
    const targets=Object.keys(ursTargets).filter(t=>variantAvailable(variant,t as UrsTarget)) as UrsTarget[];
    const key=lesson.id+'/'+variant.id,templates:Record<string,string>={};
    for(const target of targets){
      const project=stable(await createUrsProject(lesson.id,variant.id,target),key+'/'+target);
      const filename=lesson.id+'-'+variant.id+'-'+target+'.json';
      writeFileSync(resolve(directory,filename),JSON.stringify(project));templates[target]=filename;
    }
    entries.push({set:'urs',key,lessonId:lesson.id,variantId:variant.id,code:'URS'+String(lesson.number).padStart(2,'0'),
      title:lesson.title,variantTitle:variant.title,minutes:lesson.minutes,goal:lesson.goal,before:lesson.before,
      guideVersion:URS_GUIDE_VERSION,concepts:lesson.concepts,change:investigationAdvice+' '+schoolInvestigationAdvice+' '+lesson.change,fault:lesson.fault,expected:lesson.expected,
      questions:lesson.questions,criteria:lesson.criteria,targets,templates,
      gradingSupport:Object.fromEntries(targets.map(target=>[target,gradingSupport(key,target)]))});
  }
  const drivers=Object.fromEntries(['aht10.py','ssd1306.py','servo.py'].map(n=>[n,readFileSync(resolve('public/drivers',n),'utf8')]));
  for(const lesson of lessons){
    const key='intro/'+lesson.id,filename='intro-'+lesson.id+'-micropython.json';
    // Keep the original missing connection and TODOs in student starters.
    const project=stable(createLessonProject(lesson.id,drivers),key+'/micropython');
    writeFileSync(resolve(directory,filename),JSON.stringify(project));
    entries.push({set:'introductory',key,lessonId:lesson.id,variantId:lesson.id,code:'V'+lesson.number,
      title:lesson.title,variantTitle:lesson.title,minutes:lesson.minutes,goal:lesson.goal,before:lesson.before,
      concepts:lesson.concepts.map(c=>[c.term,c.explanation]),change:lesson.steps.join('\n'),
      fault:lesson.tips.join(' '),expected:lesson.criteria.join(' '),questions:lesson.questions,criteria:lesson.criteria,
      targets:['micropython'],templates:{micropython:filename},gradingSupport:{micropython:gradingSupport(key,'micropython')}});
  }
}finally{globalThis.fetch=originalFetch;}
writeFileSync(resolve(directory,'catalog.json'),JSON.stringify({format:'labosv2-school-catalog',version:1,
  sourceVersion:JSON.parse(readFileSync('package.json','utf8')).version,
  gradingSummary:gradingCoverage(JSON.parse(readFileSync('package.json','utf8')).version).summary,
  introductorySummary:gradingCoverage(JSON.parse(readFileSync('package.json','utf8')).version).introductorySummary,
  targets:Object.fromEntries(Object.entries(ursTargets).map(([key,t])=>[key,t.label])),entries},null,2)+'\n');
console.log('Školski katalog: 67 URS varijanti / 268 ciljeva te 5 zasebnih uvodnih MicroPython zadataka.');
