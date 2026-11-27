import { compileCircuit, type SimulationFrame } from '../circuit/compile';
import type { Project } from '../project/model';
import type { LiveInput } from '../circuit/model';
import { AVREngine } from '../runtime/avrEngine';
import { createHost } from '../../public/host.mjs';
import { createS3Engine } from '../../public/s3-engine.mjs';
import { wasmBytes } from '../../public/s3-contract.mjs';

export type Stimulus = { component: string } & LiveInput;
export interface Step {
  ms: number;
  inputs: Stimulus[];
}
export const step = (ms: number, ...inputs: Stimulus[]): Step => ({ ms, inputs });
export const near = (a: number | null | undefined, b: number, tolerance = 0.3) =>
  typeof a === 'number' && Math.abs(a - b) <= tolerance;
export interface Reading {
  t: number;
  led: number;
  pulse: number | null;
  duty: number | null;
  relay: boolean;
  coils: number;
  steps: number;
  drive: number;
  digits: string;
}
export interface Stage {
  frame?: SimulationFrame;
  readings: Reading[];
  lines: { t: number; text: string }[];
}
export class RuntimeUnavailable extends Error {}
export interface MPResources {
  load: (opts: any) => Promise<any>;
  machine: string;
}
const digits = [63, 6, 91, 79, 102, 109, 125, 7, 127, 111];
function reading(frame: SimulationFrame): Reading {
  const first = <T>(r: Record<string, T> | undefined) => Object.values(r ?? {})[0];
  const display = first(frame.tmDisplays),
    driver = first(frame.steppers?.drivers);
  return {
    t: frame.timeMs,
    led: first(frame.leds)?.currentMa ?? 0,
    pulse: first(frame.servos)?.pulseUs ?? null,
    duty: frame.gpios['21']?.duty ?? null,
    relay: first(frame.actuators?.relays)?.energized ?? false,
    coils: frame.avr?.coils?.steps ?? 0,
    steps: driver?.accepted ?? 0,
    drive: driver?.translatorTicks ?? 0,
    digits: display?.on
      ? display.bytes
          .slice(0, 4)
          .map((b) => digits.indexOf(b & 127))
          .join('')
      : ''
  };
}

