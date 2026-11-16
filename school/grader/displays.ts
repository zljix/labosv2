import type {SimulationConfig} from '../../src/circuit/compile';
import oracles from './display-oracles.json';

export const isDisplayContract=(p:any)=>p.checkerVersion==='24H.1';
export function validDisplayConfig(c:SimulationConfig,v:string){
  const i2c=v==='oled32'?'ssd1306_32':v==='lcd1602'?'lcd1602':null;
  const tft=['tftGraphics','tftRotation','spiDashboard'].includes(v),sensor=['bmp280SPI','spiDashboard'].includes(v);
  return c.i2cDevices.length===(i2c?1:0)&&(!i2c||c.i2cDevices[0].kind===i2c)
    &&c.tmDisplays.length===(v.startsWith('tm')?1:0)
    &&c.spiDevices.length===Number(tft)+Number(sensor)
    &&c.spiDevices.filter(d=>d.kind==='st7735').length===Number(tft)
    &&c.spiDevices.filter(d=>d.kind==='bmp280_spi').length===Number(sensor);
}

type Pixels=Map<number,number>;
type Span={label:number;start:number;end:number};
const digits=[0x3f,6,0x5b,0x4f,0x66,0x6d,0x7d,7,0x7f,0x6f];
const font=oracles.tftFont as Record<string,number[]>;
const same=(a:number[],b:number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function rectangle(m:Pixels,x:number,y:number,w:number,h:number,color:number,outline=false){
  for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)
    if(!outline||px===x||py===y||px===x+w-1||py===y+h-1)m.set(py*128+px,color);
}
function text(m:Pixels,value:string,x:number,y:number,color:number,scale=1){
  rectangle(m,x,y,value.length*6*scale,7*scale,0);
  for(const char of value.toUpperCase()){
    const glyph=font[char]??font['?'];
    for(let col=0;col<5;col++)for(let row=0;row<7;row++)if(glyph[col]&(1<<row))
      rectangle(m,x+col*scale,y+row*scale,scale,scale,color);
    x+=6*scale;
  }
}
function line(m:Pixels,x:number,y:number,x1:number,y1:number,color:number){
  // Integer lattice definition of the published line, independent of SPI RAM.
  const dx=Math.abs(x1-x),dy=-Math.abs(y1-y),sx=x<x1?1:-1,sy=y<y1?1:-1;let err=dx+dy;
  for(;;){m.set(y*128+x,color);if(x===x1&&y===y1)break;const e=2*err;
    if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
}
const matches=(pixels:number[]|undefined,m:Pixels)=>!!pixels&&[...m].every(([i,c])=>pixels[i]===c);
function rotationMask(r:number){
  const logical:Pixels=new Map();
  for(const [x,y]of [[0,0],[110,0],[0,110],[110,110]])rectangle(logical,x,y,18,18,0);
  rectangle(logical,0,0,18,18,0xf800);rectangle(logical,0,0,128,128,0xffff,true);
  text(logical,'ROT '+r,30,48,0x07e0,2);
  return new Map([...logical].map(([i,c])=>{
    const u=i%128,v=Math.floor(i/128),[x,y]=r===1?[127-v,u]:r===2?[127-u,127-v]:r===3?[v,127-u]:[u,v];
    return [y*128+x,c];
  }));
}
export function oledRegionMatches(actual:number[],expected:number[],regions:number[][]){
  return regions.every(([x,y,w,h])=>{
    for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
      const index=Math.floor(py/8)*128+px,bit=1<<(py%8);
      if((actual[index]&bit)!==(expected[index]&bit))return false;
    }return true;
  });
}

