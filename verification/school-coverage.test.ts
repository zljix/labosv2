import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// @ts-expect-error jsdom is the same untyped test-only dependency used by the React integration suites.
import {JSDOM} from 'jsdom';
import {gradingCoverage,gradingCoverageCSV,gradingSupport} from '../school/grader/coverage';
import {ursLessons,ursTargets,variantAvailable,type UrsTarget} from '../src/lessons/ursCatalog';
import registry from '../school/grader/profiles.json';
import {mountGradingCoverage} from '../public/school-grading-support.mjs';

test('23G full URS matrix has exactly one status and explicit criteria per real catalogue combination',()=>{
  const matrix=gradingCoverage('test');
  assert.deepEqual(matrix.summary,{themes:18,variants:67,combinations:268,supported:268,unsupported:0,introductory:5});
  const expected=ursLessons.flatMap(l=>l.variants.flatMap(v=>(Object.keys(ursTargets) as UrsTarget[]).filter(t=>variantAvailable(v,t)).map(t=>l.id+'/'+v.id+'/'+t)));
  assert.deepEqual(matrix.rows.map(r=>r.id),expected);assert.equal(new Set(expected).size,268);
  assert.equal(new Set(matrix.rows.map(r=>r.code)).size,18);
  assert.equal(new Set(matrix.rows.map(r=>r.family)).size,5);
  for(const row of matrix.rows){
    assert(row.preparationCriteria.length);assert(row.expected);assert(row.fault);assert(row.grading.reason);assert(row.grading.requirement);
    if(row.grading.status==='supported'){
      const p=registry.profiles.find(p=>p.id===row.grading.profileId)!;
      assert(p.targets.includes(row.target));assert.equal(p.taskKey,row.taskKey);assert.deepEqual(row.grading.criteria,p.criteria);
      assert.equal(row.grading.criteria.reduce((n,c)=>n+c.maxPoints,0),10);assert(readFileSync(row.grading.evidence!));
    }else{assert.equal(row.grading.maxPoints,null);assert.equal(row.grading.profileId,null);assert.deepEqual(row.grading.criteria,[]);}
    if(row.target==='s3-cpp'&&row.grading.status==='supported')assert.match(row.grading.profileId!,/^24[BCDEFGHIJKLMNP]-/);
  }
  assert.deepEqual(matrix.introductory.map(r=>r.code),['V1','V2','V3','V4','V5']);
  assert(matrix.introductory.every(r=>r.status==='supported'&&r.maxPoints===10));
  assert.deepEqual(matrix.introductorySummary,{total:5,supported:5,unsupported:0});
  assert.equal(gradingSupport('unknown/unknown','micropython').status,'unsupported');
});
test('23G generated JSON, CSV and private catalogue agree with the authoritative grading registry',()=>{
  const version=JSON.parse(readFileSync('package.json','utf8')).version,matrix=gradingCoverage(version);
  assert.deepEqual(JSON.parse(readFileSync('public/school-grading-support.json','utf8')),matrix);
  const csv=gradingCoverageCSV(matrix);assert.equal(readFileSync('public/school-grading-support.csv','utf8'),csv);
  assert.equal(csv.split('\r\n').filter(Boolean).length,274);
  const catalog=JSON.parse(readFileSync('.build/school-catalog/catalog.json','utf8'));
  for(const entry of catalog.entries)for(const target of entry.targets){
    assert.deepEqual(entry.gradingSupport[target],(entry.set==='introductory'?matrix.introductory.find(r=>r.taskKey===entry.key):matrix.rows.find(r=>r.taskKey===entry.key&&r.target===target))!.grading);
  }
  assert.equal(gradingSupport('gpio/button','uno').profileId,'24P-button-led@2');
  assert.equal(gradingSupport('gpio/button','uno').checkerVersion,'24P.1-button');
  assert.equal(registry.profiles.find(p=>p.id==='24B-button-led@1')!.checkerVersion,'24AB.1');
  assert.equal(gradingSupport('analog/lm35','uno').checkerVersion,'24AB.1');
});
test('23G real support page filters by target, family, status and text; injected text stays text',()=>{
  const dom=new JSDOM(readFileSync('public/school-grading.html','utf8'),{url:'https://school.example/labosv2/school-grading.html'});
  const previous=globalThis.document;(globalThis as any).document=dom.window.document;
  try{
    const doc=dom.window.document,matrix=gradingCoverage('test');mountGradingCoverage(matrix,doc);
    const change=(id:string,value:string,event='change')=>{const el=doc.querySelector(id) as HTMLInputElement;el.value=value;el.dispatchEvent(new dom.window.Event(event,{bubbles:true}));};
    const count=()=>doc.querySelectorAll('#rows tr').length;
    assert.equal(count(),268);assert.match(doc.querySelector('#summary')!.textContent!,/18/);
    change('#support','supported');assert.equal(count(),268);
    change('#target','s3-cpp');assert.equal(count(),67);assert.match(doc.querySelector('#result')!.textContent!,/Prikazano 67/);
    change('#support','unsupported');assert.equal(count(),0);
    change('#target','micropython');change('#support','supported');change('#query','LM35','input');assert.equal(count(),2);
    assert.match(doc.querySelector('#rows')!.textContent!,/24B-lm35@1/);
    change('#query','','input');change('#family','radio');assert.equal(count(),1);
    change('#support','unsupported');assert.equal(count(),0);
    assert.equal(doc.querySelectorAll('#introductory details').length,5);
    matrix.rows[0].variantTitle='<img src=x onerror=alert(1)>';
    mountGradingCoverage(matrix,doc);change('#family','');change('#target','');change('#support','');
    assert.equal(doc.querySelector('#rows img'),null);assert.match(doc.querySelector('#rows')!.textContent!,/<img src=x/);
  }finally{(globalThis as any).document=previous;dom.window.close();}
});
