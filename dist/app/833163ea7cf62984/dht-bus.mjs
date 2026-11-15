// MIT. DHT single-data-wire protocol, distinct from Dallas 1-Wire.
// Frames are open-drain GPIO waveforms. Neither adapter receives decoded values.
export const DHT_PROFILES=Object.freeze({
 dht11:{minStartUs:18000,intervalUs:1000000,startupUs:1000000,minV:3,maxV:5.5,minT:0,maxT:50,minH:20,maxH:90},
 dht22:{minStartUs:1000,intervalUs:2000000,startupUs:2000000,minV:3.3,maxV:6,minT:-40,maxT:80,minH:0,maxH:100},
});
export function dhtBytes(kind,temperature,humidity){
 const p=DHT_PROFILES[kind],t=Math.max(p.minT,Math.min(p.maxT,temperature)),h=Math.max(p.minH,Math.min(p.maxH,humidity));
 const b=kind==='dht11'?[Math.round(h),0,Math.round(t),0]:[Math.round(h*10)>>8,Math.round(h*10)&255,((Math.round(Math.abs(t)*10)>>8)&127)|(t<0?128:0),Math.round(Math.abs(t)*10)&255];
 return [...b,b.reduce((a,v)=>a+v,0)&255];
}
export function createDHTBus({c,pins,gpioNet,rootData,idleSolution,clockUs,logicVoltage}){
 const states=(c.timedSensors??[]).map(d=>({d,profile:DHT_PROFILES[d.kind],powered:false,powerAt:clockUs(),lowAt:null,lastStart:-Infinity,sample:0,bytes:[],trace:[],reason:'Čeka početno stabiliziranje i start',endUs:0}));
 const same=(a,b)=>rootData().root(a)===rootData().root(b);
 function environment(s){
  const v=idleSolution().volts,d=s.d,p=s.profile;
  const powered=v[d.vcc]!==null&&v[d.gnd]!==null&&Math.abs(v[d.gnd])<.05&&v[d.vcc]-v[d.gnd]>=p.minV-.01&&v[d.vcc]-v[d.gnd]<=p.maxV+.01;
  const pull=c.resistors.some(r=>r.ohms>=1000&&r.ohms<=10000&&((same(r.a,d.data)&&same(r.b,d.vcc))||(same(r.b,d.data)&&same(r.a,d.vcc))));
  const collisions=states.filter(o=>same(o.d.data,d.data)).length>1;
  const mapped=[...gpioNet].filter(([,net])=>same(net,d.data)).map(([pin])=>pin);
  const goodLevel=v[d.data]!==null&&v[d.data]>=logicVoltage*.75&&v[d.data]<=logicVoltage+.3;
  return {powered,pull,collisions,mapped,goodLevel};
 }
 function power(s,e){
  if(e.powered!==s.powered){s.powered=e.powered;s.powerAt=clockUs();s.trace=[];s.lowAt=null;s.lastStart=-Infinity;s.sample=0;s.bytes=[];}
 }
 function observe(){
  const t=clockUs();
  for(const s of states){const e=environment(s);power(s,e);if(!s.powered){s.reason='Provjeri VCC i zajedničku masu';continue;}
   const low=e.mapped.some(pin=>{const p=pins.get(pin);return p?.mode==='OUT'&&p.value===0;});
   if(low){if(s.lowAt===null){s.lowAt=t;s.trace=[];}continue;}
   if(s.lowAt===null)continue;
   const duration=t-s.lowAt;s.lowAt=null;
   if(duration<s.profile.minStartUs){s.reason=`Start je prekratak: ${Math.round(duration)} µs; treba barem ${s.profile.minStartUs} µs`;continue;}
   if(!e.pull||!e.goodLevel||e.collisions){s.reason=!e.pull?'Nedostaje vanjski pull-up 1–10 kΩ':e.collisions?'Dva DHT senzora dijele DATA; svaki treba svoj GPIO':'DATA nema valjanu HIGH razinu';continue;}
   if(t-s.powerAt<s.profile.startupUs){s.reason='Prerano nakon uključivanja napajanja';continue;}
   if(t-s.lastStart<s.profile.intervalUs){s.reason='Prečesto očitavanje: senzor ne odgovara u ovom profilu';continue;}
   s.lastStart=t;
   if(s.d.dhtFault==='timeout'){s.trace=[];s.reason='Pokus: senzor ne odgovara (timeout)';continue;}
   s.bytes=dhtBytes(s.d.kind,s.d.temperature,s.d.humidity);if(s.d.dhtFault==='checksum')s.bytes[4]^=1;
   let at=t;s.trace=[];
   const segment=(level,durationUs)=>{s.trace.push({atUs:at,level,durationUs});at+=durationUs;};
   segment(1,20);segment(0,80);segment(1,80);
   for(const b of s.bytes)for(let bit=7;bit>=0;bit--){segment(0,50);segment(1,b&(1<<bit)?70:27);}
   segment(0,50);s.endUs=at;s.sample++;s.reason=s.d.dhtFault==='checksum'?'Pokus: prenosi se nevaljan kontrolni zbroj':'Prenosi se 40 bitova; provjeru radi učenikov driver';
  }
 }
 function lowAt(s,t){return s.powered&&s.trace.some(v=>v.level===0&&t>=v.atUs&&t<v.atUs+v.durationUs);}
 return {
  observe,
  conflicts(){return states.filter(s=>lowAt(s,clockUs())&&[...pins].some(([pin,p])=>same(gpioNet.get(pin),s.d.data)&&p.mode==='OUT'&&p.value===1)).map(s=>s.d.data);},
  // A low DATA is an electrical sink, never an active HIGH driver.
  edges(root,edge){const t=clockUs();for(const s of states)if(lowAt(s,t))edge(root(s.d.data),root(s.d.gnd),10);},
  nextEdgeUs(){const t=clockUs();let next=Infinity;for(const s of states)for(const v of s.trace){if(v.atUs>t+.001)next=Math.min(next,v.atUs);const end=v.atUs+v.durationUs;if(end>t+.001)next=Math.min(next,end);}return next;},
  input(data){const s=states.find(s=>s.d.id===data.component);if(!s)return;const p=s.profile;for(const [key,lo,hi]of [['temperature',p.minT,p.maxT],['humidity',p.minH,p.maxH]])if(Number.isFinite(data[key]))s.d[key]=Math.max(lo,Math.min(hi,data[key]));if(['none','checksum','timeout'].includes(data.dhtFault))s.d.dhtFault=data.dhtFault;},
  snapshot(){const result={},diagnostics=[];for(const s of states){const e=environment(s);power(s,e);const transmitting=clockUs()<s.endUs&&s.trace.length>0;
   result[s.d.id]={powered:s.powered,sample:s.sample,temperature:s.d.temperature,humidity:s.d.humidity,bytes:s.bytes.slice(),trace:s.trace.slice(),reason:s.reason,transmitting:!!transmitting,fault:s.d.dhtFault};
   const reason=!e.powered?'Provjeri napajanje i zajedničku masu':!e.pull?'Dodaj vanjski pull-up 1–10 kΩ DATA–VCC':e.collisions?'Svaki DHT zahtijeva zaseban DATA GPIO':null;
   if(reason)diagnostics.push({code:'dht-electrical',severity:'warning',message:s.d.id+': '+reason,terminals:c.nets[s.d.data].terminals,wires:c.nets[s.d.data].wires});
  }return {timedSensors:result,diagnostics};},
 };
}
