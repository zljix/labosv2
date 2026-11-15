// MIT. Real compiled WASM + Asyncify. No source interpretation or UI shortcuts.
import {createCircuitHost} from './circuit-host.mjs';
import {validateModule} from './s3-contract.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ALLOWED=new Set([...Array.from({length:22},(_,i)=>i),...Array.from({length:11},(_,i)=>38+i)]);
export async function createS3Engine(bytes,circuit,send,options={}){
 let virtualUs=0,lastYield=performance.now(),lastFrame=-Infinity,lastConsole=-Infinity,stopped=false,instance,pending,result=0,asyncPointer=0,serialBytes='',dropped=0,baud=0;
 const rx=[],modes=new Map(),latches=new Map(),buses=new Map(),decoder=new TextDecoder();
 const host=createCircuitHost(event=>send(event),{circuit,logicVoltage:3.3,nowUs:options.clock?()=>options.clock.now:()=>virtualUs,manualPublish:true,...(options.clock?{advanceUs:()=>{},radioMedium:options.medium,radioNode:options.node}:{})});
 const fault=n=>{throw Error(({[-1]:'Nepobuđen ulaz: provjeri spoj ili pull otpornik.',[-2]:'GPIO: sukob izlaza, nedostupan pin ili previsok napon.',[-3]:'GPIO: nedefinirana digitalna razina ili previše PWM izlaza.',[-16]:'Resurs je zauzet ili API nije inicijaliziran.',[-22]:'Argument nije podržan u funkcionalnom ESP32-S3 profilu.',[-95]:'API nije podržan u funkcionalnom ESP32-S3 profilu.'})[n]??'ESP32-S3 API pogreška '+n);};
 const pin=p=>{if(!ALLOWED.has(p))fault(-2);};
 function frame(force=false){const now=performance.now();if(force||now-lastFrame>=33){host.flush();lastFrame=now;}if(force||now-lastConsole>=50){if(serialBytes){send({type:'console',text:decoder.decode(Uint8Array.from(serialBytes,c=>c.charCodeAt(0)),{stream:true})});serialBytes='';}if(dropped){send({type:'console',text:`\n[Ograničen ispis: preskočeno ${dropped} bajtova]\n`});dropped=0;}lastConsole=now;}}
 function step(us=1){virtualUs+=us;host.timedStep();}
 function wrap(fn){return (...args)=>{
  if(instance.exports.asyncify_get_state()===2){instance.exports.asyncify_stop_rewind();return result;}
  if(options.clock)virtualUs=options.clock.now;step();const value=fn(...args);
  const wait=options.clock?options.clock.sleep(Math.max(1,virtualUs-options.clock.now)).then(()=>value):value instanceof Promise?value:performance.now()-lastYield>=8?pause(0).then(()=>value):null;
  if(wait){pending=wait;asyncPointer=instance.exports.lab_async_data();instance.exports.asyncify_start_unwind(asyncPointer);return 0;}
  return value??0;
 };}
 const env={
  lab_fault:fault,
  lab_gpio_mode:(p,m)=>{pin(p);if(![1,3,5,9,19].includes(m))return -22;modes.set(p,m);const latch=latches.get(p)??0;return host.mode(p,m===3||(m===19&&!latch),m===5?1:m===9?2:0,m===3?latch:m===19?0:-1);},
  lab_gpio_write:(p,v)=>{pin(p);latches.set(p,v);const mode=modes.get(p);if(mode===19)return host.mode(p,!v,0,0);if(mode===3)return host.write(p,v);return host.mode(p,0,v?1:0,-1);},
  lab_gpio_read:p=>{pin(p);const mode=modes.get(p);return host.read(p,mode===5?1:mode===9?2:mode===19?0:latches.get(p)?1:0);},
  lab_adc:(p,bits,atten)=>{pin(p);if(p<1||p>20||atten<0||atten>3)return -22;const uv=host.adc(p);if(uv<0)return uv;const range=[950000,1250000,1750000,3100000][atten],raw=Math.round(Math.min(1,uv/range)*4095);return bits===0?Math.round(raw*range/4095000):bits>12?raw<<(bits-12):raw>>(12-bits);},
  lab_pwm:(p,f,d)=>{pin(p);return host.pwm(p,f,d);},
  lab_clock:us=>{const now=host.ticksUs();return (us?Math.floor(now):Math.floor(now/1000))|0;},
  // Zero-duration yield uses wrap()'s bounded 8 ms scheduling budget. Creating
  // a browser timer for every DS18B20 busy-bit poll slowed 750 ms to seconds.
  lab_delay:(amount,micro)=>{const us=(amount>>>0)*(micro?1:1000);step(us);frame(!micro&&(amount>>>0)>=16);return options.clock||micro||!us?0:pause(options.fast?0:amount>>>0);},
  lab_serial:(op,value)=>{if(op===0){if(value<=0)return -22;baud=value;return 0;}if(op===1)return rx.length;if(op===2)return rx.shift()??-1;if(op===3)return rx[0]??-1;if(op===4){if(!baud)return -16;if(serialBytes.length<8192)serialBytes+=String.fromCharCode(value&255);else dropped++;return 0;}return -22;},
  lab_i2c_config:(id,sda,scl,freq)=>{if(freq){pin(sda);pin(scl);}return host.i2cConfig(id,sda,scl,freq);},
  lab_i2c_tx:(id,addr,ptr,n,stop)=>{if(n<0||n>128)return -22;const bytes=new Uint8Array(instance.exports.memory.buffer,ptr,n).slice();return n?host.i2cTx(id,addr,bytes,!!stop):host.i2cProbe(id,addr)?0:-19;},
  lab_i2c_rx:(id,addr,ptr,n,stop)=>{if(n<0||n>128)return -22;const data=host.i2cRx(id,addr,n,!!stop);if(typeof data==='number')return data;new Uint8Array(instance.exports.memory.buffer,ptr,n).set(data);return data.length;},
  lab_spi_config:(id,sck,mosi,miso,freq,mode,first)=>{if(freq){pin(sck);pin(mosi);if(miso>=0)pin(miso);}buses.set(id,{sck,mosi,miso,freq,mode,firstbit:first===1?0:1});return host.spiConfig(id,sck,mosi,miso,freq,mode,first===1?0:1);},
  lab_spi_transfer:(id,byte)=>{const b=buses.get(id);if(!b?.freq)return -16;const out=host.spiExchange(id,Uint8Array.of(byte));return typeof out==='number'?out:out[0];},
  lab_spi_bytes:(id,ptr,n,read)=>{if(n<0||n>4096)return -22;const b=buses.get(id);if(!b?.freq)return -16;const data=new Uint8Array(instance.exports.memory.buffer,ptr,n),out=host.spiExchange(id,data.slice());if(typeof out==='number')return out;if(read)data.set(out);return out.length;},
  lab_pulse:(p,level,timeout)=>{pin(p);return host.timePulseUs(p,level,timeout>>>0);},
  sqrt:Math.sqrt,pow:Math.pow,log:Math.log,exp:Math.exp,sin:Math.sin,cos:Math.cos,floor:Math.floor,ceil:Math.ceil,round:x=>x<0?-Math.floor(-x+.5):Math.floor(x+.5),fabs:Math.abs,
 };
 try{instance=await WebAssembly.instantiate(validateModule(bytes),{env:Object.fromEntries(Object.entries(env).map(([k,fn])=>[k,wrap(fn)]))});}catch(e){host.dispose();throw e;}
 async function call(name){
  lastYield=performance.now();let out=instance.exports[name]();
  while(instance.exports.asyncify_get_state()===1){instance.exports.asyncify_stop_unwind();frame();result=await pending;if(stopped)return;lastYield=performance.now();instance.exports.asyncify_start_rewind(asyncPointer);out=instance.exports[name]();}
  frame();return out;
 }
 return {
  async run(maxLoops=Infinity){try{await call('lab_init');if(stopped)return;frame(true);send({type:'ready'});await call('lab_setup');if(stopped)return;frame(true);send({type:'setup-complete'});for(let i=0;!stopped&&i<maxLoops;i++){await call('lab_loop');if(performance.now()-lastYield>=8||i%32===31){frame();await (options.clock?options.clock.sleep(1):pause(0));lastYield=performance.now();}}if(!stopped)frame(true);}catch(e){frame(true);throw e;}},
  input(data){if(stopped)return;if(typeof data.serial==='string')rx.push(...new TextEncoder().encode(data.serial).slice(0,Math.max(0,1024-rx.length)));host.input(data);},
  snapshot(){frame(true);},
  stop(){stopped=true;host.dispose();},
  get timeUs(){return host.ticksUs();},
 };
}
