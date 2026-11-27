import type { LabId } from '../lessons/ursLab';
import type { Project } from '../project/model';
import { field, last, lines, near, step, type Stage, type Step } from './replay';
import { bottomBar, hasText, screen } from './screen';
import { sensorLab, numbers } from './sensorLabs';

const key = (ms: number, pressed: boolean, pin = 4) => step(ms, { component: 'tipka' + pin, pressed });
const pot = (ms: number, position: number) => step(ms, { component: 'pot', position });
const lux = (ms: number, adc: number) =>
  step(ms, { component: 'temt60001', illuminance: (adc / 1023) * 1000 });
const stable = (s: Stage, state: boolean) => last(s)?.relay === state;
const pulse = (s: Stage) => last(s)?.pulse;
const angle = (s: Stage, degrees: number) => near(pulse(s), 544 + (degrees * (2400 - 544)) / 180, 20);
const group = (s: Stage, tag: string) =>
  s.lines.map((l) => numbers(l.text, tag)).filter((r): r is (number | null)[] => !!r);
const containsN = (s: Stage, tag: string, n: number) =>
  group(s, tag).some((vals) => vals.length === 1 && vals[0] === n);
const energized = (s: Stage) => !!s.frame && Object.values(s.frame.leds).some((l) => l.currentMa > 0.35);
function plc(level: number) {
  const inputs = (ms: number, start: boolean, stop: boolean, protect: boolean, reset = false) =>
    step(
      ms,
      ...[start, !stop, !protect, reset].map((pressed, i) => ({ component: 'tipka' + (4 + i), pressed }))
    );
  const samples =
    level === 1
      ? [
          inputs(1100, false, true, true),
          inputs(1100, false, true, false),
          inputs(1100, false, false, false),
          inputs(1100, false, false, true),
          inputs(1100, false, true, true),
          inputs(250, true, true, true)
        ]
      : level === 2
        ? [
            inputs(200, false, true, true),
            inputs(250, true, true, true),
            inputs(1000, false, true, true),
            inputs(200, false, false, true),
            inputs(2300, false, true, true),
            inputs(200, true, true, true),
            inputs(1500, false, true, true),
            inputs(650, false, true, true),
            inputs(200, false, true, false),
            inputs(2400, false, true, true)
          ]
        : [
            inputs(200, false, true, true),
            inputs(2400, true, true, true),
            inputs(300, false, true, false),
            inputs(300, true, true, true, true),
            inputs(200, false, false, true, true),
            inputs(200, false, true, true),
            inputs(200, false, true, true, true),
            inputs(200, false, true, true),
            inputs(2400, true, true, true)
          ];
  const states =
    level === 1
      ? [false, false, false, false, false, true]
      : level === 2
        ? [false, false, false, false, false, false, false, true, false, false]
        : [false, true, false, false, false, false, false, false, true];
  return {
    steps: samples,
    check: (out: Stage[]) =>
      out.every((s, i) => energized(s) === states[i]) &&
      (level === 1
        ? out.every((s, i) => new RegExp('\\bREADY=' + ([0, 4].includes(i) ? 1 : 0) + '\\b').test(lines(s)))
        : level === 3
          ? [2, 3, 4, 5].every(
              (i) => /FAULTLATCHED=1/.test(lines(out[i])) || (i === 5 && lines(out[i]) === '')
            ) && /FAULTLATCHED=0/.test(lines(out[6]))
          : true)
  };
}
export function labScenario(
  id: LabId,
  n: number,
  p: Project,
  seed: number,
  label = '',
  stopWhileRunning = false
) {
  if (id === 'LV16') return plc(n);
  if (['LV03', 'LV04', 'LV05'].includes(id)) return sensorLab(id, n, seed);
  if (id === 'LV01')
    return {
      steps: [step(6500)],
      check: ([s]: Stage[]) => {
        const edges = s.readings.filter((r, i, a) => !i || r.led > 0.35 !== a[i - 1].led > 0.35);
        const on = edges.findIndex((r) => r.led > 0.35),
          active = edges.slice(on);
        const spans = active.slice(1).map((r, i) => r.t - active[i].t);
        if (on < 0 || spans.length < 2 * (n === 1 ? 3 : n) * 2) return false;
        const code = p.files[p.entryFile].replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"/g, '');
        return (
          spans.every((t, i) =>
            n === 1 || (i + 1) % (n * 2) !== 0 ? near(t, 200, 45) : near(t, 1000, 45) || near(t, 1200, 45)
          ) &&
          (n !== 3 ||
            (/\b(?:const(?:expr)?\b[^;]*|#define\s+)BROJ_TREPTAJA\s*(?:=\s*)?3\b/.test(code) &&
              /\bfor\s*\([^)]*BROJ_TREPTAJA/.test(code)))
        );
      }
    };
  if (id === 'LV02') {
    const steps =
      n === 3 ? [step(1500), step(4000), step(6000)] : [step(680), step(1000), step(1000), step(1000)];
    return {
      steps,
      check: (s: Stage[]) => {
        const screens = s.map((v) => screen(v));
        if (n === 1)
          return (
            label.trim().length >= 2 &&
            screens.every((d) => hasText(d, label, [0, 0, 128, 18]) && hasText(d, '4.f', [0, 8, 128, 32]))
          );
        if (n === 2)
          return screens.every((d, i) => !!d && hasText(d, '*', [90, 0, 128, 17]) === (i % 2 === 0));
        const bars = screens.map(bottomBar);
        return (
          bars.every((b) => b && b.width === bars[0]?.width) &&
          bars[1]!.fill > bars[0]!.fill &&
          bars[2]!.fill > bars[1]!.fill &&
          bars.every((b, i) => near(b!.fill, ((b!.width - 2) * [1, 5, 11][i]) / 59, 4))
        );
      }
    };
  }
  if (id === 'LV06') {
    const steps =
      n === 1
        ? [pot(850, 0), pot(600, 100), pot(600, 50)]
        : n === 2
          ? [pot(900, 0), pot(450, 51), pot(450, 52), pot(450, 54)]
          : [pot(1000, 50), pot(650, 100), pot(650, 0)];
    return {
      steps,
      check: (s: Stage[]) => {
        if (n === 1) return angle(s[0], 30) && angle(s[1], 150) && angle(s[2], 90);
        if (n === 2)
          return (
            angle(s[0], 30) &&
            angle(s[1], 91) &&
            near(pulse(s[1]), pulse(s[2]) ?? NaN, 5) &&
            (pulse(s[3]) ?? 0) > (pulse(s[2]) ?? 0) + 22
          );
        const trajectory = (v: Stage, sign: number) => {
          const r = v.readings.filter((x) => x.pulse != null);
          if (r.length < 5) return false;
          const delta = sign * (r.at(-1)!.pulse! - r[0].pulse!);
          return (
            delta > 180 &&
            delta < 430 &&
            r
              .slice(1)
              .every(
                (x, i) => sign * (x.pulse! - r[i].pulse!) >= -8 && Math.abs(x.pulse! - r[i].pulse!) <= 29
              )
          );
        };
        return trajectory(s[1], 1) && trajectory(s[2], -1);
      }
    };
  }
  if (id === 'LV07') {
    const steps =
      n === 3
        ? [key(1000, false), key(900, true), key(3650, false), key(1400, false)]
        : [key(1000, false), key(800, true), key(600, true), key(400, false), key(800, true)];
    return {
      steps,
      check: (s: Stage[]) => {
        const states = n === 3 ? [false, true, true, false] : [false, true, true, true, false];
        if (!s.every((v, i) => stable(v, states[i]))) return false;
        const shown = s.map((v) => screen(v, true));
        if (!shown.every((d, i) => hasText(d, states[i] ? 'UKLJUCEN' : 'ISKLJUCEN'))) return false;
        if (n === 1) {
          const active = shown[1]?.pixel(64, 64),
            rest = shown[0]?.pixel(64, 64);
          return (
            /^[a-zA-Z]{2,3}$/.test(label) &&
            shown.every((d) => hasText(d, label.toUpperCase())) &&
            active !== rest &&
            active !== 0x07e0 &&
            rest !== 0xf800
          );
        }
        return shown.every((d, i) => hasText(d, i === 0 ? '0' : i === shown.length - 1 ? '2' : '1'));
      }
    };
  }
  if (id === 'LV08') {
    const offset = seed % 6;
    const pressures = [990 + offset, 1006 + offset, 998 + offset];
    const steps = pressures.map((pressure, i) =>
      step(
        n === 3 ? 6800 : 3800,
        { component: 'bmp180', pressure: pressure * 100 },
        { component: 'pot', position: [10, 50, 90][i] }
      )
    );
    if (n === 3) for (let j = 0; j < 12; j++) steps.push(step(490 + (j % 3) * 75));
    return {
      steps,
      check: (s: Stage[]) => {
        if (n === 1)
          return s.every(
            (v, i) =>
              lines(v).toUpperCase().includes(['NISKA RAZINA', 'NORMALNO', 'VISOKA RAZINA'][i]) ||
              hasText(screen(v), ['NISKA RAZINA', 'NORMALNO', 'VISOKA RAZINA'][i])
          );
        if (n === 2)
          return s.every((v, i) => group(v, 'P2').some((r) => near(r[0], pressures[i] - pressures[0], 1.5)));
        const flags = s.slice(3).map((v) => {
          const d = screen(v);
          return (
            hasText(d, 'MIN') &&
            hasText(d, 'MAX') &&
            hasText(d, String(pressures[0])) &&
            hasText(d, String(pressures[1]))
          );
        });
        return (
          flags.includes(true) &&
          flags.includes(false) &&
          s.slice(3).some((v) => hasText(screen(v), 'RAZINA'))
        );
      }
    };
  }
  if (id === 'LV09') {
    const steps =
      n === 1
        ? [lux(950, 750), lux(950, 245), lux(950, 150), lux(950, 580), lux(950, 750)]
        : n === 2
          ? [lux(1100, 780), lux(850, 100), lux(850, 710), lux(850, 120)]
          : [lux(900, 850), lux(1100, 80), lux(500, 880), lux(1400, 80), lux(1000, 80), lux(500, 880)];
    return {
      steps,
      check: (s: Stage[]) => {
        const states =
          n === 1
            ? [false, false, true, true, false]
            : n === 2
              ? [false, true, false, true]
              : [false, false, false, false, true, false];
        if (!s.every((v, i) => stable(v, states[i]))) return false;
        if (n !== 2) return true;
        const rows = s.flatMap((v) => group(v, 'P2'));
        return (
          rows.some(
            (r) =>
              r.length === 6 &&
              Math.max(...(r.slice(0, 5) as number[])) - Math.min(...(r.slice(0, 5) as number[])) > 150
          ) &&
          rows.every(
            (r) =>
              r.length === 6 &&
              r.every(Number.isFinite) &&
              near(r[5], (r.slice(0, 5) as number[]).reduce((a, b) => a + b) / 5, 1)
          )
        );
      }
    };
  }
  if (id === 'LV10') {
    const send = (ms: number, press: number, command: number, hold = 0) =>
      step(ms, { component: 'irRemote', irPress: press, irAddress: 0, irCommand: command, irHoldMs: hold });
    const steps =
      n === 3
        ? [step(150), send(3600, 1, 69), send(3000, 2, 69), step(2500)]
        : [step(150), send(550, 1, 69, 180), send(360, 2, 69), send(360, 3, 71), send(360, 4, 70)];
    return {
      steps,
      check: (s: Stage[]) => {
        if (!s.every((v, i) => stable(v, i > 0 && i < s.length - 1))) return false;
        if (n === 1)
          return /\bON\b|\bUKLJUCEN\b/i.test(lines(s[1])) && /\bOFF\b|ISKLJUCEN/i.test(lines(s[4]));
        return (
          n !== 2 ||
          (containsN(s[1], 'P2', 1) &&
            containsN(s[4], 'P2', 2) &&
            s.slice(2, 4).every((v) => group(v, 'P2').every((r) => r.length === 1 && r[0] === 1)))
        );
      }
    };
  }
  if (id === 'LV11') {
    // Half a percentage point centers each integer map() band despite ADC rounding.
    const steps =
      n === 3
        ? [pot(350, 90), pot(4650, 10), pot(900, 10), pot(400, 90), pot(400, 10)]
        : [85.5, 26.5, 25.5, 26.5, 74.5, 75.5, 74.5, 20.5].map((v) => pot(380, v));
    const states =
      n === 3 ? [false, true, false, false, false] : [false, false, true, true, true, false, false, true];
    return {
      steps,
      check: (s: Stage[]) =>
        s.every((v, i) => stable(v, states[i])) &&
        (n === 3
          ? /KVAR/i.test(s.slice(2).map(lines).join(' '))
          : n === 2
            ? [2, 3, 4, 5, 7].every((i) => containsN(s[i], 'P2', i === 7 ? 2 : 1))
            : true)
    };
  }
  if (id === 'LV12') {
    const steps =
      n === 1
        ? [key(150, false), key(250, true), key(4250, false), key(750, false)]
        : n === 2
          ? [key(150, false), key(500, true), key(400, false), key(400, true), key(900, false)]
          : [
              key(150, false),
              key(150, true),
              key(1150, false),
              key(200, true),
              key(2550, false),
              key(200, true),
              key(800, false),
              key(3100, false)
            ];
    const states =
      n === 1
        ? [false, true, true, false]
        : n === 2
          ? [false, true, true, false, false]
          : [false, true, true, false, false, true, true, false];
    return {
      steps,
      check: (s: Stage[]) => {
        if (!s.every((v, i) => stable(v, states[i])) || last(s.at(-1)!)?.digits !== '0000') return false;
        if (n === 1) {
          const log = s.map(lines).join('\n');
          return (
            (log.match(/\bRAD\b/gi) ?? []).length === 1 && (log.match(/\bGOTOVO\b/gi) ?? []).length === 1
          );
        }
        if (n === 2) return last(s[3])?.digits === '0000';
        return (
          last(s[2])?.digits === last(s[4])?.digits &&
          Number(last(s[4])?.digits) > 0 &&
          last(s[4])?.digits === last(s[5])?.digits
        );
      }
    };
  }
  if (id === 'LV13') {
    const target = (ms: number, t: number, fault = false) =>
      step(
        ms,
        { component: 'pot', position: 50 },
        { component: 'ds1', temperature: t, oneWireFault: fault ? 'disconnected' : 'none' }
      );
    const steps =
      n === 3
        ? [target(2300, 22), target(2400, 22, true), target(2400, 22)]
        : [27, 24.25, 23.75, 25.75, 26.25, 23.5].map((t) => target(2300, t));
    const states = n === 3 ? [true, false, false] : [false, false, true, true, false, true];
    return {
      steps,
      check: (s: Stage[]) => {
        if (!s.every((v, i) => stable(v, states[i]))) return false;
        if (n === 3) return /ZAKLJUCANO/i.test(s.slice(1).map(lines).join(' '));
        if (n === 1) return true;
        return s.every((v, i) => {
          const rows = v.lines.flatMap((l) => {
            const r = numbers(l.text, 'P2');
            return r ? [{ r, t: l.t }] : [];
          });
          return (
            rows.length >= 2 &&
            rows.every(({ r, t }) => r.length === 2 && near(r[0], t, 130)) &&
            rows.at(-1)!.r[1] === [0, 0, 1, 1, 1, 2][i]
          );
        });
      }
    };
  }
  if (id === 'LV14') {
    const duty = (s: Stage) => {
      const pin = s.frame?.gpios['5'];
      return pin?.mode === 'PWM' ? (pin.duty! * 255) / 65535 : pin?.level === 1 ? 255 : 0;
    };
    const steps =
      n === 1
        ? [0, 15, 20, 60, 100].map((v) => pot(350, v))
        : n === 2
          ? [pot(400, 0), pot(300, 100), pot(400, 100), key(80, true, 2), pot(400, 100)]
          : [
              pot(350, 0),
              pot(600, 100),
              pot(1700, 100),
              pot(950, 100),
              pot(2000, 100),
              pot(stopWhileRunning ? 1200 : 200, 100),
              key(180, true, 2),
              pot(1600, 100)
            ];
    return {
      steps,
      check: (s: Stage[]) => {
        const d = s.map(duty);
        if (n === 1) return d.every((v, i) => near(v, [0, 0, 80, 140, 200][i], 7));
        if (n === 2)
          return (
            d[0] < 2 && d[1] >= 15 && d[1] <= 35 && d[2] > d[1] + 15 && d[2] <= 75 && d[3] < 2 && d[4] < 2
          );
        return (
          d[1] > 20 &&
          d[2] < 2 &&
          d[3] > 20 &&
          d[4] < 2 &&
          (stopWhileRunning ? d[5] > 20 : d[5] < 2) &&
          d[6] < 2 &&
          d[7] < 2
        );
      }
    };
  }
  const a4988 = id === 'LV15B';
  const stages =
    n === 1
      ? [key(160, false), key(140, true), key(2100, false)]
      : n === 2
        ? [key(160, false), key(140, true), key(2100, false), key(140, true), key(2100, false)]
        : [
            key(160, false),
            key(85, true),
            key(50, false),
            key(80, true),
            key(350, false),
            key(100, true),
            key(2100, false)
          ];
  return {
    steps: stages,
    check: (s: Stage[]) => {
      const count = (v: Stage) => (a4988 ? last(v)?.steps : v.frame?.avr?.coils?.commands);
      const position = (v: Stage) => (a4988 ? last(v)?.drive : last(v)?.coils);
      const stopped = (v: Stage) =>
        a4988
          ? Object.values(v.frame?.steppers?.drivers ?? {}).every((d) => !d.enabled && !d.rejected)
          : v.frame?.avr?.coils?.errors === 0 &&
            Object.values(v.frame?.leds ?? {}).every((l) => l.currentMa < 0.05);
      const amount = count(s[2]) ?? 0;
      if (n === 1) {
        const motor = Object.values(s[2].frame?.steppers?.motors ?? {})[0],
          driver = Object.values(s[2].frame?.steppers?.drivers ?? {})[0];
        return (
          stopped(s[2]) &&
          amount === (a4988 ? Math.round(((motor?.fullSteps ?? 0) * (driver?.resolution ?? 0)) / 4) : 256) &&
          amount > 0
        );
      }
      if (n === 2)
        return (
          amount > 1 &&
          count(s[4]) === amount * 2 &&
          Math.abs(position(s[2]) ?? 0) > 0 &&
          position(s[4]) === 0 &&
          stopped(s[4])
        );
      const partial = count(s[3]) ?? 0,
        finished = count(s[6]) ?? 0;
      return (
        partial > 0 &&
        partial === count(s[4]) &&
        stopped(s[4]) &&
        finished > 2 * partial &&
        stopped(s[6]) &&
        (containsN(s[3], 'P3', partial) || containsN(s[4], 'P3', partial))
      );
    }
  };
}
