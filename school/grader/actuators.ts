import type {SimulationConfig} from '../../src/circuit/compile';

export const isActuatorContract=(p:any)=>p.checkerVersion==='24F.1';

export function validActuatorConfig(c:SimulationConfig,variant:string){
  const servo=['sg90Sweep','servoMotorTone'].includes(variant),motor=['dcDrive','dualDrive','servoMotorTone'].includes(variant);
  const buzzer=['activeAlarm','piezoTone','servoMotorTone'].includes(variant),relay=variant==='relayContacts';
  return c.relays.length===(relay?1:0)&&c.leds.length===(relay?2:0)&&c.servos.length===(servo?1:0)
    &&c.buzzers.length===(buzzer?1:0)&&c.bridges.length===(motor?1:0)&&c.motors.length===(variant==='dualDrive'?2:motor?1:0)
    &&c.servos.every(s=>s.minUs===1000&&s.maxUs===2000&&s.requiresCommonGround)
    &&c.buzzers.every(b=>b.kind===(variant==='activeAlarm'?'activeBuzzer':'passiveBuzzer'))
    &&c.bridges.every(b=>b.bridgeDrop===2&&!b.jumperA&&!b.jumperB&&c.rails.some(r=>r.net===b.vs&&r.volts===6))
    &&c.motors.every(m=>m.ratedVoltage===6);
}

export type ActuatorPhase={label:number;durationMs:number};
export const actuatorPatterns:Record<string,ActuatorPhase[]>={
  relayContacts:[{label:0,durationMs:700},{label:1,durationMs:700}],
  activeAlarm:[{label:0,durationMs:500},{label:1,durationMs:500}],
  piezoTone:[{label:0,durationMs:400},{label:1,durationMs:100},{label:2,durationMs:400},{label:1,durationMs:100},{label:3,durationMs:400},{label:1,durationMs:600}],
  sg90Sweep:[{label:0,durationMs:600},{label:1,durationMs:600},{label:2,durationMs:600}],
  dcDrive:[{label:0,durationMs:500},{label:1,durationMs:500},{label:2,durationMs:500},{label:3,durationMs:300},{label:4,durationMs:600},{label:5,durationMs:500}],
  dualDrive:[{label:0,durationMs:800},{label:1,durationMs:800}],
  servoMotorTone:[{label:0,durationMs:600},{label:1,durationMs:600}],
};

