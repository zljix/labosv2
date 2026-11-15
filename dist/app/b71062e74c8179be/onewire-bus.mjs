// MIT. DS18B20 externally powered TO-92 functional profile, standard speed.
// Only GPIO direction/edges enter this device. ROM search and CRC run in drivers.
export function crc8(bytes){let crc=0;for(let b of bytes)for(let i=0;i<8;i++){const mix=(crc^b)&1;crc>>=1;if(mix)crc^=0x8c;b>>=1;}return crc;}
export function makeROM(id){let a=2166136261,b=2246822519;for(const ch of id){a=Math.imul(a^ch.charCodeAt(0),16777619)>>>0;b=Math.imul(b^ch.charCodeAt(0),3266489917)>>>0;}const v=[0x28,a&255,(a>>>8)&255,(a>>>16)&255,(a>>>24)&255,b&255,(b>>>8)&255];return [...v,crc8(v)].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();}
export function validROM(rom){return typeof rom==='string'&&/^28[0-9a-fA-F]{14}$/.test(rom)&&crc8(rom.match(/../g).map(v=>parseInt(v,16)))===0;}
export const conversionUs=bits=>750000/(1<<(12-bits));
export function temperatureBytes(t,bits=12){let raw=Math.round(Math.max(-55,Math.min(125,t))*16);raw&=~((1<<(12-bits))-1);return [raw&255,(raw>>8)&255];}

