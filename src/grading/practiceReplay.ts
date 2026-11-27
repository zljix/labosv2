import type { Project } from '../project/model';
import type { LiveInput } from '../circuit/model';
import { practices, type ExerciseId } from '../lessons/collectionPlans';
import { field, last, lines, near, step, timedValues, type Stage } from './replay';

export function practiceScenario(
  id: ExerciseId,
  changed: boolean,
  p: Project,
  captured: Record<string, LiveInput>,
  seed: number,
  libraryB = false
) {
  const rig = practices[id].rig;
  const parts = p.circuit.components;
  const part = (kind: string) => parts.find((c) => c.kind === kind);
  const sensor = part('ds18b20')?.id ?? 'ds1',
    dht = part('dht22')?.id ?? 'dht22';
  const ds = (temperature: number) => ({ component: sensor, temperature });
  const capturedT = (kind: string) => {
    const c = part(kind);
    return c ? (captured[c.id]?.temperature ?? c.properties.temperature) : undefined;
  };
  const sampled = (s: Stage, t: number) =>
    Object.values(s.frame?.oneWireDevices ?? {}).some(
      (d) => d.powered && d.sample > 0 && d.readings?.some((r) => r.valid && near(r.temperature, t, 0.2))
    ) && s.lines.some((l) => near(field(l.text, 'T_C'), t, 0.2));
  const led = (s: Stage, id: string, on: boolean) => {
    const current = s.frame?.leds[id]?.currentMa;
    return current != null && (on ? current > 0.35 : current < 0.05);
  };
  const position = (s: Stage, on: boolean) => near(last(s)?.pulse, on ? 2000 : 1000, 28);
  const target = (s: Stage, on: boolean) => led(s, 'led21', on) && position(s, on);
  const baseT = 23 + (seed % 3);
  if (rig === 'console')
    return {
      steps: [step(changed ? 12500 : 3600)],
      check: ([s]: Stage[]) => {
        const rows = s.lines.filter((l) => l.text);
        const period = rows[1]?.t - rows[0]?.t;
        return (
          rows.length >= 3 &&
          rows.every((l) => l.text === rows[0].text) &&
          timedValues(rows, (l) => l.t, period, 45) &&
          (changed
            ? rows[0].text !== 'Pozdrav iz Labosa' &&
              period >= 180 &&
              period <= 4050 &&
              !near(period, 1000, 45)
            : rows[0].text === 'Pozdrav iz Labosa' && near(period, 1000, 45))
        );
      }
    };
  if (rig === 'blink')
    return {
      steps: [step(6500)],
      check: ([s]: Stage[]) => {
        const transitions = s.readings.filter((r, i, a) => i === 0 || r.led > 0.35 !== a[i - 1].led > 0.35);
        const stamps = s.lines.filter((l) => /^LED (ON|OFF)$/.test(l.text));
        if (id === 'V1.2' && changed)
          return (
            !!part('led') &&
            !!s.frame?.gpios['21'] &&
            transitions.every((x) => x.led < 0.05) &&
            stamps.some((l) => l.text === 'LED ON') &&
            stamps.some((l) => l.text === 'LED OFF') &&
            Object.values(s.frame?.leds ?? {}).length === 1
          );
        const edges = transitions.slice(transitions.findIndex((t) => t.led > 0.35));
        return edges.length >= 5 && timedValues(edges, (r) => r.t, changed ? 1000 : 500, 70);
      }
    };
  if (rig === 'light') {
    const light = part('temt6000')?.id ?? 'svjetlo';
    return {
      steps: (changed ? [30, 140, 30] : [30, 500, 30]).map((illuminance) =>
        step(1300, { component: light, illuminance })
      ),
      check: (s: Stage[]) =>
        s.every(
          (v, i) => led(v, 'led21', i !== 1) && v.frame?.gpios['1']?.mode === 'ADC' && /ADC:/.test(lines(v))
        )
    };
  }
  if (rig === 'pwm' || rig === 'servo')
    return {
      steps: [step(5100)],
      check: ([s]: Stage[]) => {
        const expected = changed ? (rig === 'pwm' ? 120 : 150) : 90;
        const has = (angle: number, percent: number) =>
          s.readings.some(
            (r) =>
              near(r.pulse, 1000 + (angle * 1000) / 180, 18) &&
              (rig !== 'pwm' || (near(((r.duty ?? -65535) / 65535) * 100, percent, 1) && r.led > 0))
          );
        return has(30, 15) && has(expected, changed ? 50 : 75);
      }
    };
  if (rig === 'temperature' || rig === 'calibration' || rig === 'compare') {
    const temps = [baseT, baseT + 3];
    const steps = temps.map((t, i) =>
      step(rig === 'temperature' ? 16500 : 7200, ds(t), {
        component: dht,
        temperature: t + (changed ? (i ? 1 : -1) : 0)
      })
    );
    return {
      steps,
      check: (s: Stage[]) =>
        s.every((v, i) => {
          const t = temps[i];
          if (!sampled(v, t)) return false;
          if (rig === 'temperature') {
            const rows = v.lines.filter(
              (l) => near(field(l.text, 'T_C'), t, 0.2) && Number.isFinite(field(l.text, 'uzorak'))
            );
            return (
              rows.length >= 5 &&
              rows.slice(1).every((l, j) => field(l.text, 'uzorak') === field(rows[j].text, 'uzorak') + 1) &&
              timedValues(rows, (l) => field(l.text, 't_ms'), changed ? 3000 : 2000, 100) &&
              timedValues(rows, (l) => l.t, changed ? 3000 : 2000, 150)
            );
          }
          if (rig === 'calibration')
            return v.lines.some((l) => near(field(l.text, 'ispravljeno'), t + (changed ? 1 : 0), 0.2));
          return (
            (!changed ||
              near(Math.abs((capturedT('ds18b20') ?? NaN) - (capturedT('dht22') ?? NaN)), 1, 0.15)) &&
            Object.values(v.frame?.timedSensors ?? {}).some((d) => d.powered && d.sample > 0) &&
            v.lines.some(
              (l) =>
                near(field(l.text, 'DS18B20'), t) &&
                near(field(l.text, 'razlika'), changed ? (i ? -1 : 1) : 0)
            )
          );
        })
    };
  }
  if (rig === 'network') {
    const hi = changed && id === 'V2.6',
      t = hi ? 32 : baseT;
    const interval = changed && id === 'V2.2' ? 3000 : 2000;
    // Align samples after the conversion and before the next message.
    return {
      steps: Array.from({ length: 10 }, (_, i) => step(i ? interval : interval - 120, ds(t))),
      check: (s: Stage[]) => {
        const rows = s.map((v) => lines(v));
        const measurement = s.map((v) => v.lines.find((l) => Number.isFinite(field(l.text, 'seq'))));
        if (
          !measurement.every(
            (l, i) => l && field(l.text, 'seq') === i + 1 && near(field(l.text, 'T_C'), t, 0.25)
          ) ||
          !timedValues(measurement, (l) => l!.t, interval, 150)
        )
          return false;
        const ack = (i: number, n: number, action: string) =>
          new RegExp('ack_id:\\s*' + n + '\\s+' + action + '\\s+PRIHVACENO').test(rows[i]);
        const protocol =
          id === 'V4.4'
            ? 'TCP zapis'
            : id === 'V2.1' || id === 'V2.2' || (id === 'V2.3' && !changed)
              ? 'POST /uzorak'
              : 'PUBLISH';
        if (!rows[0].includes(protocol)) return false;
        if (changed && id === 'V2.1') return ack(0, 1, 'CLOSE') && target(s[0], false);
        if (!ack(0, 1, 'OPEN') || !target(s[0], true)) return false;
        if (changed && id === 'V2.S') return ack(1, 2, 'CLOSE') && target(s[1], false);
        if (
          !rows[1].includes('DUPLIKAT') ||
          !rows[2].includes('STARA') ||
          !rows[3].includes('NEPOZNATA') ||
          !ack(4, 4, 'CLOSE') ||
          !target(s[4], false)
        )
          return false;
        if (changed && id === 'V2.4')
          return (
            rows[5].includes('OFFLINE') &&
            rows[6].includes('OFFLINE') &&
            rows[7].includes('WAIT') &&
            ack(8, 5, 'AUTO')
          );
        if (changed && id === 'V4.4')
          return rows[6].includes('WAIT') && rows[7].includes('WAIT') && ack(8, 5, 'AUTO');
        return (
          rows[5].includes('OFFLINE') &&
          rows[6].includes('WAIT') &&
          ack(7, 5, 'AUTO') &&
          target(s[7], hi) &&
          (!hi || ((capturedT('ds18b20') ?? 0) > 30 && led(s[5], 'led47', true) && target(s[5], true)))
        );
      }
    };
  }
  if (rig === 'library' && libraryB) {
    return {
      steps: Array.from({ length: 4 }, (_, i) => step(i ? 2000 : 1850)),
      check: (s: Stage[]) => {
        const rows = s.map((v) => v.lines.find((l) => Number.isFinite(field(l.text, 'T_C')))?.text ?? '');
        // The worksheet's B sequence is 25, 27, 26.5, 26. With the new
        // threshold at 28, reaching 27 from below must leave the valve closed.
        return [25, 27, 26.5, 26].every(
          (t, i) => near(field(rows[i], 'T_C'), t) && target(s[i], false) && /program:\s*B/i.test(lines(s[i]))
        );
      }
    };
  }
  const broken = changed && ['V1.9', 'V3.3'].includes(id);
  const servoOpen = changed && id === 'V3.4';
  const faultRecovery = changed && id === 'V3.5';
  const temps =
    rig === 'alarm'
      ? [25, 28, 29, 31, 29, 27, 33]
      : rig === 'library' && changed
        ? [25, 27, 27.5, 28, 26.5, 26]
        : [baseT, 27, 26.5, 26, 28, 26.5];
  const ms = id === 'V3.6' ? 7100 : 4800;
  return {
    steps: temps.map((t, i) =>
      step(ms, {
        ...ds(t),
        ...(faultRecovery
          ? ({ oneWireFault: i === 2 ? 'disconnected' : 'none' } as const)
          : broken && captured[sensor]?.oneWireFault === 'disconnected'
            ? ({ oneWireFault: 'disconnected' } as const)
            : {})
      })
    ),
    check: (s: Stage[]) => {
      let open = false,
        alarm = false;
      if (changed && ['V1.1', 'V2.5', 'V3.1', 'V3.5', 'V3.7', 'V4.5'].includes(id)) {
        const expected: Record<string, number> = {
          'V1.1': 26.5,
          'V2.5': 29,
          'V3.1': 28,
          'V3.5': 25,
          'V3.7': 26.5,
          'V4.5': 28
        };
        if (!near(capturedT('ds18b20'), expected[id], 0.15)) return false;
      }
      return s.every((v, i) => {
        const t = temps[i];
        if (broken || (faultRecovery && i === 2)) {
          open = false;
          return !sampled(v, t) && /GRESKA DQ/i.test(lines(v)) && target(v, false);
        }
        if (!sampled(v, t)) return false;
        if (t >= (rig === 'library' && changed ? 28 : 27)) open = true;
        if (t <= 26) open = false;
        if (t >= (id === 'V4.6' && changed ? 32 : 30)) alarm = true;
        if (t <= 28) alarm = false;
        if (servoOpen)
          return (
            led(v, 'led21', open) &&
            v.frame?.servos?.servo?.powered === true &&
            v.frame.servos.servo.pulseUs === null
          );
        if (id === 'V3.6') {
          const ms = v.lines.map((l) => field(l.text, 't_ms')).filter(Number.isFinite);
          if (!timedValues(ms, (v) => v, changed ? 3000 : 2000, 100)) return false;
        }
        return target(v, open) && (rig !== 'alarm' || led(v, 'led47', alarm));
      });
    }
  };
}
