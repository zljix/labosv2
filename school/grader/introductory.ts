import type {SimulationConfig} from '../../src/circuit/compile';
import {createAnalogCheck,validAnalogConfig} from './analog';
import {ahtTemperature,regulatorAngles,validEnvironmentConfig} from './environment';
import fonts from './environment-fonts.json';
import {buttonSchedule,regulatorTemperatures} from './input-scenarios';

export const isIntroductoryContract=(p:any)=>['24O.1','24P.1-introductory','24P.1-button'].includes(p.checkerVersion);
export function validIntroductoryConfig(c:SimulationConfig,v:string){
  if(v==='adc-pwm')return validAnalogConfig(c,'adc');
  if(v==='regulator')return validEnvironmentConfig(c,'regulator');
  if(v==='aht-oled')return c.i2cDevices.length===2&&c.i2cDevices.some(d=>d.kind==='aht10')&&c.i2cDevices.some(d=>d.kind==='ssd1306')&&c.servos.length===0;
  return c.leds.length===1&&c.pots.length===0&&c.buttons.length===(v==='button'?1:0);
}

// A fixed-font number must occupy complete cells in the actual 128x64 OLED
// memory. Neither source strings nor a student's local check supply evidence.
export function introductoryNumberRows(bytes:number[],value:string):number[]{
  if(bytes.length!==1024)return [];
  const f=fonts.micropython,columns=value.split('').flatMap(c=>(f.glyphs as any)[c]??[]);
  if(columns.length!==value.length*f.width||!columns.length)return [];
  const numeric=new Set(Object.values(f.glyphs).map(g=>g.join(','))),found:number[]=[];
  for(let y=0;y<=64-f.height;y++){
    const row=Array.from({length:128},(_,x)=>{let col=0;for(let bit=0;bit<f.height;bit++)if(bytes[Math.floor((y+bit)/8)*128+x]&(1<<((y+bit)%8)))col|=1<<bit;return col;});
    const numericAt=(x:number)=>x>=0&&x+f.width<=128&&numeric.has(row.slice(x,x+f.width).join(','));
    for(let x=0;x<=128-columns.length;x++)if(columns.every((v,i)=>row[x+i]===v)&&!numericAt(x-f.width)&&!numericAt(x+columns.length)){found.push(y);break;}
  }return found;
}

