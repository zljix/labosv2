import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,cpSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createServer} from 'node:net';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

export async function schoolFixture(t, options = {}) {
  const php=process.env.PHP_BIN||'php',dsn=process.env.LAB_TEST_DB_DSN||'';
  assert.match(dsn,/^mysql:host=[^;]+;port=\d+;dbname=labosv2_test_[a-z0-9_]+;charset=utf8mb4$/,'Use a separate, empty labosv2_test_* MySQL 8.4 database.');
  assert(process.env.LAB_TEST_DB_USER);
  const root=mkdtempSync(resolve('.build/classes-test-')),pkg=join(root,'package');
  cpSync(resolve('.build/school-package'),pkg,{recursive:true});mkdirSync(join(root,'sessions'),{mode:0o700});
  const socket=createServer();await new Promise(done=>socket.listen(0,'127.0.0.1',done));const port=socket.address().port;await new Promise(done=>socket.close(done));
  const origin='http://127.0.0.1:'+port;
  const config={interactive_compile:{enabled:options.compiler===true},database:{dsn,user:process.env.LAB_TEST_DB_USER,password:process.env.LAB_TEST_DB_PASSWORD??''},app:{origin,key:randomBytes(32).toString('hex'),session_directory:join(root,'sessions'),allow_insecure_localhost:true}};
  writeFileSync(join(root,'private.json'),JSON.stringify(config),{mode:0o600});
  const configPath=join(root,'config.php');writeFileSync(configPath,'<?php return json_decode(file_get_contents(__DIR__ . "/private.json"),true,32,JSON_THROW_ON_ERROR);',{mode:0o600});
  const env={...process.env,LAB_SCHOOL_CONFIG:configPath,LAB_TEST_BOOTSTRAP:join(pkg,'app/bootstrap.php')};
  const command=(action,input,args=[])=>spawnSync(php,[join(pkg,'tools/console.php'),action,configPath,...args],{input:input===undefined?'':JSON.stringify(input),encoding:'utf8',env});
  function sql(statement,values=[]){const r=spawnSync(php,['-r','require getenv("LAB_TEST_BOOTSTRAP"); $i=json_decode(stream_get_contents(STDIN),true); $p=Labos\\database(Labos\\configuration()); $q=Labos\\query($p,$i["sql"],$i["values"]); echo json_encode($q->columnCount()?$q->fetchAll():[]);'],{input:JSON.stringify({sql:statement,values}),encoding:'utf8',env});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
  const migration=command('migrate');assert.equal(migration.status,0,migration.stderr);
  assert.equal(sql('SELECT COUNT(*) AS n FROM users')[0].n,0,'The class suite requires its own empty database.');
  const adminPassword='Admin '+randomBytes(12).toString('hex'),temporary='Temp '+randomBytes(12).toString('hex'),password='Moja '+randomBytes(12).toString('hex');
  const bootstrap=command('init-admin',{username:'admin.test',displayName:'Administrator testa',password:adminPassword});assert.equal(bootstrap.status,0,bootstrap.stderr);
  const router=join(root,'router.php');writeFileSync(router,'<?php $p=parse_url($_SERVER["REQUEST_URI"],PHP_URL_PATH); if($p==="/")$p="/index.html"; if(!is_file($_SERVER["DOCUMENT_ROOT"].$p)){http_response_code(404);exit;} return false;');
  const server=spawn(php,['-S','127.0.0.1:'+port,'-t',join(pkg,'web'),router],{env:{...env,PHP_CLI_SERVER_WORKERS:'4'},detached:true,stdio:['ignore','ignore','pipe']});
  let log='';server.stderr.on('data',b=>log+=b);
  t.after(()=>{try{process.kill(-server.pid,'SIGTERM');}catch{server.kill();}rmSync(root,{recursive:true,force:true});});
  let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health.php')).ok){ready=true;break;}}catch{}await delay(30);}
  assert(ready,'PHP API did not start: '+log);
  function client(){let cookie='',csrf='';return {
    async call(action,body){const response=await fetch(origin+'/api/index.php?action='+action,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrf,Origin:origin})},body:body===undefined?undefined:JSON.stringify(body)});const set=response.headers.getSetCookie();if(set.length)cookie=set.at(-1).split(';')[0];const text=await response.text();let json;try{json=JSON.parse(text);}catch{assert.fail('Non-JSON API: '+text.slice(0,100));}if(json.csrfToken)csrf=json.csrfToken;return {status:response.status,json,text};},
    async login(username,pass){await this.call('session');return this.call('login',{username,password:pass});}
  };}
  const admin=client();assert.equal((await admin.login('admin.test',adminPassword)).status,200);
  async function make(username,role='student',displayName=username){const r=await admin.call('create-user',{username,role,displayName,temporaryPassword:temporary});assert.equal(r.status,201,r.text);const c=client();assert.equal((await c.login(username,temporary)).status,200);assert.equal((await c.call('password',{currentPassword:temporary,newPassword:password})).status,200);return {user:r.json.user,client:c};}
  const gradingCommand=(action,input)=>spawnSync(php,[join(pkg,'tools/grading.php'),action,configPath],{input:input===undefined?'':JSON.stringify(input),encoding:'utf8',env});
  return {admin,client,make,sql,command,gradingCommand,pkg,origin,password,temporary,adminPassword,config,configPath,root,env,get log(){return log;}};
}
