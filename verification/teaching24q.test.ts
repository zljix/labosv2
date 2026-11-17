import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ursLessons,createUrsProject,ursMarkdown,URS_WORK} from '../src/lessons/ursCatalog';
import {variantGuides,teachingLesson,URS_GUIDE_VERSION} from '../src/lessons/ursTeaching';
import {readUrsWork,ursContentHash,ursSourceHash,ursSubmissionProject,recordUrsSnapshot} from '../src/lessons/ursWork';
import {finishAdvice,investigationProject} from '../src/lessons/workflow';
import {clone} from '../src/project/model';
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>new Response(readFileSync(resolve('public',String(input).replace(/^\/app\/[^/]+\//,''))));
test.after(()=>{globalThis.fetch=originalFetch;});

test('24Q every variant has focused teaching with two questions and explicit recovery evidence',()=>{
 const keys=ursLessons.flatMap(l=>l.variants.map(v=>l.id+'/'+v.id));
 assert.equal(keys.length,67);assert.deepEqual(Object.keys(variantGuides).sort(),keys.sort());
 for(const l of ursLessons)for(const v of l.variants){
  const g=teachingLesson(l,v.id,URS_GUIDE_VERSION);
  assert(g.goal&&g.change&&g.expected&&g.fault);assert.equal(g.questions.length,2);
  assert(g.questions.every(q=>q.endsWith('?')||q.endsWith('.')));assert(g.criteria.join(' ').includes('oporavka'));
  assert.equal(teachingLesson(l,v.id),l);
 }
 const blink=teachingLesson(ursLessons[0],'blink',2);
 assert(!/ADC|tipkalo|PWM|pull-up/.test([...blink.questions,...blink.criteria,...blink.concepts.flat()].join(' ')));
 for(const id of ['iliGraphics','iliRotation'])assert(!/kalibracij|XPT2046/.test(teachingLesson(ursLessons.find(l=>l.id==='touch')!,id,2).concepts.flat().join(' ')));
});

test('24Q legacy worksheet hashes and question meanings are preserved; guide changes invalidate review',async()=>{
 const p=await createUrsProject('gpio','blink','micropython'),w=readUrsWork(p)!;
 assert.equal(w.guideVersion,2);w.student='Probni Učenik';w.group='4.f';w.answers=['Odgovor A','Odgovor B'];
 w.observations={baseline:'Predviđanje i opažanje',change:'Promjena',fault:'Pogreška pa oporavak'};
 const legacy=clone(p);delete w.guideVersion;legacy.files[URS_WORK]=JSON.stringify(w);
 const oldHash=async()=>{const source=await ursSourceHash(legacy),value={source,student:w.student,group:w.group,answers:w.answers,observations:w.observations};return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))).toString('hex');};
 assert.equal(await ursContentHash(legacy),await oldHash());
 legacy.files[URS_WORK]=JSON.stringify(await recordUrsSnapshot(legacy));
 const exported=await ursSubmissionProject(legacy);
 assert(exported.files['urs-predaja.md'].includes(ursLessons[0].questions[0]));
 const modern=clone(legacy),modernWork=readUrsWork(modern)!;modernWork.guideVersion=2;modern.files[URS_WORK]=JSON.stringify(modernWork);
 assert.notEqual(await ursContentHash(modern),await ursContentHash(legacy));
 assert((await ursSubmissionProject(modern)).files['urs-predaja.md'].includes(variantGuides['gpio/blink'].question));
 modern.files[URS_WORK]=JSON.stringify({...modernWork,guideVersion:99});assert.equal(readUrsWork(modern),undefined);
});

test('24Q regulator and OLED investigation cannot silently replace published grading conditions',async()=>{
 for(const [lesson,id] of [['regulator','regulator'],['displays','oled32']]){
  const p=await createUrsProject(lesson,id,'micropython');
  assert.match(p.files['urs-upute.md'],/istraživačk.*kopij/);
  assert.match(p.files['urs-upute.md'],/objavljena rubrika/);
  assert.match(p.files['urs-upute.md'],/Lokalna predaja/);
 }
 const p=await createUrsProject('gpio','blink','micropython');
 p.files['school-attempt.json']=JSON.stringify({format:'labosv2-school-attempt',version:1,origin:'https://school.test',userId:1,attemptId:1,assignmentId:1,projectId:p.id,revision:1,fingerprint:'a'.repeat(64)});
 const original=JSON.stringify(p),copy=investigationProject(p);
 assert.equal(JSON.stringify(p),original);assert.notEqual(copy.id,p.id);assert(!copy.files['school-attempt.json']);assert.deepEqual(copy.circuit,p.circuit);assert.equal(copy.files[URS_WORK],p.files[URS_WORK]);
 assert.match(finishAdvice(p),/ZIP je dodatna kopija/);
 assert.match(ursMarkdown(ursLessons[0],ursLessons[0].variants[0],p),/Završi i zaključaj/);
});
