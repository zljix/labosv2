import type { LabId } from '../lessons/ursLab';
import { near, step, type Stage, type Stimulus } from './replay';
type Value = number | null;
export function numbers(text: string, tag: string): Value[] | undefined {
  const words = text.trim().split(/[\s;|]+/);
  if (words.shift()?.toUpperCase() !== tag) return;
  return words.map((w) =>
    /^(ERR|GRESKA|NAN)$/i.test(w)
      ? null
      : /^[+-]?\d+(?:[.,]\d+)?$/.test(w)
        ? Number(w.replace(',', '.'))
        : NaN
  );
}
const equal = (a: Value[] | undefined, b: Value[], tol = 0.65) =>
  !!a && a.length === b.length && a.every((v, i) => (b[i] === null ? v === null : near(v, b[i]!, tol)));
const avg = (a: number[]) => (a.length ? a.reduce((n, v) => n + v, 0) / a.length : null);
const clean = (a: Value[]): number[] => a.filter((v): v is number => v !== null);
export function sensorLab(id: LabId, n: number, seed: number) {
  const offset = seed % 4;
  const ds = id === 'LV03',
    dht = id === 'LV04';
  const phase = (k: number) => {
    const hot = k % 2 === 1,
      t = 20 + offset + (hot ? 6 : 0),
      fault = k === 1 || k === 3;
    const inputs: Stimulus[] = [
      { component: 'lm351', temperature: t },
      { component: 'ds1', temperature: t + 3, oneWireFault: !dht && fault ? 'disconnected' : 'none' },
      {
        component: 'dht1',
        temperature: t + 2,
        humidity: 40 + t / 2,
        dhtFault: dht && k === 1 ? 'checksum' : 'none'
      },
      {
        component: 'dht2',
        temperature: t - 1,
        humidity: 70 - t / 2,
        dhtFault: dht && k === 3 ? 'timeout' : 'none'
      },
      { component: 'aht10', temperature: t - 2, humidity: 45 + offset }
    ];
    const td: Value = fault ? null : t + 3,
      t11: Value = dht && k === 1 ? null : t + 2,
      t22: Value = dht && k === 3 ? null : t - 1;
    const rh11 = t11 === null ? null : Math.round(40 + t / 2),
      rh22 = t22 === null ? null : 70 - t / 2;
    const values = ds
      ? [t, td]
      : dht
        ? [t11, t22, rh11, rh22]
        : [t, td, t11, t22, t - 2, rh11, rh22, 45 + offset];
    return { inputs, values };
  };
  const stages = Array.from({ length: dht ? 5 : n === 1 ? 3 : 4 }, (_, i) => phase(i));
  const ms = n === 1 ? 6200 : dht && n === 2 ? 7600 : 8000;
  return {
    steps: stages.map((s) => step(ms, ...s.inputs)),
    check: (out: Stage[]) => {
      if (n === 1)
        return out.every((s, i) => {
          const v = stages[i].values;
          const expected = ds
            ? v[1] === null
              ? [null]
              : [v[0]! - v[1]]
            : dht
              ? v.some((x) => x === null)
                ? [null]
                : [v[0]! - v[1]!, v[2]! - v[3]!]
              : (() => {
                  const ts = clean(v.slice(0, 5));
                  return [ts.length, Math.min(...ts), Math.max(...ts), Math.max(...ts) - Math.min(...ts)];
                })();
          return s.lines.some((l) => equal(numbers(l.text, 'P1'), expected, dht ? 0.7 : 0.65));
        });
      if (dht && n === 2) {
        let last = [0, 0];
        return out.every((s, i) => {
          const rows = s.lines.map((l) => numbers(l.text, 'P2')).filter((r): r is Value[] => !!r);
          if (!rows.length) return false;
          const now = rows.at(-1)!;
          if (now.length !== 2 || !now.every((x) => Number.isInteger(x) && x !== null && x >= 0))
            return false;
          const current = now as number[];
          const ok = current.every((v, k) => (i === (k ? 3 : 1) ? v > last[k] : v === last[k]));
          last = current;
          return ok;
        });
      }
      let rows: Value[][] = [],
        accepted = 0,
        valid = true,
        seen = 0;
      const cumulative = ds && n === 2;
      for (const [i, s] of out.entries()) {
        const target = stages[i].values,
          prior = stages[Math.max(i - 1, 0)].values;
        let fresh = 0;
        for (const line of s.lines) {
          const raw = numbers(line.text, 'UZ');
          if (raw) {
            if (
              raw.length !== target.length ||
              raw.some((v, j) => !equal([v], [target[j]], 0.75) && !equal([v], [prior[j]], 0.75))
            )
              valid = false;
            if (equal(raw, target, 0.75)) fresh++;
            rows.push(raw);
            seen++;
            continue;
          }
          const values = numbers(line.text, 'P' + n);
          if (!values) continue;
          if (!rows.length || (!cumulative && rows.length !== 10)) {
            valid = false;
            continue;
          }
          const columns = target.map((_, j) => clean(rows.map((r) => r[j])));
          let expected: Value[];
          if (cumulative)
            expected = columns.flatMap((col) =>
              col.length ? [Math.min(...col), Math.max(...col)] : [null, null]
            );
          else if (id === 'LV05' && n === 3) {
            const means = columns.slice(0, 5).map(avg),
              overall = avg(clean(means));
            expected = means.map((m) => (m === null || overall === null ? null : m - overall));
          } else expected = columns.flatMap((col) => [avg(col), col.length]);
          if (!equal(values, expected, 0.16)) valid = false;
          if (!cumulative) rows = [];
          accepted++;
        }
        if (!fresh) valid = false;
      }
      return valid && seen >= 10 && accepted >= (cumulative ? seen : 1);
    }
  };
}
