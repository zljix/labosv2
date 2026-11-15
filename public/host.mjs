// No public JavaScript module is exposed to the Python program.
import { createCircuitHost } from './circuit-host.mjs';
export function createHost(send, initial = {}) {
  if (initial.circuit) return createCircuitHost(send, initial);
  const pins = new Map();
  let button = !!initial.button;
  let powered = initial.powered !== false;
  let swapped = !!initial.swapped;
  let echo = new Uint8Array();
  let lastState = 0;
  let pending;
  let frameAt = 0;
  let i2cEvents = 0;
  const buses=new Map();
  const publish = () => {
    if (pending) clearTimeout(pending);
    pending = undefined;
    lastState = Date.now();
    send({ type: 'pins', pins: Object.fromEntries(pins), button });
  };
  const queuePins = () => {
    const elapsed = Date.now() - lastState;
    if (elapsed >= 16) publish();
    else if (!pending) pending = setTimeout(publish, 16 - elapsed);
  };
  return {
    mode(pin, output, pull=0, value=-1) {
      if (output && (!pins.has(pin) || value >= 0)) {
        pins.set(pin, value < 0 ? 0 : value ? 1 : 0);
        queuePins();
      } else if (!output && pins.has(pin)) {
        pins.delete(pin);
        queuePins();
      }
    },
    adc() { return -1; },
    pwm() { return -4; },
    input(data) {
      if ('button' in data) button = !!data.button;
      if ('powered' in data) powered = !!data.powered;
      if ('swapped' in data) swapped = !!data.swapped;
    },
    read(pin, pull) {
      if (pins.has(pin)) return pins.get(pin);
      if (pin === 5 && button) return 0;
      return pull === 1 ? 1 : pull === 2 ? 0 : -1;
    },
    write(pin, value) {
      if (pins.get(pin) === value) return;
      pins.set(pin, value);
      // Bound the message rate even if a program toggles without sleep.
      queuePins();
    },
    i2cPresent(sda, scl, addr) {
      return powered && !swapped && sda === 8 && scl === 9 && addr === 0x38;
    },
    i2cConfig(id,sda,scl,freq){if(![0,1].includes(id)||freq<0||freq>400000)return -22;if(freq)buses.set(id,{sda,scl});else buses.delete(id);return 0;},
    i2cProbe(id,addr){const b=buses.get(id);return !!b&&powered&&!swapped&&b.sda===8&&b.scl===9&&addr===0x38;},
    i2cTx(id,addr,bytes,stop){
      if(!stop)return -95;
      const b=buses.get(id);if(!b||!powered||swapped||b.sda!==8||b.scl!==9||addr!==0x38)return -19;
      echo=bytes;if(++i2cEvents<=100)send({type:'i2c',address:addr,bytes:Array.from(bytes).slice(0,64)});return bytes.length;
    },
    i2cRx(id,addr,length,stop){
      if(!stop)return -95;
      const b=buses.get(id);if(!b||!powered||swapped||b.sda!==8||b.scl!==9||addr!==0x38)return -19;
      return Uint8Array.from({length},(_,i)=>echo[i]??0);
    },
    i2cWrite(bytes) {
      echo = bytes;
      if (++i2cEvents <= 100) send({ type: 'i2c', address: 0x38, bytes: Array.from(bytes).slice(0, 64) });
    },
    i2cByte(index) { return echo[index] ?? 0; },
    frame(bytes) {
      if (Date.now() - frameAt >= 32) {
        frameAt = Date.now();
        send({ type: 'frame', bytes: Array.from(bytes) });
      }
    },
    flush: publish,
  };
}
