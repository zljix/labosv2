import {useEffect,useRef,useState} from 'react';
import {appAsset} from './assets';
import {parseProject,forkProject,type Project} from '../project/model';
import {readWork,WORK_FILE} from '../lessons/catalog';
import {readUrsWork} from '../lessons/ursWork';
import {SchoolApi,prepareSchoolAttempt,readSchoolBinding,type SchoolBinding} from './schoolSync';
import SchoolWork from './SchoolWork';
import {URS_WORK} from '../lessons/ursCatalog';

export const SCHOOL_TASK_FILE='school-assignment.json';
export function readSchoolAssignment(project:Project):any|undefined {
  try{
    const raw=project.files[SCHOOL_TASK_FILE];if(!raw||raw.length>65536)return;
    const value=JSON.parse(raw),a=value?.assignment,d=a?.task?.definition,r=a?.task?.rubric;
    if(value.format!=='labosv2-assignment-copy'||value.version!==1||!Number.isSafeInteger(a?.id)||a.id<1
      ||typeof a.className!=='string'||a.className.length>80||!Number.isSafeInteger(a.task?.version)||a.task.version<1
      ||!d||['title','code','goal','before','change','fault'].some(k=>typeof d[k]!=='string'||d[k].length>6000)
      ||(d.teacherNotes!==undefined&&(typeof d.teacherNotes!=='string'||d.teacherNotes.length>6000))
      ||!Array.isArray(r?.criteria)||r.criteria.length>12||r.criteria.some((c:any)=>!c||typeof c.description!=='string'||c.description.length>400
        ||(c.maxPoints!==null&&(!Number.isSafeInteger(c.maxPoints)||c.maxPoints<1||c.maxPoints>100))))return;
    return a;
  }catch{return;}
}
export function prepareSchoolAssignment(assignment:any,user:any):Project {
  if(!Number.isSafeInteger(assignment?.id)||!assignment.task?.definition||!Number.isSafeInteger(user?.id))throw Error('Školski zadatak nije valjan.');
  const p=forkProject(parseProject(assignment.starter),' — školska kopija');
  const {starter,...record}=assignment;
  p.files[SCHOOL_TASK_FILE]=JSON.stringify({format:'labosv2-assignment-copy',version:1,assignment:record},null,2);
  const work=readUrsWork(p);
  if(work){work.student=String(user.displayName).slice(0,100);work.group=String(assignment.className).slice(0,40);p.files[URS_WORK]=JSON.stringify(work,null,2);}
  const intro=readWork(p);
  if(intro){intro.student=String(user.displayName).slice(0,100);intro.group=String(assignment.className).slice(0,40);p.files[WORK_FILE]=JSON.stringify(intro,null,2);}
  return parseProject(p);
}

export default function SchoolAssignment({project,open,confirm}:{project:Project;open:(p:Project)=>Promise<void>;confirm:(binding:SchoolBinding)=>void}) {
  const once=useRef(false),[status,setStatus]=useState('');
  useEffect(()=>{
    if(once.current)return;once.current=true;
    const id=new URL(location.href).searchParams.get('schoolAssignment');if(!id)return;
    if(!/^[1-9][0-9]{0,14}$/.test(id)){setStatus('Oznaka školske vježbe nije valjana.');return;}
    setStatus('Otvaram dodijeljenu školsku vježbu…');
    void(async()=>{
      try{
        const api=new SchoolApi();const session=await api.session();
        let next:Project;
        if(session.user.role==='student'&&session.features?.centralStorage){
          next=await prepareSchoolAttempt(await api.request('begin-attempt',{assignmentId:Number(id)}));
        }else{const state=await api.request('assignment&id='+id);next=prepareSchoolAssignment(state.assignment,state.user);}
        await open(next);setStatus('');
        const url=new URL(location.href);url.searchParams.delete('schoolAssignment');history.replaceState(history.state,'',url);
      }catch(error){setStatus((error as Error).message||'Školska vježba nije dostupna.');}
    })();
  },[]);
  const a=readSchoolAssignment(project);
  const d=a?.task?.definition,r=a?.task?.rubric;
  return <><SchoolWork key={project.id} project={project} open={open} confirm={confirm}/>{status&&<div className="notice" role="status">{status} <a href={appAsset('school.html#account')}>Školski račun i vježbe</a></div>}
    {d&&typeof d.title==='string'&&Array.isArray(r?.criteria)&&<details className="school-task-notice"><summary>Školska kopija · {String(a.className)} · {String(d.code)} · inačica {String(a.task.version)}</summary>
      <p>{String(d.goal)}</p>{r.instructions&&<p><b>{String(r.title)}:</b> {String(r.instructions)}</p>}<p><b>Prije početka:</b> {String(d.before)}</p>
      {d.teacherNotes&&<p><b>Uputa nastavnika:</b> {String(d.teacherNotes)}</p>}
      <p><b>Promjena:</b> {String(d.change)}</p><p><b>Kvar i oporavak:</b> {String(d.fault)}</p>
      <ul>{r.criteria.map((c:any,i:number)=><li key={i}>{String(c.description)}{c.maxPoints!==null?' · najviše '+String(c.maxPoints)+' bodova':''}</li>)}</ul>
      <p>{readSchoolBinding(project)?'Rad je povezan sa školskim pokušajem. Stanje središnjeg spremanja i završetak prikazani su iznad.':'Ovo je zasebna lokalna kopija. Prenosiš je ZIP/JSON izvozom.'} Objavljeni automatski kriteriji, ako postoje, prikazuju se uz školski pokušaj.</p>
      <a href={appAsset('school.html#school-work')}>Pregled mojih dodijeljenih vježbi</a>
    </details>}</>;
}
