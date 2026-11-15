import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {iliCircuit,iliExamples,cppILI9341,type ILIExample} from '../src/circuit/ili9341Examples';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {checkCircuit} from '../src/circuit/netlist';
import {parseCircuit,terminals,makePart,type Circuit} from '../src/circuit/model';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {newProject,parseProject} from '../src/project/model';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {validateArtifact} from '../public/avr-contract.mjs';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {Session} from '../dist/session.mjs';
const keys=Object.keys(iliExamples)as ILIExample[];
const frame=(e:any[])=>e.filter(x=>x.type==='simulation').at(-1)as SimulationFrame;
const tft=(s:SimulationFrame)=>s.tfts!.tft1;
const pyFiles=Object.fromEntries(['lab_ili9341.py','lab_bmp280_spi.py','lab_i2c_sensors.py'].map(n=>[n,readFileSync('public/drivers/'+n,'utf8')]));
const marker=(key:ILIExample)=>({iliGraphics:'ILI GRAPHICS READY',iliRotation:'ILI ROT=3 320x240',iliPartial:'ILI PARTIAL=1',iliDashboard:'ILI DASH T=24.00 P='})[key];
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
const python=(key:ILIExample,code:string=iliExamples[key].code,c=iliCircuit(key))=>new Session(factory,readFileSync('public/machine.py','utf8'),code,{circuit:compileCircuit(c)},()=>{},pyFiles);
mkdirSync('docs/stage17a-evidence',{recursive:true});
function evidence(name:string,console:string,s:SimulationFrame,extra={}){
 const d=tft(s),{pixels,...display}=d;
 writeFileSync('docs/stage17a-evidence/'+name+'.json',JSON.stringify({console,display,pixels: {length:pixels.length,sha256:createHash('sha256').update(JSON.stringify(pixels)).digest('hex'),nonzero:pixels.filter(Boolean).length,first:pixels[0],last:pixels.at(-1)},diagnostics:s.diagnostics,memory:s.avr?.memory,...extra},null,2)+'\n');
}
function fixture(edit=(c:Circuit)=>{}){
 const c=iliCircuit('iliDashboard');edit(c);let now=0;const events:any[]=[];
 const h=createCircuitHost((e:any)=>{events.push(e);if(events.length>10)events.shift();},{circuit:compileCircuit(c),logicVoltage:3.3,nowUs:()=>now,manualPublish:true});
 for(const [pin,value]of [[10,1],[7,1],[9,0],[8,1],[12,0],[11,0]])h.mode(pin,1,0,value);h.mode(13,0);now=200000;
 const bus={sck:12,mosi:11,miso:13,freq:1000000,mode:0,firstbit:0};
 const set=(p:number,v:number)=>h.write(p,v),wait=(us:number)=>{now+=us;};
 const xfer=(bytes:number[],override={})=>Array.from(h.spiTransfer({...bus,...override},Uint8Array.from(bytes)))as number[];
 const command=(cmd:number,a:number[]=[])=>{set(9,0);set(10,0);xfer([cmd]);if(a.length){set(9,1);xfer(a);}set(10,1);};
 const init=()=>{command(0x11);wait(130000);command(0x3a,[0x55]);command(0x36,[0x48]);command(0x29);};
 const window=(x:number,y:number,w=1,hh=1)=>{command(0x2a,[x>>8,x&255,(x+w-1)>>8,(x+w-1)&255]);command(0x2b,[y>>8,y&255,(y+hh-1)>>8,(y+hh-1)&255]);command(0x2c);};
 const data=(b:number[])=>{set(9,1);set(10,0);xfer(b);set(10,1);};
 const snap=()=>{h.flush();return frame(events);};
 return {c,h,set,wait,xfer,command,init,window,data,snap};
}
test('all four examples on three boards round-trip and exact visible drivers/artifacts survive exports',async()=>{
 const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
 assert.equal(cppILI9341,readFileSync('public/drivers/lab_ili9341.h','utf8'));
 for(const board of [S3,UNO,NANO]as const)for(const key of keys){
  const p=board===S3?newProject(iliExamples[key].code,iliExamples[key].title):arduinoExampleProject(key,board);p.circuit=iliCircuit(key,board);
  if(board===S3)Object.assign(p.files,pyFiles);
  assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.deepEqual(checkCircuit(p.circuit).diagnostics,[]);
  assert.deepEqual(importProject(exportZip(p),'ili.zip'),parseProject(p));
  if(board!==S3){assert.equal(p.files['lab_ili9341.h'],cppILI9341);await validateArtifact(p,artifacts[board][key]);assert(exportSketch(p).length>0);assert(artifacts[board][key].staticRamBytes<1000);}
 }
});
test('16-bit y=319, RGB565 byte order/split and row-major window wrap are actual RAM writes',()=>{
 const f=fixture();try{f.init();f.window(238,318,2,2);f.data([0xf8]);f.data([0,7,0xe0,0,31,255,255]);const d=tft(f.snap());assert.equal(d.pixels.length,76800);assert.deepEqual([d.pixels[318*240+238],d.pixels[318*240+239],d.pixels[319*240+238],d.pixels[76799]],[0xf800,0x07e0,31,65535]);assert.equal(d.written,4);f.data([0,0]);assert.equal(tft(f.snap()).pixels[318*240+238],0);}finally{f.h.dispose();}
});
for(const [r,m,w,h,first,last]of [[0,0x48,240,320,0,76799],[1,0x28,320,240,239,76560],[2,0x88,240,320,76799,0],[3,0xe8,320,240,76560,239]])test(`rectangular rotation ${r}: logical ${w}x${h}, both far corners and fixed physical RAM`,()=>{
 const f=fixture();try{f.init();f.command(0x36,[m]);f.window(0,0);f.data([0xf8,0]);f.window(w-1,h-1);f.data([7,0xe0]);const d=tft(f.snap());assert.equal(d.width,240);assert.equal(d.height,320);assert.equal(d.pixels[first],0xf800);assert.equal(d.pixels[last],0x07e0);assert.equal(d.pixels.filter(Boolean).length,2);}finally{f.h.dispose();}
});
test('full 76800-pixel fill and a smaller patch preserve pixels outside that patch',()=>{
 const f=fixture();try{f.init();f.window(0,0,240,320);for(let row=0;row<320;row++)f.data(Array(240).fill([0,31]).flat());assert.equal(tft(f.snap()).written,76800);f.window(100,270,2,2);f.data(Array(4).fill([0xf8,0]).flat());const d=tft(f.snap());assert.equal(d.pixels.filter(c=>c===0xf800).length,4);assert.equal(d.pixels.filter(c=>c===31).length,76796);}finally{f.h.dispose();}
});
test('BGR interpretation, inversion, display OFF, sleep and software reset preserve RAM',()=>{
 const f=fixture();try{f.init();f.command(0x36,[0x40]);f.window(0,0);f.data([0xf8,0]);assert.equal(tft(f.snap()).pixels[0],31);f.command(0x21);assert.equal(tft(f.snap()).pixels[0],65504);f.command(0x28);assert(tft(f.snap()).pixels.every(c=>!c));f.command(0x29);f.command(0x20);f.command(0x10);assert(tft(f.snap()).pixels.every(c=>!c));f.command(0x11);f.wait(130000);assert.equal(tft(f.snap()).pixels[0],31);f.command(1);assert(!tft(f.snap()).on);f.wait(130000);f.init();assert.equal(tft(f.snap()).pixels[0],31);}finally{f.h.dispose();}
});
test('CS HIGH, RESET LOW, minimum reset pulse and conservative startup wait gate writes',()=>{
 const f=fixture();try{f.init();f.window(0,0);f.set(9,1);f.xfer([0xf8,0]);assert.equal(tft(f.snap()).written,0);f.set(8,0);f.data([0xf8,0]);assert.equal(tft(f.snap()).written,0);f.wait(20);f.set(8,1);f.command(0x29);assert(!tft(f.snap()).on);assert(f.snap().diagnostics.some(d=>/120 ms/.test(d.message)));f.wait(130000);f.init();assert(tft(f.snap()).on);}finally{f.h.dispose();}
});
test('missing supply, ground, SCK, MOSI, CS, DC or RESET cannot create a valid image',()=>{
 for(const pin of ['VCC','GND','SCK','MOSI','CS','DC','RESET']){const f=fixture(c=>{c.wires=c.wires.filter(w=>!(w.to.component==='tft1'&&w.to.pin===pin));});try{f.init();f.window(0,0);f.data([0xf8,0]);assert.equal(tft(f.snap()).written,0,pin);}finally{f.h.dispose();}}
});
test('BL is separate from RAM writes; 5 V BL, wrong carrier and Nano A6 are rejected',()=>{
 const f=fixture(c=>{c.wires=c.wires.filter(w=>w.to.pin!=='BL');});try{f.init();f.window(0,0);f.data([0xf8,0]);assert.equal(tft(f.snap()).written,1);assert(!tft(f.snap()).backlight);assert(tft(f.snap()).pixels.every(c=>!c));}finally{f.h.dispose();}
 for(const board of [S3,UNO,NANO]as const){const c=iliCircuit('iliGraphics',board);c.wires.find(w=>w.to.pin==='BL')!.from.pin=terminals(c.components[0]).find(t=>t.role==='5v')!.pin;assert.throws(()=>compileCircuit(c,board===S3?'micropython':'avr'),/BL/);}
 const c=iliCircuit('iliGraphics',UNO);Object.assign(c.components.find(p=>p.kind==='ili9341')!.properties,{moduleVoltage:3.3,logicVoltage:3.3});assert.throws(()=>compileCircuit(c,'avr'),/prilagodbom/);
 const n=iliCircuit('iliGraphics',NANO);n.wires.find(w=>w.to.pin==='SCK')!.from.pin='A6';assert.throws(()=>compileCircuit(n,'avr'),/digitalni/);
});
test('mode 0/3 works; mode 1/2, LSB and excessive frequency cannot change pixels',()=>{
 for(const mode of [0,3]){const f=fixture();try{f.init();f.window(0,0);f.set(10,0);f.set(9,1);f.xfer([0xf8,0],{mode});assert.equal(tft(f.snap()).pixels[0],0xf800);}finally{f.h.dispose();}}
 for(const override of [{mode:1},{mode:2},{firstbit:1},{freq:11000000}]){const f=fixture();try{f.init();f.window(0,0);f.set(10,0);f.set(9,1);f.xfer([0xf8,0],override);assert.equal(tft(f.snap()).written,0);assert(f.snap().diagnostics.some(d=>d.code==='spi-protocol'));}finally{f.h.dispose();}}
});
test('invalid windows, unsupported MADCTL, RGB666, scroll and read commands are diagnosed',()=>{
 for(const [cmd,data,match]of [[0x2a,[0,0,0,240],/geometrije/],[0x2b,[1,64,1,65],/geometrije/],[0x36,[0x58],/MADCTL/],[0x3a,[0x66],/RGB565/],[0x33,[],/nije podržana/],[0x2e,[],/nije podržana/]]as [number,number[],RegExp][]){const f=fixture();try{f.init();f.command(cmd,data);assert(f.snap().diagnostics.some(d=>match.test(d.message)),JSON.stringify(f.snap().diagnostics));assert.equal(tft(f.snap()).written,0);}finally{f.h.dispose();}}
});
test('shared BMP280 CS is independent; two selected devices reject the transfer',()=>{
 const f=fixture();try{f.init();f.set(7,0);assert.deepEqual(f.xfer([0xd0,0]),[255,0x58]);f.set(7,1);f.window(0,0);f.set(7,0);f.data([0xf8,0]);assert.equal(tft(f.snap()).written,0);assert(f.snap().diagnostics.some(d=>/Istodobno/.test(d.message)));}finally{f.h.dispose();}
});
test('ILI9341 and ST7735 can share SCK/MOSI with independent RAM, geometry and format',()=>{
 const f=fixture(c=>{const p=makePart('st7735',800,100,'small');c.components.push(p);for(const w of c.wires.filter(w=>w.to.component==='tft1')){const n=structuredClone(w);n.id+='small';n.to.component='small';const g=({CS:6,DC:5,RESET:4}as Record<string,number>)[n.to.pin];if(g!==undefined)n.from.pin=terminals(c.components[0]).find(t=>t.gpio===g)!.pin;c.wires.push(n);}});
 try{for(const [p,v]of [[6,1],[5,0],[4,1]])f.h.mode(p,1,0,v);f.wait(150000);f.init();f.window(239,319);f.data([0xf8,0]);
  const cmd=(b:number,a:number[]=[])=>{f.set(5,0);f.set(6,0);f.xfer([b]);if(a.length){f.set(5,1);f.xfer(a);}f.set(6,1);};
  cmd(0x11);f.wait(130000);cmd(0x3a,[5]);cmd(0x36,[0xc8]);cmd(0x29);cmd(0x2a,[0,2,0,2]);cmd(0x2b,[0,3,0,3]);cmd(0x2c);f.set(5,1);f.set(6,0);f.xfer([7,0xe0]);f.set(6,1);
  const s=f.snap();assert.equal(tft(s).pixels[76799],0xf800);assert.equal(s.tfts!.small.pixels[0],0x07e0);assert.equal(s.tfts!.small.pixels.length,16384);assert.equal(s.diagnostics.length,0);
 }finally{f.h.dispose();}
});
for(const key of keys)test(`real MicroPython: ${key}, pixel dimensions and Stop retention`,async()=>{
 const s=python(key);try{await s.wait((s:Session)=>s.text.includes(marker(key))||s.status==='error',60000);assert.notEqual(s.status,'error',s.text+' '+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));const f=frame(s.events),d=tft(f);assert.equal(d.pixels.length,76800);assert(d.written>=76800);assert.equal(f.diagnostics.length,0,JSON.stringify(f.diagnostics));if(key==='iliGraphics')assert.deepEqual([d.pixels[0],d.pixels[80],d.pixels[160],d.pixels[76799]],[0xf800,0x07e0,31,0xf81f]);if(key==='iliRotation')for(const size of ['0 240x320','1 320x240','2 240x320','3 320x240'])assert(s.text.includes('ILI ROT='+size));evidence('python-'+key,s.text,f);const before=frame(s.events);assert(await s.stop()<500);assert.equal(frame(s.events),before);}finally{await s.stop();}
});
test('changing Python pixel data changes color; unchanged print alone cannot draw',async()=>{
 const s=python('iliGraphics',iliExamples.iliGraphics.code.replace('80, 48, 0xf800','80, 48, 0x001f'));try{await s.wait((s:Session)=>s.text.includes(marker('iliGraphics'))||s.status==='error',60000);assert.notEqual(s.status,'error',s.text);assert.equal(tft(frame(s.events)).pixels[0],31);}finally{await s.stop();}
 const p=python('iliGraphics','print("ILI GRAPHICS READY")\n');try{await p.wait((s:Session)=>['done','error'].includes(s.status));assert.equal(p.status,'done');assert.equal(tft(frame(p.events)).written,0);}finally{await p.stop();}
});
test('real MicroPython partial refresh changes only its window, preserving title and frame',async()=>{
 const s=python('iliPartial');try{await s.wait((s:Session)=>s.text.includes('ILI PARTIAL=0')||s.status==='error',60000);assert.notEqual(s.status,'error',s.text);const before=tft(frame(s.events)).pixels;await s.wait((s:Session)=>s.text.includes('ILI PARTIAL=1')||s.status==='error',60000);assert.notEqual(s.status,'error',s.text);const after=tft(frame(s.events)).pixels;let changes=0;for(let i=0;i<after.length;i++)if(after[i]!==before[i]){const x=i%240,y=Math.floor(i/240);assert(x>=30&&x<210&&y>=135&&y<205);changes++;}assert(changes>10000);evidence('python-partial-retention',s.text,frame(s.events),{changedPixels:changes});}finally{await s.stop();}
});
test('real MicroPython shared-bus environment update changes compensated reading and TFT pixels',async()=>{
 const s=python('iliDashboard');try{await s.wait((s:Session)=>s.text.includes('ILI DASH T=24.00')||s.status==='error',60000);assert.notEqual(s.status,'error',s.text);const before=tft(frame(s.events)).pixels;s.input({component:'bmpSPI',temperature:31,pressure:97000});await s.wait((s:Session)=>s.text.includes('T=31.00')||s.status==='error',60000);assert.notEqual(s.status,'error',s.text);const f=frame(s.events);assert(Math.abs(f.sensors.bmpSPI.measuredPressure!-97000)<2);assert.notDeepEqual(tft(f).pixels,before);evidence('python-live-environment',s.text,f);}finally{await s.stop();}
});
for(const board of [UNO,NANO]as const)for(const key of keys)test(`${board}: actual compiled ${key}, full 32-bit pixel count, SPI registers and SRAM`,()=>{
 const a=JSON.parse(readFileSync('public/avr-examples.json','utf8'))[board][key],events:any[]=[];let output='';
 const e=new AVREngine(a.hex,compileCircuit(iliCircuit(key,board),'avr'),(v:any)=>{events.push(v);if(events.length>30)events.shift();if(v.type==='console')output+=v.text;},board===NANO?8:6,a.staticRamBytes);
 try{for(let i=0;i<1800&&!(output.includes(marker(key))&&output.slice(output.indexOf(marker(key))).includes('\n'));i++){e.runCycles(800000);e.frame();}
  assert(output.includes(marker(key)),output);const f=frame(events),d=tft(f);assert.equal(f.diagnostics.length,0,JSON.stringify(f.diagnostics));assert(d.written>=76800);assert.equal(d.pixels.length,76800);assert(f.avr!.memory!.minFreeToStatic>200);if(key==='iliGraphics')assert.deepEqual([d.pixels[0],d.pixels[80],d.pixels[160],d.pixels[76799]],[0xf800,0x07e0,31,0xf81f]);evidence((board===UNO?'uno-':'nano-')+key,output,f,{flashBytes:a.flashBytes,staticRamBytes:a.staticRamBytes});
 }finally{e.dispose();}
});
test('packaged Nano Worker renders ILI9341 and remains forcibly stoppable within 500 ms',async()=>{
 const m=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=m.files.find((x:any)=>/^\/assets\/avrWorker-.*\.js$/.test(x.url)),a=JSON.parse(readFileSync('public/avr-examples.json','utf8'))[NANO].iliGraphics,events:any[]=[];let output='';
 assert(asset);const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
 try{await new Promise<void>((ok,bad)=>{const timer=setTimeout(()=>bad(Error('packaged ILI9341 Worker timeout')),60000);w.on('error',bad);w.on('message',e=>{events.push(e);if(events.length>20)events.shift();if(e.type==='console')output+=e.text;if(e.type==='error'){clearTimeout(timer);bad(Error(e.message));}else if(output.includes('ILI GRAPHICS READY')&&frame(events)?.tfts?.tft1.pixels[76799]===0xf81f){clearTimeout(timer);ok();}});w.postMessage({type:'run',session:170,hex:a.hex,circuit:compileCircuit(iliCircuit('iliGraphics',NANO),'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});});const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);evidence('packaged-nano-worker',output,frame(events),{version:m.version,build:m.build,stopMs,scope:'Node/Linux packaged Worker'});}finally{await w.terminate();}
});
