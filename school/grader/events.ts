import type {SimulationConfig} from '../../src/circuit/compile';

export const isEventContract=(p:any)=>p.checkerVersion==='24E.1';
export function validEventConfig(c:SimulationConfig,variant:string){
  if(variant.startsWith('encoder')||variant==='ky040')return c.encoders.length===1;
  return c.irReceivers.length===1&&(variant==='irTransmit'?
    c.irTransmitters.length===1&&c.irRemotes.length===0:c.irRemotes.length===1&&c.irTransmitters.length===0)&&
    (variant!=='irLED'||c.leds.length===1);
}
type Edge={timeUs:number;level:number};
// Independent envelope decoder. It consumes only the receiver's actual OUT
// transitions, including Timer2/LEDC carrier demodulation for a transmitter.
export function decodeNEC(trace:Edge[]){
  const result:any[]=[];
  const near=(n:number,want:number,tolerance:number)=>Math.abs(n-want)<=tolerance;
  for(let i=0;i+3<trace.length;i++){
    if(trace[i].level!==0||!near(trace[i+1].timeUs-trace[i].timeUs,9000,1100))continue;
    const start=trace[i].timeUs,gap=trace[i+2].timeUs-trace[i+1].timeUs;
    if(near(gap,2250,450)&&near(trace[i+3].timeUs-trace[i+2].timeUs,562.5,180)){
      result.push({timeUs:start,endUs:trace[i+3].timeUs,repeat:true});i+=3;continue;
    }
    if(!near(gap,4500,600)||i+67>=trace.length)continue;
    let raw=0,valid=true;
    for(let bit=0;bit<32;bit++){
      const j=i+2+bit*2,mark=trace[j+1].timeUs-trace[j].timeUs,space=trace[j+2].timeUs-trace[j+1].timeUs;
      if(!near(mark,562.5,180)){valid=false;break;}
      if(near(space,1687.5,280))raw|=1<<bit;else if(!near(space,562.5,180)){valid=false;break;}
    }
    if(!valid||!near(trace[i+67].timeUs-trace[i+66].timeUs,562.5,180))continue;
    const a=raw&255,ia=(raw>>>8)&255,command=(raw>>>16)&255,ic=(raw>>>24)&255;
    if((a^ia)!==255||(command^ic)!==255)continue;
    result.push({timeUs:start,endUs:trace[i+67].timeUs,address:a,command,repeat:false});i+=67;
  }
  return result;
}

