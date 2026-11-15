import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {spiCircuit,spiExamples,type SPIExample} from '../src/circuit/spiExamples';
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
import {ST7735} from '../public/spi-devices.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {Session} from '../dist/session.mjs';
const keys=Object.keys(spiExamples)as SPIExample[];
const frame=(e:any[])=>e.filter(x=>x.type==='simulation').at(-1)as SimulationFrame;
const output=(e:any[])=>e.filter(x=>x.type==='console').map(x=>x.text).join('');
mkdirSync('docs/stage16-evidence',{recursive:true});
const save=(name:string,v:any)=>writeFileSync('docs/stage16-evidence/'+name+'.json',JSON.stringify(v,null,2)+'\n');
function fixture(key:SPIExample='spiDashboard',edit=(c:Circuit)=>{}){
 const c=spiCircuit(key);edit(c);let now=0;const events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c),logicVoltage:3.3,nowUs:()=>now,manualPublish:true});
 for(const [pin,value]of [[10,1],[7,1],[9,0],[8,1],[12,0],[11,0]])h.mode(pin,1,0,value);h.mode(13,0);
 now=200000;
 const bus={sck:12,mosi:11,miso:13,freq:1000000,mode:0,firstbit:0};
 const set=(pin:number,value:number)=>h.write(pin,value),wait=(us:number)=>{now+=us;};
 const xfer=(b:number[],override={})=>Array.from(h.spiTransfer({...bus,...override},Uint8Array.from(b)))as number[];
 const command=(cmd:number,data:number[]=[])=>{set(9,0);set(10,0);xfer([cmd]);if(data.length){set(9,1);xfer(data);}set(10,1);};
 const init=()=>{command(0x11);wait(130000);command(0x3a,[5]);command(0x36,[0xc8]);command(0x29);};
 const window=(x:number,y:number,w=1,hh=1)=>{command(0x2a,[0,x,0,x+w-1]);command(0x2b,[0,y,0,y+hh-1]);command(0x2c);};
 const data=(b:number[])=>{set(9,1);set(10,0);xfer(b);set(10,1);};
 const read=(reg:number,n:number)=>{set(7,0);xfer([reg|128]);const b=xfer(Array(n).fill(0));set(7,1);return b;};
 const write=(b:number[])=>{set(7,0);xfer(b);set(7,1);};
 const snap=()=>{h.flush();return frame(events);};
 return {c,h,events,command,init,window,data,read,write,set,wait,xfer,snap};
}
function tft(s:SimulationFrame){return s.tfts!.tft1;}
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
const files=Object.fromEntries(['lab_st7735.py','lab_bmp280_spi.py','lab_i2c_sensors.py'].map(n=>[n,readFileSync('public/drivers/'+n,'utf8')]));
function python(key:SPIExample,code=spiExamples[key].code,c=spiCircuit(key)){return new Session(factory,readFileSync('public/machine.py','utf8'),code,{circuit:compileCircuit(c)},()=>{},files);}
const marker=(key:SPIExample)=>({tftGraphics:'TFT GRAPHICS READY',tftRotation:'TFT ROT=3',bmp280SPI:'BMP280 SPI T=24.00 P=',spiDashboard:'SPI DASH T=24.00 P='})[key];

