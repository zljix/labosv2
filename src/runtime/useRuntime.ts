import {SDSessionMemory} from './sdState';
import {RTCSessionMemory} from './rtcState';
import { useEffect, useRef, useState } from "react";
import {prepareRun,startMicroPython,type RuntimeHandle} from "./adapter";
import { type SimulationFrame } from "../circuit/compile";
import type { Project } from "../project/model";
import type {LiveInput} from "../circuit/model";
import {runtimeAsset} from '../platform/assets';
import {AVRSession} from './avrSession';
import {AVR_TARGETS} from '../../public/avr-contract.mjs';
import {buildFile,validateArtifact,memoryDescription} from '../../public/arduino-contract.mjs';
import {S3Session} from './s3Session';
export function useRuntime() {
  const [state, setState] = useState("idle"),
    [consoleText, setConsole] = useState(""),
    [led, setLed] = useState(false),
    [button, setButton] = useState(false),
    [frame, setFrame] = useState<number[]>([]),
    [simulation, setSimulation] = useState<SimulationFrame>(),
    [liveInputs, setLiveInputs] = useState<Record<string, LiveInput>>({}),
    [runRevision, setRunRevision] = useState<number>();
  const sdMemory=useRef(new SDSessionMemory());
  const rtcMemory=useRef(new RTCSessionMemory());
  const session = useRef<RuntimeHandle>(undefined), launch = useRef(0), machine = useRef(""), pressed = useRef(false);
  const append = (text: string) => setConsole((p) => (p + text).slice(-24000));
  function stop(keepResults = false) {
    ++launch.current;
    void session.current?.stop(); session.current = undefined;
    setState("stopped"); if(!keepResults)setSimulation(undefined);setLiveInputs({});
  }
  async function run(p: Project, reset = false) {
    const ticket = ++launch.current;
    void session.current?.stop(); session.current = undefined;
    if (reset) { pressed.current = false; setButton(false); }
    setState("loading");setConsole("");setLed(false);setFrame([]);setSimulation(undefined);setLiveInputs({});setRunRevision(p.revision);
    try {
      const snapshot = prepareRun(p);
      setLiveInputs({...rtcMemory.current.prepare(p,snapshot.circuit),...sdMemory.current.prepare(p,snapshot.circuit)});
      const observe=(event:any)=>{
        if(ticket!==launch.current)return;
        if(event.type==='ready')setState('running');
        if(event.type==='console')append(event.text);
        if(event.type==='pins')setLed(!!event.pins[4]);
        if(event.type==='frame')setFrame(event.bytes);
        if(event.type==='simulation'){rtcMemory.current.observe(event);sdMemory.current.observe(event);setSimulation(event);}
        if(event.type==='done')setState('done');
        if(event.type==='error'){append(event.message+'\n');setState('error');void session.current?.stop();}
      };
      if(snapshot.project.language==='arduino-cpp'){
        const raw=snapshot.project.files[buildFile(snapshot.project)];
        if(!raw)throw Error('Najprije prevedi program gumbom Prevedi ili otvori provjereni Arduino primjer.');
        const artifact=await validateArtifact(snapshot.project,JSON.parse(raw));
        if(ticket!==launch.current)return;
        append(`${snapshot.project.runtimeProfile.id==='arduino-s3-wasm'?'ESP32-S3 funkcionalni WASM':'AVR'} · ${memoryDescription(artifact)}\n`);
        if(snapshot.project.runtimeProfile.id==='arduino-s3-wasm'){session.current=new S3Session(()=>new Worker(runtimeAsset('s3-worker.mjs'),{type:'module'}),snapshot.project,artifact,snapshot.circuit!,observe);return;}
        session.current=new AVRSession(()=>new Worker(new URL('./avrWorker.ts',import.meta.url),{type:'module'}),artifact.hex,snapshot.circuit!,AVR_TARGETS[snapshot.project.board.id as keyof typeof AVR_TARGETS].adc,observe,artifact.staticRamBytes);
        return;
      }
      if (!machine.current) {
        const r = await fetch(runtimeAsset('machine.py'),{cache:"no-store"});
        if (!r.ok) throw Error("Ne mogu učitati MicroPython prilagodbu.");
        machine.current = await r.text();
      }
      if (ticket !== launch.current) return;
      session.current = startMicroPython(snapshot, {
        factory:() => new Worker(runtimeAsset('worker.mjs'), { type: "module" }), machine:machine.current,
        input:{button:pressed.current,powered:p.settings.powered,swapped:p.settings.swapped},
        onEvent:observe,
      });
    } catch (e) {
      if (ticket === launch.current) { append((e as Error).message + "\n");setState("error"); }
    }
  }
  function toggleButton() {
    pressed.current = !pressed.current;setButton(pressed.current);session.current?.input({button:pressed.current});
  }
  function input(component: string, values: LiveInput) {
    if (!session.current || !["loading","running","done"].includes(state)) return;
    setLiveInputs(v=>({...v,[component]:{...v[component],...values}}));
    session.current.input({component,...values});
  }
  useEffect(() => () => {++launch.current;void session.current?.stop();},[]);
  return {state,busy:state === "loading" || state === "running",consoleText,led,button,frame,simulation,liveInputs,runRevision,run,stop,toggleButton,input,sendSerial:(serial:string)=>session.current?.input({serial}),clear:()=>setConsole("")};
}
