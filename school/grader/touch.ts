import type {SimulationConfig} from '../../src/circuit/compile';
import oracles from './display-oracles.json';

export const isTouchContract=(p:any)=>p.checkerVersion==='24J.1';
export function validTouchConfig(c:SimulationConfig,v:string){
  return c.spiDevices.filter(d=>d.kind==='ili9341').length===1
    &&c.spiDevices.filter(d=>d.kind==='xpt2046').length===Number(v.startsWith('touch'))
    &&c.spiDevices.length===(v.startsWith('touch')?2:1)
    &&c.i2cDevices.length===0&&c.leds.length===Number(v==='touchButton');
}
type Mask=Map<number,number>;
const font=oracles.tftFont as Record<string,number[]>;
function rect(m:Mask,x:number,y:number,w:number,h:number,color:number,outline=false){
  for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)
    if(i>=0&&i<240&&j>=0&&j<320&&(!outline||i===x||j===y||i===x+w-1||j===y+h-1))m.set(j*240+i,color);
}
function text(m:Mask,value:string,x:number,y:number,color:number,scale=1,background=0){
  rect(m,x,y,value.length*6*scale,7*scale,background);
  for(const ch of value.toUpperCase()){
    for(let col=0;col<5;col++)for(let row=0;row<7;row++)if((font[ch]??font['?'])[col]&(1<<row))
      rect(m,x+col*scale,y+row*scale,scale,scale,color);
    x+=6*scale;
  }
}
function line(m:Mask,x:number,y:number,x1:number,y1:number,color:number){
  const dx=Math.abs(x1-x),dy=-Math.abs(y1-y),sx=x<x1?1:-1,sy=y<y1?1:-1;let err=dx+dy;
  for(;;){m.set(y*240+x,color);if(x===x1&&y===y1)break;const e=2*err;
    if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
}
const matches=(pixels:number[]|undefined,m:Mask)=>{if(pixels?.length!==76800)return false;for(const [i,c]of m)if(pixels[i]!==c)return false;return true;};
export function panelPoint(x:number,y:number,r:number){return r===1?[239-y,x]:r===2?[239-x,319-y]:r===3?[y,319-x]:[x,y];}
export function touchPoint(x:number,y:number,r:number){return r===1?[y,239-x]:r===2?[239-x,319-y]:r===3?[319-y,x]:[x,y];}
export function rotationMask(r:number,touch=false){
  const w=r%2?320:240,h=r%2?240:320,logical=new Map<number,number>();
  const put=(x:number,y:number,color:number)=>logical.set(y*w+x,color);
  for(const [x,y]of [[0,0],[w-24,0],[0,h-24],[w-24,h-24]])for(let j=y;j<y+24;j++)for(let i=x;i<x+24;i++)put(i,j,0);
  for(let y=0;y<24;y++)for(let x=0;x<24;x++)put(x,y,0xf800);
  for(let x=0;x<w;x++){put(x,0,65535);put(x,h-1,65535);}
  for(let y=0;y<h;y++){put(0,y,65535);put(w-1,y,65535);}
  if(touch)for(let y=0;y<24;y++)for(let x=0;x<24;x++)put(x,y,0xf800);
  const value='ROT '+r,x=touch?35:36,y=touch?90:Math.floor(h/2),color=touch?0x07ff:0x07e0;
  for(let j=0;j<21;j++)for(let i=0;i<value.length*18;i++)put(x+i,y+j,0);
  for(let n=0;n<value.length;n++)for(let col=0;col<5;col++)for(let row=0;row<7;row++)if(font[value[n]][col]&(1<<row))
    for(let a=0;a<3;a++)for(let b=0;b<3;b++)put(x+n*18+col*3+a,y+row*3+b,color);
  return new Map([...logical].map(([i,c])=>{const [px,py]=panelPoint(i%w,Math.floor(i/w),r);return [py*240+px,c];}));
}
function targetMask(x:number,y:number){const m:Mask=new Map();
  rect(m,x-11,y-11,23,23,0);line(m,x-10,y,x+10,y,0xffe0);line(m,x,y-10,x,y+10,0xffe0);return m;}

// The checker supplies physical positions. The guest must obtain raw ADC
// channels through SPI, then perform its own calibration, hit test and drawing.
export function createTouchCheck(c:SimulationConfig,p:any,seed:string,backend:string){
  const v=p.taskKey.split('/')[1],s=p.contract.scenario,duration=s.stageDurationMs;
  const panel=c.spiDevices.find(d=>d.kind==='ili9341')!,touch=c.spiDevices.find(d=>d.kind==='xpt2046'),led=c.leds[0];
  const flip=parseInt(seed.slice(0,8),16)%2,calibration=v==='touchCalibration'?s.panelCalibrations[flip]:[200,3900,250,3850];
  if(touch)(touch as any).rawCalibration=calibration;
  const point=flip?[73,97]:[61,83],other=flip?[163,247]:[177,263];
  const up=(extra:any={})=>({down:false,x:0,y:0,pressure:50,...extra});
  const down=(xy:number[],extra:any={})=>({down:true,x:xy[0],y:xy[1],pressure:50,...extra});
  let stimuli:any[];
  if(v==='touchRaw')stimuli=[up(),down(point),down(other,{pressure:80}),up(),down(flip?[0,319]:[239,0],{pressure:25}),up()];
  else if(v==='touchCalibration')stimuli=[up({target:0}),down([20,20],{target:0}),down([20,20],{target:0}),up({target:1}),
    down([219,299],{target:1}),up({ready:true}),down(point,{point:true}),down(other,{point:true}),up({quiet:true}),
    down([237,317],{point:true}),up({quiet:true}),down([2,2],{point:true}),up({quiet:true})];
  else if(v==='touchButton')stimuli=[up({on:false}),down([120,160],{on:true}),down([170,170],{on:true}),down([220,80],{on:true}),up({on:true}),
    down([220,80],{on:true}),down([120,160],{on:true}),up({on:true}),down([32,122],{on:false}),up({on:false}),
    down([212,160],{on:false}),up({on:false}),down([208,198],{on:true}),up({on:true}),down([120,202],{on:true}),up({on:true})];
  else if(v==='touchRotation')stimuli=[up({rotation:0}),down(point,{rotation:1,reported:0}),down(other,{rotation:1}),up({rotation:1}),
    down(point,{rotation:2,reported:1}),up({rotation:2}),down(point,{rotation:3,reported:2}),up({rotation:3}),
    down(point,{rotation:0,reported:3}),up({rotation:0}),down(other,{rotation:1,reported:0}),up({rotation:1})];
  else stimuli=[{}];
  const main:Mask=new Map(),extra:Mask=new Map();
  rect(main,0,0,80,48,0xf800);rect(main,80,0,80,48,0x07e0);rect(main,160,0,80,48,0x001f);text(main,'ILI9341',25,70,65535,4);
  rect(extra,10,125,220,180,0);rect(extra,10,125,220,180,0xffe0,true);
  line(extra,11,126,228,303,0x07ff);line(extra,228,126,11,303,0xf81f);extra.set(319*240+239,0xf81f);
  const rotations=[0,1,2,3].map(r=>rotationMask(r,v==='touchRotation'));
  const buttonMasks=[false,true].map(on=>{const m:Mask=new Map(),color=on?0x07e0:0x001f;
    rect(m,30,120,180,80,color);text(m,on?'LED ON':'LED OFF',48,150,65535,3,color);return m;});
  const rawMask:Mask=new Map();text(rawMask,'SIROVI DODIR',12,30,65535,2);text(rawMask,'PRATI KONZOLU',12,70,backend==='micropython'?0x07ff:0xffff,2);
  const readyMask:Mask=new Map();text(readyMask,'KALIBRIRANO',20,30,0x07e0,2);
  const pointMasks=stimuli.map(q=>{const masks:Mask[]=[];if(!q.point)return masks;
    for(let x=q.x-1;x<=q.x+1;x++)for(let y=q.y-1;y<=q.y+1;y++){const mask:Mask=new Map();
      text(mask,'X '+x+' Y '+y,12,115,65535,2);rect(mask,x-2,y-2,5,5,0xffe0);masks.push(mask);}
    return masks;});
  let lastObserved=-Infinity;
  let stage=0,path=false,adcPath=false,ledPath=false,overflow=false,lastLabel=-1,spans:any[]=[],screenSince:number|null=null,screenStable=false;
  let pointSince:number|null=null,pointPixelStable=false;
  let lateCount=0,lateGood=true,channels=new Set<string>(),endpoints:boolean|null=null;
  const validPanel=(d:any)=>!!(d?.powered&&d.on&&!d.sleep&&d.backlight&&d.format===0x55&&d.width===240&&d.height===320);
  function label(e:any){
    const d=e.tfts?.[panel.id];if(!validPanel(d))return -1;
    if(v==='iliGraphics')return matches(d.pixels,main)?matches(d.pixels,extra)?1:0:-1;
    if(v==='iliRotation'||v==='touchRotation'){
      const r=[0x40,0x20,0x80,0xe0].indexOf(d.madctl&0xf7);return r>=0&&matches(d.pixels,rotations[r])?r:-1;
    }
    if(v==='touchRaw')return matches(d.pixels,rawMask)?0:-1;
    if(v==='touchButton')return matches(d.pixels,buttonMasks[Number(stimuli[stage].on)])?0:-1;
    if(stimuli[stage].target!==undefined)return matches(d.pixels,targetMask(...(stimuli[stage].target===0?[20,20]:[219,299]) as [number,number]))?0:-1;
    return matches(d.pixels,readyMask)?0:-1;
  }
  const expectedRaw=(q:any)=>({x:q.down?calibration[0]+Math.round(q.x*(calibration[1]-calibration[0])/239):0,
    y:q.down?calibration[2]+Math.round(q.y*(calibration[3]-calibration[2])/319):0,
    z1:q.down?Math.round(q.pressure*20):0,z2:q.down?4095-Math.round(q.pressure*15):4095});
  function observe(e:any){
    // S3 rotation redraws may emit a partial and a complete frame at the same
    // virtual time. Keep both so a clear cannot hide the completed picture.
    if(e.type!=='simulation'||stage>=stimuli.length||(v!=='iliRotation'&&e.timeMs-lastObserved<s.observationStepMs))return;lastObserved=e.timeMs;
    const d=e.tfts?.[panel.id],start=stage*duration;
    path ||= validPanel(d)&&d.written>0&&e.spiTrace?.some((t:any)=>t.device===panel.id);
    if(touch){
      const state=e.touches?.[touch.id],expected=expectedRaw(stimuli[stage]);
      for(const r of e.touchReadings??[])if(r.component===touch.id&&r.timeMs>=start&&r.timeMs<(stage+1)*duration
        &&r.value===expected[r.channel as keyof typeof expected])channels.add(r.channel);
      adcPath ||= !!(state?.powered&&state.conversions>0&&channels.size===4);
    }
    if(v==='touchCalibration'&&stimuli[stage].point){
      const correct=validPanel(d)&&pointMasks[stage].some(mask=>matches(d.pixels,mask));
      if(correct){pointSince??=e.timeMs;if(e.timeMs-pointSince!>=s.minimumStableMs)pointPixelStable=true;}
    }
    const n=label(e);
    if(n===lastLabel&&n>=0&&spans.length)spans.at(-1).end=e.timeMs;
    else if(n>=0){if(spans.length===256)overflow=true;else spans.push({label:n,start:e.timeMs,end:e.timeMs});}
    lastLabel=n;
    const expectedLabel=v==='touchRotation'?stimuli[stage].rotation:v==='iliGraphics'?1:0;
    if(n===expectedLabel){screenSince??=e.timeMs;if(e.timeMs-screenSince!>=s.minimumStableMs)screenStable=true;}else screenSince=null;
    if(v==='touchButton'){
      const current=e.leds?.[led.id]?.currentMa,good=typeof current==='number'&&(stimuli[stage].on?current>.5:current>=0&&current<.05);
      ledPath ||= typeof current==='number'&&current>.5;
      if(e.timeMs>=start+s.responseDeadlineMs&&e.timeMs<(stage+1)*duration){lateCount++;lateGood&&=good&&n===0;}
    }
  }
  const sequence=(pattern:number[])=>{
    const stable=spans.filter(f=>f.end-f.start>=s.minimumStableMs),used=stable.slice(0,pattern.length);
    return used.length===pattern.length&&used[0].start<=s.responseDeadlineMs
      &&used.every((f,i)=>f.label===pattern[i]&&(i===0||f.start-used[i-1].start>=s.intervalMinimumMs&&f.start-used[i-1].start<=s.intervalMaximumMs));
  };
  function record(_i?:number,_last?:any,lines:any[]=[]){
    const q=stimuli[stage],start=stage*duration,end=start+duration,settled=lines.filter(l=>l.timeMs>=start+s.settleMs&&l.timeMs<end);
    let basic=false,advanced=false,detail:any={};
    if(v==='iliGraphics'){basic=spans.some(f=>f.label>=0&&f.start<=s.responseDeadlineMs&&f.end-f.start>=s.minimumStableMs);advanced=basic&&screenStable;}
    else if(v==='iliRotation'){basic=sequence([0,1]);advanced=sequence([0,1,2,3,0]);}
    else if(v==='touchRaw'){
      const expected=expectedRaw(q),valid=settled.filter(l=>{
        const m=l.text.match(/^TOUCH RAW X=(\d+) Y=(\d+) Z1=(\d+) Z2=(\d+) IRQ=([01])\s*$/);
        return m&&[expected.x,expected.y,expected.z1,expected.z2,q.down?0:1].every((n,i)=>+m[i+1]===n);
      }),times=valid.map(l=>l.timeMs);
      basic=advanced=channels.size===4&&screenStable&&times.length>=2&&times[0]-start<=s.responseDeadlineMs
        &&[...times,end].slice(1).every((t,i)=>t-times[i]<=s.maximumIntervalMs);
      detail={expected,validLines:valid.length};
    }else if(v==='touchCalibration'){
      const ready=lines.flatMap(l=>{const m=l.text.match(/^CAL READY (-?\d+) (-?\d+) (-?\d+) (-?\d+)\s*$/);return m?[m.slice(1).map(Number)]:[];});
      if(ready.length)endpoints=ready.every((values:number[])=>values.every((n,i)=>Math.abs(n-calibration[i])<=s.calibrationTolerance));
      const pointLines=settled.flatMap(l=>{const m=l.text.match(/^CAL POINT (\d+) (\d+)\s*$/);return m?[{timeMs:l.timeMs,x:+m[1],y:+m[2]}]:[];});
      const pointOK=pointLines.length>=2&&pointLines.every(a=>Math.abs(a.x-q.x)<=s.coordinateTolerance&&Math.abs(a.y-q.y)<=s.coordinateTolerance);
      const a=pointLines.at(-1);
      basic=screenStable&&channels.size===4&&(q.target!==undefined?(!q.down||channels.size===4):q.ready?endpoints===true:q.point?pointOK:q.quiet?pointLines.length===0:false);
      advanced=basic&&(!q.point||pointPixelStable);
      detail={calibration,endpoints,pointLines:pointLines.length,lastPoint:a??null};
    }else if(v==='touchButton'){basic=advanced=lateCount>0&&lateGood&&screenStable&&channels.size===4;detail={expectedLED:q.on,lateCount,lateGood};}
    else{
      const reports=lines.flatMap(l=>{const m=l.text.match(/^TOUCH ROT=(\d+) X=(\d+) Y=(\d+)\s*$/);return m?[{rotation:+m[1],x:+m[2],y:+m[3]}]:[];});
      const expected=q.reported!==undefined?touchPoint(q.x,q.y,q.reported):null;
      const reportOK=expected?reports.length===1&&reports[0].rotation===q.reported&&Math.abs(reports[0].x-expected[0])<=s.coordinateTolerance
        &&Math.abs(reports[0].y-expected[1])<=s.coordinateTolerance:reports.length===0;
      basic=advanced=reportOK&&screenStable&&channels.size===4;detail={reports,expectedRotation:q.rotation};
    }
    const result={index:stage+1,input:q,basic,advanced,screenStable,channels:[...channels].sort(),spans:spans.filter(f=>f.end-f.start>=s.minimumStableMs),...detail};
    stage++;spans=[];lastLabel=-1;channels=new Set();screenSince=null;screenStable=false;lateCount=0;lateGood=true;pointSince=null;pointPixelStable=false;return result;
  }
  return {stimuli,duration,inputs:(q:any)=>touch?[{component:touch.id,touchDown:q.down,touchX:q.x,touchY:q.y,touchPressure:q.pressure}]:[],observe,record,
    outcomes:(samples:any[],wiring:boolean)=>{
      const connection=wiring&&path&&(!touch||adcPath)&&(v!=='touchButton'||ledPath),complete=samples.length===stimuli.length&&!overflow;
      const basic=connection&&complete&&samples.slice(0,s.basicStages).every(r=>r.basic);
      return [!!connection,!!basic,!!basic&&samples.every(r=>r.advanced)];
    }};
}
