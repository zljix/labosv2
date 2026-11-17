import type {SimulationConfig} from '../../src/circuit/compile';
import {createDisplayCheck} from './displays';

export const isLevelContract=(p:any)=>p.checkerVersion==='24N.1';

// Follow electrical nets, including either data channel and arbitrary IDs.
// A powered spare translator next to a direct GPIO/I2C circuit is insufficient.
function topology(c:SimulationConfig,v:string,backend:string){
  const s3=backend!=='avr',gpio=(n:number)=>c.gpios.some(g=>g.net===n);
  const ground=(n:number)=>c.referenceGrounds.includes(n);
  const isolatedRemote=(from:number,to?:number)=>{
    const seen=new Set([from]),pending=[from];
    while(pending.length){const n=pending.pop()!;
      if(gpio(n))return false;
      const rails=c.rails.filter(r=>r.net===n);
      // A remote button needs its own pull-up. A remote LED must be supplied
      // by the translator output, without a parallel GPIO or positive rail.
      // Stop at reference rails so unrelated bias resistors are not traversed.
      if(rails.length){if(to!==undefined&&rails.some(r=>r.volts>0))return false;continue;}
      for(const r of c.resistors){const next=r.a===n?r.b:r.b===n?r.a:null;
        if(next!==null&&!seen.has(next)){seen.add(next);pending.push(next);}}
    }return to===undefined||seen.has(to);
  };
  if(v.startsWith('i2c')){
    const d=c.i2cLevelShifters[0],device=c.i2cDevices[0];if(!d||!device)return null;
    const local=s3?d.low:d.high,remote=s3?d.high:d.low;
    return local.every(gpio)&&remote.every(n=>!gpio(n))&&device.sda===remote[0]&&device.scl===remote[1]
      &&device.logicVoltage===(s3?5:3.3)?{id:d.id,local,remote}:null;
  }
  const d=c.levelShifters[0],button=c.buttons[0],led=c.leds[0];if(!d||!led)return null;
  const input=v==='levelInput',aToB=input?!s3:s3,source=aToB?d.a:d.b,destination=aToB?d.b:d.a;
  for(let channel=0;channel<2;channel++){
    const from=source[channel],to=destination[channel];
    const path=input?button&&((button.a===from&&ground(button.b))||(button.b===from&&ground(button.a)))&&gpio(to)&&isolatedRemote(from):
      gpio(from)&&isolatedRemote(to,led.a)&&ground(led.k);
    if(path)return {id:d.id,channel,from,to,direction:aToB?'A → B':'B → A',inputVoltage:aToB?3.3:5,outputVoltage:aToB?5:3.3};
  }return null;
}

export function validLevelConfig(c:SimulationConfig,v:string,backend:string){
  const i2c=v.startsWith('i2c');
  return c.levelShifters.length===Number(!i2c)&&c.i2cLevelShifters.length===Number(i2c)
    &&c.leds.length===Number(!i2c)&&c.buttons.length===Number(v==='levelInput')
    &&c.i2cDevices.length===Number(i2c)&&(!i2c||c.i2cDevices[0].kind===(v==='i2cBmp280'?'bmp280':'ssd1306_32'))
    &&[c.spiDevices,c.tmDisplays,c.rtcDevices,c.analogInputs,c.timedSensors,c.oneWireDevices,c.servos,c.bridges,c.stepperDrivers,c.encoders,c.irReceivers,c.relays,c.buzzers,c.motors,c.irTransmitters,c.irRemotes].every(a=>a.length===0)
    &&!!topology(c,v,backend);
}

