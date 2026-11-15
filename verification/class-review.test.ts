import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {createUrsProject,ursTargets,URS_WORK,type UrsTarget} from '../src/lessons/ursCatalog';
import {readUrsWork,recordUrsSnapshot,recordUrsReview,exportUrsSubmission,ursContentHash,ursSourceHash} from '../src/lessons/ursWork';
import {clone,forkProject,newProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {inspectUrsSubmission,addReviewEntry,emptyReviewSession,editReviewNote,setReviewVerdict,exportReviewReport,importReviewReport,restoreReviewReport,reviewCSV,reviewedProject,exportReviewedProject,REVIEW_LIMITS,type ReviewSession} from '../src/lessons/classReview';

const originalFetch=globalThis.fetch;
globalThis.fetch=async(input:any)=>{const path=String(input).replace(/^\/app\/[^/]+\//,'');if(path.startsWith('/')||path.includes('..'))throw Error('Nedopušten testni resurs');return new Response(readFileSync(resolve('public',path)));};
test.after(()=>{globalThis.fetch=originalFetch;});
const stamp='2026-11-14T17:00:00.000Z';
async function complete(target:UrsTarget='micropython',radio=false){
 const p=await createUrsProject(radio?'radio':'gpio',radio?'radio':'blink',target,'nano'),w=readUrsWork(p)!;
 w.student='Probni učenik '+target;w.group='4.f';w.answers=w.answers.map((_,i)=>'Obrazloženje '+(i+1));w.observations={baseline:'LED izmjenjuje stanja.',change:'Dulje vrijeme daje dulji interval.',fault:'Bez vodiča nema svjetla; povratak vraća rad.'};
 p.files[URS_WORK]=JSON.stringify(w);p.files[URS_WORK]=JSON.stringify(await recordUrsSnapshot(p));return p;
}
async function single(target:UrsTarget='micropython'){
 const p=await complete(target),e=await inspectUrsSubmission(await exportUrsSubmission(p),'predaja.zip');
 return addReviewEntry(emptyReviewSession(),e);
}
function noted(s:ReviewSession,note='Ponovno pokrenuto i pregledani odgovori.'){
 const id=s.entries[0].contentHash;return setReviewVerdict(editReviewNote(s,id,note),id,'reviewed',stamp);
}
for(const target of Object.keys(ursTargets)as UrsTarget[])test(`class review: real ${target} ZIP, work, target and hashes`,async()=>{
 const p=await complete(target),bytes=await exportUrsSubmission(p),e=await inspectUrsSubmission(bytes,'učenik.ZIP');
 assert.equal(e.snapshot,'current');assert.equal(e.embeddedReview,'missing');assert.equal(e.review.verdict,'pending');assert.equal(e.answered,e.work.answers.length);assert.equal(e.observed,3);
 assert.equal(e.contentHash,await ursContentHash(p));assert.equal(e.sourceHash,await ursSourceHash(p));assert.deepEqual(e.project,importProject(bytes,'a.zip'));
});
test('radio: a changed peer source invalidates the snapshot and cannot inherit a note',async()=>{
 const p=await complete('uno',true),e=await inspectUrsSubmission(await exportUrsSubmission(p),'radio.zip');assert(e.project.radio);
 let session=noted(addReviewEntry(emptyReviewSession(),e));const records=importReviewReport(exportReviewReport(session,'test',stamp));
 p.radio!.peer.files['main.ino']+='\n// new peer source';
 const changed=await inspectUrsSubmission(exportZip(p),'changed.zip');assert.equal(changed.snapshot,'stale');assert.notEqual(changed.contentHash,e.contentHash);
 session=restoreReviewReport(emptyReviewSession(),records).session;session=addReviewEntry(session,changed);
 assert.equal(session.entries[0].review.verdict,'pending');assert.equal(session.waiting.length,1);
});
test('partial work and missing identity are inspectable, without treating blank fields as answered',async()=>{
 const p=await createUrsProject('gpio','blink','uno'),e=await inspectUrsSubmission(exportZip(p),'partial.zip');
 assert.equal(e.snapshot,'missing');assert.equal(e.answered,0);assert.equal(e.observed,0);assert.equal(e.work.student,'');
 const w=readUrsWork(p)!;w.answers[0]=' \n ';w.observations.baseline='\t';p.files[URS_WORK]=JSON.stringify(w);
 const blank=await inspectUrsSubmission(exportZip(p),'blank.zip');assert.equal(blank.answered,0);assert.equal(blank.observed,0);
});
test('JSON projects and forked titles retain the same content identity',async()=>{
 const p=await complete(),zip=await inspectUrsSubmission(exportZip(p),'a.zip'),copy=forkProject(p);copy.title='Nova kopija';
 const json=await inspectUrsSubmission(strToU8(JSON.stringify(copy)),'b.json');assert.equal(json.contentHash,zip.contentHash);
 const s=addReviewEntry(emptyReviewSession(),zip);assert.throws(()=>addReviewEntry(s,json),/Isti sadržaj/);assert.equal(s.entries.length,1);
});
test('embedded teacher claims are displayed separately and never mark the class row reviewed',async()=>{
 const p=await complete();p.files[URS_WORK]=JSON.stringify(await recordUrsReview(p,'reviewed','Uvezeni ručni zapis.'));
 const e=await inspectUrsSubmission(exportZip(p),'embedded.zip');assert.equal(e.embeddedReview,'current');assert.equal(e.review.verdict,'pending');assert.equal(e.review.note,'');
 const w=readUrsWork(p)!;w.answers[0]='Promijenjen odgovor';p.files[URS_WORK]=JSON.stringify(w);
 const changed=await inspectUrsSubmission(exportZip(p),'stale.zip');assert.equal(changed.embeddedReview,'stale');assert.equal(changed.snapshot,'current');
});
test('unknown work, intro V projects, corrupt ZIP, traversal, invalid JSON and oversized archives fail',async()=>{
 await assert.rejects(()=>inspectUrsSubmission(exportZip(newProject()),'plain.zip'),/valjan URS/);
 await assert.rejects(()=>inspectUrsSubmission(new Uint8Array([1,2,3]),'bad.zip'));
 await assert.rejects(()=>inspectUrsSubmission(strToU8('{'),'bad.json'));
 await assert.rejects(()=>inspectUrsSubmission(new Uint8Array(2*1024*1024+1),'big.zip'),/prevelika/);
 await assert.rejects(()=>inspectUrsSubmission(strToU8('{}'),'file.exe'),/ZIP paket/);
 await assert.rejects(()=>inspectUrsSubmission(zipSync({'../bad.py':strToU8('x')}),'unsafe.zip'),/putanja/);
 const p=await complete();p.files[URS_WORK]='{}';await assert.rejects(()=>inspectUrsSubmission(exportZip(p),'unknown.zip'),/valjan URS/);
 await assert.rejects(()=>inspectUrsSubmission(new Uint8Array(),'x'.repeat(201)),/Naziv/);
});
test('manual statuses require a note; editing it clears the final status and timestamp',async()=>{
 let s=await single();const id=s.entries[0].contentHash;
 assert.throws(()=>setReviewVerdict(s,id,'reviewed'),/upiši/);assert.throws(()=>setReviewVerdict(s,id,'revise'),/upiši/);
 s=noted(s);assert.equal(s.entries[0].review.recordedAt,stamp);assert(s.dirty);
 s=editReviewNote(s,id,'Nova bilješka');assert.equal(s.entries[0].review.verdict,'pending');assert.equal(s.entries[0].review.recordedAt,undefined);
 s=setReviewVerdict(s,id,'revise',stamp);assert.equal(s.entries[0].review.verdict,'revise');
 assert.throws(()=>editReviewNote(s,id,'a'.repeat(3001)),/3000/);assert.throws(()=>editReviewNote(s,'0'.repeat(64),'x'),/više nije/);
 assert.throws(()=>setReviewVerdict(s,id,'__proto__'as any),/Nevaljan/);assert.throws(()=>setReviewVerdict(s,id,'reviewed','bad'),/vrijeme/);
});
test('JSON round trip restores notes whether the report or project is loaded first',async()=>{
 const s=noted(await single()),records=importReviewReport(exportReviewReport(s,'0.12.7-beta.1',stamp)),e=s.entries[0];
 let restored=restoreReviewReport(emptyReviewSession(),records).session;assert.equal(restored.waiting.length,1);
 restored=addReviewEntry(restored,{...e,review:{verdict:'pending',note:''}});assert.equal(restored.waiting.length,0);assert.equal(restored.entries[0].origin,'imported');assert.deepEqual(restored.entries[0].review,e.review);
 const other=restoreReviewReport(await single(),records);assert.equal(other.conflicts.length,0);assert.deepEqual(other.session.entries[0].review,e.review);
 assert.deepEqual(importReviewReport(exportReviewReport(restored,'test',stamp)),records);
});
for(const field of ['answer','observation','source','identity','circuit']as const)test(`restoration never attaches a note after ${field} changes`,async()=>{
 const s=noted(await single()),records=importReviewReport(exportReviewReport(s,'test',stamp)),p=clone(s.entries[0].project),w=readUrsWork(p)!;
 if(field==='answer')w.answers[0]+=' new';if(field==='observation')w.observations.fault+=' new';if(field==='identity')w.student+=' new';
 if(field==='source')p.files['main.py']+='\n# new';if(field==='circuit'&&p.circuit.kind==='editable')p.circuit.wires.pop();p.files[URS_WORK]=JSON.stringify(w);
 const e=await inspectUrsSubmission(exportZip(p),'same-name.zip'),next=addReviewEntry(restoreReviewReport(emptyReviewSession(),records).session,e);
 assert.notEqual(e.contentHash,s.entries[0].contentHash);assert.equal(next.waiting.length,1);assert.equal(next.entries[0].review.verdict,'pending');
});
test('restoring a different review never overwrites a local note or a waiting record',async()=>{
 const base=await single(),local=noted(base,'Lokalni pokus.'),imported=noted(base,'Drugo opažanje.'),records=importReviewReport(exportReviewReport(imported,'test',stamp));
 const r=restoreReviewReport(local,records);assert.deepEqual(r.conflicts,['predaja.zip']);assert.equal(r.session.entries[0].review.note,'Lokalni pokus.');
 const waiting=restoreReviewReport(emptyReviewSession(),importReviewReport(exportReviewReport(local,'test',stamp))).session;
 const conflict=restoreReviewReport(waiting,records);assert.equal(conflict.conflicts.length,1);assert.equal(conflict.session.waiting[0].note,'Lokalni pokus.');
 assert.equal(restoreReviewReport(local,importReviewReport(exportReviewReport(local,'test',stamp))).conflicts.length,0);
});
test('report schema rejects bad metadata, spoofed arrays, duplicates, missing notes and oversized text',async()=>{
 const valid=JSON.parse(exportReviewReport(noted(await single()),'test',stamp));
 for(const edit of [(d:any)=>d.version=2,(d:any)=>d.records.push(d.records[0]),(d:any)=>d.records[0].contentHash='x',(d:any)=>d.records[0].verdict='passed',(d:any)=>d.records[0].verdict=['reviewed'],(d:any)=>d.records[0].target=['uno'],(d:any)=>d.records[0].target='other',(d:any)=>d.records[0].note='',(d:any)=>delete d.records[0].recordedAt,(d:any)=>d.records[0].recordedAt='bad',(d:any)=>d.records[0].note='x'.repeat(3001),(d:any)=>d.records[0].student='x'.repeat(101),(d:any)=>d.records[0].lessonId='unknown',(d:any)=>d.records[0].filename='',(d:any)=>d.recordedAt='bad']){const d=structuredClone(valid);edit(d);assert.throws(()=>importReviewReport(JSON.stringify(d)));}
 assert.throws(()=>importReviewReport('{'),/JSON/);assert.throws(()=>importReviewReport(' '.repeat(REVIEW_LIMITS.reportBytes+1)),/512 KiB/);
 assert.throws(()=>exportReviewReport(emptyReviewSession(),'test'),/Najprije/);
});
test('capacity and record limits fail atomically and permit restoration at the limit',async()=>{
 const s=await single(),e=s.entries[0],full={...s,entries:Array.from({length:30},(_,i)=>({...e,contentHash:i.toString(16).padStart(64,'0')}))};
 assert.throws(()=>addReviewEntry(full,{...e,contentHash:'f'.repeat(64)}),/30 različitih/);assert.equal(full.entries.length,30);
 const record=importReviewReport(exportReviewReport(noted(s),'test',stamp))[0],records=Array.from({length:60},(_,i)=>({...record,contentHash:i.toString(16).padStart(64,'0')}));
 let waiting=restoreReviewReport(emptyReviewSession(),records).session;
 assert.throws(()=>addReviewEntry(waiting,{...e,contentHash:'f'.repeat(64)}),/60 različitih/);
 waiting=addReviewEntry(waiting,{...e,contentHash:records[0].contentHash});assert.equal(waiting.waiting.length,59);
 assert.throws(()=>restoreReviewReport(waiting,[{...record,contentHash:'f'.repeat(64)}]),/60 različitih/);assert.equal(waiting.waiting.length,59);
});
test('CSV contains all entries and unmatched notes, quotes multiline cells and neutralizes formulas',async()=>{
 const s=noted(await single(),'=HYPERLINK("https://example.invalid")\nDrugi red; "tekst"'),p=clone(s.entries[0].project),w=readUrsWork(p)!;
 w.student=' \t=1+1';w.group='@formula';p.files[URS_WORK]=JSON.stringify(w);
 const e=await inspectUrsSubmission(exportZip(p),'=predaja.zip');let both=addReviewEntry(s,e);both=noted(both,'=HYPERLINK("x")\nDrugi red; "tekst"');
 const csv=reviewCSV(both);assert(csv.startsWith('\ufeff'));assert(csv.includes('"\' \t=1+1"'));assert(csv.includes('"\'@formula"'));assert(csv.includes('"\'=predaja.zip"'));assert(csv.includes('"\'=HYPERLINK(""x"")\nDrugi red; ""tekst"""'));
 const waiting=restoreReviewReport(emptyReviewSession(),importReviewReport(exportReviewReport(s,'test',stamp))).session;assert(reviewCSV(waiting).includes('Predaja nije učitana'));
});
for(const target of Object.keys(ursTargets)as UrsTarget[])test(`reviewed ${target} ZIP preserves sources and snapshot, carries feedback and leaves original untouched`,async()=>{
 const s=noted(await single(target)),e=s.entries[0],original=JSON.stringify(e.project),bytes=await exportReviewedProject(e),p=importProject(bytes,'review.zip'),w=readUrsWork(p)!;
 assert.equal(w.review!.note,e.review.note);assert.equal(w.review!.recordedAt,stamp);assert.equal(w.review!.contentHash,e.contentHash);assert.equal(await ursContentHash(p),e.contentHash);assert.equal(await ursSourceHash(p),e.sourceHash);assert.equal(w.snapshot!.sourceHash,e.sourceHash);assert(p.files['urs-predaja.md'].includes(e.review.note));assert.equal(JSON.stringify(e.project),original);
 for(const name of Object.keys(e.project.files).filter(n=>!['urs-vjezba.json','urs-upute.md','urs-predaja.md'].includes(n)))assert.equal(p.files[name],e.project.files[name],name);
});
test('reviewed incomplete and stale projects carry feedback without a misleading old submission summary',async()=>{
 const p=await createUrsProject('gpio','blink','micropython');p.files['urs-predaja.md']='Sve je prošlo.';
 const e=await inspectUrsSubmission(exportZip(p),'partial.zip'),s=noted(addReviewEntry(emptyReviewSession(),e));
 const reviewed=await reviewedProject(s.entries[0]);assert.equal(readUrsWork(reviewed)!.review!.verdict,'reviewed');assert.equal(reviewed.files['urs-predaja.md'],undefined);assert.equal(readUrsWork(reviewed)!.snapshot,undefined);
 const done=noted(await single()),stale=clone(done.entries[0].project);stale.files['main.py']+='\n# changed';
 const q=await inspectUrsSubmission(exportZip(stale),'stale.zip'),z=noted(addReviewEntry(emptyReviewSession(),q)),out=await reviewedProject(z.entries[0]);
 assert.equal(out.files['urs-predaja.md'],undefined);assert.notEqual(readUrsWork(out)!.snapshot!.sourceHash,await ursSourceHash(out));
 const pending=await single();await assert.rejects(()=>reviewedProject(pending.entries[0]),/Najprije/);
 const changed={...done.entries[0],project:stale};await assert.rejects(()=>reviewedProject(changed),/promijenio/);
});
test('development fixture export uses the real submission and report formats',async()=>{
 const dir=process.env.LAB_CLASS_REVIEW_FIXTURES;if(!dir)return;
 mkdirSync(dir,{recursive:true});let session=emptyReviewSession();
 for(const target of Object.keys(ursTargets)as UrsTarget[]){const p=await complete(target),bytes=await exportUrsSubmission(p),name=target+'.zip';writeFileSync(resolve(dir,name),bytes);session=addReviewEntry(session,await inspectUrsSubmission(bytes,name));}
 const p=await complete();p.files['main.py']+='\n# changed after snapshot';writeFileSync(resolve(dir,'stale.zip'),exportZip(p));
 const partial=await createUrsProject('gpio','blink','uno');writeFileSync(resolve(dir,'incomplete.zip'),exportZip(partial));
 writeFileSync(resolve(dir,'broken.zip'),new Uint8Array([0,1,2]));
 session=noted(session);writeFileSync(resolve(dir,'evidence.json'),exportReviewReport(session,'0.12.7-beta.1',stamp));
});
