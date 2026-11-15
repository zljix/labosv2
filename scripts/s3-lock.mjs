import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const files={};
async function walk(root){for(const e of (await readdir(root,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=root+'/'+e.name;if(e.isDirectory())await walk(p);else files[p]=createHash('sha256').update(await readFile(p)).digest('hex');}}
await walk('runtime/arduino-s3');
const digest=createHash('sha256').update(JSON.stringify(files)).digest('hex');
await writeFile('public/s3-core-lock.mjs',`// Generated core provenance. MIT. Rebuild with node scripts/s3-lock.mjs.\nexport const S3_CORE_FILES=${JSON.stringify(files)};\nexport const S3_CORE_DIGEST='${digest}';\n`);
console.log('S3 functional core SHA-256: '+digest);
