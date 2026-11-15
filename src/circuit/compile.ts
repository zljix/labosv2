import { buildNets, checkCircuit } from "./netlist";
import { keyOf, circuitBoard, SPI_KINDS, I2C_KINDS, deviceAddress, signalVoltage, ANALOG_KINDS, DHT_KINDS, type Circuit } from "./model";

/** Stable wire nets; live button contacts are closed inside the Worker. */
export function compileCircuit(circuit: Circuit, backend: "micropython"|"avr" = "micropython") {
  if(backend==="micropython"&&circuitBoard(circuit).logicVoltage!==3.3)throw Error("AVR izvršni adapter još nije dostupan. Arduino projekt nije pokrenut u MicroPythonu.");
  const errors = checkCircuit(circuit).diagnostics.filter(d => d.severity === "error");
  if (errors.length) throw Error(errors.map(d => d.message).join("\n"));
  const open = structuredClone(circuit);
  for (const p of open.components) if (p.kind === "button") p.properties.pressed = false;
  const graph = buildNets(open);
  const used = graph.nets.filter(n => n.wires.length || n.terminals.some(t =>
    ["gpio", "analog", "ground", "3v3", "5v"].includes(t.role) ||
    !["board", "breadboard"].includes(open.components.find(p => p.id === t.component)!.kind)));
  const index = new Map(used.map((n, i) => [n.id, i]));
  const at = (id: string, pin: string) => index.get(graph.byTerminal.get(keyOf({component:id, pin}))!.id)!;
  return {
    version: 1,
    referenceGrounds:used.flatMap((n,i)=>n.terminals.some(t=>t.component===circuit.components.find(p=>p.kind==="board")!.id&&t.role==="ground")?[i]:[]),
    nets: used.map(n => ({id:n.id, terminals:n.terminals.map(keyOf), wires:n.wires})),
    gpios: used.flatMap((n, i) => n.terminals.filter(t => (t.role === "gpio" || t.role === "analog")).map(t => ({pin:t.gpio!, net:i}))),
    rails: [...circuit.components.filter(p=>p.kind==="powerSupply").map(p=>({net:at(p.id,"+"),volts:p.properties.supplyVoltage!})),...used.flatMap((n, i) => n.terminals.filter(t => ["ground", "3v3", "5v"].includes(t.role)).map(t => ({net:i, volts:t.role === "ground" ? 0 : t.role === "3v3" ? 3.3 : 5})))],
    levelShifters:circuit.components.filter(p=>p.kind==="levelShifter").map(p=>({id:p.id,vcca:at(p.id,"VCCA"),vccb:at(p.id,"VCCB"),gnd:at(p.id,"GND"),dir:at(p.id,"DIR"),a:[at(p.id,"A1"),at(p.id,"A2")],b:[at(p.id,"B1"),at(p.id,"B2")]})),
    i2cLevelShifters:circuit.components.filter(p=>p.kind==="i2cLevelShifter").map(p=>({id:p.id,lv:at(p.id,"LV"),hv:at(p.id,"HV"),gnd:at(p.id,"GND"),pullups:p.properties.pullups!,low:[at(p.id,"SDA_L"),at(p.id,"SCL_L")],high:[at(p.id,"SDA_H"),at(p.id,"SCL_H")]})),
    resistors: circuit.components.filter(p => p.kind === "resistor").map(p => ({id:p.id, a:at(p.id,"1"), b:at(p.id,"2"), ohms:p.properties.resistance!})),
    buttons: circuit.components.filter(p => p.kind === "button").map(p => ({id:p.id, a:at(p.id,"A1"), b:at(p.id,"B1"), pressed:p.properties.pressed!})),
    pots: circuit.components.filter(p => p.kind === "potentiometer").map(p => ({id:p.id, a:at(p.id,"1"), w:at(p.id,"2"), b:at(p.id,"3"), ohms:p.properties.resistance!, position:p.properties.position!})),
    leds: circuit.components.filter(p => p.kind === "led").map(p => ({id:p.id, a:at(p.id,"A"), k:at(p.id,"K"), vf:({red:1.8, green:2.1, blue:2.8, yellow:2.0} as Record<string,number>)[p.properties.color!]})),
    analogInputs:circuit.components.filter(p=>ANALOG_KINDS.includes(p.kind)).map(p=>({...p.properties,id:p.id,kind:p.kind,vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),outputs:Object.fromEntries((p.kind==="ky023"?["VRX","VRY","SW"]:p.kind==="flame"?["AO","DO"]:p.kind==="sound"?["DO"]:[p.kind==="lm35"?"OUT":"AO"]).map(pin=>[pin,at(p.id,pin)]))})),
    spiDevices:circuit.components.filter(p=>SPI_KINDS.includes(p.kind)).map(p=>({...p.properties,id:p.id,kind:p.kind,moduleVoltage:p.properties.moduleVoltage!,logicVoltage:p.properties.logicVoltage!,vcc:at(p.id,'VCC'),gnd:at(p.id,'GND'),sck:at(p.id,'SCK'),mosi:at(p.id,'MOSI'),cs:at(p.id,'CS'),ce:p.kind==='nrf24'?at(p.id,'CE'):undefined,miso:p.kind==='nrf24'||p.kind==='microSD'||p.kind==='bmp280_spi'||p.kind==='xpt2046'?at(p.id,'MISO'):undefined,irq:p.kind==='xpt2046'?at(p.id,'IRQ'):undefined,dc:(p.kind==='st7735'||p.kind==='ili9341')?at(p.id,'DC'):undefined,rst:(p.kind==='st7735'||p.kind==='ili9341')?at(p.id,'RESET'):undefined,bl:(p.kind==='st7735'||p.kind==='ili9341')?at(p.id,'BL'):undefined})),
    i2cDevices: circuit.components.filter(p=>I2C_KINDS.includes(p.kind)).map(p=>({id:p.id,kind:p.kind,address:deviceAddress(p),vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),sda:at(p.id,"SDA"),scl:at(p.id,"SCL"),pullups:p.properties.pullups!,moduleVoltage:p.properties.moduleVoltage??3.3,logicVoltage:signalVoltage(p),lv:p.kind==="lcd1602"?at(p.id,"LV"):undefined,temperature:p.properties.temperature,humidity:p.properties.humidity,pressure:p.properties.pressure,...(p.kind==="max30102"?{opticalRate:p.properties.opticalRate,opticalAmplitude:p.properties.opticalAmplitude,opticalOffset:p.properties.opticalOffset,opticalNoise:p.properties.opticalNoise,opticalContact:p.properties.opticalContact}:{})})),
    rtcDevices:circuit.components.filter(p=>p.kind==="ds1302").map(p=>({...p.properties,id:p.id,vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),ceNet:at(p.id,"CE"),ioNet:at(p.id,"IO"),clkNet:at(p.id,"SCLK")})),
    oneWireDevices:circuit.components.filter(p=>p.kind==="ds18b20").map(p=>({...p.properties,id:p.id,kind:p.kind,vdd:at(p.id,"VDD"),gnd:at(p.id,"GND"),data:at(p.id,"DQ")})),
    tmDisplays:circuit.components.filter(p=>p.kind==="tm1637").map(p=>({id:p.id,vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),lv:at(p.id,"LV"),clkNet:at(p.id,"CLK"),dioNet:at(p.id,"DIO"),logicVoltage:signalVoltage(p)})),
    irReceivers:circuit.components.filter(p=>p.kind==="irReceiver").map(p=>({...p.properties,id:p.id,vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),output:at(p.id,"OUT")})),
    irRemotes:circuit.components.filter(p=>p.kind==="irRemote").map(p=>({...p.properties,id:p.id})),
    irTransmitters:circuit.components.filter(p=>p.kind==="irTransmitter").map(p=>({...p.properties,id:p.id,vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),signal:at(p.id,"SIG")})),
    encoders:circuit.components.filter(p=>p.kind==="ky040").map(p=>({...p.properties,id:p.id,vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),clk:at(p.id,"CLK"),dt:at(p.id,"DT"),sw:at(p.id,"SW")})),
    timedSensors:circuit.components.filter(p=>DHT_KINDS.includes(p.kind)).map(p=>({...p.properties,id:p.id,kind:p.kind,vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),data:at(p.id,"DATA")})),
    relays:circuit.components.filter(p=>p.kind==="relay").map(p=>({...p.properties,id:p.id,vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),lv:at(p.id,"LV"),signal:at(p.id,"IN"),com:at(p.id,"COM"),no:at(p.id,"NO"),nc:at(p.id,"NC")})),
    buzzers:circuit.components.filter(p=>p.kind==="activeBuzzer"||p.kind==="passiveBuzzer").map(p=>({id:p.id,kind:p.kind,vcc:at(p.id,"VCC"),gnd:at(p.id,"GND"),signal:at(p.id,"SIG")})),
    bridges:circuit.components.filter(p=>p.kind==="l298n").map(p=>({...p.properties,id:p.id,vs:at(p.id,"VS"),vss:at(p.id,"VSS"),gnd:at(p.id,"GND"),inputs:["ENA","IN1","IN2","IN3","IN4","ENB"].map(pin=>at(p.id,pin)),outputs:["OUT1","OUT2","OUT3","OUT4"].map(pin=>at(p.id,pin))})),
    stepperDrivers:circuit.components.filter(p=>p.kind==='a4988').map(p=>({id:p.id,vdd:at(p.id,'VDD'),vmot:at(p.id,'VMOT'),gnd:at(p.id,'GND'),inputs:Object.fromEntries(['STEP','DIR','ENABLE','RESET','SLEEP','MS1','MS2','MS3'].map(pin=>[pin,at(p.id,pin)])),outputs:['1A','1B','2A','2B'].map(pin=>at(p.id,pin))})),
    stepperMotors:circuit.components.filter(p=>p.kind==='stepperMotor').map(p=>({id:p.id,fullSteps:p.properties.fullSteps!,coils:['A+','A-','B+','B-'].map(pin=>at(p.id,pin))})),
    motors:circuit.components.filter(p=>p.kind==="motor130").map(p=>({...p.properties,id:p.id,a:at(p.id,"M+"),b:at(p.id,"M-")})),
    servos: circuit.components.filter(p=>p.kind==="servo"||p.kind==="sg90").map(p=>({id:p.id,vcc:at(p.id,"V+"),gnd:at(p.id,"GND"),signal:at(p.id,"SIG"),requiresCommonGround:p.kind==="sg90",minUs:p.properties.servoMinUs??500,maxUs:p.properties.servoMaxUs??2500})),
  };
}
export type SimulationConfig = ReturnType<typeof compileCircuit>;
export interface OpticalReading {index:number;timeMs:number;readTimeMs:number;red:number;ir:number|null}
export interface OpticalFrame {powered:boolean;mode:number;shutdown:boolean;resetting:boolean;sampleRate:number;average:number;effectiveRate:number;count:number;writePointer:number;readPointer:number;overflow:number;dropped:number;generated:number;status:number;ledRed:number;ledIR:number;resolution:number;last:OpticalReading|null;readings:OpticalReading[];reason:string}
export interface SimulationFrame {
  i2cLevelShifters?:Record<string,{powered:boolean;lv:number|null;hv:number|null;reason:string;channels:{name:string;lowVolts:number|null;highVolts:number|null;pulledLow:boolean;idle:boolean}[]}>;
  levelShifters?:Record<string,{powered:boolean;direction:string|null;vcca:number|null;vccb:number|null;dir:number|null;reason:string;channels:{input:string;output:string;inputVolts:number|null;outputVolts:number|null;level:number|null;reason:string}[]}>;
  radios?:Record<string,{powered:boolean;ce:boolean;channel:number;rateMbps:number;crcBytes:number;addressWidth:number;status:number;txFifo:number;rxFifo:number;retries:number;lost:number;received:number;sent:number;failed:number;mode:string;reason:string}>;
  optical?:Record<string,OpticalFrame>;
  sdCards?:Record<string,{powered:boolean;inserted:boolean;writeProtected:boolean;initialized:boolean;sectors:number;dirtyBlocks:number;reads:number;writes:number;errors:number;revision:number;state:import('./model').SDState;files:{name:string;size:number;cluster:number}[];volumeError:string;reason:string;trace:{timeUs:number;operation:string;value:number;result:string}[]}>;
  rtcDevices?:Record<string,{mainPower:boolean;battery:boolean;rtcMainPower:boolean;retained:boolean;valid:boolean;halted:boolean;writeProtected:boolean;iso:string|null;day:number;reason:string;received:number;errors:number;state:import('./model').RTCState;trace:{timeUs:number;operation:string;value?:number}[]}>;
  touches?:Record<string,{powered:boolean;down:boolean;x:number;y:number;pressure:number;irq:number|null;pd:number;raw:{x:number;y:number;z1:number;z2:number};last:{channel?:string;value?:number;command?:number};conversions:number;reason:string}>;
  tfts?:Record<string,{kind:'tft';width:number;height:number;powered:boolean;on:boolean;sleep:boolean;backlight:boolean;madctl:number;format:number;written:number;window:number[];pixels:number[];reason:string}>;
  spiBytes?:number;
  spiTrace?:{timeUs:number;device:string;operation:string;value:number;result:string}[];
  steppers?:{
   drivers:Record<string,{powered:boolean;motorPower:boolean;enabled:boolean;levels:Record<string,number|null>;resolution:number;translatorTicks:number;rising:number;accepted:number;ignored:number;rejected:number;pending:boolean;phaseA:number|null;phaseB:number|null;lastFault:string;reason:string;trace:{timeUs:number;operation:string;value:string}[]}>;
   motors:Record<string,{driver:string|null;connected:boolean;orientation:number;energized:boolean;positionCertain:boolean;drivenTicks:number;idealAngle:number;angle:number|null;fullSteps:number;reason:string}>;
  };
  actuators?:{
   relays:Record<string,{powered:boolean;energized:boolean;contact:string;reason:string}>;
   buzzers:Record<string,{powered:boolean;active:boolean;frequency:number|null;duty:number;reason:string}>;
   bridges:Record<string,{powered:boolean;channels:{mode:string;voltage:number|null}[]}>;
   motors:Record<string,{voltage:number|null;relativeSpeed:number;direction:number;mode:string}>;
   trace:{timeUs:number;component:string;operation:string;value:string}[];
  };
  tmDisplays?:Record<string,{powered:boolean;on:boolean;bytes:number[];brightness:number;duty:number;colon:boolean;received:number;errors:number;reason:string;trace:{timeUs:number;operation:string;value?:number}[]}>;
  clockProfile?:string;
  infrared?:Record<string,{kind:'receiver'|'remote'|'transmitter';powered:boolean;channel:number;level:number;busy:boolean;blocked:boolean;presses:number;carrierHz:number|null;transitions:number;trace:{timeUs:number;level:number}[]}>;
  encoders?:Record<string,{powered:boolean;position:number;targetPosition:number;clk:number;dt:number;sw:number;busy:boolean;transitions:number;volts:Record<string,number|null>;trace:{timeUs:number;clk:number;dt:number;sw:number;position:number}[]}>;
  oneWireDevices?:Record<string,{powered:boolean;rom:string;temperature:number;resolution:number;busy:boolean;sample:number;scratchpad:number[];reason:string;fault:string;trace:{timeUs:number;operation:string;value?:number}[]}>;
  timedSensors?:Record<string,{powered:boolean;sample:number;temperature:number;humidity:number;bytes:number[];reason:string;transmitting:boolean;fault:string;trace:{atUs:number;durationUs:number;level:number}[]}>;
  analogInputs?:Record<string,{powered:boolean;active?:boolean;volts:Record<string,number|null>;resistance?:number}>;
  avr?:{memory?:{staticBytes:number;lowestSP:number;minFreeToStatic:number};cycles:number;clockHz:number;uartBaud:number;rxPending:number;busTrace:{kind:string;operation:string;value?:number;result?:string;timeUs:number}[]};
  timeMs: number;
  leds: Record<string, {brightness:number;currentMa:number}>;
  nets: Record<string, number | null>;
  gpios: Record<string, {mode:string;volts:number|null;level:number|null;freq?:number;duty?:number}>;
  diagnostics: {code:string;severity:string;message:string;terminals:string[];wires:string[]}[];
  sensors: Record<string,{powered:boolean;temperature:number;humidity:number;busy:boolean;calibrated:boolean;sample:number;measuredTemperature:number|null;measuredHumidity:number|null;measuredPressure?:number|null;pressure?:number}>;
  displays: Record<string,{kind?:'oled'|'lcd';powered:boolean;on:boolean;contrast?:number;bytes:number[];width?:number;height?:number;backlight?:boolean;cells?:number[];lines?:string[];cgram?:number[];cursor?:boolean;blink?:boolean;blinkOn?:boolean;cursorColumn?:number;cursorRow?:number}>;
  servos: Record<string,{powered:boolean;angle:number|null;pulseUs:number|null;freq:number|null;reason:string}>;
  measurements: {timeMs:number;component:string;temperature:number|null;humidity:number|null;pressure?:number|null;sample:number}[];
  i2cTrace: {timeMs:number;bus:number;address:number;operation:string;length:number;bytes:number[];result:string}[];
}
