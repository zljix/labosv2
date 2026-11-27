import { byteLength, LIMITS, parseProject, type Project } from '../project/model';
import type { LiveInput } from '../circuit/model';

export const trialFile = (i: number) => ['pokus-prije.json', 'pokus-poslije.json'][i];
export const responseFile = 'odgovor-provjere.txt';
const executable = (name: string) =>
  /\.(?:ino|py|c|cpp|h|hpp)$/.test(name) || name === 'arduino-libraries.json';
export function trialSnapshot(p: Project, inputs: Record<string, LiveInput> = {}) {
  const files = Object.fromEntries(Object.entries(p.files).filter(([name]) => executable(name)));
  const text = JSON.stringify({ version: 1, files, circuit: p.circuit, inputs });
  if (byteLength(text) > LIMITS.fileBytes)
    throw Error('Snimka pokusa prelazi 128 KiB. Smanji veličinu pomoćnih izvora.');
  return text;
}
export function savedTrial(p: Project, index: number) {
  const text = p.files[trialFile(index)];
  if (!text) return;
  const data = JSON.parse(text);
  if (
    data?.version !== 1 ||
    !data.files ||
    typeof data.files[p.entryFile] !== 'string' ||
    !data.inputs ||
    Array.isArray(data.inputs) ||
    typeof data.inputs !== 'object'
  )
    throw Error('Snimka pokusa nije čitljiva. Ponovno zabilježi pokus.');
  const files = Object.fromEntries(Object.entries(data.files).filter(([name]) => executable(name)));
  const project = parseProject({
    ...p,
    circuit: data.circuit,
    files,
    settings: { ...p.settings, activeFile: p.entryFile }
  });
  return { project, inputs: data.inputs as Record<string, LiveInput> };
}
export function labSnapshot(p: Project, level: number, plc: boolean) {
  const source = p.files['P' + level + '-program.txt'];
  const declarations = p.files['P' + level + '-deklaracije.txt'];
  if (!source?.trim() || (plc && !declarations?.trim())) return;
  const inputs = p.files['P' + level + '-sklop.json'];
  const extra = inputs ? JSON.parse(inputs) : undefined;
  const files: Record<string, string> =
    extra?.files ?? Object.fromEntries(Object.entries(p.files).filter(([name]) => executable(name)));
  if (plc) {
    files['program.txt'] = source;
    files['deklaracije.txt'] = declarations;
  } else files[p.entryFile] = source;
  return parseProject({
    ...p,
    files,
    circuit: extra?.circuit ?? p.circuit,
    settings: { ...p.settings, activeFile: p.entryFile }
  });
}
export function labSupportSnapshot(p: Project) {
  const files = Object.fromEntries(
    Object.entries(p.files).filter(([name]) => executable(name) && name !== p.entryFile)
  );
  if (p.language === 'micropython') files[p.entryFile] = p.files[p.entryFile];
  const text = JSON.stringify({ files, circuit: p.circuit });
  if (byteLength(text) > LIMITS.fileBytes) throw Error('Sklop i pomoćne datoteke prelaze 128 KiB.');
  return text;
}