export function createIntroductoryCheck(c:SimulationConfig,p:any,seed:string){
  const v=p.taskKey.split('/')[1],s=p.contract.scenario,duration=s.stageDurationMs;
  if(v==='adc-pwm'){
    const analog=createAnalogCheck(c,{...p,taskKey:'gpio/adc'},seed,false);
    return {...analog,protocolClock:false,record:(index:number,last:any,lines:any[])=>{
      const result=analog.record(index,last,lines),position=analog.stimuli[index].position;
      // Introductory instructions require OFF at slider 0% and ON at 100%.
      // Reversed supply terminals are not an equivalent mapping here. The
      // separate URS ADC contract keeps its existing electrical alternatives.
      const positionDuty=Math.round(Math.min(1,position*3.3/100/3.1)*4095)/4095;
      const positionMatches=Number.isFinite(result.observedDuty)&&Math.abs(result.observedDuty-positionDuty)<=s.pwmTolerance;
      return {...result,positionDuty,positionMatches,passed:result.passed&&positionMatches};
    }};
  }
  if(v==='led-time'||v==='button'){
    const led=c.leds[0],button=c.buttons[0],frames:any[]=[],edges:any[]=[];
    const seeded=v==='button'&&s.seededInput===true;
    const stimuli:any[]=v==='led-time'?[{}]:seeded?buttonSchedule(seed,s.minimumStageMs,s.maximumStageMs):[false,true,false,true,false,true,false].map(pressed=>({pressed}));
    let buttonIndex=0,buttonTimely=false,buttonSettled=0,buttonStable=true;
    const gpio=(net:number)=>c.gpios.find(g=>g.net===net),ground=(net:number)=>c.referenceGrounds.includes(net);
    const inputPin=button&&(ground(button.a)?gpio(button.b):ground(button.b)?gpio(button.a):undefined);
    return {stimuli,duration,...(seeded?{durations:stimuli.map(v=>v.durationMs)}:{}),protocolClock:false,inputs:(value:any)=>button?[{component:button.id,pressed:value.pressed}]:[],
      observe:(e:any)=>{if(e.type!=='simulation')return;const current=e.leds?.[led.id]?.currentMa;
        if(v==='button'){
          if(seeded){
            const q=stimuli[buttonIndex];if(!q||e.timeMs<q.startMs||e.timeMs>=q.startMs+q.durationMs)return;
            const matches=Number.isFinite(current)&&(q.pressed?current>.5:current<.05);
            if(e.timeMs<=q.startMs+s.responseDeadlineMs+s.stepToleranceMs)buttonTimely ||= matches;
            else {buttonSettled++;buttonStable &&= matches;}
          }else {frames.push(e);if(frames.length>3000)frames.shift();}
        }
        else if(Number.isFinite(current)&&(current>.5||current<.05)){
          const on=current>.5;if(edges.at(-1)?.on!==on&&edges.length<1000)edges.push({timeMs:e.timeMs,on});
        }},
      record:(index:number,last:any)=>{
        if(v==='led-time')return {index:1,edges};
        const start=seeded?stimuli[index].startMs:index*duration,end=start+(seeded?stimuli[index].durationMs:duration),expected=stimuli[index].pressed;
        const matches=(e:any)=>{const current=e.leds?.[led.id]?.currentMa;return Number.isFinite(current)&&(expected?current>.5:current<.05);};
        const rows=frames.filter(e=>e.timeMs>=start&&e.timeMs<end),deadline=start+s.responseDeadlineMs+s.stepToleranceMs;
        const timely=seeded?buttonTimely:rows.some(e=>e.timeMs<=deadline&&matches(e)),settled=rows.filter(e=>e.timeMs>deadline);
        const validPath=!!inputPin&&last?.gpios?.[inputPin.pin]?.mode==='IN';
        const passed=validPath&&timely&&(seeded?buttonSettled>0&&buttonStable:settled.length>0&&settled.every(matches));
        buttonIndex++;buttonTimely=false;buttonSettled=0;buttonStable=true;
        frames.length=0;return {index:index+1,pressed:expected,...(seeded?{startMs:start,durationMs:end-start,responseDeadlineMs:s.responseDeadlineMs,stepToleranceMs:s.stepToleranceMs}:{}),validPath,timely,currentMa:last?.leds?.[led.id]?.currentMa??null,
          passed};
      },
      outcomes:(samples:any[],wiring:boolean)=>{
        if(v==='button'){
          const connection=wiring&&samples.length===stimuli.length&&samples.every(r=>r.validPath);
          const basic=connection&&samples.slice(0,3).every(r=>r.passed);
          return [connection,basic,basic&&samples.slice(3).every(r=>r.passed)];
        }
        const first=edges.findIndex(e=>e.on),active=edges.slice(first<0?0:first),spans=active.slice(1).map((e,i)=>({on:active[i].on,durationMs:e.timeMs-active[i].timeMs}));
        const connection=wiring&&edges.some(e=>e.on),repeat=spans.filter(e=>e.on).length>=3&&spans.filter(e=>!e.on).length>=3;
        return [connection,connection&&repeat,connection&&repeat&&spans.every(e=>Math.abs(e.durationMs-(e.on?s.onMs:s.offMs))<=s.toleranceMs)];
      }};
  }
  const regulator=v==='regulator',sensor=c.i2cDevices.find(d=>d.kind==='aht10')!,panel=c.i2cDevices.find(d=>d.kind==='ssd1306')!,servo=c.servos[0];
  const flip=parseInt(seed.slice(0,8),16)%2,first=flip?18.4:21.3,second=flip?33.7:31.8;
  const temperatures=regulator&&s.seededInput?regulatorTemperatures(seed,s.temperatures.slice(s.basicStages)):s.temperatures;
  const environments=regulator?temperatures.map((temperature:number,i:number)=>({temperature,humidity:s.humidities[(i+flip)%s.humidities.length]})):
    [{temperature:first,humidity:43.7},{temperature:second,humidity:43.7},{temperature:second,humidity:72.4},
      {temperature:-6.2,humidity:72.4},{temperature:-6.2,humidity:28.6},{temperature:first,humidity:43.7}];
  const angles=regulator?regulatorAngles(temperatures,s.lowerThresholdC,s.upperThresholdC):[];
  const stimuli=environments.map((e:any,i:number)=>({...e,...(regulator?{angle:angles[i]}:{})}));
  let stage=0,readings:any[]=[],refreshTimes:number[]=[],seen=new Set<string>(),connected=false,displayPath=false,servoPath=false;
  let screenKey='',screenMatch=false,screenStart:number|null=null,screenStable=false,firstScreen:number|null=null,lastObservation=-Infinity,angleSamples:any[]=[];
  const matches=(r:any)=>r&&Math.abs(r.temperature-ahtTemperature(stimuli[stage].temperature))<=s.temperatureToleranceC&&Math.abs(r.humidity-stimuli[stage].humidity)<=s.humidityTolerance;
  return {stimuli,duration,protocolClock:true,inputs:(value:any)=>[{component:sensor.id,temperature:value.temperature,humidity:value.humidity}],
    observe:(e:any)=>{
      if(e.type!=='simulation'||stage>=stimuli.length)return;const start=stage*duration;
      for(const r of e.measurements??[]){
        const key=r.component+':'+r.sample;if(r.component!==sensor.id||seen.has(key))continue;seen.add(key);
        connected ||= !!e.sensors?.[sensor.id]?.powered;
        if(r.timeMs>=start+s.sampleSettleMs&&r.timeMs<(stage+1)*duration&&readings.length<256)readings.push(r);
      }
      const display=e.displays?.[panel.id],motor=servo&&e.servos?.[servo.id];
      displayPath ||= !!(display?.powered&&e.i2cTrace?.some((t:any)=>t.address===panel.address&&t.operation==='W'&&t.result==='ACK'));
      servoPath ||= !!(motor?.powered&&Number.isFinite(motor.angle)&&Math.abs(motor.freq-50)<=s.servoFrequencyToleranceHz);
      if(e.timeMs-lastObservation<s.observationStepMs)return;lastObservation=e.timeMs;
      if(regulator&&e.timeMs>=start+s.responseDeadlineMs&&e.timeMs<(stage+1)*duration&&angleSamples.length<256)
        angleSamples.push({timeMs:e.timeMs,angle:motor?.angle??null,passed:!!motor?.powered&&Math.abs((motor.angle??Infinity)-stimuli[stage].angle)<=s.servoAngleToleranceDeg&&Math.abs((motor.freq??Infinity)-50)<=s.servoFrequencyToleranceHz});
      const r=readings.at(-1),valid=matches(r)&&e.timeMs-r.timeMs<=s.maximumIntervalMs&&display?.powered&&display.on&&display.height===64;
      const key=valid?JSON.stringify([display.bytes,r.temperature.toFixed(1),r.humidity.toFixed(1)]):'';
      if(key!==screenKey){
        screenKey=key;screenMatch=false;
        if(valid){const t=introductoryNumberRows(display.bytes,r.temperature.toFixed(1)),rh=introductoryNumberRows(display.bytes,r.humidity.toFixed(1));screenMatch=t.some(y=>rh.some(z=>Math.abs(y-z)>=8));}
      }
      if(valid&&screenMatch){
        for(const t of e.i2cTrace??[])if(t.address===panel.address&&t.operation==='W'&&t.result==='ACK'&&t.bytes?.[0]===0x40&&t.length>1
          &&t.timeMs>=start+s.sampleSettleMs&&t.timeMs<(stage+1)*duration&&!refreshTimes.includes(t.timeMs)&&refreshTimes.length<256)refreshTimes.push(t.timeMs);
        screenStart??=e.timeMs;if(e.timeMs-screenStart!>=s.minimumStableMs){screenStable=true;firstScreen??=screenStart;}
      }
      else screenStart=null;
    },
    record:()=>{
      const start=stage*duration,end=start+duration,fresh=readings.filter(matches),times=fresh.map(r=>r.timeMs);
      const gaps=[...times,end].slice(1).map((t,i)=>t-times[i]);
      const sensorOK=times.length>=s.minimumFreshReads&&times[0]-start<=s.responseDeadlineMs&&gaps.every(g=>g<=s.maximumIntervalMs);
      refreshTimes.sort((a,b)=>a-b);
      const refreshGaps=[...refreshTimes,end].slice(1).map((t,i)=>t-refreshTimes[i]);
      const screenOK=screenStable&&firstScreen!==null&&firstScreen-start<=s.responseDeadlineMs&&refreshTimes.length>=2&&refreshGaps.every(g=>g<=s.maximumIntervalMs);
      const angleOK=!regulator||angleSamples.length>0&&angleSamples.every(a=>a.passed);
      const row={index:stage+1,expected:stimuli[stage],readings:fresh,refreshTimes,firstScreenDelayMs:firstScreen===null?null:firstScreen-start,sensorOK,screenOK,angleOK,angleSamples,passed:sensorOK&&screenOK&&angleOK};
      stage++;readings=[];refreshTimes=[];screenKey='';screenMatch=false;screenStart=null;screenStable=false;firstScreen=null;angleSamples=[];return row;
    },outcomes:(samples:any[],wiring:boolean)=>{
      const connection=wiring&&connected&&displayPath&&(!regulator||servoPath),complete=samples.length===stimuli.length;
      const basic=connection&&complete&&(regulator?samples.slice(0,s.basicStages).every(r=>r.passed):samples.every(r=>r.sensorOK));
      return [connection,basic,basic&&(regulator?samples.slice(s.basicStages).every(r=>r.passed):samples.every(r=>r.passed))];
    }};
}
