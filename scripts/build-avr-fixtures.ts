import {writeFileSync} from 'node:fs';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {UNO,NANO} from '../src/boards/profiles';
import {compileProject} from './avr-compile.mjs';
const result:Record<string,unknown>={};
const p=arduinoExampleProject('adc',NANO);p.files['main.ino']=p.files['main.ino'].replace('analogRead(A0)','analogRead(A6)');result.nanoA6=await compileProject(p);
const protocols=arduinoExampleProject('button',UNO);protocols.files['main.ino']=`#include <Wire.h>
#include <SPI.h>
volatile unsigned int broj = 0;
void promjena() { broj++; }
void setup() {
  Serial.begin(9600); pinMode(2, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), promjena, FALLING);
  Wire.begin(); Wire.beginTransmission(0x38); Wire.write(0xA5);
  Serial.print("TWI="); Serial.println(Wire.endTransmission());
  SPI.begin(); Serial.print("SPI="); Serial.println(SPI.transfer(0xA5));
}
void loop() { noInterrupts(); unsigned int x=broj; interrupts(); Serial.print("IRQ="); Serial.println(x); delay(20); }
`;
result.protocols=await compileProject(protocols);
const busy=arduinoExampleProject('blink',UNO);busy.files['main.ino']='void setup(){pinMode(9,OUTPUT);digitalWrite(9,HIGH);while(true){}}\nvoid loop(){}\n';result.busy=await compileProject(busy);
const pwm=arduinoExampleProject('blink',UNO);pwm.files['main.ino']='void setup(){Serial.begin(9600);Serial.println("Živio PWM");int p[]={3,5,6,9,10,11};for(int i=0;i<6;i++){pinMode(p[i],OUTPUT);analogWrite(p[i],64);}}\nvoid loop(){delay(10);}\n';result.pwmTimers=await compileProject(pwm);
writeFileSync('verification/avr-fixtures.json' ,JSON.stringify(result)+'\n');
writeFileSync('docs/stage8-evidence/builds.json',JSON.stringify({fixtures:Object.entries(result).map(([name,a]:any)=>({name,inputHash:a.inputHash,hexHash:a.hexHash,flashBytes:a.flashBytes,staticRamBytes:a.staticRamBytes,toolchain:a.toolchain}))},null,2)+'\n');
