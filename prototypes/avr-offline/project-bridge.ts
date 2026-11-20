import {parseProject,clone,type Project} from '../../src/project/model';
import {UNO,NANO} from '../../src/boards/profiles';
import {buildInput,libraryManifest,AVR_LIBRARY_FILE} from '../../public/avr-contract.mjs';
import {normalizeInput,fingerprint,validateResult} from './compiler.mjs';

export const BUNDLE_FORMAT='labos-avr-offline-project';
export const IMPORT_LIMIT=2*1024*1024;

// Reuse the real project/path/library validation, but never label this compiler
// as Arduino CLI 7.3 or write its output into avr-build.json.
export function projectInput(value:unknown){
  const project=parseProject(value);
  if(project.radio)throw Error('Prototip još ne podržava projekte s dva čvora.');
  if(project.language!=='arduino-cpp'||(project.board.id!==UNO&&project.board.id!==NANO))throw Error('Uvezi Arduino C/C++ projekt za Uno ili klasični Nano.');
  const source=buildInput(project);
  return {project,input:normalizeInput({board:project.board.id===NANO?'nano':'uno',files:source.files,libraries:source.toolchain.libraries})};
}

export function updateProject(value:unknown,input:any):Project{
  const current=projectInput(value),normalized=normalizeInput(input);
  if(normalized.board!==current.input.board)throw Error('Pločica uvezenog projekta ne može se promijeniti bez prilagodbe sklopa.');
  if(JSON.stringify(normalized)===JSON.stringify(current.input))return clone(current.project);
  const next=clone(current.project);
  for(const name of Object.keys(current.input.files))delete next.files[name];
  Object.assign(next.files,normalized.files);
  if(JSON.stringify(normalized.libraries)!==JSON.stringify(current.input.libraries))next.files[AVR_LIBRARY_FILE]=libraryManifest(normalized.libraries);
  if(!Object.hasOwn(next.files,next.settings.activeFile))next.settings.activeFile='main.ino';
  next.revision++;next.updatedAt=new Date().toISOString();
  // Existing build/submission files remain byte-for-byte intact. Their own
  // validators reject stale source hashes; this adapter does not certify them.
  return parseProject(next);
}

export async function validateProjectResult(value:unknown,input:any,result:any){
  const {project,input:expected}=projectInput(value);
  if(await fingerprint(expected)!==await fingerprint(input))throw Error('Izvor ili pločica ne odgovaraju uvezenom projektu.');
  await validateResult(expected,result);
  return project;
}

export async function projectBundle(value:unknown,result:any){
  const {project,input}=projectInput(value);
  await validateResult(input,result);
  return {format:BUNDLE_FORMAT,version:1,project:clone(project),result:structuredClone(result)};
}

export async function readProject(text:string){
  if(new TextEncoder().encode(text).length>IMPORT_LIMIT)throw Error('Projekt JSON prelazi 2 MiB.');
  let value;try{value=JSON.parse(text);}catch{throw Error('Datoteka nije valjan JSON projekt.');}
  if(value?.format===BUNDLE_FORMAT){
    if(value.version!==1)throw Error('Nepodržana inačica prototipnog projekta.');
    const parsed=projectInput(value.project);
    await validateResult(parsed.input,value.result);
    return {...parsed,result:value.result};
  }
  return {...projectInput(value),result:null};
}
