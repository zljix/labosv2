import {phaseIndicators} from '../runtime/coilSequence';
import {NANO, S3} from '../boards/profiles';
import {emptyCircuit, makePart, terminals, type Circuit, type Kind} from '../circuit/model';
import {actuatorCircuit} from '../circuit/actuatorExamples';
import {analogCircuit} from '../circuit/analogExamples';
import {oneWireCircuit} from '../circuit/oneWireExamples';
import {dhtCircuit} from '../circuit/dhtExamples';
import {irCircuit} from '../circuit/irExamples';
import {spiCircuit} from '../circuit/spiExamples';
import {stepperCircuit} from '../circuit/stepperExamples';
import {tmCircuit} from '../circuit/tm1637Examples';

export function ursLabCircuit(id: string): Circuit {
  const plc = id === 'LV16';
  const circuit = emptyCircuit(plc ? S3 : NANO);
  const board = circuit.components[0];
  board.x = 35;
  board.y = 120;
  const pads = terminals(board);
  const ground = pads.find(p => p.role === 'ground')!.pin;
  const gpio = (n: number) => pads.find(p => p.gpio === n)!.pin;
  function wire(a: string, pin: string, b: string, end: string, color = '#087f8c') {
    circuit.wires.push({id: 'lvWire' + circuit.wires.length, from: {component:a, pin}, to: {component:b, pin:end}, points:[], color});
  }
  function add(kind: Kind, name: string, x: number, y: number) {
    const part = makePart(kind, x, y, name);
    circuit.components.push(part);
    return part;
  }
  function attach(base: Circuit, dx = 0, dy = 0, remap: Record<string,string> = {}) {
    const originalBoard = base.components[0].id;
    for (const part of base.components.slice(1)) {
      part.x += dx; part.y += dy;
      circuit.components.push(part);
    }
    const endpoint = (e: {component:string; pin:string}) => e.component === originalBoard
      ? {component:board.id, pin:remap[e.pin] ?? e.pin} : e;
    for (const w of base.wires) {
      const a = endpoint(w.from), b = endpoint(w.to);
      wire(a.component, a.pin, b.component, b.pin, w.color);
    }
  }
  function button(pin: number, label: string, x = 610, y = 490) {
    const b = add('button', 'tipka' + pin, x, y);
    b.label = label;
    wire(board.id, gpio(pin), b.id, 'A1');
    wire(board.id, ground, b.id, 'B1', '#334155');
  }
  function led(pin: number, label: string, x: number, y: number, id = 'dioda' + pin) {
    const r = add('resistor', 'r' + pin, x, y);
    r.properties.resistance = 1000;
    const light = add('led', id, x + 200, y);
    light.label = label;
    wire(board.id, gpio(pin), r.id, '1');
    wire(r.id, '2', light.id, 'A');
    wire(board.id, ground, light.id, 'K', '#334155');
  }
  function pot(x: number, y: number) {
    const p = add('potentiometer', 'pot', x, y);
    wire(board.id, '5V', p.id, '1', '#d04b46');
    wire(board.id, 'A0', p.id, '2');
    wire(board.id, ground, p.id, '3', '#334155');
  }
  function relay() {
    const r = add('relay', 'relej', 1050, 460);
    r.properties.logicVoltage = 5;
    r.properties.activeLevel = 'low';
    for (const pin of ['VCC', 'LV']) wire(board.id, '5V', r.id, pin, '#d04b46');
    wire(board.id, ground, r.id, 'GND', '#334155');
    wire(board.id, 'D7', r.id, 'IN');
  }
  function i2c(kinds: ('bmp180'|'ssd1306_32'|'aht10')[], y: number) {
    const shifter = add('i2cLevelShifter', 'pretvornik', 610, y);
    const v33 = pads.find(p => p.role === '3v3')!.pin;
    wire(board.id, v33, shifter.id, 'LV', '#d04b46');
    wire(board.id, '5V', shifter.id, 'HV', '#d04b46');
    wire(board.id, ground, shifter.id, 'GND', '#334155');
    wire(board.id, 'A4', shifter.id, 'SDA_H');
    wire(board.id, 'A5', shifter.id, 'SCL_H');
    for (const [i, kind] of kinds.entries()) {
      const device = add(kind, kind, 965 + 320 * i, y);
      device.properties.moduleVoltage = 3.3;
      wire(board.id, v33, device.id, 'VCC', '#d04b46');
      wire(board.id, ground, device.id, 'GND', '#334155');
      wire(shifter.id, 'SDA_L', device.id, 'SDA');
      wire(shifter.id, 'SCL_L', device.id, 'SCL');
    }
  }

  if (id === 'LV01') led(13, 'Pokaznik ugrađene LED D13', 630, 200);
  if (id === 'LV02') i2c(['ssd1306_32'], 150);
  if (id === 'LV03' || id === 'LV05' || id === 'LV13') attach(oneWireCircuit('ds18b20', NANO));
  if (id === 'LV03' || id === 'LV05') attach(analogCircuit('lm35', NANO), 340, -15);
  if (id === 'LV04' || id === 'LV05') {
    const sensors = dhtCircuit('dhtCompare', NANO);
    for (const r of sensors.components.filter(p => p.kind === 'resistor')) r.properties.resistance = 10000;
    attach(sensors, 0, id === 'LV05' ? 300 : 0, {D2:'D4', D3:'D5'});
    if (id === 'LV05') i2c(['aht10'], 700);
  }
  if (id === 'LV06') {
    const servo = actuatorCircuit('sg90Sweep', NANO);
    const part = servo.components.find(p => p.kind === 'sg90')!;
    part.properties.servoMinUs = 544; part.properties.servoMaxUs = 2400;
    attach(servo, 0, 0, {D8:'D9'});
    pot(630, 405);
  }
  if (id === 'LV07') { attach(spiCircuit('tftGraphics', NANO)); button(4, 'Joystick SW'); }
  if (id === 'LV08') { i2c(['bmp180', 'ssd1306_32'], 120); pot(650, 435); }
  if (id === 'LV09') attach(analogCircuit('temt6000', NANO));
  if (id === 'LV10') attach(irCircuit('irNEC', NANO));
  if (id === 'LV11' || id === 'LV13') pot(650, 460);
  if (id === 'LV12') { attach(tmCircuit('tmCounter', NANO), 0, 0, {D2:'D3', D3:'D2'}); button(4, 'Joystick SW'); }
  if (['LV07','LV09','LV10','LV11','LV12','LV13'].includes(id)) relay();
  if (id === 'LV14') {
    const motor = actuatorCircuit('dcDrive', NANO);
    attach(motor, 0, 0, {D12:'D8'});
    pot(600, 560);
    circuit.components.find(p => p.id === 'pot')!.properties.position = 0;
    button(2, 'STOP', 915, 615);
  }
  if (id === 'LV15') {
    for (let phase = 0; phase < 4; phase++) led(8 + phase, 'ULN2003 · IN' + (phase + 1), 640, 55 + phase * 125, phaseIndicators[phase]);
    button(4, 'START', 1110, 120);
  }
  if (id === 'LV15B') {
    const stepper = stepperCircuit('stepperBasic', NANO);
    const driver = stepper.components.find(p => p.kind === 'a4988')!;
    for (const w of stepper.wires) {
      if (w.to.component !== driver.id) continue;
      if (w.to.pin === 'ENABLE') w.from.pin = 'D8';
      if (['RESET','SLEEP'].includes(w.to.pin)) w.from.pin = '5V';
      if (['MS1','MS2','MS3'].includes(w.to.pin)) w.from.pin = ground;
    }
    attach(stepper);
    wire(board.id, ground, 'stepperSupply', '-', '#334155');
    const pull = add('resistor', 'enPull', 615, 55);
    pull.properties.resistance = 10000;
    wire(board.id, '5V', pull.id, '1', '#d04b46');
    wire(pull.id, '2', driver.id, 'ENABLE');
    button(4, 'START', 680, 570);
  }
  if (plc) {
    button(4, 'Start', 460, 65); button(5, 'STOP', 700, 65);
    button(6, 'Prekid zaštite', 460, 255); button(7, 'Reset', 700, 255);
    led(21, 'Motor · izlaz PLC-a', 460, 465);
  }
  return circuit;
}
