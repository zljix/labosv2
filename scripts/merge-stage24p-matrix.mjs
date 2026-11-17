import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const directory='docs/stage24p-evidence/',source=process.env.GITHUB_SHA;
assert(/^[a-f0-9]{40}$/.test(source??''),'A full CI source commit is required.');
const targets=['micropython','s3-cpp','uno','nano'];
const parts=targets.map(target=>JSON.parse(readFileSync(directory+'current-matrix-'+target+'.json','utf8')));
const coverage=JSON.parse(readFileSync('public/school-grading-support.json','utf8'));
const expected=new Map([...coverage.rows,...coverage.introductory].map(row=>[row.taskKey+'/'+row.target,row]));
assert.equal(expected.size,273);
const profiles=new Map(JSON.parse(readFileSync('school/grader/profiles.json','utf8')).profiles.map(p=>[p.id,p]));
const results=[];
for(const [index,part] of parts.entries()){
  assert.equal(part.sourceCommit,source);
  assert.equal(part.target,targets[index]);
  assert.equal(part.task,null);
  assert.equal(part.workers,1);
  assert.equal(part.results.length,targets[index]==='micropython'?72:67);
  for(const row of part.results){
    assert.equal(row.target,targets[index]);
    const key=row.taskKey+'/'+row.target,definition=expected.get(key);
    assert(definition,'Unexpected or duplicate matrix row: '+key);
    assert.equal(row.profileId,definition.grading.profileId);
    const profile=profiles.get(row.profileId);
    assert(profile);
    const points=profile.kind==='blink'&&row.target!=='micropython'?8:10;
    assert.equal(row.expectedPoints,points);
    assert.equal(row.status,'evaluated');
    assert.equal(row.points,points);
    expected.delete(key);results.push(row);
  }
}
assert.equal(expected.size,0,'Some supported combinations were not executed.');
const hashes=new Set(results.map(row=>row.checkerHash));
assert.equal(hashes.size,1);
assert(/^[a-f0-9]{64}$/.test([...hashes][0]));
results.sort((a,b)=>(a.taskKey+'/'+a.target).localeCompare(b.taskKey+'/'+b.target));
writeFileSync(directory+'current-matrix.json',JSON.stringify({format:'labosv2-current-matrix',version:1,sourceCommit:source,
  executionTopology:'one-target-per-CI-runner',workersPerRunner:1,targets,parts:targets.map(t=>'current-matrix-'+t+'.json'),results},null,2)+'\n');
console.log('Verified all 273 unique expected outcomes from four separate target runners.');
