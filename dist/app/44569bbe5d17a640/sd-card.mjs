// MIT. Bounded SDSC-v2 SPI card and an independent FAT16 image inspector.
// Programs receive sectors only through SPI; this inspector serves UI/export.
export const SD_SECTORS=16384, SD_BLOCK_SIZE=512, SD_MAX_DIRTY=256;
export const SD_FAT=1, SD_FAT_SECTORS=64, SD_ROOT=129, SD_DATA=133;
const enc=new TextEncoder(),dec=new TextDecoder();
export function crc16(bytes){let c=0;for(const b of bytes){c^=b<<8;for(let i=0;i<8;i++)c=(c<<1)^((c&32768)?0x1021:0);c&=65535;}return c;}
export function crc7(bytes){let c=0;for(const b of bytes)for(let i=7;i>=0;i--){const bit=((c>>6)^(b>>i))&1;c=(c<<1)&127;if(bit)c^=9;}return (c<<1)|1;}
const u16=(b,o)=>b[o]|b[o+1]<<8, u32=(b,o)=>(b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0;
const put16=(b,o,v)=>{b[o]=v;b[o+1]=v>>8;};
export function sdBaseBlock(lba){
 const b=new Uint8Array(512);
 if(lba===0){b.set([0xeb,0x3c,0x90]);b.set(enc.encode('LABSD1  '),3);put16(b,11,512);b[13]=1;put16(b,14,1);b[16]=2;put16(b,17,64);put16(b,19,SD_SECTORS);b[21]=0xf8;put16(b,22,64);put16(b,24,32);put16(b,26,64);b[36]=0x80;b[38]=0x29;b.set([0x4c,0x41,0x42,0x31],39);b.set(enc.encode('LAB SD     '),43);b.set(enc.encode('FAT16   '),54);b[510]=0x55;b[511]=0xaa;}
 if(lba===1||lba===65)b.set([0xf8,0xff,0xff,0xff]);
 return b;
}
const encode=b=>btoa(String.fromCharCode(...b));
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export function validSDState(s){return !!s&&s.version===1&&Array.isArray(s.blocks)&&s.blocks.length<=SD_MAX_DIRTY&&new Set(s.blocks.map(r=>r?.[0])).size===s.blocks.length&&s.blocks.every(r=>Array.isArray(r)&&r.length===2&&Number.isInteger(r[0])&&r[0]>=0&&r[0]<SD_SECTORS&&typeof r[1]==='string'&&/^[A-Za-z0-9+/]{683}=$/.test(r[1])&&decode(r[1]).length===512);}
export function sdStateReader(state){if(state!==undefined&&!validSDState(state))throw Error('Neispravna snimka microSD.');const blocks=new Map((state?.blocks??[]).map(([lba,s])=>[lba,decode(s)]));return lba=>blocks.get(lba)?.slice()??sdBaseBlock(lba);}
export function sdImage(state){const read=sdStateReader(state),b=new Uint8Array(SD_SECTORS*512);for(let n=0;n<SD_SECTORS;n++)b.set(read(n),n*512);return b;}
export function sdImageState(bytes){
 if(bytes.length!==SD_SECTORS*512)throw Error('Slika mora imati točno 8 MiB.');
 const blocks=[];for(let n=0;n<SD_SECTORS;n++){const b=bytes.subarray(n*512,(n+1)*512),base=sdBaseBlock(n);if(b.some((v,i)=>v!==base[i])){if(blocks.length>=SD_MAX_DIRTY)throw Error('Slika prelazi Lab granicu od 256 izmijenjenih sektora.');blocks.push([n,encode(b)]);}}
 return {version:1,blocks};
}
function geometry(read){const b=read(0);if(b[510]!==0x55||b[511]!==0xaa||u16(b,11)!==512||b[13]!==1||u16(b,14)!==1||b[16]!==2||u16(b,17)!==64||u16(b,19)!==SD_SECTORS||u16(b,22)!==64)throw Error('Nepodržana FAT16 geometrija; koristi izričitu Lab sliku 8 MiB.');}
export function sdFiles(state){
 const read=sdStateReader(state);geometry(read);const out=[];
 for(let i=0;i<64;i++){const b=read(SD_ROOT+(i>>4)),o=(i%16)*32;if(b[o]===0)break;if(b[o]===0xe5||b[o+11]&0x18||b[o+11]===0x0f)continue;const n=dec.decode(b.subarray(o,o+8)).trim(),ext=dec.decode(b.subarray(o+8,o+11)).trim();out.push({name:n+(ext?'.'+ext:''),size:u32(b,o+28),cluster:u16(b,o+26)});}
 return out;
}
export function sdReadFile(state,name){
 const f=sdFiles(state).find(f=>f.name===name);if(!f)throw Error('Datoteka nije pronađena.');if(f.size>65536)throw Error('Lab čitanje datoteke ograničeno je na 64 KiB.');
 const read=sdStateReader(state),out=new Uint8Array(f.size),seen=new Set();let pos=0,c=f.cluster;
 while(pos<f.size){if(c<2||c>=SD_SECTORS-SD_DATA+2||seen.has(c))throw Error('Nevaljan ili kružni FAT lanac.');seen.add(c);out.set(read(SD_DATA+c-2).subarray(0,Math.min(512,f.size-pos)),pos);pos+=Math.min(512,f.size-pos);const fat=read(1+(c>>8));c=u16(fat,(c%256)*2);}
 return out;
}
export class SDCard {
 constructor(d,now=()=>0){this.d=d;this.now=now;this.blocks=new Map();if(d.sdState){if(!validSDState(d.sdState))throw Error('Neispravna microSD snimka.');for(const [n,s]of d.sdState.blocks)this.blocks.set(n,decode(s));}this.revision=0;this.reads=0;this.completedReads=0;this.bootReads=0;this.writes=0;this.errors=0;this.trace=[];this.transfers=[];this.reset();}
 transfer(operation,lba,bytes){this.transfers.push({timeUs:this.now(),operation,lba,bytes:Array.from(bytes)});if(this.transfers.length>16)this.transfers.shift();}
 log(operation,value,result){this.trace.push({timeUs:this.now(),operation,value,result});if(this.trace.length>80)this.trace.shift();}
 reset(){this.idle=true;this.spi=false;this.startClocks=0;this.command=[];this.reply=[];this.pendingRead=null;this.app=false;this.crc=false;this.write=null;this.busyUntil=0;this.attempts=0;}
 begin(){}
 end(){if(this.write?.data?.length)this.log('abort',this.write.lba,'Nepotpun blok odbačen');this.command=[];this.reply=[];this.pendingRead=null;this.write=null;}
 clocks(count){if(this.d.sdInserted!==false)this.startClocks+=count;}
 block(n){return this.blocks.get(n)?.slice()??sdBaseBlock(n);}
 state(){return {version:1,blocks:[...this.blocks].sort((a,b)=>a[0]-b[0]).map(([n,b])=>[n,encode(b)])};}
 store(n,b){const base=sdBaseBlock(n);if(b.every((v,i)=>v===base[i]))this.blocks.delete(n);else{if(!this.blocks.has(n)&&this.blocks.size>=SD_MAX_DIRTY)return false;this.blocks.set(n,b.slice());}this.revision++;return true;}
 dataBlock(b){const crc=crc16(b);this.reply.push(255,0xfe,...b,crc>>8,crc&255);}
 address(arg){return arg%512===0&&arg/512<SD_SECTORS?arg/512:-1;}
 execute(packet){
 const cmd=packet[0]&63,arg=(packet[1]*16777216+packet[2]*65536+packet[3]*256+packet[4])>>>0,wasApp=this.app;this.app=false;
 const r=this.idle?1:0;this.log('CMD'+cmd,arg,wasApp?'ACMD':'CMD');
 if(!(packet[5]&1)||((this.crc||cmd===0||cmd===8)&&crc7(packet.slice(0,5))!==packet[5])){this.errors++;this.reply.push(r|8);return;}
 if(cmd===0){if(this.startClocks<74)return;this.idle=true;this.spi=true;this.crc=false;this.attempts=0;this.reply.push(1);return;}
 if(!this.spi)return;
 if(cmd===8){this.reply.push(r,...(arg===0x1aa?[0,0,1,0xaa]:[0,0,0,0]));return;}
 if(cmd===55){this.app=true;this.reply.push(r);return;}
 if(cmd===41&&wasApp){if(++this.attempts>=2)this.idle=false;this.reply.push(this.idle?1:0);return;}
 if(cmd===58){this.reply.push(r,this.idle?0:128,255,128,0);return;}
 if(cmd===59){this.crc=!!(arg&1);this.reply.push(r);return;}
 if(this.idle){this.reply.push(r|4);return;}
 if(cmd===16){this.reply.push(arg===512?0:64);return;}
 if(cmd===13){this.reply.push(0,0);return;}
 if(cmd===9||cmd===10){this.reply.push(0);const b=new Uint8Array(16);if(cmd===9){const set=(hi,lo,v)=>{for(let i=lo;i<=hi;i++){const at=127-i;b[at>>3]|=((v>>>(i-lo))&1)<<(7-(at%8));}};set(83,80,9);set(73,62,4095);set(25,22,9);b[0]=0;b[5]=0x59;}else b.set(enc.encode('LAB SDSC 1.0'));b[15]=crc7(b.subarray(0,15));this.dataBlock(b);return;}
 if(cmd===17||cmd===24){const lba=this.address(arg);if(lba<0){this.errors++;this.reply.push(32);return;}this.reply.push(0);if(cmd===17){this.reads++;const bytes=this.block(lba);this.dataBlock(bytes);this.pendingRead={lba,bytes};}else this.write={lba,data:null};return;}
 this.errors++;this.reply.push(4); // No silent acceptance of multi-block/erase commands.
 }
 byte(v){
 if(this.d.sdInserted===false)return 255;
 if(this.reply.length){const value=this.reply.shift();if(!this.reply.length&&this.pendingRead){this.completedReads++;if(this.pendingRead.lba===0)this.bootReads++;this.transfer('read',this.pendingRead.lba,this.pendingRead.bytes);this.pendingRead=null;}return value;}
 if(this.now()<this.busyUntil)return 0;
 if(this.write){const w=this.write;if(w.data===null){if(v===0xfe)w.data=[];return 255;}w.data.push(v);if(w.data.length===514){const b=Uint8Array.from(w.data.slice(0,512)),bad=this.crc&&crc16(b)!==w.data[512]*256+w.data[513];const ok=!bad&&!this.d.sdWriteProtected&&this.store(w.lba,b);if(ok){this.writes++;this.transfer('write',w.lba,b);}else this.errors++;this.reply.push(bad?0x0b:ok?0x05:0x0d);if(ok)this.busyUntil=this.now()+1000;this.log(ok?'write':'write-error',w.lba,bad?'CRC':ok?'512 B potvrđeno':'Zaštita ili budžet sektora');this.write=null;}return 255;}
 if(!this.command.length){if((v&0xc0)!==0x40)return 255;this.command=[v];}else this.command.push(v);
 if(this.command.length===6){const p=this.command;this.command=[];this.execute(p);}return 255;
 }
 snapshot(powered){const state=this.state();let files=[],volumeError='';try{files=sdFiles(state);}catch(e){volumeError=e.message;}return {powered,inserted:this.d.sdInserted!==false,writeProtected:!!this.d.sdWriteProtected,initialized:this.spi&&!this.idle,sectors:SD_SECTORS,dirtyBlocks:this.blocks.size,reads:this.reads,completedReads:this.completedReads,bootReads:this.bootReads,writes:this.writes,errors:this.errors,revision:this.revision,state,files,volumeError,trace:this.trace.slice(),transfers:this.transfers.map(t=>({...t,bytes:[...t.bytes]}))};}
}
