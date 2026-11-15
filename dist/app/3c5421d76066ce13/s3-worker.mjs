import {createS3Engine} from './s3-engine.mjs';
import {validateArtifact,wasmBytes} from './s3-contract.mjs';
let active=false,engine,session=0;
const send=data=>postMessage({...data,session});
self.onmessage=async({data})=>{
 if(data.type==='input'){if(data.session===session)engine?.input(data);return;}
 if(data.type!=='run'||active)return;active=true;session=data.session;
 try{await validateArtifact(data.project,data.artifact);engine=await createS3Engine(wasmBytes(data.artifact.wasm),data.circuit,send);await engine.run();}
 catch(e){engine?.stop();send({type:'error',message:String(e.message??e).slice(0,8192)});}
};
