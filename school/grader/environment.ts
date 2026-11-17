import type {SimulationConfig} from '../../src/circuit/compile';
import fonts from './environment-fonts.json';
import {regulatorTemperatures} from './input-scenarios';

export const isEnvironmentContract=(p:any)=>['24I.1','24P.1-environment'].includes(p.checkerVersion);
export function validEnvironmentConfig(c:SimulationConfig,v:string){
  const expected=(v==='regulator'?['aht10','ssd1306']:['bmp180','bmp280','am2320','ssd1306']).sort();
  return JSON.stringify(c.i2cDevices.map(d=>d.kind).sort())===JSON.stringify(expected)
    &&c.servos.length===(v==='regulator'?1:0)
    &&c.servos.every(d=>d.minUs===500&&d.maxUs===2500);
}

// Thresholds apply to decoded sensor bits, before rounding for the display.
export const ahtTemperature=(t:number)=>Math.round((t+50)*1048576/200)*200/1048576-50;
export function regulatorAngles(temperatures:number[],lower=26,upper=28){
  let opened=false;return temperatures.map(t=>{const measured=ahtTemperature(t);
    if(measured>=upper)opened=true;else if(measured<=lower)opened=false;return opened?90:0;});
}

// Match complete numeric cells, including their OFF pixels and spacing. The
// oracle comes from the published fonts, never a student's framebuffer/source.
export function containsEnvironmentNumber(bytes:number[],value:string,backend:string,y0:number,height:number){
  if(bytes.length!==1024)return false;
  const f=(fonts as any)[backend==='avr'?'avr':backend],columns=value.split('').flatMap(c=>f.glyphs[c]??[]);
  if(!columns.length||columns.length!==value.length*f.width)return false;
  for(let y=y0;y<=y0+height-f.height;y++){
    const row=Array.from({length:128},(_,x)=>{let col=0;for(let bit=0;bit<f.height;bit++)
      if(bytes[Math.floor((y+bit)/8)*128+x]&(1<<((y+bit)%8)))col|=1<<bit;return col;});
    const numericAt=(x:number)=>x>=0&&x+f.width<=128&&Object.values(f.glyphs).some((glyph:any)=>
      glyph.every((v:number,i:number)=>row[x+i]===v));
    for(let x=0;x<=128-columns.length;x++)if(columns.every((v:number,i:number)=>row[x+i]===v)
      &&!numericAt(x-f.width)&&!numericAt(x+columns.length))return true;
  }return false;
}

