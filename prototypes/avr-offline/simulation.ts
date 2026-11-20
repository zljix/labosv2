import {validateResult} from './compiler.mjs';
import {AVREEPROM,EEPROMMemoryBackend} from 'avr8js';
import {AVREngine} from '../../src/runtime/avrEngine';
import {compileCircuit} from '../../src/circuit/compile';
import {arduinoExampleProject} from '../../src/runtime/arduinoExamples';
import {UNO,NANO} from '../../src/boards/profiles';
import {validateProjectResult} from './project-bridge';

export async function simulate(input:any,result:any,imported?:unknown,durationMs=1200) {
  if(![1200,3000,5000].includes(durationMs))throw Error('Trajanje simulacije mora biti 1,2, 3 ili 5 sekundi.');
  await validateResult(input,result);
  const project=imported===undefined?arduinoExampleProject('blink',input.board==='nano'?NANO:UNO):await validateProjectResult(imported,input,result), events:any[]=[];
  if(!project.settings.powered||project.settings.swapped)throw Error('Za ovu prototipnu provjeru uključi napajanje i ispravno spoji napajanje u izvornom projektu.');
  const engine=new AVREngine(result.hex,compileCircuit(project.circuit as any,'avr'),e=>events.push(e),input.board==='nano'?8:6,result.staticRamBytes);
  // Prototype-local EEPROM model: erased on every independent simulation.
  new AVREEPROM(engine.cpu,new EEPROMMemoryBackend(1024));
  try {
    // Bounded virtual time; longer sensor startup must not be silently skipped.
    for(let ms=0;ms<durationMs;ms+=4){engine.runCycles(64000);engine.frame();}
    const frames=events.filter(e=>e.type==='simulation');
    return {durationMs,serial:events.filter(e=>e.type==='console').map(e=>e.text).join(''),samples:frames.map((e,i)=>({ms:i*4,level:e.gpios?.['13']?.level??0,ledCurrentMa:e.leds?.led1?.currentMa??0})),lastFrame:frames.at(-1),faults:events.filter(e=>e.type==='error'),projectId:imported===undefined?null:project.id};
  }finally{engine.dispose();}
}
