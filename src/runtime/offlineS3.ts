import {APP_BUILD,runtimeAsset} from '../platform/assets';
import type {Project} from '../project/model';
import {browserInput} from '../../public/s3-contract.mjs';

export interface S3PackageProgress {
  completed:number; total:number; bytes:number; totalBytes:number; file?:string;
}
export async function s3Package(prepare=false, progress?:(state:S3PackageProgress)=>void):Promise<boolean> {
  const controller = navigator.serviceWorker?.controller;
  if (!controller) throw Error('Pričekaj spremanje aplikacije za offline rad pa ponovno otvori Labos.');
  return new Promise((resolve,reject) => {
    const channel = new MessageChannel();
    const timeout = () => setTimeout(() => { channel.port1.close(); reject(Error('Provjera S3 paketa nije završila. Ponovi provjeru.')); },prepare?300000:10000);
    let timer = timeout();
    channel.port1.onmessage = ({data}) => {
      clearTimeout(timer);
      if (data.progress) {
        progress?.(data.progress);
        timer = timeout();
        return;
      }
      channel.port1.close();
      if (data.state) progress?.(data.state);
      if (data.error) reject(Error(data.error));
      else resolve(data.ready === true);
    };
    controller.postMessage({type:prepare?'LAB_S3_PREPARE':'LAB_S3_STATUS',build:APP_BUILD},[channel.port2]);
  });
}

export async function compileBrowserS3(project:Project, signal:AbortSignal, progress:(message:string)=>void) {
  browserInput(project);
  if (!await s3Package()) throw Error('Najprije spremi paket prevoditelja za ESP32-S3.');
  signal.throwIfAborted();
  return new Promise<any>((resolve,reject) => {
    const worker = new Worker(runtimeAsset('offline-s3/project-worker.mjs'),{type:'module'});
    function stop() {
      clearTimeout(timer);
      worker.terminate();
      signal.removeEventListener('abort',cancel);
    }
    function cancel() { stop(); reject(Error('Prevođenje je otkazano.')); }
    const timer = setTimeout(() => { stop(); reject(Error('Prevođenje je prekoračilo dvije minute.')); },120000);
    signal.addEventListener('abort',cancel,{once:true});
    worker.onmessage = ({data}) => { if(typeof data.progress==='string'){progress(data.progress);return;} stop(); if (data.error) reject(Error(data.error)); else resolve(data.artifact); };
    worker.onerror = e => { stop(); reject(Error(e.message || 'S3 prevoditelj nije dostupan.')); };
    worker.postMessage(project);
  });
}
