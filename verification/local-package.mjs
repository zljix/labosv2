import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
const path=process.argv[2];if(!path)throw Error('Navedi lokalni isporučni ZIP.');
const zip=readFileSync(path),entries=unzipSync(zip),folder=await mkdtemp(join(tmpdir(),'lab-local-release-'));
let server;
try{
 for(const [name,bytes] of Object.entries(entries)){assert(!name.startsWith('/')&&!name.split('/').includes('..'));const dest=join(folder,name);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes);}
 server=spawn(process.execPath,['start-local.mjs'],{cwd:folder,env:{...process.env,LAB_LOCAL_PORT:'0'},stdio:['ignore','pipe','pipe']});
 const origin=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Lokalni server nije odgovorio.')),10000);server.on('error',e=>{clearTimeout(timer);reject(e);});server.stdout.on('data',chunk=>{text+=chunk;const m=text.match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);resolve(m[0]);}});server.stderr.on('data',chunk=>{clearTimeout(timer);reject(Error(String(chunk)));});});
 assert.equal((await fetch(origin+'/')).status,200);
 const manifest=await(await fetch(origin+'/offline-package.json')).json();let count=0,bytes=0,wasm=0;
 for(const file of manifest.files){const response=await fetch(origin+file.url),data=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200,file.url);assert.equal(data.length,file.bytes,file.url);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,file.url);if(file.url.endsWith('.wasm')){assert.equal(response.headers.get('content-type'),'application/wasm');wasm++;}count++;bytes+=data.length;}
 assert(wasm>0);const report={version:manifest.version,build:manifest.build,resourceCount:count,resourceBytes:bytes,wasmMimeChecks:wasm,zipBytes:zip.length,zipSha256:createHash('sha256').update(zip).digest('hex'),status:'pass',scope:'ZIP extraction, real loopback HTTP delivery, complete resource sizes/hashes and WASM MIME. Not a cold offline browser test.'};
 const dir=process.env.LAB_PACKAGE_EVIDENCE_DIR??'docs/stage18b-evidence';mkdirSync(dir,{recursive:true});writeFileSync(dir+'/local-package.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{if(server&&server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}await rm(folder,{recursive:true,force:true});}
