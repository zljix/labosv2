// Local companion only. A popup uses same-origin HTTP; the Site uses postMessage.
// Never expose this compiler on a LAN or the Internet. It is not a sandbox.
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProject} from './avr-compile.mjs';
import {compileS3} from './s3-compile.mjs';
import {AVR_TOOLCHAIN,AVR_LIBRARIES} from '../public/avr-contract.mjs';
import {S3_BOARD,S3_TOOLCHAIN} from '../public/s3-contract.mjs';
import {inputHash,validateArtifact} from '../public/arduino-contract.mjs';
const compileArduino=(project,options)=>project?.board?.id===S3_BOARD?compileS3(project,options):compileProject(project,options);

export function bridgePage(site){
  return `<!doctype html><html lang="hr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Arduino lokalni prevoditelj</title><style>body{font:16px system-ui;max-width:650px;margin:60px auto;padding:24px;background:#f4f7f9;color:#173442}h1{font-size:25px}#state{padding:20px;background:white;border-radius:12px}code{overflow-wrap:anywhere}</style><h1>Arduino lokalni prevoditelj</h1><p id="state">Povezivanje…</p><p>Ostavi ovu karticu otvorenu tijekom prevođenja. Program se prevodi na ovom računalu.</p><p>Dopuštena aplikacija: <code>${site}</code></p><script type="module">
const site=${JSON.stringify(site)},token=location.hash.slice(1),state=document.querySelector('#state');history.replaceState(null,'',location.pathname);
const requests=new Map();const send=data=>window.opener?.postMessage({channel:'esp32-lab-compiler',...data},site);
async function request(path,body,signal){const r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal});const data=await r.json();if(!r.ok){const e=Error(data.error||'Prevođenje nije uspjelo.');e.diagnostics=data.diagnostics;throw e;}return data;}
window.addEventListener('message',async event=>{if(event.source!==window.opener||event.origin!==site||event.data?.channel!=='esp32-lab-compiler')return;const m=event.data;if(m.type==='cancel'){requests.get(m.id)?.abort();return;}if(m.type!=='compile'||typeof m.id!=='string')return;const controller=new AbortController();requests.set(m.id,controller);state.textContent='Prevođenje programa…';try{const data=await request('/v1/compile',{project:m.project},controller.signal);send({type:'result',id:m.id,...data});state.textContent=data.cached?'Vraćen je raniji rezultat istog izvora.':'Program je preveden. Vrati se u aplikaciju.';}catch(e){send({type:'error',id:m.id,message:e.message,diagnostics:e.diagnostics??[]});state.textContent=e.name==='AbortError'?'Prevođenje je otkazano.':e.message;}finally{requests.delete(m.id);}});
try{if(!window.opener)throw Error('Otvori vezu preko gumba Poveži prevoditelj u aplikaciji.');const info=await request('/v1/status');send({type:'ready',info});state.textContent='Povezano. Vrati se u aplikaciju i pritisni Prevedi program.';}catch(e){state.textContent=e.message;send({type:'error',message:e.message});}
window.addEventListener('beforeunload',()=>send({type:'closed'}));
</script></html>`;
}

export function createBridge({site='https://esp32-micropython-lab-tz.tzivkovi.chatgpt.site',port=8765,token=randomBytes(32).toString('hex'),compile=compileArduino}={}) {
  const parsed=new URL(site);if(parsed.origin!==site||!/^https?:$/.test(parsed.protocol))throw Error('Očekuje se točan origin aplikacije.');
  let active=false;const cache=new Map();
  const server=createServer(async(req,res)=>{
    const local=`http://127.0.0.1:${server.address().port}`;
    const reply=(status,data)=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    if(req.headers.host!==new URL(local).host||req.headers.origin&&req.headers.origin!==local){reply(403,{error:'Nedopušteno podrijetlo zahtjeva.'});return;}
    if(req.method==='GET'&&req.url==='/'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(bridgePage(site));return;
    }
    const given=String(req.headers.authorization??'').replace(/^Bearer /,'');
    if(Buffer.byteLength(given)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(given),Buffer.from(token))){reply(401,{error:'Netočan kod povezivanja. Kopiraj trenutačnu vezu iz prozora prevoditelja.'});return;}
    if(req.method==='GET'&&req.url==='/v1/status'){reply(200,{format:'esp32-lab-compiler',version:1,toolchain:AVR_TOOLCHAIN,s3Toolchain:S3_TOOLCHAIN,libraries:AVR_LIBRARIES,cacheEntries:cache.size});return;}
    if(req.method!=='POST'||req.url!=='/v1/compile'){reply(404,{error:'Nepoznat zahtjev.'});return;}
    if(!String(req.headers['content-type']).startsWith('application/json')){reply(415,{error:'Očekuje se JSON.'});return;}
    if(active){reply(409,{error:'Prevoditelj već obrađuje program. Pričekaj završetak.'});return;}
    active=true;const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
    try {
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>2097152){reply(413,{error:'Projekt prelazi 2 MiB.'});return;}chunks.push(chunk);}
      const value=JSON.parse(Buffer.concat(chunks).toString('utf8')),project=value?.project,hash=await inputHash(project);
      let artifact=cache.get(hash),cached=!!artifact;
      if(artifact)await validateArtifact(project,artifact);
      else {artifact=await compile(project,{signal:abort.signal});await validateArtifact(project,artifact);cache.set(hash,artifact);while(cache.size>12)cache.delete(cache.keys().next().value);}
      reply(200,{artifact,cached});
    }catch(e){reply(422,{error:e.message,diagnostics:e.diagnostics??[]});}
    finally{active=false;}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,token,start:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve({url:`http://127.0.0.1:${server.address().port}/#${token}`,port:server.address().port,site}));})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const site=process.env.LAB_ARDUINO_SITE??undefined,port=Number(process.env.LAB_ARDUINO_PORT??8765);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Port mora biti 1024–65535.');const bridge=createBridge({site,port}),info=await bridge.start();console.log('Arduino lokalni prevoditelj · zaustavljanje: Ctrl+C\nU aplikaciji otvori Prevedi i zalijepi ovu vezu:\n'+info.url+'\nOstavi ovaj prozor otvoren.');}catch(e){console.error(e.message);process.exitCode=1;}
}
