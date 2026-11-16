import type {SimulationConfig} from '../../src/circuit/compile';

export const isAnalogContract=(profile:any)=>profile.checkerVersion==='24C.1';
export function validAnalogConfig(c:SimulationConfig,variant:string){
  if(variant==='adc')return c.pots.length===1&&c.leds.length===1&&c.analogInputs.length===0;
  if(variant==='dualInputs')return c.pots.length===2&&c.buttons.length===2&&c.analogInputs.length===0;
  const wanted=variant==='analogCompare'?['lm35','ntc']:[variant];
  return c.analogInputs.length===wanted.length&&wanted.every(k=>c.analogInputs.filter(d=>d.kind===k).length===1);
}

// This observer reads model voltages and actual program output. It never reads
// a student's claimed result, source tokens, variable names or incoming binary.
export function createAnalogCheck(c:SimulationConfig,profile:any,seed:string,avr:boolean){
  const variant=profile.taskKey.split('/')[1],scenario=profile.contract.scenario;
  let state=parseInt(seed.slice(0,8),16)||1;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
  const between=(a:number,b:number)=>Math.round((a+(b-a)*random())*10)/10;
  const sensors=[...c.analogInputs],pots=[...c.pots].sort((a,b)=>a.id.localeCompare(b.id)),buttons=[...c.buttons].sort((a,b)=>a.id.localeCompare(b.id));
  const sensor=(kind:string)=>sensors.find(s=>s.kind===kind)!;
  const duration=scenario.stageDurationMs,deadline=scenario.responseDeadlineMs+scenario.stepToleranceMs;
  const full=avr?1023:4095,reference=avr?5:3.1,supply=avr?5:3.3;
  let stimuli:any[];
  if(variant==='adc')stimuli=[0,between(15,35),between(60,80),25,50,100,0].map(position=>({position}));
  else if(variant==='ntc')stimuli=[25,between(35,60),between(0,15),-20,100,25].map(temperature=>({temperature}));
  else if(variant==='temt6000')stimuli=[100,between(20,70),between(250,500),0,620,2000,100].map(illuminance=>({illuminance}));
  else if(variant==='ky023')stimuli=[{axisX:50,axisY:50,pressed:false},{axisX:between(15,30),axisY:between(65,80),pressed:true},
    {axisX:between(70,85),axisY:between(20,35),pressed:false},{axisX:0,axisY:100,pressed:true},{axisX:100,axisY:0,pressed:false},
    {axisX:51,axisY:49,pressed:true},{axisX:45,axisY:55,pressed:false},{axisX:50,axisY:50,pressed:false}];
  else if(variant==='flame'||variant==='sound'){
    const threshold=sensor(variant).threshold!;
    const low=()=>between(0,Math.max(0,threshold-3)),high=()=>between(Math.min(100,threshold+3),100);
    const initial=random()<.5?[low(),high()]:[high(),low()];initial.push(random()<.5?low():high());
    const boundaries=random()<.5?[threshold+2,threshold,threshold-2,threshold]:[threshold-2,threshold,threshold+2,threshold];
    const endpoints=random()<.5?[0,100]:[100,0];
    stimuli=[...initial,...boundaries,...endpoints,initial[0]].map(stimulus=>({stimulus}));
    let active=false;for(const s of stimuli){if(s.stimulus>=threshold+2)active=true;if(s.stimulus<=threshold-2)active=false;s.active=active;}
  }else if(variant==='analogCompare')stimuli=[{lm35:25,ntc:25},{lm35:between(40,70),ntc:25},{lm35:25,ntc:between(40,70)},
    {lm35:2,ntc:-20},{lm35:150,ntc:100},{lm35:25,ntc:25}];
  else stimuli=[{a:25,b:75,s1:false,s2:false},{a:between(55,85),b:75,s1:true,s2:false},
    {a:25,b:between(5,30),s1:false,s2:true},{a:0,b:100,s1:true,s2:false},
    {a:100,b:0,s1:false,s2:true},{a:25,b:75,s1:false,s2:false}];
  const inputs=(s:any)=>variant==='adc'?[{component:pots[0].id,position:s.position}]:variant==='dualInputs'?
    [{component:pots[0].id,position:s.a},{component:pots[1].id,position:s.b},{component:buttons[0].id,pressed:s.s1},{component:buttons[1].id,pressed:s.s2}]:
    variant==='analogCompare'?[{component:sensor('lm35').id,temperature:s.lm35},{component:sensor('ntc').id,temperature:s.ntc}]:
    [{component:sensor(variant).id,...s}];
  const gpio=(net:number)=>c.gpios.find(p=>p.net===net);
  const ground=(net:number)=>c.referenceGrounds.includes(net);
  const rail=(net:number)=>c.rails.some(r=>r.net===net&&r.volts>0);
  const voltage=(frame:any,net:number)=>frame?.nets?.[c.nets[net].id];
  const potPath=(p:any)=>!!gpio(p.w)&&((rail(p.a)&&ground(p.b))||(rail(p.b)&&ground(p.a)));
  const buttonPath=(b:any)=>(!!gpio(b.a)&&ground(b.b))||(!!gpio(b.b)&&ground(b.a));
  const raw=(volts:number)=>Math.round(Math.min(1,Math.max(0,volts/reference))*full);
  const quantized=(volts:number)=>raw(volts)*reference/full;
  const fields=(text:string)=>Object.fromEntries([...text.matchAll(/\b([A-Z][A-Z0-9]*)\s*=\s*(-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|nan)\b/gi)]
    .map(m=>[m[1].toUpperCase(),Number(m[2])]));
  // Reach the LED through resistors only. A PWM on an unrelated pin cannot
  // make a permanently powered LED pass the duty criterion.
  const ledPins=()=>{
    const reachable=new Set([c.leds[0].a]);let changed=true;
    while(changed){changed=false;for(const r of c.resistors)for(const [a,b]of [[r.a,r.b],[r.b,r.a]])if(reachable.has(a)&&!reachable.has(b)&&!ground(b)&&!rail(b)){reachable.add(b);changed=true;}}
    return c.gpios.filter(p=>reachable.has(p.net));
  };
  const frames:any[]=[];
  const observe=(event:any)=>{if(variant==='adc'&&event.type==='simulation'){
    frames.push(event);if(frames.length>1500)frames.shift();
  }};
  function record(stage:number,last:any,lines:{timeMs:number;text:string}[]){
    const s=stimuli[stage],start=stage*duration,end=start+duration;
    const faults=(last?.diagnostics??[]).filter((d:any)=>d.severity==='error'||['input-unpowered','input-signal-open','input-driven','adc-floating','adc-voltage','unconnected','led-open-path','led-polarity','bypassed'].includes(d.code));
    let path=faults.length===0,expected:Record<string,number>={},tolerance:Record<string,number>={};
    const measured=(device:any,pin:string)=>{
      const observed=last?.analogInputs?.[device.id],g=gpio(device.outputs[pin]);
      if(!observed?.powered||!g||!Number.isFinite(observed.volts[pin])||last?.gpios?.[g.pin]?.mode!== (['DO','SW'].includes(pin)?'IN':'ADC'))path=false;
      return observed?.volts?.[pin]??NaN;
    };
    const adc=(key:string,volts:number)=>{expected[key]=raw(volts);tolerance[key]=avr?2:3;};
    if(variant==='adc'){
      path=path&&potPath(pots[0])&&!!last?.gpios?.[gpio(pots[0].w)?.pin??-1]&&last.gpios[gpio(pots[0].w)!.pin].mode==='ADC';
      // Inverting a potentiometer's supply terminals is permitted: its actual
      // wiper voltage is the input, rather than its geometric slider position.
      const volts=voltage(last,pots[0].w);
      expected.duty=raw(Number(volts))/full;
      const duty=(f:any)=>{
        const p=ledPins().map(g=>f?.gpios?.[g.pin]).find(p=>p&&['PWM','OUT'].includes(p.mode));
        return p?.mode==='PWM'?p.duty/65535:p?.mode==='OUT'?p.level:null;
      };
      const relevant=frames.filter(f=>f.timeMs>=start&&f.timeMs<end);
      const matches=(f:any)=>{const d=duty(f),current=f.leds[c.leds[0].id]?.currentMa;
        return d!==null&&Math.abs(d-expected.duty)<=scenario.pwmTolerance&&Number.isFinite(current)&&(expected.duty>.1?current>.05:expected.duty===0?current<.05:true);};
      const timely=relevant.some(f=>f.timeMs<=start+deadline&&matches(f));
      const stable=relevant.filter(f=>f.timeMs>start+deadline);
      const passed=path&&timely&&stable.length>0&&stable.every(matches);
      frames.length=0;
      return {index:stage+1,...s,expected,observedDuty:duty(last),validPath:path,timely,passed};
    }
    if(variant==='dualInputs'){
      path=path&&pots.every(potPath)&&buttons.every(buttonPath);
      for(const [i,key]of ['A','B'].entries()){
        const g=gpio(pots[i].w);if(last?.gpios?.[g?.pin??-1]?.mode!=='ADC')path=false;
        adc(key,Number(voltage(last,pots[i].w)));
      }expected.S1=s.s1?0:1;expected.S2=s.s2?0:1;
    }else if(variant==='analogCompare'){
      measured(sensor('lm35'),'OUT');measured(sensor('ntc'),'AO');expected={LM35:s.lm35,NTC:s.ntc};tolerance={LM35:.6,NTC:.6};
    }else{
      const d=sensor(variant);
      if(variant==='sound'){measured(d,'DO');expected.DO=s.active?0:1;}
      else if(variant==='ky023'){
        const x=measured(d,'VRX'),y=measured(d,'VRY');measured(d,'SW');adc('X',x);adc('Y',y);
        const axis=(v:number)=>{const n=2*quantized(v)/supply-1;return Math.abs(n)<.10?0:n;};
        expected.NX=axis(x);expected.NY=axis(y);expected.SW=s.pressed?0:1;tolerance.NX=tolerance.NY=.025;
      }else{
        const volts=measured(d,'AO');adc('ADC',volts);
        if(variant==='ntc'){expected.T=s.temperature;tolerance.T=.6;}
        if(variant==='temt6000'){expected.U=quantized(volts);tolerance.U=.008;}
        if(variant==='flame'){measured(d,'DO');expected.DO=s.active?0:1;}
      }
    }
    const matches=(line:any)=>{
      const found=fields(line.text);
      return Object.entries(expected).every(([k,v])=>{
        // At exactly +/-0.10, one ADC quantum can place the result on either
        // side of the strict dead-zone boundary (read_uv and integer ADC).
        if(['NX','NY'].includes(k)&&[45,55].includes(k==='NX'?s.axisX:s.axisY)){
          const boundary=(k==='NX'?s.axisX:s.axisY)===45?-.1:.1;
          return Number.isFinite(found[k])&&(Math.abs(found[k])<=.025||Math.abs(found[k]-boundary)<=.025);
        }
        return Number.isFinite(found[k])&&Math.abs(found[k]-v)<=(tolerance[k]??0);
      });
    };
    const currentLines=lines.filter(l=>l.timeMs>=start&&l.timeMs<end);
    const fresh=currentLines.filter(matches),times=[start,...fresh.map(l=>l.timeMs),end];
    const freshEnough=fresh.length>0&&times.slice(1).every((t,i)=>t-times[i]<=deadline);
    const stable=currentLines.filter(l=>l.timeMs>start+deadline&&Object.keys(fields(l.text)).some(k=>Object.hasOwn(expected,k))).every(matches);
    return {index:stage+1,...s,expected,observed:fresh.length?fields(fresh.at(-1)!.text):null,validPath:path,freshEnough,stable,passed:path&&freshEnough&&stable};
  }
  const outcomes=(samples:any[],wiring:boolean)=>{
    const connection=wiring&&samples.length===stimuli.length&&samples.every(s=>s.validPath);
    return [connection,connection&&samples.slice(0,3).every(s=>s.passed),connection&&samples.slice(3).every(s=>s.passed)];
  };
  return {stimuli,duration,inputs,observe,record,outcomes};
}
