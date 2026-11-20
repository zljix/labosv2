import test from 'node:test';
import assert from 'node:assert/strict';
import {isolatedToolRunner} from './tool-runner.mjs';
import {toolFiles} from './tool-files.mjs';
test('completed and failed tool realms terminate before the next stage; late messages are ignored',async()=>{
 const workers=[];let active=0,maxActive=0;
 const runner=isolatedToolRunner(()=>{active++;maxActive=Math.max(maxActive,active);const w={postMessage(){},terminate(){if(!w.ended){w.ended=true;active--;}}};workers.push(w);return w;});
 const state={files:new Map(),progress(){},diagnostics:[],timings:[]};
 const first=runner('cc1plus',[],'/project/a.s',state);
 workers[0].onmessage({data:{type:'result',result:new Uint8Array([1]),diagnostics:[],timing:{tool:'cc1plus',ms:1}}});
 await first;assert.equal(active,0);
 workers[0].onmessage({data:{type:'error',message:'late'}});
 const second=runner('avr-as',[],'/project/a.o',state);
 workers[1].onerror({message:'failure'});await assert.rejects(second,/failure/);assert.equal(active,0);assert.equal(maxActive,1);
 assert.equal(state.files.size,1);assert(!state.files.has('/project/a.o'));
});
test('tool input selection omits unused libraries, object files and board variants',()=>{
 const bytes=new Uint8Array(4),all=new Map([
 '/sysroot/arduino/variants/standard/pins_arduino.h','/sysroot/arduino/variants/eightanaloginputs/pins_arduino.h',
 '/sysroot/libraries/Servo/include/Servo.h','/sysroot/libraries/U8g2/include/U8g2lib.h',
 '/sysroot/arduino/boards/uno/libcore.a','/sysroot/arduino/boards/nano/libcore.a','/sysroot/arduino/boards/nano/libServo.a',
 '/project/sketch.cpp','/project/unused.o','/project/unit0.s'
 ].map(p=>[p,bytes]));
 const c=toolFiles('cc1plus',['-I/sysroot/arduino/variants/eightanaloginputs','-I/sysroot/libraries/Servo/include'],all,all);
 assert(c.has('/sysroot/arduino/variants/standard/pins_arduino.h'));assert(c.has('/sysroot/libraries/Servo/include/Servo.h'));
 assert(!c.has('/sysroot/libraries/U8g2/include/U8g2lib.h'));assert(!c.has('/project/unused.o'));assert(![...c.keys()].some(p=>p.endsWith('.a')));
 const link=toolFiles('avr-ld',['-L/sysroot/arduino/boards/nano','-lcore'],all,all);
 assert.deepEqual([...link.keys()],['/sysroot/arduino/boards/nano/libcore.a']);
 assert.deepEqual([...toolFiles('avr-as',['-o','/project/unit0.o','/project/unit0.s'],all,all).keys()],['/project/unit0.s']);
});
test('tool starts only after verified binary is ready and receives its transferred ownership',async()=>{
 let deliver,created=0,payload,transfers,worker;
 const runner=isolatedToolRunner(()=>{created++;worker={postMessage(data,transfer){payload=data;transfers=transfer;},terminate(){}};return worker;},()=>new Promise(resolve=>{deliver=resolve;}));
 const binary=new ArrayBuffer(8),state={files:new Map(),progress(){},diagnostics:[],timings:[]};
 const pending=runner('cc1plus',[],'/project/a.s',state);assert.equal(created,0);deliver({tool:binary});await Promise.resolve();assert.equal(created,1);
 assert.equal(payload.assets.tool,binary);assert.deepEqual(transfers,[binary]);
 worker.onmessage({data:{type:'result',result:new Uint8Array([1]),diagnostics:[],timing:{tool:'cc1plus',ms:1}}});await pending;
});
