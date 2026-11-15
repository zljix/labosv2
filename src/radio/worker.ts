import {createRadioExperiment} from './engine';
let experiment:Awaited<ReturnType<typeof createRadioExperiment>>|undefined,session=0,timer:ReturnType<typeof setTimeout>|undefined,active=false,lastFrame=-Infinity;
const send=(e:any)=>postMessage({...e,session});
async function pump(){
 if(!experiment)return;
 try{await experiment.advanceUntil(experiment.clock.now+4000,10);if(performance.now()-lastFrame>=33){experiment.frame();lastFrame=performance.now();}timer=setTimeout(()=>void pump(),0);}
 catch(e){experiment?.frame();experiment?.stop();experiment=undefined;send({type:'error',message:String((e as Error).message)});}
}
onmessage=async({data})=>{
 try{
  if(data.type==='run'&&!active){active=true;session=data.session;experiment=await createRadioExperiment(data.nodes,send,{runtimeBase:data.runtimeBase,machine:data.machine});experiment.impair(data.impair??{});send({type:'ready'});void pump();}
  else if(data.session===session){if(data.type==='input')experiment?.input(data.node,data.values);if(data.type==='impair')experiment?.impair(data.values);}
 }catch(e){if(timer)clearTimeout(timer);experiment?.stop();send({type:'error',message:String((e as Error).message)});}
};
