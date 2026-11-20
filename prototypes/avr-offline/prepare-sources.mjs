// Optional build-time source mirror. Copies no executable into the application.
// Every archive in the pinned upstream recipe is retained so that recipe can
// be rerun, including its original (broader) SDK before our board reduction.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),out=resolve(here,'../../.build/avr-corresponding-sources');
const upstream=JSON.parse(await readFile(here+'/upstream-manifest.json','utf8'));
await mkdir(out+'/sources',{recursive:true});
const records=[];
for(const line of (await readFile(here+'/upstream-sources.txt','utf8')).split('\n')){
  if(!line.trim()||line.startsWith('#'))continue;
  const [name,sourceURL,sha256]=line.split(/\s+/);
  if(!/^[A-Za-z0-9_.-]+$/.test(name)||!/^[a-f0-9]{64}$/.test(sha256))throw Error('Invalid source inventory');
  const path=out+'/sources/'+name,hash=async()=>createHash('sha256').update(await readFile(path)).digest('hex');
  let valid=false;try{valid=await hash()===sha256;}catch{}
  if(!valid){
    console.log('Source:',name);
    const result=spawnSync('curl',['-fsSL','--retry','2','--max-time','180',`https://github.com/pcbkit-io/toolchain/releases/download/${upstream.id}/${name}`,'-o',path],{stdio:'inherit'});
    if(result.status!==0||await hash()!==sha256)throw Error('Source integrity: '+name);
  }
  records.push({name,sourceURL,sha256,bytes:(await readFile(path)).length});
}
const recipe=JSON.parse(await readFile(here+'/upstream-recipe.json','utf8'));
for(const item of recipe.files){
  const path=out+'/'+item.name,hash=async()=>createHash('sha256').update(await readFile(path)).digest('hex');
  let valid=false;try{valid=await hash()===item.sha256;}catch{}
  if(!valid){
    const result=spawnSync('curl',['-fsSL','--retry','2','--max-time','60',item.url,'-o',path],{stdio:'inherit'});
    if(result.status!==0||await hash()!==item.sha256)throw Error('Recipe integrity: '+item.name);
  }
}
await copyFile(here+'/upstream-sources.txt',out+'/sources.txt');
await copyFile(here+'/build-sdk.mjs',out+'/labos-build-sdk.mjs');
await copyFile(here+'/core-build-manifest.json',out+'/labos-core-build-manifest.json');
await writeFile(out+'/manifest.json',JSON.stringify({recipeCommit:'58a15c764b5f0b3b8ac9134ec040a552c35b59ce',release:upstream.id,recipeFiles:recipe.files,records},null,2)+'\n');
console.log('Verified source mirror:',out);
