import {opticalCircuit,arduinoOpticalExamples,s3OpticalExamples,type OpticalExample} from '../circuit/max30102Examples';
import {cppMAX30102} from '../circuit/max30102Driver';
import {arduinoSDExamples,sdCircuit,type SDExample} from '../circuit/sdExamples';
import {cppSD} from '../circuit/sdDriver';
import {arduinoRTCExamples,rtcCircuit,type RTCExample} from '../circuit/rtcExamples';
import {cppDS1302} from '../circuit/rtcDriver';
import {arduinoTouchExamples,touchCircuit,type TouchExample} from '../circuit/touchExamples';
import {cppXPT2046} from '../circuit/touchDriver';
import {arduinoILIExamples,iliCircuit,cppILI9341,type ILIExample} from '../circuit/ili9341Examples';
import {arduinoSPIExamples,spiCircuit,cppST7735,cppBMP280SPI,type SPIExample} from '../circuit/spiExamples';
import {arduinoStepperExamples,stepperCircuit,type StepperExample} from '../circuit/stepperExamples';
import {arduinoActuatorExamples,actuatorCircuit,type ActuatorExample} from '../circuit/actuatorExamples';
import {arduinoTMExamples,tmCircuit,cppTM1637,type TMExample} from '../circuit/tm1637Examples';
import {arduinoIRExamples,irCircuit,cppNEC,type IRExample} from '../circuit/irExamples';
import {arduinoEncoderExamples,encoderCircuit,type EncoderExample} from '../circuit/encoderExamples';
import {arduinoOneWireExamples,oneWireCircuit,type OneWireExample} from "../circuit/oneWireExamples";
import {arduinoDHTExamples,dhtCircuit,type DHTExample} from '../circuit/dhtExamples';
import {arduinoAnalogExamples,analogCircuit,type AnalogExample} from "../circuit/analogExamples";
import {UNO,NANO,type BoardId} from '../boards/profiles';
import {newProject,type Project} from '../project/model';
import {emptyCircuit,makePart} from '../circuit/model';
import {AVR_BUILD_FILE,validateArtifact} from '../../public/avr-contract.mjs';
import {arduinoPeripheralExamples,arduinoPeripheralCircuit,type PeripheralExample} from './arduinoPeripheralExamples';
import {libraryManifest,AVR_LIBRARY_FILE} from '../../public/avr-contract.mjs';
import {arduinoEnvironmentExamples,environmentCircuit,type EnvironmentExample} from '../circuit/environmentExamples';
import {runtimeAsset} from '../platform/assets';
import {arduinoDisplayExamples,displayCircuit,type DisplayExample} from '../circuit/displayExamples';
export const arduinoExamples={
  blink:{title:'Arduino · treptanje i millis()',hint:'D9 → 680 Ω → LED → GND. delay(200) i millis() koriste stvarni AVR Timer0. Program pokreće i ugrađenu LED L na D13.',code:`// D9 je oznaka priključka, a ne deveti fizički kontakt.
void setup() {
  pinMode(9, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
}
void loop() {
  digitalWrite(9, HIGH); digitalWrite(LED_BUILTIN, HIGH);
  Serial.print("LED=1 ms="); Serial.println(millis());
  delay(200);
  digitalWrite(9, LOW); digitalWrite(LED_BUILTIN, LOW);
  Serial.print("LED=0 ms="); Serial.println(millis());
  delay(200);
}
`},
  button:{title:'Arduino · tipkalo i serijski unos',hint:'D2 koristi INPUT_PULLUP. Pritisak ga spaja na GND i pali LED na D9. Serijski pošalji 1 za uključivanje, 0 za isključivanje ili b za ponovno upravljanje tipkalom.',code:`// Serijski monitor radi pri brzini koju zada Serial.begin().
int daljinski = -1;
int prethodno = -1;
void setup() {
  pinMode(2, INPUT_PULLUP); pinMode(9, OUTPUT);
  Serial.begin(9600);
  Serial.println("Spremno: 1 / 0 / b");
}
void loop() {
  if (Serial.available()) {
    char znak = Serial.read();
    if (znak == '1') daljinski = 1;
    if (znak == '0') daljinski = 0;
    if (znak == 'b') daljinski = -1;
    Serial.print("RX="); Serial.println(znak);
  }
  int stanje = daljinski < 0 ? digitalRead(2) == LOW : daljinski;
  digitalWrite(9, stanje);
  if (stanje != prethodno) { Serial.print("LED="); Serial.println(stanje); prethodno = stanje; }
  delay(10);
}
`},
  adc:{title:'Arduino · ADC regulira PWM',hint:'Potenciometar: 1 na 5 V, 3 na GND, klizač 2 na A0. analogRead vraća 0–1023, a analogWrite na D9 prima 0–255. Svjetlina proizlazi iz impulsa Timer1.',code:`void setup() { pinMode(9, OUTPUT); Serial.begin(9600); }
void loop() {
  int vrijednost = analogRead(A0);
  int pwm = vrijednost / 4;
  analogWrite(9, pwm);
  Serial.print("ADC="); Serial.print(vrijednost);
  Serial.print(" PWM="); Serial.println(pwm);
  delay(100);
}
`},
  ...arduinoOpticalExamples,
  ...arduinoSDExamples,
  ...arduinoRTCExamples,
  ...arduinoTouchExamples,
  ...arduinoILIExamples,
  ...arduinoSPIExamples,
  ...arduinoStepperExamples,
  ...arduinoActuatorExamples,
  ...arduinoTMExamples,
  ...arduinoIRExamples,
  ...arduinoEncoderExamples,
  ...arduinoOneWireExamples,
  ...arduinoDHTExamples,
  ...arduinoDisplayExamples,
  ...arduinoAnalogExamples,
  ...arduinoPeripheralExamples,
  ...arduinoEnvironmentExamples,
};
export type ArduinoExample=keyof typeof arduinoExamples;
export function arduinoExampleProject(key:ArduinoExample,board:BoardId=UNO):Project{
  if(board!==UNO&&board!==NANO)throw Error('Arduino primjer zahtijeva Uno ili Nano.');
  const e=arduinoExamples[key],p=newProject(e.code,e.title,board),c=emptyCircuit(board),b=c.components[0].id;
  if(key in arduinoOpticalExamples){p.circuit=opticalCircuit(key as OpticalExample,board);p.files['lab_max30102.h']=cppMAX30102;p.settings.example='avr-'+key;return p;}
  if(key in arduinoSDExamples){p.circuit=sdCircuit(key as SDExample,board);p.files['lab_sd.h']=cppSD;if(key==='sdLogger')p.files['lab_ds1302.h']=cppDS1302;p.settings.example='avr-'+key;return p;}
  if(key in arduinoRTCExamples){p.circuit=rtcCircuit(key as RTCExample,board);p.files['lab_ds1302.h']=cppDS1302;if(key==='rtcClock')p.files['lab_tm1637.h']=cppTM1637;p.settings.example='avr-'+key;return p;}
  if(key in arduinoTouchExamples){p.circuit=touchCircuit(key as TouchExample,board);p.files['lab_ili9341.h']=cppILI9341;p.files['lab_xpt2046.h']=cppXPT2046;p.settings.example='avr-'+key;return p;}
  if(key in arduinoILIExamples){p.circuit=iliCircuit(key as ILIExample,board);p.files['lab_ili9341.h']=cppILI9341;if(key==='iliDashboard')p.files['lab_bmp280_spi.h']=cppBMP280SPI;p.settings.example='avr-'+key;return p;}
  if(key in arduinoSPIExamples){p.circuit=spiCircuit(key as SPIExample,board);if(key!=='bmp280SPI')p.files['lab_st7735.h']=cppST7735;if(key==='bmp280SPI'||key==='spiDashboard')p.files['lab_bmp280_spi.h']=cppBMP280SPI;p.settings.example='avr-'+key;return p;}
  if(key in arduinoStepperExamples){p.circuit=stepperCircuit(key as StepperExample,board);p.settings.example='avr-'+key;return p;}
  if(key in arduinoActuatorExamples){p.circuit=actuatorCircuit(key as ActuatorExample,board);if(key==='sg90Sweep'||key==='servoMotorTone')p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'Servo',version:'1.2.2'}]);p.settings.example='avr-'+key;return p;}
  if(key in arduinoTMExamples){p.circuit=tmCircuit(key as TMExample,board);p.files['lab_tm1637.h']=cppTM1637;p.settings.example='avr-'+key;return p;}
  if(key in arduinoIRExamples){p.circuit=irCircuit(key as IRExample,board);p.files['lab_nec.h']=cppNEC;p.settings.example='avr-'+key;return p;}
  if(key in arduinoEncoderExamples){p.circuit=encoderCircuit(key as EncoderExample,board);p.settings.example='avr-'+key;return p;}
  if(key in arduinoOneWireExamples){p.circuit=oneWireCircuit(key as OneWireExample,board);p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'OneWire',version:'2.3.8'},{name:'DallasTemperature',version:'4.0.6'}]);p.settings.example='avr-'+key;return p;}
  if(key in arduinoDHTExamples){p.circuit=dhtCircuit(key as DHTExample,board);p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'DHT',version:'1.4.6'}]);p.settings.example='avr-'+key;return p;}
  if(key in arduinoAnalogExamples){p.circuit=analogCircuit(key as AnalogExample,board);p.settings.example='avr-'+key;return p;}
  if(key in arduinoDisplayExamples){
    const entry=arduinoDisplayExamples[key as DisplayExample];p.circuit=displayCircuit(key as DisplayExample,board);
    p.files[AVR_LIBRARY_FILE]=libraryManifest(entry.libraries.map(name=>({name,version:name==='U8g2_12832'?'2.37.1':'1.0.0'})));
    p.settings.example='avr-'+key;return p;
  }
  if(key in arduinoEnvironmentExamples){
    const entry=arduinoEnvironmentExamples[key as keyof typeof arduinoEnvironmentExamples];p.circuit=environmentCircuit(key as EnvironmentExample,board);
    p.files[AVR_LIBRARY_FILE]=libraryManifest(entry.libraries.map(name=>({name,version:({LabI2CSensors:'1.0.0',U8g2:'2.37.1'}as const)[name]})));
    p.settings.example='avr-'+key;return p;
  }
  if(key in arduinoPeripheralExamples){
    p.circuit=arduinoPeripheralCircuit(key as PeripheralExample,board);
    const lib=arduinoPeripheralExamples[key as PeripheralExample].libraries;
    p.files[AVR_LIBRARY_FILE]=libraryManifest(lib.map(name=>({name,version:({LabAHT10:'1.0.0',U8g2:'2.37.1',Servo:'1.2.2'}as const)[name]})));
    p.settings.example='avr-'+key;return p;
  }
  c.components[0].x=50;c.components[0].y=60;
  c.components.push({...makePart('resistor',560,90,'r1'),properties:{resistance:680}},makePart('led',770,90,'led1'));
  const connect=(a:string,pin:string,d:string,q:string)=>c.wires.push({id:'w'+c.wires.length,from:{component:a,pin},to:{component:d,pin:q},color:'#087f8c',points:[]});
  connect(b,'D9','r1','1');connect('r1','2','led1','A');connect('led1','K',b,'GND');
  if(key==='button'){c.components.push(makePart('button',570,300,'sw1'));connect(b,'D2','sw1','A1');connect('sw1','B1',b,'GND');}
  if(key==='adc'){c.components.push(makePart('potentiometer',590,310,'pot1'));connect(b,'5V','pot1','1');connect(b,'A0','pot1','2');connect(b,'GND','pot1','3');}
  p.circuit=c;p.settings.example='avr-'+key;return p;
}
export async function loadArduinoExample(key:ArduinoExample,board:BoardId){
  const p=arduinoExampleProject(key,board),r=await fetch(runtimeAsset('avr-examples.json'));
  if(!r.ok)throw Error('Ne mogu učitati prevedeni Arduino primjer.');
  const artifacts=await r.json(),artifact=await validateArtifact(p,artifacts[board]?.[key]);
  p.files[AVR_BUILD_FILE]=JSON.stringify(artifact);return p;
}
