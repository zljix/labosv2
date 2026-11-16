import type {SimulationConfig} from '../../src/circuit/compile';
import {initialRTC,rtcCalendar} from '../../public/rtc-ds1302.mjs';
import {sdReadFile} from '../../public/sd-card.mjs';

export const isStorageContract=(p:any)=>p.checkerVersion==='24K.1';
export function validStorageConfig(c:SimulationConfig,v:string){
  return c.rtcDevices.length===Number(v.startsWith('rtc')||v==='sdLogger')
    &&c.spiDevices.length===Number(v.startsWith('sd'))
    &&c.spiDevices.every(d=>d.kind==='microSD')
    &&c.tmDisplays.length===Number(v==='rtcClock')
    &&c.i2cDevices.length===0&&c.leds.length===0;
}
const segments=[0x3f,6,0x5b,0x4f,0x66,0x6d,0x7d,7,0x7f,0x6f];
const phrase='Pozdrav iz FAT16 preko SPI!\n';
const iso=(r:number[])=>{const d=rtcCalendar(r);return d.valid?new Date(d.epoch).toISOString().slice(0,19):null;};
function readFile(state:any,name:string){try{return new TextDecoder().decode(sdReadFile(state,name));}catch{return null;}}

// Only the isolated execution copy receives the published test clock/RAM.
// The student's saved project and the saved SD sectors remain untouched.
export function createStorageCheck(c:SimulationConfig,p:any,seed:string){
  const v=p.taskKey.split('/')[1],s=p.contract.scenario,rtc=c.rtcDevices[0],sd=c.spiDevices[0],tm=c.tmDisplays[0];
  const choice=parseInt(seed.slice(0,8),16)%2,initial=s.initialCalendars[choice],ram=s.initialRAM[choice];
  if(rtc){rtc.rtcState=initialRTC(initial);rtc.rtcState!.ram[0]=ram;rtc.rtcBattery=true;rtc.rtcMainPower=true;}
  const originalFile=sd?readFile(sd.sdState,'LAB.TXT')??'':'';
  const originalCSV=sd?readFile(sd.sdState,'LOG.CSV')??'':'';
  const finite=['sdInspect','sdFiles'].includes(v),duration=s.stageDurationMs;
  const stimuli:{power?:boolean}[]=v==='rtcRead'||v==='rtcClock'?[{power:true},{power:false},{power:true}]:[{}];
  let stage=0,last:any,pathRTC=false,pathSD=false,pathTM=false,screenMatches=0,screenWrong=0,haltedSince:number|null=null,haltedMs=0;
  const rtcTransfers:any[]=[],sdTransfers:any[]=[],seenRTC=new Set<string>(),seenSD=new Set<string>();
  function collect(source:any[],seen:Set<string>,out:any[]){
    for(const t of source??[]){const key=JSON.stringify(t);if(!seen.has(key)){seen.add(key);if(out.length<512)out.push(t);}}
  }
  function observe(e:any){
    if(e.type!=='simulation')return;last=e;
    const r=e.rtcDevices?.[rtc?.id],d=e.sdCards?.[sd?.id],t=e.tmDisplays?.[tm?.id];
    if(r){
      collect(r.transfers,seenRTC,rtcTransfers);
      pathRTC ||= r.mainPower&&r.transfers?.some((a:any)=>a.operation==='read'&&a.command===0xbf&&a.bytes.length===8&&rtcCalendar(a.bytes).valid);
      if(r.halted){haltedSince??=e.timeMs;haltedMs=Math.max(haltedMs,e.timeMs-haltedSince!);}else haltedSince=null;
    }
    if(d){collect(d.transfers,seenSD,sdTransfers);pathSD ||= d.powered&&d.initialized&&d.bootReads>0;}
    if(t){
      pathTM ||= t.powered&&t.on&&t.received>0;
      if(e.timeMs>=stage*duration+s.settleMs&&t.powered&&t.on){
        let good=false;
        if(stimuli[stage]?.power===false)good=t.bytes.slice(0,4).every((b:number)=>b===0x40);
        else if(r?.iso){const values=r.iso.slice(11,16).replace(':','').split('').map(Number),expected=values.map((n:number)=>segments[n]);
          // Sampling may fall between a new second and the next 500 ms poll.
          // Require actual alternating colon states separately in record().
          good=t.bytes.slice(0,4).every((b:number,i:number)=>(b&127)===expected[i]);}
        if(good)screenMatches++;else screenWrong++;
      }
    }
  }
  const reads=()=>rtcTransfers.filter(t=>t.operation==='read'&&t.command===0xbf&&t.bytes.length===8).map(t=>({timeMs:t.timeUs/1000,iso:iso(t.bytes),day:t.bytes[5]}));
  const writes=()=>rtcTransfers.filter(t=>t.operation==='write');
  function clockLines(lines:any[],display=false){
    const rs=reads();return lines.flatMap(l=>{
      const m=l.text.match(display?/^RTC DISPLAY=(\d+):(\d+):(\d+)\s*$/:/^RTC (\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+) DAY=(\d+)\s*$/);
      if(!m)return [];
      const value=display?m.slice(1).map(Number):m.slice(1,7).map(Number),day=display?null:+m[7];
      const matching=rs.find(r=>r.iso&&l.timeMs>=r.timeMs-20&&l.timeMs-r.timeMs<=s.maximumIntervalMs&&
        (display?r.iso.slice(11).split(':').map(Number):r.iso.replace('T','-').replaceAll(':','-').split('-').map(Number)).every((n:number,i:number)=>n===value[i])&&(day===null||day===r.day));
      return [{timeMs:l.timeMs,iso:matching?.iso??null,valid:!!matching}];
    });
  }
  function record(_index?:number,_frame?:any,allLines:any[]=[]){
    const start=stage*duration,end=start+duration,lines=allLines.filter(l=>l.timeMs>=start&&l.timeMs<end),r=last?.rtcDevices?.[rtc?.id],d=last?.sdCards?.[sd?.id];
    const stageReads=reads().filter(a=>a.timeMs>=start&&a.timeMs<end);
    let basic=false,advanced=false;const detail:any={};
    if(v==='rtcRead'||v==='rtcClock'){
      const parsed=clockLines(lines),display=clockLines(lines,true),observed=parsed.length?parsed:display;
      const errors=lines.filter(l=>/^RTC ERROR/.test(l.text)).length;
      if(stimuli[stage].power===false)basic=advanced=errors>=1&&observed.length===0&&r?.retained===true&&!r?.mainPower;
      else{
        const good=observed.filter(l=>l.valid),times=good.map(l=>l.timeMs);
        basic=advanced=good.length>=2&&observed.every(l=>l.valid)&&new Set(good.map(l=>l.iso)).size>=2
          &&stageReads.length>=2&&times[0]-start<=s.maximumIntervalMs&&end-times.at(-1)!<=s.maximumIntervalMs
          &&times.slice(1).every((t,i)=>t-times[i]<=s.maximumIntervalMs)&&writes().length===0;
      }
      if(v==='rtcClock'){
        const colon=new Set(stageReads.map(a=>Number(a.iso?.slice(-2))%2));
        const t=last?.tmDisplays?.[tm.id];
        // Console cannot create segments; both RTC seconds' colon states must
        // have reached the TM1637 controller in the current stage.
        const receivedColon=new Set((t?.trace??[]).filter((a:any)=>a.operation==='byte'&&a.timeUs>=start*1000&&a.value>=128).map((a:any)=>a.value));
        const colonOK=stimuli[stage].power===false||colon.size===2&&colonStates.size===2;
        basic=advanced=basic&&pathTM&&screenMatches>=2&&screenWrong<=Math.max(2,screenMatches*.25)&&colonOK;
        detail.colonStates=[...colonStates];detail.receivedControlBytes=receivedColon.size;
      }
      detail.validLines=observed.filter(l=>l.valid).length;detail.errors=errors;
    }else if(v==='rtcMemory'){
      const ws=writes(),protectedWrite=ws.find(a=>a.command===0xc0&&!a.accepted&&a.bytes[0]===99);
      const increment=ws.some(a=>a.command===0xc0&&a.accepted&&a.bytes[0]===(ram+1)%256);
      const report=lines.some(l=>l.text.trim()===`RTC RAM=${(ram+1)%256} WP=1`);
      basic=haltedMs>=s.minimumHaltMs&&increment&&!!protectedWrite&&report&&r?.state.ram[0]===(ram+1)%256;
      const good=clockLines(lines).filter(l=>l.valid);
      advanced=basic&&r?.halted===false&&r?.writeProtected===false&&new Set(good.map(l=>l.iso)).size>=3;
      detail.haltedMs=haltedMs;detail.expectedRAM=(ram+1)%256;detail.protectedWrite=!!protectedWrite;
    }else if(v==='sdInspect'){
      const boot=sdTransfers.find(t=>t.operation==='read'&&t.lba===0&&t.bytes.length===512);
      basic=!!boot&&boot.bytes[510]===0x55&&boot.bytes[511]===0xaa&&lines.some(l=>/^SD SECTORS=16384 SIGNATURE=55AA\s*$/.test(l.text));
      const mountRead=sdTransfers.filter(t=>t.operation==='read'&&t.lba===0).length>=2||sdTransfers.some(t=>t.operation==='read'&&t.lba>=129&&t.lba<=132);
      advanced=basic&&d?.volumeError===''&&mountRead&&lines.some(l=>/^SD (FILES|FAT16 MOUNT=1)/.test(l.text));
    }else if(v==='sdFiles'){
      const content=readFile(d?.state,'LAB.TXT'),write=sdTransfers.some(t=>t.operation==='write'&&t.lba>=133);
      basic=write&&content===originalFile+phrase;
      const count=new TextEncoder().encode(originalFile+phrase).length;
      const writtenAt=sdTransfers.filter(t=>t.operation==='write'&&t.lba>=133).at(-1)?.timeUs??Infinity;
      advanced=basic&&sdTransfers.some(t=>t.operation==='read'&&t.lba>=133&&t.timeUs>writtenAt)
        &&lines.some(l=>l.text.trim()===`SD FILE BYTES=${count}`)&&lines.map(l=>l.text).join('\n').includes('Pozdrav iz FAT16 preko SPI!');
      detail.expectedBytes=count;detail.actualBytes=d?.files.find((f:any)=>f.name==='LAB.TXT')?.size??null;
    }else{
      const content=readFile(d?.state,'LOG.CSV'),prefix=originalCSV||'uzorak,vrijeme\n';
      const appended=content?.startsWith(prefix)?content.slice(prefix.length):null;
      const rows=appended?.trimEnd().split('\n')??[];
      const actual=reads();let previous=-Infinity;
      const valid=rows.map((row:string,i:number)=>{const m=row.match(/^(\d+),(20\d\d-\d\d-\d\d) (\d\d:\d\d:\d\d)$/);if(!m||+m[1]!==i)return false;
        const time=m[2]+'T'+m[3],epoch=Date.parse(time+'Z'),matches=actual.some(a=>a.iso===time);const increasing=epoch>previous;previous=epoch;return matches&&increasing;});
      basic=sdTransfers.some(t=>t.operation==='write'&&t.lba>=133)&&valid.length>=2&&valid.slice(0,2).every(Boolean);
      advanced=basic&&valid.length>=4&&valid.every(Boolean)&&r?.valid===true;
      detail.csvRows=rows.length;detail.validRows=valid.filter(Boolean).length;detail.initialCalendar=initial;
    }
    const sample={index:stage+1,basic,advanced,rtcReads:stageReads.length,sdReads:sdTransfers.filter(t=>t.operation==='read').length,
      sdWrites:sdTransfers.filter(t=>t.operation==='write').length,screenMatches,screenWrong,...detail};
    stage++;screenMatches=screenWrong=0;colonStates.clear();return sample;
  }
  const colonStates=new Set<number>();
  const observeFrame=(e:any)=>{
    observe(e);if(e.type==='simulation'&&tm){const t=e.tmDisplays?.[tm.id],r=e.rtcDevices?.[rtc.id];
      if(t?.powered&&t.on&&r?.iso&&e.timeMs>=stage*duration+s.settleMs
        &&Number(t.colon)===Number(r.iso.slice(-2))%2)colonStates.add(Number(t.colon));}
  };
  return {stimuli,duration,finite,inputs:(q:any)=>rtc&&typeof q.power==='boolean'?[{component:rtc.id,rtcMainPower:q.power}]:[],observe:observeFrame,record,
    outcomes:(samples:any[],wiring:boolean)=>{
      const connection=wiring&&(!rtc||pathRTC)&&(!sd||pathSD)&&(!tm||pathTM);
      const basic=connection&&samples[0]?.basic===true;
      const advanced=basic&&samples.length===stimuli.length&&samples.every(a=>a.advanced===true);
      return [connection,basic,advanced];
    }};
}