type Line={timeMs:number;text:string};
export function createLevelCheck(c:SimulationConfig,p:any,seed:string,backend:string){
  const v=p.taskKey.split('/')[1],s=p.contract.scenario,path=topology(c,v,backend);
  const i2c=v.startsWith('i2c'),bmp=v==='i2cBmp280',input=v==='levelInput',led=c.leds[0],device=c.i2cDevices[0];
  let state=parseInt(seed.slice(0,8),16)||1;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
  const first={temperature:Math.round((-15+random()*40)*10)/10,pressure:Math.round(85000+random()*6500)};
  const second={temperature:Math.round((45+random()*25)*10)/10,pressure:Math.round(101000+random()*6500)};
  const startPressed=random()>=.5;
  const display=v==='i2cOled32'?createDisplayCheck(c,{...p,taskKey:'displays/oled32'},seed,backend):null;
  const duration=input?s.stageDurationChoicesMs[Math.floor(random()*s.stageDurationChoicesMs.length)]:s.stageDurationMs;
  const stimuli:any[]=bmp?[first,second,{...first}]:input?Array.from({length:7},(_,i)=>({pressed:i%2===0?startPressed:!startPressed})):display?.stimuli??[{}];
  const edges:{timeMs:number;on:boolean}[]=[],readings=new Map<number,any>(),levels=new Set<number>();
  let stage=0,connected=false,stable=true,observed=0,lastTime=0;
  const near=(a:any,b:number)=>Number.isFinite(a)&&Math.abs(a-b)<=s.voltageToleranceV;
  function ready(e:any){
    if(!path||e.diagnostics?.some((d:any)=>d.severity==='error'))return false;
    if(i2c){const d=e.i2cLevelShifters?.[path.id];
      return !!d?.powered&&near(d.lv,3.3)&&near(d.hv,5)&&d.channels.every((ch:any)=>ch.idle||ch.pulledLow);
    }
    const d=e.levelShifters?.[path.id],ch=d?.channels[path.channel!];
    return !!d?.powered&&d.direction===path.direction&&near(d.vcca,3.3)&&near(d.vccb,5)
      &&d.channels.every((x:any)=>x.level===0||x.level===1)
      &&(ch.level===0?near(ch.inputVolts,0)&&near(ch.outputVolts,0):ch.level===1&&near(ch.inputVolts,path.inputVoltage!)&&near(ch.outputVolts,path.outputVoltage!));
  }
  const observe=(e:any)=>{
    if(e.type!=='simulation')return;lastTime=e.timeMs;
    const valid=ready(e);
    if(i2c){
      if(!valid)return;
      if(display){display.observe(e);connected ||= e.displays?.[device.id]?.powered&&e.i2cTrace?.some((t:any)=>t.address===device.address&&t.operation==='W'&&t.result==='ACK'&&t.length>1);}
      if(bmp)for(const m of e.measurements??[])if(m.component===device.id&&m.timeMs<=e.timeMs){
        connected=true;readings.set(m.sample,m);if(readings.size>8192)readings.delete(readings.keys().next().value!);
      }
      return;
    }
    const ch=path&&e.levelShifters?.[path.id]?.channels[path.channel!],current=e.leds?.[led.id]?.currentMa;
    if(valid){levels.add(ch.level);const receiver=path&&c.gpios.some(g=>g.net===path.to&&e.gpios?.[g.pin]?.mode==='IN');if(input?receiver:current>.5)connected=true;}
    if(input){
      const start=stage*duration,end=start+duration;
      if(e.timeMs>=start+s.responseDeadlineMs+s.stepToleranceMs&&e.timeMs<end){
        const expected=stimuli[stage]?.pressed;
        const receiver=path&&c.gpios.filter(g=>g.net===path.to).some(g=>e.gpios?.[g.pin]?.mode==='IN'&&e.gpios[g.pin].level===(expected?0:1));
        observed++;stable &&= !!valid&&!!receiver&&ch.level===(expected?0:1)&&Number.isFinite(current)&&(expected?current>.5:current<.05);
      }
    }else if(valid&&Number.isFinite(current)&&(current>.5||current<.05)){
      const on=current>.5;
      if(ch.level===Number(on)&&edges.at(-1)?.on!==on&&edges.length<256)edges.push({timeMs:e.timeMs,on});
    }
  };
  function record(index=stage,_frame?:any,lines:Line[]=[]){
    let result:any;
    if(display)result=display.record(index,_frame,lines);
    else if(bmp){
      const start=stage*duration,end=start+duration,expected=stimuli[stage];
      const fresh=[...readings.values()].filter(m=>m.timeMs>=start+s.settlingMs&&m.timeMs<end
        &&Math.abs(m.temperature-expected.temperature)<=s.temperatureToleranceC&&Math.abs(m.pressure-expected.pressure)<=s.pressureTolerancePa);
      const printed=fresh.filter(m=>lines.some(l=>l.timeMs>=m.timeMs&&l.timeMs-m.timeMs<=s.maximumIntervalMs
        &&[...l.text.matchAll(/\bT\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:°?C)?\s+P\s*=\s*(\d+(?:\.\d+)?)/g)].some(x=>
          Math.abs(Number(x[1])-m.temperature)<=s.temperatureToleranceC&&Math.abs(Number(x[2])-m.pressure)<=s.pressureTolerancePa)));
      const times=[start,...printed.map(m=>m.timeMs).sort((a,b)=>a-b),end];
      result={index:stage+1,...expected,passed:printed.length>=2&&times.slice(1).every((t,i)=>t-times[i]<=s.maximumIntervalMs),
        readings:fresh,printedSamples:printed.length};
    }else if(input)result={index:stage+1,...stimuli[stage],passed:observed>0&&stable,observed};
    else {
      const firstOn=edges.findIndex(e=>e.on),active=edges.slice(firstOn<0?edges.length:firstOn);
      const spans=active.slice(1).map((e,i)=>({on:active[i].on,durationMs:e.timeMs-active[i].timeMs}));
      const repeated=spans.filter(x=>x.on).length>=s.minimumCompleteCycles&&spans.filter(x=>!x.on).length>=s.minimumCompleteCycles;
      const expected=s.blinkByRuntime[backend];
      result={index:1,edges,spans,repeated,timing:repeated&&spans.every(x=>Math.abs(x.durationMs-(x.on?expected.onMs:expected.offMs))<=s.timingToleranceMs)};
    }
    result.translatorConnected=connected;result.translatedLevels=[...levels].sort();result.observedUntilMs=lastTime;
    stage++;stable=true;observed=0;return result;
  }
  return {stimuli,duration,protocolClock:i2c,inputs:(value:any)=>bmp?[{component:device.id,...value}]:input?[{component:c.buttons[0].id,...value}]:[],observe,record,
    outcomes:(samples:any[],wiring:boolean)=>{
      const connection=!!path&&wiring&&connected;
      if(display){const o=display.outcomes(samples,wiring);return [connection&&o[0],connection&&o[1],connection&&o[2]];}
      const basic=connection&&(bmp?samples[0]?.passed&&samples[1]?.passed:input?samples.slice(0,3).length===3&&samples.slice(0,3).every(x=>x.passed):samples[0]?.repeated);
      const extra=basic&&(bmp?samples[2]?.passed:input?samples.length===7&&samples.slice(3).every(x=>x.passed):samples[0]?.timing);
      return [connection,!!basic,!!extra];
    }};
}