export function createEventCheck(c:SimulationConfig,profile:any,seed:string,backend:string){
  const variant=profile.taskKey.split('/')[1],s=profile.contract.scenario;
  const encoder=variant.startsWith('encoder')||variant==='ky040',raw=variant==='encoderRaw',tx=variant==='irTransmit';
  const device:any=encoder?c.encoders[0]:c.irReceivers[0],remote:any=c.irRemotes[0],transmitter:any=c.irTransmitters[0];
  if(remote)remote.pressDelayUs=40000;
  let state=parseInt(seed.slice(0,8),16)||1;
  const integer=(lo:number,hi:number)=>{state^=state<<13;state^=state>>>17;state^=state<<5;return lo+(state>>>0)%(hi-lo+1);};
  const duration=s.stageDurationMs;
  let stimuli:any[];
  if(encoder){
    // Stimulus timing belongs to the published checker, not to saved UI speed.
    device.encoderEdgeMs=raw?100:20;device.encoderBounce=variant==='encoderBounce';device.pressed=false;
    const origin=device.encoderPosition,a=integer(1,3),b=integer(1,2),d=integer(1,3),e=integer(1,2);
    stimuli=[{position:origin,count:0,pressed:false},{position:origin+a,count:a,pressed:false},
      {position:origin+a-b,count:a-b,pressed:false},{position:origin+a-b,count:0,pressed:true,reset:true},
      {position:origin+a-b-d,count:-d,pressed:false},{position:origin+a-b-d+e,count:-d+e,pressed:false}];
  }else if(tx)stimuli=[{blocked:!!device.irBlocked},{blocked:true},{blocked:!!device.irBlocked,recovery:true}];
  else if(variant==='irPulses'){
    const address=integer(1,220),command=integer(0,255),other=(command+integer(1,254))&255;
    stimuli=[{idle:true},{address,command,hold:0},{address:(address+1)&255,command:other,hold:220},
      {address,command:other,fault:'inverse'},{address,command,fault:'timing'},
      {address,command,blocked:true},{address:(address+2)&255,command:other,recovery:true}];
  }else{
    const plus=integer(0,1)?70:21,delta=plus===70?10:-10;
    const after=Math.max(0,Math.min(100,50+delta));
    stimuli=[{idle:true,brightness:0},{address:0,command:69,brightness:50},
      {address:0,command:plus,brightness:after},
      {address:0,command:plus,hold:220,brightness:Math.max(0,Math.min(100,after+3*delta))},
      {address:0,command:69,hold:220,brightness:0},
      {address:0,command:70,hold:440,brightness:50},
      {address:0,command:70,hold:550,brightness:100},
      {address:0,command:21,hold:550,brightness:40},
      {address:0,command:21,hold:550,brightness:0},
      {address:integer(1,255),command:69,unchanged:true},{address:0,command:69,fault:'inverse',unchanged:true},
      {address:0,command:69,fault:'timing',unchanged:true},{address:0,command:69,blocked:true,unchanged:true},
      {address:0,command:69,brightness:50,recovery:true}];
    for(let i=1;i<stimuli.length;i++)if(stimuli[i].unchanged)stimuli[i].brightness=stimuli[i-1].brightness;
  }
  const traces=new Map<string,Map<number,any>>(),observations:any[]=[];
  const observe=(event:any)=>{
    if(event.type!=='simulation')return;
    for(const [id,v]of Object.entries(encoder?event.encoders??{}:event.infrared??{}) as [string,any][]){
      if(!traces.has(id))traces.set(id,new Map());
      for(const edge of v.trace??[])traces.get(id)!.set(edge.timeUs,edge);
    }
    observations.push(event);
    if(observations.length>6000)observations.shift();
  };
  const allEdges=(id:string)=>[...(traces.get(id)?.values()??[])].sort((a,b)=>a.timeUs-b.timeUs);
  const inputs=(v:any)=>encoder?[{component:device.id,encoderPosition:v.position,pressed:v.pressed,encoderBounce:variant==='encoderBounce'}]:
    tx?[{component:device.id,irBlocked:v.blocked}]:[
      {component:device.id,irBlocked:v.blocked||!!device.irBlocked},
      ...(v.idle?[]:[{component:remote.id,irPress:stimuli.indexOf(v)+1,irAddress:v.address,irCommand:v.command,irHoldMs:v.hold??0,irFault:v.fault??'none'}])];
  const gpioInput=(event:any,net:number)=>c.gpios.some(g=>g.net===net&&event.gpios?.[g.pin]?.mode==='IN');
  let connected=false;
  function record(stage:number,last:any,lines:{timeMs:number;text:string}[]){
    const v=stimuli[stage],start=stage*duration,end=start+duration,tolerance=s.stepToleranceMs;
    const current=lines.filter(l=>l.timeMs>=start-tolerance&&l.timeMs<end);
    const frames=observations.filter(e=>e.timeMs>=start&&e.timeMs<end);
    const path=frames.some(e=>{
      const d=(encoder?e.encoders:e.infrared)?.[device.id];
      return d?.powered&&(encoder?[device.clk,device.dt,device.sw].every(n=>gpioInput(e,n)):
        tx?e.infrared?.[transmitter.id]?.powered&&c.gpios.some(g=>g.net===device.output)&&c.gpios.some(g=>g.net===transmitter.signal&&['OUT','PWM'].includes(e.gpios?.[g.pin]?.mode)):
        gpioInput(e,device.output));
    });
    if(encoder){
      const physical=allEdges(device.id).filter(e=>e.timeUs>=start*1000&&e.timeUs<end*1000);
      const powered=last?.encoders?.[device.id]?.powered;
      connected ||= path&&powered&&physical.some(e=>e.clk===0||e.dt===0);
      let passed=false,details:any;
      if(raw){
        const reports=current.flatMap(l=>{const m=l.text.match(/\bRAW CLK=([01]) DT=([01]) SW=([01])\b/);return m?[{timeMs:l.timeMs,clk:+m[1],dt:+m[2],sw:+m[3]}]:[];});
        const same=(a:any,b:any)=>['clk','dt','sw'].every(k=>a[k]===b[k]);
        const edges=physical.filter((e,i)=>i===0||!same(e,physical[i-1]));
        const timely=edges.every(e=>reports.some(r=>r.timeMs>=e.timeUs/1000-tolerance&&r.timeMs<=e.timeUs/1000+s.responseDeadlineMs&&same(r,e)));
        // A transcript must agree with the physical state at its own time.
        const truthful=reports.every(r=>{const e=allEdges(device.id).filter(e=>e.timeUs/1000<=r.timeMs+tolerance).at(-1);return e&&same(r,e)||physical.some(e=>same(r,e)&&Math.abs(r.timeMs-e.timeUs/1000)<=s.responseDeadlineMs);});
        passed=path&&timely&&truthful&&(stage===0||physical.length>0);
        details={physicalEdges:edges.length,reports:reports.length,timely,truthful};
      }else{
        const positions=current.flatMap(l=>{const m=l.text.match(/\bENC (?:RESET )?P=(-?\d+)\b/);return m?[{timeMs:l.timeMs,value:+m[1]}]:[];});
        const previous=stage?stimuli[stage-1].count:0;
        const expected=v.reset?[0]:Array.from({length:Math.abs(v.count-previous)},(_,i)=>previous+Math.sign(v.count-previous)*(i+1));
        const actual=positions.filter((r,i)=>i===0||r.value!==positions[i-1].value).map(r=>r.value);
        const entire=allEdges(device.id);
        const completed=physical.filter(e=>{const i=entire.indexOf(e);return i>0&&e.position!==entire[i-1].position;});
        const times=v.reset?[start+20]:completed.map(e=>e.timeUs/1000);
        const distinct=positions.filter((r,i)=>i===0||r.value!==positions[i-1].value);
        const timely=expected.length===times.length&&distinct.every((r,i)=>times[i]!==undefined&&r.timeMs>=times[i]-tolerance&&r.timeMs<=times[i]+s.responseDeadlineMs+tolerance);
        passed=path&&timely&&JSON.stringify(actual)===JSON.stringify(expected)&&last?.encoders?.[device.id]?.position===v.position;
        details={expected,reported:actual,timely,physicalPosition:last?.encoders?.[device.id]?.position,programPosition:v.count};
      }
      observations.length=0;
      return {index:stage+1,...v,...details,passed};
    }
    const trace=allEdges(device.id),received=decodeNEC(trace).filter(f=>f.timeUs>=start*1000&&f.endUs<end*1000);
    const physicalEdges=trace.filter(e=>e.timeUs>=start*1000&&e.timeUs<end*1000).length;
    connected ||= path&&physicalEdges>=60;
    let passed=false,details:any;
    if(tx){
      const full=received.filter(f=>!f.repeat);
      const txFrames=decodeNEC(allEdges(transmitter.id)).filter(f=>!f.repeat&&f.timeUs>=start*1000&&f.endUs<end*1000);
      // A valid transmitter envelope is created only after the electrical
      // model verifies 34–42 kHz and 15–50 % duty. Blocking Python send need
      // not yield a snapshot while its carrier is active.
      const carrier=txFrames.length>0;
      const values=full.map(f=>f.command),valid=full.every(f=>f.address===0&&[69,70].includes(f.command))&&values.every((n,i)=>!i||n!==values[i-1]);
      passed=path&&carrier&&(v.blocked?physicalEdges<=2&&received.length===0&&txFrames.length>=1:
        full.length>=2&&valid&&txFrames.length>=full.length);
      details={receiverFrames:full,transmittedFrames:txFrames.length,carrierInRange:carrier};
    }else if(variant==='irPulses'){
      const decoded=current.flatMap(l=>{const m=l.text.match(/\bNEC A=(\d+) C=(\d+) R=([01])\b/);return m?[{timeMs:l.timeMs,address:+m[1],command:+m[2],repeat:!!+m[3]}]:[];});
      const expected=v.idle||v.blocked||v.fault?[]:Array.from({length:1+Math.floor((v.hold??0)/110)},(_,i)=>({address:v.address,command:v.command,repeat:i>0}));
      const matching=decoded.length===expected.length&&decoded.every((r,i)=>(['address','command','repeat'] as const).every(k=>r[k]===expected[i][k])&&received[i]&&Math.abs(r.timeMs-received[i].endUs/1000)<=s.responseDeadlineMs);
      const pulseLines=current.filter(l=>/\b(?:IR PULSES|PULSE LEADER=)/.test(l.text));
      const pulseValid=pulseLines.length===expected.length&&pulseLines.every((l,i)=>{
        const list=l.text.match(/\bIR PULSES\s+\[([^\]]+)\]/);
        if(list){const a=list[1].split(',').map(Number),f=received[i];if(!f)return false;
          const edge=trace.findIndex(e=>e.timeUs===f.timeUs),want=trace.slice(edge,edge+(f.repeat?4:68));
          // time_pulse_us measures the remaining LOW if polling begins during
          // the leader. The published Python decoder accepts 6500–11000 us;
          // every subsequent bit must still match the actual full waveform.
          return a.length===want.length-1&&a.every((n,j)=>j===0&&n>=6500&&n<=9000||Math.abs(n-(want[j+1].timeUs-want[j].timeUs))<=s.pulseToleranceUs);
        }
        const m=l.text.match(/PULSE LEADER=(\d+) MARK=(\d+) SPACE=(\d+)/);if(!m)return false;
        const f=received[i];if(!f)return false;
        return +m[1]>=6500&&+m[1]<=9000+s.pulseToleranceUs&&Math.abs(+m[2]-562.5)<=s.pulseToleranceUs&&
          Math.abs(+m[3]-(v.command&128?562.5:1687.5))<=s.pulseToleranceUs;
      });
      passed=path&&matching&&pulseValid&&(expected.length===0||received.length===expected.length);
      details={expected,decoded,received:received.length,pulseReports:pulseLines.length,pulseValid};
    }else{
      // Inspect electrical LED current and the actual PWM output. Text is
      // diagnostic only and can neither create nor remove an output point.
      const led=c.leds[0];
      const reachable=(origin:number)=>{
        const nets=new Set([origin]),rail=(net:number)=>c.rails.some(r=>r.net===net);
        if(rail(origin))return new Set<number>();
        for(let changed=true;changed;){changed=false;
          for(const r of c.resistors)for(const [a,b]of [[r.a,r.b],[r.b,r.a]])
            if(nets.has(a)&&!nets.has(b)&&!rail(b)){nets.add(b);changed=true;}
        }return nets;
      };
      const anode=reachable(led.a),cathode=reachable(led.k);
      const matches=(e:any)=>c.gpios.some(g=>{
        if(!anode.has(g.net)&&!cathode.has(g.net))return false;
        const pin=e.gpios?.[g.pin],current=e.leds?.[led.id]?.currentMa;
        let duty=pin?.mode==='PWM'?pin.duty/65535:pin?.mode==='OUT'?pin.level:NaN;
        if(cathode.has(g.net))duty=1-duty;
        return Math.abs(duty-v.brightness/100)<=s.dutyTolerance&&(v.brightness===0?current<.05:current>.1);
      });
      const stable=frames.filter(e=>e.timeMs>=start+s.responseDeadlineMs),truthful=stable.length>0&&stable.every(matches);
      const expectedFrames=v.idle||v.blocked||v.fault?0:1+Math.floor((v.hold??0)/110);
      passed=path&&truthful&&received.length===expectedFrames;
      details={expectedBrightness:v.brightness,receiverFrames:received.length,stableOutput:truthful};
    }
    observations.length=0;
    return {index:stage+1,...v,...details,passed};
  }
  const outcomes=(samples:any[],wiring:boolean)=>{
    const connection=wiring&&connected,complete=samples.length===stimuli.length;
    const basic=tx?[0]:encoder?[0,1,2]:[0,1,2];
    const edge=tx?[1,2]:stimuli.map((_,i)=>i).slice(3);
    return [connection,connection&&complete&&basic.every(i=>samples[i].passed),connection&&complete&&edge.every(i=>samples[i].passed)];
  };
  return {stimuli,duration,inputs,observe,record,outcomes};
}
