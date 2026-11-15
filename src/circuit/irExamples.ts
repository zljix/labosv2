import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
export type IRExample='irPulses'|'irNEC'|'irLED'|'irTransmit';
export function irCircuit(key:IRExample,board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=40;b.y=100;
 const pin=(gpio:number)=>terminals(b).find(t=>t.gpio===gpio)!.pin;
 const connect=(a:string,p:string,z:string,q:string,color='#087f8c')=>c.wires.push({id:'irw'+c.wires.length,from:{component:a,pin:p},to:{component:z,pin:q},color,points:[]});
 const rx=makePart('irReceiver',avr?650:430,150,'irRx');rx.properties.moduleVoltage=avr?5:3.3;c.components.push(rx);
 const supply=terminals(b).find(t=>t.role===(avr?'5v':'3v3'))!.pin,ground=terminals(b).find(t=>t.role==='ground')!.pin;
 connect(b.id,supply,rx.id,'VCC','#d04b46');connect(b.id,ground,rx.id,'GND','#334155');connect(b.id,pin(avr?2:4),rx.id,'OUT');
 if(key==='irTransmit'){
  const tx=makePart('irTransmitter',avr?950:730,150,'irTx');tx.properties.moduleVoltage=avr?5:3.3;c.components.push(tx);
  connect(b.id,supply,tx.id,'VCC','#d04b46');connect(b.id,ground,tx.id,'GND','#334155');connect(b.id,pin(avr?3:5),tx.id,'SIG');
 }else c.components.push(makePart('irRemote',avr?980:760,100,'irRemote'));
 if(key==='irLED'){
  const r=makePart('resistor',avr?700:450,450,'irR'),led=makePart('led',avr?920:670,450,'irLED');r.properties.resistance=680;c.components.push(r,led);
  connect(b.id,pin(avr?9:7),r.id,'1','#d59218');connect(r.id,'2',led.id,'A','#d59218');connect(led.id,'K',b.id,ground,'#334155');
 }
 return c;
}
const intro='IR prijamnik: VCC=3,3 V za ESP32 / 5 V za Uno/Nano, GND zajednički, OUT=GPIO4 / D2. OUT je aktivno LOW i ima 30 kΩ pull-up. Standardni NEC šalje 8-bitnu adresu, njezin inverz, naredbu i njezin inverz, LSB prvi. Zaglavlje 9 ms + 4,5 ms; bitovi 562,5 µs + 562,5/1687,5 µs. Repeat ne nosi novu naredbu. Optička skupina je virtualna putanja, nije NEC adresa.';
const pyStart=`from machine import Pin
from time import sleep_ms
from lab_ir import NECReceiver
ir = NECReceiver(Pin(4, Pin.IN))
`;
export const irExamples={
 irPulses:{title:'IR · vremenski niz NEC impulsa',hint:intro+' Pokreni pa pošalji kratki pritisak. lab_ir.py mjeri LOW/HIGH trajanja kroz GPIO i ispisuje cijeli niz. Python čeka uvodni impuls u ograničenom prozoru od 12 ms virtualnog vremena; između poziva predaje izvođenje pregledniku. Primjer ne prima 38 kHz nositelj na GPIO; prijamnik ga demodulira.',code:pyStart+`print("IR READY: kratki pritisak -> impulsi u us")
while True:
    try:
        rezultat = ir.read()
        if rezultat:
            print("IR PULSES", ir.pulses)
            print("NEC A=%d C=%d R=%d" % rezultat)
    except ValueError as greska:
        print(greska)
    sleep_ms(1)
`},
 irNEC:{title:'IR · NEC adresa, naredba i repeat',hint:intro+' Dugi pritisak šalje posebni repeat svakih 110 ms od početka okvira. Dekoder prihvaća repeat samo do 150 ms nakon valjanog okvira/ponavljanja. Nevaljan inverz ili vrijeme odbacuju naredbu. Extended NEC, NEC2 i ostali protokoli nisu podržani. Arduino prijamni pretinac čuva posljednji nepročitani okvir; overruns broji prepisane okvire ako program ne čita dovoljno često.',code:pyStart+`print("IR READY")
while True:
    try:
        rezultat = ir.read()
        if rezultat:
            print("NEC A=%d C=%d R=%d" % rezultat)
    except ValueError as greska:
        print(greska)
    sleep_ms(1)
`},
 irLED:{title:'IR → LED · kratki i dugi pritisak',hint:intro+' LED preko 680 Ω na GPIO7 / D9. Program prihvaća samo adresu 0. POWER=69 uključuje/isključuje samo novi okvir; PLUS=70 i MINUS=21 mijenjaju PWM za 10 %, uključujući repeat. Promijeni adresu daljinskog da vidiš filtriranje.',code:pyStart+`from machine import PWM
led = PWM(Pin(7), freq=1000, duty_u16=0)
svjetlina = 0
print("IR READY LED=0")
while True:
    try:
        rezultat = ir.read()
        if rezultat:
            adresa, naredba, repeat = rezultat
            if adresa == 0:
                if naredba == 69 and not repeat:
                    svjetlina = 0 if svjetlina else 50
                elif naredba == 70:
                    svjetlina = min(100, svjetlina + 10)
                elif naredba == 21:
                    svjetlina = max(0, svjetlina - 10)
                led.duty_u16(svjetlina * 65535 // 100)
                print("LED=%d R=%d" % (svjetlina, repeat))
    except ValueError as greska:
        print(greska)
    sleep_ms(1)
`},
 irTransmit:{title:'IR · predajnik 38 kHz i upareni prijamnik',hint:intro+' Predajnik s ugrađenim pogonom: SIG=GPIO5 / D3, VCC i GND. U Mjerenjima vidi izlaz uparenog prijamnika. Python šalje blokirajući, zato ovaj primjer pokazuje prijenos i kontaktni trag, bez istodobnog Python dekodiranja. Arduino koristi INT0 za prijam uz stvarni Timer2 nositelj na D3; zauzima Timer2, tone() i PWM D3/D11. Drugi program/čvor slijedi u etapi 21.',code:`from machine import Pin
from time import sleep_ms
from lab_ir import NECTransmitter
predajnik = NECTransmitter(Pin(5))
naredba = 69
print("IR TX READY: promatraj Mjerenja")
while True:
    predajnik.send(0, naredba)
    print("IR TX A=0 C=%d; trag OUT vidi u Mjerenjima" % naredba)
    naredba = 70 if naredba == 69 else 69
    sleep_ms(1000)
`},
} as const;
// MIT. This source is included as a visible project header and exported sketch.
export const cppNEC=`#pragma once
#include <Arduino.h>
// Standard NEC only. CHANGE ISR measures GPIO durations; no timer for receive.
class LabNEC {
 volatile uint8_t state=0, bits=0; volatile uint32_t raw=0, edgeAt=0, lastAt=0;
 volatile bool haveLast=false, ready=false, repeated=false;
 volatile uint8_t address=0, command=0;
public:
 volatile uint16_t errors=0, leaderUs=0, bitMarkUs=0, bitSpaceUs=0, received=0, overruns=0;
 static bool mark(uint32_t us){return us>=350 && us<=850;}
 void edge(bool high){
  uint32_t now=micros(), us=now-edgeAt;edgeAt=now;
  if(high){
   if(us>=6500 && us<=11000){state=1;leaderUs=us;return;}
   if((state==2||state==4||state==5)&&mark(us)){
    bitMarkUs=us;
    if(state==2){state=3;return;}
    if(state==4){if(haveLast&&(uint32_t)(now-lastAt)<=150000){if(ready)overruns++;repeated=true;ready=true;lastAt=now;received++;}state=0;return;}
    uint8_t a=raw,ia=raw>>8,cmd=raw>>16,icmd=raw>>24;
    if((uint8_t)(a^ia)==255&&(uint8_t)(cmd^icmd)==255){if(ready)overruns++;address=a;command=cmd;haveLast=true;lastAt=now;repeated=false;ready=true;received++;}
    else{errors++;haveLast=false;}state=0;return;
   }
  }else{
   if(state==1){
    if(us>=3500 && us<=5500){state=2;bits=0;raw=0;return;}
    if(us>=1600 && us<=2900){state=4;return;}
   }else if(state==3){
    if(us>=1200 && us<=2100)raw|=(uint32_t)1<<bits;
    else if(!mark(us)){errors++;haveLast=false;state=0;return;}
    bitSpaceUs=us;bits++;state=bits==32?5:2;return;
   }else if(state==0)return;
  }
  if(state || (high && us>850)){errors++;haveLast=false;}state=0;
 }
 bool read(uint8_t &a,uint8_t &cmd,bool &repeat){
  uint8_t saved=SREG;noInterrupts();bool ok=ready;
  if(ok){a=address;cmd=command;repeat=repeated;ready=false;}SREG=saved;return ok;
 }
};
// ATmega328P Timer2 fast PWM TOP=51, /8: 38461.5 Hz, 18/52 duty.
// Owns Timer2 and OC2B=D3. Do not combine with tone() or PWM D3/D11.
class LabNECSender {
 static void mark(uint16_t us){TCNT2=0;TCCR2A|=_BV(COM2B1);delayMicroseconds(us);TCCR2A&=~_BV(COM2B1);digitalWrite(3,LOW);}
public:
 static void begin(){pinMode(3,OUTPUT);digitalWrite(3,LOW);TCCR2A=_BV(WGM21)|_BV(WGM20);TCCR2B=_BV(WGM22)|_BV(CS21);OCR2A=51;OCR2B=17;}
 static void repeat(){mark(9000);delayMicroseconds(2250);mark(562);}
 static void send(uint8_t a,uint8_t cmd,uint8_t repeats=0){
  uint32_t start=micros();
  uint8_t bytes[4]={a,(uint8_t)~a,cmd,(uint8_t)~cmd};mark(9000);delayMicroseconds(4500);
  for(uint8_t b:bytes)for(uint8_t bit=0;bit<8;bit++){mark(562);delayMicroseconds((b&(1<<bit))?1688:562);}mark(562);
  repeats=min(repeats,(uint8_t)18);for(uint8_t n=0;n<repeats;n++){while((uint32_t)(micros()-start)<(uint32_t)(n+1)*110000UL){}repeat();}
 }
};
`;
const cppStart=`#include "lab_nec.h"
LabNEC ir;
void irEdge(){ir.edge(digitalRead(2));}
void initIR(){pinMode(2,INPUT);attachInterrupt(digitalPinToInterrupt(2),irEdge,CHANGE);}
`;
const cppPrint=`Serial.print(F("NEC A="));Serial.print(a);Serial.print(F(" C="));Serial.print(cmd);Serial.print(F(" R="));Serial.println(repeat?1:0);`;
export const arduinoIRExamples={
 irPulses:{title:'Arduino · '+irExamples.irPulses.title,hint:irExamples.irPulses.hint+' lab_nec.h koristi INT0 CHANGE i micros(); ispisuje trajanje uvoda te posljednjeg bitnog impulsa i razmaka.',code:cppStart+`void setup(){Serial.begin(9600);initIR();Serial.println(F("IR READY"));}
void loop(){uint8_t a,cmd;bool repeat;if(ir.read(a,cmd,repeat)){${cppPrint}Serial.print(F("PULSE LEADER="));Serial.print(ir.leaderUs);Serial.print(F(" MARK="));Serial.print(ir.bitMarkUs);Serial.print(F(" SPACE="));Serial.println(ir.bitSpaceUs);}delay(1);}
`},
 irNEC:{title:'Arduino · '+irExamples.irNEC.title,hint:irExamples.irNEC.hint+' Prijam je INT0 CHANGE bez zauzimanja timera; dekoder je vidljiv u lab_nec.h.',code:cppStart+`uint16_t errors=0;
void setup(){Serial.begin(9600);initIR();Serial.println(F("IR READY"));}
void loop(){uint8_t a,cmd;bool repeat;if(ir.read(a,cmd,repeat)){${cppPrint}}if(ir.errors!=errors){errors=ir.errors;Serial.print(F("NEC ERROR="));Serial.println(errors);}delay(1);}
`},
 irLED:{title:'Arduino · '+irExamples.irLED.title,hint:irExamples.irLED.hint+' Prijam koristi INT0, LED PWM koristi Timer1 na D9.',code:cppStart+`int brightness=0;
void setup(){Serial.begin(9600);initIR();pinMode(9,OUTPUT);analogWrite(9,0);Serial.println(F("IR READY LED=0"));}
void loop(){uint8_t a,cmd;bool repeat;if(ir.read(a,cmd,repeat)&&a==0){if(cmd==69&&!repeat)brightness=brightness?0:50;else if(cmd==70)brightness=min(100,brightness+10);else if(cmd==21)brightness=max(0,brightness-10);analogWrite(9,(long)brightness*255/100);Serial.print(F("LED="));Serial.print(brightness);Serial.print(F(" R="));Serial.println(repeat?1:0);}delay(1);}
`},
 irTransmit:{title:'Arduino · '+irExamples.irTransmit.title,hint:irExamples.irTransmit.hint,code:cppStart+`uint8_t command=69;
void setup(){Serial.begin(9600);initIR();LabNECSender::begin();Serial.println(F("IR TX READY"));}
void loop(){LabNECSender::send(0,command);delay(5);uint8_t a,cmd;bool repeat;if(ir.read(a,cmd,repeat)){${cppPrint}}else Serial.println(F("IR RX: provjeri napajanje, OUT i opticku skupinu"));command=command==69?70:69;delay(1000);}
`},
} as const;
