import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFile,writeFile} from 'node:fs/promises';
import {lessons,createLessonProject,readWork,WORK_FILE,RESULT_FILE} from '../src/lessons/catalog';
import {verifyLesson,sourceHash,readResult,containsFrameText,type LessonResult} from '../src/lessons/verify';
import {exportSubmission,submissionProject} from '../src/lessons/submission';
import {parseProject,newProject,forkProject,type Project} from '../src/project/model';
import {importProject,exportZip} from '../src/project/archive';
const machine=await readFile(new URL('../dist/machine.py',import.meta.url),'utf8');
const drivers=Object.fromEntries(await Promise.all(['aht10.py','ssd1306.py','servo.py'].map(async n=>[n,await readFile(new URL('../public/drivers/'+n,import.meta.url),'utf8')])));
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url));const shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',e=>shim.onerror?.(e));return shim;};
const run=(p:Project,signal?:AbortSignal)=>verifyLesson(p,{factory,machine},signal);
const results=new Map<string,LessonResult>();
const solution=(id:string)=>createLessonProject(id,drivers,true);
const allPass=(r:LessonResult)=>assert(r.checks.every(c=>c.passed),JSON.stringify(r.checks.filter(c=>!c.passed)));

test('five gradual lessons retain the project/ZIP format and editable work with known scenario IDs',()=>{
 assert.equal(lessons.length,5);
 for(const l of lessons){
  const p=createLessonProject(l.id,drivers);assert.equal(parseProject(p).schemaVersion,3);
  assert(l.concepts.length>=3&&l.steps.length>=4&&l.questions.length>=2);
  assert.equal(readWork(p)!.answers.length,l.questions.length);
  const q=importProject(exportZip(p),'vjezba.zip');assert.deepEqual(q,p);
  assert(p.files['upute.md'].includes('## Novi pojmovi'));assert(p.files['scenarij.json']);
 }
 assert(!readWork(newProject()));
 const p=solution('button');p.files[WORK_FILE]=p.files[WORK_FILE].replace('"lessonVersion": 1','"lessonVersion": 2');assert(!readWork(p));
});
for(const lesson of lessons)test(`actual WASM reference: V${lesson.number} ${lesson.title}`,async()=>{
 const p=solution(lesson.id),before=JSON.stringify(p),r=await run(p);allPass(r);results.set(lesson.id,r);assert.equal(JSON.stringify(p),before);
 assert.equal(r.sourceHash,await sourceHash(p));assert(r.checks.length>2);
});
test('behaviour checker accepts different variable names, helper functions, component IDs and GPIO',async()=>{
 const p=solution('led-time');assert.equal(p.circuit.kind,'editable');
 if(p.circuit.kind!=='editable')return;
 const led=p.circuit.components.find(c=>c.kind==='led')!;const prior=led.id;led.id='my_lamp';
 for(const w of p.circuit.wires)for(const ep of [w.from,w.to]){if(ep.component===prior)ep.component=led.id;if(ep.component==='esp32'&&ep.pin==='J1.4')ep.pin='J1.6';}
 p.files['main.py']='from machine import Pin\nfrom time import sleep_ms\noutput=Pin(6,Pin.OUT)\ndef phase(state,ms):\n output.value(state)\n sleep_ms(ms)\nwhile True:\n phase(1,250)\n phase(0,750)\n';
 allPass(await run(p));
});
test('constant output and wrong timing are rejected by observed LED behaviour',async()=>{
 const p=solution('led-time');p.files['main.py']='from machine import Pin\nPin(4,Pin.OUT,value=1)\n';
 const r=await run(p);assert(r.checks.some(c=>c.id==='cycles'&&!c.passed));
 const slow=solution('led-time');slow.files['main.py']=slow.files['main.py'].replace('sleep_ms(250)','sleep_ms(500)').replace('sleep_ms(750)','sleep_ms(500)');
 const wrong=await run(slow);assert(wrong.checks.some(c=>c.id==='on-time'&&!c.passed));
});
test('inverted button and fixed PWM cannot pass input/output scenarios',async()=>{
 const b=solution('button');b.files['main.py']=b.files['main.py'].replace('tipkalo.value() == 0','tipkalo.value() == 1');
 const br=await run(b);assert(br.checks.filter(c=>c.id.startsWith('button-')).every(c=>!c.passed));
 const p=solution('adc-pwm');p.files['main.py']=p.files['main.py'].replace('led.duty_u16(vrijednost)','led.duty_u16(32768)');
 const pr=await run(p);assert(pr.checks.some(c=>c.id==='ends'&&!c.passed));assert(pr.checks.some(c=>c.id==='mid'&&!c.passed));
});
test('OLED checker requires actual numeric pixels; console and changing temperatures alone do not pass',async()=>{
 const p=createLessonProject('aht-oled',drivers),r=await run(p);
 assert(r.checks.filter(c=>c.id.startsWith('sensor-')).every(c=>c.passed));
 assert(r.checks.filter(c=>c.id.startsWith('oled-')).every(c=>!c.passed));
 assert(!containsFrameText(new Array(1024).fill(255),'34.0'));
});
test('single-threshold regulator fails hysteresis while still passing the ordinary hot/cold states',async()=>{
 const p=createLessonProject('regulator',drivers),r=await run(p);
 assert(r.checks.find(c=>c.id==='servo-2')?.passed===false);
 assert(r.checks.find(c=>c.id==='servo-1')?.passed===true);
 assert(r.checks.find(c=>c.id==='servo-3')?.passed===true);
});
test('submission carries names, answers, source, drivers and result; metadata is not an authenticity proof',async()=>{
 const p=solution('regulator'),w=readWork(p)!;w.student='Probni Učenik';w.group='3.f';w.answers=w.answers.map((_,i)=>'Probno opažanje '+(i+1));p.files[WORK_FILE]=JSON.stringify(w);
 p.files[RESULT_FILE]=JSON.stringify(results.get('regulator'));
 const submitted=await submissionProject(p),q=importProject(await exportSubmission(p),'predaja.zip');
 const stable=(files:Record<string,string>)=>({...files,'predaja.md':files['predaja.md'].replace(/Pripremljeno: .*/,'Pripremljeno: [vrijeme izvoza]')});
 assert.deepEqual(stable(submitted.files),stable(q.files));assert(q.files['servo.py']);assert(q.files['predaja.md'].includes('Probni Učenik'));
 assert(q.files['predaja.md'].includes('nije ovjerena ocjena'));assert.equal(readWork(q)!.student,w.student);
 const fork=forkProject(q);assert.equal(await sourceHash(q),await sourceHash(fork));
 q.files['main.py']+='\n# izmjena nakon provjere\n';await assert.rejects(()=>submissionProject(q),/novu provjeru/);
});
test('missing answers are identified; failed attempts can be submitted without a false pass',async()=>{
 const p=solution('button'),w=readWork(p)!;p.files[RESULT_FILE]=JSON.stringify(results.get('button'));
 await assert.rejects(()=>submissionProject(p),/ime i prezime/);
 w.student='Probni Učenik';w.group='3.f';p.files[WORK_FILE]=JSON.stringify(w);await assert.rejects(()=>submissionProject(p),/sva pitanja/);
 w.answers=w.answers.map(()=>'Opis poteškoće');p.files[WORK_FILE]=JSON.stringify(w);
 const r=readResult(p)!;r.checks[1].passed=false;p.files[RESULT_FILE]=JSON.stringify(r);
 assert((await submissionProject(p)).files['predaja.md'].includes('POTREBAN ISPRAVAK'));
});
test('fingerprint detects executable-file or circuit edits, but not names, answers or editor preferences',async()=>{
 const p=solution('button'),hash=await sourceHash(p);
 p.title='Drugo ime';p.settings.theme='dark';p.files[WORK_FILE]=p.files[WORK_FILE].replace('"student": ""','"student": "Novo Ime"');
 assert.equal(await sourceHash(p),hash);p.files['podaci.txt']='utjece na program';assert.notEqual(await sourceHash(p),hash);
 delete p.files['podaci.txt'];if(p.circuit.kind==='editable')p.circuit.wires.pop();assert.notEqual(await sourceHash(p),hash);
});
test('untrusted scenario and forged local result do not influence an independent rerun',async()=>{
 const p=solution('button'),forged=structuredClone(results.get('button')!);
 p.files['main.py']='from machine import Pin\nPin(4,Pin.OUT,value=1)';forged.sourceHash=await sourceHash(p);
 p.files[RESULT_FILE]=JSON.stringify(forged);p.files['scenarij.json']='{"code":"all checks passed","expected":true}';
 assert(readResult(p)?.checks.every(c=>c.passed));
 const r=await run(p);assert(r.checks.some(c=>!c.passed));
});
test('abort terminates a non-yielding program and does not leave a session running',async()=>{
 const p=solution('led-time');p.files['main.py']='while True:\n pass\n';
 const abort=new AbortController(),start=performance.now();const t=setTimeout(()=>abort.abort(),350);
 try{await assert.rejects(()=>run(p,abort.signal),(e:any)=>e.name==='AbortError');assert(performance.now()-start<1300);}finally{clearTimeout(t);}
 allPass(await run(solution('button')));
});
test('invalid work cannot request an unknown scenario; older projects remain parseable',async()=>{
 const p=solution('button');p.files[WORK_FILE]=p.files[WORK_FILE].replace('"lessonId": "button"','"lessonId": "foreign-code"');
 await assert.rejects(()=>run(p),/podržanu vježbu/);
 const old=newProject('print("legacy")');assert.deepEqual(parseProject(old),old);assert(!readWork(old));
});
test('broken circuit and Python exceptions are reported as failure, never a successful empty check',async()=>{
 const p=solution('button');p.files['main.py']='raise ValueError("namjerna greska")';const r=await run(p);assert(r.checks.some(c=>c.id==='execution'&&!c.passed));
 const bad=solution('led-time');if(bad.circuit.kind==='editable')bad.circuit.wires.push({id:'shortcircuit',from:{component:'esp32',pin:'J1.1'},to:{component:'esp32',pin:'J1.22'},color:'#112233',points:[]});
 const b=await run(bad);assert.equal(b.checks.length,1);assert(!b.checks[0].passed);assert(b.checks[0].observed.includes('Kratki spoj'));
});
test('assessment documents are not hidden runtime inputs; ordinary text data remain available',async()=>{
 const p=solution('button');p.files['podaci.txt']='pritisnuto';
 p.files['main.py']='from machine import Pin\nfrom time import sleep_ms\nassert open("podaci.txt").read()=="pritisnuto"\ntry:\n open("provjera.json")\n raise AssertionError("Document was mounted")\nexcept OSError:\n pass\nled=Pin(4,Pin.OUT)\nb=Pin(5,Pin.IN,Pin.PULL_UP)\nwhile True:\n led.value(b.value()==0)\n sleep_ms(20)';
 p.files[RESULT_FILE]=JSON.stringify(results.get('button'));allPass(await run(p));
});
test('persist actual reference results as development evidence',async()=>{
 assert.equal(results.size,5);await writeFile(new URL('../docs/stage5-reference-results.json',import.meta.url),JSON.stringify({scope:'Node Worker, stvarni MicroPython WASM; razvojna provjera, nije učenički pilot',results:[...results.values()]},null,2)+'\n');
});
