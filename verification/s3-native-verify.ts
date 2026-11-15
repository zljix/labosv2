// Verify native evidence against every current exported source, not ZIP timestamps.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {s3Examples,s3ExampleProject,type S3Example} from '../src/runtime/s3Examples';
import {radioNodeProject} from '../src/radio/examples';
import {exportSketch} from '../src/project/sketch';
import {selectedLibraries,S3_FQBN} from '../public/s3-contract.mjs';
const dir=process.env.LAB_NATIVE_EVIDENCE_DIR??'docs/stage22f-evidence/native';
const results=JSON.parse(readFileSync(dir+'/results.json','utf8'));
const keys=[...Object.keys(s3Examples),'radioTX','radioRX'];
assert.equal(results.length,keys.length,'Native evidence must cover every current sketch and both radio roles.');
assert.equal(new Set(results.map((r:any)=>r.key)).size,keys.length,'Repeated native result.');
for(const key of keys){
 const row=results.find((r:any)=>r.key===key);assert(row,key);assert.equal(row.status,'pass',key);
 assert.equal(row.fqbn,S3_FQBN);assert.equal(row.cli,'1.3.1');assert.equal(row.core,'esp32:esp32@3.3.12');
 const project=key==='radioTX'||key==='radioRX'?radioNodeProject('s3-cpp',key==='radioTX'?'tx':'rx'):s3ExampleProject(key as S3Example);
 const files=unzipSync(exportSketch(project));
 const hashes=Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([path,bytes])=>[path,createHash('sha256').update(bytes).digest('hex')]));
 assert.deepEqual(row.fileHashes,hashes,key+': native evidence is stale after a source/header change.');
 assert.deepEqual(row.libraries,selectedLibraries(project),key+': native library selection differs.');
 assert.equal(row.binaries.length,2);assert.deepEqual(row.binaries.map((b:any)=>b.name).sort(),['LabSketch.ino.bin','LabSketch.ino.elf']);
 for(const binary of row.binaries){assert(binary.bytes>0);assert.match(binary.sha256,/^[a-f0-9]{64}$/);}
 assert(readFileSync(dir+'/'+key+'.txt','utf8').includes('Sketch uses'),key+': missing successful compiler log.');
}
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const report={format:'esp32-lab-native-export-checks',version:1,appVersion:version,verifiedAt:new Date().toISOString(),scope:'Compile-only Linux check of exact exported sources. No physical board was contacted; firmware is not executed in the simulator.',cli:'1.3.1',core:'esp32:esp32@3.3.12',fqbn:S3_FQBN,total:keys.length,passed:results.length,menuExamples:Object.keys(s3Examples).length,radioPrograms:2,programs:results.map(({key,fileHashes,libraries,binaries}:any)=>({key,fileHashes,libraries,binaries}))};
mkdirSync('public/verification',{recursive:true});
writeFileSync('public/verification/s3-native-exports.json',JSON.stringify(report,null,2)+'\n');
console.log(`${report.passed}/${report.total} exact current exports verified; ${report.menuExamples} menu examples + two radio roles. No hardware execution claimed.`);
