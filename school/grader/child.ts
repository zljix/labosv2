import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {compileCircuit} from '../../src/circuit/compile';
import {parseProject} from '../../src/project/model';
import {AVREngine} from '../../src/runtime/avrEngine';
import {createHost} from '../../public/host.mjs';

let raw = '';
for await (const chunk of process.stdin) { raw += chunk; if (Buffer.byteLength(raw) > 2097152) throw Error('Projekt je prevelik.'); }
const {project: input, artifact} = JSON.parse(raw), project = parseProject(input);
if (project.circuit.kind !== 'editable') throw Error('Potreban je uređiv sklop.');
const config = compileCircuit(project.circuit, project.language === 'micropython' ? 'micropython' : 'avr');
const led = config.leds[0], button = config.buttons[0];
if (config.leds.length !== 1 || config.buttons.length !== 1) throw Error('Dokaz 23A traži točno jednu LED-icu i jedno tipkalo.');
const samples: {atMs: number; pressed: boolean; currentMa: number | null}[] = [];
let last: any;
const observe = (event: any) => { if (event.type === 'simulation') last = event; };
const record = (atMs: number, pressed: boolean) => samples.push({atMs, pressed, currentMa: last?.leds[led.id]?.currentMa ?? null});
// Trusted stimulus timetable, independent of source strings and console output.
const states = [false, true, false, true, false];
let programError: string | null = null;
if (project.language === 'arduino-cpp') {
  const engine = new AVREngine(artifact.hex, config, observe, project.board.id.includes('nano') ? 8 : 6, artifact.staticRamBytes);
  try {
    for (const [i, pressed] of states.entries()) {
      engine.input({component: button.id, pressed});
      for (let j = 0; j < 50; j++) { engine.runCycles(64000); engine.frame(); }
      record((i + 1) * 200, pressed);
    }
  } catch (error) { programError = (error as Error).message.slice(0, 2000); }
  finally { engine.dispose(); }
} else {
  const publicRoot = process.env.LAB_GRADER_PUBLIC!;
  const {loadMicroPython} = await import(pathToFileURL(publicRoot + '/runtime/micropython.mjs').href);
  let clockUs = 0, stage = 0, finished = false;
  const host: any = createHost(observe, {circuit: config, nowUs: () => clockUs});
  host.input({component: button.id, pressed: false});
  // Only sleep advances this proof's virtual clock. Python busy loops are killed
  // by the supervising process. No host speed enters the scoring timetable.
  host.scheduleSleep = (wake: () => void, ms: number) => {
    clockUs += Math.max(1, ms) * 1000;
    host.flush();
    while (stage < states.length && clockUs >= (stage + 1) * 200000) {
      record((stage + 1) * 200, states[stage]);
      stage++;
      if (stage === states.length) { finished = true; resolveDone(); return; }
      host.input({component: button.id, pressed: states[stage]});
    }
    setImmediate(wake);
  };
  let resolveDone!: () => void;
  const complete = new Promise<void>(ok => { resolveDone = ok; });
  const mp = await loadMicroPython({heapsize: 4 * 1024 * 1024, pystack: 16384, stdout: () => {}, stderr: () => {}, linebuffer: false});
  mp._module.labHost = host;
  Date.now = () => Math.floor(clockUs / 1000);
  mp.FS.writeFile('/machine.py', await readFile(publicRoot + '/machine.py', 'utf8'));
  for (const [name, value] of Object.entries(project.files)) {
    if (!name.endsWith('.py') && !name.endsWith('.txt') && !name.endsWith('.json')) continue;
    if (name.split('/').some(part => ['machine.py', '_lab.py', 'project.json'].includes(part.toLowerCase()))) continue;
    const parts = name.split('/'); parts.pop(); let directory = '';
    for (const part of parts) { directory += '/' + part; if (!mp.FS.analyzePath(directory).exists) mp.FS.mkdir(directory); }
    mp.FS.writeFile('/' + name, value);
  }
  const running = mp.runPython("exec(compile(open('/main.py').read(), 'main.py', 'exec'))").then(() => {
    if (!finished) { programError = 'Program je završio prije posljednjeg scenarija.'; resolveDone(); }
  }).catch((error: Error) => { programError = error.message.slice(0, 2000); resolveDone(); });
  await Promise.race([complete, running]);
}
const follows = (sample: typeof samples[number]) => sample.currentMa !== null && (sample.pressed ? sample.currentMa > 0.5 : sample.currentMa < 0.05);
const criteria = [
  {id: 'initial', label: 'Otpušteno tipkalo: LED je ugašena', max: 2, passed: samples.length > 0 && follows(samples[0])},
  {id: 'response', label: 'Pritisak i otpuštanje mijenjaju LED', max: 5, passed: samples.length >= 3 && samples.slice(0, 3).every(follows)},
  {id: 'repeat', label: 'Ponovljeni pritisak i otpuštanje', max: 3, passed: samples.length === 5 && samples.slice(3).every(follows)},
].map(item => ({...item, points: item.passed ? item.max : 0}));
process.stdout.write(JSON.stringify({status: programError ? 'program_error' : 'evaluated', criteria, samples, programError,
  points: criteria.reduce((sum, item) => sum + item.points, 0), maxPoints: 10,
  peakRssKiB: process.resourceUsage().maxRSS, virtualDurationMs: 1000}));
// An unfinished infinite Python loop intentionally remains suspended at the
// final sleep. End the disposable process, including all pending host timers.
process.exit(0);
