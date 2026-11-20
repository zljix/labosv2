import upstream from './upstream-manifest.json' with {type:'json'};
import runtime from './runtime-manifest.json' with {type:'json'};
import packed from './packed-manifest.json' with {type:'json'};
import {sha256} from '../../public/avr-contract.mjs';
export const FILES=runtime.files;
export const SDK_FILE=runtime.sdkFile;
export const CACHE = 'labos-avr-prototype-1-'+upstream.files['sdk.bin'].sha256.slice(0,12);
export const assetURL = (name,base=self.location.href) => new URL('toolchain/'+name, base).href;
export const PACKED_BYTES=Object.values(packed).reduce((n,f)=>n+f.bytes,0);
const CODEC='X-Labos-Compression';
async function boundedRead(stream,limit) {
  const reader=stream.getReader(), chunks=[];let size=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('Datoteka paketa prelazi dopuštenu veličinu.');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out.buffer;
}
export async function decodeResponse(name,response) {
  const expected=FILES[name];if(!expected)throw Error('Nepoznata datoteka paketa.');
  const bytes=await boundedRead(response.body,expected.bytes+1024);
  if(response.headers.get(CODEC)==='gzip'){
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return verifyBytes(name,await boundedRead(stream,expected.bytes));
  }
  return verifyBytes(name,bytes);
}
const packedResponse=bytes=>new Response(bytes,{headers:{'Content-Type':'application/octet-stream',[CODEC]:'gzip'}});
export async function verifyBytes(name,bytes) {
  const expected=FILES[name];
  if(!expected || bytes.byteLength!==expected.bytes || await sha256(bytes)!==expected.sha256)throw Error('Oštećena ili nepotpuna datoteka prevoditelja: '+name);
  return bytes;
}
export async function packageStatus(progress=(_done,_total)=>{},base=self.location.href) {
  const cache=await caches.open(CACHE); let total=0;
  for(const name of Object.keys(FILES)) {
    const response=await cache.match(assetURL(name,base));
    if(!response)throw Error('Paket još nije spremljen: '+name);
    await decodeResponse(name,response); total++; progress(total,Object.keys(FILES).length);
  }
  return true;
}
export async function installPackage(progress=(_done,_total)=>{},base=self.location.href) {
  const cache=await caches.open(CACHE); let done=0;
  for(const name of Object.keys(FILES)) {
    const url=assetURL(name,base), previous=await cache.match(url);
    let valid=false,raw;
    if(previous)try{raw=await decodeResponse(name,previous.clone());valid=true;}catch{}
    // Replace only this prototype's own verified entry, never clear a cache.
    // Existing raw entries are compressed locally before fetching missing parts.
    if(valid&&previous.headers.get(CODEC)!=='gzip'){
      const bytes=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
      await cache.put(url,packedResponse(bytes));
    }
    if(!valid) {
      const response=await fetch(url+'.gz',{cache:'no-store'});
      if(!response.ok)throw Error('Preuzimanje nije uspjelo: '+name);
      const bytes=await boundedRead(response.body,FILES[name].bytes+1024);
      await decodeResponse(name,packedResponse(bytes));
      await cache.put(url,packedResponse(bytes));
    }
    done+=packed[name].bytes; progress(done,PACKED_BYTES);
  }
  // No ready flag: every compile verifies every byte it uses, including after browser eviction.
  await packageStatus(()=>{},base);
}
export async function readPackage(base=self.location.href) {
  const cache=await caches.open(CACHE), files=new Map();
  for(const name of Object.keys(FILES)) {
    const response=await cache.match(assetURL(name,base));
    if(!response)throw Error('Nedostaje offline paket. Pritisni Pripremi paket dok si na mreži.');
    files.set(name,await decodeResponse(name,response));
  }
  return files;
}
