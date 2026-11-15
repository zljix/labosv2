import { emptyCircuit, parseCircuit, type ProjectCircuit } from "../circuit/model";
export const FORMAT = "esp32-micropython-lab";
import {getBoard,S3,type BoardId,type Language} from "../boards/profiles";
import {runtimeProfile,projectTarget,type RuntimeProfile} from "../runtime/profiles";
export const BOARD = S3;
export const LIMITS = {
  files: 64,
  fileBytes: 131072,
  totalBytes: 1048576,
  archiveBytes: 2097152,
};
export interface Project {
  format: typeof FORMAT;
  schemaVersion: 3 | 4;
  radio?: {version:1;peer:Project};
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  board: {
    id: BoardId;
    profileVersion: string;
    firmware?: string;
  };
  language: Language;
  runtimeProfile: RuntimeProfile;
  entryFile: "main.py" | "main.ino";
  nodeId: "main";
  target: {fqbn: string | null};
  files: Record<string, string>;
  circuit: ProjectCircuit;
  settings: {
    activeFile: string;
    theme: "light" | "dark";
    fontSize: number;
    powered: boolean;
    swapped: boolean;
    example: string;
  };
}
export const clone = <T>(v: T): T => structuredClone(v);
export const byteLength = (v: string) => new TextEncoder().encode(v).length;
export function validPath(path: string) {
  return (
    path.length <= 100 &&
    /^(?:[A-Za-z_][A-Za-z0-9_-]*\/)*[A-Za-z_][A-Za-z0-9_-]*\.(py|ino|h|hpp|c|cpp|txt|md|json)$/.test(
      path,
    ) &&
    !path
      .split("/")
      .some((s) =>
        [
          "machine.py",
          "_lab.py",
          "project.json",
          "__proto__",
          "constructor",
          "prototype",
        ].includes(s.toLowerCase()),
      )
  );
}
const obj = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function bad(message: string): never {
  throw Error(message);
}
export function parseProject(input: unknown, depth=0): Project {
  if (!obj(input) || input.format !== FORMAT)
    bad("Taj dokument nije projekt ESP32 MicroPython Laba.");
  const p = input as Record<string, any>;
  if (![1, 2, 3, 4].includes(p.schemaVersion))
    bad(
      `Inačica formata ${String(p.schemaVersion)} nije podržana. Projekt nije izmijenjen.`,
    );
  if (typeof p.id !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(p.id))
    bad("Neispravan identifikator projekta.");
  if (typeof p.title !== "string" || !p.title.trim() || p.title.length > 100)
    bad("Naziv mora sadržavati 1–100 znakova.");
  if (
    ![p.createdAt, p.updatedAt].every(
      (d) => typeof d === "string" && Number.isFinite(Date.parse(d)),
    )
  )
    bad("Neispravan datum projekta.");
  if (!Number.isSafeInteger(p.revision) || p.revision < 0)
    bad("Neispravna revizija projekta.");
  if (!obj(p.board)) bad("Profil pločice nije podržan.");
  const profile = getBoard(p.board.id), legacy = p.schemaVersion < 3;
  const language:Language = legacy ? "micropython" : p.language;
  const expectedFirmware=language==='micropython'?profile.firmware:undefined;
  const provisionalS3=profile.id===S3&&language==='arduino-cpp'&&p.board.firmware===profile.firmware;
  if ((legacy && profile.id !== BOARD) || p.board.profileVersion !== profile.version || (p.board.firmware !== expectedFirmware&&!provisionalS3))
    bad("Profil pločice ili firmware nije podržan.");
  if (!profile.languages.includes(language)) bad("Jezik nije podržan na odabranoj pločici.");
  const runtime = runtimeProfile(profile.id,language), entryFile = language === "micropython" ? "main.py" : "main.ino";
  if (!legacy && (!obj(p.runtimeProfile) || p.runtimeProfile.id !== runtime.id || p.runtimeProfile.version !== runtime.version || p.entryFile !== entryFile || p.nodeId !== "main" || !obj(p.target) || p.target.fqbn !== projectTarget(profile.id,language)))
    bad("Izvršni profil, cilj ili početna datoteka projekta nisu podržani.");
  if (!obj(p.files) || typeof p.files[entryFile] !== "string")
    bad("Nedostaje obvezna datoteka " + entryFile + ".");
  const paths = Object.keys(p.files);
  if (paths.length > LIMITS.files) bad("Najviše 64 datoteke po projektu.");
  let total = 0;
  const seen = new Set<string>();
  for (const path of paths) {
    if (!validPath(path) || seen.has(path.toLowerCase()))
      bad("Nedopuštena ili dvostruka putanja: " + path);
    seen.add(path.toLowerCase());
    if (typeof p.files[path] !== "string") bad("Datoteka mora biti tekst.");
    const size = byteLength(p.files[path]);
    if (size > LIMITS.fileBytes) bad("Datoteka prelazi 128 KiB.");
    total += size;
  }
  if (total > LIMITS.totalBytes) bad("Datoteke prelaze ukupno 1 MiB.");
  if (p.schemaVersion === 1 && p.circuit?.kind !== "stage0-fixture")
    bad("Format 1 podržava samo fiksni ispitni sklop.");
  const circuit = parseCircuit(p.circuit, profile.id);
  const s = p.settings;
  if (
    !obj(s) ||
    typeof s.activeFile !== "string" ||
    !Object.hasOwn(p.files, s.activeFile) ||
    !["light", "dark"].includes(s.theme) ||
    !Number.isInteger(s.fontSize) ||
    s.fontSize < 12 ||
    s.fontSize > 24 ||
    typeof s.powered !== "boolean" ||
    typeof s.swapped !== "boolean" ||
    typeof s.example !== "string" ||
    s.example.length > 40
  )
    bad("Neispravne postavke projekta.");
  let radio:Project['radio'];
  if(p.schemaVersion===4){
    if(depth||!obj(p.radio)||p.radio.version!==1||!obj(p.radio.peer)||p.radio.peer.schemaVersion===4||p.radio.peer.radio!==undefined)bad("Mrežni projekt treba točno dva čvora bez ugniježđene mreže.");
    const peer=parseProject(p.radio.peer,1);
    if(peer.id===p.id)bad("Čvorovi trebaju odvojene identifikatore.");
    if(total+Object.values(peer.files).reduce((n,s)=>n+byteLength(s),0)>LIMITS.totalBytes)bad("Datoteke obaju čvorova prelaze ukupno 1 MiB.");
    radio={version:1,peer};
  }else if(p.radio!==undefined)bad("Mrežni projekt zahtijeva format 4.");
  return {
    format: FORMAT,
    schemaVersion: radio?4:3,
    ...(radio?{radio}:{}),
    id: p.id,
    title: p.title.trim(),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    revision: p.revision,
    board: boardMetadata(profile.id,language),
    language,
    runtimeProfile: runtime,
    entryFile,
    nodeId: "main",
    target: {fqbn:projectTarget(profile.id,language)},
    files: Object.fromEntries(paths.map((path) => [path, p.files[path]])),
    circuit,
    settings: {
      activeFile: s.activeFile,
      theme: s.theme,
      fontSize: s.fontSize,
      powered: s.powered,
      swapped: s.swapped,
      example: s.example,
    },
  };
}
export const initialCode=(language:Language)=>language==="micropython"?'print("Pozdrav iz MicroPythona!")\n':'// Arduino C/C++ · program počinje funkcijom setup().\nvoid setup() {\n    // Ovdje postavi priključke.\n}\n\nvoid loop() {\n    // Ovdje piši naredbe koje se ponavljaju.\n}\n';
export function boardMetadata(id:BoardId,language:Language=getBoard(id).languages[0]):Project["board"] {const profile=getBoard(id);return {id,profileVersion:profile.version,...(language==='micropython'&&profile.firmware?{firmware:profile.firmware}:{})};}
export function newProject(
  code: string | undefined = undefined,
  title = "Moj prvi sklop",
  boardId:BoardId = BOARD,
  language:Language = getBoard(boardId).languages[0],
): Project {
  const now = new Date().toISOString(), profile=getBoard(boardId), runtime=runtimeProfile(boardId,language),entryFile=language==="micropython"?"main.py":"main.ino";
  return {
    format: FORMAT,
    schemaVersion: 3,
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    board: boardMetadata(boardId,language),
    language, runtimeProfile:runtime,entryFile,nodeId:"main",target:{fqbn:projectTarget(boardId,language)},
    files: { [entryFile]: code??initialCode(language) },
    circuit: emptyCircuit(boardId),
    settings: {
      activeFile: entryFile,
      theme: "light",
      fontSize: 14,
      powered: true,
      swapped: false,
      example: "",
    },
  };
}
export function editProject(p: Project, edit: (next: Project) => void) {
  const next = clone(p);
  edit(next);
  next.revision++;
  next.updatedAt = new Date().toISOString();
  return parseProject(next);
}
export function forkProject(p: Project, suffix = " — uvezeno") {
  const next = clone(p);
  next.id = crypto.randomUUID();
  next.title = (p.title + suffix).slice(0, 100);
  next.createdAt = next.updatedAt = new Date().toISOString();
  next.revision = 0;
  return next;
}
