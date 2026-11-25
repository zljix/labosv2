import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const base=new URL('../public/zbirke/',import.meta.url);
const titles=JSON.parse(await readFile(new URL('../src/lessons/iotUsTitles.json',import.meta.url),'utf8'));

test('every collection exercise has both complete station handouts, program files and referenced figures',async()=>{
  assert.equal(Object.keys(titles).length,31);
  for(const id of Object.keys(titles)){
    const directory=id.replace('.','_');
    for(const edition of ['Arduino','MicroPython']){
      const sheet=JSON.parse(await readFile(new URL(directory+'/'+edition+'.json',base),'utf8'));
      const files=Object.keys(sheet.files);
      assert.ok(files.includes('LV_'+directory+'_'+edition+'_v14.docx'));
      assert.ok(files.some(name=>name.endsWith(edition==='Arduino'?'.ino':'.py')));
      assert.ok(sheet.hours && sheet.goal && sheet.steps.length>=2);
      const blocks=sheet.intro.concat(sheet.steps.flatMap(section=>section.items));
      const assets=[...Object.values(sheet.files),...blocks.flatMap(block=>block.img?[block.img]:[])];
      for(const path of assets){
        assert.ok(!path.includes('..') && !path.startsWith('/'),path);
        assert.ok((await stat(new URL(path,base))).size>0,path);
      }
    }
  }
});

test('V4.3 programs use the single student library prepared in V4.2',async()=>{
  for(const edition of ['Arduino','MicroPython']){
    const load=async id=>JSON.parse(await readFile(new URL(id+'/'+edition+'.json',base),'utf8'));
    const initial=await load('V4_2'),next=await load('V4_3');
    const lib=edition==='Arduino'?'VentModelUcenik/VentModelUcenik.cpp':'vent_model_ucenik.py';
    assert.ok(initial.files[lib]);
    assert.ok(!(lib in next.files));
    const programs=Object.entries(next.files).filter(([name])=>name.endsWith(edition==='Arduino'?'.ino':'.py'));
    assert.equal(programs.length,2);
    for(const [,path] of programs){
      const code=await readFile(new URL(path,base),'utf8');
      assert.match(code,edition==='Arduino'?/#include <VentModelUcenik.h>/:/import vent_model_ucenik as vm/);
    }
  }
});
