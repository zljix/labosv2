import type {SimulationConfig} from '../../src/circuit/compile';

export const isStepperContract=(p:any)=>p.checkerVersion==='24G.1';
export const validStepperConfig=(c:SimulationConfig)=>c.stepperDrivers.length===1&&c.stepperMotors.length===1
  &&c.stepperMotors[0].fullSteps===200;

type Step={timeMs:number;direction:number;resolution:number;ticks:number};
type State={timeMs:number;endMs:number;accepted:number;ignored:number;rejected:number;rising:number;
  ticks:number;driven:number;resolution:number;enabled:boolean;energized:boolean;certain:boolean;
  angle:number|null;idealAngle:number;enable:number;reset:number;sleep:number;bits:number};
type Burst={count:number;direction:number;resolution:number;holdMs:number};
export function stepperBursts(variant:string,cycles:number):Burst[]{
  const one=variant==='stepperBasic'?[{count:50,direction:1,resolution:1,holdMs:600},{count:50,direction:-1,resolution:1,holdMs:600}]:
    [1,2,4,8,16].flatMap(resolution=>[1,-1].map(direction=>({count:10*resolution,direction,resolution,holdMs:400})));
  return Array.from({length:cycles},()=>one).flat();
}

// Evidence comes only from the electrical translator and motor. A console
// claim, a submitted angle or an uploaded compiled artifact cannot add steps.
export function createStepperCheck(c:SimulationConfig,profile:any,seed:string){
  const s=profile.contract.scenario,variant=profile.taskKey.split('/')[1];
  const driver=c.stepperDrivers[0],motor=c.stepperMotors[0];
  const motorSupplyV=s.motorSupplyVolts[parseInt(seed.slice(0,8),16)%s.motorSupplyVolts.length];
  for(const rail of c.rails)if(rail.net===driver.vmot)rail.volts=motorSupplyV;
  const steps:Step[]=[],states:State[]=[],ignored:{timeMs:number;reason:string}[]=[],faults:{timeMs:number;reason:string}[]=[];
  const seen=new Set<string>();let path=false,overflow=false,lostTrace=false,lastTime=0,lastSignature='';
  const observe=(e:any)=>{
    if(e.type!=='simulation')return;
    const d=e.steppers?.drivers?.[driver.id],m=e.steppers?.motors?.[motor.id];if(!d||!m)return;
    lastTime=Math.max(lastTime,e.timeMs);
    path ||= !!(d.powered&&d.motorPower&&m.connected&&m.driver===driver.id
      &&['STEP','DIR','ENABLE','RESET','SLEEP'].every(k=>c.gpios.some(g=>g.net===driver.inputs[k]&&e.gpios?.[g.pin]?.mode==='OUT')));
    for(const t of d.trace){
      const key=t.timeUs+'|'+t.operation+'|'+t.value;if(seen.has(key))continue;
      if(seen.size>=8192){overflow=true;break;}seen.add(key);
      if(t.operation==='step'){
        const match=/^([+-])1\/(\d+); translator=(-?\d+)\/16$/.exec(t.value);
        if(!match){lostTrace=true;continue;}
        steps.push({timeMs:t.timeUs/1000,direction:match[1]==='+'?1:-1,resolution:Number(match[2]),ticks:Number(match[3])});
      }else if(t.operation==='ignored')ignored.push({timeMs:t.timeUs/1000,reason:t.value});
      else if(['rejected','unsupported'].includes(t.operation))faults.push({timeMs:t.timeUs/1000,reason:t.value});
    }
    if(d.accepted!==steps.length||d.ignored!==ignored.length)lostTrace=true;
    const bits=d.levels.MS1+2*d.levels.MS2+4*d.levels.MS3;
    const value={accepted:d.accepted,ignored:d.ignored,rejected:d.rejected,rising:d.rising,ticks:d.translatorTicks,
      driven:m.drivenTicks,resolution:d.resolution,enabled:d.enabled,energized:m.energized,certain:m.positionCertain,
      angle:m.angle,idealAngle:m.idealAngle,enable:d.levels.ENABLE,reset:d.levels.RESET,sleep:d.levels.SLEEP,bits};
    const signature=JSON.stringify(value);
    if(signature===lastSignature)states.at(-1)!.endMs=e.timeMs;
    else if(states.length<8192){states.push({timeMs:e.timeMs,endMs:e.timeMs,...value});lastSignature=signature;}
    else overflow=true;
  };
  const near=(a:number|null,b:number)=>a!==null&&Number.isFinite(a)&&Math.abs(a-b)<=s.angleToleranceDeg;
  const noFaultBefore=(end:number)=>!overflow&&!lostTrace&&!faults.some(f=>f.timeMs<=end);
  const bitsOf=(resolution:number)=>({1:0,2:1,4:2,8:3,16:7} as Record<number,number>)[resolution];
  function verifyBursts(cycles:number){
    const bursts=stepperBursts(variant,cycles),checks:any[]=[];let offset=0,ticks=0,passed=true;
    for(const b of bursts){
      const slice=steps.slice(offset,offset+b.count),first=slice[0],last=slice.at(-1),previous=steps[offset-1];
      const startOK=!!first&&(offset===0?first.timeMs<=s.startupAllowanceMs:
        Math.abs(first.timeMs-previous.timeMs-(bursts[checks.length-1].holdMs+s.pulsePeriodMs))<=s.pauseToleranceMs+s.pauseObservationToleranceMs);
      const protocol=slice.length===b.count&&slice.every((step,i)=>{
        const expected=ticks+b.direction*16/b.resolution*(i+1);
        return step.direction===b.direction&&step.resolution===b.resolution&&step.ticks===expected
          &&(i===0||Math.abs(step.timeMs-slice[i-1].timeMs-s.pulsePeriodMs)<=s.pulsePeriodToleranceMs+1e-6);
      });
      ticks+=b.count*b.direction*16/b.resolution;offset+=b.count;
      const next=steps[offset],end=last?last.timeMs+b.holdMs-s.pauseToleranceMs:Infinity;
      const held=!!last&&states.some(f=>f.accepted===offset&&f.ignored===0&&f.rejected===0&&f.rising===offset
        &&f.ticks===ticks&&f.driven===ticks&&f.resolution===b.resolution&&f.bits===bitsOf(b.resolution)
        &&f.enabled&&f.energized&&f.certain&&f.enable===0&&f.reset===1&&f.sleep===1
        &&near(f.idealAngle,ticks*360/(16*200))&&near(f.angle,f.idealAngle)
        &&f.endMs>=end&&f.timeMs<=last.timeMs+8&&f.timeMs<=(next?.timeMs??lastTime));
      const valid=startOK&&protocol&&held&&noFaultBefore(end);passed&&=valid;
      checks.push({count:b.count,direction:b.direction,resolution:b.resolution,holdMs:b.holdMs,
        firstMs:first?.timeMs??null,lastMs:last?.timeMs??null,translatorTicks:ticks,protocol,held,passed:valid});
    }
    return {passed,checks};
  }
  function verifyControl(){
    const burstOK=(offset:number,count:number)=>{
      const slice=steps.slice(offset,offset+count);
      return slice.length===count&&slice.every((p,i)=>p.direction===1&&p.resolution===1
        &&p.ticks===(offset===20?i+1:offset+i+1)*16
        &&(i===0||Math.abs(p.timeMs-slice[i-1].timeMs-s.pulsePeriodMs)<=s.pulsePeriodToleranceMs+1e-6));
    };
    const stateAt=(accepted:number,ignored:number,ticks:number,driven:number,enable:number,sleep:number,certain:boolean)=>
      states.filter(f=>f.accepted===accepted&&f.ignored===ignored&&f.rejected===0&&f.rising===accepted+ignored
        &&f.ticks===ticks&&f.driven===driven&&f.resolution===1&&f.bits===0&&f.enable===enable&&f.reset===1&&f.sleep===sleep
        &&f.enabled===(enable===0&&sleep===1)&&f.energized===f.enabled&&f.certain===certain
        &&near(f.idealAngle,driven*360/(16*200))&&(certain?near(f.angle,f.idealAngle):f.angle===null));
    const held=(candidates:State[],lastPulse:number,nextPulse:number=Infinity)=>candidates.some(f=>
      f.endMs>=lastPulse+700-s.pauseToleranceMs&&f.timeMs<=lastPulse+8&&f.timeMs<=nextPulse);
    const drive=stateAt(10,0,160,160,0,1,true),disabled=stateAt(20,0,320,160,1,1,false);
    const reset=stateAt(20,3,0,160,1,1,false),sleep=stateAt(20,6,0,160,1,0,false),wake=stateAt(25,6,80,240,0,1,false);
    const pulseGap=(after:number,before:number,expected:number)=>Number.isFinite(after)&&Number.isFinite(before)
      &&Math.abs(after-before-expected)<=s.pauseToleranceMs+s.pauseObservationToleranceMs;
    const primary=burstOK(0,10)&&burstOK(10,10)&&steps[0].timeMs<=s.startupAllowanceMs
      &&held(drive,steps[9].timeMs,steps[10].timeMs)&&held(disabled,steps[19].timeMs,ignored[0]?.timeMs)
      &&pulseGap(steps[10].timeMs,steps[9].timeMs,700+s.pulsePeriodMs)&&noFaultBefore(steps[19].timeMs+620);
    const ignores=ignored.length===6&&ignored.slice(0,3).every(p=>p.reason==='RESET LOW')&&ignored.slice(3).every(p=>p.reason==='SLEEP LOW');
    const advanced=primary&&ignores&&burstOK(20,5)&&held(reset,ignored[2]?.timeMs,ignored[3]?.timeMs)
      &&held(sleep,ignored[5]?.timeMs,steps[20]?.timeMs)&&wake.some(f=>f.endMs>=steps[24].timeMs+100)
      &&pulseGap(ignored[0]?.timeMs,steps[19]?.timeMs,700+s.pulsePeriodMs)
      &&pulseGap(ignored[3]?.timeMs,ignored[2]?.timeMs,700+s.pulsePeriodMs)
      &&pulseGap(steps[20]?.timeMs,ignored[5]?.timeMs,702+s.pulsePeriodMs)&&noFaultBefore(lastTime);
    return {primary,advanced,checkpoints:{drive:!!drive.length,disabled:!!disabled.length,reset:!!reset.length,sleep:!!sleep.length,wake:!!wake.length}};
  }
  function record(){
    const control=variant==='stepperControl'?verifyControl():null;
    const basic=control?null:verifyBursts(1),repeated=control?null:verifyBursts(s.cycles);
    return {index:1,variant,motorSupplyV,connected:path,accepted:steps.length,ignored:ignored.length,
      faults,overflow,lostTrace,basic:control?.primary??basic!.passed,advanced:control?.advanced??repeated!.passed,
      ...(control?{checkpoints:control.checkpoints}:{bursts:repeated!.checks}),lastState:states.at(-1)??null};
  }
  return {stimuli:[{}],duration:s.stageDurationMs,inputs:(_value:any)=>[],observe,record,
    outcomes:(samples:any[],wiring:boolean)=>{
      const connection=wiring&&path,primary=connection&&samples[0]?.basic===true;
      return [connection,primary,primary&&samples[0]?.advanced===true];
    }};
}
