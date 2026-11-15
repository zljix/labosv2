// MIT. Functional actuator profiles. No motor/coil current or mechanical dynamics.
export function createActuators({c,clockUs,waveform,rootData}) {
 const relays=c.relays??[],buzzers=c.buzzers??[],bridges=c.bridges??[],motors=c.motors??[];
 const states=new Map(relays.map(d=>[d.id,{powered:false,energized:false,contact:'COM–NC',reason:'Bez napajanja'}]));
 const trace=[],areas=new Map();let previous=null,lastUs=clockUs(),frameUs=lastUs;
 const valid=v=>Number.isFinite(v),ground=(v,n)=>valid(v[n])&&Math.abs(v[n])<.05&&(c.referenceGrounds??[]).some(g=>rootData().root(g)===rootData().root(n));
 const supply=(v,n,g,min=4.5,max=5.5)=>ground(v,g)&&valid(v[n])&&v[n]-v[g]>=min&&v[n]-v[g]<=max;
 const ttl=(v,g)=>!valid(v)||!valid(g)?null:v-g<=1.5?0:v-g>=2.3?1:null;
 function log(component,operation,value){trace.push({timeUs:clockUs(),component,operation,value:String(value)});if(trace.length>128)trace.shift();}
 function contacts(){return [...relays.map(d=>[d.com,states.get(d.id).energized?d.no:d.nc]),...bridges.flatMap(d=>[...(d.jumperA?[[d.inputs[0],d.vss]]:[]),...(d.jumperB?[[d.inputs[5],d.vss]]:[])])];}
 function updateContacts(v){let changed=false;
  for(const d of relays){
   const old=states.get(d.id),powered=supply(v,d.vcc,d.gnd)&&valid(v[d.lv])&&Math.abs(v[d.lv]-(d.logicVoltage??3.3))<.2;
   const relative=valid(v[d.signal])?v[d.signal]-v[d.gnd]:null,lv=d.logicVoltage??3.3;
   const level=relative===null?null:relative<=.3*lv?0:relative>=.7*lv?1:null;
   const energized=powered&&level===(d.activeLevel==='high'?1:0);
   const s={powered,energized,contact:energized?'COM–NO':'COM–NC',reason:!powered?'Provjeri VCC, LV i zajedničku masu':level===null?'Neodređen IN':energized?'Zavojnica pobuđena':'Zavojnica bez pobude'};
   if(old.energized!==s.energized){changed=true;log(d.id,'contact',s.contact);}states.set(d.id,s);
  }return changed;
 }
 function passiveEdges(root,edge){for(const d of relays)edge(root(d.signal),root(d.activeLevel==='high'?d.gnd:d.lv),10000);}
 function bridgeState(d,v){
  const powered=supply(v,d.vss,d.gnd)&&supply(v,d.vs,d.gnd,5,12.1),channels=[];
  for(const [en,a,b]of [[0,1,2],[5,3,4]]){
   const enabled=ttl(v[d.inputs[en]],v[d.gnd]),x=ttl(v[d.inputs[a]],v[d.gnd]),y=ttl(v[d.inputs[b]],v[d.gnd]);
   let mode=!powered?'bez napajanja':enabled===0?'slobodno':enabled===null||x===null||y===null?'neodređeno':x===y?'kočenje':x?'naprijed':'natrag';
   const half=Math.min(d.bridgeDrop??2,Math.max(0,(v[d.vs]??0)-(v[d.gnd]??0)))/2;
   const output=powered&&enabled===1&&x!==null&&y!==null?[x?v[d.vs]-half:v[d.gnd]+half,y?v[d.vs]-half:v[d.gnd]+half]:null;
   channels.push({mode,voltage:output?output[0]-output[1]:null,output});
  }return {powered,channels};
 }
 function driveEdges(v,root,edge){
  for(const d of bridges){const s=bridgeState(d,v);s.channels.forEach((ch,i)=>{if(ch.output)ch.output.forEach((volts,j)=>edge(root(d.outputs[i*2+j]),root(d.gnd),.01,volts-v[d.gnd]));});}
 }
 function conflicts(v,pins,gpioNet,root){
  const nets=new Set();
  for(const d of bridges)bridgeState(d,v).channels.forEach((ch,i)=>{if(ch.output)ch.output.forEach((volts,j)=>{const net=d.outputs[i*2+j],r=root(net);
   if(c.rails.some(rail=>root(rail.net)===r&&Math.abs(rail.volts-volts)>.05)||[...pins].some(([pin,p])=>root(gpioNet.get(pin))===r&&['OUT','PWM'].includes(p.mode)))nets.add(net);
  });});return [...nets];
 }
 function sample(v){return Object.fromEntries(motors.map(d=>[d.id,valid(v[d.a])&&valid(v[d.b])?v[d.a]-v[d.b]:null]));}
 function observe(v){const at=clockUs(),dt=Math.max(0,at-lastUs);if(previous&&dt){for(const d of motors){const a=areas.get(d.id)??{value:0,time:0};if(previous[d.id]!==null){a.value+=previous[d.id]*dt;a.time+=dt;}areas.set(d.id,a);}}previous=sample(v);lastUs=at;}
 function snapshot(v,averagedV,useAnalyticPWM=false,motorAverages={},motorPeaks={}){
  observe(v);const elapsed=clockUs()-frameUs,values=useAnalyticPWM?motorAverages:previous;
  const motorStates=Object.fromEntries(motors.map(d=>{
   const a=areas.get(d.id),voltage=useAnalyticPWM||!elapsed?values[d.id]:a?.time? a.value/elapsed:null;
   const normalized=voltage===null?0:Math.max(-1,Math.min(1,voltage/(d.ratedVoltage??6)));
   const s={voltage:voltage===null?null:+voltage.toFixed(4),relativeSpeed:+(100*Math.abs(normalized)).toFixed(2),direction:Math.abs(normalized)<.001?0:Math.sign(normalized),mode:voltage===null?'slobodno / odspojeno':Math.abs(voltage)<.01?'zaustavljen / kočenje':voltage>0?'naprijed':'natrag'};
   log(d.id,'motor',s.voltage===null?'Hi-Z':`${s.voltage} V; ${s.relativeSpeed} %; ${s.mode}`);return [d.id,s];
  }));areas.clear();frameUs=clockUs();
  const buzzerStates=Object.fromEntries(buzzers.map(d=>{
   const powered=supply(v,d.vcc,d.gnd),wave=waveform(d.signal),level=ttl(v[d.signal],v[d.gnd]);
   const active=powered&&(d.kind==='activeBuzzer'?level===1||!!wave?.duty:!!wave&&wave.freq>=100&&wave.freq<=10000&&wave.duty>0&&wave.duty<1);
   const frequency=active?(d.kind==='activeBuzzer'?2300:wave.freq):null;
   const s={powered,active,frequency,duty:active?wave?.duty??1:0,reason:!powered?'Provjeri 5 V i zajedničku masu':active?'Ton uključen':d.kind==='activeBuzzer'?'SIG LOW':'Potreban izmjenični signal 100–10000 Hz'};
   log(d.id,'tone',frequency===null?'OFF':frequency.toFixed(2)+' Hz');return [d.id,s];
  }));
  const bridgeStates=Object.fromEntries(bridges.map(d=>{const s=bridgeState(d,v);return[d.id,{powered:s.powered,channels:s.channels.map(({mode,voltage})=>({mode,voltage}))}];}));
  const diagnostics=[];
  for(const d of motors){const peak=(motorPeaks[d.id]??0)>(d.ratedVoltage??6)+.05||[v,averagedV].some(v=>valid(v[d.a])&&valid(v[d.b])&&Math.abs(v[d.a]-v[d.b])>(d.ratedVoltage??6)+.05);if(peak)diagnostics.push({code:'motor-overvoltage',severity:'warning',message:'Motor: pogonski napon prekoračuje nazivni parametar profila. Manji PWM ne smanjuje vršni napon impulsa.',terminals:[...c.nets[d.a].terminals,...c.nets[d.b].terminals],wires:[...c.nets[d.a].wires,...c.nets[d.b].wires]});}
  return {actuators:{relays:Object.fromEntries(states),buzzers:buzzerStates,bridges:bridgeStates,motors:motorStates,trace:trace.slice()},diagnostics};
 }
 return {contacts,updateContacts,passiveEdges,driveEdges,conflicts,observe,snapshot};
}
