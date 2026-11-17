// MIT. nRF24L01+ static-payload teaching profile; packet medium, not RF physics.
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
export class RadioMedium {
  constructor(clock){this.clock=clock;this.radios=[];this.trace=[];this.sequence=0;this.dropData=0;this.dropAck=0;this.blocked=false;this.attempts=0;this.delivered=0;}
  log(kind,radio,extra={}){this.trace.push({timeUs:this.clock.now,kind,node:radio.id,...extra});if(this.trace.length>256)this.trace.shift();}
  attach(radio){this.radios.push(radio);}
  impair(data={}){const {blocked,dropData,dropAck}=data;if(typeof blocked==='boolean')this.blocked=blocked;for(const k of ['dropData','dropAck'])if(Number.isInteger(data[k])&&data[k]>=0&&data[k]<=100)this[k]=data[k];}
  attempt(tx,job){
    if(tx.job!==job||!tx.powered||!(tx.reg[0]&2))return;
    const packet={bytes:job.bytes.slice(),channel:tx.reg[5],rate:tx.rate,crc:tx.crc,width:tx.width,address:tx.txAddress.slice(0,tx.width),id:job.id,attempt:job.attempt};
    tx.arc=job.attempt;this.attempts++;
    const candidates=this.radios.filter(r=>r!==tx).map(r=>({r,pipe:r.match(packet),epoch:r.epoch}));
    this.log('tx',tx,{channel:packet.channel,address:packet.address.map(b=>b.toString(16).padStart(2,'0')).join(''),bytes:packet.bytes,attempt:job.attempt});
    const air=(8*(1+packet.width+packet.bytes.length+packet.crc)+9)/packet.rate;
    this.clock.after(air,()=>{
      if(tx.job!==job||!tx.powered||!(tx.reg[0]&2))return;
      let accepted=null,reason='Nema prijamnika na istom kanalu, adresi i formatu';
      const lost=this.blocked||this.dropData>0;if(this.dropData>0)this.dropData--;
      if(lost)reason='Paket odbačen zadanim pokusom';
      else for(const {r,pipe,epoch}of candidates){if(pipe>=0&&epoch===r.epoch&&r.match(packet)===pipe){const result=r.receive(packet,pipe,tx.id);if(result){accepted={r,pipe};break;}reason='RX FIFO je pun';}}
      if(accepted){this.delivered++;this.log('rx',accepted.r,{from:tx.id,pipe:accepted.pipe,bytes:packet.bytes,attempt:job.attempt,duplicate:accepted.r.lastDuplicate});}
      const wantsAck=!!(tx.reg[1]&1),ack=accepted&&!!(accepted.r.reg[1]&(1<<accepted.pipe));
      const ackAddress=equal(tx.address(0),packet.address),ackLost=this.blocked||this.dropAck>0;
      if(ack&&this.dropAck>0)this.dropAck--;
      const ackAir=(8*(1+packet.width+packet.crc)+9)/packet.rate;
      const ackDelay=130+ackAir;
      if(!wantsAck){tx.complete(job,true);this.log('sent',tx,{ack:false,delivered:!!accepted});return;}
      // ARD is measured from end of data to next transmission. The minimum
      // model ACK window is 250 us; low-rate CRC/addresses may need more.
      const ended=this.clock.now,wait=Math.max(250,ackDelay),delay=((tx.reg[4]>>4)+1)*250;
      const missing=why=>{
        if(tx.job!==job)return;
        if(job.attempt<(tx.reg[4]&15)){
          this.log('retry',tx,{reason:why,attempt:job.attempt+1});job.attempt++;
          this.clock.at(Math.max(this.clock.now,ended+Math.max(wait,delay)),()=>this.attempt(tx,job));
        }else this.clock.at(Math.max(this.clock.now,ended+wait),()=>{if(tx.job!==job)return;tx.complete(job,false);this.log('max-rt',tx,{reason:why,attempt:job.attempt});});
      };
      if(ack&&ackAddress&&!ackLost){this.clock.after(ackDelay,()=>{
        if(tx.job!==job)return;
        const r=accepted.r;
        if(!r.powered||!(r.reg[0]&2)||r.reg[5]!==packet.channel||r.rate!==packet.rate||r.crc!==packet.crc){missing('Prijamnik nije dostupan tijekom ACK-a');return;}
        tx.complete(job,true);this.log('ack',tx,{from:r.id,attempt:job.attempt});
      });return;}
      if(accepted)reason=!ack?'Prijamnik ne šalje ACK':!ackAddress?'TX_ADDR i RX_ADDR_P0 odašiljača nisu jednaki':'ACK odbačen zadanim pokusom';
      missing(reason);
    });
  }
  snapshot(){return {timeUs:this.clock.now,attempts:this.attempts,delivered:this.delivered,blocked:this.blocked,dropData:this.dropData,dropAck:this.dropAck,trace:this.trace.slice()};}
}
export class NRF24 {
  constructor(id,medium){this.id=id;this.medium=medium;medium.attach(this);this.powered=false;this.epoch=0;this.transfers=[];this.readings=[];this.transferSequence=0;this.reset();}
  reset(){this.transfers=[];this.readings=[];this.transferSequence=0;this.reg=new Uint8Array(32);this.reg.set([8,63,3,3,3,2,14,14]);this.txAddress=[231,231,231,231,231];this.rxAddresses=[[231,231,231,231,231],[194,194,194,194,194],[195],[196],[197],[198]];this.tx=[];this.rx=[];this.flags=0;this.arc=0;this.plos=0;this.ce=false;this.ceAt=0;this.readyAt=Infinity;this.rxAt=Infinity;this.job=null;this.received=0;this.sent=0;this.failed=0;this.lastPacket=new Map();this.lastDuplicate=false;this.epoch++;this.begin();}
  get width(){return (this.reg[3]&3)+2;}
  get rate(){return this.reg[6]&32?.25:this.reg[6]&8?2:1;}
  get crc(){return (this.reg[0]&8)||this.reg[1]?(this.reg[0]&4?2:1):0;}
  get now(){return this.medium.clock.now;}
  address(pipe){return pipe<2?this.rxAddresses[pipe].slice(0,this.width):[this.rxAddresses[pipe][0],...this.rxAddresses[1].slice(1,this.width)];}
  get status(){return this.flags|((this.rx[0]?.pipe??7)<<1)|(this.tx.length===3?1:0);}
  power(on){if(on===this.powered)return;this.reset();this.powered=on;}
  setCE(high){high=!!high;if(high===this.ce)return;this.ce=high;this.epoch++;if(high){this.ceAt=this.now;if(this.reg[0]&1)this.rxAt=Math.max(this.now,this.readyAt)+130;else{const epoch=this.epoch;this.medium.clock.after(10,()=>{if(this.ce&&this.epoch===epoch)this.start();});}}}
  start(){if(this.job||!this.powered||this.reg[0]&1||!(this.reg[0]&2)||this.now<this.readyAt||this.flags&16||!this.tx.length||!this.ce)return;const job={id:++this.medium.sequence,bytes:this.tx[0].slice(),attempt:0};this.job=job;this.medium.clock.after(130,()=>this.medium.attempt(this,job));}
  match(p){if(!this.powered||!this.ce||!(this.reg[0]&1)||!(this.reg[0]&2)||this.now<this.rxAt||this.job||this.reg[5]!==p.channel||this.rate!==p.rate||this.crc!==p.crc||this.width!==p.width)return -1;for(let i=0;i<6;i++)if((this.reg[2]&(1<<i))&&this.reg[17+i]===p.bytes.length&&equal(this.address(i),p.address))return i;return -1;}
  receive(p,pipe,from){const key=from+':'+pipe,duplicate=this.lastPacket.get(key)===p.id;this.lastDuplicate=duplicate;if(duplicate)return true;if(this.rx.length===3)return false;this.rx.push({bytes:p.bytes.slice(),pipe,packetId:p.id,from});this.flags|=64;this.received++;this.lastPacket.set(key,p.id);return true;}
  complete(job,ok){if(this.job!==job)return;this.job=null;if(ok){this.flags|=32;this.tx.shift();this.sent++;if(this.ce)this.start();}else{this.flags|=16;this.plos=Math.min(15,this.plos+1);this.failed++;}}
  get(reg,index=0){if(reg===7)return this.status;if(reg===8)return this.plos*16+this.arc;if(reg===9)return 0;if(reg===23)return (this.tx.length===3?32:0)|(this.tx.length?0:16)|(this.rx.length===3?2:0)|(this.rx.length?0:1);if(reg===16)return this.txAddress[index]??0;if(reg>=10&&reg<=15)return this.rxAddresses[reg-10][index]??0;return this.reg[reg]??0;}
  set(reg,value,index=0){
    if(reg===7){this.flags&=~(value&112);return;}
    if([8,9,23].includes(reg))return;
    if(reg===16||reg>=10&&reg<=15){if(this.ce)throw Error('NRF24: adrese mijenjaj uz CE LOW.');const a=reg===16?this.txAddress:this.rxAddresses[reg-10];if(index<a.length)a[index]=value;this.epoch++;return;}
    if(![0,1,2,3,4,5,6,17,18,19,20,21,22,28,29].includes(reg))throw Error('NRF24: nepodržan registar 0x'+reg.toString(16));
    if(index)throw Error('NRF24: registar je jednobajtan.');
    if((reg===28||reg===29)&&value)throw Error('NRF24: dinamički payload, ACK payload i NO_ACK nisu u statičkom profilu.');
    if(reg===3&&![1,2,3].includes(value)||reg===5&&value>125||reg>=17&&reg<=22&&value>32||reg===6&&(value&0xb1||((value&40)===40))||reg===0&&(value&128)||[1,2].includes(reg)&&(value&192))throw Error('NRF24: nevaljana konfiguracija registra 0x'+reg.toString(16));
    if(this.ce&&[0,2,3,5,6,17,18,19,20,21,22].includes(reg))throw Error('NRF24: konfiguraciju mijenjaj uz CE LOW.');
    const old=this.reg[reg];this.reg[reg]=value;if(reg===5)this.plos=0;
    if(reg===0){if(!(old&2)&&(value&2))this.readyAt=this.now+1500;if(!(value&2)){this.readyAt=Infinity;this.job=null;}this.rxAt=Infinity;}
    this.epoch++;
  }
  begin(){this.command=null;this.index=0;this.upload=[];this.output=[];this.firstStatus=0;this.readTouched=false;}
  end(){
    const packet=this.rx[0],sequence=++this.transferSequence;
    if(this.command===160&&this.upload.length){if(this.tx.length<3)this.tx.push(this.upload.slice());if(this.ce)this.start();}
    if(this.command===97&&this.readTouched){
      if(packet&&this.index>=packet.bytes.length){this.readings.push({sequence,timeUs:this.now,packetId:packet.packetId,from:packet.from,pipe:packet.pipe,bytes:packet.bytes.slice()});if(this.readings.length>64)this.readings.shift();}
      this.rx.shift();
    }
    if(this.index&&(this.command===5||this.command===97||this.command===160||this.firstStatus&48)){
      this.transfers.push({sequence,timeUs:this.now,command:this.command,length:this.index,status:this.firstStatus,bytes:this.output.slice(),uploaded:this.upload.slice()});if(this.transfers.length>64)this.transfers.shift();
    }
    this.begin();
  }
  returned(value){if(this.output.length<32)this.output.push(value);return value;}
  byte(value){
    if(this.command===null){const status=this.status;this.firstStatus=status;this.command=value;
      if(value===225){this.tx=[];this.job=null;}else if(value===226)this.rx=[];
      else if(!((value<=31)||(value>=32&&value<=63)||[97,160,255].includes(value)))throw Error('NRF24: SPI naredba 0x'+value.toString(16)+' nije u statičkom profilu.');return status;}
    const i=this.index++;
    if(this.command<=31)return this.returned(this.get(this.command,i));
    if(this.command>=32&&this.command<=63){this.set(this.command&31,value,i);return this.status;}
    if(this.command===97){this.readTouched=true;return this.returned(this.rx[0]?.bytes[i]??0);}
    if(this.command===160){if(i>=32)throw Error('NRF24: payload ima najviše 32 bajta.');this.upload.push(value);}
    return this.status;
  }
  snapshot(){return {transfers:this.transfers.slice(),readings:this.readings.slice(),powered:this.powered,ce:this.ce,channel:this.reg[5],rateMbps:this.rate,crcBytes:this.crc,addressWidth:this.width,status:this.status,txFifo:this.tx.length,rxFifo:this.rx.length,retries:this.arc,lost:this.plos,received:this.received,sent:this.sent,failed:this.failed,mode:!(this.reg[0]&2)?'power-down':this.reg[0]&1?'RX':'TX'};}
}
