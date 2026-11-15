// MIT. A4988 functional translator and ideal incremental motor model.
// Phase values are normalized DAC targets, NOT measured currents or voltages.
const resolutionOf = bits => ({0:1,1:2,2:4,3:8,7:16})[bits] ?? null;
export function createSteppers({c,clockUs,rootData,pins,gpioNet}) {
 const drivers=c.stepperDrivers??[],motors=c.stepperMotors??[],states=new Map(),motorStates=new Map();
 for(const m of motors)motorStates.set(m.id,{ticks:0,positionCertain:true,driver:null,connected:false,orientation:0});
 for(const d of drivers)states.set(d.id,{powered:false,motorPower:false,levels:{},changes:{},ticks:0,resolution:1,rising:0,accepted:0,ignored:0,rejected:0,pwmWarned:false,pending:null,lowAt:null,wakeAt:Infinity,lastFault:'',trace:[]});
 function log(d,s,operation,value){s.trace.push({timeUs:clockUs(),operation,value:String(value)});if(s.trace.length>128)s.trace.shift();}
 function linked(m,d){
  const root=rootData().root,outs=d.outputs.map(root),a=m.coils.map(root);
  if(new Set(outs).size!==4||new Set(a).size!==4)return null;
  const pair=(x,y)=>{for(let p=0;p<2;p++){if(x===outs[p*2]&&y===outs[p*2+1])return {p,sign:1};if(y===outs[p*2]&&x===outs[p*2+1])return {p,sign:-1};}return null;};
  const x=pair(a[0],a[1]),y=pair(a[2],a[3]);return x&&y&&x.p!==y.p?x.sign*y.sign*(x.p===0?1:-1):null;
 }
 function ground(v,n){return Number.isFinite(v[n])&&Math.abs(v[n])<.05&&(c.referenceGrounds??[]).some(g=>rootData().root(g)===rootData().root(n));}
 function supply(v,n,g,min,max){return ground(v,g)&&Number.isFinite(v[n])&&v[n]-v[g]>=min&&v[n]-v[g]<=max;}
 function reject(d,s,why){s.rejected++;s.lastFault=why;log(d,s,'rejected',why);}
 function uncertain(d){for(const m of motors)if(linked(m,d)!==null)motorStates.get(m.id).positionCertain=false;}
 function home(d,s,why){if(s.ticks!==0)uncertain(d);s.ticks=0;s.pending=null;log(d,s,'home',why);}
 function commit(d,s){
  const p=s.pending;if(!p)return;s.pending=null;
  s.ticks+=p.delta;s.resolution=p.resolution;s.accepted++;log(d,s,'step',`${p.delta>0?'+':'-'}1/${p.resolution}; translator=${s.ticks}/16`);
  for(const m of motors){const orientation=linked(m,d),ms=motorStates.get(m.id);
   if(orientation!==null&&p.drive){ms.ticks+=p.delta*orientation;}
   else if(orientation!==null)ms.positionCertain=false;
  }
 }
 function observe(v){
  const at=clockUs();
  for(const d of drivers){
   const s=states.get(d.id),powered=supply(v,d.vdd,d.gnd,3,5.5),motorPower=supply(v,d.vmot,d.gnd,8,35);
   const dd=Number.isFinite(v[d.vdd])&&Number.isFinite(v[d.gnd])?v[d.vdd]-v[d.gnd]:0;
   const levels=Object.fromEntries(Object.entries(d.inputs).map(([name,net])=>{const x=Number.isFinite(v[net])?v[net]-v[d.gnd]:NaN;return [name,!powered||!Number.isFinite(x)||x<-.3||x>5.5?null:x<=.3*dd?0:x>=.7*dd?1:null];}));
   const changed=Object.keys(levels).filter(k=>levels[k]!==s.levels[k]);
   // Confirm the old HIGH before processing a falling edge/control change.
   if(s.pending){const age=at-s.pending.at;
    if(changed.some(k=>['DIR','MS1','MS2','MS3','RESET'].includes(k))&&age<.2-1e-6){reject(d,s,'hold < 0,2 µs');s.pending=null;}
    else if(age>=1-1e-6&&powered&&s.levels.RESET===1&&s.levels.SLEEP===1)commit(d,s);
    else if(levels.STEP!==1||!powered||levels.RESET!==1||levels.SLEEP!==1){reject(d,s,'STEP HIGH < 1 µs ili prekinuto napajanje/RESET/SLEEP');s.pending=null;}
   }
   for(const k of changed)s.changes[k]=at;
   if(powered!==s.powered){if(powered){home(d,s,'uključenje VDD');s.wakeAt=at+1000;}else{if(s.powered)uncertain(d);s.pending=null;}log(d,s,'logic-power',powered?'ON':'OFF');}
   if(s.motorPower&&!motorPower)uncertain(d);
   if(powered&&levels.RESET===0&&s.levels.RESET!==0)home(d,s,'RESET LOW; osovina se ne vraća na nulu');
   if(powered&&levels.SLEEP===1&&s.levels.SLEEP!==1){home(d,s,'buđenje; električni Home');s.wakeAt=at+1000;}
   if(powered&&levels.SLEEP===0)s.pending=null;
   if(changed.includes('ENABLE'))log(d,s,'enable',levels.ENABLE===0?'izlazi ON; translator aktivan':'izlazi OFF; translator aktivan');
   if(levels.STEP===0&&s.levels.STEP!==0)s.lowAt=at;
   const pwm=[...pins].some(([pin,p])=>p.mode==='PWM'&&rootData().root(gpioNet.get(pin))===rootData().root(d.inputs.STEP));
   if(pwm&&!s.pwmWarned){s.pwmWarned=true;s.lastFault='Funkcionalni PWM na STEP nije podržan; generiraj digitalne GPIO impulse';log(d,s,'unsupported',s.lastFault);}
   const rising=!pwm&&powered&&s.powered&&levels.STEP===1&&s.levels.STEP===0;
   s.powered=powered;s.motorPower=motorPower;
   if(rising){
    s.rising++;const bits=levels.MS1===null||levels.MS2===null||levels.MS3===null?null:levels.MS1+2*levels.MS2+4*levels.MS3;
    const resolution=resolutionOf(bits),increment=resolution?16/resolution:0;
    const problem=levels.RESET!==1?'RESET nije HIGH':levels.SLEEP!==1?'SLEEP nije HIGH':at<s.wakeAt-1e-6?'buđenje < 1 ms':levels.DIR===null?'DIR je neodređen':levels.ENABLE===null?'ENABLE je neodređen':!resolution?'nedeklarirana MS kombinacija':at-(s.lowAt??at)<1-1e-6?'STEP LOW < 1 µs':['DIR','MS1','MS2','MS3','RESET'].some(k=>at-(s.changes[k]??at)<.2-1e-6)?'setup < 0,2 µs':s.ticks%increment!==0?'promijeni mikrostep na zajedničkom položaju ili resetiraj translator':null;
    if(levels.RESET===0||levels.SLEEP===0){s.ignored++;log(d,s,'ignored',levels.RESET===0?'RESET LOW':'SLEEP LOW');}
    else if(problem)reject(d,s,problem);
    else s.pending={at,delta:(levels.DIR?1:-1)*increment,resolution,drive:motorPower&&levels.ENABLE===0};
   }
   s.levels=levels;
  }
  for(const m of motors){const ms=motorStates.get(m.id),links=drivers.flatMap(d=>{const orientation=linked(m,d);return orientation===null?[]:[{d,orientation}];});
   if(ms.connected&&links.length!==1)ms.positionCertain=false;
   ms.connected=links.length===1;ms.driver=links.length===1?links[0].d.id:null;ms.orientation=links.length===1?links[0].orientation:0;
  }
 }
 function passiveEdges(root,edge){for(const d of drivers)for(const [k,ohms]of [['MS1',100000],['MS2',50000],['MS3',100000]])edge(root(d.inputs[k]),root(d.gnd),ohms);}
 function conflicts(){
  const root=rootData().root,nets=new Set();
  for(const d of drivers){const s=states.get(d.id),l=s.levels;if(!s.powered||!s.motorPower||l.ENABLE!==0||l.RESET!==1||l.SLEEP!==1||clockUs()<s.wakeAt)continue;
   for(const net of d.outputs){const r=root(net);if(c.rails.some(x=>root(x.net)===r)||[...pins].some(([pin,p])=>['OUT','PWM'].includes(p.mode)&&root(gpioNet.get(pin))===r)||drivers.flatMap(x=>x.outputs).filter(n=>root(n)===r).length>1)nets.add(net);}
  }return [...nets];
 }
 function snapshot(v){
  observe(v);
  const ds=Object.fromEntries(drivers.map(d=>{const s=states.get(d.id),l=s.levels,enabled=s.powered&&s.motorPower&&l.ENABLE===0&&l.RESET===1&&l.SLEEP===1&&clockUs()>=s.wakeAt;
   const phase=(45+s.ticks*90/16)*Math.PI/180;
   return [d.id,{powered:s.powered,motorPower:s.motorPower,enabled,levels:{...l},resolution:s.resolution,translatorTicks:s.ticks,rising:s.rising,accepted:s.accepted,ignored:s.ignored,rejected:s.rejected,pending:!!s.pending,phaseA:enabled?Math.cos(phase):null,phaseB:enabled?Math.sin(phase):null,lastFault:s.lastFault,trace:s.trace.slice(),reason:!s.powered?'Provjeri VDD i zajedničku masu':l.RESET!==1?'RESET LOW ili nepovezan':l.SLEEP!==1?'Spavanje / SLEEP nepovezan':clockUs()<s.wakeAt?'Buđenje · 1 ms':!s.motorPower?'Bez VMOT 8–35 V':l.ENABLE!==0?'Izlazi isključeni; translator broji STEP':enabled?'Idealan pogon; bez dinamike struje i tereta':'Provjeri ulaze'}];
  }));
  const diagnostics=[];
  for(const d of drivers){const s=states.get(d.id);if(s.lastFault)diagnostics.push({code:'stepper-timing',severity:'warning',message:`A4988 ${d.id}: ${s.lastFault}. Odbijeno ${s.rejected} bridova u ovoj sesiji.`,terminals:Object.values(d.inputs).flatMap(n=>c.nets[n].terminals),wires:[]});}
  const ms=Object.fromEntries(motors.map(m=>{const s=motorStates.get(m.id),driver=s.driver?ds[s.driver]:null,idealAngle=s.ticks/16*360/m.fullSteps;
   return [m.id,{driver:s.driver,connected:s.connected,orientation:s.orientation,energized:!!driver?.enabled,positionCertain:s.positionCertain,drivenTicks:s.ticks,idealAngle,angle:s.positionCertain?idealAngle:null,fullSteps:m.fullSteps,reason:!s.connected?'Spoji dvije odvojene zavojnice na isti A4988':!s.positionCertain?'Položaj osovine nije potvrđen nakon gubitka sinkronizacije':driver?.enabled?'Idealni pomak iz pogonskih koraka':'Bez pobude; zadržana posljednja idealna snimka'}];
  }));
  return {steppers:{drivers:ds,motors:ms},diagnostics};
 }
 return {observe,passiveEdges,snapshot,conflicts};
}
