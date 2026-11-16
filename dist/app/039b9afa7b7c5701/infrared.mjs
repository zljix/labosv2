// MIT. Ideal optical routing and demodulated GPIO waveform. No decoded data API.
export const NEC_TIMING=Object.freeze({mark:562.5,leaderMark:9000,leaderSpace:4500,oneSpace:1687.5,zeroSpace:562.5,repeatSpace:2250,period:110000});
export function necEnvelope(address,command,repeat=false,fault='none') {
 const q=[],add=(level,durationUs)=>q.push({level,durationUs});
 add(0,fault==='timing'?3000:9000);add(1,repeat?2250:4500);
 if(!repeat){const bytes=[address,address^255,command,(command^255)^(fault==='inverse'?1:0)];
  for(const b of bytes)for(let bit=0;bit<8;bit++){add(0,562.5);add(1,b&(1<<bit)?1687.5:562.5);}}
 add(0,562.5);return q;
}
export function createInfrared({c,pins,gpioNet,rootData,idleSolution,clockUs}) {
 const receivers=(c.irReceivers??[]).map(d=>({...d,powered:false,low:false,trace:[],transitions:0}));
 const remotes=(c.irRemotes??[]).map(d=>({...d,mark:false,queue:[],trace:[],presses:0,lastPress:0}));
 const transmitters=(c.irTransmitters??[]).map(d=>({...d,powered:false,mark:false,lastLevel:false,rise:-Infinity,highUs:0,expiry:Infinity,carrierHz:null,trace:[]}));
 const powered=[...receivers,...transmitters];let powerKey=null;
 const same=(a,b)=>rootData().root(a)===rootData().root(b);
 function record(d,timeUs,level){d.trace.push({timeUs,level});if(d.trace.length>512)d.trace.shift();}
 function syncPower(){
  if(!powered.length)return;
  const root=rootData().root,relevant=new Set(powered.flatMap(d=>[root(d.vcc),root(d.gnd)]));
  // Supply GPIOs behind explicit resistors/potentiometers also invalidate power.
  const links=[...c.resistors.map(r=>[root(r.a),root(r.b)]),...c.pots.map(p=>[root(p.a),root(p.w),root(p.b)])];
  for(let changed=true;changed;){changed=false;for(const link of links)if(link.some(n=>relevant.has(n)))for(const n of link)if(!relevant.has(n)){relevant.add(n);changed=true;}}
  const key=JSON.stringify([[...pins].filter(([pin])=>relevant.has(rootData().root(gpioNet.get(pin)))).map(([pin,p])=>[pin,p.mode,p.value,p.duty]),c.buttons.map(b=>b.pressed)]);
  if(key===powerKey)return;powerKey=key;const v=idleSolution().volts;
  for(const d of powered){d.powered=v[d.vcc]!=null&&v[d.gnd]!=null&&Math.abs(v[d.gnd])<.05&&Math.abs(v[d.vcc]-v[d.gnd]-d.moduleVoltage)<.15;if(!d.powered&&'expiry'in d){d.mark=false;d.expiry=Infinity;d.rise=-Infinity;}}
 }
 function updateReceivers(at){let changed=false;
  for(const d of receivers){const low=d.powered&&!d.irBlocked&&[...remotes,...transmitters].some(s=>s.irChannel===d.irChannel&&s.mark);
   if(low!==d.low){d.low=low;d.transitions++;record(d,at,low?0:1);changed=true;}}
  return changed;
 }
 function observe(){
  syncPower();const now=clockUs();let changed=false;
  // Process every scheduled optical edge even when the student's code sleeps.
  // 40-part limit and bounded queues allow fewer than 65536 pending events.
  for(let count=0;count<65536;count++){
   const next=Math.min(Infinity,...remotes.map(d=>d.queue[0]?.at??Infinity),...transmitters.map(d=>d.expiry));
   if(next>now||!Number.isFinite(next))break;
   for(const d of remotes)while(d.queue[0]?.at<=next){const e=d.queue.shift();d.mark=e.level===0;record(d,e.at,e.level);changed=true;}
   for(const d of transmitters)if(d.expiry<=next){d.expiry=Infinity;if(d.mark){d.mark=false;record(d,next,1);changed=true;}}
   changed=updateReceivers(next)||changed;
  }
  for(const d of transmitters){
   const drivers=[...pins].filter(([pin,p])=>same(gpioNet.get(pin),d.signal)&&['OUT','PWM'].includes(p.mode));
   const p=drivers.length===1?drivers[0][1]:null;let mark=d.mark;
   if(!d.powered||!p){mark=false;d.expiry=Infinity;d.rise=-Infinity;d.lastLevel=false;}
   else if(p.mode==='PWM'){
    mark=p.freq>=34000&&p.freq<=42000&&p.duty>=65535*.15&&p.duty<=65535*.5;
    d.carrierHz=mark?p.freq:null;d.expiry=Infinity;d.lastLevel=false;d.rise=-Infinity;
   }else{
    const level=!!p.value;
    if(level!==d.lastLevel){
     if(level){const period=now-d.rise;if(period>=1000000/42000&&period<=1000000/34000&&d.highUs/period>=.15&&d.highUs/period<=.5){mark=true;d.carrierHz=1000000/period;d.expiry=now+80;}d.rise=now;}
     else d.highUs=now-d.rise;
     d.lastLevel=level;
    }
   }
   if(mark!==d.mark){d.mark=mark;record(d,now,mark?0:1);changed=true;}
  }
  return updateReceivers(now)||changed;
 }
 for(const d of [...receivers,...remotes,...transmitters])record(d,clockUs(),1);
 return {
  observe,
  nextEdgeUs(){return Math.min(Infinity,...remotes.map(d=>d.queue[0]?.at??Infinity),...transmitters.map(d=>d.expiry));},
  edges(root,edge){for(const d of receivers)if(d.powered){edge(root(d.output),root(d.vcc),30000);if(d.low)edge(root(d.output),root(d.gnd),10);}},
  conflicts(){return receivers.filter(d=>d.low&&(c.rails.some(r=>r.volts>0&&same(r.net,d.output))||[...pins].some(([pin,p])=>same(gpioNet.get(pin),d.output)&&(p.mode==='OUT'&&p.value||p.mode==='PWM'&&p.duty)))).map(d=>d.output);},
  input(data){
   observe();const remote=remotes.find(d=>d.id===data.component),receiver=receivers.find(d=>d.id===data.component);
   if(receiver&&typeof data.irBlocked==='boolean'){receiver.irBlocked=data.irBlocked;updateReceivers(clockUs());}
   if(!remote)return;
   for(const key of ['irAddress','irCommand'])if(Number.isInteger(data[key])&&data[key]>=0&&data[key]<=255)remote[key]=data[key];
   if(['none','inverse','timing'].includes(data.irFault))remote.irFault=data.irFault;
   if(Number.isInteger(data.irHoldMs)&&data.irHoldMs>=0&&data.irHoldMs<=2000)remote.irHoldMs=data.irHoldMs;
   if(!Number.isSafeInteger(data.irPress)||data.irPress<=remote.lastPress)return;
   if(remote.queue.length>768)throw Error('IR: pričekaj dovršetak prethodnih pritisaka.');
   remote.lastPress=data.irPress;remote.presses++;
   const start=Math.max(clockUs()+10000,(remote.queue.at(-1)?.at??-Infinity)+40000);
   for(let i=0;i<=Math.floor(remote.irHoldMs/110);i++){
    let at=start+i*110000;
    for(const s of necEnvelope(remote.irAddress,remote.irCommand,i>0,remote.irFault)){remote.queue.push({at,level:s.level});at+=s.durationUs;}
    remote.queue.push({at,level:1});
   }
  },
  snapshot(){observe();const diagnostics=[];
   const devices=Object.fromEntries([...receivers,...remotes,...transmitters].map(d=>{
    const kind=receivers.includes(d)?'receiver':remotes.includes(d)?'remote':'transmitter';
    if(kind!=='remote'){
     const report=(code,message,net)=>diagnostics.push({code,severity:'warning',message:d.id+': '+message,terminals:c.nets[net].terminals,wires:c.nets[net].wires});
     if(!d.powered)report('ir-supply','provjeri VCC odabranog profila i zajedničku masu.',d.vcc);
     const signal=kind==='receiver'?d.output:d.signal;
     if(!c.nets[signal].wires.length)report('ir-signal-open','signalni izvod nije spojen.',signal);
     if(kind==='receiver'&&[...pins].some(([pin,p])=>same(gpioNet.get(pin),signal)&&['OUT','PWM'].includes(p.mode)))report('ir-driven','OUT prijamnika treba digitalni ulaz na pločici.',signal);
    }
    return[d.id,{kind,powered:kind==='remote'?true:d.powered,channel:d.irChannel,level:kind==='receiver'?(d.low?0:1):(d.mark?0:1),busy:kind==='remote'?!!d.queue.length:kind==='transmitter'?d.mark:false,blocked:!!d.irBlocked,presses:d.presses??0,carrierHz:d.carrierHz??null,transitions:d.transitions??0,trace:d.trace.slice()}];
   }));return{infrared:devices,diagnostics};
  }
 };
}
