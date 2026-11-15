import {Session} from '../../public/session.mjs';
import {parseProject,type Project} from '../project/model';
import {compileCircuit,type SimulationConfig} from '../circuit/compile';
import {runtimeAvailability} from './profiles';
import {programFiles} from '../lessons/catalog';

/** Shared boundary: one validated source/circuit snapshot per session.
 * Backends own execution; the UI never interprets Arduino source as Python.
 * The AVR launcher additionally validates a source-bound compiled artifact.
 */
export interface RuntimeHandle {stop:()=>Promise<unknown>|unknown;input:(value:Record<string,unknown>)=>unknown}
export interface RunSnapshot {project:Project;source:string;files:Record<string,string>;circuit?:SimulationConfig}
export function prepareRun(input:Project):RunSnapshot {
  const project=parseProject(input),availability=runtimeAvailability(project.board.id,project.language);
  if(project.radio)throw Error('Za projekt s dva čvora otvori Dva čvora i pokreni oba programa.');
  if(!availability.available)throw Error(availability.message);
  return {project,source:project.files[project.entryFile],files:programFiles(project),
    circuit:project.circuit.kind==='editable'?compileCircuit(project.circuit,project.runtimeProfile.id==='arduino-avr'?'avr':'micropython'):undefined};
}
export function startMicroPython(snapshot:RunSnapshot,options:{factory:()=>Worker;machine:string;input:Record<string,unknown>;onEvent:(event:any)=>void}):RuntimeHandle {
  if(snapshot.project.runtimeProfile.id!=='micropython-wasm')throw Error('Izvršni adapter ne odgovara projektu.');
  return new Session(options.factory,options.machine,snapshot.source,{...options.input,...(snapshot.circuit?{circuit:snapshot.circuit}:{})},options.onEvent,snapshot.files);
}
