export function latencySummary(samples) {
  if (!Array.isArray(samples) || samples.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw Error('Latency samples must be finite non-negative numbers.');
  if (!samples.length) return {samples: 0, p50Ms: null, p95Ms: null, maxMs: null};
  const ordered = [...samples].sort((a, b) => a - b);
  const rounded = value => Math.round(value * 100) / 100;
  return {samples: ordered.length, p50Ms: rounded(ordered[Math.ceil(ordered.length * .5) - 1]),
    p95Ms: rounded(ordered[Math.ceil(ordered.length * .95) - 1]), maxMs: rounded(ordered.at(-1))};
}