export function createOneWireBus({c,pins,gpioNet,rootData,idleSolution,clockUs,logicVoltage}){
 const states=(c.oneWireDevices??[]).map(d=>({d,rom:d.rom.match(/../g).map(v=>parseInt(v,16)),powered:false,scratch:[0x50,5,75,70,0x7f,0xff,0x0c,0x10],sample:0,pending:null,reason:'Čeka reset/presence',eeprom:[75,70,0x7f],copyUntil:0,alarm:false}));
 const buses=new Map();
 const same=(a,b)=>rootData().root(a)===rootData().root(b);
 function environment(s){const v=idleSolution().volts,d=s.d,supply=v[d.vdd]===null||v[d.gnd]===null?null:v[d.vdd]-v[d.gnd];
  const powered=supply!==null&&Math.abs(v[d.gnd])<.05&&supply>=3-.01&&supply<=5.5+.01;
  const pull=c.resistors.some(r=>r.ohms>=1000&&r.ohms<=10000&&((same(r.a,d.data)&&same(r.b,d.vdd))||(same(r.b,d.data)&&same(r.a,d.vdd))));
  const level=v[d.data],goodLevel=level!==null&&level>=logicVoltage*.75&&level<=logicVoltage+.3&&level<=supply+.3;
  return {powered,pull,goodLevel};
 }
 function sync(){const t=clockUs();for(const s of states){const e=environment(s);
  if(s.powered!==e.powered){s.powered=e.powered;s.scratch=[0x50,5,...s.eeprom,0xff,0x0c,0x10];s.pending=null;s.copyUntil=0;s.sample=0;s.alarm=false;s.reason=e.powered?'Početni registar +85 °C; pokreni pretvorbu':'Provjeri VDD i zajedničku masu';}
  if(!e.powered)s.pending=null;
  if(s.pending&&t>=s.pending.until){const p=s.pending;s.scratch.splice(0,2,...temperatureBytes(p.temperature,p.bits));s.pending=null;s.sample++;const hi=s.scratch[2]<<24>>24,lo=s.scratch[3]<<24>>24,integer=(s.scratch[1]<<24>>16|s.scratch[0])>>4;s.alarm=integer>=hi||integer<=lo;s.reason='Pretvorba dovršena; rezultat čita program uz CRC';}
  if(s.copyUntil&&t>=s.copyUntil){s.eeprom=s.copyValues;s.copyUntil=0;}
 }
 }
 function members(net){return states.filter(s=>same(s.d.data,net));}
 function eligible(net){return members(net).filter(s=>{const e=environment(s);return e.powered&&e.pull&&e.goodLevel&&s.d.oneWireFault!=='disconnected';});}
 function scratch(s){const v=[...s.scratch,crc8(s.scratch)];if(s.d.oneWireFault==='crc')v[8]^=1;return v;}
 function log(b,operation,value){b.trace.push({timeUs:clockUs(),operation,...(value===undefined?{}:{value})});if(b.trace.length>100)b.trace.shift();}
 function reset(b){const t=clockUs();b.selected=eligible(b.net);b.phase='rom';b.rx=[];b.match=[];b.tx=[];b.bit=0;b.searchIndex=0;b.searchPart=0;b.lowAt=null;b.sinks=[];b.slot=null;
  if(b.selected.length)b.sinks.push({start:t+30,end:t+150,devices:[...b.selected]});
  b.presenceUntil=t+150;log(b,'reset',b.selected.length);for(const s of b.selected)s.reason='Reset prihvaćen; presence LOW';
 }
 function command(b,value){log(b,b.phase==='rom'?'rom-command':b.phase==='match'?'rom-byte':b.phase==='write'?'scratchpad-write-byte':'function-command',value);
  if(b.phase==='rom'){
   if(value===0x55){b.phase='match';b.match=[];}
   else if(value===0xcc)b.phase='function';
   else if(value===0xf0||value===0xec){if(value===0xec)b.selected=b.selected.filter(s=>s.alarm);b.phase='search';b.searchIndex=0;b.searchPart=0;}
   else if(value===0x33){b.tx=Array.from({length:8},(_,i)=>b.selected.reduce((v,s)=>v&s.rom[i],255));b.bit=0;b.phase='read';}
   else b.phase='idle';return;
  }
  if(b.phase==='match'){b.match.push(value);if(b.match.length===8){b.selected=b.selected.filter(s=>s.rom.every((v,i)=>v===b.match[i]));b.phase='function';}return;}
  if(b.phase==='write'){b.write.push(value);if(b.write.length===3){for(const s of b.selected){s.scratch[2]=b.write[0];s.scratch[3]=b.write[1];s.scratch[4]=(b.write[2]&0x60)|0x1f;}b.phase='idle';}return;}
  if(b.phase!=='function')return;
  if(value===0x44){for(const s of b.selected){const resolution=9+((s.scratch[4]>>5)&3);s.pending={until:clockUs()+conversionUs(resolution),temperature:s.d.temperature,bits:resolution};s.reason=`Pretvorba ${resolution} bita u tijeku`;log(b,'convert',resolution);}b.phase='busy';}
  else if(value===0xbe){const rows=b.selected.map(s=>scratch(s));b.tx=Array.from({length:9},(_,i)=>rows.reduce((v,row)=>v&row[i],255));b.bit=0;b.phase='read';log(b,'scratchpad');}
  else if(value===0x4e){b.phase='write';b.write=[];}
  else if(value===0xb4){b.tx=[255];b.bit=0;b.phase='read';}
  else if(value===0x48){for(const s of b.selected){s.copyValues=s.scratch.slice(2,5);s.copyUntil=clockUs()+10000;}b.phase='busy';}
  else if(value===0xb8){for(const s of b.selected)s.scratch.splice(2,3,...s.eeprom);b.phase='busy';}
  else b.phase='idle';
 }
 function readBit(b){
  if(b.phase==='busy')return b.selected.every(s=>!s.pending&&!s.copyUntil)?1:0;
  if(b.phase==='read'){const i=b.bit++;return i<b.tx.length*8?(b.tx[i>>3]>>(i&7))&1:1;}
  if(b.phase==='search'&&b.searchPart<2){const index=b.searchIndex,part=b.searchPart++;return b.selected.every(s=>(((s.rom[index>>3]>>(index&7))&1)^(part===1?1:0))===1)?1:0;}
  return null;
 }
 function writeBit(b,value){
  if(b.phase==='search'&&b.searchPart===2){const index=b.searchIndex;b.selected=b.selected.filter(s=>((s.rom[index>>3]>>(index&7))&1)===value);b.searchPart=0;b.searchIndex++;if(b.searchIndex===64){log(b,'search-complete',b.selected.length);b.phase='idle';}return;}
  if(!['rom','match','function','write'].includes(b.phase))return;
  b.rx.push(value);if(b.rx.length===8){const value=b.rx.reduce((v,bit,i)=>v|(bit<<i),0);b.rx=[];command(b,value);}
 }
 function observe(){sync();const t=clockUs(),roots=[...new Set(states.map(s=>rootData().root(s.d.data)))];
  for(const net of roots){let b=buses.get(net);if(!b){b={net,phase:'idle',lowAt:null,selected:[],rx:[],trace:[],sinks:[],slot:null};buses.set(net,b);}
   const low=[...gpioNet].some(([pin,n])=>same(n,net)&&pins.get(pin)?.mode==='OUT'&&pins.get(pin)?.value===0);
   b.sinks=b.sinks.filter(v=>v.end>t);
   if(low&&b.lowAt===null){b.lowAt=t;const value=readBit(b);b.slot=value===null?'write':'read';if(value===0)b.sinks.push({start:t+2,end:t+60,devices:[...b.selected]});}
   else if(!low&&b.lowAt!==null){const duration=t-b.lowAt;b.lowAt=null;
    // Master specification: >=480 us. The pinned AVR core/OneWire path
    // produces 479.25 us at its register boundary. Allow 1 us quantisation
    // tolerance; this is a functional receiver policy, not a new guarantee
    // about the physical sensor's undocumented reset-detection threshold.
    if(duration>=479){reset(b);continue;}
    if(b.slot==='write'&&((duration>=1&&duration<=15)||(duration>=60&&duration<=120)))writeBit(b,duration<=15?1:0);
    else if(b.slot==='write'){b.phase='idle';log(b,'invalid-slot',duration);}
    b.slot=null;
   }
  }
 }
 function sinkActive(v){const t=clockUs();return t>=v.start&&t<v.end&&v.devices.some(s=>s.powered&&s.d.oneWireFault!=='disconnected');}
 return {
  observe,
  edges(root,edge){sync();for(const b of buses.values())for(const sink of b.sinks)if(sinkActive(sink)){const s=sink.devices.find(s=>s.powered&&s.d.oneWireFault!=='disconnected');edge(root(b.net),root(s.d.gnd),10);break;}},
  conflicts(){return [...buses.values()].filter(b=>b.sinks.some(sinkActive)&&[...gpioNet].some(([pin,net])=>same(net,b.net)&&pins.get(pin)?.mode==='OUT'&&pins.get(pin)?.value===1)).map(b=>b.net);},
  nextEdgeUs(){const t=clockUs();let next=Infinity;for(const b of buses.values())for(const v of b.sinks)for(const at of [v.start,v.end])if(at>t+.001)next=Math.min(next,at);return next;},
  input(data){const s=states.find(s=>s.d.id===data.component);if(!s)return;if(Number.isFinite(data.temperature))s.d.temperature=Math.max(-55,Math.min(125,data.temperature));if(['none','crc','disconnected'].includes(data.oneWireFault))s.d.oneWireFault=data.oneWireFault;},
  snapshot(){sync();const result={},diagnostics=[];for(const s of states){const e=environment(s),b=buses.get(rootData().root(s.d.data));
   result[s.d.id]={powered:s.powered,rom:s.d.rom,temperature:s.d.temperature,resolution:9+((s.scratch[4]>>5)&3),busy:!!s.pending,sample:s.sample,scratchpad:scratch(s),reason:s.reason,fault:s.d.oneWireFault,trace:b?.trace.slice()??[]};
   const reason=!e.powered?'VDD=3–5,5 V i zajednička masa; parazitsko napajanje nije podržano':!e.pull?'Dodaj vanjski pull-up 1–10 kΩ DQ–VDD':!e.goodLevel?'DQ nema valjanu HIGH razinu ili je naponska domena pogrešna':null;
   if(reason)diagnostics.push({code:'onewire-electrical',severity:'warning',message:s.d.id+': '+reason,terminals:c.nets[s.d.data].terminals,wires:c.nets[s.d.data].wires});
  }return {oneWireDevices:result,diagnostics};},
 };
}
