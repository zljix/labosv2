import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const targets=['micropython','s3-cpp','uno','nano'];
const profiles=['24I-regulator@1','24I-weather@1'];

export function verifyEnvironmentEvidence(evidence,sourceCommit){
  assert(sourceCommit,'Missing evidence source commit');
  const records=targets.map(target=>{
    const e=evidence[target];
    assert.equal(e?.sourceCommit,sourceCommit,'Wrong evidence source: '+target);
    assert(e.results.every(r=>r.target===target),'Wrong target: '+target);
    const repeated=e.results.filter(r=>r.referenceRepetition!==undefined);
    assert.equal(repeated.length,6,'Incomplete repeated references: '+target);
    for(const profile of profiles){
      const rows=repeated.filter(r=>r.profileId===profile);
      assert.deepEqual(rows.map(r=>r.referenceRepetition).sort(),[1,2,3],'Missing or duplicate repetition: '+target+'/'+profile);
      assert(rows.every(r=>r.result.status==='evaluated'&&r.result.points===10),'Failed reference: '+target+'/'+profile);
      for(const key of ['snapshotHash','contractHash','seed']){
        assert(rows.every(r=>/^[a-f0-9]{64}$/.test(r[key])),'Missing reference identity: '+key);
        assert.equal(new Set(rows.map(r=>r[key])).size,1,'Reference changed across repetitions: '+key);
      }
    }
    const native=e.results.filter(r=>r.result.provenance?.method==='isolated-source-compilation');
    assert.equal(native.length,target==='micropython'?0:8,'Incomplete compiler evidence: '+target);
    if(target!=='micropython')for(const profile of profiles){
      const rows=native.filter(r=>r.profileId===profile);
      assert(rows.every(r=>r.result.status==='evaluated'),'Unevaluated compilation: '+target+'/'+profile);
      assert.deepEqual(rows.map(r=>r.result.points).sort((a,b)=>a-b),[3,8,10,10],'Incomplete compiler outcomes: '+target+'/'+profile);
    }
    return {target,repeatedReferences:repeated.length,independentCompilations:native.length};
  });
  return {format:'labosv2-24i-native-acceptance',version:2,sourceCommit,records,
    independentCompilations:records.reduce((n,r)=>n+r.independentCompilations,0)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const evidence=Object.fromEntries(targets.map(t=>[t,JSON.parse(readFileSync('docs/stage24i-evidence/environment-'+t+'.json','utf8'))]));
  const summary=verifyEnvironmentEvidence(evidence,process.env.GITHUB_SHA);
  writeFileSync('docs/stage24i-evidence/ci-native-summary.json',JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary));
}
