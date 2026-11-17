import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createRadioExperiment} from '../../src/radio/engine';
import {checkCircuit} from '../../src/circuit/netlist';
let input='';for await(const c of process.stdin){input+=c;if(Buffer.byteLength(input)>4194304)throw Error('Prevelika snimka para.');}
const {nodes,profile,seed}=JSON.parse(input),root=process.env.LAB_GRADER_PUBLIC!,machine=await readFile(root+'/machine.py','utf8');
const dropped=1+(parseInt(seed.slice(0,8),16)%2),scenarios=[{name:'normal'},{name:'ack-loss',dropAck:dropped},{name:'data-loss',dropData:dropped},{name:'blocked',blocked:true},{name:'restored'}];
const samples:any[]=[],expected=Array.from({length:10},(_,i)=>i+1);let programError=false;
const wiring=nodes.every((p:any)=>checkCircuit(p.circuit).diagnostics.every((d:any)=>d.severity!=='error'&&!['unconnected','bypassed'].includes(d.code)));
for(const s of scenarios){
  let experiment:any,last:any={};const lines:any[]=[],buffers:Record<string,string>={A:'',B:''};
  const observe=(e:any)=>{
    if(e.type==='simulation')last[e.node]=e;
    if(e.type==='console'){
      buffers[e.node]=(buffers[e.node]+e.text).slice(-32768);let end:number;
      while((end=buffers[e.node].indexOf('\n'))>=0){const text=buffers[e.node].slice(0,end).replace(/\r$/,'');buffers[e.node]=buffers[e.node].slice(end+1);
        if(lines.length<1024)lines.push({node:e.node,text,timeUs:experiment?.clock.now??0});}
    }
  };
  try{
    experiment=await createRadioExperiment(nodes,observe,{machine,runtimeBase:pathToFileURL(root+'/').href,harden:true});
    experiment.impair(s);
    for(let at=2000;at<=profile.contract.scenario.durationUs;at+=2000){await experiment.advanceUntil(at);experiment.frame();}
  }catch{programError=true;}
  if(!experiment){samples.push({scenario:s.name,connection:false,passed:false});continue;}
  try{
    const radios=experiment.medium.radios,tx=radios.find((r:any)=>r.id.startsWith('A:')),rx=radios.find((r:any)=>r.id.startsWith('B:'));
    const trace=experiment.medium.trace,received=rx?.readings??[];
    const reportedRX=lines.filter(l=>l.node==='B'&&/^RX \d+$/.test(l.text)).map(l=>({...l,n:+l.text.slice(3)}));
    const reportedTX=lines.filter(l=>l.node==='A'&&/^TX \d+ (ACK|MAX_RT)$/.test(l.text)).map(l=>({...l,n:+l.text.split(' ')[1],ack:l.text.endsWith(' ACK')}));
    const connection=wiring&&[tx,rx].every(r=>r?.powered&&r.transfers.some((t:any)=>t.command===5&&t.bytes[0]===r.reg[5]));
    const txPackets=trace.filter((e:any)=>e.kind==='tx'&&e.attempt===0),acks=trace.filter((e:any)=>e.kind==='ack'),fails=trace.filter((e:any)=>e.kind==='max-rt');
    const packetsCorrect=txPackets.length===10&&txPackets.every((e:any,i:number)=>e.bytes.length===8&&e.bytes[0]===i+1&&e.bytes.slice(1).every((b:number)=>b===0));
    const txCorrect=reportedTX.length===10&&reportedTX.every((l,i)=>l.n===i+1&&l.ack!==!!s.blocked&&
      (s.blocked?fails:acks).some((e:any)=>e.timeUs<=l.timeUs&&txPackets[i]?.timeUs<=e.timeUs));
    const readCorrect=received.length===10&&received.every((r:any,i:number)=>r.bytes.length===8&&r.bytes[0]===i+1&&r.bytes.slice(1).every((b:number)=>b===0));
    const rxCorrect=reportedRX.length===10&&reportedRX.every((l,i)=>l.n===expected[i]&&received[i]?.timeUs<=l.timeUs);
    const retries=trace.filter((e:any)=>e.kind==='retry').length;
    const configured=[tx,rx].every(r=>r.width===5&&r.crc===2&&(r.reg[1]&1)!==0)&&(tx.reg[4]&15)>=2;
    const protocol=configured&&(s.blocked?tx.sent===0&&tx.failed===10&&rx.received===0&&received.length===0&&reportedRX.length===0:
      tx.sent===10&&tx.failed===0&&rx.received===10&&acks.length===10&&readCorrect&&rxCorrect&&
      retries===((s.dropAck??0)+(s.dropData??0)));
    samples.push({scenario:s.name,connection,passed:connection&&packetsCorrect&&txCorrect&&protocol,
      attempts:experiment.medium.attempts,retries,acknowledged:acks.length,failed:fails.length,rfReceived:rx.received,completeReads:received.length,
      rxValues:reportedRX.map(l=>l.n),txValues:reportedTX.map(l=>({n:l.n,ack:l.ack})),packetsCorrect,txCorrect,readCorrect,rxCorrect});
  }finally{experiment.stop();}
}
const outcomes=[samples[0]?.connection===true,samples[0]?.passed===true,samples.length===5&&samples.every(s=>s.passed===true)];
if(!outcomes[0])outcomes.fill(false);if(!outcomes[1])outcomes[2]=false;
const criteria=profile.criteria.map((c:any,i:number)=>({...c,passed:outcomes[i],points:outcomes[i]?c.maxPoints:0,explanation:outcomes[i]?'Zahtjev je potvrđen neovisnim izvođenjem oba čvora.':'Zahtjev nije potvrđen u pripadnim scenarijima.'}));
process.stdout.write(JSON.stringify({status:programError?'program_error':'evaluated',points:criteria.reduce((n:number,c:any)=>n+c.points,0),maxPoints:10,criteria,samples,
  message:programError?'Jedan od programa prijavio je pogrešku.':'Provjerena su oba spremljena izvora i sklopa.',virtualDurationMs:5*profile.contract.scenario.durationUs/1000,peakRssKiB:process.resourceUsage().maxRSS}));
process.exit(0);