// Only received controller memory, bus acknowledgements and completed sensor
// reads enter the result. Neither stdout nor a guest framebuffer can draw here.
export function createDisplayCheck(c:SimulationConfig,profile:any,seed:string,backend:string){
  const v=profile.taskKey.split('/')[1],s=profile.contract.scenario;
  const panel=c.i2cDevices[0],tm=c.tmDisplays[0],tft=c.spiDevices.find(d=>d.kind==='st7735'),sensor=c.spiDevices.find(d=>d.kind==='bmp280_spi');
  const env=s.environments,flip=parseInt(seed.slice(0,8),16)%2;
  const stimuli=sensor?[env[flip],env[1-flip],env[flip]]:[{}];
  const main:Pixels=new Map(),advanced:Pixels=new Map();
  if(v==='tftGraphics'){
    rectangle(main,0,0,42,26,0xf800);rectangle(main,42,0,43,26,0x07e0);rectangle(main,85,0,43,26,31);
    text(main,'SPI TFT',10,38,0xffff,2);
    rectangle(advanced,4,65,120,58,0);rectangle(advanced,4,65,120,58,0xffe0,true);
    line(advanced,5,66,122,121,0x07ff);line(advanced,122,66,5,121,0xf81f);
  }
  const rotations=[0,1,2,3].map(rotationMask);
  const target=backend==='avr'?'uno':backend,oled=(oracles.oled as any)[target];
  const staticRegions=backend==='micropython'?[[0,0,104,8],[0,8,120,8],[0,24,56,8]]:
    backend==='avr'?[[0,0,78,9],[0,21,72,10]]:[[0,0,84,12],[100,0,28,32]];
  const counterRegion=backend==='micropython'?[[0,16,72,8]]:backend==='avr'?[[0,9,60,10]]:[[0,14,48,11]];
  let path=false,stage=0,overflow=false,lastTime=0,spans:Span[]=[],lastLabel=-1;
  let content=false,geometry=false,contentAt:number|null=null,geometryAt:number|null=null;
  let lastMeasurement:any=null,currentReadings=new Map<number,any>();
  let displayMask:Pixels=new Map();
  const prepareMask=()=>{
    displayMask=new Map();if(v!=='spiDashboard')return;
    const e=stimuli[stage] as any;
    text(displayMask,'SPI STANICA',7,10,0x07ff);
    rectangle(displayMask,8,40,84,14,0);rectangle(displayMask,8,74,60,7,0);
    text(displayMask,e.temperature.toFixed(1)+' C',8,40,0xffe0,2);
    text(displayMask,(e.pressure/100).toFixed(1)+' HPA',8,74,0x07e0);
  };prepareMask();
  const label=(e:any)=>{
    if(panel){
      const d=e.displays?.[panel.id];if(!d?.powered||!d.on)return -1;
      if(v==='oled32'){
        if(d.height!==32||d.bytes.length!==512||!oledRegionMatches(d.bytes,oled['0'],staticRegions))return -1;
        return [0,1,2].find(n=>oledRegionMatches(d.bytes,oled[String(n)],counterRegion))??-1;
      }
      if(!d.backlight||!d.lines?.[0]?.startsWith(backend==='s3-cpp'?'S3 C++ LAB ':'Pozdrav, URS! '))return -1;
      const code=d.cells?.[backend==='s3-cpp'?11:14];if(!(code>=0&&code<16)||!same(d.cgram?.slice((code%8)*8,(code%8+1)*8)??[],[0,10,10,0,17,14,0,0]))return -1;
      return [0,1,2].find(n=>d.lines[1]===((backend==='s3-cpp'?'COUNT ':'Brojac: ')+n).padEnd(16))??-1;
    }
    if(tm){
      const d=e.tmDisplays?.[tm.id];if(!d?.powered||!d.on||d.brightness!==7||d.errors)return -1;
      const bytes=d.bytes.slice(0,4);
      if(v==='tmSegments')return [0,1,2,3,4,5,6,7].find(n=>bytes.every((b:number)=>b===(1<<n)))??-1;
      for(let n=0;n<6;n++){
        const value=1234+Math.floor(n/2),expected=String(value).split('').map(x=>digits[Number(x)]);
        if(n%2===0)expected[1]|=128;if(same(bytes,expected))return n;
      }return -1;
    }
    const d=tft&&e.tfts?.[tft.id];if(!d?.powered||!d.on||d.sleep||!d.backlight||d.format!==5)return -1;
    if(v==='tftRotation'){
      const r=[0xc8,0xa8,8,0x68].indexOf(d.madctl);
      return r>=0&&matches(d.pixels,rotations[r])?r:-1;
    }
    if(v==='tftGraphics')return matches(d.pixels,main)?matches(d.pixels,advanced)?1:0:-1;
    return lastMeasurement&&lastMeasurement.timeMs>=stage*s.stageDurationMs+s.sampleSettleMs
      &&e.timeMs-lastMeasurement.timeMs<=s.sampleMaximumIntervalMs&&matches(d.pixels,displayMask)?0:-1;
  };
  const observe=(e:any)=>{
    if(e.type!=='simulation')return;lastTime=Math.max(lastTime,e.timeMs);
    const panelPath=!panel||e.displays?.[panel.id]?.powered&&e.i2cTrace?.some((t:any)=>t.address===panel.address&&t.operation==='W'&&t.result==='ACK');
    const tmPath=!tm||e.tmDisplays?.[tm.id]?.powered&&e.tmDisplays[tm.id].received>0&&e.tmDisplays[tm.id].errors===0
      &&e.tmDisplays[tm.id].trace.some((t:any)=>t.operation==='stop');
    const spiPath=c.spiDevices.every(d=>{
      const state=d.kind==='st7735'?e.tfts?.[d.id]:e.sensors?.[d.id];
      return state?.powered&&(d.kind!=='st7735'||state.backlight)&&e.spiTrace?.some((t:any)=>t.device===d.id&&(d.kind!=='bmp280_spi'||t.result.startsWith('RX 0x')&&t.result!=='RX 0xff'));
    });
    path ||= !!(panelPath&&tmPath&&spiPath);
    if(sensor){
      const expected=stimuli[stage] as any;
      for(const m of e.measurements??[])if(m.component===sensor.id&&m.timeMs>=stage*s.stageDurationMs+s.sampleSettleMs
        &&m.timeMs<(stage+1)*s.stageDurationMs&&Math.abs(m.temperature-expected.temperature)<=s.temperatureToleranceC
        &&Math.abs(m.pressure-expected.pressure)<=s.pressureTolerancePa){
        currentReadings.set(m.sample,m);lastMeasurement=m;
      }
      if(currentReadings.size>256)overflow=true;
    }
    if(v==='bmp280SPI')return;
    const n=label(e);
    if(n===lastLabel&&spans.length&&n>=0)spans.at(-1)!.end=e.timeMs;
    else if(n>=0){if(spans.length>=256)overflow=true;else spans.push({label:n,start:e.timeMs,end:e.timeMs});}
    lastLabel=n;
    if(v==='tftGraphics'){
      if(n>=0){contentAt??=e.timeMs;if(e.timeMs-contentAt!>=s.minimumStableMs)content=true;}else contentAt=null;
      if(n===1){geometryAt??=e.timeMs;if(e.timeMs-geometryAt!>=s.minimumStableMs)geometry=true;}else geometryAt=null;
    }
  };
  const sequence=(pattern:number[])=>{
    const stable=spans.filter(f=>f.end-f.start>=s.minimumStableMs),used=stable.slice(0,pattern.length);
    return !overflow&&used.length===pattern.length&&used[0].start<=s.startupAllowanceMs
      &&used.every((f,i)=>f.label===pattern[i]&&(i===0||f.start-used[i-1].start>=s.intervalMinimumMs&&f.start-used[i-1].start<=s.intervalMaximumMs));
  };
  function record(_index?:number,_last?:any,lines:any[]=[]){
    let basic=false,extra=false;
    const fresh=[...currentReadings.values()].sort((a,b)=>a.timeMs-b.timeMs);
    const printed=fresh.filter(m=>lines.some(l=>l.timeMs>=m.timeMs&&l.timeMs-m.timeMs<=s.sampleMaximumIntervalMs
      &&[...l.text.matchAll(/\bT\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:°?C)?\s+P\s*=\s*(\d+(?:\.\d+)?)/g)]
        .some((x:any)=>Math.abs(Number(x[1])-m.temperature)<=s.temperatureToleranceC&&Math.abs(Number(x[2])-m.pressure)<=s.pressureTolerancePa)));
    if(sensor){
      const times=(v==='bmp280SPI'?printed:fresh).map(m=>m.timeMs),bounds=[stage*s.stageDurationMs,...times,(stage+1)*s.stageDurationMs];
      const sampling=times.length>=2&&bounds.slice(1).every((t,i)=>t-bounds[i]<=s.sampleMaximumIntervalMs);
      const display=v==='bmp280SPI'||spans.some(f=>f.label===0&&f.end-f.start>=s.minimumStableMs);
      basic=extra=sampling&&display&&!overflow;
    }else if(v==='tftGraphics'){basic=content&&spans.some(f=>f.start<=s.startupAllowanceMs);extra=basic&&geometry;}
    else if(v==='tftRotation'){basic=sequence([0,1]);extra=sequence([0,1,2,3,0]);}
    else if(v==='tmSegments'){basic=sequence([0,1,2,3,4,5,6,7]);extra=sequence([0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7]);}
    else if(v==='tmClock'){basic=sequence([0,1]);extra=sequence([0,1,2,3,4,5]);}
    else{basic=sequence([0]);extra=sequence([0,1,2]);}
    const result={index:stage+1,variant:v,...stimuli[stage],basic,advanced:extra,connected:path,overflow,
      spans:spans.filter(f=>f.end-f.start>=s.minimumStableMs),readings:fresh.map(m=>({sample:m.sample,timeMs:m.timeMs,temperature:m.temperature,pressure:m.pressure})),printedSamples:printed.length};
    stage++;spans=[];lastLabel=-1;currentReadings=new Map();lastMeasurement=null;
    if(stage<stimuli.length)prepareMask();return result;
  }
  return {stimuli,duration:s.stageDurationMs,inputs:(value:any)=>sensor?[{component:sensor.id,...value}]:[],observe,record,
    outcomes:(samples:any[],wiring:boolean)=>{
      const connection=wiring&&path,basic=connection&&(sensor?samples[0]?.basic&&samples[1]?.basic:samples[0]?.basic);
      return [connection,!!basic,!!basic&&(sensor?samples[2]?.advanced===true:samples[0]?.advanced===true)];
    }};
}
