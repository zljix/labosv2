import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {Session} from '../dist/session.mjs';
import {createHost} from '../public/host.mjs';
import {compileCircuit} from '../src/circuit/compile';
import {exampleCircuit,basicExamples} from '../src/circuit/examples';
import {demoCircuit,type Circuit} from '../src/circuit/model';
const machine=await readFile(new URL('../dist/machine.py',import.meta.url),'utf8');
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url));const shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function open(c:Circuit,code:string){return new Session(factory,machine,code,{circuit:compileCircuit(c)});}
const frames=(s:Session)=>s.events.filter((e:any)=>e.type==='simulation') as any[];
const last=(s:Session)=>frames(s).at(-1);
async function done(c:Circuit,code:string,ok=true){const s=open(c,code);try{await s.wait((v:Session)=>['done','error'].includes(v.status));assert.equal(s.status,ok?'done':'error',s.events.map((e:any)=>e.message??'').join('\n'));return {text:s.text,events:s.events,frame:last(s)};}finally{await s.stop();}}
function host(c:Circuit){const events:any[]=[];const h=createHost((e:any)=>events.push(e),{circuit:compileCircuit(c)});return {h,events,frame:()=>{h.flush();return events.filter(e=>e.type==='simulation').at(-1);}};}
const all = (c:Circuit,from:string,to:string)=>{for(const w of c.wires)for(const e of [w.from,w.to])if(e.component==='esp32'&&e.pin===from)e.pin=to;};