test('all SPI examples on three boards round-trip JSON/ZIP and preserve exact Arduino IDE sources/artifacts',async()=>{
 const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
 for(const board of [S3,UNO,NANO]as const)for(const key of keys){const p=board===S3?newProject(spiExamples[key].code,spiExamples[key].title):arduinoExampleProject(key,board);p.circuit=spiCircuit(key,board);assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.deepEqual(checkCircuit(p.circuit).diagnostics,[]);assert.deepEqual(importProject(exportZip(p),'spi.zip'),parseProject(p));if(board!==S3){await validateArtifact(p,artifacts[board][key]);assert(exportSketch(p).length>0);assert(artifacts[board][key].staticRamBytes<1000);}}
});
test('RGB565 red/green/blue, odd transfer split, window wrap, and wrong panel offset come only from bytes',()=>{
 const f=fixture();try{f.init();f.window(2,3,3);f.data([0xf8]);f.data([0,7,0xe0,0,0x1f]);let d=tft(f.snap());assert.deepEqual(d.pixels.slice(0,3),[0xf800,0x07e0,0x001f]);assert.equal(d.written,3);f.data([255,255]);d=tft(f.snap());assert.equal(d.pixels[0],65535);f.window(0,0);f.data([0xf8,0]);assert.equal(tft(f.snap()).pixels[0],65535);save('protocol-rgb-window',f.snap());}finally{f.h.dispose();}
});
for(const [r,m,ox,oy,index]of [[0,0xc8,2,3,0],[1,0xa8,3,2,127],[2,8,2,1,16383],[3,0x68,1,2,16256]])test(`rotation ${r} uses MADCTL, green-tab offsets and physical corner`,()=>{
 const f=fixture();try{f.init();f.command(0x36,[m]);f.window(ox,oy);f.data([0xf8,0]);const d=tft(f.snap());assert.equal(d.pixels[index],0xf800);assert.equal(d.pixels.filter(c=>c===0xf800).length,1);}finally{f.h.dispose();}
});
test('BGR bit swaps color interpretation; inversion, display OFF and sleep preserve RAM',()=>{
 const f=fixture();try{f.init();f.command(0x36,[0xc0]);f.window(2,3);f.data([0xf8,0]);assert.equal(tft(f.snap()).pixels[0],31);f.command(0x21);assert.equal(tft(f.snap()).pixels[0],65504);f.command(0x28);assert(tft(f.snap()).pixels.every(c=>c===0));f.command(0x29);f.command(0x20);assert.equal(tft(f.snap()).pixels[0],31);f.command(0x10);assert(tft(f.snap()).pixels.every(c=>c===0));f.command(0x11);f.wait(130000);assert.equal(tft(f.snap()).pixels[0],31);}finally{f.h.dispose();}
});
test('CS HIGH and RESET LOW ignore display writes; hardware reset needs 10 us and startup wait',()=>{
 const f=fixture();try{f.init();f.window(2,3);f.set(9,1);f.xfer([0xf8,0]);assert.equal(tft(f.snap()).written,0);f.set(8,0);f.data([0xf8,0]);assert.equal(tft(f.snap()).written,0);f.wait(20);f.set(8,1);f.command(0x29);assert(f.snap().diagnostics.some(d=>d.message.includes('120 ms')));assert(!tft(f.snap()).on);f.wait(130000);f.command(0x11);f.wait(130000);f.command(0x29);assert(tft(f.snap()).on);}finally{f.h.dispose();}
});
test('BL disconnected hides actual written pixels; 5 V BL is rejected on every board',()=>{
 const f=fixture('tftGraphics',c=>{c.wires=c.wires.filter(w=>w.to.pin!=='BL');});try{f.init();f.window(2,3);f.data([0xf8,0]);const d=tft(f.snap());assert.equal(d.written,1);assert(!d.backlight);assert(d.pixels.every(c=>c===0));}finally{f.h.dispose();}
 for(const board of [S3,UNO,NANO]as const){const c=spiCircuit('tftGraphics',board);c.wires.find(w=>w.to.pin==='BL')!.from.pin=terminals(c.components[0]).find(t=>t.role==='5v')!.pin;assert.throws(()=>compileCircuit(c,board===S3?'micropython':'avr'),/BL/);}
});
test('missing supply, common ground, SCK, MOSI, CS, DC or RESET prevents a valid TFT image',()=>{
 for(const pin of ['VCC','GND','SCK','MOSI','CS','DC','RESET']){const f=fixture('tftGraphics',c=>{c.wires=c.wires.filter(w=>w.to.pin!==pin);});try{f.init();f.window(2,3);f.data([0xf8,0]);assert.equal(tft(f.snap()).written,0,pin);}finally{f.h.dispose();}}
});
test('mode 0 and 3 both work, mode 1/2, LSB and excessive frequency cannot mutate the display',()=>{
 for(const mode of [0,3]){const f=fixture();try{f.init();f.window(2,3);f.set(9,1);f.set(10,0);f.xfer([0xf8,0],{mode});assert.equal(tft(f.snap()).pixels[0],0xf800);}finally{f.h.dispose();}}
 for(const override of [{mode:1},{mode:2},{firstbit:1},{freq:11000000}]){const f=fixture();try{f.init();f.window(2,3);f.set(9,1);f.set(10,0);f.xfer([0xf8,0],override);assert.equal(tft(f.snap()).written,0);assert(f.snap().diagnostics.some(d=>d.code==='spi-protocol'));}finally{f.h.dispose();}}
});
test('unsupported TFT commands/color depths fail explicitly, without guessed pixels',()=>{
 const f=fixture();try{f.init();f.command(0x3a,[6]);f.window(2,3);f.data([255,255]);assert(f.snap().diagnostics.some(d=>/RGB565/.test(d.message)));assert.equal(tft(f.snap()).written,0);f.command(0x33);assert(f.snap().diagnostics.some(d=>/nije podržana/.test(d.message)));}finally{f.h.dispose();}
});
test('BMP280 reads chip ID/calibration, mode status and pairs of register writes, with independent CS',()=>{
 const f=fixture();try{f.init();assert.deepEqual(f.read(0xd0,1),[0x58]);assert.deepEqual(f.read(0x88,2),[112,107]);f.write([0x75,0x20,0x74,0x25]);assert.equal(f.read(0xf3,1)[0]&8,8);f.wait(10000);assert.equal(f.read(0xf3,1)[0]&8,0);assert.notDeepEqual(f.read(0xf7,6),[128,0,0,128,0,0]);assert.equal(f.snap().measurements.length,1);assert.equal(tft(f.snap()).written,0);save('shared-bus-registers',f.snap());}finally{f.h.dispose();}
});
test('missing MISO returns 0xFF; two active CS reject ambiguous shared-bus transfers',()=>{
 const f=fixture('spiDashboard',c=>{c.wires=c.wires.filter(w=>w.to.pin!=='MISO');});try{assert.deepEqual(f.read(0xd0,1),[255]);assert(f.snap().diagnostics.some(d=>d.message.includes('MISO')));}finally{f.h.dispose();}
 const g=fixture();try{g.init();g.window(2,3);g.set(7,0);g.data([0xf8,0]);assert.equal(tft(g.snap()).written,0);assert(g.snap().diagnostics.some(d=>d.message.includes('Istodobno')));}finally{g.h.dispose();}
});
test('Nano A6/A7 and wrong 3.3/5 V SPI carrier cannot be used as digital SPI wiring',()=>{
 const n=spiCircuit('tftGraphics',NANO);n.wires.find(w=>w.to.pin==='SCK')!.from.pin='A6';assert.throws(()=>compileCircuit(n,'avr'),/digitalni/);
 const c=spiCircuit('tftGraphics',UNO);const p=c.components.find(p=>p.kind==='st7735')!;p.properties.moduleVoltage=3.3;p.properties.logicVoltage=3.3;assert.throws(()=>compileCircuit(c,'avr'),/3,3 V|prilagodbom/);
});
test('TFT memory is device-local and does not depend on console text',async()=>{
 const c=spiCircuit('tftGraphics');const s=python('tftGraphics','print("TFT GRAPHICS READY")\n',c);try{await s.wait((s:Session)=>['done','error'].includes(s.status));assert.equal(s.status,'done');assert.equal(tft(frame(s.events)).written,0);}finally{await s.stop();}
});
for(const key of keys)test(`real MicroPython executes ${key} using SPI bytes and Stop retains the frame`,async()=>{
 const s=python(key);try{await s.wait((s:Session)=>s.text.includes(marker(key))||s.status==='error',30000);assert.notEqual(s.status,'error',s.text+' '+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));const f=frame(s.events);assert(!f.diagnostics.some(d=>d.code==='spi-protocol'),JSON.stringify(f.diagnostics));if(key!=='bmp280SPI')assert(tft(f).written>10000);if(key==='tftGraphics')assert.deepEqual([tft(f).pixels[0],tft(f).pixels[42],tft(f).pixels[85]],[0xf800,0x07e0,31]);if(key==='bmp280SPI'||key==='spiDashboard'){assert(s.text.includes('T=24.00'),s.text);assert(Math.abs(f.sensors.bmpSPI.measuredPressure!-101325)<2);}save('python-'+key,{console:s.text,frame:f});const before=JSON.stringify(f);assert(await s.stop()<500);assert.equal(JSON.stringify(frame(s.events)),before);}finally{await s.stop();}
});
test('real MicroPython readinto/write_readinto, mode 3, deinit, SoftSPI and API validation',async()=>{
 const code=`from machine import Pin, SPI, SoftSPI\nfrom time import sleep_ms\ncs=Pin(7,Pin.OUT,value=1)\nbus=SPI(1,baudrate=500000,polarity=1,phase=1,sck=Pin(12),mosi=Pin(11),miso=Pin(13))\nsleep_ms(10)\ncs(0)\ntx=bytearray([0xd0,0])\nbus.write_readinto(tx,tx)\ncs(1)\nassert tx[1]==0x58\ncs(0)\nbus.write(b'\\xd0')\nr=bytearray(1)\nbus.readinto(r)\ncs(1)\nassert r[0]==0x58\nbus.deinit()\ntry:\n    bus.read(1)\n    assert False\nexcept OSError:\n    pass\nbus=SoftSPI(sck=Pin(12),mosi=Pin(11),miso=Pin(13))\ncs(0)\nbus.write(b'\\xd0')\nassert bus.read(1)==b'\\x58'\ncs(1)\nfor kwargs in ({'bits':16},{'firstbit':SPI.LSB},{'phase':1}):\n    try:\n        SPI(2,sck=Pin(12),mosi=Pin(11),**kwargs)\n        assert False\n    except NotImplementedError:\n        pass\nprint('SPI API PASS')\n`;
 const s=python('bmp280SPI',code);try{await s.wait((s:Session)=>['done','error'].includes(s.status));assert.equal(s.status,'done',s.text);assert(s.text.includes('SPI API PASS'));}finally{await s.stop();}
});
test('editing Python RGB565 data changes visible pixels despite the unchanged completion message',async()=>{
 const s=python('tftGraphics',spiExamples.tftGraphics.code.replace('42, 26, 0xf800','42, 26, 0x001f'));try{await s.wait((s:Session)=>s.text.includes(marker('tftGraphics'))||s.status==='error',30000);assert.notEqual(s.status,'error',s.text);assert.equal(tft(frame(s.events)).pixels[0],31);}finally{await s.stop();}
});
test('live BMP280 SPI environment changes the next compensated sample and TFT pixels',async()=>{
 const s=python('spiDashboard');try{await s.wait((s:Session)=>s.text.includes('SPI DASH T=24.00')||s.status==='error',30000);assert.notEqual(s.status,'error',s.text);const before=tft(frame(s.events)).pixels;s.input({component:'bmpSPI',temperature:-10,pressure:90000});await s.wait((s:Session)=>s.text.includes('T=-10.00')||s.status==='error',30000);assert.notEqual(s.status,'error',s.text);const f=frame(s.events);assert(Math.abs(f.sensors.bmpSPI.measuredPressure!-90000)<2);assert.notDeepEqual(tft(f).pixels,before);save('python-live-environment',{console:s.text,frame:f});}finally{await s.stop();}
});
for(const board of [UNO,NANO]as const)for(const key of keys)test(`${board}: real compiled ${key} uses actual SPI registers without full AVR framebuffer`,()=>{
 const a=JSON.parse(readFileSync('public/avr-examples.json','utf8'))[board][key],events:any[]=[],e=new AVREngine(a.hex,compileCircuit(spiCircuit(key,board),'avr'),(v:any)=>events.push(v),board===NANO?8:6,a.staticRamBytes);
 try{for(let i=0;i<1800&&!(output(events).includes(marker(key))&&output(events).slice(output(events).indexOf(marker(key))).includes('\n'));i++){e.runCycles(160000);e.frame();}assert(output(events).includes(marker(key)),output(events)+' '+JSON.stringify(frame(events)?.diagnostics));const f=frame(events);assert(!f.diagnostics.some(d=>d.code==='spi-protocol'),JSON.stringify(f.diagnostics));if(key!=='bmp280SPI')assert(tft(f).written>10000);if(key==='tftGraphics')assert.deepEqual([tft(f).pixels[0],tft(f).pixels[42],tft(f).pixels[85]],[0xf800,0x07e0,31]);if(key==='bmp280SPI'||key==='spiDashboard')assert(output(events).includes('T=24.00'),output(events));assert(f.avr!.memory!.minFreeToStatic>200);save((board===UNO?'uno-':'nano-')+key,{flashBytes:a.flashBytes,staticRamBytes:a.staticRamBytes,console:output(events),frame:f});}finally{e.dispose();}
});

