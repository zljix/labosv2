import {SchoolCompilerClient,type CompileContext} from '../platform/schoolCompiler';
import {useEffect,useRef,useState} from 'react';
import {AVR_TOOLCHAIN} from '../../public/avr-contract.mjs';
import {buildInput,validateArtifact} from '../../public/arduino-contract.mjs';
import {S3_TOOLCHAIN} from '../../public/s3-contract.mjs';
import type {Project} from '../project/model';
import type {BuildDiagnostic} from './arduinoBuild';
export function compilerLink(text:string){
  let u:URL;try{u=new URL(text.trim());}catch{throw Error('Zalijepi cijelu vezu ispisanu u prozoru lokalnog prevoditelja.');}
  if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.pathname!=='/'||u.username||u.password||u.search||!/^[0-9a-f]{64}$/.test(u.hash.slice(1)))throw Error('Veza mora biti http://127.0.0.1:PORT/#KOD iz lokalnog prevoditelja.');
  return u;
}
export function useArduinoCompiler(){
  const school=useRef(new SchoolCompilerClient());
  const [capabilities,setCapabilities]=useState<any>({targets:{}}),[schoolStatus,setSchoolStatus]=useState(''),[mode,setMode]=useState<'school'|'local'>('school');
  async function refreshSchool(){try{setCapabilities(await school.current.capabilities());}catch{setCapabilities({targets:{},message:'Školsko prevođenje koristi prijavljeni račun na školskoj adresi.'});}}
  useEffect(()=>{void refreshSchool();},[]);
  const [connection,setConnection]=useState('disconnected'),[message,setMessage]=useState('Lokalni prevoditelj nije povezan.');
  const s3Ready=useRef(false),popup=useRef<Window|null>(null),origin=useRef(''),pending=useRef<{id:string;resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}|null>(null),connecting=useRef<ReturnType<typeof setTimeout>|null>(null),state=useRef(connection);state.current=connection;
  function reject(message:string){const p=pending.current;if(p){clearTimeout(p.timer);pending.current=null;p.reject(Error(message));}}
  function disconnect(){reject('Veza s prevoditeljem je zatvorena.');if(connecting.current)clearTimeout(connecting.current);popup.current?.close();popup.current=null;setConnection('disconnected');setMessage('Lokalni prevoditelj nije povezan.');}
  useEffect(()=>{
    function receive(e:MessageEvent){
      if(e.source!==popup.current||e.origin!==origin.current||e.data?.channel!=='esp32-lab-compiler')return;
      const m=e.data;
      if(m.type==='ready'){
        if(m.info?.format!=='esp32-lab-compiler'||m.info.version!==1||JSON.stringify(m.info.toolchain)!==JSON.stringify(AVR_TOOLCHAIN)){disconnect();setMessage('Preuzmi aktualni paket lokalnog prevoditelja.');return;}
        s3Ready.current=JSON.stringify(m.info.s3Toolchain)===JSON.stringify(S3_TOOLCHAIN);
        if(connecting.current)clearTimeout(connecting.current);setConnection('connected');setMessage(s3Ready.current?'Lokalni most je povezan za AVR i S3 WASM; instalirani alati provjeravaju se pri prevođenju.':'Lokalni AVR prevoditelj je povezan; za S3 preuzmi novi paket.');return;
      }
      if(m.type==='closed'){reject('Kartica lokalnog prevoditelja je zatvorena.');popup.current=null;setConnection('disconnected');setMessage('Ponovno poveži lokalni prevoditelj.');return;}
      const p=pending.current;
      if(p&&p.id===m.id&&(m.type==='result'||m.type==='error')){
        clearTimeout(p.timer);pending.current=null;
        if(m.type==='result')p.resolve({artifact:m.artifact,cached:!!m.cached});
        else {const err=Object.assign(Error(String(m.message??'Prevođenje nije uspjelo.')),{diagnostics:Array.isArray(m.diagnostics)?m.diagnostics.slice(0,50):[]});p.reject(err);}
      }else if(m.type==='error'&&!m.id){if(connecting.current)clearTimeout(connecting.current);setConnection('disconnected');setMessage(String(m.message??'Povezivanje nije uspjelo.'));}
    }
    window.addEventListener('message',receive);
    const check=setInterval(()=>{if(popup.current?.closed){popup.current=null;reject('Kartica prevoditelja je zatvorena.');setConnection('disconnected');setMessage('Ponovno poveži lokalni prevoditelj.');}},1000);
    return()=>{window.removeEventListener('message',receive);clearInterval(check);if(connecting.current)clearTimeout(connecting.current);reject('Aplikacija je zatvorena.');popup.current?.close();};
  },[]);
  function connect(link:string){
    const u=compilerLink(link);disconnect();origin.current=u.origin;
    popup.current=window.open(u.href,'_blank','popup,width=700,height=520');
    if(!popup.current)throw Error('Preglednik je blokirao prozor. Dopusti skočni prozor za ovu aplikaciju pa ponovi.');
    setConnection('connecting');setMessage('Čekanje lokalnog prevoditelja…');
    connecting.current=setTimeout(()=>{if(state.current!=='connected'){setConnection('disconnected');setMessage('Veza nije potvrđena. Provjeri da lokalni prevoditelj radi na ovom računalu.');}},15000);
  }
  async function compileLocal(project:Project):Promise<{artifact:any;cached:boolean}>{
    if(state.current!=='connected'||!popup.current||popup.current.closed)throw Error('Najprije poveži lokalni prevoditelj.');
    if(project.runtimeProfile.id==='arduino-s3-wasm'&&!s3Ready.current)throw Error('Povezani most nema aktualni S3 profil. Preuzmi novi paket lokalnog prevoditelja.');
    if(pending.current)throw Error('Prevođenje je već u tijeku.');
    buildInput(project);
    const id=crypto.randomUUID(),result=await new Promise<any>((resolve,reject)=>{
      const timer=setTimeout(()=>{popup.current?.postMessage({channel:'esp32-lab-compiler',type:'cancel',id},origin.current);pending.current=null;reject(Error('Prevođenje je prekoračilo 90 sekundi.'));},90000);
      pending.current={id,resolve,reject,timer};popup.current!.postMessage({channel:'esp32-lab-compiler',type:'compile',id,project},origin.current);
    });
    await validateArtifact(project,result.artifact);return result;
  }
  async function compile(project:Project,context?:CompileContext){if(mode==='school'){const info=await school.current.capabilities();setCapabilities(info);if(info.targets?.[project.board.id]?.ready)return school.current.compile(project,context,setSchoolStatus);throw Error(info.targets?.[project.board.id]?.message??'Školski prevoditelj nije spreman. Odaberi lokalni prevoditelj ili provjeri školsku prijavu.');}return compileLocal(project);}
  function cancel(){void school.current.cancel();const p=pending.current;if(p){popup.current?.postMessage({channel:'esp32-lab-compiler',type:'cancel',id:p.id},origin.current);reject('Prevođenje je otkazano.');}}
  return {connection,message,connect,disconnect,compile,cancel,capabilities,schoolStatus,refreshSchool,mode,setMode};
}
export type ArduinoCompiler=ReturnType<typeof useArduinoCompiler>;
