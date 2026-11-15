// MIT. Functional two-channel open-drain carrier, based on AN10441 fig. 1.
// LV=3.3 V, HV=5 V. 10 kohm pull-ups are a Lab carrier choice.
// No MOSFET transfer curve, RC rise time, hot-swap or physical speed claim.
export function i2cLevelRoute(shifters, from, to, root = n => n) {
  const equal = (a, b) => a.every((n, i) => root(n) === root(b[i]));
  if (equal(from, to)) return {direct: true};
  for (const d of shifters ?? []) {
    if (equal(from, d.low) && equal(to, d.high))
      return {direct: false, id: d.id, fromVoltage: 3.3, toVoltage: 5};
    if (equal(from, d.high) && equal(to, d.low))
      return {direct: false, id: d.id, fromVoltage: 5, toVoltage: 3.3};
  }
  return null;
}

export function evaluateI2CLevelShifters(devices, volts, commonGround, supplied) {
  const states = {}, bridges = [];
  for (const d of devices ?? []) {
    const ground = volts[d.gnd];
    const relative = n => Number.isFinite(volts[n]) && Number.isFinite(ground) ? volts[n] - ground : null;
    const lv = relative(d.lv), hv = relative(d.hv);
    // Explicit rails prevent unloaded pull-ups from certifying phantom power.
    const powered = commonGround(d.gnd) && ground !== null && Math.abs(ground) < .05 &&
      supplied(d.lv, 3.3) && supplied(d.hv, 5) && lv >= 3 && lv <= 3.6 && hv >= 4.5 && hv <= 5.5;
    const channels = d.low.map((low, i) => {
      const high = d.high[i], lowVolts = relative(low), highVolts = relative(high);
      const pulledLow = powered && ((lowVolts !== null && lowVolts >= -.05 && lowVolts <= .3 * lv) ||
        (highVolts !== null && highVolts >= -.05 && highVolts <= .3 * hv));
      // A conducting switch joins signal lines, never their supply rails.
      if (pulledLow) bridges.push({id: d.id, low, high});
      const idle = powered && lowVolts !== null && highVolts !== null &&
        lowVolts >= .75 * lv && lowVolts <= lv + .3 && highVolts >= .75 * hv && highVolts <= hv + .3;
      return {name: i ? 'SCL' : 'SDA', lowVolts, highVolts, pulledLow, idle};
    });
    states[d.id] = {powered, lv, hv, channels, reason: !powered ?
      'Provjeri LV=3,3 V, HV=5 V i zajedničku masu. Napon vraćen kroz pull-up nije priključeno napajanje; model tada ne prenosi I2C.' :
      channels.every(ch => ch.idle) ? 'Otpuštene linije: svaka strana ima svoj HIGH. I2C ACK i podaci provjeravaju se zasebno.' :
      channels.some(ch => ch.pulledLow) ? 'Otvoreni odvod povlači LOW na obje strane; otpuštanje vraća zasebne HIGH razine.' :
      'Neodređena razina: provjeri pull-up otpornike i spojeve.'};
  }
  return {states, bridges};
}