// Run in a disposable browser Worker or in the school's isolated child. Each stage
// retains its last frame, a bounded signal trace and output produced in that stage.
export async function replay(
  p: Project,
  artifact: any,
  steps: Step[],
  resources?: MPResources
): Promise<Stage[]> {
  if (p.circuit.kind !== 'editable') throw Error('Potreban je sklop laboratorijske vježbe.');
  const avr = p.runtimeProfile.id === 'arduino-avr';
  const config = compileCircuit(p.circuit, avr ? 'avr' : 'micropython');
  const results: Stage[] = steps.map(() => ({ readings: [], lines: [] }));
  let index = 0,
    clockUs = 0,
    lastSample = -Infinity,
    buffer = '',
    end = steps[0].ms;
  let time = () => clockUs / 1000;
  const output = (text: string) => {
    const stage = results[index];
    if (!stage) return;
    const lines = (buffer + text).split('\n');
    buffer = lines.pop()!.slice(-1024);
    for (const l of lines) {
      stage.lines.push({ t: time(), text: l.trim().slice(0, 1024) });
      if (stage.lines.length > 512) stage.lines.shift();
    }
  };
  const observe = (e: any) => {
    if (e.type === 'console') {
      output(e.text);
      return;
    }
    const stage = results[index];
    if (e.type !== 'simulation' || !stage) return;
    stage.frame = e;
    const previous = stage.readings.at(-1);
    const current = Object.values(e.leds ?? {})[0] as { currentMa: number } | undefined;
    if (
      e.timeMs - lastSample >= 12 ||
      !previous ||
      (current?.currentMa ?? 0) > 0.35 !== previous.led > 0.35
    ) {
      lastSample = e.timeMs;
      stage.readings.push(reading(e));
      if (stage.readings.length > 900) stage.readings.shift();
    }
  };
  const apply = (engine: any) => {
    for (const input of steps[index].inputs) engine.input(input);
  };
  if (avr) {
    const engine = new AVREngine(artifact.hex, config, observe, 8, artifact.staticRamBytes);
    time = () => engine.cpu.cycles / 16000;
    try {
      for (index = 0; index < steps.length; index++) {
        apply(engine);
        const until = engine.cpu.cycles + steps[index].ms * 16000;
        while (engine.cpu.cycles < until) {
          engine.runCycles(Math.min(16 * 16000, until - engine.cpu.cycles));
          engine.frame();
        }
      }
    } finally {
      engine.dispose();
    }
  } else if (p.language === 'arduino-cpp') {
    let engine: any,
      lastFlush = 0;
    const clock = {
      now: 0,
      async sleep(us: number) {
        const target = clock.now + Math.max(1, us);
        while (index < steps.length && target >= end * 1000) {
          clock.now = clockUs = end * 1000;
          engine.snapshot();
          if (++index === steps.length) {
            engine.stop();
            return;
          }
          apply(engine);
          end += steps[index].ms;
        }
        clock.now = clockUs = target;
        if (target - lastFlush >= 16000) {
          engine.snapshot();
          lastFlush = target;
        }
      }
    };
    engine = await createS3Engine(wasmBytes(artifact.wasm), config, observe, { clock });
    try {
      apply(engine);
      await engine.run();
    } finally {
      engine.stop();
    }
  } else {
    if (!resources) throw Error('MicroPython nije učitan.');
    const host: any = createHost(observe, { circuit: config, nowUs: () => clockUs });
    time = () => host.ticksUs() / 1000;
    let finished!: () => void;
    const done = new Promise<void>((ok) => (finished = ok));
    host.scheduleSleep = (wake: () => void, ms: number) => {
      host.flush();
      const offset = host.ticksUs() - clockUs,
        target = clockUs + offset + Math.max(0.05, ms) * 1000;
      while (index < steps.length && target >= end * 1000) {
        clockUs = end * 1000 - offset;
        host.flush();
        if (++index === steps.length) {
          finished();
          return;
        }
        apply(host);
        end += steps[index].ms;
      }
      clockUs = target - offset;
      host.flush();
      queueMicrotask(wake);
    };
    const decoder = new TextDecoder();
    let mp;
    try {
      mp = await resources.load({
        heapsize: 4 * 1024 * 1024,
        pystack: 16384,
        stdout: (b: Uint8Array) => output(decoder.decode(b, { stream: true })),
        stderr: () => {},
        linebuffer: false
      });
    } catch {
      throw new RuntimeUnavailable(
        'MicroPython nije moguće učitati. Ponovi provjeru nakon učitavanja simulatora.'
      );
    }
    (globalThis as any).proxy_js_ref[0] = Object.freeze(Object.create(null));
    mp._module.labHost = host;
    mp.FS.writeFile('/machine.py', resources.machine);
    for (const [name, value] of Object.entries(p.files)) {
      if (!/\.(py|txt)$/.test(name)) continue;
      const parts = name.split('/');
      parts.pop();
      let dir = '';
      for (const part of parts) {
        dir += '/' + part;
        if (!mp.FS.analyzePath(dir).exists) mp.FS.mkdir(dir);
      }
      mp.FS.writeFile('/' + name, value);
    }
    apply(host);
    const originalNow = Date.now;
    Date.now = () => Math.floor(time());
    try {
      await Promise.race([done, mp.runPython("exec(compile(open('/main.py').read(), 'main.py', 'exec'))")]);
    } finally {
      Date.now = originalNow;
    }
  }
  if (index < steps.length) throw Error('Program je završio prije kraja pokusa.');
  return results;
}
export const lines = (s: Stage) => s.lines.map((l) => l.text).join('\n');
export function field(text: string, name: string) {
  const m = new RegExp('(?:^|[\\s;|])' + name + '\\s*[:=]\\s*(-?\\d+(?:[.,]\\d+)?)', 'i').exec(text);
  return m ? Number(m[1].replace(',', '.')) : NaN;
}
export const last = (s: Stage) => s.readings.at(-1);
export function timedValues<T>(items: T[], value: (a: T) => number, expected: number, tolerance: number) {
  return (
    items.length > 1 && items.slice(1).every((a, i) => near(value(a) - value(items[i]), expected, tolerance))
  );
}
