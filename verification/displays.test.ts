import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {LCD1602} from '../public/lcd1602.mjs';
import {SSD1306} from '../public/peripherals.mjs';
import {Session} from '../dist/session.mjs';
import {displayExamples,displayCircuit,type DisplayExample} from '../src/circuit/displayExamples';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {checkCircuit} from '../src/circuit/netlist';
import {parseCircuit,type Circuit} from '../src/circuit/model';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {UNO,NANO} from '../src/boards/profiles';
import {AVREngine} from '../src/runtime/avrEngine';
import {AVR_BUILD_FILE,AVR_LIBRARIES,libraryManifest,validateArtifact,selectedLibraries} from '../public/avr-contract.mjs';
const machine=readFileSync('public/machine.py','utf8'),files=Object.fromEntries(['ssd1306.py','lcd1602.py','lab_i2c_sensors.py'].map(n=>[n,readFileSync('public/drivers/'+n,'utf8')]));
const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
const keys=['oled32','lcd1602','lcdWeather']as const;
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url));const shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
const frame=(events:any[])=>events.filter(e=>e.type==='simulation').at(-1)as SimulationFrame;
const text=(events:any[])=>events.filter(e=>e.type==='console').map(e=>e.text).join('');
function python(key:DisplayExample,code=displayExamples[key].code,c=displayCircuit(key)){return new Session(factory,machine,code,{circuit:compileCircuit(c)},()=>{},files);}
async function done(key:DisplayExample,code:string,c=displayCircuit(key),ok=true){const s=python(key,code,c);try{await s.wait((s:Session)=>['done','error'].includes(s.status));assert.equal(s.status,ok?'done':'error',s.text+' '+JSON.stringify(s.events.filter((e:any)=>e.type==='error')));return {text:s.text,events:s.events,frame:frame(s.events)};}finally{await s.stop();}}
const prefix='from machine import Pin,I2C\nfrom time import sleep_ms\nfrom lcd1602 import LCD1602\nbus=I2C(0,sda=Pin(8),scl=Pin(9),freq=100000)\n';
function rig(){let now=0;const d=new LCD1602({},()=>now);const nib=(n:number,rs=0)=>{const v=n<<4|8|rs;d.write(Uint8Array.of(v,v|4,v));};const send=(b:number,rs=0)=>{nib(b>>4,rs);nib(b&15,rs);now+=b<4&&!rs?2:.05;};const init=()=>{now=50;d.write(Uint8Array.of(8));now+=1;for(const n of [3,3,3,2]){nib(n);now+=5;}send(0x28);send(0x0c);send(6);send(1);};return {d,nib,send,init,wait:(v:number)=>now+=v,time:()=>now};}

