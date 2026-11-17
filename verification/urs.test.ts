import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {ursLessons,ursTargets,variantAvailable,createUrsProject,URS_WORK,type UrsTarget} from '../src/lessons/ursCatalog';
import {readUrsWork,ursSourceHash,ursContentHash,recordUrsSnapshot,recordUrsReview,ursSubmissionProject,exportUrsSubmission} from '../src/lessons/ursWork';
import {importProject,exportZip} from '../src/project/archive';
import {clone,forkProject,parseProject} from '../src/project/model';
import {prepareRun} from '../src/runtime/adapter';
import {compileCircuit} from '../src/circuit/compile';
import {componentSupport,SUPPORT_CATALOG} from '../src/boards/support';
import {supportRows,supportCSV,exerciseCoverage} from '../src/boards/supportReport';
import {validateArtifact,buildFile} from '../public/arduino-contract.mjs';
const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>{const path=String(input).replace(/^\/app\/[^/]+\//,'');if(path.startsWith('/')||path.includes('..'))throw Error('Nedopušten testni resurs '+path);return new Response(readFileSync(resolve('public',path)));};
test.after(()=>{globalThis.fetch=originalFetch;});

test('URS catalogue covers every available catalogue component and leaves the unconfirmed buzzer profile explicit',()=>{
 assert.equal(ursLessons.length,18);assert.equal(new Set(ursLessons.map(l=>l.id)).size,18);
 for(const l of ursLessons){assert(l.concepts.length>=3);assert(l.questions.length>=2&&l.criteria.length>=2);assert(l.change&&l.fault&&l.expected);assert.equal(new Set(l.variants.map(v=>v.id)).size,l.variants.length);}
 for(const item of SUPPORT_CATALOG)for(const target of Object.keys(ursTargets) as UrsTarget[]){const t=ursTargets[target],status=componentSupport(item,t.board,t.language).status;if(['planned','unsupported'].includes(status))continue;assert(exerciseCoverage(item,target).length,`${item.id}/${target} has no exercise`);}
 for(const id of ['buzzer'])assert(supportRows().filter(r=>r.component===id).every(r=>r.status==='planned'&&!r.exercises.length));
 assert.equal(supportRows().length,SUPPORT_CATALOG.length*4);assert.match(supportCSV(),/^\ufeff/);assert(supportCSV().includes('Otvoreni zadatak'));
 for(const row of supportRows())for(const match of row.evidence.matchAll(/verification\/[\w-]+\.test\.ts/g))assert(existsSync(match[0]),match[0]);
});
for(const l of ursLessons)for(const v of l.variants)for(const target of Object.keys(ursTargets) as UrsTarget[])if(variantAvailable(v,target))test(`URS${l.number} ${v.id}/${target}: real source, drivers, wiring, artifact and ZIP`,async()=>{
 const p=await createUrsProject(l.id,v.id,target),w=readUrsWork(p)!;assert(w);assert.equal(w.variantId,v.id);assert.equal(w.answers.length,l.questions.length);
 if(v.components.includes('breadboard'))assert(p.circuit.components.some(c=>c.kind==='breadboard'));
 assert.deepEqual(parseProject(p),p);assert.deepEqual(importProject(exportZip(p),'urs.zip'),p);assert(p.files['urs-upute.md'].includes('## Novi pojmovi'));
 assert(!Object.hasOwn(prepareRun({...p,schemaVersion:3,radio:undefined}).files,URS_WORK));
 const nodes=p.radio?[p,p.radio.peer]:[p];
 for(const n of nodes){assert(n.circuit.kind==='editable');compileCircuit(n.circuit,n.board.id===ursTargets.micropython.board?'micropython':'avr');if(n.language==='arduino-cpp')await validateArtifact(n,JSON.parse(n.files[buildFile(n)]));else {assert(n.files['main.py']);for(const m of n.files['main.py'].matchAll(/^from (lab_\w+|aht10|ssd1306|servo|dht|onewire|ds18x20) import/gm))assert(n.files[m[1]+'.py'],`${v.id}: missing driver ${m[1]}`);}}
});
test('unavailable S3 routes, unknown IDs and malformed work are rejected without a substitute program',async()=>{
 await assert.rejects(()=>createUrsProject('ir','unknown','s3-cpp'),/nije podržan/);
 await assert.rejects(()=>createUrsProject('radio','wrong','uno'),/nije podržan/);
 const p=await createUrsProject('gpio','blink','micropython');
 for(const edit of [(w:any)=>w.version=2,(w:any)=>w.answers.push('x'),(w:any)=>w.observations.fault=3,(w:any)=>w.student='x'.repeat(121),(w:any)=>w.snapshot={sourceHash:'no',recordedAt:'bad'}]){const q=clone(p),w=readUrsWork(q)!;edit(w);q.files[URS_WORK]=JSON.stringify(w);assert.equal(readUrsWork(q),undefined);}
});
async function completed(target:UrsTarget='micropython'){
 const p=await createUrsProject('gpio','blink',target),w=readUrsWork(p)!;w.student='Probni Učenik';w.group='4.f';w.answers=w.answers.map(()=>'Opaženi rezultat i obrazloženje');w.observations={baseline:'LED mijenja stanje.',change:'Promijenjena trajanja.',fault:'Odspojeno, ugašeno; vraćeno, ponovno radi.'};p.files[URS_WORK]=JSON.stringify(w);p.files[URS_WORK]=JSON.stringify(await recordUrsSnapshot(p));return p;
}
test('URS export requires complete manual observations and a current source/circuit snapshot; failed work is allowed',async()=>{
 const empty=await createUrsProject('gpio','blink','uno');await assert.rejects(()=>recordUrsSnapshot(empty),/Najprije zapiši/);await assert.rejects(()=>ursSubmissionProject(empty),/ime i prezime/);
 const p=await completed('uno'),hash=await ursSourceHash(p),q=importProject(await exportUrsSubmission(p),'urs.zip');assert.equal(readUrsWork(q)!.student,'Probni Učenik');assert.match(q.files['urs-predaja.md'],/nije automatska provjera/);assert.equal(await ursSourceHash(q),hash);assert.equal(await ursSourceHash(forkProject(q)),hash);
 q.files['urs-upute.md']='Krivotvorene upute';q.files['urs-predaja.md']='Tvrdi da je sve automatski prošlo';assert.equal(await ursSourceHash(q),hash);assert((await ursSubmissionProject(q)).files['urs-upute.md'].includes('## Novi pojmovi'));
 q.files['main.ino']+='\n// promjena\n';await assert.rejects(()=>ursSubmissionProject(q),/novi pregled/);
 const failed=await completed(),w=readUrsWork(failed)!;w.observations.baseline='Pokus nije uspio; opis problema.';failed.files[URS_WORK]=JSON.stringify(w);assert((await ursSubmissionProject(failed)).files['urs-predaja.md'].includes('Pokus nije uspio'));
});
test('snapshot binds both radio nodes, sources, artifacts and saved media, not titles or hand-entered answers',async()=>{
 const p=await createUrsProject('radio','radio','micropython','nano'),base=await ursSourceHash(p);p.title='Drugi naziv';p.settings.fontSize=18;assert.equal(await ursSourceHash(p),base);
 const w=readUrsWork(p)!;w.answers[0]='Novo';p.files[URS_WORK]=JSON.stringify(w);assert.equal(await ursSourceHash(p),base);
 p.radio!.peer.files['main.ino']+='\n// promjena B';assert.notEqual(await ursSourceHash(p),base);
 const a=await completed('uno'),before=await ursSourceHash(a);a.files[buildFile(a)]+=' ';assert.notEqual(await ursSourceHash(a),before);
 const sd=await createUrsProject('storage','sdFiles','micropython'),h=await ursSourceHash(sd);if(sd.circuit.kind==='editable')sd.circuit.components.find(c=>c.kind==='microSD')!.properties.sdState={version:1,blocks:[[16383,Buffer.alloc(512,42).toString('base64')]]};assert.notEqual(await ursSourceHash(sd),h);assert.deepEqual(parseProject(sd),sd);
});
test('teacher review becomes stale after student answers change; review metadata cannot approve execution',async()=>{
 const p=await completed(),hash=await ursContentHash(p);p.files[URS_WORK]=JSON.stringify(await recordUrsReview(p,'revise','Ponoviti pokus i objasniti rezultat.'));assert.equal(await ursContentHash(p),hash);
 const w=readUrsWork(p)!;w.answers[0]='Izmijenjen odgovor';p.files[URS_WORK]=JSON.stringify(w);assert.notEqual(await ursContentHash(p),hash);assert((await ursSubmissionProject(p)).files['urs-predaja.md'].includes('ZASTARJELO'));
 await assert.rejects(()=>recordUrsReview(p,'reviewed',''),/opažanje/);
});
