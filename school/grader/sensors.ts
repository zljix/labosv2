import type {SimulationConfig} from '../../src/circuit/compile';

export const isSensorContract=(profile:any)=>profile.checkerVersion==='24D.1';
export function validSensorConfig(c:SimulationConfig,variant:string){
  if(variant==='am2320')return c.i2cDevices.length===1&&c.i2cDevices[0].kind==='am2320';
  if(variant.startsWith('dht'))return c.timedSensors.length===1&&c.timedSensors[0].kind===(variant==='dht11'?'dht11':'dht22');
  return c.oneWireDevices.length===(variant==='ds18Multi'?3:1);
}

type Line={timeMs:number;text:string};
// Read only protocol telemetry and new program output from the isolated run.
// Component IDs, search order, source tokens and claimed browser scores do not
// choose the expected measurements.
export function createSensorCheck(c:SimulationConfig,profile:any,seed:string){
  const variant=profile.taskKey.split('/')[1],s=profile.contract.scenario;
  const dht=variant.startsWith('dht'),ow=variant.startsWith('ds18'),errors=variant.endsWith('Errors'),resolution=variant==='ds18Resolution';
  const devices:any[]=dht?c.timedSensors:ow?[...c.oneWireDevices].sort((a,b)=>a.rom!.localeCompare(b.rom!)):c.i2cDevices;
  let state=parseInt(seed.slice(0,8),16)||1;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
  const number=(lo:number,hi:number)=>Math.round((lo+(hi-lo)*random())*10)/10;
  const environment=()=>devices.map((d,i)=>({temperature:dht?(variant==='dht11'?number(2,48):number(-30,70)):ow?number(-45+i*20,70+i*20):number(-20,60),humidity:variant==='dht11'?number(22,88):number(5,95)}));
  let stimuli:any[]=[{values:environment()},{values:environment()},{values:environment()}];
  if(errors)stimuli.push({values:environment(),fault:dht?'checksum':'crc'},{values:environment(),fault:dht?'timeout':'disconnected'},{values:environment(),recovery:true});
  else if(variant==='ds18Multi'){
    // Change a single physical device, then restore the initial environment.
    const values=stimuli[0].values.map((v:any)=>({...v}));values[Math.floor(random()*devices.length)].temperature+=7.5;
    stimuli.push({values},{values:stimuli[0].values.map((v:any)=>({...v}))});
  }else{
    stimuli.push({values:devices.map(()=>({temperature:variant==='dht11'?0:dht?-40:ow?-55:-40,humidity:variant==='dht11'?20:0}))},
      {values:devices.map(()=>({temperature:variant==='dht11'?50:dht?80:ow?125:80,humidity:variant==='dht11'?90:100}))},
      {values:stimuli[0].values.map((v:any)=>({...v}))});
  }
  const duration=s.stageDurationMs,deadline=s.responseDeadlineMs+s.stepToleranceMs;
  const inputs=(stimulus:any)=>devices.map((d,i)=>({component:d.id,...stimulus.values[i],...(dht?{dhtFault:stimulus.fault??'none'}:ow?{oneWireFault:stimulus.fault??'none'}:{})}));
  const readings:any[]=[],seen=new Set<string>();const connected=new Set<string>();
  const observe=(event:any)=>{
    if(event.type!=='simulation')return;
    for(const d of devices){
      if(dht){
        const v=event.timedSensors?.[d.id];if(!v)continue;
        if(v.powered&&v.sample>0&&v.trace.length===84)connected.add(d.id);
        const end=v.trace.at(-1);if(!end||event.timeMs*1000<end.atUs+end.durationUs)continue;
        const key=d.id+':'+v.sample;if(seen.has(key))continue;seen.add(key);
        const b=v.bytes;if(b.length!==5)continue;
        const good=((b[0]+b[1]+b[2]+b[3])&255)===b[4];
        const temperature=d.kind==='dht11'?b[2]:((b[2]&127)*256+b[3])*(b[2]&128?-1:1)/10;
        const humidity=d.kind==='dht11'?b[0]:(b[0]*256+b[1])/10;
        readings.push({component:d.id,timeMs:(end.atUs+end.durationUs)/1000,temperature,humidity,valid:good,sample:v.sample});
      }else if(ow){
        const v=event.oneWireDevices?.[d.id];if(!v)continue;
        for(const r of v.readings??[]){
          const key=d.id+':'+r.timeUs;if(seen.has(key))continue;seen.add(key);
          if(v.powered&&r.sample>0)connected.add(d.id);
          readings.push({component:d.id,timeMs:r.timeUs/1000,temperature:r.temperature,resolution:r.resolution,
            valid:r.valid&&r.sample>0&&!r.busy,sample:r.sample,convertedAtMs:r.convertedAtUs/1000});
        }
      }else for(const r of event.measurements??[]){
        if(r.component!==d.id)continue;const key=d.id+':'+r.sample;if(seen.has(key))continue;seen.add(key);
        connected.add(d.id);readings.push({...r,valid:true});
      }
    }
    // The published scenarios have fewer than 500 complete transfers.
    if(readings.length>1000)readings.splice(0,readings.length-1000);
  };
  const fields=(text:string)=>Object.fromEntries([...text.matchAll(/\b(T|RH|BITA)\s*=\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|nan)\b/gi)].map(m=>[m[1].toUpperCase(),Number(m[2])]));
  const rom=(text:string)=>text.match(/\bROM\s*=\s*([0-9a-f]{16})\b/i)?.[1].toUpperCase();
  const oldRegister=(text:string)=>/POCETNI|POČETNI|STARI REGISTAR|PRIJE DOVRSETKA|PRIJE DOVRŠETKA/i.test(text);
  const faultLine=(text:string)=>/nevaljan|pogres|pogreš|error|timeout|nema|invalid|crc|checksum|nan|presence/i.test(text)&&!Number.isFinite(fields(text).T);
  function record(stage:number,last:any,lines:Line[]){
    const stimulus=stimuli[stage],start=stage*duration,end=start+duration;
    const current=lines.filter(l=>l.timeMs>=start&&l.timeMs<end&&!oldRegister(l.text));
    if(stimulus.fault){
      const after=current.filter(l=>l.timeMs>start+deadline);
      const attempts=dht?(last?.timedSensors?.[devices[0].id]?.reason??''):(last?.oneWireDevices?.[devices[0].id]?.trace??[]).filter((r:any)=>r.timeUs>=start*1000);
      const attempted=dht?(stimulus.fault==='checksum'?readings.some(r=>r.timeMs>=start&&r.timeMs<end&&!r.valid):/timeout|ne odgovara/i.test(attempts)):
        Array.isArray(attempts)&&attempts.some((r:any)=>r.operation===(stimulus.fault==='crc'?'scratchpad':'reset'));
      const signals=current.filter(l=>faultLine(l.text)),times=[start,...signals.map(l=>l.timeMs),end];
      const signalled=signals.length>0&&signals[0].timeMs<=start+deadline&&
        times.slice(2).every((t,j)=>t-times[j+1]<=s.maximumIntervalMs+s.stepToleranceMs);
      const noFalseMeasurement=after.every(l=>!Number.isFinite(fields(l.text).T));
      return {index:stage+1,fault:stimulus.fault,attempted,signalled,noFalseMeasurement,passed:attempted&&signalled&&noFalseMeasurement};
    }
    let activeBits:number|undefined;
    const labelled=current.map(l=>{const f=fields(l.text);if(Number.isFinite(f.BITA))activeBits=f.BITA;return {...l,f,rom:rom(l.text),bits:activeBits};});
    const results=devices.map((d,i)=>{
      const expected=stimulus.values[i],deviceLines=labelled.filter(l=>Number.isFinite(l.f.T)&&(!ow||devices.length===1||l.rom===d.rom.toUpperCase()));
      const quantize=(t:number,bits:number)=>{let raw=Math.round(t*16);raw&=~((1<<(12-bits))-1);return raw/16;};
      const matches=(l:typeof labelled[number],bits?:number)=>{
        const t=resolution?quantize(expected.temperature,bits??12):variant==='dht11'?Math.round(expected.temperature):ow?quantize(expected.temperature,12):Math.round(expected.temperature*10)/10;
        return Math.abs(l.f.T-t)<=s.temperatureTolerance&&(!dht&&ow||Math.abs(l.f.RH-(variant==='dht11'?Math.round(expected.humidity):Math.round(expected.humidity*10)/10))<=s.humidityTolerance);
      };
      const rows=readings.filter(r=>r.component===d.id&&r.timeMs>=start&&r.timeMs<end&&r.valid&&(!ow||r.convertedAtMs>=start));
      const associated=(l:typeof labelled[number],bits?:number)=>rows.some(r=>r.timeMs<=l.timeMs+s.stepToleranceMs&&l.timeMs-r.timeMs<=s.maximumIntervalMs&&
        Math.abs(r.temperature-l.f.T)<=s.temperatureTolerance&&(!resolution||r.resolution===bits)&&
        (ow||Math.abs(r.humidity-l.f.RH)<=s.humidityTolerance));
      const fresh=deviceLines.filter(l=>matches(l,resolution?l.bits:undefined)&&associated(l,resolution?l.bits:undefined));
      const first=fresh[0]?.timeMs??Infinity;
      const gaps=[start,...fresh.map(l=>l.timeMs),end];
      // One settling interval is permitted. Thereafter a stopped, cached or
      // alternating false transcript cannot satisfy the published contract.
      const timely=first<=start+deadline&&gaps.slice(2).every((t,j)=>t-gaps[j+1]<=s.maximumIntervalMs+s.stepToleranceMs);
      const stable=deviceLines.filter(l=>l.timeMs>start+deadline).every(l=>matches(l,resolution?l.bits:undefined)&&associated(l,resolution?l.bits:undefined));
      const bits=resolution?[9,10,11,12].every(b=>fresh.some(l=>l.bits===b)):true;
      return {component:d.id,...(ow?{rom:d.rom}:{}),expected,firstDelayMs:Number.isFinite(first)?first-start:null,maximumGapMs:Math.max(0,...gaps.slice(2).map((t,j)=>t-gaps[j+1])),completeReads:rows.length,freshLines:fresh.length,timely,stable,allResolutions:bits,passed:timely&&stable&&bits};
    });
    return {index:stage+1,recovery:!!stimulus.recovery,devices:results,passed:results.every(r=>r.passed)};
  }
  const outcomes=(samples:any[],wiring:boolean)=>{
    const connection=wiring&&devices.every(d=>connected.has(d.id));
    return [connection,connection&&samples.length===stimuli.length&&samples.slice(0,3).every(r=>r.passed),
      connection&&samples.length===stimuli.length&&samples.slice(3).every(r=>r.passed)];
  };
  return {stimuli,duration,inputs,observe,record,outcomes};
}