export function createEnvironmentCheck(c:SimulationConfig,p:any,seed:string,backend:string){
  const regulator=p.taskKey==='regulator/regulator',s=p.contract.scenario,duration=s.stageDurationMs;
  const devices=c.i2cDevices.filter(d=>d.kind!=='ssd1306').sort((a,b)=>a.kind.localeCompare(b.kind));
  const panel=c.i2cDevices.find(d=>d.kind==='ssd1306')!,servo=c.servos[0];
  const flip=parseInt(seed.slice(0,8),16)%2;
  let stimuli:any[];
  if(regulator){
    const temperatures=s.seededInput?regulatorTemperatures(seed,s.temperatures.slice(s.basicStages)):s.temperatures,angles=regulatorAngles(temperatures,s.lowerThresholdC,s.upperThresholdC);
    stimuli=temperatures.map((temperature:number,i:number)=>({values:[{temperature,humidity:s.humidities[(i+flip)%s.humidities.length]}],angle:angles[i]}));
  }else{
    const environments=s.environments,first=structuredClone(environments[flip]),second=structuredClone(environments[1-flip]);
    // Change just one sensor in each middle stage. Reusing another sensor's
    // transcript or one common environment cannot satisfy these observations.
    const changed=devices.map((d,i)=>{const values=structuredClone(first);values[d.kind]=second[d.kind];return values;});
    stimuli=[first,...changed,second,first].map(environment=>({values:devices.map(d=>environment[d.kind])}));
  }
  let stage=0,screenStart:number|null=null,screenStable=false,lastScreenAt=-Infinity,screenKey='',screenMatch=false;
  const connected=new Set<string>(),seen=new Set<string>();let displayPath=false,servoPath=false;
  let readings:any[]=[],screenSamples=0,angles:any[]=[],maxRecords=false;
  const currentReading=(d:any)=>readings.filter(r=>r.component===d.id).at(-1);
  const matches=(r:any,i:number)=>{
    const e=stimuli[stage].values[i];return typeof r?.temperature==='number'&&Math.abs(r.temperature-e.temperature)<=s.temperatureToleranceC
      &&(devices[i].kind==='am2320'||devices[i].kind==='aht10'?typeof r.humidity==='number'&&Math.abs(r.humidity-e.humidity)<=s.humidityTolerance:
        typeof r.pressure==='number'&&Math.abs(r.pressure-e.pressure)<=s.pressureTolerancePa);
  };
  const screenValues=()=>{
    const rows=devices.map(d=>currentReading(d));if(rows.some((r,i)=>!matches(r,i)))return [];
    if(regulator)return [[rows[0].temperature,0],[rows[0].humidity,backend==='micropython'?14:backend==='avr'?14:16]];
    const byKind=Object.fromEntries(devices.map((d,i)=>[d.kind,rows[i]]));
    return backend==='s3-cpp'?[[byKind.bmp280.temperature,0],[byKind.bmp280.pressure/100,16]]:
      [[byKind.bmp180.pressure/100,0],[byKind.bmp280.pressure/100,14],[byKind.am2320.temperature,28],[byKind.am2320.humidity,42]];
  };
  const observe=(e:any)=>{
    if(e.type!=='simulation'||stage>=stimuli.length)return;
    const start=stage*duration;
    for(const d of devices)for(const r of e.measurements??[]){
      if(r.component!==d.id)continue;const key=d.id+':'+r.sample;if(seen.has(key))continue;seen.add(key);
      if(e.sensors?.[d.id]?.powered)connected.add(d.id);
      if(r.timeMs>=start+s.sampleSettleMs&&r.timeMs<(stage+1)*duration){
        if(readings.length<256)readings.push(r);else maxRecords=true;
      }
    }
    const display=e.displays?.[panel.id];
    displayPath ||= !!(display?.powered&&e.i2cTrace?.some((t:any)=>t.address===panel.address&&t.operation==='W'&&t.result==='ACK'));
    const motor=servo&&e.servos?.[servo.id];
    if(motor?.powered&&typeof motor.angle==='number'&&typeof motor.freq==='number'&&Math.abs(motor.freq-50)<=s.servoFrequencyToleranceHz)servoPath=true;
    // Sampled windows include the settled end of every stage. Updating an OLED
    // is a byte stream, so partial redraws do not create a false stable screen.
    if(regulator&&e.timeMs>=start+s.responseDeadlineMs&&e.timeMs-lastScreenAt>=s.observationStepMs){
      lastScreenAt=e.timeMs;
      if(angles.length<256)angles.push({timeMs:e.timeMs,angle:motor?.angle??null,pulseUs:motor?.pulseUs??null,freq:motor?.freq??null,
        passed:!!motor?.powered&&Math.abs((motor.angle??Infinity)-stimuli[stage].angle)<=s.servoAngleToleranceDeg
          &&Math.abs((motor.freq??Infinity)-50)<=s.servoFrequencyToleranceHz});else maxRecords=true;
    }
    if(screenStable)return;
    const values=screenValues(),fresh=devices.every(d=>{const r=currentReading(d);return r&&e.timeMs-r.timeMs<=s.maximumIntervalMs;});
    const valid=values.length>0&&fresh&&display?.powered&&display.on&&display.height===64;
    const key=valid?JSON.stringify([display.bytes,values.map(([n]:number[])=>n.toFixed(1))]):'';
    if(key!==screenKey){screenKey=key;screenMatch=!!valid&&values.every(([n,y]:number[])=>containsEnvironmentNumber(display.bytes,n.toFixed(1),backend,y,backend==='avr'?14:8));}
    if(valid&&screenMatch){screenSamples++;screenStart??=e.timeMs;if(e.timeMs-screenStart!>=s.minimumStableMs)screenStable=true;}
    else screenStart=null;
  };
  function record(_index?:number,_last?:any,lines:any[]=[]){
    const start=stage*duration,end=start+duration;
    const sensorResults=devices.map((d,i)=>{
      const rows=readings.filter(r=>r.component===d.id&&matches(r,i));
      const fresh=rows.filter((r,j)=>j===0||r.sample!==rows[j-1].sample),times=fresh.map(r=>r.timeMs);
      const gaps=[...times,end].slice(1).map((t,j)=>t-times[j]);
      const timely=times.length>=s.minimumFreshReads&&times[0]-start<=s.responseDeadlineMs&&gaps.every(g=>g<=s.maximumIntervalMs);
      // Weather prints carry the sensor identity; the S3 example uses positional
      // fields, the other targets use T=/P=/RH=. Both are published formats.
      const printed=regulator||fresh.every(r=>lines.some(l=>{
        if(l.timeMs<r.timeMs-s.observationStepMs||l.timeMs-r.timeMs>s.maximumIntervalMs||!l.text.startsWith(d.kind.toUpperCase()+' '))return false;
        const fields=[...l.text.replace(/BMP180|BMP280|AM2320/g,'').matchAll(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)].map(m=>Number(m[0]));
        return fields.length>=2&&Math.abs(fields[0]-r.temperature)<=s.temperatureToleranceC
          &&Math.abs(fields[1]-(d.kind==='am2320'?r.humidity:r.pressure))<=(d.kind==='am2320'?s.humidityTolerance:s.pressureTolerancePa);
      }));
      return {kind:d.kind,component:d.id,expected:stimuli[stage].values[i],readings:fresh,firstDelayMs:times.length?times[0]-start:null,timely,printed,passed:timely&&printed};
    });
    const angleOK=!regulator||angles.length>0&&angles.every(a=>a.passed);
    const result={index:stage+1,expectedAngle:stimuli[stage].angle??null,sensors:sensorResults,screenStable,screenSamples,angleOK,
      angleRange:regulator?{minimum:Math.min(...angles.map(a=>a.angle??Infinity)),maximum:Math.max(...angles.map(a=>a.angle??-Infinity))}:null,
      sensorsPassed:!maxRecords&&sensorResults.every(r=>r.passed),passed:!maxRecords&&sensorResults.every(r=>r.passed)&&screenStable&&angleOK};
    stage++;readings=[];screenStart=null;screenStable=false;screenSamples=0;screenKey='';screenMatch=false;angles=[];return result;
  }
  return {stimuli,duration,inputs:(value:any)=>devices.map((d,i)=>({component:d.id,...value.values[i]})),observe,record,
    outcomes:(samples:any[],wiring:boolean)=>{
      const connection=wiring&&devices.every(d=>connected.has(d.id))&&displayPath&&(!regulator||servoPath);
      const complete=samples.length===stimuli.length&&!maxRecords;
      const basic=connection&&complete&&(regulator?samples.slice(0,s.basicStages).every(r=>r.passed):samples.every(r=>r.sensorsPassed));
      const advanced=basic&&(regulator?samples.slice(s.basicStages).every(r=>r.passed):samples.every(r=>r.passed));
      return [!!connection,!!basic,!!advanced];
    }};
}
