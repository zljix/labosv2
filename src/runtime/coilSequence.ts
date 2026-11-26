// The four LED inputs on the ULN2003 training board expose the phase commands.
// Count stable electrical states, including when the student rewires an input.
export const phaseIndicators = ['ulnIn1','ulnIn2','ulnIn3','ulnIn4'];
const sequence = [1,3,2,6,4,12,8,9];
export class CoilSequence {
  private mask = -1;
  private stableCycles = 0;
  private accepted = -1;
  private phase = 0;
  commands = 0;
  steps = 0;
  errors = 0;

  sample(currents:Record<string,number>, cycles:number) {
    const mask = phaseIndicators.reduce((bits,id,i) => bits | (currents[id] > .1 ? 1 << i : 0), 0);
    if (mask !== this.mask) { this.mask = mask; this.stableCycles = 0; }
    this.stableCycles += cycles;
    // digitalWrite updates four outputs in succession. Ignore intermediate edges under 50 µs.
    if (this.accepted === mask || this.stableCycles < 800) return;
    this.accepted = mask;
    if (mask === 0) return;
    this.commands++;
    const next = sequence.indexOf(mask);
    if (next < 0) { this.errors++; return; }
    const delta = (next - this.phase + sequence.length) % sequence.length;
    if (delta === 1) this.steps++;
    else if (delta === 7) this.steps--;
    else if (delta !== 0) this.errors++;
    this.phase = next;
  }
}