test('LED follows actual Python loop; unchanged pin numbers cannot drive a rewired LED',async()=>{
 const c=exampleCircuit('blink'),s=open(c,'from machine import Pin\nfrom time import sleep_ms\np=Pin(4,Pin.OUT)\nfor i in range(3):\n p.on()\n sleep_ms(50)\n p.off()\n sleep_ms(50)\n');
 try{await s.wait((v:Session)=>v.status==='done'||v.status==='error');assert.equal(s.status,'done');assert(frames(s).some(f=>f.leds.led1.currentMa>4));assert(frames(s).some(f=>f.leds.led1.currentMa===0));}finally{await s.stop();}
 const wrong=await done(c,'from machine import Pin\nPin(6,Pin.OUT).on()');assert.equal(wrong.frame.leds.led1.brightness,0);
 all(c,'J1.4','J1.6');const right=await done(c,'from machine import Pin\nPin(6,Pin.OUT).on()');assert(right.frame.leds.led1.currentMa>4);
});
test('button changes live input in normal sleeping Python loop; release and missing wire change result',async()=>{
 const c=exampleCircuit('button'),s=open(c,basicExamples.button.code);
 try{await s.wait((v:Session)=>frames(v).some(f=>f.leds.led1.brightness===0));s.input({component:'sw1',pressed:true});await s.wait((v:Session)=>frames(v).some(f=>f.leds.led1.brightness>.8));const n=s.events.length;s.input({component:'sw1',pressed:false});await s.wait((v:Session)=>v.events.slice(n).some((e:any)=>e.type==='simulation'&&e.leds.led1.brightness===0));assert(s.text.includes('pritisnuto'));}finally{await s.stop();}
 c.wires=c.wires.filter(w=>!(w.from.component==='esp32'&&w.from.pin==='J1.5'));c.components.find(p=>p.id==='sw1')!.properties.pressed=true;
 const r=await done(c,'from machine import Pin\np=Pin(5,Pin.IN,Pin.PULL_UP)\nassert p.value()==1\nprint("OPEN_OK")');assert(r.text.includes('OPEN_OK'));
});
test('ADC and PWM use live potentiometer voltage, saturate, and publish real duty',async()=>{
 const c=exampleCircuit('pwm');c.components.find(p=>p.id==='pot1')!.properties.position=0;const s=open(c,basicExamples.pwm.code);
 try{await s.wait((v:Session)=>frames(v).some(f=>f.gpios[4]?.duty===0));s.input({component:'pot1',position:50});await s.wait((v:Session)=>frames(v).some(f=>f.gpios[4]?.duty>34000&&f.gpios[4]?.duty<36000));const mid=last(s).leds.led1.currentMa;assert(mid>2&&mid<3);s.input({component:'pot1',position:100});await s.wait((v:Session)=>frames(v).some(f=>f.gpios[4]?.duty===65535));assert(last(s).leds.led1.currentMa>4);}finally{await s.stop();}
});
test('LED current reflects series resistance, polarity, open cathode and split rail',()=>{
 const c=exampleCircuit('blink');let t=host(c);t.h.mode(4,1);t.h.write(4,1);const base=t.frame().leds.led1.currentMa;assert(base>4&&base<5);
 c.components.find(p=>p.id==='r1')!.properties.resistance=1000;t=host(c);t.h.mode(4,1);t.h.write(4,1);assert(t.frame().leds.led1.currentMa<base/2);
 const reverse=structuredClone(c);for(const w of reverse.wires)for(const e of [w.from,w.to])if(e.component==='led1')e.pin=e.pin==='A'?'K':'A';t=host(reverse);t.h.mode(4,1);t.h.write(4,1);assert.equal(t.frame().leds.led1.currentMa,0);
 for(const id of ['w6','w7']){const open=structuredClone(c);open.wires=open.wires.filter(w=>w.id!==id);t=host(open);t.h.mode(4,1);t.h.write(4,1);assert.equal(t.frame().leds.led1.currentMa,0);}
});
test('floating ADC and ambiguous digital voltage report errors; no hidden fixture input',async()=>{
 const c=exampleCircuit('pwm');c.wires=c.wires.filter(w=>w.id!=='w12');let r=await done(c,'from machine import ADC,Pin\nprint(ADC(Pin(1)).read_u16())',false);assert(r.events.some((e:any)=>e.message?.includes('nepobudjen')));
 const t=host(exampleCircuit('pwm'));t.h.mode(1,0,0);assert.equal(t.h.read(1,0),-3);assert.equal(t.h.read(5,0),-1);
});
test('opposing program outputs and a contact that shorts an output raise runtime diagnostics',async()=>{
 const c=exampleCircuit('blink');c.wires.push({id:'conflict',from:{component:'esp32',pin:'J1.4'},to:{component:'esp32',pin:'J1.5'},color:'#123456',points:[]});
 const r=await done(c,'from machine import Pin\na=Pin(4,Pin.OUT)\nb=Pin(5,Pin.OUT)\na.on()',false);assert(r.frame.diagnostics.some((d:any)=>d.code==='output-conflict'));assert(r.events.some((e:any)=>e.message?.includes('conflict')));
 const button=exampleCircuit('button'),s=open(button,'from machine import Pin\nfrom time import sleep_ms\na=Pin(5,Pin.OUT,value=1)\nwhile True:\n sleep_ms(20)');
 try{await s.wait((v:Session)=>v.status==='running');s.input({component:'sw1',pressed:true});await s.wait((v:Session)=>v.status==='error');assert(last(s).diagnostics.some((d:any)=>d.code==='output-conflict'));}finally{await s.stop();}
});
test('PWM methods, deinit, quantised 12-bit ADC, bounds and unavailable GPIOs',async()=>{
 let r=await done(exampleCircuit('pwm'),'from machine import Pin,PWM,ADC\na=ADC(Pin(1),atten=ADC.ATTN_11DB)\nx=a.read()\nassert 2170 < x < 2190\nassert a.read_u16()==((x<<4)|(x>>8))\np=PWM(Pin(4),freq=1000,duty_u16=32768)\nassert p.freq()==1000\nassert p.duty_u16()==32768\np.duty(1023)\nassert p.duty_u16()==65535\np.duty_ns(250000)\nassert 16380<=p.duty_u16()<=16384\np.freq(2000)\nassert p.freq()==2000\np.deinit()\nprint("API_OK")');assert(r.text.includes('API_OK'));assert.equal(r.frame.leds.led1.currentMa,0);
 for(const code of ['Pin(35)','ADC(Pin(21))','PWM(Pin(4),duty_u16=65536)','PWM(Pin(4),freq=0)','PWM(Pin(4),duty_u16=1,duty_ns=1)']){r=await done(exampleCircuit('pwm'),'from machine import Pin,ADC,PWM\n'+code,false);assert(r.events.some((e:any)=>e.message?.includes('ValueError')));}
});
test('stopped runs cannot deliver late events; repeated force-stop and fresh run',async()=>{
 for(let i=0;i<4;i++){const s=open(exampleCircuit('blink'),'from machine import Pin\np=Pin(4,Pin.OUT,value=1)\nwhile True:\n pass');await s.wait((v:Session)=>v.status==='running');const ms=await s.stop();assert(ms<500);const count=s.events.length;const fresh=await done(exampleCircuit('blink'),'from machine import Pin\nPin(4,Pin.OUT,value=0)\nprint("FRESH_OK")');assert(fresh.text.includes('FRESH_OK'));assert.equal(fresh.frame.leds.led1.currentMa,0);assert.equal(s.events.length,count);}
});
test('compiled run snapshot and multiple inputs stay isolated from later project edits',()=>{
 const c=demoCircuit(),config=compileCircuit(c),events:any[]=[];const h=createHost((e:any)=>events.push(e),{circuit:config});h.mode(1,0,0);const before=h.adc(1);c.components.find(p=>p.id==='pot1')!.properties.position=0;config.pots[0].position=100;assert.equal(h.adc(1),before);h.input({component:'sw1',pressed:true});assert.equal(h.adc(1),before);h.input({component:'pot1',position:0});assert(h.adc(1)<10);h.flush();
});
test('invalid power circuit is blocked before run, and all three lesson circuits compile',()=>{
 for(const key of Object.keys(basicExamples) as (keyof typeof basicExamples)[])assert(compileCircuit(exampleCircuit(key)).leds.length===1);
 const c=exampleCircuit('blink');c.wires.push({id:'short',from:{component:'esp32',pin:'J1.1'},to:{component:'esp32',pin:'J1.22'},color:'#123456',points:[]});assert.throws(()=>compileCircuit(c),/Kratki spoj/);
});

test('atomic initial output value avoids an artificial conflict against a driven-high net',async()=>{
 const c=exampleCircuit('blink');c.wires.push({id:'gpio-link',from:{component:'esp32',pin:'J1.4'},to:{component:'esp32',pin:'J1.5'},color:'#123456',points:[]});
 const r=await done(c,'from machine import Pin\na=Pin(4,Pin.OUT,value=1)\nb=Pin(5,Pin.OUT,value=1)\nassert b.value()==1\nprint("ATOMIC_OK")');assert(r.text.includes('ATOMIC_OK'));assert(r.frame.leds.led1.currentMa>4);
});
test('PWM channel limit is a catchable Python error; an inactive LED does not create a source',async()=>{
 const r=await done(exampleCircuit('pwm'),'from machine import Pin,PWM\np=[]\nfor i in (6,7,8,9,10,11,12,13):\n p.append(PWM(Pin(i),duty_u16=0))\ntry:\n PWM(Pin(14))\n raise AssertionError("No limit")\nexcept ValueError:\n print("LIMIT_OK")');assert(r.text.includes('LIMIT_OK'));
 const t=host(exampleCircuit('blink'));t.h.mode(4,0,0);assert.equal(t.h.adc(4),-1);t.h.flush();
});
