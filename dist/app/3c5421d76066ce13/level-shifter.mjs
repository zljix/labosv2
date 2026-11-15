// MIT. SN74LVC2T45 functional GPIO profile: A=3.3 V, B=5 V.
// TI SCES516N sections 4, 5.3 and 7.4. No propagation/current/thermal model.
export function levelInput(volts, supply) {
  if (volts === null || !Number.isFinite(volts) || volts < -.05 || volts > 5.5) return null;
  const low = supply <= 3.6 ? .8 : .3 * supply;
  const high = supply <= 3.6 ? 2 : .7 * supply;
  return volts <= low + 1e-9 ? 0 : volts >= high - 1e-9 ? 1 : null;
}
export function evaluateLevelShifters(devices, volts, commonGround) {
  const states = {}, drives = [];
  for (const d of devices ?? []) {
    const g = volts[d.gnd], a = volts[d.vcca], b = volts[d.vccb];
    const relative = n => volts[n] === null || g === null ? null : volts[n] - g;
    const va = relative(d.vcca), vb = relative(d.vccb);
    const powered = commonGround(d.gnd) && g !== null && Math.abs(g) < .05 && va >= 3 && va <= 3.6 && vb >= 4.5 && vb <= 5.5;
    const dir = powered ? levelInput(relative(d.dir), va) : null;
    const direction = dir === null ? null : dir ? 'A → B' : 'B → A';
    const reason = !powered ? 'Provjeri VCCA=3,3 V, VCCB=5 V i zajedničku masu; izlazi modela su otpušteni.' : dir === null ? 'DIR nema valjanu razinu; model ne određuje izlaze.' : 'Dva kanala dijele DIR; izlaz je aktivni push-pull.';
    const channels = d.a.map((an, i) => {
      const input = dir === null ? null : dir ? an : d.b[i];
      const output = dir === null ? null : dir ? d.b[i] : an;
      const inputVolts = input === null ? null : relative(input);
      const level = input === null ? null : levelInput(inputVolts, dir ? va : vb);
      const outputVolts = level === null ? null : level ? dir ? b : a : g;
      if (output !== null && outputVolts !== null) drives.push({id:d.id,channel:i+1,net:output,gnd:d.gnd,volts:outputVolts,level});
      return {input:input === null ? '—' : `${dir ? 'A' : 'B'}${i+1}`,output:output === null ? '—' : `${dir ? 'B' : 'A'}${i+1}`,inputVolts,outputVolts,level,reason:level === null ? 'Ulaz je plivajući ili između logičkih pragova; rezultat nije određen.' : 'Valjana logička razina'};
    });
    states[d.id] = {powered,direction,vcca:va,vccb:vb,dir:relative(d.dir),reason,channels};
  }
  return {states,drives};
}
