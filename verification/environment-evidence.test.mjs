import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyEnvironmentEvidence} from '../scripts/verify-environment-evidence.mjs';

const source='a'.repeat(40);
function fixture(){
  return Object.fromEntries(['micropython','s3-cpp','uno','nano'].map(target=>{
    const results=[];
    for(const profileId of ['24I-regulator@1','24I-weather@1']){
      const row={profileId,target,snapshotHash:'b'.repeat(64),contractHash:'c'.repeat(64),seed:'5'.repeat(64)};
      // A deliberate wrong OLED value precedes the repeated references in the real suite.
      results.push({...row,result:{status:'evaluated',points:3}});
      for(const referenceRepetition of [1,2,3])results.push({...row,referenceRepetition,result:{status:'evaluated',points:10}});
      if(target!=='micropython')for(const points of [10,10,3,8])results.push({...row,result:{status:'evaluated',points,provenance:{method:'isolated-source-compilation'}}});
    }
    return [target,{sourceCommit:source,results}];
  }));
}
test('24I acceptance finds explicit references regardless of result order',()=>{
  const e=fixture();for(const value of Object.values(e))value.results.reverse();
  const summary=verifyEnvironmentEvidence(e,source);
  assert.equal(summary.independentCompilations,24);
  assert(summary.records.every(r=>r.repeatedReferences===6));
});
test('24I acceptance rejects missing, duplicated, changed or unsuccessful reference evidence',()=>{
  for(const mutate of [
    e=>e.micropython.results.splice(1,1),
    e=>e.micropython.results[1].referenceRepetition=2,
    e=>e.micropython.results[1].snapshotHash='d'.repeat(64),
    e=>e.micropython.results[1].result.points=8,
    e=>e.micropython.sourceCommit='stale',
    e=>e.micropython.results[0].target='uno',
    e=>e.uno.results.find(r=>r.result.provenance).result.points=3,
    e=>e.uno.results.find(r=>r.result.provenance).result.status='technical_error',
  ]){const e=fixture();mutate(e);assert.throws(()=>verifyEnvironmentEvidence(e,source));}
});
