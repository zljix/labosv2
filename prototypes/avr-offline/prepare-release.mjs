// Creates a review candidate only. Does not publish, push, or change repositories.
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync,statSync,openSync,closeSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {digest,verifyApplication,verifySources} from './release-check.mjs';
import {sourceBuild} from '../../scripts/offline-plugin.mjs';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
process.chdir(root);
const base='/labosv2/', candidate='avr-offline-0.16.0-beta.1';
const run=(cmd,args,options={})=>{
  const result=spawnSync(cmd,args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,...options});
  if(result.error || result.status!==0) throw Error(`${cmd} ${args.join(' ')}\n${result.error??result.stderr??result.stdout}`);
  return result.stdout;
};
// This repository tracks an older dist/. The candidate always rebuilds it;
// source cleanliness excludes only that generated output.
const sourceStatus=()=>run('git',['status','--porcelain','--','.',':(exclude)dist']);
if(sourceStatus().trim()) throw Error('Commit source changes before preparing a release candidate.');
const tree=run('git',['rev-parse','HEAD^{tree}']).trim();
const out=resolve(root,'.build',candidate+'-'+tree.slice(0,12));
mkdirSync(out,{recursive:false});mkdirSync(out+'/evidence');
const step=(name,cmd,args,env={})=>{
  console.log(name);
  const fd=openSync(out+'/evidence/'+name+'.txt','w');
  let result;
  try {result=spawnSync(cmd,args,{cwd:root,stdio:['ignore',fd,fd],env:{...process.env,...env}});}
  finally {closeSync(fd);}
  if(result.error || result.status!==0) throw Error(`${name} failed; see ${out}/evidence/${name}.txt`);
};
step('compiler-build',process.execPath,['prototypes/avr-offline/build.mjs']);
step('source-mirror',process.execPath,['prototypes/avr-offline/prepare-sources.mjs']);
// Runtime tests must inspect this candidate, not the repository's old dist/.
step('integrated-build','npm',['run','build:pages'],{LAB_BASE_PATH:base,LAB_OFFLINE_AVR:'1'});
const stopEvidence=root+'/docs/stage8-evidence/stop.json', previousStopEvidence=readFileSync(stopEvidence);
try {
step('regression',process.execPath,['--import','tsx','--test',
  'prototypes/avr-offline/compiler.test.mjs','prototypes/avr-offline/worker-harness.test.mjs',
  'prototypes/avr-offline/package.test.mjs','prototypes/avr-offline/network-proof.test.mjs',
  'prototypes/avr-offline/project-bridge.test.ts','prototypes/avr-offline/libraries.test.ts',
  'prototypes/avr-offline/release-check.test.mjs','verification/offline-avr.test.ts',
  'verification/project.test.ts','verification/circuit.test.ts','verification/arduino.test.ts',
  'verification/avr.test.ts','verification/offline-storage.test.mjs']);
} finally {
  cpSync(stopEvidence,out+'/evidence/avr-stop.json');
  writeFileSync(stopEvidence,previousStopEvidence);
}
step('compiler-ui',process.execPath,['scripts/test-compiler-ui.mjs']);
step('pages',process.execPath,['--test','verification/pages.test.mjs']);
if(sourceStatus().trim()) throw Error('Build changed tracked source; review before packaging.');
const json=name=>JSON.parse(readFileSync(here+'/'+name));
const app=verifyApplication(root+'/dist',base,json('runtime-manifest.json'),json('packed-manifest.json'),json('license-manifest.json'));
if(app.build!==sourceBuild(root,base,['prototypes/avr-offline'])) throw Error('Stale application build');
const mirror=root+'/.build/avr-corresponding-sources';
const sourceRecords=verifySources(mirror+'/sources',readFileSync(here+'/upstream-sources.txt','utf8'));
cpSync(root+'/dist',out+'/site',{recursive:true});
mkdirSync(out+'/sources');
for(const item of sourceRecords) cpSync(mirror+'/sources/'+item.name,out+'/sources/'+item.name);
run('git',['archive','--format=tar.gz','--prefix=labos/','--output='+out+'/sources/Labos-source.tar.gz','HEAD']);
// Do not redistribute upstream recipe files with unresolved licensing.
// Exact URLs and hashes remain in the source archive and candidate documentation.
for(const name of ['RELEASE.md','DISTRIBUTION.md','PILOT.md','LIBRARIES.md','INTEGRATION.md','EVIDENCE-06.md']) cpSync(here+'/'+name,out+'/'+name);
cpSync(root+'/LICENSE',out+'/LICENSE-Labos.txt');
cpSync(here+'/upstream-recipe.json',out+'/sources/upstream-recipe-links.json');
writeFileSync(out+'/sources/manifest.json',JSON.stringify(sourceRecords,null,2)+'\n');
const manifest={candidate,sourceTree:tree,applicationVersion:app.version,applicationBuild:app.build,
  base,targetRepository:'zljix/labosv2',compilerPackage:json('runtime-manifest.json').packageHash,
  technicalChecks:'passed',publicReleaseReady:false,
  unresolved:['physical-school-and-mobile-pilot','final-browser-acceptance-and-upgrade-on-labosv2'],
  distributionModel:'GPLv3-6d-pinned-upstream-access',recipeFilesIncluded:false,upstreamSourceArchives:sourceRecords.length,
  browserEvidence:{testedCommit:'a9851df72c3011179f35695bcc3ad588aad0f783',
    url:'https://github.com/zljix/labos/actions/runs/44645351464',
    scope:'Earlier identical application code on /avr-integrated/; current /labosv2/ package has Node Pages tests, not a new browser acceptance.'}};
writeFileSync(out+'/candidate.json',JSON.stringify(manifest,null,2)+'\n');
const files=dir=>readdirSync(dir).sort().flatMap(name=>{
  const path=resolve(dir,name);return statSync(path).isDirectory()?files(path):[path];
});
const inventory=files(out).map(path=>({path:relative(out,path).replaceAll('\\','/'),bytes:statSync(path).size,sha256:digest(readFileSync(path))}));
writeFileSync(out+'/SHA256SUMS',inventory.map(item=>item.sha256+'  '+item.path).join('\n')+'\n');
// zipfile streams large source archives instead of buffering the entire package.
const archive=out+'.zip';
run('python3',['-c',`import pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file(): z.write(p,p.relative_to(root))
with zipfile.ZipFile(sys.argv[2]) as z:
 assert z.testzip() is None
`,out,archive]);
writeFileSync(archive+'.sha256',digest(readFileSync(archive))+'  '+archive.split('/').at(-1)+'\n');
console.log(JSON.stringify({directory:out,archive,bytes:statSync(archive).size,...manifest},null,2));
