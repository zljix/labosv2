import type {SimulationConfig} from '../../src/circuit/compile';

export const isOpticalContract=(p:any)=>p.checkerVersion==='24L.1';
export const validOpticalConfig=(c:SimulationConfig)=>c.i2cDevices.length===1&&c.i2cDevices[0].kind==='max30102'
  &&c.leds.length===0&&c.spiDevices.length===0&&c.rtcDevices.length===0;

type Line={timeMs:number;text:string};
// Expected words come only from complete FIFO reads in the isolated run.
// The seeded source changes future samples, never an already queued sample.
export function createOpticalCheck(c:SimulationConfig,p:any,seed:string){
  const v=p.taskKey.split('/')[1],s=p.contract.scenario,d=c.i2cDevices[0];
  let state=parseInt(seed.slice(0,8),16)||1;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
  const rates=s.frequencyBands.map(([lo,hi]:number[])=>lo+Math.floor(random()*(hi-lo+1)));
  const choice=parseInt(seed.slice(0,8),16)%2;
  const stimulus=(i:number,contact=true)=>({opticalRate:rates[i%rates.length],opticalAmplitude:choice?5100:7300,
    opticalOffset:(choice?91000:67000)+i*1700,opticalNoise:0,opticalContact:contact});
  const stimuli=v==='opticalRaw'?[stimulus(0),stimulus(1,false),stimulus(2)]:
    v==='opticalFrequency'?rates.map((_:number,i:number)=>stimulus(i)):[stimulus(0)];
  const duration=s.stageDurationMs,finite=v==='opticalRegisters',transfers:any[]=[],readings:any[]=[];
  const seenTransfers=new Set<number>(),seenReadings=new Set<string>();
  let stage=0,last:any,configured=false,shutdownSince:number|null=null,shutdownGenerated=0,shutdownMs=0;
  const observe=(e:any)=>{
    if(e.type!=='simulation')return;
    const f=e.optical?.[d.id];if(!f)return;last=f;
    configured ||= f.powered&&f.mode===3&&f.effectiveRate===100&&f.resolution===18&&f.ledRed===31&&f.ledIR===31;
    for(const t of f.transfers??[]){
      if(seenTransfers.has(t.sequence))continue;seenTransfers.add(t.sequence);
      if(['opticalRaw','opticalFrequency'].includes(v)&&t.operation==='read'&&![7,255].includes(t.register))continue;
      if(transfers.length<24000)transfers.push(t);
    }
    for(const r of f.readings??[]){
      const key=r.transaction+':'+r.index+':'+r.timeMs+':'+r.readTimeMs;
      if(seenReadings.has(key))continue;
      if(!fifoRead(r))continue;
      seenReadings.add(key);
      if(readings.length<8192)readings.push({...r,ordinal:readings.length+1});
    }
    if(f.powered&&f.shutdown&&f.count===0){
      if(shutdownSince===null||f.generated!==shutdownGenerated){shutdownSince=e.timeMs;shutdownGenerated=f.generated;}
      shutdownMs=Math.max(shutdownMs,e.timeMs-shutdownSince!);
    }else shutdownSince=null;
  };
  const bytesAt=(reg:number,value:number,time:number,window=350)=>transfers.some(t=>t.operation==='read'&&t.register<=reg
    &&reg<t.register+t.length&&t.bytes[reg-t.register]===value&&t.timeMs<=time+s.stepToleranceMs&&time-t.timeMs<=window);
  const fifoRead=(r:any)=>transfers.some(t=>t.transaction===r.transaction&&t.operation==='read'&&t.register===7&&t.length>=6
    &&t.timeMs>=r.readTimeMs-1&&t.timeMs-r.readTimeMs<=100);
  function record(_index?:number,_frame?:any,lines:Line[]=[]){
    const start=stage*duration,end=start+duration,current=lines.filter(l=>l.timeMs>=start&&l.timeMs<end);
    const fresh=readings.filter(r=>r.readTimeMs>=start&&r.readTimeMs<end);
    let basic=false,advanced=false;const detail:any={};
    if(v==='opticalRegisters'){
      const id=current.some(l=>/^MAX ID=0x15\s*$/i.test(l.text)&&bytesAt(255,21,l.timeMs));
      const config=current.some(l=>/^MAX MODE=3 CONFIG=0x27\s*$/i.test(l.text)&&bytesAt(9,3,l.timeMs)&&bytesAt(10,39,l.timeMs));
      const reset=transfers.some(t=>t.operation==='write'&&t.register===9&&(t.bytes[0]&64)!==0);
      basic=id&&config&&reset&&configured;
      const shutdown=transfers.find(t=>t.operation==='write'&&t.register===9&&(t.bytes[0]&128)!==0);
      advanced=basic&&shutdownMs>=s.minimumShutdownMs&&last?.shutdown===true&&last?.count===0
        &&current.some(l=>/^MAX SHUTDOWN FIFO=0\s*$/.test(l.text)&&transfers.some(t=>t.operation==='read'
          &&t.register===4&&t.length>=3&&t.count===0&&t.shutdown&&shutdown&&t.timeMs-shutdown.timeMs>=s.minimumShutdownMs
          &&t.timeMs<=l.timeMs+s.stepToleranceMs&&l.timeMs-t.timeMs<=350));
      detail.shutdownMs=shutdownMs;detail.identityReported=id;detail.configReported=config;
    }else if(v==='opticalRaw'){
      const reports=current.flatMap(l=>{const m=l.text.match(/^RAW N=(\d+) RED=(\d+) IR=(\d+)\s*$/);return m?[{...l,n:+m[1],red:+m[2],ir:+m[3]}]:[];});
      const used=new Set<number>();
      const valid=reports.map(l=>{
        const r=readings.find(r=>r.ordinal===l.n&&r.red===l.red&&r.ir===l.ir&&r.readTimeMs<=l.timeMs+s.stepToleranceMs
          &&l.timeMs-r.readTimeMs<=s.maximumPrintDelayMs&&fifoRead(r));
        const good=!!r&&l.n%10===0&&!used.has(r.ordinal);if(r)used.add(r.ordinal);return good;
      });
      const times=reports.map(l=>l.timeMs),gaps=[start+s.settleMs,...times.filter(t=>t>=start+s.settleMs),end];
      basic=advanced=configured&&reports.length>=s.minimumReports&&valid.every(Boolean)
        &&gaps.slice(1).every((t,i)=>t-gaps[i]<=s.maximumReportIntervalMs)
        &&fresh.length>=s.minimumReads&&new Set(fresh.map(r=>r.timeMs)).size===fresh.length;
      detail.reports=reports.length;detail.validReports=valid.filter(Boolean).length;
      detail.contact=stimuli[stage].opticalContact;
    }else if(v==='opticalFrequency'){
      const reports=current.flatMap(l=>{const m=l.text.match(/^FREQ=(\d+(?:\.\d+)?) bpm \(sintetski\)\s*$/);return m?[{...l,value:+m[1]}]:[];})
        .filter(l=>l.timeMs>=start+s.settleMs);
      const tolerance=Math.max(s.frequencyToleranceBpm,rates[stage]*s.frequencyToleranceRatio);
      const valid=reports.map(l=>Math.abs(l.value-rates[stage])<=tolerance&&fresh.some(r=>r.readTimeMs<=l.timeMs+s.stepToleranceMs
        &&l.timeMs-r.readTimeMs<=s.maximumPrintDelayMs&&fifoRead(r)));
      basic=advanced=configured&&reports.length>=s.minimumReports&&valid.every(Boolean)&&fresh.length>=s.minimumReads
        &&new Set(fresh.map(r=>r.timeMs)).size===fresh.length&&last?.dropped===0;
      detail.expectedFrequency=rates[stage];detail.toleranceBpm=tolerance;detail.estimates=reports.map(l=>l.value);detail.validReports=valid.filter(Boolean).length;
    }else{
      const reports=current.flatMap(l=>{const m=l.text.match(/^FIFO COUNT=(\d+) OVF=(\d+)\s*$/);return m?[{...l,count:+m[1],overflow:+m[2]}]:[];});
      const valid=reports.filter(l=>l.count===32&&l.overflow>0&&bytesAt(5,l.overflow,l.timeMs)
        &&transfers.some(t=>t.operation==='read'&&t.register<=4&&t.register+t.length>=7&&t.count===32
          &&t.bytes[4-t.register]===t.bytes[6-t.register]&&t.timeMs<=l.timeMs+s.stepToleranceMs&&l.timeMs-t.timeMs<=350));
      const markers=current.filter(l=>/^FIFO RECOVERED\s*$/.test(l.text));
      let previousClear=-Infinity;
      const cycles=valid.map((l,i)=>{
        const next=valid[i+1]?.timeMs??end,marker=markers.find(m=>m.timeMs>=l.timeMs-s.stepToleranceMs&&m.timeMs<next);
        if(!marker)return {timeMs:l.timeMs,drained:0,clear:false,fresh:false};
        const drained=readings.filter(r=>fifoRead(r)&&r.readTimeMs>=l.timeMs-100&&r.readTimeMs<=marker.timeMs+s.stepToleranceMs&&r.timeMs<=l.timeMs+s.stepToleranceMs);
        const clear=transfers.find(t=>t.operation==='write'&&t.register===4&&t.length>=3&&t.bytes.slice(0,3).every((b:number)=>b===0)
          &&t.count===0&&t.timeMs>=l.timeMs-s.stepToleranceMs&&t.timeMs<=marker.timeMs+s.stepToleranceMs);
        // AVR serial output can outlast the first newly generated sample.
        // Freshness starts at the actual clear transfer, not the printed marker.
        const fresh=drained.every(r=>r.timeMs>previousClear);previousClear=clear?.timeMs??Infinity;
        return {timeMs:l.timeMs,drained:drained.length,unique:new Set(drained.map(r=>r.timeMs)).size,clear:!!clear,clearedAt:clear?.timeMs??null,fresh};
      });
      const recoveries=cycles.filter(c=>c.drained===32&&c.unique===32&&c.clear&&c.fresh);
      basic=configured&&valid.length>=2&&valid.length===reports.length&&last?.dropped>0;
      advanced=basic&&recoveries.length>=3&&recoveries.length===reports.length;
      detail.fullReports=valid.length;detail.recoveries=recoveries.length;detail.cycles=cycles;detail.dropped=last?.dropped??0;
    }
    const sample={index:stage+1,basic,advanced,completeSamples:fresh.length,...detail};stage++;return sample;
  }
  return {stimuli,duration,finite,inputs:(q:any)=>[{component:d.id,...q}],observe,record,
    outcomes:(samples:any[],wiring:boolean)=>{
      const identity=transfers.some(t=>t.operation==='read'&&t.register===255&&t.bytes[0]===21);
      const connection=wiring&&identity&&configured&&(finite||readings.some(fifoRead));
      const basic=connection&&samples[0]?.basic===true;
      const advanced=basic&&samples.length===stimuli.length&&samples.every(a=>a.advanced===true);
      return [connection,basic,advanced];
    }};
}
