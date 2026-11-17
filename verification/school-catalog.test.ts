import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseProject} from '../src/project/model';
import {prepareSchoolAssignment,readSchoolAssignment,SCHOOL_TASK_FILE} from '../src/platform/SchoolAssignment';
import {targetForProject} from '../src/lessons/ursCatalog';
import {exportZip,importProject} from '../src/project/archive';

test('every frozen school starter opens as a new local project with its precise target and immutable task metadata',()=>{
  const catalog=JSON.parse(readFileSync('.build/school-catalog/catalog.json','utf8'));let count=0;
  for(const entry of catalog.entries)for(const target of entry.targets){
    const starter=JSON.parse(readFileSync('.build/school-catalog/'+entry.templates[target],'utf8'));
    const definition={...entry};delete definition.templates;
    const assignment={id:1,className:'4.f',target,task:{id:1,version:1,definition,rubric:{criteria:[]}},starter};
    const copy=prepareSchoolAssignment(assignment,{id:3,displayName:'Učenik Primjer'});
    assert.notEqual(copy.id,starter.id);assert.equal(targetForProject(copy),target);assert.deepEqual(parseProject(copy),copy);
    assert.deepEqual(importProject(exportZip(copy),'school.zip'),copy);
    assert.equal(JSON.parse(copy.files[SCHOOL_TASK_FILE]).assignment.task.version,1);
    assert(readSchoolAssignment(copy));
    assert(!copy.files[SCHOOL_TASK_FILE].includes('"starter"'));
    assert.deepEqual(copy.circuit,starter.circuit);
    for(const key of Object.keys(starter.files))if(!['urs-vjezba.json','vjezba.json'].includes(key))assert.equal(copy.files[key],starter.files[key]);
    if(starter.radio)assert.deepEqual(copy.radio,starter.radio);
    ++count;
  }
  assert.equal(count,273);
  assert.equal(catalog.entries.filter((e:any)=>e.set==='urs').length,67);
  assert.equal(catalog.entries.filter((e:any)=>e.set==='introductory').length,5);
});

test('imported or locally edited school metadata cannot crash the simulator or confer server authority',()=>{
  const starter=JSON.parse(readFileSync('.build/school-catalog/gpio-button-micropython.json','utf8'));
  for(const value of ['not json',JSON.stringify({format:'labosv2-assignment-copy',version:1,assignment:{id:1,className:'4.f',task:{version:1,definition:{title:'Test',code:'URS01',goal:'',before:'',change:'',fault:''},rubric:{criteria:[null]}}}}),'x'.repeat(65537)]){
    starter.files[SCHOOL_TASK_FILE]=value;assert.equal(readSchoolAssignment(parseProject(starter)),undefined);
  }
});
