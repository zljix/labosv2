import {buildShell} from './build-shell.mjs';
import {readFile,writeFile,mkdir,copyFile,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {buildSDK,CORE_SOURCE} from './build-sdk.mjs';
import {buildDistribution} from './distribution.mjs';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..');
const output=resolve(root,'.build/avr-offline'), assets=resolve(root,'.build/avr-toolchain');
await mkdir(output+'/toolchain',{recursive:true});await mkdir(assets,{recursive:true});
const upstream=JSON.parse(await readFile(here+'/upstream-manifest.json','utf8'));
const names=Object.keys(upstream.files).filter(n=>n!=='ctags.js');
const packed={};
for(const name of names){
  const metadata=upstream.files[name], path=assets+'/'+name;
  let valid=false;
  try{const bytes=await readFile(path);valid=bytes.length===metadata.bytes&&createHash('sha256').update(bytes).digest('hex')===metadata.sha256;}catch{}
  if(!valid){
    console.log('Download:',name);
    // curl respects the workspace network proxy; source and digest are pinned.
    const r=spawnSync('curl',['-fsSL','--retry','2','--max-time','120','https://github.com/pcbkit-io/toolchain/releases/download/'+upstream.id+'/'+name,'-o',path+'.part'],{stdio:'inherit'});
    if(r.status!==0)throw Error('Download failed: '+name);
    const bytes=await readFile(path+'.part');
    if(bytes.length!==metadata.bytes||createHash('sha256').update(bytes).digest('hex')!==metadata.sha256)throw Error('Integrity failed: '+name);
    await writeFile(path,bytes);
  }
}
const runtime=await buildSDK({assets,here,upstream});
for(const name of Object.keys(runtime.files)){
  const path=assets+'/'+name;
  // The distributable only needs compressed bytes. Keep the raw build cache
  // in .build/avr-toolchain, not a second public copy in the application.
  await unlink(output+'/toolchain/'+name).catch(e=>{if(e.code!=='ENOENT')throw e;});
  const compressed=gzipSync(await readFile(path),{level:9});
  await writeFile(output+'/toolchain/'+name+'.gz',compressed);
  packed[name]={bytes:compressed.length};
}
for(const name of await readdir(output+'/toolchain')){
  if(/^sdk(?:-uno-nano(?:-[a-f0-9]{16})?)?\.bin(?:\.gz)?$/.test(name)&&name!==runtime.sdkFile+'.gz')await unlink(output+'/toolchain/'+name);
}
await writeFile(here+'/packed-manifest.json',JSON.stringify(packed,null,2)+'\n');
// Notices and licences are fetched from the exact upstream release, outside the app bundle.
const licenses=JSON.parse(await readFile(here+'/license-manifest.json','utf8'));
for(const name of Object.keys(licenses.files)){
  const path=assets+'/'+name;
  const expected=licenses.files[name];
  const valid=async()=>{const b=await readFile(path);return b.length===expected.bytes&&createHash('sha256').update(b).digest('hex')===expected.sha256;};
  try{if(!await valid())throw Error('License integrity');}catch{
    const r=spawnSync('curl',['-fsSL','--retry','2','--max-time','60','https://github.com/pcbkit-io/toolchain/releases/download/'+upstream.id+'/'+name,'-o',path],{stdio:'inherit'});
    if(r.status!==0)throw Error('Missing licence material: '+name);
  }
  if(!await valid())throw Error('License integrity failed: '+name);
  await copyFile(path,output+'/toolchain/'+name);
}
await copyFile(assets+'/'+CORE_SOURCE.name,output+'/toolchain/'+CORE_SOURCE.name);
// Corresponding Labos library sources include original notices and license files.
const libraryArchive=spawnSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner','-czf',output+'/toolchain/labos-library-sources.tar.gz','-C',root,'vendor/arduino'],{stdio:'inherit'});
if(libraryArchive.status!==0)throw Error('Cannot package pinned library sources');
await copyFile(here+'/library-build-manifest.json',output+'/toolchain/library-build-manifest.json');
await copyFile(here+'/core-build-manifest.json',output+'/toolchain/core-build-manifest.json');
await buildShell({here,output});
await buildDistribution(root);
