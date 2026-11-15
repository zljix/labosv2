import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
export type StepperExample='stepperBasic'|'stepperMicro'|'stepperControl';
export function stepperCircuit(_key:StepperExample,board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=30;b.y=150;
 const d=makePart('a4988',avr?690:440,180,'stepperDriver'),m=makePart('stepperMotor',avr?1220:970,310,'stepperMotor'),s=makePart('powerSupply',avr?1170:920,30,'stepperSupply');s.properties.supplyVoltage=12;
 c.components.push(d,m,s);
 const wire=(a:string,p:string,z:string,q:string,color='#087f8c')=>c.wires.push({id:'st'+c.wires.length,from:{component:a,pin:p},to:{component:z,pin:q},color,points:[]});
 const ground=terminals(b).find(t=>t.role==='ground')!.pin,lv=avr?'5V':terminals(b).find(t=>t.role==='3v3')!.pin;
 wire(b.id,ground,d.id,'GND','#334155');wire(b.id,lv,d.id,'VDD','#d04b46');wire(s.id,'+',d.id,'VMOT','#d04b46');wire(s.id,'-',d.id,'PGND','#334155');
 for(const [i,name]of ['STEP','DIR','ENABLE','RESET','SLEEP','MS1','MS2','MS3'].entries())wire(b.id,terminals(b).find(t=>t.gpio===i+2)!.pin,d.id,name);
 for(const [p,q]of [['1A','A+'],['1B','A-'],['2A','B+'],['2B','B-']])wire(d.id,p,m.id,q,'#8b52ba');
 return c;
}
const intro='A4988: VDD je 3,3 V za ESP32 / 5 V za Uno i Nano; VMOT je zasebnih 12 V, masa zajednička. STEP=2, DIR=3, ENABLE=4, RESET=5, SLEEP=6, MS1/2/3=7/8/9 (GPIO na ESP32, D na Arduinu). A+/A− su jedna zavojnica, B+/B− druga. Model motora ima 200 punih koraka/okret: kut = broj pogonskih impulsa × 360° / (200 × mikrostep). Impulsi su HIGH 10 µs, LOW 4 ms. Primjeri računaju s 200 koraka/okret; za drugi motor ponovno izračunaj broj impulsa i oznake ispisa. Fizički motor i njegov strujni limit nisu potvrđeni.';
const pyStart=`from machine import Pin
from time import sleep_ms, sleep_us

# Brojevi su GPIO; napajanje motora ne dolazi s GPIO-a.
step = Pin(2, Pin.OUT, value=0)
direction = Pin(3, Pin.OUT, value=1)
enable = Pin(4, Pin.OUT, value=1)  # HIGH: mostovi iskljuceni
reset = Pin(5, Pin.OUT, value=1)
sleep_pin = Pin(6, Pin.OUT, value=1)
ms = [Pin(n, Pin.OUT, value=0) for n in (7, 8, 9)]
sleep_ms(2)  # nakon budenja najmanje 1 ms
enable.value(0)

def pulse(count):
    for _ in range(count):
        step.value(1)
        sleep_us(10)
        step.value(0)
        sleep_ms(4)

def mode(bits):
    for pin, value in zip(ms, bits):
        pin.value(value)
    sleep_us(10)  # setup prije STEP

`;
const cppStart=`// STEP/DIR upravljanje: nema dodatne biblioteke; ne mijenja postavke timera.
const byte STEP=2, DIR=3, ENABLE=4, RESET_PIN=5, SLEEP_PIN=6;
const byte MS1=7, MS2=8, MS3=9;
const int PUNI_KORACI=200; // mora odgovarati svojstvu motora

void pulse(int count) {
  for(int i=0;i<count;i++) {
    digitalWrite(STEP,HIGH); delayMicroseconds(10);
    digitalWrite(STEP,LOW); delay(4);
  }
}
void mode(byte bits) {
  digitalWrite(MS1,bits&1); digitalWrite(MS2,(bits>>1)&1);
  digitalWrite(MS3,(bits>>2)&1); delayMicroseconds(10);
}
void setup() {
  digitalWrite(ENABLE,HIGH); pinMode(ENABLE,OUTPUT);
  const byte pins[7]={STEP,DIR,RESET_PIN,SLEEP_PIN,MS1,MS2,MS3};
  for(byte i=0;i<7;i++) pinMode(pins[i],OUTPUT);
  digitalWrite(DIR,HIGH); digitalWrite(RESET_PIN,HIGH);
  digitalWrite(SLEEP_PIN,HIGH); mode(0); delay(2);
  digitalWrite(ENABLE,LOW); Serial.begin(9600);
}
`;
export const stepperExamples={
 stepperBasic:{title:'A4988 · koraci i smjer',hint:intro+' Počni punim korakom. 50 impulsa daje +90°, zatim 50 u suprotnom smjeru vraća idealni zbroj na 0°. Zadatak: promijeni 50 u 100 i predvidi kut prije pokretanja.',code:pyStart+`while True:
    direction.value(1)
    sleep_us(10)
    pulse(50)
    print("STEPPER +90 deg")
    sleep_ms(600)
    direction.value(0)
    sleep_us(10)
    pulse(50)
    print("STEPPER 0 deg")
    sleep_ms(600)
`},
 stepperMicro:{title:'A4988 · pet mikrostep načina',hint:intro+' MS tablica (MS1,MS2,MS3): 000=1, 100=1/2, 010=1/4, 110=1/8, 111=1/16. Program u svakom načinu ide 18° naprijed i natrag; promjena načina je na zajedničkom Home položaju. Kombinacije 001/101/011 nisu deklarirane. Manji mikrostep ne jamči veću stvarnu točnost motora.',code:pyStart+`modes = ((1,(0,0,0)), (2,(1,0,0)), (4,(0,1,0)), (8,(1,1,0)), (16,(1,1,1)))
while True:
    for factor, bits in modes:
        mode(bits)
        direction.value(1)
        sleep_us(10)
        pulse(10 * factor)
        print("MICRO 1/%d +18 deg" % factor)
        sleep_ms(400)
        direction.value(0)
        sleep_us(10)
        pulse(10 * factor)
        print("MICRO 1/%d 0 deg" % factor)
        sleep_ms(400)
`},
 stepperControl:{title:'A4988 · ENABLE, RESET i SLEEP',hint:intro+' Promatraj Mjerenja: nakon 10 pogonskih koraka motor ima idealni zbroj 18°. ENABLE HIGH zaustavi pobudu, ali sljedećih 10 impulsa pomiče translator na 20 punih koraka. Tada položaj osovine više nije poznat. RESET vrati samo električni Home. SLEEP ignorira STEP; nakon buđenja čeka se 2 ms. Novi Run/Reset aplikacije počinje novu idealnu sesiju od 0°.',code:pyStart+`pulse(10)
print("CONTROL DRIVE=10")
sleep_ms(700)
enable.value(1)
pulse(10)
print("CONTROL DISABLED translator=20 driven=10")
sleep_ms(700)
reset.value(0)
sleep_us(10)
pulse(3)  # RESET LOW: STEP se ignorira
reset.value(1)
sleep_us(10)
print("CONTROL RESET translator=0; shaft is not homed")
sleep_ms(700)
sleep_pin.value(0)
pulse(3)
print("CONTROL SLEEP ignores STEP")
sleep_ms(700)
sleep_pin.value(1)
sleep_ms(2)
enable.value(0)
pulse(5)
print("CONTROL WAKE translator=5")
while True:
    sleep_ms(100)
`},
} as const;
export const arduinoStepperExamples={
 stepperBasic:{...stepperExamples.stepperBasic,title:'Arduino · '+stepperExamples.stepperBasic.title,code:cppStart+`
void loop() {
  digitalWrite(DIR,HIGH); delayMicroseconds(10);
  pulse(PUNI_KORACI/4); Serial.println(F("STEPPER +90 deg")); delay(600);
  digitalWrite(DIR,LOW); delayMicroseconds(10);
  pulse(PUNI_KORACI/4); Serial.println(F("STEPPER 0 deg")); delay(600);
}
`},
 stepperMicro:{...stepperExamples.stepperMicro,title:'Arduino · '+stepperExamples.stepperMicro.title,code:cppStart+`
void loop() {
  const byte bits[5]={0,1,2,3,7}, factor[5]={1,2,4,8,16};
  for(byte i=0;i<5;i++) {
    mode(bits[i]); digitalWrite(DIR,HIGH); delayMicroseconds(10);
    pulse(PUNI_KORACI*factor[i]/20);
    Serial.print(F("MICRO 1/")); Serial.print(factor[i]); Serial.println(F(" +18 deg")); delay(400);
    digitalWrite(DIR,LOW); delayMicroseconds(10);
    pulse(PUNI_KORACI*factor[i]/20);
    Serial.print(F("MICRO 1/")); Serial.print(factor[i]); Serial.println(F(" 0 deg")); delay(400);
  }
}
`},
 stepperControl:{...stepperExamples.stepperControl,title:'Arduino · '+stepperExamples.stepperControl.title,code:cppStart+`
void loop() {
  pulse(10); Serial.println(F("CONTROL DRIVE=10")); delay(700);
  digitalWrite(ENABLE,HIGH); pulse(10);
  Serial.println(F("CONTROL DISABLED translator=20 driven=10")); delay(700);
  digitalWrite(RESET_PIN,LOW); delayMicroseconds(10); pulse(3);
  digitalWrite(RESET_PIN,HIGH); delayMicroseconds(10);
  Serial.println(F("CONTROL RESET translator=0; shaft is not homed")); delay(700);
  digitalWrite(SLEEP_PIN,LOW); pulse(3);
  Serial.println(F("CONTROL SLEEP ignores STEP")); delay(700);
  digitalWrite(SLEEP_PIN,HIGH); delay(2); digitalWrite(ENABLE,LOW); pulse(5);
  Serial.println(F("CONTROL WAKE translator=5"));
  while(true) delay(100);
}
`},
} as const;
