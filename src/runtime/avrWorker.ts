import {AVREngine} from './avrEngine';
let engine:AVREngine|undefined,session=0,timer:ReturnType<typeof setTimeout>|undefined,lastFrame=0;
const send=(event:any)=>postMessage({...event,session});
function fail(e:unknown){if(timer)clearTimeout(timer);engine?.dispose();engine=undefined;send({type:'error',message:(e as Error).message});}
function step(){
  if(!engine)return;
  try{engine.runCycles(64000);if(performance.now()-lastFrame>=33){engine.frame();lastFrame=performance.now();}timer=setTimeout(step,0);}catch(e){fail(e);}
}
onmessage=({data})=>{
  try {
    if(data.type==='run'){
      if(timer)clearTimeout(timer);engine?.dispose();session=data.session;
      engine=new AVREngine(data.hex,data.circuit,send,data.adcChannels,data.staticRamBytes);lastFrame=0;send({type:'ready'});step();
    }else if(data.type==='input'&&data.session===session)engine?.input(data);
  }catch(e){fail(e);}
};
