import {sha256} from '../../public/avr-contract.mjs';
import {buildFile,inputHash,validateArtifact,buildInput,memoryDescription} from '../../public/arduino-contract.mjs';
import {clone,parseProject,type Project} from '../project/model';
import {identityText,STUDENT_NAME_LIMIT,CLASS_NAME_LIMIT} from '../project/identity';
const CACHE='esp32-lab-avr-cache-v2';
const memoryBuilds=new Map<string,any>();
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export interface BuildDiagnostic {file:string;line:number;column:number;severity:string;message:string}
export async function rememberBuild(project:Project,artifact:any,storage?:StorageLike){
  await validateArtifact(project,artifact);
  if(!storage){const input=await inputHash(project);memoryBuilds.delete(input);memoryBuilds.set(input,artifact);while(memoryBuilds.size>6)memoryBuilds.delete(memoryBuilds.keys().next().value!);}
  try{storage??=localStorage;let rows:any[]=[];try{rows=JSON.parse(storage.getItem(CACHE)??'[]');if(!Array.isArray(rows))rows=[];}catch{}const hash=await inputHash(project);rows=rows.filter(x=>x?.inputHash!==hash);rows.push(artifact);storage.setItem(CACHE,JSON.stringify(rows.slice(-6)));}catch{/* A full browser cache does not invalidate a compiled project. */}
}
export async function cachedBuild(project:Project,storage?:StorageLike){
  try{const hash=await inputHash(project);if(!storage&&memoryBuilds.has(hash))return await validateArtifact(project,memoryBuilds.get(hash));storage??=localStorage;const rows=JSON.parse(storage.getItem(CACHE)??'[]');if(!Array.isArray(rows))return null;const a=rows.find(x=>x?.inputHash===hash);return a?await validateArtifact(project,a):null;}catch{return null;}
}
export function clearBuildCache(storage?:StorageLike){memoryBuilds.clear();(storage??localStorage).removeItem(CACHE);}
export function readArduinoWork(p:Project){
  try{const v=JSON.parse(p.files['arduino-predaja.json']);if(v?.format==='esp32-lab-arduino-submission'&&v.version===1&&identityText(v.student,STUDENT_NAME_LIMIT)&&identityText(v.group,CLASS_NAME_LIMIT))return {student:v.student as string,group:v.group as string,observations:String(v.observations??'').slice(0,4000)};}catch{}
  return {student:'',group:'',observations:''};
}
export async function arduinoSubmission(project:Project,work:{student:string;group:string;observations:string},consoleText:string){
  if(!work.student.trim()||!identityText(work.student.trim(),STUDENT_NAME_LIMIT)||!work.group.trim()||!identityText(work.group.trim(),CLASS_NAME_LIMIT))throw Error('Upiši ime i prezime do 120 znakova te razred/grupu do 80 znakova.');
  if(!work.observations.trim()||work.observations.length>4000)throw Error('Zapiši što program radi i što si provjerio.');
  const p=clone(parseProject(project)),artifact=await validateArtifact(p,JSON.parse(p.files[buildFile(p)]??'null'));
  const sourceCircuitHash=await sha256(JSON.stringify({input:buildInput(p),circuit:p.circuit}));
  const record={format:'esp32-lab-arduino-submission',version:1,student:work.student.trim(),group:work.group.trim(),observations:work.observations.trim(),createdAt:new Date().toISOString(),boardId:p.board.id,inputHash:artifact.inputHash,sourceCircuitHash,flashBytes:artifact.flashBytes,staticRamBytes:artifact.staticRamBytes,wasmBytes:artifact.wasmBytes};
  p.files['arduino-predaja.json']=JSON.stringify(record,null,2);
  p.files['arduino-predaja.md']=[`# Arduino predaja · ${p.title}`,`Učenik: ${record.student}\nRazred/grupa: ${record.group}`,`Pločica: ${p.board.id}\nFQBN: ${p.target.fqbn}\n${memoryDescription(artifact)}`,`SHA-256 izvora i sklopa: ${sourceCircuitHash}`,'## Učenikova opažanja',record.observations,'## Pregled nastavnika','Uvezi ovaj ZIP kao projekt, pregledaj izvor, sklop i opažanja pa izričito pokreni program. Priložen je valjan rezultat za ovaj izvor i cilj. Opažanja i serijski zapis nisu automatska provjera ni dokaz autorstva. Hash povezuje sadržaj; nije digitalni potpis.'].join('\n\n')+'\n';
  p.files['arduino-konzola.txt']=consoleText.slice(-24000);
  return parseProject(p);
}

// Inject validated output only into a run/export copy; never into a school snapshot.
export async function projectWithBuild(project:Project):Promise<Project>{
  const p=clone(project);
  if(p.language==='arduino-cpp'){
    let artifact;try{artifact=await validateArtifact(p,JSON.parse(p.files[buildFile(p)]??'null'));}catch{artifact=await cachedBuild(p);}
    if(!artifact)throw Error('Najprije prevedi program.');
    p.files[buildFile(p)]=JSON.stringify(artifact);
  }
  if(p.radio?.peer)p.radio.peer=await projectWithBuild(p.radio.peer);
  return p;
}
