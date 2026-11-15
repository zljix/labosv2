import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {arduinoExampleProject,arduinoExamples} from '../src/runtime/arduinoExamples';
import {UNO,NANO} from '../src/boards/profiles';
import {compileProject} from './avr-compile.mjs';
import {validateArtifact} from '../public/avr-contract.mjs';
const previous=existsSync('public/avr-examples.json')?JSON.parse(readFileSync('public/avr-examples.json','utf8')):{};
const result:Record<string,Record<string,unknown>>={};
for(const board of [UNO,NANO]){
  result[board]={};
  for(const key of Object.keys(arduinoExamples) as (keyof typeof arduinoExamples)[]){
    const project=arduinoExampleProject(key,board);let artifact;try{artifact=await validateArtifact(project,previous[board]?.[key]);}catch{artifact=await compileProject(project);}result[board][key]=artifact;
    console.log(board,key,artifact.flashBytes,artifact.staticRamBytes);
  }
}
writeFileSync('public/avr-examples.json',JSON.stringify(result)+'\n');
