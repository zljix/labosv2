import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function buildDistribution(root) {
  const here=resolve(root,'prototypes/avr-offline'),out=resolve(root,'.build/avr-offline/toolchain');
  await mkdir(out,{recursive:true});
  await cp(here+'/notices',out+'/notices',{recursive:true});
  const recipe=JSON.parse(await readFile(here+'/upstream-recipe.json','utf8'));
  const upstream=JSON.parse(await readFile(here+'/upstream-manifest.json','utf8'));
  const runtime=JSON.parse(await readFile(here+'/runtime-manifest.json','utf8'));
  const sources=(await readFile(here+'/upstream-sources.txt','utf8')).split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(line=>{
    const [name,originalURL,sha256]=line.trim().split(/\s+/);
    return {name,sha256,originalURL,url:`https://github.com/pcbkit-io/toolchain/releases/download/${upstream.id}/${name}`};
  });
  const inventory={format:'labos-avr-distribution',version:1,compilerPackage:runtime.packageHash,
    upstreamRelease:upstream.id,recipe,upstreamSources:sources,
    access:'GPL-3.0 section 6(d): pinned upstream corresponding source and recipe links; modified Labos SDK/library/application sources on this server.',
    sourceArchive:'labos-corresponding-source.tar.gz',upstreamRecipeRedistributed:false,
    maintenance:'Keep all linked corresponding sources available while distributing these binaries. Recheck pinned URLs/hashes before publishing; repair access or withdraw binaries if source access is lost.'};
  // Use only tracked source files, including staged additions; never local secrets,
  // dependencies, test profiles, old dist/ or toolchain build caches.
  const listed=spawnSync('git',['ls-files','-z','--','.',':(exclude)dist'],{cwd:root});
  if(listed.status!==0)throw Error('Cannot enumerate corresponding Labos source');
  const names=listed.stdout.toString().split('\0').filter(Boolean).sort();
  const archive=out+'/'+inventory.sourceArchive;
  const result=spawnSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner','-czf',archive,'-C',root,'--null','--verbatim-files-from','-T','-'],{input:Buffer.from(names.join('\0')+'\0')});
  if(result.status!==0)throw Error('Cannot archive corresponding source: '+result.stderr);
  const bytes=await readFile(archive);inventory.sourceArchiveBytes=bytes.length;
  inventory.sourceArchiveSha256=createHash('sha256').update(bytes).digest('hex');
  await writeFile(out+'/DISTRIBUTION.json',JSON.stringify(inventory,null,2)+'\n');
  await cp(here+'/DISTRIBUTION.md',out+'/DISTRIBUTION.md');
  console.log('Corresponding source and notices prepared:',bytes.length,'bytes');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildDistribution(resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