test('two TFT devices sharing SCK/MOSI maintain independent windows, RAM and chip selects',()=>{
 const f=fixture('tftGraphics',c=>{
  const p=makePart('st7735',800,100,'tft2');c.components.push(p);
  for(const w of c.wires.filter(w=>w.to.component==='tft1')){const n=structuredClone(w);n.id+='copy';n.to.component='tft2';const gpio=({CS:6,DC:5,RESET:4}as Record<string,number>)[n.to.pin];if(gpio!==undefined)n.from.pin=terminals(c.components[0]).find(t=>t.gpio===gpio)!.pin;c.wires.push(n);}
 });
 try{for(const [p,v]of [[6,1],[5,0],[4,1]])f.h.mode(p,1,0,v);f.wait(150000);f.init();f.window(2,3);f.data([0xf8,0]);
  const cmd=(b:number,a:number[]=[])=>{f.set(5,0);f.set(6,0);f.xfer([b]);if(a.length){f.set(5,1);f.xfer(a);}f.set(6,1);};
  cmd(0x11);f.wait(130000);cmd(0x3a,[5]);cmd(0x36,[0xc8]);cmd(0x29);cmd(0x2a,[0,2,0,2]);cmd(0x2b,[0,3,0,3]);cmd(0x2c);f.set(5,1);f.set(6,0);f.xfer([7,0xe0]);f.set(6,1);
  const s=f.snap();assert.equal(s.tfts!.tft1.pixels[0],0xf800);assert.equal(s.tfts!.tft2.pixels[0],0x07e0);save('independent-tfts',s);
 }finally{f.h.dispose();}
});
test('power loss disables TFT and BMP280; invalid MISO direction and swapped data wires cannot forge ID',()=>{
 for(const pin of ['VCC','GND','CS','SCK','MOSI']){const f=fixture('bmp280SPI',c=>{c.wires=c.wires.filter(w=>w.to.pin!==pin);});try{assert.deepEqual(f.read(0xd0,1),[255],pin);}finally{f.h.dispose();}}
 const live=fixture('spiDashboard',c=>{for(const w of c.wires.filter(w=>w.to.pin==='VCC'))w.from.pin=terminals(c.components[0]).find(t=>t.gpio===6)!.pin;});
 try{live.h.mode(6,1,0,1);live.wait(150000);live.init();live.window(2,3);live.data([0xf8,0]);assert.equal(tft(live.snap()).pixels[0],0xf800);assert.deepEqual(live.read(0xd0,1),[0x58]);live.set(6,0);let s=live.snap();assert(!tft(s).powered);assert(!s.sensors.bmpSPI.powered);assert.deepEqual(live.read(0xd0,1),[255]);live.set(6,1);live.wait(150000);s=live.snap();assert(!tft(s).on);assert(tft(s).sleep);assert.deepEqual(live.read(0xd0,1),[0x58]);}finally{live.h.dispose();}
 const f=fixture('bmp280SPI');try{f.h.mode(13,1,0,0);assert.deepEqual(f.read(0xd0,1),[255]);assert(f.snap().diagnostics.some(d=>d.message.includes('MISO')));}finally{f.h.dispose();}
 const g=fixture('bmp280SPI',c=>{for(const w of c.wires){if(w.to.pin==='MOSI')w.to.pin='MISO';else if(w.to.pin==='MISO')w.to.pin='MOSI';}});try{assert.deepEqual(g.read(0xd0,1),[255]);}finally{g.h.dispose();}
});
test('the packaged Nano Worker renders ST7735 and forced termination stays below 500 ms',async()=>{
 const {pathToFileURL}=await import('node:url'),{resolve}=await import('node:path');
 const m=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=m.files.find((x:any)=>/^\/assets\/avrWorker-.*\.js$/.test(x.url)),a=JSON.parse(readFileSync('public/avr-examples.json','utf8'))[NANO].tftGraphics,events:any[]=[];
 assert(asset);const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
 try{await new Promise<void>((ok,bad)=>{const timer=setTimeout(()=>bad(Error('packaged SPI Worker timeout')),30000);w.on('error',bad);w.on('message',e=>{events.push(e);if(e.type==='error'){clearTimeout(timer);bad(Error(e.message));}else if(output(events).includes('TFT GRAPHICS READY')&&frame(events)?.tfts?.tft1.pixels[0]===0xf800){clearTimeout(timer);ok();}});w.postMessage({type:'run',session:160,hex:a.hex,circuit:compileCircuit(spiCircuit('tftGraphics',NANO),'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});});const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);save('packaged-spi-worker',{version:m.version,build:m.build,stopMs,console:output(events),frame:frame(events),scope:'Node/Linux packaged Nano Worker'});}finally{await w.terminate();}
});
