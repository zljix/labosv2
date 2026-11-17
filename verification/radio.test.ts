import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {RadioClock} from '../public/radio-clock.mjs';
import {NRF24,RadioMedium} from '../public/nrf24.mjs';
import {radioNodeProject,type RadioTarget} from '../src/radio/examples';
import {createRadioExperiment} from '../src/radio/engine';
import {parseProject,clone} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {buildFile,validateArtifact} from '../public/arduino-contract.mjs';
import {compileCircuit} from '../src/circuit/compile';
import {createCircuitHost} from '../public/circuit-host.mjs';
const advance=(clock:any,to:number)=>{while(clock.next<=to)clock.fire();clock.now=to;};
function pair(){
 const clock=new RadioClock(),medium=new RadioMedium(clock),a=new NRF24('A',medium),b=new NRF24('B',medium);
 for(const r of [a,b]){r.power(true);for(const [reg,value]of [[0,12],[1,1],[2,1],[3,3],[4,0x13],[5,76],[6,6],[17,8],[0,14]])r.set(reg,value);for(let i=0;i<5;i++){r.set(10,'URS01'.charCodeAt(i),i);r.set(16,'URS01'.charCodeAt(i),i);}}
 advance(clock,5000);b.set(0,15);b.setCE(true);advance(clock,6000);return {clock,medium,a,b};
}
function send(a:any){a.begin();a.byte(160);for(const n of [42,1,2,3,4,5,6,7])a.byte(n);a.end();a.setCE(true);}
function read(r:any,n=8){r.begin();r.byte(97);const out=Array.from({length:n},()=>r.byte(0));r.end();return out;}
test('24M completed RX telemetry requires all payload bytes and CS completion',()=>{
 const {clock,a,b}=pair();send(a);advance(clock,10000);
 b.begin();b.byte(97);for(let i=0;i<8;i++)b.byte(0);
 assert.equal(b.readings.length,0);b.end();assert.equal(b.readings.length,1);
 assert.deepEqual(b.readings[0].bytes,[42,1,2,3,4,5,6,7]);assert.equal(b.readings[0].from,'A');
 a.setCE(false);a.set(7,112);send(a);advance(clock,20000);read(b,1);assert.equal(b.readings.length,1);
 for(let i=0;i<100;i++){b.begin();b.byte(5);b.byte(0);b.end();}assert.equal(b.transfers.length,64);
});
test('NRF24: reset, one-byte status and FIFO status have independent known values',()=>{const c=new RadioClock(),r=new NRF24('A',new RadioMedium(c));assert.equal(r.status,14);assert.equal(r.get(23),17);assert.equal(r.get(5),2);assert.equal(r.get(3),3);r.begin();assert.equal(r.byte(255),14);r.end();});
test('NRF24: static packet crosses SPI FIFO; ACK sets TX_DS and removes TX entry',()=>{const {clock,a,b,medium}=pair();send(a);advance(clock,10000);assert.equal(a.get(7)&48,32);assert.equal(a.get(23)&16,16);assert.equal(b.get(7)&64,64);assert.deepEqual(read(b),[42,1,2,3,4,5,6,7]);assert.equal(b.get(23)&1,1);assert.deepEqual(medium.trace.map((e:any)=>e.kind),['tx','rx','ack']);assert.equal(medium.trace[1].timeUs,6277);assert.equal(medium.trace[2].timeUs,6480);});
for(const [label,modify]of [['channel',(b:any)=>b.set(5,77)],['address',(b:any)=>b.set(10,90,0)],['length',(b:any)=>b.set(17,7)],['rate',(b:any)=>b.set(6,14)],['CRC',(b:any)=>b.set(0,10)]]as const){
 test('NRF24: mismatched '+label+' gives 4 attempts, MAX_RT and retained payload',()=>{const {clock,a,b,medium}=pair();b.setCE(false);modify(b);if(label==='CRC')b.set(0,11);b.setCE(true);advance(clock,7000);send(a);advance(clock,15000);assert.equal(a.get(7)&48,16);assert.equal(a.snapshot().txFifo,1);assert.equal(a.get(8),0x13);assert.equal(b.snapshot().rxFifo,0);assert.equal(medium.trace.filter((e:any)=>e.kind==='tx').length,4);});
}
test('NRF24: lost first ACK retries once and suppresses duplicate FIFO delivery',()=>{const {clock,a,b,medium}=pair();medium.impair({dropAck:1});send(a);advance(clock,12000);assert.equal(a.get(7)&48,32);assert.equal(a.arc,1);assert.equal(b.received,1);assert.equal(b.snapshot().rxFifo,1);assert.equal(medium.trace.filter((e:any)=>e.kind==='rx').length,2);assert.equal(medium.trace.find((e:any)=>e.duplicate)?.kind,'rx');});
test('NRF24: lost first data retries once, then delivers one packet',()=>{const {clock,a,b,medium}=pair();medium.impair({dropData:1});send(a);advance(clock,12000);assert.equal(a.arc,1);assert.equal(b.received,1);assert.equal(a.sent,1);});
test('NRF24: no auto-ACK completes even with no listening peer',()=>{const {clock,a,b}=pair();b.setCE(false);a.set(1,0);send(a);advance(clock,10000);assert.equal(a.sent,1);assert.equal(b.received,0);assert.equal(a.arc,0);});
test('NRF24: sender pipe-0 address must match TX address for auto-ACK',()=>{const {clock,a,b}=pair();a.set(10,90,0);send(a);advance(clock,15000);assert.equal(a.failed,1);assert.equal(b.received,1);assert.equal(b.snapshot().rxFifo,1);});
test('NRF24: full RX FIFO rejects new packets; status flags are write-one-clear',()=>{const {clock,a,b}=pair();for(let i=0;i<4;i++){a.setCE(false);a.set(7,112);send(a);advance(clock,clock.now+6000);}assert.equal(b.snapshot().rxFifo,3);assert.equal(a.failed,1);assert.equal(b.get(23)&2,2);b.set(7,64);assert.equal(b.get(7)&64,0);assert.equal(b.snapshot().rxFifo,3);});
test('NRF24: CE below 10 us and power-up below 1.5 ms do not send',()=>{const {clock,a}=pair();send(a);advance(clock,6009);a.setCE(false);advance(clock,12000);assert.equal(a.sent,0);a.set(0,12);a.set(0,14);a.setCE(true);advance(clock,13000);assert.equal(a.sent,0);});
test('NRF24: power loss aborts pending ACK and clears FIFO, not another node',()=>{const {clock,a,b}=pair();send(a);advance(clock,6200);a.power(false);advance(clock,12000);assert.equal(a.sent,0);assert.equal(a.snapshot().txFifo,0);assert.equal(b.powered,true);});
test('NRF24: receiver power loss during ACK turnaround causes retries and MAX_RT',()=>{const {clock,a,b}=pair();send(a);advance(clock,6300);assert.equal(b.received,1);b.power(false);advance(clock,15000);assert.equal(a.sent,0);assert.equal(a.failed,1);});
test('NRF24: payload boundaries, address width and all six receive pipes',()=>{for(const width of [3,4,5])for(let pipe=0;pipe<6;pipe++)for(const size of [1,32]){const {clock,a,b}=pair();b.setCE(false);a.set(3,width-2);b.set(3,width-2);b.set(2,1<<pipe);b.set(1,1<<pipe);b.set(17+pipe,size);const address=Array.from({length:width},(_,i)=>i===0?pipe+20:60+i);for(let i=0;i<width;i++){a.set(16,address[i],i);a.set(10,address[i],i);if(pipe<2)b.set(10+pipe,address[i],i);else{if(i===0)b.set(10+pipe,address[i]);b.set(11,i===0?19:address[i],i);}}b.setCE(true);advance(clock,7000);a.begin();a.byte(160);for(let i=0;i<size;i++)a.byte(i);a.end();a.setCE(true);advance(clock,15000);assert.equal(a.sent,1);assert.equal((b.status>>1)&7,pipe);assert.deepEqual(read(b,size),Array.from({length:size},(_,i)=>i));}});
test('NRF24: unsupported dynamic features and malformed commands fail explicitly',()=>{const {a}=pair();for(const [reg,value]of [[29,4],[28,1],[3,0],[5,126],[17,33],[6,40]])assert.throws(()=>a.set(reg,value));for(const cmd of [0x50,0xa8,0xb0,0x60,0xe3]){a.begin();assert.throws(()=>a.byte(cmd));}});
test('SPI wiring: missing power, MISO, swapped signals and invalid mode do not fake register read',()=>{
 for(const fault of ['none','power','miso','swap','mode']){
  const p=radioNodeProject('micropython','tx');assert.equal(p.circuit.kind,'editable');const c=p.circuit as any;
  if(fault==='power')c.wires=c.wires.filter((w:any)=>w.to.pin!=='VCC');if(fault==='miso')c.wires=c.wires.filter((w:any)=>w.to.pin!=='MISO');if(fault==='swap'){const sck=c.wires.find((w:any)=>w.to.pin==='SCK'),mosi=c.wires.find((w:any)=>w.to.pin==='MOSI');[sck.from.pin,mosi.from.pin]=[mosi.from.pin,sck.from.pin];}
  const h=createCircuitHost(()=>{},{circuit:compileCircuit(c),nowUs:()=>10000,manualPublish:true});for(const n of [4,10,11,12])h.mode(n,1,0,n===10?1:0);h.mode(13,0);h.spiConfig(1,12,11,13,1000000,fault==='mode'?1:0,0);h.write(10,0);const out=h.spiExchange(1,Uint8Array.of(5,0));h.write(10,1);assert.ok(out instanceof Uint8Array);assert.equal(out[1],fault==='none'?2:255,fault);h.dispose();
 }
});
test('project format 4 roundtrips both nodes through JSON and ZIP and rejects nesting',()=>{const p=radioNodeProject('micropython','tx');p.schemaVersion=4;p.radio={version:1,peer:radioNodeProject('uno','rx')};const valid=parseProject(p);assert.deepEqual(importProject(exportZip(valid),'pair.zip'),valid);assert.deepEqual(parseProject(JSON.parse(JSON.stringify(valid))),valid);const nested=clone(valid);nested.radio!.peer=clone(valid);assert.throws(()=>parseProject(nested));const unknown=clone(valid)as any;unknown.schemaVersion=5;assert.throws(()=>parseProject(unknown));});
test('network ZIP preserves a large escaped peer without truncating source',()=>{const p=radioNodeProject('micropython','tx');p.schemaVersion=4;p.radio={version:1,peer:radioNodeProject('micropython','rx')};for(let i=0;i<8;i++)p.radio.peer.files['note'+i+'.txt']='\n'.repeat(120000);const valid=parseProject(p);assert.deepEqual(importProject(exportZip(valid),'pair.zip'),valid);});
async function nodeProject(target:RadioTarget,role:'tx'|'rx'){
 const p=radioNodeProject(target,role);if(p.language==='arduino-cpp'){const artifacts=JSON.parse(readFileSync('public/radio-examples.json','utf8'));p.files[buildFile(p)]=JSON.stringify(await validateArtifact(p,artifacts[target][role]));}return p;
}
async function execute(a:RadioTarget,b:RadioTarget,fault?:string){
 const pa=await nodeProject(a,'tx'),pb=await nodeProject(b,'rx');
 if(fault==='channel'){assert.equal(b,'micropython');pb.files['main.py']=pb.files['main.py'].replace('channel=76','channel=77');}
 if(fault==='address'){assert.equal(b,'micropython');pb.files['main.py']=pb.files['main.py'].replace('URS01','URS02');}
 const events:any[]=[],exp=await createRadioExperiment([pa,pb],e=>events.push(e),{machine:readFileSync('public/machine.py','utf8'),runtimeBase:pathToFileURL(process.cwd()+'/public/').href});
 if(fault==='ack')exp.impair({dropAck:1});if(fault==='data')exp.impair({dropData:1});
 try{await exp.advanceUntil(1150000);exp.frame();const text=(id:string)=>events.filter(e=>e.node===id&&e.type==='console').map(e=>e.text).join('');return {a:text('A'),b:text('B'),trace:exp.medium.trace,radios:exp.medium.radios.map((r:any)=>r.snapshot())};}finally{exp.stop();}
}
for(const [a,b]of (['micropython','s3-cpp','uno','nano']as RadioTarget[]).flatMap(a=>(['micropython','s3-cpp','uno','nano']as RadioTarget[]).map(b=>[a,b]as const))){test('real programs share packets and ACK: '+a+' → '+b,async()=>{const r=await execute(a,b);assert.match(r.a,/TX 1 ACK/);assert.match(r.a,/TX 10 ACK/);assert.match(r.b,/RX 1\r?\n/);assert.match(r.b,/RX 10\r?\n/);assert.equal(r.trace.filter(e=>e.kind==='ack').length,10);assert.equal(r.radios[1].received,10);});}
for(const fault of ['channel','address','ack','data'])test('real MicroPython programs: '+fault,async()=>{const r=await execute('micropython','micropython',fault);if(['channel','address'].includes(fault)){assert.match(r.a,/MAX_RT/);assert.doesNotMatch(r.b,/RX 1\n/);assert.equal(r.radios[1].received,0);}else{assert.match(r.a,/TX 1 ACK/);assert.equal((r.b.match(/RX 1\n/g)??[]).length,1);assert.ok(r.trace.some(e=>e.kind==='retry'));}});
