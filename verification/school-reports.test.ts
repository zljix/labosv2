import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import {achievementCsv,achievementProjects} from '../src/platform/schoolReports';
import {importProject} from '../src/project/archive';

test('23H CSV distinguishes unassessed from zero, retains provenance and neutralizes formulas',()=>{
  const row={student:{id:1,displayName:' \t=HYPERLINK("x")',username:'pupil'},assignment:{id:1,code:'URS01',title:'Vježba',version:1,target:'micropython'},status:'locked',currentAttempt:{number:2,revision:1},submission:{id:1,revision:3,submittedAt:'2026-11-15T14:00:00Z'},assessment:{points:0,maxPoints:10,source:'teacher',grading:{status:'evaluated',points:10,teacherReview:{author:{displayName:'Nastavnik'},reason:'@SUM(1)',createdAt:'2026-11-15T14:01:00Z'}}},selection:{reason:'Ranija predaja'}};
  const report={class:{name:'4.f',schoolYear:'2026/2027'},serverTime:'2026-11-15T15:00:00Z',rows:[row,{...row,student:{id:2,displayName:'B',username:'b'},assessment:{points:null,maxPoints:null,source:'pending',grading:{status:'unsupported',points:null}}}]};
  const csv=achievementCsv(report);assert(csv.startsWith('\uFEFF'));assert(csv.includes("' \t=HYPERLINK"));assert(csv.includes("'@SUM(1)"));assert(csv.includes('"10";"0";"10";"teacher"'));assert(csv.includes('"";"";"";"pending";"unsupported"'));assert(csv.includes('Ranija predaja'));
});
test('23H exported project ZIPs round-trip every byte of both radio nodes, initial media and sources',()=>{
  const catalog=JSON.parse(readFileSync('.build/school-catalog/catalog.json','utf8'));
  const radio=catalog.entries.find((x:any)=>x.key?.startsWith('radio/')||x.taskKey?.startsWith('radio/')||x.templates.micropython?.startsWith('radio-'));
  assert(radio);const project=JSON.parse(readFileSync('.build/school-catalog/'+radio.templates.micropython,'utf8'));assert(project.radio?.peer);
  const work={attempt:{id:7},student:{id:4},snapshot:{revision:2,contentHash:'a'.repeat(64),project}};
  const zip=unzipSync(achievementProjects({class:{name:'4.f',schoolYear:'2026/2027'},rows:[],serverTime:'2026-11-15T15:00:00Z'},[work]));
  assert.deepEqual(importProject(zip['radovi/pokusaj-7-r2.zip'],'pokusaj.zip'),project);
  assert.equal(JSON.parse(strFromU8(zip['snimke.json']))[0].contentHash,work.snapshot.contentHash);
  assert.throws(()=>achievementProjects({class:{},rows:[]},[work,work]),/dvostruku/);
});
