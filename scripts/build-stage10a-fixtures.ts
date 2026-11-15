import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {UNO} from '../src/boards/profiles';
import {makePart,type Circuit} from '../src/circuit/model';
import {libraryManifest,validateArtifact} from '../public/avr-contract.mjs';
import {compileProject} from './avr-compile.mjs';
const hardwareOled=arduinoExampleProject('oled',UNO);
hardwareOled.files['main.ino']=hardwareOled.files['main.ino'].replace('NONAME_1_SW_I2C zaslon(U8G2_R0, 7, 6, U8X8_PIN_NONE)','NONAME_1_HW_I2C zaslon(U8G2_R0, U8X8_PIN_NONE)');
for(const w of (hardwareOled.circuit as Circuit).wires){if(w.from.pin==='D6')w.from.pin='A4';if(w.from.pin==='D7')w.from.pin='A5';}
const softwareAht=arduinoExampleProject('aht10',UNO);
softwareAht.files['arduino-libraries.json']=libraryManifest([]);
for(const w of (softwareAht.circuit as Circuit).wires){if(w.from.pin==='A4')w.from.pin='D6';if(w.from.pin==='A5')w.from.pin='D7';}
softwareAht.files['main.ino']=`// Reference software-I2C master: only Arduino GPIO, no simulator calls.
const byte SDA_PIN=6, SCL_PIN=7;
void low(byte p) { digitalWrite(p,LOW); pinMode(p,OUTPUT); }
void release(byte p) { pinMode(p,INPUT); }
void highClock() { release(SCL_PIN); delayMicroseconds(4); }
void lowClock() { low(SCL_PIN); delayMicroseconds(4); }
void startBus() { release(SDA_PIN); highClock(); low(SDA_PIN); lowClock(); }
void stopBus() { low(SDA_PIN); highClock(); release(SDA_PIN); delayMicroseconds(4); }
bool writeByte(byte value) {
  for(byte i=0;i<8;i++) { if(value&128)release(SDA_PIN);else low(SDA_PIN); highClock();lowClock();value<<=1; }
  release(SDA_PIN);highClock();bool ack=digitalRead(SDA_PIN)==LOW;lowClock();return ack;
}
byte readByte(bool ack) {
  byte value=0;release(SDA_PIN);
  for(byte i=0;i<8;i++) {highClock();value=(value<<1)|digitalRead(SDA_PIN);lowClock();}
  if(ack)low(SDA_PIN);else release(SDA_PIN);highClock();lowClock();release(SDA_PIN);return value;
}
void setup() {
  Serial.begin(9600);delay(40);bool ok=true;
  startBus();ok &= writeByte(0x70);ok &= writeByte(0xe1);ok &= writeByte(8);ok &= writeByte(0);stopBus();delay(10);
  startBus();ok &= writeByte(0x70);ok &= writeByte(0xac);ok &= writeByte(0x33);ok &= writeByte(0);stopBus();delay(80);
  startBus();ok &= writeByte(0x71);byte b[6];for(byte i=0;i<6;i++)b[i]=readByte(i<5);stopBus();
  Serial.print(F("SOFT ACK="));Serial.println(ok);Serial.print(F("BYTES="));for(byte i=0;i<6;i++){Serial.print(b[i]);Serial.print(',');}Serial.println();
}
void loop() {delay(1000);}
`;
const timerConflict=arduinoExampleProject('servo',UNO),c=timerConflict.circuit as Circuit,b=c.components[0].id;
c.wires.find(w=>w.to.component==='servo1'&&w.to.pin==='SIG')!.from.pin='D6';
c.components.push({...makePart('resistor',560,100,'r1'),properties:{resistance:680}},makePart('led',770,100,'led1'));
c.wires.push({id:'conflict1',from:{component:b,pin:'D9'},to:{component:'r1',pin:'1'},color:'#087f8c',points:[]},{id:'conflict2',from:{component:'r1',pin:'2'},to:{component:'led1',pin:'A'},color:'#087f8c',points:[]},{id:'conflict3',from:{component:'led1',pin:'K'},to:{component:b,pin:'GND'},color:'#334155',points:[]});
timerConflict.files['main.ino']=`#include <Servo.h>
Servo motor;
void setup(){Serial.begin(9600);pinMode(9,OUTPUT);motor.attach(6,500,2500);motor.write(90);analogWrite(9,128);Serial.println(F("Servo and PWM share Timer1"));}
void loop(){delay(1000);}
`;
const result:Record<string,any>={},previous=existsSync('verification/stage10a-fixtures.json')?JSON.parse(readFileSync('verification/stage10a-fixtures.json','utf8')):{};
for(const [key,project]of Object.entries({hardwareOled,softwareAht,timerConflict})){
  let artifact;try{artifact=await validateArtifact(project,previous[key]?.artifact);}catch{artifact=await compileProject(project);}
  result[key]={project,artifact};console.log(key,artifact.flashBytes,artifact.staticRamBytes);
}
writeFileSync('verification/stage10a-fixtures.json',JSON.stringify(result)+'\n');
