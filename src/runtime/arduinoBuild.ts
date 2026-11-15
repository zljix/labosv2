import {sha256} from '../../public/avr-contract.mjs';
import {buildFile,inputHash,validateArtifact,buildInput,memoryDescription} from '../../public/arduino-contract.mjs';
import {clone,parseProject,type Project} from '../project/model';
const CACHE='esp32-lab-avr-cache-v1';
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export interface BuildDiagnostic {file:string;line:number;column:number;severity:string;message:string}
export async function rememberBuild(project:Project,artifact:any,storage?:StorageLike){
  await validateArtifact(project,artifact);
  try{storage??=localStorage;let rows:any[]=[];try{rows=JSON.parse(storage.getItem(CACHE)??'[]');if(!Array.isArray(rows))rows=[];}catch{}const hash=await inputHash(project);rows=rows.filter(x=>x?.inputHash!==hash);rows.push(artifact);storage.setItem(CACHE,JSON.stringify(rows.slice(-6)));}catch{/* A full browser cache does not invalidate a compiled project. */}
}
export async function cachedBuild(project:Project,storage?:StorageLike){
  try{storage??=localStorage;const hash=await inputHash(project),rows=JSON.parse(storage.getItem(CACHE)??'[]');if(!Array.isArray(rows))return null;const a=rows.find(x=>x?.inputHash===hash);return a?await validateArtifact(project,a):null;}catch{return null;}
}
export function clearBuildCache(storage?:StorageLike){(storage??localStorage).removeItem(CACHE);}
export function readArduinoWork(p:Project){
  try{const v=JSON.parse(p.files['arduino-predaja.json']);if(v?.format==='esp32-lab-arduino-submission'&&v.version===1)return {student:String(v.student??'').slice(0,100),group:String(v.group??'').slice(0,40),observations:String(v.observations??'').slice(0,4000)};}catch{}
  return {student:'',group:'',observations:''};
}
export async function arduinoSubmission(project:Project,work:{student:string;group:string;observations:string},consoleText:string){
  if(!work.student.trim()||work.student.trim().length>100||!work.group.trim()||work.group.trim().length>40)throw Error('Upiši ime i prezime te razred/grupu.');
  if(!work.observations.trim()||work.observations.length>4000)throw Error('Zapiši što program radi i što si provjerio.');
  const p=clone(parseProject(project)),artifact=await validateArtifact(p,JSON.parse(p.files[buildFile(p)]??'null'));
  const sourceCircuitHash=await sha256(JSON.stringify({input:buildInput(p),circuit:p.circuit}));
  const record={format:'esp32-lab-arduino-submission',version:1,student:work.student.trim(),group:work.group.trim(),observations:work.observations.trim(),createdAt:new Date().toISOString(),boardId:p.board.id,inputHash:artifact.inputHash,sourceCircuitHash,flashBytes:artifact.flashBytes,staticRamBytes:artifact.staticRamBytes,wasmBytes:artifact.wasmBytes};
  p.files['arduino-predaja.json']=JSON.stringify(record,null,2);
  p.files['arduino-predaja.md']=[`# Arduino predaja · ${p.title}`,`Učenik: ${record.student}\nRazred/grupa: ${record.group}`,`Pločica: ${p.board.id}\nFQBN: ${p.target.fqbn}\n${memoryDescription(artifact)}`,`SHA-256 izvora i sklopa: ${sourceCircuitHash}`,'## Učenikova opažanja',record.observations,'## Pregled nastavnika','Uvezi ovaj ZIP kao projekt, pregledaj izvor, sklop i opažanja pa izričito pokreni program. Priložen je valjan rezultat za ovaj izvor i cilj. Opažanja i serijski zapis nisu automatska provjera ni dokaz autorstva. Hash povezuje sadržaj; nije digitalni potpis.'].join('\n\n')+'\n';
  p.files['arduino-konzola.txt']=consoleText.slice(-24000);
  return parseProject(p);
}
