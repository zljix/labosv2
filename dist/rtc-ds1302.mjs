// MIT. DS1302 functional 3-wire model, not an I2C device or a host date service.
// Calendar uses UTC arithmetic solely to avoid host timezone/DST effects.
export const RTC_DEFAULT='2026-01-01T12:00:00';
const bcd=n=>(Math.floor(n/10)<<4)|n%10;
const unbcd=n=>(n&15)<10&&(n>>4)<10?(n>>4)*10+(n&15):NaN;
export function rtcCalendar(r){
 const second=unbcd(r[0]&127),minute=unbcd(r[1]&127),twelve=!!(r[2]&128);
 const rawHour=unbcd(r[2]&(twelve?31:63));
 const hour=twelve?(rawHour%12)+(r[2]&32?12:0):rawHour;
 const date=unbcd(r[3]&63),month=unbcd(r[4]&31),day=r[5]&7,year=2000+unbcd(r[6]);
 const epoch=Date.UTC(year,month-1,date,hour,minute,second),d=new Date(epoch);
 const valid=Number.isFinite(epoch)&&second<60&&minute<60&&hour<24&&(!twelve||rawHour>=1&&rawHour<=12)&&day>=1&&day<=7&&year>=2000&&year<=2099&&d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===date;
 return {valid,epoch,year,month,date,day,hour,minute,second,twelve};
}
export function validRTCInitial(s){return typeof s==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(s)&&Number.isFinite(Date.parse(s+'Z'))&&new Date(s+'Z').toISOString().slice(0,19)===s;}
export function initialRTC(s=RTC_DEFAULT){
 if(!validRTCInitial(s))throw Error('RTC: početni kalendar mora biti valjan datum 2000–2099.');
 const d=new Date(s+'Z');
 return {registers:[bcd(d.getUTCSeconds()),bcd(d.getUTCMinutes()),bcd(d.getUTCHours()),bcd(d.getUTCDate()),bcd(d.getUTCMonth()+1),d.getUTCDay()+1,bcd(d.getUTCFullYear()-2000),0],ram:Array(31).fill(0),trickle:0x5c,subsecondUs:0,valid:true};
}
export function validRTCState(s){return !!s&&Array.isArray(s.registers)&&s.registers.length===8&&Array.isArray(s.ram)&&s.ram.length===31&&[...s.registers,...s.ram,s.trickle].every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&Number.isFinite(s.subsecondUs)&&s.subsecondUs>=0&&s.subsecondUs<1000000&&typeof s.valid==='boolean'&&(!s.valid||rtcCalendar(s.registers).valid);}
export function createDS1302({c,pins,gpioNet,rootData,idleSolution,clockUs}){
 const devices=(c.rtcDevices??[]).map(d=>({...d,state:structuredClone(d.rtcState??initialRTC(d.rtcInitial)),at:clockUs(),main:false,retained:true,ce:0,clk:0,active:false,phase:'command',bits:0,value:0,command:0,rx:[],tx:[],txBit:0,drive:null,trace:[],transfers:[],received:0,errors:0,reason:'Čeka napajanje',lastEdge:-Infinity}));
 const transfer=(d,operation,bytes,accepted=true)=>{d.transfers.push({timeUs:clockUs(),operation,command:d.command,bytes:[...bytes],accepted});if(d.transfers.length>64)d.transfers.shift();};
 const record=(d,operation,value)=>{d.trace.push({timeUs:clockUs(),operation,...(value===undefined?{}:{value})});if(d.trace.length>128)d.trace.shift();};
 const resetBus=d=>{d.active=false;d.drive=null;d.phase='command';d.bits=0;d.value=0;d.rx=[];d.tx=[];d.txBit=0;};
 function tick(d,now){
  const elapsed=Math.max(0,now-d.at);d.at=now;const s=d.state;
  if(!d.retained||!s.valid||(s.registers[0]&128))return;
  const total=s.subsecondUs+elapsed,n=Math.floor(total/1000000);s.subsecondUs=total%1000000;if(!n)return;
  const prev=rtcCalendar(s.registers);if(!prev.valid){s.valid=false;return;}
  const cycle=Date.UTC(2100,0,1)-Date.UTC(2000,0,1),epoch=Date.UTC(2000,0,1)+(prev.epoch-Date.UTC(2000,0,1)+n*1000)%cycle,dt=new Date(epoch);
  const days=Math.floor((prev.epoch+n*1000)/86400000)-Math.floor(prev.epoch/86400000),hour=dt.getUTCHours();
  s.registers.splice(0,7,bcd(dt.getUTCSeconds()),bcd(dt.getUTCMinutes()),prev.twelve?128|(hour>=12?32:0)|bcd(hour%12||12):bcd(hour),bcd(dt.getUTCDate()),bcd(dt.getUTCMonth()+1),(prev.day-1+days)%7+1,bcd(dt.getUTCFullYear()-2000));
 }
 function commit(d){
  if(d.phase==='read'){const count=Math.min(d.tx.length,Math.floor(d.txBit/8));if(count)transfer(d,'read',d.tx.slice(0,count));return;}
  if(d.phase!=='write'||!d.rx.length)return;
  const cmd=d.command,index=(cmd>>1)&31,ram=!!(cmd&64),burst=index===31,s=d.state;
  if(d.writeProtected&&!(index===7&&!ram&&!burst)){record(d,'write-protected');transfer(d,'write',d.rx,false);return;}
  if(!burst||ram||d.rx.length===8)transfer(d,'write',d.rx);
  if(ram){for(let i=0;i<(burst?Math.min(31,d.rx.length):1);i++){s.ram[burst?i:index]=d.rx[i];}record(d,'ram-write',d.rx.length);return;}
  if(burst&&d.rx.length!==8){record(d,'discard-partial-clock',d.rx.length);return;}
  if(!burst&&index>8){d.errors++;record(d,'unsupported-register',index);return;}
  if(!burst&&index===8){s.trickle=d.rx[0];record(d,'trickle-register',s.trickle);return;}
  const mask=[255,127,191,63,31,7,255,128];
  if(burst)for(let i=0;i<8;i++)s.registers[i]=d.rx[i]&mask[i];
  else s.registers[index]=d.rx[0]&mask[index];
  if(burst||index===0)s.subsecondUs=0;
  s.valid=rtcCalendar(s.registers).valid;
  record(d,s.valid?'clock-write':'invalid-calendar',burst?8:index);
 }
 function command(d,value){
  d.command=value;d.received++;record(d,'command',value);d.bits=0;d.value=0;d.writeProtected=!!(d.state.registers[7]&128);
  if(!(value&128)){d.phase='ignore';d.errors++;record(d,'invalid-command',value);return;}
  const index=(value>>1)&31,ram=!!(value&64);
  if(!ram&&index>8&&index!==31){d.phase='ignore';d.errors++;record(d,'unsupported-register',index);return;}
  d.phase=value&1?'read':'write';
  if(d.phase==='read'){
   d.tx=ram?(index===31?[...d.state.ram]:[d.state.ram[index]]):index===31?[...d.latched]:[index===8?d.state.trickle:d.latched[index]];
  }
 }
 function observe(){
  if(!devices.length)return false;
  const v=idleSolution().volts,{root}=rootData(),now=clockUs();let changed=false;
  for(const d of devices){
   tick(d,now);
   const vg=v[d.gnd],vv=v[d.vcc],ground=vg!==null&&Math.abs(vg)<.05&&(c.referenceGrounds??[]).some(g=>root(g)===root(d.gnd));
   const main=ground&&d.rtcMainPower&&vv!==null&&Math.abs(vv-vg-d.moduleVoltage)<.25,retained=main||d.rtcBattery;
   if(main!==d.main||retained!==d.retained){
    d.main=main;d.retained=retained;resetBus(d);changed=true;record(d,main?'main-power':retained?'battery':'power-lost');
    if(!retained){d.state={registers:[128,0,0,0,0,0,0,0],ram:Array(31).fill(0),trickle:0x5c,subsecondUs:0,valid:false};}
   }
   const level=net=>v[net]===null?-1:v[net]>=-.1&&v[net]<.4?0:v[net]>=2&&v[net]<=d.moduleVoltage+.3?1:-1;
   const ce=level(d.ceNet),clk=level(d.clkNet),io=level(d.ioNet);
   d.reason=!retained?'Napajanje izgubljeno; postavi sat':!main?'Baterija: komunikacija isključena':!d.state.valid?'Nevaljan kalendar; postavi sat':d.state.registers[0]&128?'CH=1: sat zaustavljen':'Sat radi';
   if(!main){d.ce=ce;d.clk=clk;continue;}
   const wired=net=>c.gpios.some(g=>root(g.net)===root(net)&&g.pin<(d.moduleVoltage===5?20:49));
   const signals=[d.ceNet,d.clkNet,d.ioNet];
   if(!signals.every(wired)||new Set(signals.map(root)).size!==3){resetBus(d);d.reason='Provjeri zasebne CE, I/O i SCLK GPIO mreže';d.ce=ce;d.clk=clk;continue;}
   if(ce===0&&d.ce!==0){commit(d);resetBus(d);changed=true;}
   else if(ce===1&&d.ce!==1){resetBus(d);if(clk!==0){d.errors++;record(d,'clock-not-low');}else{d.active=true;d.latched=[...d.state.registers];record(d,'ce-start');}changed=true;}
   else if(ce===1&&d.active&&clk!==d.clk){
    if(clk<0||now-d.lastEdge<1){d.errors++;record(d,'invalid-clock');resetBus(d);}
    else if(clk===1){
     d.drive=null;
     if(d.phase==='command'||d.phase==='write'){
      if(io<0){d.errors++;record(d,'invalid-data');resetBus(d);}
      else {d.value|=io<<d.bits;if(++d.bits===8){const value=d.value;d.bits=0;d.value=0;if(d.phase==='command')command(d,value);else if(d.rx.length<(d.command&64?31:8)){d.rx.push(value);d.received++;record(d,'write-byte',value);}}}
     }
    }else if(d.phase==='read'){
     const length=d.tx.length*8,bit=d.txBit++%length;d.drive=(d.tx[bit>>3]>>(bit&7))&1;if(!(bit&7))record(d,'read-byte',d.tx[bit>>3]);
    }
    d.lastEdge=now;changed=true;
   }
   d.ce=ce;d.clk=clk;
  }
  return changed;
 }
 function edges(root,edge){for(const d of devices){for(const net of [d.ceNet,d.clkNet,d.ioNet])edge(root(net),root(d.gnd),40000);if(d.main&&d.drive!==null)edge(root(d.ioNet),root(d.drive?d.vcc:d.gnd),1);}}
 function conflicts(){
  const {root}=rootData(),out=[];
  for(const d of devices)if(d.main&&d.drive!==null&&[...pins].some(([id,p])=>root(gpioNet.get(id))===root(d.ioNet)&&(p.mode==='PWM'||p.mode==='OUT'&&p.value!==d.drive)))out.push(d.ioNet);
  return out;
 }
 function input(data){for(const d of devices)if(d.id===data.component&&typeof data.rtcMainPower==='boolean'){observe();d.rtcMainPower=data.rtcMainPower;observe();}}
 function snapshot(){
  const rtcDevices={},diagnostics=[];
  for(const d of devices){
   const cal=rtcCalendar(d.state.registers),charging=(d.state.trickle&240)===160&&[1,2].includes((d.state.trickle>>2)&3)&&!!(d.state.trickle&3);
   rtcDevices[d.id]={mainPower:d.main,battery:d.rtcBattery,rtcMainPower:d.rtcMainPower,retained:d.retained,valid:d.state.valid,halted:!!(d.state.registers[0]&128),writeProtected:!!(d.state.registers[7]&128),iso:d.state.valid?new Date(cal.epoch).toISOString().slice(0,19):null,day:cal.day,reason:d.reason,received:d.received,errors:d.errors,state:structuredClone(d.state),trace:d.trace.map(t=>({...t})),transfers:d.transfers.map(t=>({...t,bytes:[...t.bytes]}))};
   if(charging)diagnostics.push({code:'rtc-charger',severity:'warning',message:d.id+': trickle nabojnik je uključen u registru; punjenje baterije nije simulirano. Ne uključuj ga za nepunjivu CR2032.',terminals:c.nets[d.vcc].terminals,wires:[]});
   if(d.main&&d.reason.startsWith('Provjeri'))diagnostics.push({code:'rtc-signal-open',severity:'warning',message:d.id+': '+d.reason,terminals:[d.ceNet,d.ioNet,d.clkNet].flatMap(n=>c.nets[n].terminals),wires:[]});
  }
  return {rtcDevices,diagnostics};
 }
 return {observe,edges,conflicts,input,snapshot};
}
