import {investigationProject} from '../lessons/workflow';
import ActionGroup from './ActionGroup';
import {ProjectFiles, FileTabs, fileTabId} from './ProjectFiles';
import {tabKeys} from '../platform/tabs';
import RadioPanel from '../radio/RadioPanel';
import {opticalExamples,opticalCircuit,type OpticalExample} from '../circuit/max30102Examples';
import {sdExamples,sdCircuit,type SDExample} from '../circuit/sdExamples';
import {runtimeAsset, appAsset } from '../platform/assets';
import {rtcExamples,rtcCircuit,type RTCExample} from '../circuit/rtcExamples';
import {
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
  type FormEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { examples } from "../../public/examples.mjs";
import {
  clone,
  parseProject,
  forkProject,
  newProject,
  validPath,
  LIMITS,
} from "../project/model";
import {
  download,
  exportZip,
  importProject,
  safeFilename,
} from "../project/archive";
import type { Stored } from "../project/storage";
import { useWorkspace } from "./useWorkspace";
import { useRuntime } from "../runtime/useRuntime";
import CircuitEditor from "../circuit/CircuitEditor";
import { basicExamples, exampleCircuit, type BasicExample } from "../circuit/examples";
import {environmentExamples,environmentCircuit,loadEnvironmentDrivers,type EnvironmentExample} from "../circuit/environmentExamples";
import {peripheralExample,peripheralCircuit,loadPeripheralDrivers} from "../circuit/peripheralExamples";
import LessonPanel, {LessonCatalog} from "../lessons/LessonPanel";
import UrsPanel from '../lessons/UrsPanel';
import {emptyReviewSession,type ReviewSession} from '../lessons/classReview';
import {createUrsProject,targetForProject,getUrsLesson,ursExampleHint,URS_WORK,type UrsTarget} from '../lessons/ursCatalog';
import {readUrsWork,recordUrsSnapshot,recordUrsReview,exportUrsSubmission} from '../lessons/ursWork';
import {createLessonProject, getLesson, readWork, RESULT_FILE, WORK_FILE} from "../lessons/catalog";
import {useLessonCheck} from "../lessons/useLessonCheck";
import {exportSubmission} from "../lessons/submission";
import {useOffline} from '../platform/offline';
import SystemPanel from '../platform/SystemPanel';
import SchoolAccountLink from '../platform/SchoolAccountLink';
import SchoolAssignment from '../platform/SchoolAssignment';
import {readSchoolBinding} from '../platform/schoolSync';
import {BOARDS,S3,getBoard,languageName,type BoardId,type Language} from '../boards/profiles';
import {BoardFields,BoardChangePanel,SupportMatrix} from '../boards/BoardPanels';
import {deriveProject} from '../project/derive';
import {runtimeAvailability} from '../runtime/profiles';
import {exportSketch} from '../project/sketch';
import {ArduinoBuildPanel,ArduinoSerial} from '../runtime/ArduinoPanel';
import {arduinoExamples,loadArduinoExample,type ArduinoExample} from '../runtime/arduinoExamples';
import {UNO} from '../boards/profiles';
import {AVR_BUILD_FILE,AVR_LIBRARY_FILE,validArduinoPath} from '../../public/avr-contract.mjs';
import {buildInput,buildFile,validateArtifact} from '../../public/arduino-contract.mjs';
import {s3Examples,loadS3Example,type S3Example} from '../runtime/s3Examples';
import OfflineAvrPanel from '../runtime/OfflineAvrPanel';
import {OFFLINE_AVR,prefersOffline,loadOffline,preferStandard,importIntegratedProject,saveOffline} from '../runtime/offlineAvr';
import {useArduinoCompiler} from '../runtime/useArduinoCompiler';
import {cachedBuild} from '../runtime/arduinoBuild';
import {APP_VERSION,APP_STAGE,APP_RELEASE_TITLE} from '../platform/assets';
const CodeEditor = lazy(() => import("./CodeEditor"));
const ClassReviewPanel = lazy(() => import('../lessons/ClassReviewPanel'));

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    chip: (
      <>
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        {[8, 12, 16].map((n) => (
          <path key={n} d={`M${n} 3v3m0 12v3M3 ${n}h3m12 0h3`} />
        ))}
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z" />,
    upload: <path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" />,
    download: <path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5" />,
    history: <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" />,
    play: <path d="m8 5 11 7-11 7Z" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
    reset: <path d="M3 10a9 9 0 1 1 1 7M3 3v7h7" />,
    code: <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18" />,
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 5 5L20 7" />,
    undo: <path d="M8 4 3 9l5 5M3 9h12a6 6 0 0 1 0 12" />,
    redo: <path d="m16 4 5 5-5 5m5-5H9a6 6 0 0 0 0 12" />,
    edit: <path d="m16 3 5 5-12 12-6 1 1-6ZM13 6l5 5" />,
    trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
    terminal: <path d="m4 6 6 6-6 6m9 0h7" />,
    chevron: <path d="m9 5 7 7-7 7" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.code}
    </svg>
  );
}
function Modal({
  title,
  children,
  close,
  wide = false,
  large = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  large?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!,
      prior = document.activeElement as HTMLElement;
    el.showModal();
    el.querySelector<HTMLInputElement>("input")?.focus();
    const cancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    el.addEventListener("cancel", cancel);
    return () => {
      el.removeEventListener("cancel", cancel);
      el.close();
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""} ${large?'review-wide':''}`}
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Zatvori prozor"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Frame({ bytes }: { bytes: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const image = ctx.createImageData(128, 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 128; x++) {
        const on = (bytes[x + (y >> 3) * 128] ?? 0) & (1 << (y & 7)),
          i = (y * 128 + x) * 4;
        image.data[i] = on ? 141 : 20;
        image.data[i + 1] = on ? 236 : 33;
        image.data[i + 2] = on ? 208 : 38;
        image.data[i + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
  }, [bytes]);
  return (
    <canvas
      ref={ref}
      width="128"
      height="64"
      aria-label="Dijagnostički prikaz stvarnih framebuf piksela"
    />
  );
}
function Wires({ led }: { led: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [g, setG] = useState<{
    w: number;
    h: number;
    a: string;
    b: string;
    c: string;
    rx: number;
    ry: number;
  }>();
  useEffect(() => {
    const parent = ref.current!.parentElement!;
    const update = () => {
      const bounds = parent.getBoundingClientRect();
      const r = (s: string) => {
        const v = parent.querySelector(s)!.getBoundingClientRect();
        return {
          x: v.left - bounds.left,
          y: v.top - bounds.top,
          w: v.width,
          h: v.height,
        };
      };
      const b = r(".pcb"),
        l = r(".led-bulb"),
        t = r(".button-device>button"),
        p4 = r(".p4"),
        p5 = r(".p5"),
        ground = r(".gnd"),
        left = b.x - 20,
        top = l.y - 17,
        bottom = t.y + t.h + 8,
        right = Math.min(bounds.width - 16, l.x + l.w + 27),
        rx = l.x - 36;
      setG({
        w: bounds.width,
        h: bounds.height,
        rx,
        ry: top,
        a: `M${b.x - 5} ${p4.y + 3}H${left}V${top}H${rx - 10}M${rx + 10} ${top}H${l.x + 7}V${l.y + l.h + 6}`,
        b: `M${b.x - 5} ${p5.y + 3}H${left - 11}V${bottom}H${t.x + 7}V${t.y + t.h}`,
        c: `M${b.x + b.w + 5} ${ground.y + 3}H${right}V${l.y + l.h + 6}H${l.x + l.w - 7}M${right} ${ground.y + 3}V${bottom}H${t.x + t.w - 7}V${t.y + t.h}`,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);
  return (
    <svg
      ref={ref}
      className="fixture-wires"
      viewBox={g ? `0 0 ${g.w} ${g.h}` : undefined}
      aria-hidden="true"
    >
      {g && (
        <>
          <path d={g.a} className={led ? "wire active" : "wire"} />
          <rect
            x={g.rx - 10}
            y={g.ry - 3}
            width="20"
            height="6"
            fill="var(--raised)"
            stroke="#c89f69"
            strokeWidth="1.5"
          />
          <text
            x={g.rx}
            y={g.ry - 7}
            textAnchor="middle"
            fill="#a59775"
            fontSize="7"
          >
            330 Ω
          </text>
          <path d={g.b} className="wire signal" />
          <path d={g.c} className="wire ground" />
        </>
      )}
    </svg>
  );
}
const runLabels: Record<string, string> = {
  idle: "Spremno",
  loading: "Učitavanje",
  running: "Izvodi se",
  stopped: "Zaustavljeno",
  done: "Dovršeno",
  error: "Pogreška",
};
const saveLabels: Record<string, string> = {
  loading: "Učitavanje…",
  pending: "Nespremljene izmjene",
  saving: "Spremanje…",
  saved: "Spremljeno lokalno",
  error: "Spremanje nije uspjelo",
  conflict: "Sukob verzija",
};
type Dialog =
  | "class-review"
  | "radio"
  | "new"
  | "board"
  | "matrix"
  | "arduino"
  | "files"
  | "rename-file"
  | "delete-file"
  | "rename-project"
  | "projects"
  | "history"
  | "help"
  | "system"
  | "lessons"
  | "import"
  | null;
export default function App() {
  const [toast, setToast] = useState("");
  const offline = useOffline();
  const [labTab, setLabTab] = useState("circuit"), [expandedCircuit, setExpandedCircuit] = useState(false);
  const notify = (message: string) => setToast(message);
  const ws = useWorkspace(notify),
    p = ws.project,
    runtime = useRuntime();
  const [filesOpen,setFilesOpen]=useState(false),[workOpen,setWorkOpen]=useState(false),[codeExpanded,setCodeExpanded]=useState(false);
  const [outputOpen,setOutputOpen]=useState(false),[outputHeight,setOutputHeight]=useState(180),[split,setSplit]=useState(50);
  const workspaceRef=useRef<HTMLElement>(null);
  const [wrapLines,setWrapLines]=useState(false);
  useEffect(()=>{setOutputOpen(false);setCodeExpanded(false);},[p?.id]);
  useEffect(()=>{if(runtime.state==='error'){setOutputOpen(true);setTab('console');}},[runtime.state]);
  useEffect(()=>{if(labTab==='lesson'){setFilesOpen(false);setExpandedCircuit(false);setCodeExpanded(false);}},[labTab]);
  const showInstructions=()=>{setLabTab('lesson');setFilesOpen(false);setMobileTab('lesson');setExpandedCircuit(false);setCodeExpanded(false);};
  const [teacher,setTeacher] = useState(false);
  const [reviewSession,setReviewSession]=useState<ReviewSession>(emptyReviewSession),[reviewBusy,setReviewBusy]=useState(false);
  const reviewBusyRef=useRef(false);reviewBusyRef.current=reviewBusy;
  useEffect(()=>{
    if(!reviewSession.dirty&&!reviewBusy)return;
    const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[reviewSession.dirty,reviewBusy]);
  const [newBoard,setNewBoard] = useState<BoardId>(S3),[newLanguage,setNewLanguage]=useState<Language>('micropython');
  const compiler=useArduinoCompiler();
  const [reveal,setReveal]=useState<{path:string;line:number;column:number;token:number}>();
  const liveProject=useRef(p);liveProject.current=p;
  const runTicket=useRef(0);
  const lessonCheck = useLessonCheck(p, result=>ws.change("Zapis provjere rada", n=>{n.files[RESULT_FILE]=JSON.stringify(result,null,2);}),notify);
  const [dialog, setDialog] = useState<Dialog>(()=>new URL(location.href).searchParams.has('schoolReview')?'class-review':null),
    [field, setField] = useState(""),
    [formError, setFormError] = useState(""),
    [projects, setProjects] = useState<Stored[]>([]),
    [tab, setTab] = useState("console"),
    [mobileTab, setMobileTab] = useState("lab"),
    [cursor, setCursor] = useState({ row: 1, column: 1 }),
    [working, setWorking] = useState(false);
  const importRef = useRef<HTMLInputElement>(null),
    consoleRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    document.documentElement.dataset.theme = p?.settings.theme ?? "light";
  }, [p?.settings.theme]);
  useEffect(() => { runtime.clear(); }, [p?.id]);
  useEffect(() => {
    if (p) document.title = `${p.title} · ESP32 Lab`;
  }, [p?.title]);
  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [runtime.consoleText]);
  async function action(fn: () => Promise<unknown>) {
    setWorking(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function closeSidePanel(panel: 'files'|'lesson') {
    if(panel==='files')setFilesOpen(false);else setLabTab('circuit');
    setMobileTab('lab');
    requestAnimationFrame(()=>{
      const trigger=document.querySelector<HTMLButtonElement>(`button[aria-controls="${panel==='files'?'project-files':'lesson-instructions'}"]`);
      if(trigger?.getClientRects().length)trigger.focus();
      else document.querySelector<HTMLButtonElement>('.mobile-tabs button[aria-pressed="true"]')?.focus();
    });
  }
  function openDialog(next: Dialog, value = "") {
    setFormError("");
    if(next === "new"){setNewBoard(p?.board.id??S3);setNewLanguage(p?.language??'micropython');}
    setField(value);
    setDialog(next);
  }
  function exportProject(json = false) {
    if (!p) return;
    try {
      download(
        safeFilename(p.title) + (json ? ".json" : ".zip"),
        json ? JSON.stringify(p, null, 2) : exportZip(p),
        json ? "application/json" : "application/zip",
      );
      notify("Projekt je pripremljen za preuzimanje.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    await action(async () => {
      if (file.size > LIMITS.archiveBytes)
        throw Error("Najveća veličina paketa je 2 MiB.");
      const bytes=new Uint8Array(await file.arrayBuffer());
      const imported=OFFLINE_AVR?await importIntegratedProject(bytes,file.name):{project:importProject(bytes,file.name),result:null};
      const next=imported.project,copy=forkProject(next);
      runtime.stop();
      await ws.add(copy);
      if(OFFLINE_AVR&&imported.result)await saveOffline(copy,imported.result);
      setDialog(null);
      setLabTab(readWork(next)||next.files[URS_WORK]?"lesson":"circuit");setMobileTab("lab");
      notify("Projekt je uvezen kao zasebna kopija. Program nije pokrenut.");
    });
  }
  async function selectExample(key: string) {
    await action(async () => {
      runtime.stop();
      const e = (examples as Record<string, { title: string; code: string }>)[
          key
        ],
        next = newProject(e.code, e.title);
      next.settings.example = key;
      next.circuit = {kind:"stage0-fixture",components:[],wires:[]};
      setLabTab("fixture"); setMobileTab("lab");
      await ws.add(next);
      notify("Otvoren je novi projekt iz primjera.");
    });
  }
  async function selectCircuitExample(key:BasicExample = "button") {
    await action(async () => {
      runtime.stop();
      const e=basicExamples[key], next = newProject(e.code,e.title);
      next.settings.example="basic-"+key;
      next.circuit=exampleCircuit(key);
      await ws.add(next);
      setLabTab("circuit");setExpandedCircuit(false);setMobileTab("lab");
      notify("Otvoren je primjer. Pokreni program i promijeni ulaz ili kôd.");
    });
  }
  async function selectArduinoExample(key:ArduinoExample){
    await action(async()=>{
      const next=await loadArduinoExample(key,p?.board.id===S3?UNO:p?.board.id??UNO);
      runtime.stop();await ws.add(next);setLabTab('circuit');setExpandedCircuit(false);setMobileTab('lab');
      notify('Otvoren je Arduino primjer s prevedenim programom. Pokreni simulaciju.');
    });
  }
  async function selectEnvironmentExample(key:EnvironmentExample){
    await action(async()=>{
      const e=environmentExamples[key],files=await loadEnvironmentDrivers(key),next=newProject(e.code,e.title);
      next.files={...files,"main.py":e.code};next.circuit=environmentCircuit(key);next.settings.example="env-"+key;
      runtime.stop();await ws.add(next);setLabTab("circuit");setExpandedCircuit(false);setMobileTab("lab");
      notify("Otvoren je primjer s upravljačkim datotekama. Pokreni i promijeni okoliš.");
    });
  }
  async function selectSDExample(key:SDExample){
    await action(async()=>{
      const e=sdExamples[key],next=newProject(e.code,e.title);
      for(const name of ['lab_sdcard.py','lab_fat16.py',...(key==='sdLogger'?['lab_ds1302.py']:[])]){const r=await fetch(runtimeAsset('drivers/'+name));if(!r.ok)throw Error('Ne mogu učitati SD driver.');next.files[name]=await r.text();}
      next.circuit=sdCircuit(key);next.settings.example='sd-'+key;runtime.stop();await ws.add(next);setLabTab('circuit');setExpandedCircuit(false);setMobileTab('lab');notify('Otvoren je microSD primjer s vidljivim SPI i FAT16 izvorima.');
    });
  }
  async function selectOpticalExample(key:OpticalExample){
    await action(async()=>{
      const e=opticalExamples[key],next=newProject(e.code,e.title),r=await fetch(runtimeAsset('drivers/lab_max30102.py'));
      if(!r.ok)throw Error('Ne mogu učitati MAX30102 driver.');
      next.files={'main.py':e.code,'lab_max30102.py':await r.text()};next.circuit=opticalCircuit(key);next.settings.example='optical-'+key;
      runtime.stop();await ws.add(next);setLabTab('circuit');setExpandedCircuit(false);setMobileTab('lab');notify('Otvoren je MAX30102 primjer s vidljivim I2C driverom.');
    });
  }
  async function selectRTCExample(key:RTCExample){
    await action(async()=>{
      const e=rtcExamples[key],next=newProject(e.code,e.title),r=await fetch(runtimeAsset('drivers/lab_ds1302.py'));if(!r.ok)throw Error('Ne mogu učitati DS1302 driver.');
      next.files={'main.py':e.code,'lab_ds1302.py':await r.text()};
      if(key==='rtcClock'){const tm=await fetch(runtimeAsset('drivers/lab_tm1637.py'));if(!tm.ok)throw Error('Ne mogu učitati TM1637 driver.');next.files['lab_tm1637.py']=await tm.text();}
      next.circuit=rtcCircuit(key);next.settings.example='rtc-'+key;runtime.stop();await ws.add(next);setLabTab('circuit');setExpandedCircuit(false);setMobileTab('lab');
      notify('Otvoren je DS1302 primjer s vidljivim GPIO driverom.');
    });
  }
  async function selectPeripheralExample(){
    await action(async()=>{
      const files=await loadPeripheralDrivers(),next=newProject(peripheralExample.code,peripheralExample.title);
      next.files={...files,"main.py":peripheralExample.code};next.circuit=peripheralCircuit();next.settings.example="peripheral-regulator";
      runtime.stop();await ws.add(next);setLabTab("circuit");setExpandedCircuit(false);setMobileTab("lab");
      notify("Otvoren je primjer s upravljačkim datotekama. Pokreni i mijenjaj temperaturu ili vlagu.");
    });
  }
  async function selectLesson(id:string,solution=false){
    await action(async()=>{
      const lesson=getLesson(id);
      if(!lesson)throw Error("Nepoznata vježba.");
      const drivers=lesson.number>=4?await loadPeripheralDrivers():{};
      const next=createLessonProject(id,drivers,solution);
      runtime.stop();lessonCheck.cancel();await ws.add(next);
      setDialog(null);setTeacher(solution);setLabTab("lesson");setMobileTab("lesson");setExpandedCircuit(false);
      notify(solution?"Otvoren je zaseban nastavnički uzorak.":"Otvorena je vježba. Počni čitanjem novih pojmova i uputa.");
    });
  }
  async function submitLesson(){
    if(!p)return;
    await action(async()=>{const bytes=await exportSubmission(p);download(safeFilename(p.title)+"_predaja.zip",bytes,"application/zip");notify("ZIP za predaju je pripremljen za preuzimanje.");});
  }
  async function selectUrs(lesson:string,variant:string,target:UrsTarget,peer:UrsTarget){
    await action(async()=>{
      const next=await createUrsProject(lesson,variant,target,peer);
      await ws.flush();runtime.stop();lessonCheck.cancel();await ws.add(next);
      setDialog(null);setTeacher(false);setLabTab('lesson');setMobileTab('lesson');setExpandedCircuit(false);
      notify('Otvorena je URS vježba. Pročitaj pojmove, pregledaj spojeve i početni program.');
    });
  }
  async function recordUrs(){
    if(!p)return;
    const current=p;
    await action(async()=>{const work=await recordUrsSnapshot(current);if(liveProject.current!==current)throw Error('Sadržaj je promijenjen tijekom zapisivanja. Ponovi pregled.');ws.change('URS pregled sadržaja',n=>{n.files[URS_WORK]=JSON.stringify(work,null,2);});notify('Zabilježen je pregled sadržaja; opažanja ostaju ručni zapis.');});
  }
  async function reviewUrs(verdict:'revise'|'reviewed',note:string){
    if(!p)return;const current=p;
    await action(async()=>{const work=await recordUrsReview(current,verdict,note);if(liveProject.current!==current)throw Error('Sadržaj je promijenjen tijekom zapisivanja. Ponovi pregled.');ws.change('Nastavnički URS zapis',n=>{n.files[URS_WORK]=JSON.stringify(work,null,2);});notify('Nastavnički zapis je spremljen uz ovaj sadržaj.');});
  }
  async function submitUrs(){
    if(!p)return;
    await action(async()=>{download(safeFilename(p.title)+'_URS_predaja.zip',await exportUrsSubmission(p),'application/zip');notify('URS paket za predaju pripremljen je za preuzimanje.');});
  }
  function reviewImport(){setTeacher(true);openDialog("import");}
  async function openClassSubmission(project:Parameters<typeof forkProject>[0]){
    await ws.flush();runtime.stop(true);lessonCheck.cancel();
    await ws.add(forkProject(project));setTeacher(true);setDialog(null);setLabTab('lesson');setMobileTab('lesson');setExpandedCircuit(false);
    notify('Otvorena je zaustavljena kopija predaje. Za nastavak bilješki otvori Pregled razreda.');
  }
  async function updateApplication() {
    if (runtime.busy || lessonCheck.busy || working) return;
    setWorking(true);
    try {
      await ws.flush();
      runtime.stop(true);
      lessonCheck.cancel();
      await offline.activate();
    } finally { setWorking(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!p) return;
    try {
      const value = field.trim(),
        active = p.settings.activeFile;
      if (dialog === "import") {
        const next = importProject(
          new TextEncoder().encode(field),
          "projekt.json",
        );
        runtime.stop();
        await ws.add(forkProject(next));
        notify("Projekt je uvezen kao zasebna kopija.");
      }
      if (dialog === "new" || dialog === "rename-project") {
        if (!value || value.length > 100)
          throw Error("Upiši naziv do 100 znakova.");
        if (dialog === "new") {
          runtime.stop();
          const next = newProject(undefined, value, newBoard,newLanguage);
          next.settings.example = "";
          await ws.add(next);
          setLabTab("circuit"); setMobileTab("lab");
        } else
          ws.change("Promjena naziva", (n) => {
            n.title = value;
          });
      }
      if (dialog === "files" || dialog === "rename-file") {
        if (!validPath(value))
          throw Error(
            "Koristi npr. pomoc.py, pomoc.h ili lib/pomoc.cpp. Podržani su .py, .ino, .c, .cpp, .h, .hpp, .txt, .md i .json; nazivi su bez dijakritika.",
          );
        if(p.language==='arduino-cpp'&&/\.(ino|c|cpp|h|hpp)$/.test(value)&&!validArduinoPath(value))
          throw Error('Arduino izvor dodaj u korijen (pomoc.h) ili u src/ (src/pomoc.cpp). main.ino je početni program.');
        if(value===AVR_BUILD_FILE||value==='s3-build.json'||value===AVR_LIBRARY_FILE)throw Error('Ovu datoteku održava prozor Prevedi.');
        if (
          Object.keys(p.files).some(
            (path) =>
              path.toLowerCase() === value.toLowerCase() &&
              path !== (dialog === "rename-file" ? active : ""),
          )
        )
          throw Error("Datoteka s tim nazivom već postoji.");
        if (dialog === "rename-file" && active === p.entryFile)
          throw Error(p.entryFile + " je obvezna datoteka.");
        if (dialog === "files" && Object.keys(p.files).length >= 64)
          throw Error("Dosegnuto je ograničenje od 64 datoteke.");
        ws.change(
          dialog === "files" ? "Dodana datoteka" : "Preimenovana datoteka",
          (n) => {
            n.files[value] = dialog === "files" ? "" : n.files[active];
            if (dialog === "rename-file" && value !== active)
              delete n.files[active];
            n.settings.activeFile = value;
          },
        );
      }
      if (dialog === "delete-file") {
        if (active === p.entryFile) throw Error(p.entryFile + " se ne može obrisati.");
        ws.change("Obrisana datoteka", (n) => {
          delete n.files[active];
          n.settings.activeFile = n.entryFile;
        });
      }
      setDialog(null);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }
  if (!p)
    return (
      <div className="loading-screen">
        <Icon name="chip" size={40} />
        <h1>ESP32 MicroPython Lab</h1>
        <p>Otvaranje radnog okruženja…</p>
      </div>
    );
  const boardProfile=getBoard(p.board.id),availability=runtimeAvailability(p.board.id,p.language);
  const ursWork=readUrsWork(p),ursVariant=ursWork&&getUrsLesson(ursWork.lessonId)?.variants.find(v=>v.id===ursWork.variantId);
  const s = p.settings,
    active = s.activeFile,
    example = s.example.startsWith("optical-") ? opticalExamples[s.example.slice(8) as OpticalExample] : s.example.startsWith("sd-") ? sdExamples[s.example.slice(3) as SDExample] : s.example.startsWith("rtc-") ? rtcExamples[s.example.slice(4) as RTCExample] : s.example.startsWith("s3-") ? s3Examples[s.example.slice(3) as S3Example] : s.example.startsWith("avr-") ? arduinoExamples[s.example.slice(4) as ArduinoExample] : s.example.startsWith("env-") ? environmentExamples[s.example.slice(4) as EnvironmentExample] : s.example === "peripheral-regulator" ? peripheralExample : s.example.startsWith("basic-") ? basicExamples[s.example.slice(6) as BasicExample] : (examples as Record<string, { hint: string }>)[s.example];
  const run = async (reset=false) => {
    if(p?.radio){runtime.stop(true);openDialog("radio");return;}
    const ticket=++runTicket.current;
    setTab("console");
    setOutputOpen(true);
    if(!availability.available){notify(availability.message);return;}
    if(lessonCheck.busy)return;
    if(p.language==='arduino-cpp'){
      try{const snapshot=clone(p);if(OFFLINE_AVR&&prefersOffline(snapshot)){const artifact=await loadOffline(snapshot);if(ticket!==runTicket.current||liveProject.current?.id!==snapshot.id||liveProject.current?.revision!==snapshot.revision)return;void runtime.run(snapshot,reset,artifact);return;}const raw=snapshot.files[buildFile(snapshot)];let a:any=null;try{if(raw)a=await validateArtifact(snapshot,JSON.parse(raw));}catch{}if(!a){a=await cachedBuild(snapshot);if(!a)throw Error('Najprije prevedi program.');snapshot.files[buildFile(snapshot)]=JSON.stringify(a);}if(ticket!==runTicket.current||liveProject.current?.id!==snapshot.id||liveProject.current?.revision!==snapshot.revision)return;void runtime.run(snapshot,reset);}
      catch{openDialog('arduino');notify('Prevedi aktualni izvor prije pokretanja.');}
    }else void runtime.run(clone(p),reset);
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">Prijeđi na radno područje</a>
      <header className="topbar">
        <a href={appAsset('')} className="brand" aria-label="Labos · početna stranica">
          <span className="brand-icon">
            <Icon name="chip" size={23} />
          </span>
          <span>
            <b>Labos</b>
            <small>MICROPYTHON · ARDUINO</small>
          </span>
        </a>
        <span className="header-divider" />
        <button
          className="project-title"
          onClick={() => openDialog("rename-project", p.title)}
          title="Promijeni naziv projekta"
        >
          {p.title}
          <Icon name="edit" size={13} />
        </button>
        <span className={`save-state ${ws.status}`} role="status">
          <span className="dot" />
          {saveLabels[ws.status]}
        </span>
        <div className="header-actions">
          <SchoolAccountLink />
          <button className="system-trigger" onClick={() => openDialog('system')} aria-label="Status aplikacije i offline rad">{offline.update ? 'Nova verzija' : offline.phase === 'ready' ? 'Offline spreman' : 'Status i offline'}</button>
          <button
            className="help-button"
            onClick={() => openDialog("help")}
            aria-label="Pomoć i mogućnosti"
          >
            ?
          </button>
          <button
            className="icon-button"
            aria-label={
              s.theme === "light"
                ? "Uključi tamnu temu"
                : "Uključi svijetlu temu"
            }
            onClick={() =>
              ws.change("Promjena teme", (n) => {
                n.settings.theme = s.theme === "light" ? "dark" : "light";
              })
            }
          >
            <Icon name={s.theme === "light" ? "moon" : "sun"} />
          </button>
          <a className="stage-tag" href={appAsset('school.html')} title={'Školsko izdanje · '+APP_RELEASE_TITLE}>v{APP_VERSION}</a>
        </div>
      </header>
      <div className="toolbar">
        <div className="project-actions">
          <button onClick={() => openDialog("lessons")} disabled={working}>
            <Icon name="code" /> Vježbe
          </button>
          <button className="desktop-panel-action" aria-expanded={filesOpen} aria-controls="project-files" onClick={()=>{setFilesOpen(v=>!v);setLabTab('circuit');setMobileTab(filesOpen?'lab':'files');}}>Datoteke</button>
          {(readWork(p)||readUrsWork(p))&&<button className="desktop-panel-action" aria-expanded={labTab==='lesson'} aria-controls="lesson-instructions" onClick={()=>labTab==='lesson'?(setLabTab('circuit'),setMobileTab('lab')):showInstructions()}>Upute</button>}
          <button aria-expanded={workOpen} aria-controls="my-work" onClick={()=>setWorkOpen(v=>!v)}>Moj rad</button>
          <ActionGroup title="Projekt">
          <button
            onClick={() => openDialog("new", "Novi projekt")}
            disabled={working}
          >
            <Icon name="plus" />
            Novi
          </button>
          <button onClick={()=>openDialog('board')} disabled={working} aria-label="Promijeni pločicu i jezik">{boardProfile.short}</button>
          <button
            onClick={() =>
              void action(async () => {
                await ws.flush();
                setProjects(await ws.list());
                openDialog("projects");
              })
            }
            disabled={working}
          >
            <Icon name="folder" />
            Projekti
          </button>
          <button onClick={() => openDialog("import")} disabled={working}>
            <Icon name="upload" />
            Uvezi
          </button>
          <button onClick={() => exportProject()}>
            <Icon name="download" />
            Izvezi ZIP
          </button>
          <button
            onClick={() => openDialog("history")}
            title="Povijest spremljenih verzija"
          >
            <Icon name="history" />
            <span className="history-text">Povijest</span>
          </button>
          <button onClick={()=>{runtime.stop(true);lessonCheck.cancel();openDialog("radio");}} disabled={working}>Dva čvora</button>
          </ActionGroup>
          <ActionGroup title="Nastavnik">
          <button onClick={() => {setTeacher(true);showInstructions();}}>Pregled predaje</button>
          <button onClick={()=>openDialog('class-review')} disabled={working||reviewBusy}>Pregled razreda</button>
          </ActionGroup>

        </div>
        <div className="run-actions">
          {p.language==='arduino-cpp'&&<button onClick={()=>openDialog('arduino')}>Prevedi</button>}
          <button className={`runtime-status ${runtime.state}`} onClick={()=>{setTab('console');setOutputOpen(true);setMobileTab('output');}} aria-label={'Otvori izlaz: '+runLabels[runtime.state]}>
            <span className="dot" />
            {runLabels[runtime.state]}
          </button>
          <button className="run-button" onClick={()=>void run()} disabled={runtime.busy || lessonCheck.busy || !availability.available} title={availability.message}>
            <Icon name="play" size={16} />
            Pokreni
          </button>
          <button
            className="stop-button"
            onClick={()=>runtime.stop(true)}
            disabled={!runtime.busy && (!runtime.simulation||runtime.state==="stopped")}
            title="Zaustavi program"
          >
            <Icon name="stop" size={16} />
            <span>Zaustavi</span>
          </button>
          <button
            className="icon-button"
            onClick={() => {if(p.radio){runtime.stop(true);openDialog("radio");}else if(!lessonCheck.busy)void run(true);}}
            disabled={lessonCheck.busy || !availability.available}
            title="Resetiraj i pokreni u čistom okruženju"
            aria-label="Resetiraj program"
          >
            <Icon name="reset" />
          </button>
        </div>
      </div>
      {p.language==='arduino-cpp'&&<div className="target-strip" role="status"><span><b>{boardProfile.title} · Arduino C/C++</b> — {p.board.id===S3?'funkcionalni WASM':'AVR simulacija'} · {OFFLINE_AVR&&prefersOffline(p)?'offline prototip u pregledniku':compiler.mode==='school'&&compiler.capabilities.targets?.[p.board.id]?.ready?'školski prevoditelj spreman':compiler.connection==='connected'?'lokalni prevoditelj povezan':'odaberi prevoditelj u prozoru Prevedi'}.</span>{p.board.id!==S3&&<span className={`avr-indicator ${runtime.simulation?.gpios[13]?.level===1?'on':''}`}><i/>LED L · D13</span>}<button onClick={()=>openDialog('arduino')}>Prevođenje i program</button><button onClick={()=>openDialog('matrix')}>Matrica podrške</button></div>}
      {(offline.update || !offline.online) && <div className="offline-strip" role="status"><span>{offline.update ? 'Nova verzija je pripremljena. Projekt spremi prije ažuriranja.' : offline.phase === 'ready' ? 'Radiš bez mreže. Projekti se spremaju u ovom pregledniku.' : 'Nema mreže; offline paket još nije potvrđen. Sačuvaj ZIP projekta.'}</span><button onClick={() => openDialog('system')}>Otvori status</button></div>}
      <input
        ref={importRef}
        type="file"
        accept=".zip,.json"
        hidden
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <SchoolAssignment expanded={workOpen} onExpand={()=>setWorkOpen(true)} project={p} confirm={binding=>{if(binding.status==='locked'){runtime.stop();lessonCheck.cancel();}ws.change('Potvrda školskog spremanja',next=>{if(next.id===p.id)next.files['school-attempt.json']=JSON.stringify(binding);},false);}} open={async next=>{
        setWorking(true);
        try{await ws.flush();runtime.stop();lessonCheck.cancel();await ws.add(next);setLabTab('lesson');setMobileTab('lesson');setExpandedCircuit(false);setTeacher(false);notify('Otvorena je školska vježba. Provjeri stanje spremanja iznad radnog područja.');}
        finally{setWorking(false);}
      }}/>
      {!readSchoolBinding(p)&&<section id="my-work" className="local-work" hidden={!workOpen} aria-label="Moj lokalni rad">
        <div><h2>Moj rad · lokalni projekt</h2><p>{saveLabels[ws.status]}. ZIP sadrži sve datoteke, sklop i unesene odgovore. Izvoz nije službena školska predaja.</p></div>
        <button onClick={()=>void action(ws.flush)}>Spremi sada</button><button onClick={()=>exportProject()}>Izvezi rad ZIP</button>
        {(readWork(p)||readUrsWork(p))&&<button onClick={showInstructions}>Odgovori i završetak vježbe</button>}
      </section>}
      {ws.error && (
        <div className="error-banner" role="alert">
          <span>{ws.error}</span>
          {ws.status === "conflict" && (
            <>
              <button onClick={() => void action(ws.rescue)}>
                Spremi kao kopiju
              </button>
              <button onClick={() => void action(() => ws.open(p.id, true))}>
                Učitaj spremljenu
              </button>
            </>
          )}
          <button onClick={() => exportProject()}>Izvezi projekt</button>
        </div>
      )}
      <nav className="mobile-tabs" aria-label="Područja radnog okruženja">
        {[
          ["files", "Datoteke"],
          ["lesson", "Upute"],
          ["lab", "Sklop"],
          ["code", "Kôd"],
          ["output", "Izlaz"],
        ].map(([id, title]) => (
          <button
            key={id}
            className={mobileTab === id ? "selected" : ""}
            aria-pressed={mobileTab===id}
            onClick={() => {setMobileTab(id);if(id==='lesson')showInstructions();if(id==='files')setFilesOpen(true);if(id==='output')setOutputOpen(true);}}
          >
            {title}
          </button>
        ))}
      </nav>
      <main ref={workspaceRef} id="workspace" tabIndex={-1} inert={readSchoolBinding(p)?.status==='locked'} hidden={readSchoolBinding(p)?.status==='locked'}
        style={{'--split-left':split+'fr','--split-right':(100-split)+'fr','--output-height':(outputOpen?outputHeight:44)+'px'} as CSSProperties}
        className={`workspace ${filesOpen?'files-open':''} ${labTab==='lesson'?'instructions-open':''} show-${mobileTab} ${expandedCircuit?'circuit-focus':''} ${codeExpanded?'code-focus':''} ${outputOpen?'output-open':'output-closed'}`}>

        <aside id="project-files" className="sidebar" aria-label="Datoteke projekta">
          <div className="section-heading">
            DATOTEKE
            <button onClick={()=>closeSidePanel("files")} aria-label="Sklopi datoteke">×</button>
            <button
              className="icon-button"
              onClick={() => openDialog("files", p.language==="micropython"?"pomoc.py":"pomoc.h")}
              aria-label="Dodaj datoteku"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
          <div className="tree-root">
            <Icon name="folder" size={16} />
            <strong title={p.title}>{p.title}</strong>
            <span>{Object.keys(p.files).length}</span>
          </div>
          <ProjectFiles key={p.id} files={p.files} active={active} entryFile={p.entryFile} onSelect={path => {
            ws.change('Odabrana datoteka', n => {n.settings.activeFile = path;});
            setMobileTab('code');
          }}/>
          <button
            className="add-file"
            onClick={() => openDialog("files", p.language==="micropython"?"pomoc.py":"pomoc.h")}
          >
            <Icon name="plus" size={14} />
            Nova datoteka
          </button>

          <details className="sidebar-section example-library"><summary>Primjeri i pokusi jezgre</summary>
            <div className="section-heading">ESP32-S3 · ARDUINO C++</div>
            {Object.entries(s3Examples).map(([key,e],i)=><button key={key} className="example-row" disabled={working} onClick={()=>void action(async()=>{const next=await loadS3Example(key as S3Example);runtime.stop();await ws.add(next);setLabTab('circuit');setExpandedCircuit(false);setMobileTab('lab');notify('Otvoren je S3 C++ primjer. Pokreni simulaciju.');})}><span>{i+1}</span><b>{e.title}</b></button>)}
            <div className="section-heading">ARDUINO · UNO / NANO</div>
            {Object.entries(arduinoExamples).map(([key,e],i)=><button key={key} className="example-row" disabled={working} onClick={()=>void selectArduinoExample(key as ArduinoExample)}><span>{i+1}</span><b>{e.title}</b></button>)}
            <div className="section-heading">ESP32 · MICROPYTHON PRIMJERI</div>
            {Object.entries(opticalExamples).map(([key,e])=><button key={key} className="example-row" disabled={working} onClick={()=>void selectOpticalExample(key as OpticalExample)}><span>◉</span><b>{e.title}</b></button>)}
            {Object.entries(sdExamples).map(([key,e])=><button key={key} className="example-row" disabled={working} onClick={()=>void selectSDExample(key as SDExample)}><span>▣</span><b>{e.title}</b></button>)}
            {Object.entries(rtcExamples).map(([key,e])=><button key={key} className="example-row" disabled={working} onClick={()=>void selectRTCExample(key as RTCExample)}><span>◷</span><b>{e.title}</b></button>)}
            <button className="example-row" disabled={working} onClick={()=>void selectPeripheralExample()}><span>4</span><b>{peripheralExample.title}</b></button>
            {Object.entries(environmentExamples).map(([key,e],i)=><button key={key} className="example-row" disabled={working} onClick={()=>void selectEnvironmentExample(key as EnvironmentExample)}><span>{i+5}</span><b>{e.title}</b></button>)}
            <div className="section-heading">OSNOVNI SIMULATOR</div>
            {Object.entries(basicExamples).map(([key,e],i)=><button key={key} className="example-row" disabled={working} onClick={()=>void selectCircuitExample(key as BasicExample)}><span>{i+1}</span><b>{e.title}</b></button>)}
            <div className="section-heading">POKUSI JEZGRE</div>
            <p>Svaki primjer otvara novi projekt.</p>
            {Object.entries(examples).map(([key, value], i) => (
              <button
                key={key}
                className="example-row"
                disabled={working}
                onClick={() => void selectExample(key)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <b>{value.title}</b>
                <Icon name="chevron" size={13} />
              </button>
            ))}
          </details>
          <div className="sidebar-foot">
            <span className="micro-label">REFERENTNA PLOČICA</span>
            <button className="board-switch" aria-label="Pločica i jezik" onClick={()=>openDialog('board')}><strong>{boardProfile.title} ↗</strong><span>{languageName(p.language)} · {boardProfile.logicVoltage.toLocaleString('hr-HR')} V</span></button>
            <button onClick={()=>openDialog('matrix')}>Katalog i matrica podrške</button>
            {p.language==='arduino-cpp'&&<button className="source-export" onClick={()=>{try{download(safeFilename(p.title)+'_Arduino.zip',exportSketch(p),'application/zip');notify('Pripremljen je izvorni sketch za Arduino IDE.');}catch(e){notify((e as Error).message);}}}>Izvezi za Arduino IDE</button>}
            <a href={appAsset('diagnostics.html')} target="_blank" rel="noreferrer">
              Provjere jezgre ↗
            </a>
          </div>
        </aside>
        <aside id="lesson-instructions" className="instructions-panel" aria-label="Upute za vježbu">
          <div className="panel-heading"><h2>Upute za vježbu</h2><button onClick={()=>closeSidePanel("lesson")} aria-label="Sklopi upute">×</button></div>
          {p.files[URS_WORK] && <UrsPanel key={p.id} project={p} change={work=>ws.change('URS odgovori i opažanja',n=>{n.files[URS_WORK]=JSON.stringify(work,null,2);})}
            busy={working||runtime.busy||lessonCheck.busy} teacher={teacher} toggleTeacher={()=>setTeacher(v=>!v)} catalog={()=>openDialog('lessons')} circuit={()=>{setLabTab('circuit');setMobileTab('lab');}} run={run} radio={()=>openDialog('radio')}
            investigate={()=>void action(async()=>{await ws.flush();runtime.stop();lessonCheck.cancel();await ws.add(investigationProject(p));setLabTab('lesson');notify('Otvorena je lokalna istraživačka kopija. Izvorni pokušaj ostao je u Projektima.');})} record={()=>void recordUrs()} submit={()=>void submitUrs()} review={(verdict,note)=>void reviewUrs(verdict,note)} importReview={reviewImport}/>}
          {!p.files[URS_WORK] && <LessonPanel project={p}
            change={work=>ws.change("Odgovori vježbe",n=>{n.files[WORK_FILE]=JSON.stringify(work,null,2);})}
            busy={lessonCheck.busy} progress={lessonCheck.progress} run={()=>{runtime.stop();void lessonCheck.run();}} cancel={lessonCheck.cancel}
            submit={()=>void submitLesson()} circuit={()=>{setLabTab('circuit');setMobileTab('lab');}} catalog={()=>openDialog("lessons")}
            teacher={teacher} toggleTeacher={()=>setTeacher(v=>!v)} importReview={reviewImport}/>}
        </aside>
        <section className="lab-panel" aria-label="Laboratorij">
          <div className="panel-heading">
            <div>
              <Icon name="chip" size={17} />
              <h1>Sklop</h1>
            </div>
            <span className="subtle-tag">{labTab === "lesson" ? "UČENJE I PREDAJA" : labTab !== "fixture" ? "SASTAVLJANJE" : "ISPITNI SKLOP"}</span>
          </div>
          <div className="lab-view-tabs" role="tablist" aria-label="Način laboratorija" onKeyDown={tabKeys}>

            <button role="tab" id="lab-tab-circuit" aria-controls="lab-content" tabIndex={labTab !== "fixture"?0:-1} aria-selected={labTab !== "fixture"} className={labTab !== "fixture" ? "selected" : ""} onClick={() => setLabTab("circuit")}>Sastavljanje</button>
            <button role="tab" id="lab-tab-fixture" aria-controls="lab-content" tabIndex={labTab === "fixture"?0:-1} aria-selected={labTab === "fixture"} className={labTab === "fixture" ? "selected" : ""} onClick={() => setLabTab("fixture")}>Pokusi jezgre</button>
          </div>
          <div id="lab-content" role="tabpanel" aria-labelledby={`lab-tab-${labTab==='fixture'?'fixture':'circuit'}`} tabIndex={0} className="lab-tab-content">
          <div className="circuit-view" hidden={labTab==='fixture'}><CircuitEditor key={p.id} circuit={p.circuit} language={p.language}
            onChange={(c, label, kind) => { runtime.stop(kind === "snapshot"); ws.change(label, n => {n.circuit = c; n.settings.example = "";}); }}
            onDemo={() => void selectCircuitExample()}
            onUndo={()=>{runtime.stop();ws.undo();}} onRedo={()=>{runtime.stop();ws.redo();}} canUndo={!!ws.undoCount} canRedo={!!ws.redoCount}
            simulation={runtime.simulation} runtimeActive={["running","done"].includes(runtime.state)} liveInputs={runtime.liveInputs} onInput={runtime.input}
            expanded={expandedCircuit} onExpand={() => {setExpandedCircuit(v=>!v);setCodeExpanded(false);setMobileTab("lab");}} /></div>
          {labTab === "fixture" && p.circuit.kind !== "stage0-fixture" && <div className="assembly-start"><h2>Pokusi s MicroPythonom</h2><p>Odaberi jedan od primjera 01–05 u popisu „Pokusi jezgre”. Svaki otvara zaseban projekt s fiksnim ispitnim spojem.</p><button onClick={() => void selectExample("button")}>Otvori pokus s tipkalom</button><small>Nacrtani sklop izvodi se na kartici Sastavljanje.</small></div>}
          {labTab === "fixture" && p.circuit.kind === "stage0-fixture" && <>
          <div className="lab-canvas">
            <div className="canvas-label">
              <span className="dot" />
              Fiksne veze · GPIO 4 / 5 / 8 / 9
            </div>
            <Wires led={runtime.led} />
            <div
              className="pcb"
              aria-label="Pojednostavljeni prikaz referentne pločice ESP32-S3"
            >
              <div className="pcb-pins left">
                {Array.from({ length: 12 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
              <div className="pcb-pins right">
                {Array.from({ length: 12 }, (_, i) => (
                  <i key={i} />
                ))}
              </div>
              <div className="antenna">
                <i />
                <i />
                <i />
              </div>
              <div className="module">
                <span>ESPRESSIF</span>
                <Icon name="chip" size={38} />
                <b>ESP32-S3</b>
                <small>WROOM-1</small>
              </div>
              <div className="pin-label p4">4</div>
              <div className="pin-label p5">5</div>
              <div className="pin-label gnd">GND</div>
              <small className="pcb-name">DevKitC-1 · v1.1</small>
              <div className="usb" />
            </div>
            <div className={`led-device ${runtime.led ? "on" : ""}`}>
              <span className="led-bulb" />
              <strong>LED</strong>
              <small>GPIO4 · {runtime.led ? "HIGH / 1" : "LOW / 0"}</small>
            </div>
            <div className="button-device">
              <button
                className={runtime.button ? "pressed" : ""}
                onClick={runtime.toggleButton}
                aria-pressed={runtime.button}
                aria-label={
                  runtime.button
                    ? "Otpusti virtualno tipkalo"
                    : "Pritisni virtualno tipkalo"
                }
              >
                <span />
              </button>
              <strong>Tipkalo</strong>
              <small>
                GPIO5 · {runtime.button ? "GND / 0" : "pull-up / 1"}
              </small>
            </div>
            <div className="board-caption">
              ESP32-S3<small>Referentni profil N16R8</small>
            </div>
          </div>
          <div className="lab-description">
            <span className="small-number">01</span>
            <div>
              <strong>Program upravlja izlazom</strong>
              <p>
                Pritisni <b>Pokreni</b>, zatim virtualno tipkalo. LED-ica
                prikazuje stanje GPIO4 iz tvojeg programa.
              </p>
            </div>
          </div>
          <div className="fixture-settings">
            <details>
              <summary>
                Svojstva ispitnog sklopa <Icon name="chevron" size={14} />
              </summary>
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={s.powered}
                    disabled={runtime.busy}
                    onChange={(e) =>
                      ws.change("Napajanje I2C uređaja", (n) => {
                        n.settings.powered = e.target.checked;
                      })
                    }
                  />
                  Napajanje I2C echo uređaja 0x38
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={s.swapped}
                    disabled={runtime.busy}
                    onChange={(e) =>
                      ws.change("Promjena I2C spoja", (n) => {
                        n.settings.swapped = e.target.checked;
                      })
                    }
                  />
                  Zamijeni SDA i SCL (pokus pogreške)
                </label>
                <p>SDA=8, SCL=9. Promjene vrijede pri novom pokretanju.</p>
              </div>
            </details>
          </div>
          <div className="frame-card">
            <div>
              <span className="micro-label">DIJAGNOSTIČKI PRIKAZ</span>
              <strong>
                framebuf <span>128 × 64</span>
              </strong>
              <p>
                Pikseli iz izvornog modula.
                <br />
                Odaberi primjer 05 za prikaz.
              </p>
            </div>
            <Frame bytes={runtime.frame} />
          </div>
          <div className="scope-note">
            Fiksni pokus jezgre iz etape 0. Uređivanje vlastitih spojeva otvori karticom Sastavljanje.
          </div>
          </>}
          </div>
        </section>
        <div className="workspace-divider" role="separator" tabIndex={0} aria-label="Širina sklopa" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={70} aria-valuenow={split}
          onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setSplit(v=>e.key==='Home'?30:e.key==='End'?70:Math.max(30,Math.min(70,v+(e.key==='ArrowRight'?5:-5))));}}}
          onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);}}
          onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const lab=workspaceRef.current?.querySelector('.lab-panel')?.getBoundingClientRect(),code=workspaceRef.current?.querySelector('.code-panel')?.getBoundingClientRect();if(lab&&code)setSplit(Math.max(30,Math.min(70,Math.round((e.clientX-lab.left)/(code.right-lab.left)*100))));}}
          onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}/>
        <section className="code-panel" aria-label="Editor koda">
          <div className="panel-heading">
            <div>
              <Icon name="code" size={17} />
              <h2>Kôd</h2>
            </div>
            <div className="editor-tools">
              <button className="wrap-lines" aria-pressed={wrapLines} onClick={()=>setWrapLines(v=>!v)} title="Prikaži dugi redak u više vizualnih redaka, bez promjene koda">Prelomi retke</button>
              <button onClick={()=>{setCodeExpanded(v=>!v);setExpandedCircuit(false);}}>{codeExpanded?'Sklop uz kôd':'Proširi kôd'}</button>
              <button
                className="icon-button"
                disabled={!ws.undoCount}
                onClick={()=>{runtime.stop();ws.undo();}}
                aria-label="Poništi izmjenu projekta"
              >
                <Icon name="undo" size={15} />
              </button>
              <button
                className="icon-button"
                disabled={!ws.redoCount}
                onClick={()=>{runtime.stop();ws.redo();}}
                aria-label="Ponovi izmjenu projekta"
              >
                <Icon name="redo" size={15} />
              </button>
              <span className="toolbar-sep" />
              <button
                className="font-button"
                disabled={s.fontSize === 12}
                onClick={() =>
                  ws.change("Veličina fonta", (n) => {
                    n.settings.fontSize = Math.max(12, s.fontSize - 1);
                  })
                }
                aria-label="Smanji font"
              >
                A−
              </button>
              <button
                className="font-button"
                disabled={s.fontSize === 24}
                onClick={() =>
                  ws.change("Veličina fonta", (n) => {
                    n.settings.fontSize = Math.min(24, s.fontSize + 1);
                  })
                }
                aria-label="Povećaj font"
              >
                A+
              </button>
            </div>
          </div>
          <FileTabs key={p.id} files={p.files} active={active}
            onSelect={path => ws.change('Odabrana datoteka', n => {n.settings.activeFile = path;})}
            onCreate={() => openDialog('files', p.language === 'micropython' ? 'pomoc.py' : 'pomoc.h')}/>
          <div id="file-content" role="tabpanel" aria-labelledby={fileTabId(active)} className="file-tab-content">
          <div className="editor-file-info">
            <span>{active}</span>
            <div>
              <button
                className="text-action"
                disabled={active === p.entryFile}
                onClick={() => openDialog("rename-file", active)}
                aria-label="Preimenuj datoteku"
              >
                <Icon name="edit" size={13} />
              </button>
              <button
                className="text-action"
                disabled={active === p.entryFile}
                onClick={() => openDialog("delete-file")}
                aria-label="Obriši datoteku"
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
          <Suspense
            fallback={<div className="editor-loading">Učitavanje editora…</div>}
          >
            <CodeEditor
              key={p.id}
              path={active}
              value={p.files[active]}
              theme={s.theme}
              fontSize={s.fontSize}
              wrapLines={wrapLines}
              reveal={reveal?.path===active?reveal:undefined}
              onChange={(v) =>
                ws.change(`Uređivanje ${active}`, (n) => {
                  n.files[active] = v;
                })
              }
              onRun={run}
              onSave={() => void action(ws.flush)}
              onCursor={(row, column) => setCursor({ row, column })}
            />
          </Suspense>
          <p id="editor-keyboard-help" className="editor-keyboard-help">Tab uvlači kôd. Za izlazak iz editora pritisni Esc, zatim Tab.</p>
          <div className="editor-status">
            <span>
              Redak {cursor.row}, stupac {cursor.column}
            </span>
            <span>
              {active.endsWith(".py") ? "Python" : /\.(ino|cpp|c|h|hpp)$/.test(active) ? "C/C++" : "Tekst"} · UTF-8 · 4 razmaka
            </span>
          </div>
          <div
            className={`editor-hint ${runtime.busy && runtime.runRevision !== p.revision ? "changed" : ""}`}
          >
            <span>↳</span>
            {runtime.busy && runtime.runRevision !== p.revision
              ? "Izmjene će se primijeniti pri novom pokretanju."
              : ((ursVariant?ursExampleHint(ursVariant,p):example?.hint) ??
                (p.language==="micropython"?"Program počinje u main.py. Druge Python datoteke uvedi naredbom import.":"Program počinje u main.ino. setup() se izvodi jednom, a loop() se ponavlja. Novi izvor ponovno prevedi preko gumba Prevedi."))}
          </div>
          </div>
        </section>
        <section className="bottom-panel" aria-label="Izlaz i informacije">
          <div className="output-resizer" hidden={!outputOpen} role="separator" tabIndex={0} aria-label="Visina izlaza" aria-orientation="horizontal" aria-valuemin={120} aria-valuemax={360} aria-valuenow={outputHeight}
            onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();setOutputHeight(h=>e.key==='Home'?120:e.key==='End'?360:Math.max(120,Math.min(360,h+(e.key==='ArrowUp'?20:-20))));}}}
            onPointerDown={e=>e.currentTarget.setPointerCapture(e.pointerId)} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){const bottom=e.currentTarget.parentElement!.getBoundingClientRect().bottom;setOutputHeight(Math.max(120,Math.min(360,Math.round(bottom-e.clientY))));}}} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)}/>
          <div className="bottom-tabs">
            <div role="tablist" aria-label="Izlaz" onKeyDown={tabKeys}>
              {[
                ["console", "Izlaz programa"],
                ["project", "Podaci projekta"],
                ["support", "Podrška"],
              ].map(([id, title]) => (
                <button
                  key={id}
                  role="tab"
                  id={`output-tab-${id}`} aria-controls="output-content" tabIndex={tab===id?0:-1}
                  aria-selected={tab === id}
                  className={tab === id ? "selected" : ""}
                  onClick={() => {setTab(id);setOutputOpen(true);}}
                >
                  {id === "console" && <Icon name="terminal" size={15} />}
                  <span>{title}</span>
                </button>
              ))}
            </div>
            <div className="console-tools">
              {runtime.state==='error'&&<strong role="alert">Pogreška programa</strong>}
              <button aria-expanded={outputOpen} aria-controls="output-content" onClick={()=>setOutputOpen(v=>!v)}>{outputOpen?'Sklopi izlaz':'Proširi izlaz'}</button>
              {tab === "console" && (
                <>
                  <span>{p.language==='micropython'?'MicroPython 1.29.0':p.board.id===S3?'ESP32-S3 C++ · Serial':'Arduino AVR · UART'}</span>
                  <button onClick={runtime.clear} aria-label="Očisti konzolu">
                    <Icon name="trash" size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div hidden={!outputOpen} id="output-content" role="tabpanel" aria-labelledby={`output-tab-${tab}`} tabIndex={0} className="output-tab-content">
          {tab === "console" && (
            <pre
              ref={consoleRef}
              className={`console ${runtime.state === "error" ? "console-error" : ""}`}
              aria-label="Izlaz programa"
              tabIndex={0}
            >
              {runtime.consoleText || (
                <span className="console-empty">
                  <b>›</b> {!availability.available ? availability.message : p.circuit.kind === "editable" ? `Pokreni ${p.entryFile} na spojevima ovog projekta. Ulazi su ispod radne površine.` : "Konzola je spremna. Pokreni program za prikaz izlaza."}
                </span>
              )}
            </pre>
          )}
          {tab==='console'&&p.language==='arduino-cpp'&&<ArduinoSerial running={runtime.state==='running'} send={runtime.sendSerial}/>}
          {tab === "project" && (
            <div className="project-info">
              <div>
                <small>FORMAT PROJEKTA</small>
                <strong>ESP32 Lab · v{p.schemaVersion}</strong>
                <span>
                  {Object.keys(p.files).length} datoteka · revizija {p.revision}
                </span>
              </div>
              <div>
                <small>SPREMANJE</small>
                <strong>Ovaj preglednik</strong>
                <span>Za prijenos na drugo računalo koristi ZIP.</span>
              </div>
              <div>
                <button onClick={() => void action(ws.flush)}>
                  <Icon name="check" size={15} />
                  Spremi sada
                </button>
                <button onClick={() => exportProject(true)}>
                  <Icon name="download" size={15} />
                  Izvezi JSON
                </button>
              </div>
            </div>
          )}
          {tab === "support" && (
            <div className="support-info">
              <p>
                <button onClick={()=>openDialog("matrix")}>Otvori katalog i matricu podrške</button><br/><b>ESP32 / MicroPython:</b> stvarni MicroPython na nacrtanim spojevima, GPIO, ADC, PWM, tipkala, potenciometri, LED, AHT10, BMP180/BMP280/AM2320, SSD1306 128 × 64 / 128 × 32, LCD1602/PCF8574, DHT/DS18B20, KY-040, NEC IR, TM1637, DS1302 RTC s baterijskim stanjem, idealizirani hobi servo i kalibrirani SG90. Relej preklapa COM/NO/NC; L298N upravlja dvama DC motorima, a aktivni/pasivni zvučni profili prikazuju frekvenciju i nude opcionalno slušanje. I2C: scan, writeto, writevto, readfrom, readfrom_into, init/deinit. Upravljačke datoteke i framebuf stvaraju sadržaj OLED-a; očitanja se izvoze u CSV.
              </p>
              <p><b>ESP32-S3 / Arduino C/C++:</b> 19 primjera izvršava stvarno prevedeni WASM. GPIO, ADC, LEDC po priključku, Serial, Wire/Wire1 i SPI koriste postojeće modele sklopa. Novi izvor zahtijeva lokalni Clang 19.1.7 + Binaryen 120; pripremljeni primjeri već nose rezultat. DHT11/DHT22, više DS18B20 i U8g2 OLED 128×64/32 imaju stvarne upravljačke biblioteke i provjere nevaljanih podataka. DS1302 i RTC → TM1637 koriste vidljive GPIO drivere, kalendar, CH/WP i RAM. Opseg je naveden u matrici. Ovo je funkcionalni profil; nije Espressif core ni firmware za fizičku pločicu.</p>
              <p>
                <b>Granice ESP32 modela:</b> funkcionalni modeli bez emulacije procesora i analogne dinamike. AHT10 koristi zasebnu sabirnicu; podržani su repeated-start i memorijski I2C pozivi. Pet nastavnih vježbi i predaja dostupni su na kartici Vježba. Stvarni učenički pilot još treba provesti; offline paket dostupan je kroz Status i offline. Uno/Nano izvršavaju stvarni prevedeni AVR program: osnovni GPIO, ADC, timer PWM, vanjske prekide i UART. Novi izvor prevodi se lokalnim razvojnim mostom. TWI i software I2C podržavaju AHT10, BMP180, BMP280, AM2320, OLED SSD1306 obiju visina i LCD1602/PCF8574, a Servo koristi Timer1 impulse. SPI podržava ST7735, ILI9341, zaseban BMP280 i XPT2046 kroz vidljive Lab drivere. XPT2046 daje sirove X/Y/Z1/Z2; program kalibrira, rotira i obrađuje dodir. Fizička pločica i Safari/iOS još nisu potvrđeni provjerom.
              </p>
              <a href={appAsset('diagnostics.html')} target="_blank" rel="noreferrer">
                Otvori 10 provjera jezgre ↗
              </a>
            </div>
          )}
          </div>
        </section>
      </main>
      <footer className="app-footer">
        <span>
          <span className="dot" />
          Radno okruženje <b>v{APP_VERSION}</b>
        </span>
        <span className="footer-shortcuts">
          Ctrl/⌘ + Enter <b>Pokreni</b>
          <i />
          Ctrl/⌘ + S <b>Spremi</b>
        </span>
        <button onClick={() => openDialog("help")}>
          O projektu <Icon name="chevron" size={12} />
        </button>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Zatvori obavijest">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {dialog && (
        <Modal
          title={
            {
              'class-review':'URS · pregled predaja razreda',
              radio:"NRF24L01+ · dva programska čvora",
              new: "Novi projekt",
              board: "Pločica i jezik",
              arduino:"Arduino prevođenje i simulacija",
                matrix: "Katalog i matrica podrške",
              files: "Nova datoteka",
              "rename-file": "Preimenuj datoteku",
              "delete-file": "Obriši datoteku",
              "rename-project": "Naziv projekta",
              projects: "Moji projekti",
              history: "Povijest projekta",
              help: "Dobro došao u ESP32 Lab",
              system: "Status aplikacije i offline rad",
              import: "Uvezi projekt ili učeničku predaju",
              lessons: "Nastavne vježbe · početni niz i URS zbirka",
            }[dialog]
          }
          close={() => {if(dialog==='class-review'&&reviewBusyRef.current)return;setDialog(null);}}
          large={dialog==='class-review'||dialog==='lessons'}
          wide={dialog === 'class-review' || dialog === "radio" || dialog === "arduino" || dialog === "board" || dialog === "matrix" || dialog === "new" || dialog === "projects" || dialog === "history" || dialog === "lessons" || dialog === 'system'}
        >
          {dialog==='class-review'&&<Suspense fallback={<p className="dialog-form">Učitavanje pregleda predaja…</p>}><ClassReviewPanel session={reviewSession} change={setReviewSession} busy={reviewBusy} setBusy={setReviewBusy} current={p} open={openClassSubmission}/></Suspense>}
          {dialog==='radio'&&<RadioPanel key={p.id} project={p} compiler={compiler} change={ws.change} save={ws.flush} create={async next=>{await ws.flush();runtime.stop();lessonCheck.cancel();await ws.add(next);}}/>}
          {dialog==='arduino'&&OFFLINE_AVR&&p.runtimeProfile.id==='arduino-avr'&&!p.radio&&<OfflineAvrPanel key={'offline-'+p.id} project={p} stop={()=>runtime.stop()} run={()=>{setDialog(null);void run();}}/>}
          {dialog==='arduino'&&<ArduinoBuildPanel offline={OFFLINE_AVR&&p.runtimeProfile.id==='arduino-avr'&&!p.radio} key={p.id} project={p} compiler={compiler} consoleText={runtime.runRevision===p.revision?runtime.consoleText:''} setLibraries={text=>{runtime.stop();ws.change('Odabrane Arduino biblioteke',n=>{n.files[AVR_LIBRARY_FILE]=text;});}} goTo={d=>{if(!Object.hasOwn(p.files,d.file))return;ws.change('Otvorena datoteka pogreške',n=>{n.settings.activeFile=d.file;});setReveal({path:d.file,line:d.line,column:d.column,token:Date.now()});setDialog(null);setMobileTab('code');}} importBuild={(text,input)=>{runtime.stop();const live=liveProject.current;if(!live||live.id!==p.id||JSON.stringify(buildInput(live))!==input)throw Error('Projekt je promijenjen.');if(readSchoolBinding(live)){if(readSchoolBinding(live)?.status==='locked')throw Error('Predaja je zaključana.');notify('Prijevod je spreman za pokretanje; školska revizija ostaje ista.');return;}const saved=ws.change('Preveden Arduino program',n=>{if(JSON.stringify(buildInput(n))!==input)throw Error('Projekt se promijenio tijekom prevođenja. Ponovi prevođenje.');n.files[buildFile(n)]=text;});if(!saved)throw Error('Rezultat nije spremljen u projekt. Provjeri veličinu i datoteke projekta.');preferStandard(live);notify('Prevedeni program spremljen je u projekt.');}}/>}
          {dialog === 'board' &&<BoardChangePanel project={p} busy={working} error={formError} create={(id,language)=>{setWorking(true);setFormError('');void (async()=>{try{const derived=deriveProject(p,id,language);await ws.flush();runtime.stop();lessonCheck.cancel();await ws.add(derived);setDialog(null);setLabTab('circuit');setMobileTab('lab');notify('Otvorena je izvedena kopija s novom pločicom.');}catch(e){setFormError((e as Error).message);}finally{setWorking(false);}})();}}/>}
          {dialog === 'matrix'&&<SupportMatrix board={p.board.id} language={p.language}/>}
          {dialog === "lessons" && <LessonCatalog open={(id,solution)=>void selectLesson(id,solution)} openUrs={(lesson,variant,target,peer)=>void selectUrs(lesson,variant,target,peer)} initialTarget={targetForProject(p)} busy={working} reviewClass={()=>openDialog('class-review')}/>}
          {dialog === 'system' && <SystemPanel offline={offline} busy={runtime.busy || lessonCheck.busy || working} saveStatus={saveLabels[ws.status]} update={updateApplication}/>}
          {[
            "new",
            "files",
            "rename-file",
            "delete-file",
            "rename-project",
          ].includes(dialog) && (
            <form onSubmit={submit} className="dialog-form">
              {dialog === "delete-file" ? (
                <p>
                  Obrisat će se <b>{active}</b>. Datoteku možeš vratiti
                  poništavanjem ili iz povijesti.
                </p>
              ) : (
                <>
                  <label htmlFor="dialog-field">
                    {dialog === "files" || dialog === "rename-file"
                      ? "Putanja datoteke"
                      : "Naziv projekta"}
                  </label>
                  <input
                    id="dialog-field"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    maxLength={100}
                    required
                    autoComplete="off"
                  />
                  {dialog === "new" && <BoardFields value={newBoard} language={newLanguage} onLanguageChange={setNewLanguage} onChange={id=>{setNewBoard(id);if(!getBoard(id).languages.includes(newLanguage))setNewLanguage(getBoard(id).languages[0]);}}/>}
                  {dialog === "files" && (
                    <p>
                      {p.language==='arduino-cpp'?<>C/C++ datoteke dodaj u korijen ili <code>src/</code>, npr. <code>pomoc.h</code> ili <code>src/pomoc.cpp</code>.</>:<>Podržane su Python i tekstualne datoteke.</>} Početni program je <code>{p.entryFile}</code>.
                    </p>
                  )}
                </>
              )}
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="dialog-actions">
                <button type="button" onClick={() => setDialog(null)}>
                  Odustani
                </button>
                <button
                  type="submit"
                  className={dialog === "delete-file" ? "danger" : "primary"}
                >
                  {dialog === "delete-file"
                    ? "Obriši"
                    : dialog === "new"
                      ? "Otvori projekt"
                      : "Spremi"}
                </button>
              </div>
            </form>
          )}
          {dialog === "projects" && (
            <div className="project-picker">
              <p>Projekti spremljeni na ovom uređaju i u ovom pregledniku.</p>
              {projects.map((row) => (
                <button
                  key={row.id}
                  className={row.id === p.id ? "current" : ""}
                  onClick={() =>
                    void action(async () => {
                      runtime.stop();
                      await ws.open(row.id);
                      setDialog(null);
                    })
                  }
                >
                  <span className="picker-icon">
                    <Icon name="folder" size={22} />
                  </span>
                  <div>
                    <strong>{row.document.title}</strong>
                    <small>
                      {Object.keys(row.document.files).length} datoteka ·{" "}
                      {new Date(row.document.updatedAt).toLocaleString("hr-HR")}
                    </small>
                  </div>
                  {row.id === p.id ? (
                    <span className="subtle-tag">OTVOREN</span>
                  ) : (
                    <Icon name="chevron" size={16} />
                  )}
                </button>
              ))}
            </div>
          )}
          {dialog === "history" && (
            <div className="history-picker">
              <p>
                Do 30 spremljenih snimki, ograničenih na približno 8 MiB.
                Vraćanje stvara novu reviziju projekta.
              </p>
              {[...(ws.record?.history ?? [])].reverse().map((snap) => (
                <div className="history-row" key={snap.id}>
                  <span className="history-bullet" />
                  <div>
                    <strong>{snap.label}</strong>
                    <small>
                      {new Date(snap.savedAt).toLocaleString("hr-HR")} ·
                      revizija {snap.project.revision} ·{" "}
                      {Object.keys(snap.project.files).length} datoteka
                    </small>
                  </div>
                  <button
                    onClick={() => {
                      const restored=parseProject(snap.project);
                      runtime.stop();
                      ws.change("Vraćena spremljena verzija", (n) => {
                        n.board=clone(restored.board);n.language=restored.language;n.runtimeProfile=clone(restored.runtimeProfile);n.entryFile=restored.entryFile;n.target=clone(restored.target);
                        n.title = snap.project.title;
                        n.files = clone(snap.project.files);
                        n.settings = clone(snap.project.settings);
                        n.circuit = clone(snap.project.circuit);
                      });
                      setDialog(null);
                      notify("Spremljena verzija je vraćena.");
                    }}
                  >
                    Vrati
                  </button>
                </div>
              ))}
            </div>
          )}
          {dialog === "import" && (
            <div className="import-content">
              <p>
                Odaberi ZIP paket ili JSON projekt. Uvoz stvara zasebnu kopiju.
              </p>
              <button
                className="primary"
                onClick={() => importRef.current?.click()}
              >
                <Icon name="upload" />
                Odaberi ZIP / JSON datoteku
              </button>
              <details>
                <summary>Ili zalijepi JSON projekt</summary>
                <form onSubmit={submit}>
                  <label htmlFor="import-json">Sadržaj JSON projekta</label>
                  <textarea
                    id="import-json"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    placeholder="{ ... }"
                    required
                    spellCheck={false}
                  />
                  {formError && (
                    <p className="form-error" role="alert">
                      {formError}
                    </p>
                  )}
                  <div className="dialog-actions">
                    <button type="submit" className="primary">
                      Uvezi JSON
                    </button>
                  </div>
                </form>
              </details>
            </div>
          )}
          {dialog === "help" && (
            <div className="help-content">
              <span className="help-eyebrow">RADNO OKRUŽENJE · v{APP_VERSION}</span>
              <p>
                Sastavi vlastiti sklop, pregledaj električne mreže i ispravi spojeve.
                Raniji pokusi jezgre omogućuju izvođenje MicroPythona na fiksnom spoju.
              </p>
              <ol>
                <li>Otvori novi projekt ili primjer LED, tipkalo, potenciometar ili AHT10 → OLED → servo.</li>
                <li>Dodaj komponente. Alatom Vodič klikni dva označena priključka. Klikovi između njih dodaju zavoje.</li>
                <li>Na kartici Provjera spojeva pregledaj poruke. Klikni priključak za isticanje cijele mreže.</li>
                <li>
                  Za ESP32 / MicroPython uredi <code>main.py</code>. Dodaj pomoćne datoteke i koristi{" "}
                  <code>import</code>.
                </li>
                <li>Klikni Pokreni i mijenjaj ulaze. U primjeru AHT10 promijeni temperaturu iznad 28 °C; sljedeće očitanje (svake 2 s) mijenja OLED i servo. Ispod 26 °C servo se vraća. Kartica Mjerenja sadrži očitanja, CSV izvoz i I2C zapis.</li>
                <li>AHT10 koristi I2C0 na GPIO8/9, OLED I2C1 na GPIO10/11. VCC oba modula ide na 3V3; servo na 5 V i zajedničku masu. Pull-up otpornici od 4,7 kΩ uključeni su u modele modula i mogu se isključiti u svojstvima.</li>
                <li>Upravljačke datoteke senzora, ssd1306.py, lcd1602.py i servo.py dio su odgovarajućih primjera. Primjenjuju se pri novom pokretanju kao i main.py. Promjena sklopa zaustavlja program; Reset vraća spremljeni početni okoliš.</li>
                <li>Gumb Vježbe otvara pet postupnih zadataka. Na kartici Vježba pročitaj pojmove, sastavi i programiraj, pokreni Provjeri rad, unesi opažanja i preuzmi ZIP za predaju.</li>
                <li>Pregled predaje omogućuje nastavniku da uveze paket i ponovi provjeru. Uvezeni lokalni zapis nije ovjerena ocjena; pregledaj i učenikova obrazloženja.</li>
              </ol>
              <p>
                Izmjene se automatski spremaju u ovom pregledniku. ZIP sadrži{" "}
                <code>project.json</code> i izvorne datoteke. Povijest i
                poništavanje ostaju u radnom okruženju.
              </p>
              <p className="help-note">
                Referentni profil: ESP32-S3-DevKitC-1
                v1.1 N16R8. Prikaz pločice je pojednostavljen, a model
                korisnikove pločice još nije potvrđen.
              </p>
              <div className="help-links">
                <a href={appAsset('guide.html')} target="_blank" rel="noreferrer">Upute i oporavak ↗</a>
                <button onClick={() => setDialog('system')}>Status i offline rad</button>
                <a href={appAsset('pilot.html')} target="_blank" rel="noreferrer">Obrazac stvarnog pilota ↗</a>
                <a href={appAsset('diagnostics.html')} target="_blank" rel="noreferrer">
                  Provjere jezgre ↗
                </a>
                <a href={appAsset('report.html')} target="_blank" rel="noreferrer">
                  Izvješće etape 0 ↗
                </a>
                <a
                  href={appAsset('licenses/THIRD-PARTY.txt')}
                  target="_blank"
                  rel="noreferrer"
                >
                  Licence ↗
                </a>
              </div>
              <div className="dialog-actions">
                <button className="primary" onClick={() => setDialog(null)}>
                  Nastavi s radom
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
