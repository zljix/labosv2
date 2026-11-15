import {importProject,exportZip} from '../project/archive';
import {clone,parseProject,type Project} from '../project/model';
import {getUrsLesson,targetForProject,ursTargets,URS_WORK,ursMarkdown,type UrsTarget} from './ursCatalog';
import {readUrsWork,ursSourceHash,ursContentHash,recordUrsReview,ursSubmissionProject,type UrsWork} from './ursWork';

export const REVIEW_LIMITS={files:30,records:60,totalBytes:64*1024*1024,reportBytes:512*1024};
export type ReviewVerdict='pending'|'revise'|'reviewed';
export const reviewVerdicts:Record<ReviewVerdict,string>={pending:'Na čekanju',revise:'Potrebna dorada',reviewed:'Pregledano'};
export type ReviewStamp='missing'|'stale'|'current';
export interface ReviewNote {verdict:ReviewVerdict;note:string;recordedAt?:string}
export interface ReviewRecord extends ReviewNote {contentHash:string;student:string;group:string;lessonId:string;variantId:string;target:UrsTarget;filename:string}
export interface ReviewEntry {
 contentHash:string;sourceHash:string;filename:string;project:Project;work:UrsWork;
 snapshot:ReviewStamp;embeddedReview:ReviewStamp;answered:number;observed:number;
 review:ReviewNote;origin:'local'|'imported';
}
export interface ReviewSession {entries:ReviewEntry[];waiting:ReviewRecord[];dirty:boolean;selected?:string}
export const emptyReviewSession=():ReviewSession=>({entries:[],waiting:[],dirty:false});
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const time=(v:unknown):v is string=>text(v,40)&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const blank=(n:ReviewNote)=>n.verdict==='pending'&&!n.note&&!n.recordedAt;
const sameNote=(a:ReviewNote,b:ReviewNote)=>a.verdict===b.verdict&&a.note===b.note&&a.recordedAt===b.recordedAt;
export async function inspectUrsSubmission(bytes:Uint8Array,filename:string):Promise<ReviewEntry>{
 if(!text(filename,200)||!filename.trim())throw Error('Naziv datoteke smije imati 1–200 znakova.');
 let project:Project;
 try{project=importProject(bytes,filename);}catch(e){
  if(e instanceof SyntaxError)throw Error('Projekt sadrži neispravan JSON zapis.');
  if(typeof (e as {code?:unknown})?.code==='number')throw Error('ZIP paket je oštećen ili nije valjana ZIP arhiva.');
  throw e;
 }
 const work=readUrsWork(project);
 if(!work)throw Error('Datoteka nema valjan URS radni list. Početne V1–V5 pregledaj pojedinačno.');
 const sourceHash=await ursSourceHash(project),contentHash=await ursContentHash(project);
 return {contentHash,sourceHash,filename,project,work,
  snapshot:!work.snapshot?'missing':work.snapshot.sourceHash===sourceHash?'current':'stale',
  embeddedReview:!work.review?'missing':work.review.contentHash===contentHash?'current':'stale',
  answered:work.answers.filter(a=>a.trim()).length,observed:Object.values(work.observations).filter(a=>a.trim()).length,
  review:{verdict:'pending',note:''},origin:'local'};
}
export function addReviewEntry(session:ReviewSession,entry:ReviewEntry):ReviewSession {
 if(session.entries.some(e=>e.contentHash===entry.contentHash))throw Error('Isti sadržaj već je učitan. Zadržana je prva kopija i njezina bilješka.');
 if(session.entries.length>=REVIEW_LIMITS.files)throw Error('Pregled može sadržavati najviše 30 različitih predaja.');
 const restored=session.waiting.find(r=>r.contentHash===entry.contentHash);
 if(!restored&&reviewRecords(session).length>=REVIEW_LIMITS.records)throw Error('Evidencija već ima 60 različitih zapisa. Izvezi je i započni novi pregled.');
 return {...session,entries:[...session.entries,restored?{...entry,review:noteFrom(restored),origin:'imported'}:entry],waiting:session.waiting.filter(r=>r.contentHash!==entry.contentHash),dirty:true};
}
function noteFrom(r:ReviewNote):ReviewNote{return {verdict:r.verdict,note:r.note,...(r.recordedAt?{recordedAt:r.recordedAt}:{})};}
export function editReviewNote(session:ReviewSession,contentHash:string,note:string):ReviewSession {
 if(!text(note,3000))throw Error('Bilješka smije imati najviše 3000 znakova.');
 return changeEntry(session,contentHash,e=>({...e,review:{verdict:'pending',note},origin:'local'}));
}
export function setReviewVerdict(session:ReviewSession,contentHash:string,verdict:ReviewVerdict,recordedAt=new Date().toISOString()):ReviewSession {
 if(!Object.hasOwn(reviewVerdicts,verdict)||!time(recordedAt))throw Error('Nevaljan status ili vrijeme pregleda.');
 return changeEntry(session,contentHash,e=>{
  if(verdict!=='pending'&&!e.review.note.trim())throw Error('Prije završnog zapisa upiši što si pregledao i opazio.');
  return {...e,review:{verdict,note:e.review.note,...(verdict==='pending'?{}:{recordedAt})},origin:'local'};
 });
}
function changeEntry(s:ReviewSession,id:string,fn:(e:ReviewEntry)=>ReviewEntry):ReviewSession {
 if(!s.entries.some(e=>e.contentHash===id))throw Error('Predaja više nije u pregledu.');
 return {...s,entries:s.entries.map(e=>e.contentHash===id?fn(e):e),dirty:true};
}
function entryRecord(e:ReviewEntry):ReviewRecord {
 return {contentHash:e.contentHash,student:e.work.student,group:e.work.group,lessonId:e.work.lessonId,variantId:e.work.variantId,target:targetForProject(e.project),filename:e.filename,...noteFrom(e.review)};
}
export function reviewRecords(s:ReviewSession):ReviewRecord[]{return [...s.entries.map(entryRecord),...s.waiting.filter(r=>!s.entries.some(e=>e.contentHash===r.contentHash))];}
export function exportReviewReport(s:ReviewSession,appVersion:string,recordedAt=new Date().toISOString()):string {
 const records=reviewRecords(s);
 if(!records.length)throw Error('Najprije učitaj predaje ili evidenciju.');
 // Use the same validation on export and import; local notes cannot escape limits.
 const result={format:'esp32-lab-class-review',version:1,appVersion,recordedAt,records};
 importReviewReport(JSON.stringify(result));
 return JSON.stringify(result,null,2)+'\n';
}
export function importReviewReport(value:string):ReviewRecord[]{
 if(typeof value!=='string'||new TextEncoder().encode(value).length>REVIEW_LIMITS.reportBytes)throw Error('Evidencija smije imati najviše 512 KiB.');
 let data;try{data=JSON.parse(value);}catch{throw Error('Evidencija nije valjan JSON.');}
 if(!data||data.format!=='esp32-lab-class-review'||data.version!==1||!text(data.appVersion,80)||!time(data.recordedAt)||!Array.isArray(data.records)||!data.records.length||data.records.length>REVIEW_LIMITS.records)throw Error('Nepodržan format evidencije ili broj zapisa (1–60).');
 const seen=new Set<string>();
 return data.records.map((r:any)=>{
  const lesson=getUrsLesson(r?.lessonId);
  if(!r||!hash(r.contentHash)||seen.has(r.contentHash)||!text(r.student,100)||!text(r.group,40)||!lesson||!lesson.variants.some(v=>v.id===r.variantId)||typeof r.target!=='string'||!Object.hasOwn(ursTargets,r.target)||!text(r.filename,200)||!r.filename.trim()||typeof r.verdict!=='string'||!Object.hasOwn(reviewVerdicts,r.verdict)||!text(r.note,3000)||r.recordedAt!==undefined&&!time(r.recordedAt)||r.verdict!=='pending'&&(!r.note.trim()||!r.recordedAt))throw Error('Evidencija sadrži nevaljan, nepotpun ili dvostruk zapis.');
  seen.add(r.contentHash);
  return {contentHash:r.contentHash,student:r.student,group:r.group,lessonId:lesson.id,variantId:r.variantId,target:r.target,filename:r.filename,...noteFrom(r)};
 });
}
export function restoreReviewReport(s:ReviewSession,records:ReviewRecord[]):{session:ReviewSession;conflicts:string[]} {
 // Restoring is content-bound. A filename or a pupil name never selects a project.
 let entries=[...s.entries],waiting=[...s.waiting];const conflicts:string[]=[];
 for(const record of records){
  const entry=entries.find(e=>e.contentHash===record.contentHash),old=waiting.find(r=>r.contentHash===record.contentHash);
  if(entry){
   if(!blank(entry.review)&&!sameNote(entry.review,record)){conflicts.push(entry.filename);continue;}
   entries=entries.map(e=>e===entry?{...e,review:noteFrom(record),origin:'imported'}:e);
  }else if(old){
   if(!sameNote(old,record))conflicts.push(old.filename);
  }else waiting.push(record);
 }
 if(reviewRecords({entries,waiting,dirty:true}).length>REVIEW_LIMITS.records)throw Error('Evidencija može sadržavati najviše 60 različitih zapisa. Izvezi postojeći pregled i započni novi.');
 return {session:{...s,entries,waiting,dirty:true},conflicts};
}
export function reviewCSV(s:ReviewSession):string {
 const cell=(value:string)=>'"'+((/^[\s\uFEFF]*[=+@-]/.test(value)||/^[\t\r\n]/.test(value))?"'"+value:value).replaceAll('"','""')+'"';
 const header=['Učenik','Razred / grupa','Vježba','Varijanta','Cilj','Datoteka','Odgovori','Opažanja','Pregled programa i sklopa','Nastavnički status','Bilješka','Vrijeme zapisa','SHA-256 sadržaja','Izvor zapisa'];
 const rows=reviewRecords(s).map(r=>{
  const e=s.entries.find(x=>x.contentHash===r.contentHash),l=getUrsLesson(r.lessonId)!;
  return [r.student,r.group,'URS'+String(l.number).padStart(2,'0')+' · '+l.title,l.variants.find(v=>v.id===r.variantId)!.title,ursTargets[r.target].label,r.filename,e?e.answered+'/'+e.work.answers.length:'Predaja nije učitana',e?e.observed+'/3':'Predaja nije učitana',e?({current:'Podudara se',missing:'Nedostaje',stale:'Promijenjen sadržaj'}[e.snapshot]):'Nije uspoređeno',reviewVerdicts[r.verdict],r.note,r.recordedAt??'',r.contentHash,e?.origin==='local'?'Ručni zapis ovog pregleda':'Uvezeni ručni zapis'];
 });
 return '\ufeff'+[header,...rows].map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
export async function reviewedProject(entry:ReviewEntry):Promise<Project>{
 if(entry.review.verdict==='pending'||!entry.review.recordedAt)throw Error('Najprije zabilježi nastavnički status i bilješku.');
 if(await ursContentHash(entry.project)!==entry.contentHash)throw Error('Sadržaj predaje promijenio se nakon učitavanja. Ponovno učitaj projekt.');
 const p=clone(entry.project),w=await recordUrsReview(p,entry.review.verdict,entry.review.note);
 w.review!.recordedAt=entry.review.recordedAt;
 p.files[URS_WORK]=JSON.stringify(w,null,2);
 const lesson=getUrsLesson(w.lessonId)!;
 p.files['urs-upute.md']=ursMarkdown(lesson,lesson.variants.find(v=>v.id===w.variantId)!,p);
 // An incomplete or stale imported project still carries feedback, without an old summary.
 delete p.files['urs-predaja.md'];
 if(w.student.trim().length>=3&&w.group.trim()&&entry.answered===w.answers.length&&entry.observed===3&&entry.snapshot==='current')return ursSubmissionProject(p);
 return parseProject(p);
}
export async function exportReviewedProject(entry:ReviewEntry){return exportZip(await reviewedProject(entry));}
