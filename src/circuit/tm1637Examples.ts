import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
export type TMExample='tmSegments'|'tmCounter'|'tmClock'|'tmBrightness';
export function tmCircuit(_key:TMExample='tmCounter',board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=40;b.y=70;
 const d=makePart('tm1637',avr?650:410,160,'tm1');d.properties.logicVoltage=avr?5:3.3;c.components.push(d);
 const pin=(gpio:number)=>terminals(b).find(t=>t.gpio===gpio)!.pin;
 const rail=(role:string)=>terminals(b).find(t=>t.role===role)!.pin;
 for(const [a,z,color]of [[rail('5v'),'VCC','#d04b46'],[rail('ground'),'GND','#334155'],[rail(avr?'5v':'3v3'),'LV','#d59218'],[pin(avr?2:4),'CLK','#087f8c'],[pin(avr?3:5),'DIO','#3867d6']])c.wires.push({id:'tmw'+c.wires.length,from:{component:b.id,pin:a},to:{component:d.id,pin:z},color,points:[]});
 return c;
}
const intro='TM1637 četveroznamenkasti profil s dvotočkom: VCC=5 V, GND, LV=3,3 V za ESP32 / 5 V za Uno/Nano, CLK=GPIO4 / D2, DIO=GPIO5 / D3. LV pripada uključenom idealnom dvosmjernom prilagodniku; nije peti izvod golog TM1637 modula. Dvije 10 kΩ pull-up grane su na LV. Prijenos je LSB prvi s devetim ACK taktom, bez I2C adrese. DIO otpusti za ACK. Bitovi 0–6 su a–g, bit 7 druge znamenke je dvotočka; ostali decimalni zarezi nisu ožičeni. ';
const pyStart=`from machine import Pin
from time import sleep_ms
from lab_tm1637 import TM1637
prikaz = TM1637(Pin(4), Pin(5))
prikaz.brightness(7)
`;
export const tmExamples={
 tmSegments:{title:'TM1637 · segmenti i CLK/DIO',hint:intro+' Svakih 500 ms pali jedan bit na svim znamenkama. U Mjerenjima usporedi 0x40, 0xC0, podatke i ACK. C0–C3 su vidljive znamenke; čip ima i nevidljive C4/C5.',code:pyStart+`while True:
    for bit in range(8):
        prikaz.segments([1 << bit] * 4)
        print("TM SEGMENT bit=%d" % bit)
        sleep_ms(500)
`},
 tmCounter:{title:'TM1637 · brojač i negativni brojevi',hint:intro+' Program pretvara broj u segmentne bajtove. Brojač počinje od −3, bez vodećih nula. Dopušteno −999 do 9999; prikaz nije običan tekstni zaslon.',code:pyStart+`broj = -3
while True:
    prikaz.number(broj)
    print("TM COUNT=%d" % broj)
    broj = -3 if broj == 9999 else broj + 1
    sleep_ms(500)
`},
 tmClock:{title:'TM1637 · minute, sekunde i dvotočka',hint:intro+' Demonstracijsko programsko brojilo počinje na 12:34; nije RTC ni stvarno vrijeme. Vodeće nule čuvaju dvije znamenke minuta i sekundi, a dvotočka se mijenja svakih 500 ms.',code:pyStart+`sekunde = 12 * 60 + 34
while True:
    broj = (sekunde // 60) * 100 + sekunde % 60
    prikaz.number(broj, colon=True, leading_zero=True)
    print("TM CLOCK=%02d:%02d" % (sekunde // 60, sekunde % 60))
    sleep_ms(500)
    prikaz.number(broj, colon=False, leading_zero=True)
    sleep_ms(500)
    sekunde = (sekunde + 1) % 3600
`},
 tmBrightness:{title:'TM1637 · osam svjetlina i gašenje',hint:intro+' Svjetlina 0 daje 1/16, nije gašenje. Osam radnih omjera: 1, 2, 4, 10, 11, 12, 13, 14 / 16. OFF skriva prikaz uz sačuvane bajtove; clear zapisuje nule. Prikaz svjetline je relativan, bez fotometrije.',code:pyStart+`prikaz.number(1234, colon=True)
while True:
    for svjetlina in range(8):
        prikaz.brightness(svjetlina)
        print("TM BRIGHTNESS=%d" % svjetlina)
        sleep_ms(500)
    prikaz.brightness(7, on=False)
    print("TM OFF: memorija ostaje")
    sleep_ms(1000)
`},
} as const;
// MIT. Visible project header, exported together with the sketch.
export const cppTM1637=`#pragma once
#include <Arduino.h>
// Own GPIO driver. No dependency on a third-party TM1637Display API.
class LabTM1637 {
 uint8_t clk,dio;
 static void low(uint8_t pin){digitalWrite(pin,LOW);pinMode(pin,OUTPUT);}
 static void release(uint8_t pin){digitalWrite(pin,LOW);pinMode(pin,INPUT);}
 static void pause(){delayMicroseconds(20);}
 void start(){release(dio);release(clk);pause();low(dio);pause();}
 void stop(){low(clk);low(dio);pause();release(clk);pause();release(dio);pause();}
 bool byte(uint8_t value){
  for(uint8_t i=0;i<8;i++){low(clk);if(value&(1<<i))release(dio);else low(dio);pause();release(clk);pause();}
  low(clk);release(dio);pause();release(clk);pause();bool ack=digitalRead(dio)==LOW;low(clk);pause();return ack;
 }
public:
 LabTM1637(uint8_t clockPin,uint8_t dataPin):clk(clockPin),dio(dataPin){}
 void begin(){release(clk);release(dio);}
 bool transaction(const uint8_t* data,uint8_t length){start();bool ok=true;for(uint8_t i=0;i<length;i++){if(!byte(data[i])){ok=false;break;}}stop();return ok;}
 bool brightness(uint8_t value=7,bool on=true){if(value>7)return false;uint8_t cmd=0x80|(on?8:0)|value;return transaction(&cmd,1);}
 bool segments(const uint8_t* data,uint8_t length=4,uint8_t pos=0){
  if(pos>3||!length||length>4-pos)return false;uint8_t mode=0x40,packet[5];packet[0]=0xc0|pos;
  for(uint8_t i=0;i<length;i++)packet[i+1]=data[i];return transaction(&mode,1)&&transaction(packet,length+1);
 }
 bool number(int value,bool colon=false,bool leading=false){
  if(value< -999||value>9999)return false;
  const uint8_t digits[10]={0x3f,6,0x5b,0x4f,0x66,0x6d,0x7d,7,0x7f,0x6f};uint8_t data[4]={};bool neg=value<0;
  unsigned int n=neg?-value:value;
  for(int8_t i=3;i>=0;i--){if(n||i==3||leading){data[i]=digits[n%10];n/=10;}else if(neg){data[i]=0x40;neg=false;}}
  if(value<0&&leading)data[0]=0x40;
  if(colon)data[1]|=0x80;return segments(data);
 }
 bool clear(){const uint8_t data[4]={};return segments(data);}
};
`;
const cppStart=`#include "lab_tm1637.h"
// CLK=D2, DIO=D3. VCC i LV na 5 V, GND zajednicki.
LabTM1637 prikaz(2, 3);

void setup() {
  Serial.begin(9600);
  prikaz.begin();
  if (!prikaz.brightness(7)) Serial.println(F("TM ACK ERROR"));
}
`;
export const arduinoTMExamples={
 tmSegments:{title:'Arduino · '+tmExamples.tmSegments.title,hint:tmExamples.tmSegments.hint,code:cppStart+`
void loop() {
  // Bitovi 0–6 pale a–g; bit 7 druge znamenke pali dvotocku.
  for (uint8_t bit = 0; bit < 8; bit++) {
    uint8_t data[4];
    for (uint8_t i = 0; i < 4; i++) data[i] = 1 << bit;
    if (!prikaz.segments(data)) Serial.println(F("TM ACK ERROR"));
    Serial.print(F("TM SEGMENT bit=")); Serial.println(bit);
    delay(500);
  }
}
`},
 tmCounter:{title:'Arduino · '+tmExamples.tmCounter.title,hint:tmExamples.tmCounter.hint,code:cppStart+`
int broj = -3;
void loop() {
  // number pretvara broj u segmentne bajtove i salje ih kroz GPIO.
  if (!prikaz.number(broj)) Serial.println(F("TM ACK ERROR"));
  Serial.print(F("TM COUNT=")); Serial.println(broj);
  broj = broj == 9999 ? -3 : broj + 1;
  delay(500);
}
`},
 tmClock:{title:'Arduino · '+tmExamples.tmClock.title,hint:tmExamples.tmClock.hint,code:cppStart+`
// Programsko brojilo, nije RTC niti stvarno vrijeme.
unsigned int sekunde = 12 * 60 + 34;
void loop() {
  unsigned int broj = (sekunde / 60) * 100 + sekunde % 60;
  if (!prikaz.number(broj, true, true)) Serial.println(F("TM ACK ERROR"));
  Serial.print(F("TM CLOCK=")); Serial.print(sekunde / 60);
  Serial.print(':'); Serial.println(sekunde % 60);
  delay(500);
  prikaz.number(broj, false, true); // ista vrijednost, dvotocka ugasena
  delay(500);
  sekunde = (sekunde + 1) % 3600;
}
`},
 tmBrightness:{title:'Arduino · '+tmExamples.tmBrightness.title,hint:tmExamples.tmBrightness.hint,code:cppStart+`
void loop() {
  prikaz.number(1234, true);
  for (uint8_t b = 0; b < 8; b++) {
    // Razina 0 je najmanja svjetlina; nije gasenje.
    if (!prikaz.brightness(b)) Serial.println(F("TM ACK ERROR"));
    Serial.print(F("TM BRIGHTNESS=")); Serial.println(b);
    delay(500);
  }
  prikaz.brightness(7, false); // OFF cuva memoriju segmenata
  Serial.println(F("TM OFF: memorija ostaje"));
  delay(1000);
}
`},
} as const;
