import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {s3Examples,s3ExampleProject,type S3Example} from '../src/runtime/s3Examples';
import {compileS3} from './s3-compile.mjs';
import {validateArtifact} from '../public/s3-contract.mjs';
const previous=existsSync('public/s3-examples.json')?JSON.parse(readFileSync('public/s3-examples.json','utf8')):{};
const artifacts:Record<string,any>={};
for(const key of Object.keys(s3Examples) as S3Example[]){const p=s3ExampleProject(key);let a;try{a=await validateArtifact(p,previous[key]);}catch{a=await compileS3(p);}artifacts[key]=a;console.log(key+': '+a.wasmBytes+' B WASM');}
writeFileSync('public/s3-examples.json',JSON.stringify(artifacts,null,2)+'\n');
