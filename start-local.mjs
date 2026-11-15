// ESP32 Lab local server. Node.js 22+. MIT.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'dist'),port=Number(process.env.LAB_LOCAL_PORT??4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.py':'text/plain','.csv':'text/csv; charset=utf-8','.zip':'application/zip'};
const server=createServer(async(req,res)=>{try{
 const actual=server.address().port;if(!['127.0.0.1:'+actual,'localhost:'+actual].includes(req.headers.host)||!['GET','HEAD'].includes(req.method)){res.writeHead(403);res.end();return;}
 const url=new URL(req.url,'http://127.0.0.1:'+port),path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!path.startsWith(root+sep)||(await stat(path)).isDirectory()){res.writeHead(404);res.end();return;}
 const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404);res.end();}});
server.on('error',e=>{console.error('Ne mogu pokrenuti lokalni Lab: '+e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('ESP32 Lab: http://127.0.0.1:'+server.address().port+'/\nOstavi ovaj prozor otvoren. Zaustavljanje: Ctrl+C.'));
