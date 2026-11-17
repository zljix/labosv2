import {teachingLesson} from './ursTeaching';
import {clone,parseProject,type Project} from '../project/model';
import {exportZip} from '../project/archive';
import {getUrsLesson,URS_WORK,URS_DOCUMENTS,ursMarkdown} from './ursCatalog';
import {identityText,STUDENT_NAME_LIMIT,CLASS_NAME_LIMIT} from '../project/identity';

export interface UrsWork {
 format:'esp32-lab-urs';version:1;guideVersion?:2;lessonId:string;variantId:string;student:string;group:string;answers:string[];
 observations:{baseline:string;change:string;fault:string};
 snapshot?:{sourceHash:string;recordedAt:string};
 review?:{contentHash:string;recordedAt:string;verdict:'revise'|'reviewed';note:string};
}
const isText=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
const validStamp=(v:any,key:string)=>v&&typeof v[key]==='string'&&/^[a-f0-9]{64}$/.test(v[key])&&typeof v.recordedAt==='string'&&Number.isFinite(Date.parse(v.recordedAt));
export function readUrsWork(p:Project):UrsWork|undefined {
 try{
  const w=JSON.parse(p.files[URS_WORK]??'null'),l=getUrsLesson(w?.lessonId);
  if(!l||!l.variants.some(v=>v.id===w.variantId)||w.format!=='esp32-lab-urs'||w.version!==1||!identityText(w.student,STUDENT_NAME_LIMIT)||!identityText(w.group,CLASS_NAME_LIMIT)||!Array.isArray(w.answers)||w.answers.length!==l.questions.length||w.answers.some((a:unknown)=>!isText(a,2000))||!w.observations||['baseline','change','fault'].some(k=>!isText(w.observations[k],3000)))return;
  if(w.guideVersion!==undefined&&w.guideVersion!==2)return;
  if(w.snapshot&&!validStamp(w.snapshot,'sourceHash'))return;
  if(w.review&&(!validStamp(w.review,'contentHash')||!['revise','reviewed'].includes(w.review.verdict)||!isText(w.review.note,3000)))return;
  return {format:'esp32-lab-urs',version:1,...(w.guideVersion===2?{guideVersion:2 as const}:{}),lessonId:l.id,variantId:w.variantId,student:w.student,group:w.group,answers:[...w.answers],observations:{baseline:w.observations.baseline,change:w.observations.change,fault:w.observations.fault},...(w.snapshot?{snapshot:{sourceHash:w.snapshot.sourceHash,recordedAt:w.snapshot.recordedAt}}:{}),...(w.review?{review:{contentHash:w.review.contentHash,recordedAt:w.review.recordedAt,verdict:w.review.verdict,note:w.review.note}}:{})};
 }catch{return;}
}
function nodeValue(p:Project):unknown {
 return {board:p.board,language:p.language,runtimeProfile:p.runtimeProfile,entryFile:p.entryFile,target:p.target,circuit:p.circuit,files:Object.entries(p.files).filter(([name])=>!URS_DOCUMENTS.has(name)).sort(([a],[b])=>a.localeCompare(b)),...(p.radio?{peer:nodeValue(p.radio.peer)}:{})};
}
async function digest(value:unknown){const bytes=new TextEncoder().encode(JSON.stringify(value));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function ursSourceHash(p:Project){const w=readUrsWork(p);return digest({lesson:w?.lessonId,variant:w?.variantId,project:nodeValue(p)});}
export async function ursContentHash(p:Project){const w=readUrsWork(p);return digest({source:await ursSourceHash(p),student:w?.student,group:w?.group,answers:w?.answers,observations:w?.observations,...(w?.guideVersion?{guideVersion:w.guideVersion}:{})});}
export async function recordUrsSnapshot(p:Project):Promise<UrsWork>{
 const w=readUrsWork(p);if(!w)throw Error('Projekt nema valjan URS radni list.');
 if(Object.values(w.observations).some(t=>!t.trim()))throw Error('Najprije zapiši početni pokus, promjenu i pokus pogreške s oporavkom.');
 return {...w,snapshot:{sourceHash:await ursSourceHash(p),recordedAt:new Date().toISOString()}};
}
export async function recordUrsReview(p:Project,verdict:'revise'|'reviewed',note:string):Promise<UrsWork>{
 const w=readUrsWork(p);if(!w)throw Error('Projekt nema valjan URS radni list.');
 if(!note.trim()||note.length>3000)throw Error('Upiši nastavničko opažanje pregleda (do 3000 znakova).');
 return {...w,review:{contentHash:await ursContentHash(p),recordedAt:new Date().toISOString(),verdict,note}};
}
export async function ursSubmissionProject(project:Project):Promise<Project>{
 const p=clone(project),w=readUrsWork(p),l=w&&getUrsLesson(w.lessonId),variant=l?.variants.find(v=>v.id===w?.variantId);
 if(!w||!l||!variant)throw Error('Projekt nema valjan URS radni list.');
 if(w.student.trim().length<3||!w.group.trim())throw Error('Upiši ime i prezime te razred ili grupu.');
 if(w.answers.some(a=>!a.trim())||Object.values(w.observations).some(a=>!a.trim()))throw Error('Odgovori na sva pitanja i upiši sva tri opažanja; možeš opisati i neuspješan pokus.');
 const hash=await ursSourceHash(p);
 if(!w.snapshot||w.snapshot.sourceHash!==hash)throw Error('Zabilježi novi pregled trenutačnog programa i sklopa prije predaje.');
 const reviewFresh=w.review?.contentHash===await ursContentHash(p);
 p.files['urs-upute.md']=ursMarkdown(l,variant,p);
 const teaching=teachingLesson(l,variant.id,w.guideVersion);
 p.files['urs-predaja.md']=[`# URS${String(l.number).padStart(2,'0')} · ${l.title}`,`Varijanta: ${variant.title}\nUčenik: ${w.student}\nRazred/grupa: ${w.group}`,`Pripremljeno: ${new Date().toISOString()}\nSHA-256 programa i sklopa obaju čvorova: ${hash}\nKorisnik zabilježio pregled: ${w.snapshot.recordedAt}`,'Opažanja i pregled sadržaja unio je korisnik. Ovo nije automatska provjera ponašanja, ocjena ni potvrda autorstva. Hash otkriva promjenu sadržaja u odnosu na zapis, ali nije zaštita od krivotvorenja. Nastavnik treba izričito ponovno pokrenuti program.','## Opažanja',...Object.entries(w.observations).map(([key,value])=>`### ${{baseline:'Početni pokus',change:'Promjena',fault:'Pogreška i oporavak'}[key]}\n\n${value}`),'## Odgovori',...teaching.questions.map((q,i)=>`### ${i+1}. ${q}\n\n${w.answers[i]}`),'## Nastavnički zapis',w.review?`${reviewFresh?'Podudara se s trenutačnim sadržajem':'ZASTARJELO: sadržaj se promijenio nakon pregleda'} · ${w.review.verdict==='reviewed'?'Pregledano':'Potrebna dorada'}\n${w.review.recordedAt}\n\n${w.review.note}`:'Nema nastavničkog zapisa.','Paket se otvara kao zaustavljena kopija. URS upute dolaze iz ugrađenog kataloga; sadržaj uvezenih uputa i preglednih zapisa ne izvršava se. SD i RTC sadrže samo izričito spremljene snimke.'].join('\n\n')+'\n';
 return parseProject(p);
}
export async function exportUrsSubmission(p:Project){return exportZip(await ursSubmissionProject(p));}
