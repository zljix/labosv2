import test from 'node:test';
import assert from 'node:assert/strict';
import {readWork} from '../src/lessons/catalog';
import {readUrsWork} from '../src/lessons/ursWork';
import {parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {introductoryProject} from './school-introductory-fixture';
import {starter} from './school-contract-fixture';
import {readArduinoWork} from '../src/runtime/arduinoBuild';

test('24P introductory and URS identity limits count Unicode code points and preserve long allowed names in JSON and ZIP',async()=>{
  for(const text of ['Ž','😀'])for(const length of [40,41,80,81,100,101,120,121]){
    const intro=introductoryProject('button'),urs=await starter('gpio/button');
    for(const [p,file,read]of [[intro,'vjezba.json',readWork],[urs,'urs-vjezba.json',readUrsWork]] as const){
      const original=JSON.parse(p.files[file]);
      for(const field of ['student','group'] as const){
        const w={...original,[field]:text.repeat(length)};p.files[file]=JSON.stringify(w);
        const expected=length<=(field==='student'?120:80);
        assert.equal(!!read(p),expected,field+' '+text+' '+length);
        if(expected){
          const restored=parseProject(JSON.parse(JSON.stringify(p)));assert.equal(read(restored)?.[field],w[field]);
          const zip=importProject(exportZip(p),'test.zip');assert.equal(read(zip)?.[field],w[field]);
        }
      }
    }
  }
});
test('24P Arduino identity no longer silently truncates valid names',()=>{
  const p=introductoryProject('button');const student='😀'.repeat(120),group='Ž'.repeat(80);
  p.files['arduino-predaja.json']=JSON.stringify({format:'esp32-lab-arduino-submission',version:1,student,group,observations:'Pokus'});
  assert.deepEqual(readArduinoWork(p),{student,group,observations:'Pokus'});
});

test('24P full Unicode identities survive JSON and ZIP for both radio nodes wherever a worksheet exists',async()=>{
  const p=await starter('radio/radio');assert(p.radio);
  p.radio.peer.files['urs-vjezba.json']=p.files['urs-vjezba.json'];
  for(const node of [p,p.radio.peer]){const w=readUrsWork(node)!;w.student='😀'.repeat(120);w.group='Ž'.repeat(80);node.files['urs-vjezba.json']=JSON.stringify(w);}
  for(const restored of [parseProject(JSON.parse(JSON.stringify(p))),importProject(exportZip(p),'radio.zip')])for(const node of [restored,restored.radio!.peer]){
    assert.equal(readUrsWork(node)?.student,'😀'.repeat(120));assert.equal(readUrsWork(node)?.group,'Ž'.repeat(80));
  }
});