test('OLED geometries retain 1024-byte controller RAM but expose 512/1024 panel bytes and reject wrong initialization',()=>{
 for(const height of [32,64]){const d=new SSD1306(height);assert.equal(d.ram.length,1024);d.write(Uint8Array.of(0,0xa8,height-1,0xda,height===32?2:0x12,0xa1,0xc8,0xaf,0x20,0,0x21,0,127,0x22,0,height/8-1));d.write(Uint8Array.of(0x40,...new Array(height*16).fill(255)));const s=d.snapshot(true);assert.equal(s.height,height);assert.equal(s.bytes.length,height*16);assert(s.bytes.every((b:number)=>b===255));assert.equal(d.snapshot(false).bytes.some(Boolean),false);assert.throws(()=>d.write(Uint8Array.of(0,0xa8,height===32?63:31)),/multiplex/);assert.throws(()=>d.write(Uint8Array.of(0,0xda,height===32?0x12:2)),/COM/);}
});
test('HD44780 requires 4-bit initialization and E edges; DDRAM rows, hidden columns, clear/home and busy time are real state',()=>{
 const r=rig();assert.throws(()=>r.nib(3),/zauzet/);r.init();r.send(0x80);r.send(65,1);r.send(0xc0);r.send(66,1);assert.equal(r.d.snapshot(true).lines[0][0],'A');assert.equal(r.d.snapshot(true).lines[1][0],'B');const count=r.d.writes;r.d.write(Uint8Array.of(0x49,0x49));assert.equal(r.d.writes,count);r.send(0x98);r.send(90,1);assert.equal(r.d.ddram![24],90);r.send(1);assert(r.d.snapshot(true).lines.every((x:string)=>x===' '.repeat(16)));r.send(0xc5);r.send(2);assert.equal(r.d.address,0);assert.equal(r.d.cgramMode,false);
 r.nib(0);r.nib(1);assert.equal(r.d.snapshot(true).busy,true);assert.throws(()=>r.send(65,1),/zauzet/);
});
test('LCD CGRAM aliases, cursor, blink, entry direction and display shift are controlled by instruction bytes',()=>{
 const r=rig();r.init();r.send(0x40);for(const n of [0,10,10,0,17,14,0,0])r.send(n,1);r.send(0x80);r.send(8,1);r.send(65,1);r.send(0x0f);let s=r.d.snapshot(true);assert.equal(s.cells[0],8);assert.deepEqual(s.cgram.slice(0,8),[0,10,10,0,17,14,0,0]);assert(s.cursor&&s.blink);r.send(0x18);assert.equal(r.d.snapshot(true).lines[0][0],'A');r.send(0x1c);assert.equal(r.d.shift,0);r.send(4);r.send(0x82);r.send(66,1);assert.equal(r.d.address,1);r.send(8);assert.equal(r.d.snapshot(true).on,false);assert(r.d.snapshot(true).cells.every((v:number)=>v===32));r.d.write(Uint8Array.of(0));assert.equal(r.d.snapshot(true).backlight,false);assert(r.d.snapshot(false).cells.every((v:number)=>v===32));
});
test('PCF8574 has no register pointer; read port respects released pins, HD busy flag, DDRAM data and 100 kHz limit',()=>{
 const r=rig();r.init();r.send(0x80);r.send(0x41,1);r.send(0x80);
 const read=(rs:number)=>{let value=0;for(let i=0;i<2;i++){r.d.writeByte(0xf8|rs|2);r.d.writeByte(0xfc|rs|2);value=(value<<4)|(r.d.readByte()!>>4);r.d.writeByte(0xf8|rs|2);}return value;};
 assert.equal(read(1),0x41);assert.equal(r.d.address,1);r.nib(0);r.nib(1);assert(read(0)&128);r.wait(2);assert.equal(read(0),0);r.d.writeByte(0x06);assert.equal(r.d.readByte()!&0xf0,0);assert.throws(()=>r.d.onAddress(true,400000),/100 kHz/);
});
test('display circuits, logical supply and artifacts round-trip through JSON and ZIP; old U8g2 profile remains unchanged',async()=>{
 for(const key of keys){const c=displayCircuit(key);assert.equal(checkCircuit(c).diagnostics.length,0,JSON.stringify(checkCircuit(c).diagnostics));assert.deepEqual(parseCircuit(c),c);const p=newProject(displayExamples[key].code,displayExamples[key].title);p.circuit=c;p.files={...files,...p.files};assert.deepEqual(importProject(exportZip(p),'display.zip'),parseProject(p));for(const board of [UNO,NANO] as const){const p=arduinoExampleProject(key,board),a=artifacts[board][key];await validateArtifact(p,a);p.files[AVR_BUILD_FILE]=JSON.stringify(a);const next=importProject(exportZip(p),'display.zip');await validateArtifact(next,JSON.parse(next.files[AVR_BUILD_FILE]));}}
 const c=displayCircuit('lcd1602');c.components[1].properties.address=0x3f;assert.throws(()=>parseCircuit(c));c.components[1].properties.address=0x27;c.components[1].properties.moduleVoltage=3.3;assert.throws(()=>parseCircuit(c));assert.throws(()=>selectedLibraries({files:{'arduino-libraries.json':libraryManifest([{name:'U8g2',version:'2.37.1'}]).replace(']}',',{"name":"U8g2_12832","version":"2.37.1"}]}')}}));assert.equal(AVR_LIBRARIES.find(x=>x.name==='U8g2')!.digest,'5f8b4535f5c7837f82569ede8d7381b614ba80455982c59e4ca4e7fc17d43e0b');
});
test('real MicroPython SSD1306 driver renders final row at height 32 and catches height 64 mismatch',async()=>{
 const code=prefix+'from ssd1306 import SSD1306_I2C\no=SSD1306_I2C(128,32,bus)\no.fill(0)\no.pixel(127,31,1)\no.text("URS",0,24)\no.show()\nprint("OLED32_OK")';const r=await done('oled32',code);assert(r.text.includes('OLED32_OK'));const d=r.frame.displays.display1;assert.equal(d.height,32);assert.equal(d.bytes.length,512);assert.equal(d.bytes[511]&128,128);assert(r.frame.i2cTrace.some(t=>t.length===513));await done('oled32',code.replace('128,32','128,64'),displayCircuit('oled32'),false);
});
test('real MicroPython LCD driver writes ASCII and CGRAM through actual I2C bytes',async()=>{
 const r=await done('lcd1602',prefix+'lcd=LCD1602(bus)\nlcd.custom_char(0,(0,10,10,0,17,14,0,0))\nlcd.putstr("Pozdrav "+chr(0))\nlcd.move_to(0,1)\nlcd.putstr("Redak 2")\nprint("LCD_OK")');assert(r.text.includes('LCD_OK'));const d=r.frame.displays.display1;assert.equal(d.lines![0].slice(0,7),'Pozdrav');assert.equal(d.cells![8],0);assert(d.lines![1].startsWith('Redak 2'));assert.deepEqual(d.cgram!.slice(0,8),[0,10,10,0,17,14,0,0]);assert(r.frame.i2cTrace.some(t=>t.address===0x27&&t.operation==='W'));
});
test('real MicroPython LCD commands preserve DDRAM while display off, control backlight and reject non-ASCII text',async()=>{
 const r=await done('lcd1602',prefix+'lcd=LCD1602(bus)\nlcd.putstr("ABC")\nlcd.shift_left()\nlcd.shift_right()\nlcd.display(False)\nlcd.backlight(False)\nlcd.display(True,True,True)\nlcd.home()\nprint("COMMANDS_OK")');const d=r.frame.displays.display1;assert(d.lines![0].startsWith('ABC'));assert.equal(d.backlight,false);assert(d.cursor&&d.blink);await done('lcd1602',prefix+'LCD1602(bus).putstr("č")',displayCircuit('lcd1602'),false);
});
test('real MicroPython BMP280 -> LCD chain follows live readings and reset starts from empty controller RAM',async()=>{
 const s=python('lcdWeather');try{await s.wait((s:Session)=>s.text.includes('LCD T=24.00 P=101325')||s.status==='error');assert.notEqual(s.status,'error',JSON.stringify(s.events.filter((e:any)=>e.type==='error')));const before=frame(s.events).displays.display1.lines;s.input({component:'bmp2801',temperature:30,pressure:95000});await s.wait((s:Session)=>s.text.includes('LCD T=30.00 P=95000'));const d=frame(s.events).displays.display1;assert(d.lines![0].startsWith('T: 30.0 C'));assert(d.lines![1].startsWith('P: 950.0 hPa'));assert.notDeepEqual(d.lines,before);writeFileSync('docs/stage10c-evidence/micropython-lcd.json',JSON.stringify({console:s.text,display:d,measurements:frame(s.events).measurements},null,2)+'\n');}finally{assert(await s.stop()<500);}
 const fresh=await done('lcd1602',prefix+'print("RESET_OK")');assert.equal(fresh.frame.displays.display1.on,false);assert(fresh.frame.displays.display1.cells!.every(n=>n===32));
});
test('MicroPython LCD missing VCC/GND/LV/SDA/SCL/pull-ups, wrong address, clock and voltage never produce false text',async()=>{
 for(const pin of ['VCC','GND','LV','SDA','SCL','pullups']){const c=displayCircuit('lcd1602');if(pin==='pullups')c.components[1].properties.pullups=false;else c.wires=c.wires.filter(w=>w.to.pin!==pin);const r=await done('lcd1602',prefix+'lcd=LCD1602(bus)\nlcd.putstr("FALSE")',c,false);assert(!r.frame.displays.display1.lines!.join('').includes('FALSE'));}
 const c=displayCircuit('lcd1602');c.components[1].properties.address=0x26;await done('lcd1602',prefix+'LCD1602(bus)',c,false);const fixed=await done('lcd1602',prefix+'LCD1602(bus,0x26).putstr("ADDR_OK")',c);assert(fixed.frame.displays.display1.lines![0].startsWith('ADDR_OK'));await done('lcd1602',prefix.replace('100000','400000')+'LCD1602(bus)',displayCircuit('lcd1602'),false);
});
function openAVR(key:DisplayExample,board:typeof UNO|typeof NANO,edit?:(c:Circuit)=>void){const p=arduinoExampleProject(key,board),c=p.circuit as Circuit;edit?.(c);const a=artifacts[board][key],events:any[]=[],e=new AVREngine(a.hex,compileCircuit(c,'avr'),x=>events.push(x),board===NANO?8:6,a.staticRamBytes);return{e,events};}
function until(e:AVREngine,events:any[],predicate:()=>boolean,limit=6000){for(let ms=0;ms<limit;ms+=100){e.runCycles(1600000);e.frame();if(predicate())return;}throw Error('Timeout '+text(events)+' '+JSON.stringify(frame(events)?.diagnostics));}
for(const board of [UNO,NANO]as const){
 test(`${board}: real U8g2 UNIVISION C++ produces 128x32 pixels and responds to frame changes`,()=>{const{e,events}=openAVR('oled32',board);try{until(e,events,()=>text(events).includes('OLED32 brojac=0'));const first=frame(events).displays.display1;assert.equal(first.height,32);assert.equal(first.bytes.length,512);assert(first.bytes.some(Boolean));assert(first.bytes.slice(384).some(Boolean));until(e,events,()=>text(events).includes('OLED32 brojac=1'));assert.notDeepEqual(frame(events).displays.display1.bytes,first.bytes);assert.equal(frame(events).diagnostics.length,0);writeFileSync(`docs/stage10c-evidence/${board===UNO?'uno':'nano'}-oled32.json`,JSON.stringify({console:text(events),memory:frame(events).avr!.memory,display:frame(events).displays.display1},null,2)+'\n');}finally{e.dispose();}});
 test(`${board}: real LCD C++ renders CGRAM, updates counter and receives serial backlight/display commands`,()=>{const{e,events}=openAVR('lcd1602',board);try{until(e,events,()=>text(events).includes('LCD1602 brojac=0'));let d=frame(events).displays.display1;assert(d.lines![0].startsWith('Pozdrav, URS!'));assert.equal(d.cells![14],0);assert.deepEqual(d.cgram!.slice(0,8),[0,10,10,0,17,14,0,0]);e.input({serial:'b'});until(e,events,()=>frame(events).displays.display1.backlight===false);e.input({serial:'d'});until(e,events,()=>frame(events).displays.display1.on===false);e.input({serial:'d'});until(e,events,()=>frame(events).displays.display1.on===true);assert(frame(events).displays.display1.lines![0].startsWith('Pozdrav'));assert.equal(frame(events).diagnostics.length,0);}finally{e.dispose();}});
 test(`${board}: compiled BMP280 -> LCD sketch shows live pressure, safe SRAM and no stale display on new engine`,()=>{const{e,events}=openAVR('lcdWeather',board);try{until(e,events,()=>text(events).includes('LCD T=24.00 P=101325'));e.input({component:'bmp2801',temperature:-5,pressure:95000});until(e,events,()=>text(events).includes('LCD T=-5.00 P=95000'));const d=frame(events).displays.display1;assert(d.lines![0].startsWith('T: -5.0 C'));assert(d.lines![1].startsWith('P: 950.0 hPa'));assert(frame(events).avr!.memory!.minFreeToStatic>700);assert.equal(frame(events).diagnostics.length,0);writeFileSync(`docs/stage10c-evidence/${board===UNO?'uno':'nano'}-lcd.json`,JSON.stringify({console:text(events),display:d,memory:frame(events).avr!.memory},null,2)+'\n');}finally{e.dispose();}const fresh=openAVR('lcdWeather',board);try{fresh.e.frame();assert.equal(frame(fresh.events).displays.display1.on,false);}finally{fresh.e.dispose();}});
}
test('compiled LCD detects absent supply, LV, pull-ups and incorrect address on both board profiles',()=>{
 for(const board of [UNO,NANO] as const)for(const pin of ['VCC','GND','LV','SDA','SCL','pullups','address']){const{e,events}=openAVR('lcd1602',board,c=>{if(pin==='pullups')c.components[1].properties.pullups=false;else if(pin==='address')c.components[1].properties.address=0x26;else c.wires=c.wires.filter(w=>w.to.pin!==pin);});try{until(e,events,()=>text(events).includes('LCD: provjeri spoj'));assert(!frame(events).displays.display1.lines!.join('').includes('Pozdrav'));}finally{e.dispose();}}
});
test('built Nano Worker executes LCD chain, receives live input and is forcibly terminated within 500 ms',async()=>{
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),path=manifest.files.map((x:any)=>x.url).find((p:string)=>/^\/assets\/avrWorker-.*\.js$/.test(p));assert(path);const p=arduinoExampleProject('lcdWeather',NANO),a=artifacts[NANO].lcdWeather;const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+path)).href}}),events:any[]=[];
 w.on('message',e=>events.push(e));const wait=async(predicate:()=>boolean)=>{const start=performance.now();while(!predicate()){if(performance.now()-start>15000)throw Error('Worker timeout '+text(events));await new Promise(r=>setTimeout(r,10));}};
 try{w.postMessage({type:'run',session:109,hex:a.hex,circuit:compileCircuit(p.circuit as Circuit,'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});await wait(()=>text(events).includes('LCD T=24.00'));w.postMessage({type:'input',session:109,component:'bmp2801',temperature:30,pressure:97000});await wait(()=>text(events).includes('LCD T=30.00 P=97000'));assert(frame(events).displays.display1.lines![1].startsWith('P: 970.0 hPa'));writeFileSync('docs/stage10c-evidence/production-worker.json',JSON.stringify({console:text(events),display:frame(events).displays.display1},null,2)+'\n');}finally{const start=performance.now();await w.terminate();assert(performance.now()-start<500);}
});


test('MicroPython static LCD cursor blink advances while the program sleeps without further I2C writes',async()=>{
 const s=python('lcd1602',prefix+'lcd=LCD1602(bus)\nlcd.display(True,True,True)\nprint("BLINK_READY")\nsleep_ms(1400)');
 try{await s.wait((s:Session)=>s.status==='done');const frames=s.events.filter((e:any)=>e.type==='simulation'&&e.displays.display1.blink);assert(frames.some((e:any)=>e.displays.display1.blinkOn));assert(frames.some((e:any)=>!e.displays.display1.blinkOn));}finally{await s.stop();}
});
test('compiled GPIO software-I2C master writes LCD text and reads DDRAM through PCF8574 quasi-bidirectional pins',()=>{
 const {project,artifact}=JSON.parse(readFileSync('verification/stage10c-fixtures.json','utf8')).softwareLcd;
 const events:any[]=[],e=new AVREngine(artifact.hex,compileCircuit(project.circuit,'avr'),x=>events.push(x));
 try{until(e,events,()=>text(events).includes('SOFT_LCD ACK=1 READ=83'));assert(frame(events).displays.display1.lines![0].startsWith('SW LCD'));assert.equal(frame(events).diagnostics.length,0);}finally{e.dispose();}
});
test('real MicroPython wrong backpack E mapping ACKs at PCF8574 but cannot fabricate LCD text',async()=>{
 const code=prefix+'class WrongLCD(LCD1602):\n def _nibble(self,value):\n  value|=self.light\n  self.bus.writeto(self.address,bytes((value,value|1,value)))\nlcd=WrongLCD(bus)\nlcd.putstr("NO_FAKE")\nprint("PCF_ACK_ONLY")';
 const r=await done('lcd1602',code);assert(r.text.includes('PCF_ACK_ONLY'));assert(!r.frame.displays.display1.lines!.join('').includes('NO_FAKE'));
});
