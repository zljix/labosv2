import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pilotChecks,createPilotRecord,importPilotRecord} from '../public/pilot-record.mjs';
const config={lessons:['V1','gpio/button','spi/spiDashboard','storage/sdFiles','radio/radio'],appVersion:JSON.parse(readFileSync('package.json','utf8')).version};
const stamp='2026-11-14T14:30:00.000Z';
const draft=()=>({participant:'',date:'',appVersion:config.appVersion,computer:'',browser:'',minutes:'',assistance:'',issues:'',measurements:'',conclusion:'',recordKind:'unselected',input:'Miš i tipkovnica',target:'s3-cpp',peer:'none',outcome:'unconfirmed',offlineMethod:'untried',lesson:'V1',...Object.fromEntries(pilotChecks.map(k=>[k,false]))});
const completed=()=>({...draft(),recordKind:'pupil',participant:'U01',date:'2026-11-14',computer:'i5, 8 GB, Windows',browser:'Chrome — stvarna inačica',minutes:'12.5',conclusion:'Učenik je samostalno uvezao i ponovio pokus.',outcome:'independent'});
test('an empty draft round-trips without acquiring a completed outcome or checked steps',()=>{
 const r=createPilotRecord(draft(),config,stamp),restored=importPilotRecord(JSON.stringify(r),config.lessons);
 assert.equal(r.classification,'draft');assert.deepEqual(restored.observations,r.observations);assert(pilotChecks.every(k=>!r.observations[k]));
});
test('a completed outcome needs explicit scope, environment, duration and conclusion',()=>{
 assert.throws(()=>createPilotRecord({...draft(),outcome:'independent'},config,stamp),/Odaberi[\s\S]*datum[\s\S]*računalo[\s\S]*trajanje[\s\S]*zaključak/);
 const r=createPilotRecord(completed(),config,stamp);assert.equal(r.classification,'pupil');assert.equal(r.version,3);
});
test('a pupil record needs a participant code; device/development records do not invent one',()=>{
 assert.throws(()=>createPilotRecord({...completed(),participant:''},config,stamp),/oznaku učenika/);
 for(const recordKind of ['device','development']){const r=createPilotRecord({...completed(),recordKind,participant:''},config,stamp);assert.equal(r.classification,recordKind);}
});
test('assisted and blocked outcomes retain their different required observations',()=>{
 assert.throws(()=>createPilotRecord({...completed(),outcome:'assisted'},config,stamp),/pruženu pomoć/);
 assert.throws(()=>createPilotRecord({...completed(),outcome:'blocked'},config,stamp),/blokirao/);
 const r=createPilotRecord({...completed(),outcome:'blocked',issues:'Program se ne otvara.',submission:false,code:false},config,stamp);assert.equal(r.observations.outcome,'blocked');assert(!r.observations.submission);
});
test('offline claims need both a method and measured procedure, while untried drafts remain saveable',()=>{
 assert.throws(()=>createPilotRecord({...completed(),offline:true},config,stamp),/offline pokus/);
 assert.throws(()=>createPilotRecord({...completed(),offline:true,offlineMethod:'pwa'},config,stamp),/offline pokus/);
 for(const offlineMethod of ['pwa','local-http'])assert.equal(createPilotRecord({...completed(),offline:true,offlineMethod,measurements:'Pripremljeno, zatvoreno, isključena mreža, ponovno otvoreno.'},config,stamp).observations.offlineMethod,offlineMethod);
 assert.equal(createPilotRecord({...draft(),offline:true},config,stamp).classification,'draft');
});
test('radio requires an explicit peer and single-board records reject an accidental second node',()=>{
 assert.throws(()=>createPilotRecord({...completed(),lesson:'radio/radio'},config,stamp),/čvora B/);
 assert.equal(createPilotRecord({...completed(),lesson:'radio/radio',peer:'nano'},config,stamp).observations.peer,'nano');
 assert.throws(()=>createPilotRecord({...completed(),peer:'uno'},config,stamp),/samo za radio/);
});
test('v2 records retain observations and import with unknown scope and untried offline method',()=>{
 const observations=completed();delete observations.recordKind;delete observations.offlineMethod;
 const old={format:'esp32-lab-pilot',version:2,generatedForVersion:'0.12.3-beta.1',recordedAt:stamp,observations};
 const r=importPilotRecord(JSON.stringify(old),config.lessons);assert.equal(r.sourceVersion,2);assert.equal(r.observations.recordKind,'unselected');assert.equal(r.observations.outcome,'independent');assert.throws(()=>createPilotRecord(r.observations,config,stamp),/Odaberi/);
});
test('untrusted classification and extra fields cannot turn a draft/development record into pupil evidence',()=>{
 const r=createPilotRecord({...completed(),recordKind:'development',classification:'pupil'},config,stamp);r.classification='pupil';r.observations.extra='<script>unsafe()</script>';
 const restored=importPilotRecord(JSON.stringify(r),config.lessons);assert(!Object.hasOwn(restored.observations,'extra'));assert.equal(createPilotRecord(restored.observations,config,stamp).classification,'development');
});
test('text survives JSON round-trip as text, including markup and Croatian characters',()=>{
 const r=createPilotRecord({...draft(),issues:'Čćžšđ <img src=x onerror=alert(1)> & "opažanje"'},config,stamp);
 assert.equal(importPilotRecord(JSON.stringify(r),config.lessons).observations.issues,r.observations.issues);
});
test('malformed files, unsupported versions and oversized input are rejected before replacing fields',()=>{
 const valid=createPilotRecord(draft(),config,stamp);
 for(const text of ['{','null','[]',JSON.stringify({...valid,version:99}),JSON.stringify({...valid,format:'other'}),' '.repeat(131073)])assert.throws(()=>importPilotRecord(text,config.lessons));
});
test('invalid targets, unknown lessons and nonboolean step assertions are rejected',()=>{
 for(const change of [{target:'esp32-cam'},{lesson:'invented'},{stop:'true'},{input:'robot'},{offlineMethod:'emulated'}])assert.throws(()=>createPilotRecord({...draft(),...change},config,stamp));
});
test('limits and actual calendar dates are checked independently from draft completion',()=>{
 for(const change of [{date:'2026-02-30'},{date:'2026-13-01'},{minutes:'-1'},{minutes:'1000.1'},{minutes:'Infinity'},{issues:'x'.repeat(6001)}])assert.throws(()=>createPilotRecord({...draft(),...change},config,stamp));
 assert.equal(createPilotRecord({...draft(),date:'2024-02-29',minutes:'0'},config,stamp).observations.minutes,'0');
});
test('generated page exposes record recovery and all offline assets without inline legacy save code',()=>{
 const page=readFileSync('public/pilot.html','utf8');for(const id of ['restore','record-file','draft','save','status'])assert(page.includes('id="'+id+'"'));
 assert(page.includes('src="/pilot-form.mjs"'));assert(page.includes('data-app-version="'+config.appVersion+'"'));assert(!page.includes('Object.fromEntries(new FormData(form))'));
 const guide=readFileSync('public/guide.html','utf8');assert(guide.includes('ukupno '+JSON.parse(readFileSync('public/urs-catalog-summary.json','utf8')).total+' kombinacija'));assert(!guide.includes('a 33 na S3'));assert(guide.includes('id="guide-version">'+config.appVersion+'<'));
});
