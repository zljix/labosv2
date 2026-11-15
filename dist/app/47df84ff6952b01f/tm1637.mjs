// MIT. TM1637 4-digit clock module with explicit ideal level adapter.
// Actual CLK/DIO edges, LSB first and open-drain ninth-clock ACK.
// VCC powers the 5 V chip; LV powers 10 kOhm board-side pulls.
export const TM1637_DUTIES=[1,2,4,10,11,12,13,14].map(n=>n/16);
export function createTM1637({c,pins,gpioNet,rootData,idleSolution,clockUs}){
 const devices=(c.tmDisplays??[]).map(d=>({...d,powered:false,bytes:Array(6).fill(0),on:false,brightness:0,auto:true,address:0,writing:false,active:false,first:true,bits:0,value:0,stage:'rx',ack:false,clk:1,dio:1,lastClock:null,lastRise:null,dataAt:-Infinity,received:0,errors:0,reason:'Čeka napajanje',trace:[]}));
 const record=(d,operation,value)=>{d.trace.push({timeUs:clockUs(),operation,...(value===undefined?{}:{value})});if(d.trace.length>128)d.trace.shift();};
 const resetBus=d=>{d.active=false;d.ack=false;d.stage='rx';d.bits=0;d.value=0;};
 const bad=(d,reason)=>{d.errors++;d.reason=reason;record(d,'error');resetBus(d);};
 function byte(d,value){
  d.received++;record(d,'byte',value);
  if(d.first){
   d.first=false;d.writing=false;
   if(value===0x40||value===0x44){d.auto=value===0x40;d.reason='Spreman';}
   else if(value>=0x80&&value<=0x8f){d.on=!!(value&8);d.brightness=value&7;d.reason='Spreman';}
   else if(value>=0xc0&&value<=0xcf){d.address=value&15;d.writing=true;d.reason=d.address<6?'Spreman':'Adresa izvan C0–C5';}
   else {d.errors++;d.reason=value===0x42?'Čitanje tipkovnice nije podržano':'Nepodržana naredba';record(d,'unsupported',value);}
  }else if(d.writing){
   if(d.address<6){d.bytes[d.address]=value;record(d,'write',d.address);}
   if(d.auto)d.address++;
  }
 }
 function observe(){
  if(!devices.length)return false;
  const v=idleSolution().volts,{root}=rootData(),now=clockUs();let changed=false;
  for(const d of devices){
   const vv=v[d.vcc],vg=v[d.gnd],vl=v[d.lv],powered=vv!==null&&vg!==null&&vl!==null&&Math.abs(vg)<.05&&vv-vg>=4.5&&vv-vg<=5.5&&Math.abs(vl-vg-d.logicVoltage)<.2;
   const level=net=>v[net]===null?-1:v[net]<=d.logicVoltage*.3?0:v[net]>=d.logicVoltage*.7&&v[net]<=d.logicVoltage+.3?1:-1;
   const clk=level(d.clkNet),dio=level(d.dioNet);
   if(powered!==d.powered){
    d.powered=powered;resetBus(d);d.bytes.fill(0);d.on=false;d.brightness=0;d.auto=true;d.address=0;d.lastClock=null;d.lastRise=null;
    d.reason=powered?'Spreman':'Provjeri VCC=5 V, GND i LV';record(d,powered?'power-on':'power-off');d.clk=clk;d.dio=dio;changed=true;continue;
   }
   if(!powered){d.clk=clk;d.dio=dio;continue;}
   // A clock module has no I2C address and no key pins. The adapter is ideal.
   const wired=net=>c.gpios.some(g=>root(g.net)===root(net)&&g.pin< (d.logicVoltage===5?20:49));
   if(!wired(d.clkNet)||!wired(d.dioNet)||root(d.clkNet)===root(d.dioNet)){
    resetBus(d);d.reason='Provjeri zasebne digitalne CLK i DIO mreže';d.clk=clk;d.dio=dio;continue;
   }
   if(clk<0||dio<0){if(d.active)bad(d,'Neodređena logička razina');d.clk=clk;d.dio=dio;continue;}
   const dataChanged=dio!==d.dio;
   // Ignore master release during the slave ACK; only data phase can START/STOP.
   if(clk===1&&d.clk===1&&dataChanged&&d.stage==='rx'){
    if(dio===0){resetBus(d);d.active=true;d.first=true;d.writing=false;d.reason='Prijenos';d.lastRise=null;record(d,'start');}
    else if(d.active){record(d,'stop');resetBus(d);}
    changed=true;
   }else if(clk!==d.clk){
    if(d.active){
     const width=d.lastClock===null?Infinity:now-d.lastClock;
     if(width<.4||(clk===1&&d.lastRise!==null&&now-d.lastRise<2))bad(d,'Prebrz CLK: profil najviše 500 kHz, impuls ≥0,4 µs');
     else if(clk===1){
      if(d.stage==='rx'){
       if(now-d.dataAt<.1)bad(d,'DIO setup kraći od 0,1 µs');
       else {d.value|=dio<<d.bits;if(++d.bits===8)d.stage='ack-pending';}
      }else if(d.stage==='ack')d.stage='ack-end';
      d.lastRise=now;
     }else{
      if(d.stage==='ack-pending'){byte(d,d.value);d.ack=true;d.stage='ack';record(d,'ack',0);}
      else if(d.stage==='ack-end'){d.ack=false;d.stage='rx';d.bits=0;d.value=0;}
     }
    }
    d.lastClock=now;changed=true;
   }
   if(dataChanged)d.dataAt=now;
   d.clk=clk;d.dio=dio;
  }
  return changed;
 }
 function edges(root,edge){for(const d of devices)if(d.powered&&d.ack)edge(root(d.dioNet),root(d.gnd),1);}
 function conflicts(){if(!devices.length)return [];const {root}=rootData();return devices.filter(d=>d.powered&&d.ack&&[...pins].some(([id,p])=>root(gpioNet.get(id))===root(d.dioNet)&&((p.mode==='OUT'&&p.value)||(p.mode==='PWM'&&p.duty>0)))).map(d=>d.dioNet);}
 function snapshot(){
  const tmDisplays={},diagnostics=[];
  for(const d of devices){
   tmDisplays[d.id]={powered:d.powered,on:d.powered&&d.on,bytes:[...d.bytes],brightness:d.brightness,duty:TM1637_DUTIES[d.brightness],colon:!!(d.bytes[1]&128),received:d.received,errors:d.errors,reason:d.reason,trace:d.trace.map(t=>({...t}))};
   if(d.powered&&d.reason.startsWith('Provjeri zasebne'))
    diagnostics.push({code:'tm1637-signal-open',severity:'warning',message:d.id+': '+d.reason,terminals:c.nets[d.clkNet].terminals.concat(c.nets[d.dioNet].terminals),wires:[]});
  }
  return {tmDisplays,diagnostics};
 }
 return {observe,edges,conflicts,snapshot};
}