// Only electrical observations enter this checker. Console text, submitted
// variables, artifact metadata and component IDs never choose a phase.
export function createActuatorCheck(c:SimulationConfig,profile:any,seed:string){
  const variant=profile.taskKey.split('/')[1],s=profile.contract.scenario,pattern=actuatorPatterns[variant];
  const bridge=c.bridges[0],servo=c.servos[0],buzzer=c.buzzers[0],relay=c.relays[0];
  const cycleMs=pattern.reduce((n,p)=>n+p.durationMs,0);
  const supplyVoltage=s.motorSupplyVolts[parseInt(seed.slice(0,8),16)%s.motorSupplyVolts.length];
  if(bridge)for(const r of c.rails)if(r.net===bridge.vs)r.volts=supplyVoltage;
  const driveVoltage=supplyVoltage-2;
  const near=(a:any,b:number,tolerance:number)=>typeof a==='number'&&Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
  const output=(e:any,net:number)=>c.gpios.some(g=>g.net===net&&['OUT','PWM'].includes(e.gpios?.[g.pin]?.mode));
  const motors=bridge?[0,1].map(ch=>c.motors.find(m=>[m.a,m.b].includes(bridge.outputs[ch*2])&&[m.a,m.b].includes(bridge.outputs[ch*2+1]))):[];
  const reachable=(origin:number)=>{
    const nets=new Set([origin]);
    for(let changed=true;changed;){changed=false;for(const r of c.resistors)for(const [a,b]of [[r.a,r.b],[r.b,r.a]])
      if(nets.has(a)&&!nets.has(b)&&!c.rails.some(p=>p.net===b)){nets.add(b);changed=true;}}
    return nets;
  };
  const ledFor=(net:number)=>{const nets=reachable(net);return c.leds.find(l=>nets.has(l.a)||nets.has(l.k));};
  const no=relay?ledFor(relay.no):undefined,nc=relay?ledFor(relay.nc):undefined;
  const connected=(e:any)=>{
    if(relay)return !!(e.actuators?.relays?.[relay.id]?.powered&&output(e,relay.signal)&&no&&nc&&no!==nc
      &&[no,nc].some(l=>(e.leds?.[l.id]?.currentMa??0)>.1));
    const servoPath=!servo||e.servos?.[servo.id]?.powered&&output(e,servo.signal);
    const buzzerPath=!buzzer||e.actuators?.buzzers?.[buzzer.id]?.powered&&output(e,buzzer.signal);
    const channels=variant==='dualDrive'?2:1;
    const motorPath=!bridge||e.actuators?.bridges?.[bridge.id]?.powered&&motors.slice(0,channels).every(Boolean)
      &&[0,1,2,...(channels===2?[3,4,5]:[])].every(i=>output(e,bridge.inputs[i]));
    return !!(servoPath&&buzzerPath&&motorPath);
  };
  const servoAt=(e:any,angle:number)=>{
    const v=e.servos?.[servo.id];return v?.powered&&near(v.freq,50,s.servoFrequencyToleranceHz)
      &&near(v.pulseUs,1000+angle*1000/180,s.pulseToleranceUs)&&near(v.angle,angle,s.angleToleranceDeg);
  };
  const toneAt=(e:any,hz:number)=>{
    const v=e.actuators?.buzzers?.[buzzer.id];return !!v?.powered&&(hz===0?!v.active:
      v.active&&near(v.frequency,hz,Math.max(4,hz*s.frequencyRelativeTolerance))&&v.duty>s.toneDutyMin&&v.duty<s.toneDutyMax);
  };
  const motorAt=(e:any,ch:number,duty:number|null,brake=false)=>{
    const m=motors[ch],v=m&&e.actuators?.motors?.[m.id],b=e.actuators?.bridges?.[bridge.id];
    if(!v||!b?.powered)return false;
    if(duty===null)return v.voltage===null&&b.channels[ch]?.mode==='slobodno';
    if(brake)return near(v.voltage,0,s.voltageToleranceV)&&b.channels[ch]?.mode==='kočenje';
    return near(v.voltage,driveVoltage*duty,s.voltageToleranceV)&&v.direction===Math.sign(duty);
  };
  const label=(e:any)=>{
    if(!connected(e))return -1;
    if(relay){const v=e.actuators.relays[relay.id],a=e.leds[no!.id].currentMa,b=e.leds[nc!.id].currentMa;
      const contact=v.contact.replace(/[–—−]/g,'-');
      return v.energized&&contact==='COM-NO'&&a>.1&&b<.05?0:!v.energized&&contact==='COM-NC'&&b>.1&&a<.05?1:-1;}
    if(variant==='activeAlarm'){const v=e.actuators.buzzers[buzzer.id];
      return !v.active?1:near(v.frequency,2300,4)&&near(v.duty,1,.01)?0:-1;}
    if(variant==='piezoTone')return toneAt(e,0)?1:toneAt(e,440)?0:toneAt(e,880)?2:toneAt(e,1320)?3:-1;
    if(variant==='sg90Sweep')return [0,90,180].findIndex(a=>servoAt(e,a));
    if(variant==='dcDrive')return motorAt(e,0,.25)?0:motorAt(e,0,.5)?1:motorAt(e,0,1)?2:motorAt(e,0,null)?3:motorAt(e,0,-.5)?4:motorAt(e,0,0,true)?5:-1;
    if(variant==='dualDrive')return motorAt(e,0,.5)&&motorAt(e,1,-.75)?0:motorAt(e,0,1)&&motorAt(e,1,null)?1:-1;
    return motorAt(e,0,.5)&&toneAt(e,880)?servoAt(e,45)?0:servoAt(e,135)?1:-1:-1;
  };
  const transitions:{timeMs:number;label:number}[]=[],invalid:{start:number;end:number}[]=[];
  let path=false,lastTime=0,unknownStart:number|null=null,observationCount=0,overflow=false,lastElectrical:any;
  const observe=(e:any)=>{
    if(e.type!=='simulation')return;
    const timeMs=e.timeMs;lastTime=Math.max(lastTime,timeMs);observationCount++;
    lastElectrical={timeMs,relays:e.actuators?.relays,buzzers:e.actuators?.buzzers,motors:e.actuators?.motors,servos:e.servos,leds:e.leds};
    path ||= connected(e);
    const value=label(e);
    if(value<0){unknownStart??=timeMs;return;}
    if(unknownStart!==null){if(invalid.length<256)invalid.push({start:unknownStart,end:timeMs});else overflow=true;unknownStart=null;}
    if(transitions.at(-1)?.label!==value){if(transitions.length<256)transitions.push({timeMs,label:value});else overflow=true;}
  };
  function record(){
    // A sampled PWM averaging window may briefly cross another valid voltage
    // while the program changes EN/direction. Keep persistent states and
    // account for each discarded interval within the published settling time.
    const stable:typeof transitions=[],settling:{start:number;end:number}[]=[];
    for(let i=0;i<transitions.length;i++){
      const t=transitions[i],end=transitions[i+1]?.timeMs??lastTime;
      if(end-t.timeMs<s.settleToleranceMs){settling.push({start:t.timeMs,end});continue;}
      if(stable.at(-1)?.label!==t.label)stable.push(t);
    }
    const first=stable.findIndex(t=>t.label===pattern[0].label),steps=stable.slice(first<0?stable.length:first);
    const start=steps[0]?.timeMs??Infinity;
    const faults=[...invalid,...settling,...(unknownStart===null?[]:[{start:unknownStart,end:lastTime}])];
    const verify=(repetitions:number)=>{
      const count=pattern.length*repetitions;if(overflow||start>s.startupAllowanceMs||steps.length<count)return false;
      for(let i=0;i<count;i++){
        const expected=pattern[i%pattern.length],a=steps[i],b=steps[i+1];
        if(a.label!==expected.label)return false;
        const elapsed=(b?.timeMs??lastTime)-a.timeMs;
        if(elapsed<expected.durationMs-s.stepToleranceMs||b&&Math.abs(elapsed-expected.durationMs)>s.stepToleranceMs)return false;
      }
      const end=start+cycleMs*repetitions;
      return !faults.some(f=>{
        const overlap=Math.min(f.end,end)-Math.max(f.start,start);
        return overlap>0&&(overlap>s.settleToleranceMs||!steps.slice(0,count+1).some(t=>Math.abs(t.timeMs-f.end)<=s.settleToleranceMs));
      });
    };
    return {index:1,variant,cycleMs,observations:observationCount,connected:path,motorSupplyV:bridge?supplyVoltage:null,
      transitions:stable,invalidIntervals:faults,basic:verify(1),repeated:verify(s.cycles),overflow,lastElectrical};
  }
  return {stimuli:[{}],duration:s.stageDurationMs,inputs:(_value:any)=>[],observe,record,
    outcomes:(samples:any[],wiring:boolean)=>{
      const connection=wiring&&path;
      return [connection,connection&&samples[0]?.basic===true,connection&&samples[0]?.basic===true&&samples[0]?.repeated===true];
    }};
}
