import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {radioNodeProject} from '../src/radio/examples';
import {compileProject} from './avr-compile.mjs';
import {compileS3} from './s3-compile.mjs';
import {validateArtifact} from '../public/arduino-contract.mjs';
const old=existsSync('public/radio-examples.json')?JSON.parse(readFileSync('public/radio-examples.json','utf8')):{},out:any={};
for(const target of ['uno','nano','s3-cpp']as const){out[target]={};for(const role of ['tx','rx']as const){const p=radioNodeProject(target,role);let artifact;try{artifact=await validateArtifact(p,old[target]?.[role]);}catch{artifact=target==='s3-cpp'?await compileS3(p):await compileProject(p);}out[target][role]=artifact;console.log(target,role,artifact.flashBytes??artifact.wasmBytes,artifact.staticRamBytes??'functional');}}
writeFileSync('public/radio-examples.json',JSON.stringify(out)+'\n');
