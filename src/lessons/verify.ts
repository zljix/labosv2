import { Session } from '../../public/session.mjs';
import { compileCircuit, type SimulationFrame } from '../circuit/compile';
import { clone, type Project } from '../project/model';
import {runtimeAvailability} from '../runtime/profiles';
import { getLesson, readWork, RESULT_FILE, programFiles } from './catalog';

export const CHECKER_VERSION = '0.2.0';
export interface CheckResult { id:string; title:string; passed:boolean; expected:string; observed:string }
export interface LessonResult {
  format:'esp32-lab-check'; version:1; checkerVersion:typeof CHECKER_VERSION;
  lessonId:string; lessonVersion:1; sourceHash:string; startedAt:string; finishedAt:string;
  checks:CheckResult[]; console:string;
}
// Only executable source, board and circuit affect the behaviour fingerprint.
// Names, answers, editor preferences and imported claims cannot attest a run.
export function sourceValue(p:Project) {
  const work=readWork(p);
  return JSON.stringify({lesson:work?{id:work.lessonId,version:work.lessonVersion}:null,board:p.board,...(p.language==='micropython'&&p.runtimeProfile.id==='micropython-wasm'?{}:{language:p.language,runtimeProfile:p.runtimeProfile,entryFile:p.entryFile,target:p.target}),circuit:p.circuit,files:Object.entries(programFiles(p))
    .sort(([a],[b])=>a.localeCompare(b))});
}
export async function sourceHash(p:Project) {
  const bytes=new TextEncoder().encode(sourceValue(p));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
export function readResult(p:Project):LessonResult|undefined {
  try {
    const v=JSON.parse(p.files[RESULT_FILE]??'null'),w=readWork(p);
    if(!w||v?.format!=='esp32-lab-check'||v.version!==1||v.checkerVersion!==CHECKER_VERSION||v.lessonId!==w.lessonId||v.lessonVersion!==1||
      !/^[a-f0-9]{64}$/.test(v.sourceHash)||![v.startedAt,v.finishedAt].every(d=>typeof d==='string'&&Number.isFinite(Date.parse(d)))||
      typeof v.console!=='string'||v.console.length>6000||!Array.isArray(v.checks)||v.checks.length<1||v.checks.length>20||
      v.checks.some((c:any)=>!c||typeof c.passed!=='boolean'||['id','title','expected','observed'].some(k=>typeof c[k]!=='string'||c[k].length>2500)))return;
    return v as LessonResult;
  } catch { return; }
}

// Standard framebuf.text() numerals. MicroPython's PETME 8×8 glyphs, MIT,
// copyright (c) 2013, 2014 Damien P. George. Full licence: public/licenses/MicroPython-MIT.txt.
const glyphs:Record<string,number[]>={
  '0':[0,0x3e,0x7f,0x49,0x45,0x7f,0x3e,0], '1':[0,0x40,0x44,0x7f,0x7f,0x40,0x40,0],
  '2':[0,0x62,0x73,0x51,0x49,0x4f,0x46,0], '3':[0,0x22,0x63,0x49,0x49,0x7f,0x36,0],
  '4':[0,0x18,0x18,0x14,0x16,0x7f,0x7f,0x10], '5':[0,0x27,0x67,0x45,0x45,0x7d,0x39,0],
  '6':[0,0x3e,0x7f,0x49,0x49,0x7b,0x32,0], '7':[0,3,3,0x79,0x7d,7,3,0],
  '8':[0,0x36,0x7f,0x49,0x49,0x7f,0x36,0], '9':[0,0x26,0x6f,0x49,0x49,0x7f,0x3e,0],
  '.':[0,0,0,0x60,0x60,0,0,0], '-':[0,8,8,8,8,8,8,0],
};
export function containsFrameText(bytes:number[],value:string):boolean {
  const columns=[...value].flatMap(c=>glyphs[c]??[]);
  if(bytes.length!==1024||columns.length!==value.length*8||columns.length>128)return false;
  for(let y=0;y<=56;y++){
    const row=Array.from({length:128},(_,x)=>{
      let column=0;
      for(let bit=0;bit<8;bit++)if((bytes[x+((y+bit)>>3)*128]??0)&(1<<((y+bit)&7)))column|=1<<bit;
      return column;
    });
    for(let x=0;x<=128-columns.length;x++)if(columns.every((v,i)=>row[x+i]===v))return true;
  }
  return false;
}
export interface VerifyEnvironment { factory:()=>any; machine:string }
export function abortError(){return new DOMException('Provjera je prekinuta.','AbortError');}
export async function verifyLesson(project:Project,environment:VerifyEnvironment,signal?:AbortSignal,onProgress=(s:string)=>{}):Promise<LessonResult> {
  const availability=runtimeAvailability(project.board.id,project.language);
  if(!availability.available)throw Error(availability.message);
  const p=clone(project),work=readWork(p),lesson=work&&getLesson(work.lessonId);
  if(!lesson)throw Error('Projekt nema podržanu vježbu. Ponovno otvori vježbu iz popisa.');
  const result:LessonResult={format:'esp32-lab-check',version:1,checkerVersion:CHECKER_VERSION,lessonId:lesson.id,lessonVersion:1,
    sourceHash:await sourceHash(p),startedAt:new Date().toISOString(),finishedAt:'',checks:[],console:''};
  let session:Session|undefined,frame:SimulationFrame|undefined;
  const observedFrames:SimulationFrame[]=[];
  const record=(id:string,title:string,passed:boolean,expected:string,observed:string)=>result.checks.push({id,title,passed,expected,observed});
  const assertLive=()=>{if(signal?.aborted)throw abortError();};
  const pause=(ms:number)=>new Promise<void>((resolve,reject)=>{
    assertLive();
    const done=()=>{signal?.removeEventListener('abort',abort);resolve();};
    const timer=setTimeout(done,ms);
    const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(abortError());};
    signal?.addEventListener('abort',abort,{once:true});
  });
  const wait=(predicate:()=>boolean,ms:number)=>new Promise<boolean>((resolve,reject)=>{
    assertLive();if(predicate()){resolve(true);return;}
    const finish=(value:boolean,error?:Error)=>{clearTimeout(timer);session?.listeners.delete(tick);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
    const tick=()=>{if(session?.status==='error')finish(false,Error(session.events.filter((e:any)=>e.type==='error').at(-1)?.message??'Pogreška izvođenja.'));else if(predicate())finish(true);};
    const abort=()=>finish(false,abortError());
    const timer=setTimeout(()=>finish(false),ms);
    session!.listeners.add(tick);signal?.addEventListener('abort',abort,{once:true});
  });
  try {
    assertLive();
    if(p.circuit.kind!=='editable')throw Error('Vježba zahtijeva sastavljeni sklop.');
    const one=(kind:string)=>{
      const parts=p.circuit.components.filter(c=>c.kind===kind);
      if(parts.length!==1)throw Error(`Za ovu provjeru potrebna je točno jedna komponenta vrste ${kind}; pronađeno ${parts.length}.`);
      return parts[0].id;
    };
    const led=lesson.number<=3?one('led'):undefined;
    const button=lesson.number===2?one('button'):undefined,pot=lesson.number===3?one('potentiometer'):undefined;
    const sensor=lesson.number>=4?one('aht10'):undefined,display=lesson.number>=4?one('ssd1306'):undefined,servo=lesson.number===5?one('servo'):undefined;
    // Deterministic initial stimuli are only applied to the run snapshot.
    for(const part of p.circuit.components){
      if(part.kind==='button')part.properties.pressed=false;
      if(part.kind==='potentiometer')part.properties.position=0;
      if(part.kind==='aht10'){part.properties.temperature=24;part.properties.humidity=50;}
    }
    const config=compileCircuit(p.circuit);
    record('topology','Priprema sklopa',true,'Sklop bez blokirajućih pogrešaka i s potrebnim komponentama.','Električne mreže uspješno izračunate.');
    onProgress('Pokretanje zasebne MicroPython sesije…');
    session=new Session(environment.factory,environment.machine,p.files['main.py'],{circuit:config},(e:any)=>{
      if(e.type==='simulation'){frame=e;observedFrames.push(e);if(observedFrames.length>180)observedFrames.shift();}
    },programFiles(p));
    if(!await wait(()=>session?.status==='running'||session?.status==='done',8000))throw Error('Interpreter nije spreman unutar 8 s. Ponovi provjeru.');
    const brightness=()=>frame?.leds[led!]?.brightness??0;
    if(lesson.number===1){
      onProgress('Mjerenje triju ciklusa LED-ice (oko 4 s)…');
      const edges=()=>{
        const values:{on:boolean;time:number}[]=[];
        for(const f of observedFrames){const on=(f.leds[led!]?.brightness??0)>.05;if(!values.length||values.at(-1)!.on!==on)values.push({on,time:f.timeMs});}
        if(values[0]&&!values[0].on)values.shift();return values;
      };
      await wait(()=>edges().length>=7,5200);
      const values=edges(),durations=values.slice(1,7).map((v,i)=>({on:values[i].on,ms:v.time-values[i].time}));
      const on=durations.filter(v=>v.on).map(v=>v.ms),off=durations.filter(v=>!v.on).map(v=>v.ms);
      record('cycles','Naizmjenično treptanje',values.length>=7,'Najmanje tri cjelovita ciklusa.',`${Math.max(0,Math.floor((values.length-1)/2))} ciklusa opaženo.`);
      record('on-time','Trajanje uključenja',on.length>=3&&on.every(v=>v>=180&&v<=380),'250 ms; prihvaćeno 180–380 ms.',on.length?on.map(v=>v+' ms').join(', '):'Nema dovršenog uključenja.');
      record('off-time','Trajanje isključenja',off.length>=3&&off.every(v=>v>=650&&v<=1000),'750 ms; prihvaćeno 650–1000 ms.',off.length?off.map(v=>v+' ms').join(', '):'Nema dovršenog isključenja.');
    } else if(lesson.number===2){
      for(const [i,pressed]of [false,true,false,true,false].entries()){
        onProgress(`Tipkalo ${i+1}/5: ${pressed?'pritisnuto':'otpušteno'}…`);
        session.input({component:button,pressed});await pause(300);
        if(session.status==='error')throw Error(session.events.filter((e:any)=>e.type==='error').at(-1)?.message??'Pogreška izvođenja.');
        const actual=brightness();
        record('button-'+i,`${i+1}. ${pressed?'Pritisak':'Otpuštanje'}`,!!frame&&(pressed?actual>.08:actual<.01),pressed?'LED uključena unutar 300 ms.':'LED ugašena unutar 300 ms.',`Relativna svjetlina: ${(actual*100).toFixed(1)} %.`);
      }
    } else if(lesson.number===3){
      const values:number[]=[],duties:(number|undefined)[]=[];
      for(const position of [0,25,50,100]){
        onProgress(`Potenciometar: ${position} %…`);session.input({component:pot,position});await pause(320);
        if(session.status==='error')throw Error(session.events.filter((e:any)=>e.type==='error').at(-1)?.message??'Pogreška izvođenja.');
        values.push(brightness());duties.push(Object.values(frame?.gpios??{}).find(g=>g.mode==='PWM')?.duty);
      }
      const [zero,low,mid,full]=values,ratio=(v:number)=>full>.001?v/full:0;
      record('pwm','PWM izlaz',duties.every(v=>v!==undefined),'Program stvara PWM izlaz.',`Opaženi duty_u16: ${duties.map(v=>v??'nema').join(' / ')}.`);
      record('ends','Krajnji položaji',full>.05&&zero<.01,'0 %: ugašeno; 100 %: svijetli.',`Svjetlina: ${(zero*100).toFixed(1)} % → ${(full*100).toFixed(1)} %.`);
      record('low','Položaj 25 %',full>.05&&ratio(low)>=.20&&ratio(low)<=.34,'20–34 % najveće svjetline (oko 27 %).',`${(ratio(low)*100).toFixed(1)} % najveće svjetline.`);
      record('mid','Položaj 50 %',full>.05&&ratio(mid)>=.44&&ratio(mid)<=.64&&mid>low,'44–64 % najveće svjetline (oko 53 %).',`${(ratio(mid)*100).toFixed(1)} % najveće svjetline.`);
    } else {
      const stimuli=lesson.number===4?[[20,40],[34,40],[34,70],[20,40]]:[[24,50],[29,50],[27,50],[25,50],[27,50],[29,50]];
      const angles=[0,90,90,0,0,90];
      for(const [i,[temperature,humidity]]of stimuli.entries()){
        onProgress(`Okoliš ${i+1}/${stimuli.length}: ${temperature} °C / ${humidity} % RH…`);
        const baseline=frame?.sensors[sensor!]?.sample??0;
        session.input({component:sensor,temperature,humidity});
        const fresh=()=>{const s=frame?.sensors[sensor!];return !!s&&s.sample>baseline&&s.measuredTemperature!==null&&s.measuredHumidity!==null&&Math.abs(s.measuredTemperature-temperature)<.06&&Math.abs(s.measuredHumidity-humidity)<.06;};
        const screen=()=>{const d=frame?.displays[display!];return !!d&&d.powered&&d.on&&containsFrameText(d.bytes,temperature.toFixed(1))&&containsFrameText(d.bytes,humidity.toFixed(1));};
        const angle=()=>frame?.servos[servo!]?.angle;
        await wait(()=>fresh()&&screen()&&(lesson.number===4||(angle()!=null&&Math.abs(angle()!-angles[i])<2)),3400);
        const sensed=frame?.sensors[sensor!],a=angle();
        record('sensor-'+i,`${i+1}. Očitanje ${temperature} °C / ${humidity} % RH`,fresh(),'Novo dovršeno očitanje odgovara zadanom okolišu.',sensed?`Uzorak ${sensed.sample}; T=${sensed.measuredTemperature?.toFixed(2)??'—'}; RH=${sensed.measuredHumidity?.toFixed(2)??'—'}.`:'Nema očitanja senzora.');
        record('oled-'+i,`${i+1}. Brojke na OLED-u`,fresh()&&screen(),`Standardni text(): ${temperature.toFixed(1)} i ${humidity.toFixed(1)} na zaslonu.`,screen()?'Obje vrijednosti pronađene u primljenim pikselima.':'Nedostaje očekivani prikaz temperature ili vlage. Provjeri text(), fill(0), show() i raspored.');
        if(lesson.number===5)record('servo-'+i,`${i+1}. Servo na ${temperature} °C`,fresh()&&a!=null&&Math.abs(a-angles[i])<2,`${angles[i]}°${temperature===27?' uz zadržavanje prethodnog stanja':''}.`,`Opaženi kut: ${a?.toFixed(1)??'nema'}°.`);
      }
    }
  } catch(e) {
    if(signal?.aborted||(e as Error).name==='AbortError')throw abortError();
    record('execution','Izvršavanje i spojevi',false,'Program izvršava traženo ponašanje bez pogreške.',String((e as Error).message).slice(0,2500));
  } finally {
    result.console=(session?.text??'').slice(-6000);
    await session?.stop();
  }
  result.finishedAt=new Date().toISOString();
  return result;
}
