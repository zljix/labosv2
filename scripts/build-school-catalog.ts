import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ursLessons,ursTargets,variantAvailable,createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import {parseProject,type Project} from '../src/project/model';

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
  for(const lesson of ursLessons)for(const variant of lesson.variants){
    const targets=Object.keys(ursTargets).filter(t=>variantAvailable(variant,t as UrsTarget)) as UrsTarget[];
    const key=lesson.id+'/'+variant.id,templates:Record<string,string>={};
    for(const target of targets){
      const project=stable(await createUrsProject(lesson.id,variant.id,target),key+'/'+target);
      const filename=lesson.id+'-'+variant.id+'-'+target+'.json';
      writeFileSync(resolve(directory,filename),JSON.stringify(project));templates[target]=filename;
    }
    entries.push({key,lessonId:lesson.id,variantId:variant.id,code:'URS'+String(lesson.number).padStart(2,'0'),
      title:lesson.title,variantTitle:variant.title,minutes:lesson.minutes,goal:lesson.goal,before:lesson.before,
      concepts:lesson.concepts,change:lesson.change,fault:lesson.fault,expected:lesson.expected,
      questions:lesson.questions,criteria:lesson.criteria,targets,templates});
  }
}finally{globalThis.fetch=originalFetch;}
writeFileSync(resolve(directory,'catalog.json'),JSON.stringify({format:'labosv2-school-catalog',version:1,
  sourceVersion:JSON.parse(readFileSync('package.json','utf8')).version,
  targets:Object.fromEntries(Object.entries(ursTargets).map(([key,t])=>[key,t.label])),entries},null,2)+'\n');
console.log(`Školski katalog: ${entries.length} varijanti, ${entries.reduce((n,e)=>n+e.targets.length,0)} zamrznutih predložaka.`);
