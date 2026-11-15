// MIT. Explicit KY-040 contact profile, not a universal clone specification.
// One detent is one full Gray cycle. Signals are passive contacts to GND;
// 10k pull-ups exist on CLK/DT, never on SW. No result is injected into code.
export function createQuadratureInputs({c, clockUs}) {
  const devices = (c.encoders ?? []).map(d => ({...d, phase:3,
    position:d.encoderPosition, target:d.encoderPosition, queue:[], trace:[], transitions:0}));
  const bits = phase => ({clk:phase >> 1, dt:phase & 1});
  function record(d, at) {
    d.trace.push({timeUs:at, ...bits(d.phase), sw:d.pressed?0:1, position:d.position});
    if (d.trace.length > 128) d.trace.shift();
  }
  for (const d of devices) record(d, clockUs());
  function observe() {
    let changed = false;
    for (const d of devices) {
      while (d.queue.length && d.queue[0].at <= clockUs()) {
        const e = d.queue.shift();
        if (d.phase !== e.phase) d.transitions++;
        d.phase = e.phase;
        if (e.complete) d.position += e.complete;
        record(d, e.at); changed = true;
      }
    }
    return changed;
  }
  function closed(d) {
    return [...(!(d.phase & 2) ? [d.clk] : []), ...(!(d.phase & 1) ? [d.dt] : []), ...(d.pressed ? [d.sw] : [])];
  }
  return {
    observe,
    nextEdgeUs() { return Math.min(Infinity, ...devices.map(d => d.queue[0]?.at ?? Infinity)); },
    edges(root, edge) {
      for (const d of devices) {
        edge(root(d.clk), root(d.vcc), 10000);
        edge(root(d.dt), root(d.vcc), 10000);
        for (const n of closed(d)) edge(root(n), root(d.gnd), .001);
      }
    },
    conflicts(pins, gpioNet, root) {
      const result = new Set();
      for (const d of devices) for (const n of closed(d)) {
        const grounded = c.rails.some(r => r.volts === 0 && root(r.net) === root(d.gnd));
        const high = c.rails.some(r => r.volts > 0 && root(r.net) === root(n)) ||
          [...pins].some(([id,p]) => root(gpioNet.get(id)) === root(n) &&
            (p.mode === 'OUT' && p.value || p.mode === 'PWM' && p.duty > 0));
        if (grounded && high) result.add(n);
      }
      return [...result];
    },
    input(data) {
      observe();
      const d = devices.find(d => d.id === data.component); if (!d) return;
      if (typeof data.encoderBounce === 'boolean') d.encoderBounce = data.encoderBounce;
      if (typeof data.pressed === 'boolean' && d.pressed !== data.pressed) {
        d.pressed = data.pressed; record(d, clockUs());
      }
      if (!Number.isInteger(data.encoderPosition) || Math.abs(data.encoderPosition) > 10000) return;
      const delta = data.encoderPosition - d.target;
      if (!delta) return;
      // Bound both memory and duration. Queueing keeps every requested turn;
      // changing the requested direction does not teleport to an AB state.
      if (d.queue.length + Math.abs(delta) * (d.encoderBounce?20:4) > 1280 || Math.abs(delta) > 32)
        throw Error('KY-040: pričekaj završetak vrtnje (najviše 32 nova koraka).');
      const sign = Math.sign(delta), path = sign > 0 ? [1,0,2,3] : [2,0,1,3];
      let at = d.queue.at(-1)?.at ?? clockUs();
      let previous = 3;
      for (let step=0; step<Math.abs(delta); step++) for (let i=0; i<4; i++) {
        at += d.encoderEdgeMs * 1000;
        const phase = path[i];
        if (d.encoderBounce) {
          // A deterministic teaching stimulus, not measured switch noise.
          for (const [offset,value] of [[0,phase],[200,previous],[400,phase],[600,previous]])
            d.queue.push({at:at+offset,phase:value});
          at += 800;
        }
        d.queue.push({at,phase,complete:i===3?sign:0}); previous=phase;
      }
      d.target = data.encoderPosition;
    },
    snapshot(volts, pins, gpioNet, root) {
      const diagnostics=[];
      const encoders = Object.fromEntries(devices.map(d => {
        const powered = volts[d.vcc]!=null && volts[d.gnd]!=null && Math.abs(volts[d.gnd])<.05 && Math.abs(volts[d.vcc]-volts[d.gnd]-d.moduleVoltage)<.15;
        const report = (code,message,nets) => diagnostics.push({code,severity:'warning',message,
          terminals:nets.flatMap(n=>c.nets[n].terminals),wires:nets.flatMap(n=>c.nets[n].wires)});
        if (!powered) report('encoder-supply',`${d.id}: provjeri + (${d.moduleVoltage} V) i zajedničku masu. Kontakti su pasivni; SW treba programski pull-up.`,[d.vcc,d.gnd]);
        for (const [label,n] of [['CLK',d.clk],['DT',d.dt],['SW',d.sw]]) {
          if (!c.nets[n].wires.length) report('encoder-signal-open',`${d.id}: ${label} nije spojen.`,[n]);
          if (volts[n] == null) report('encoder-floating',`${d.id}: ${label} je nepobuđen; SW zahtijeva PULL_UP / INPUT_PULLUP.`,[n]);
          if ([...pins].some(([id,p])=>root(gpioNet.get(id))===root(n) && ['OUT','PWM'].includes(p.mode)))
            report('encoder-driven',`${d.id}: ${label} treba digitalni ulaz, a program ga pogoni kao izlaz.`,[n]);
        }
        return [d.id,{powered,position:d.position,targetPosition:d.target,...bits(d.phase),sw:d.pressed?0:1,
          busy:!!d.queue.length,transitions:d.transitions,trace:d.trace.slice(),
          volts:{CLK:volts[d.clk],DT:volts[d.dt],SW:volts[d.sw]}}];
      }));
      return {encoders,diagnostics};
    }
  };
}
