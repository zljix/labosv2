import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {GradingReport} from '../src/platform/SchoolGrading';
import {gradingObservations} from '../src/platform/gradingObservations';
import registry from '../school/grader/profiles.json';

const reports:any[]=[];
function collect(value:any){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value.samples)&&typeof value.profileId==='string')reports.push(value);
  else for(const v of Object.values(value))collect(v);
}
collect(JSON.parse(readFileSync('verification/fixtures/24o-report-samples.json','utf8')));
test('24P renders real saved reports from all 19 schema families without fabricated values or failure statuses',()=>{
  assert(reports.length>=19);
  const families=new Set<string>();
  for(const report of reports){
    const schema=registry.profiles.find(p=>p.id===report.profileId);if(!schema)continue;
    families.add(schema.kind);
    const rows=gradingObservations(report);
    assert.equal(rows.length,report.samples.length);
    const html=renderToStaticMarkup(<GradingReport grading={{points:report.points,maxPoints:report.maxPoints,status:report.status,report}}/>);
    assert(!/undefined|NaN|Infinity/.test(html),report.profileId);
    for(const [i,row] of rows.entries())if(typeof report.samples[i]?.passed!=='boolean')assert.equal(row.status,'recorded');
  }
  assert.deepEqual([...families].sort(),[...new Set(registry.profiles.map(p=>p.kind))].sort());
});
test('24P V1 edges are neutral observations, V3 position and PWM are distinct percentages, V4/V5 show humidity and angle',()=>{
  const find=(id:string)=>reports.find(r=>r.profileId===id&&r.points===10);
  const one=find('24O-v1-led-time@1');assert(one);
  const first=gradingObservations(one)[0];assert.equal(first.status,'recorded');assert(first.details.some(s=>s.includes('250 ms')));
  const three=find('24O-v3-adc-pwm@1');assert(three);
  const percent=gradingObservations({...three,samples:[{index:1,position:15,observedDuty:.1597,passed:true}]});
  assert(percent[0].details.includes('Položaj potenciometra: 15 %'));assert(percent[0].details.some(s=>s.startsWith('Opaženi radni omjer PWM-a: 15.97 %')));
  for(const id of ['24O-v4-aht-oled@1','24O-v5-regulator@1']){
    const report=find(id);assert(report);const text=gradingObservations(report).flatMap(v=>v.details).join(' ');
    assert(text.includes('°C'));assert(text.includes('% RH'));assert(!text.includes(' Pa'));if(id.includes('v5'))assert(text.includes('Kut:')||text.includes('kut:'));
  }
  const legacy=gradingObservations({profileId:'24B-analog-threshold@1',samples:[{position:.15,passed:true}]});assert(legacy[0].details.includes('Položaj potenciometra: 15 %'));
  const unknown=gradingObservations({profileId:'future-profile@99',samples:[{temperature:100,passed:false}]});assert.equal(unknown[0].status,'recorded');assert(!unknown[0].details.join(' ').includes('°C'));
});
