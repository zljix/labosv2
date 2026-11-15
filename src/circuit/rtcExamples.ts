import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
import {tmCircuit} from './tm1637Examples';
export type RTCExample='rtcRead'|'rtcSet'|'rtcMemory'|'rtcClock';
export function rtcCircuit(key:RTCExample='rtcRead',board:BoardId=S3):Circuit{
 const c=key==='rtcClock'?tmCircuit('tmClock',board):emptyCircuit(board),b=c.components[0],avr=board!==S3;
 b.x=40;b.y=70;const d=makePart('ds1302',avr?650:410,key==='rtcClock'?440:150,'rtc1');d.properties.moduleVoltage=avr?5:3.3;c.components.push(d);
 const pin=(n:number)=>terminals(b).find(t=>t.gpio===n)!.pin,rail=(r:string)=>terminals(b).find(t=>t.role===r)!.pin;
 // TM1637 uses 4/5 (S3) or 2/3 (AVR); RTC has separate 6/7/8 or 4/5/6.
 for(const [from,to,color]of [[rail(avr?'5v':'3v3'),'VCC','#d04b46'],[rail('ground'),'GND','#334155'],[pin(avr?4:6),'CE','#8b52ba'],[pin(avr?5:7),'IO','#087f8c'],[pin(avr?6:8),'SCLK','#3867d6']])c.wires.push({id:'rtcw'+c.wires.length,from:{component:b.id,pin:from},to:{component:d.id,pin:to},color,points:[]});
 return c;
}
const intro='DS1302 ima trožično sučelje CE, dvosmjerni I/O i SCLK; nije I2C niti SPI uređaj. S3: CE6/I/O7/SCLK8 i VCC=3V3. Uno/Nano: CE4/I/O5/SCLK6 i VCC=5V. GND je zajednički. BCD pohranjuje dvije decimalne znamenke u dva polubajta; primjerice 0x23 znači 23. Vidljivi driver šalje bitove LSB prvi. Sat početno pokazuje 1. 1. 2026. u 12:00:00. Nema automatskog usklađivanja s računalom. ';
const policy=' Virtualni sat napreduje samo dok traje simulacija. Stop čuva zadnju prikazanu snimku u ovoj otvorenoj sesiji; Run i Reset MCU-a nastavljaju od nje. Za ponovno otvaranje ili izvoz najprije klikni Sačuvaj snimku RTC-a. Bez obje vrste napajanja podaci postaju nevaljani; postavi ih programom. Pričuvna baterija ne napaja mikroupravljač. ';
const pyStart=`from machine import Pin
from time import sleep_ms
from lab_ds1302 import DS1302
sat = DS1302(Pin(6), Pin(7), Pin(8))
`;
const pyPrint=`    try:
        y, mo, d, dan, h, m, s = sat.datetime()
        print("RTC %04d-%02d-%02d %02d:%02d:%02d DAY=%d" % (y, mo, d, h, m, s, dan))
    except ValueError:
        print("RTC ERROR: provjeri spojeve, napajanje i kalendar")
`;
export const rtcExamples={
 rtcRead:{title:'DS1302 · čitanje i baterija',hint:intro+'Ovaj program samo čita sat. U Živim ulazima isključi glavno napajanje RTC modula: komunikacija prestaje, a uz bateriju sat nastavlja. Uključi ga i usporedi vrijeme. Za pokus bez baterije zaustavi program i isključi opciju baterije u svojstvima modula.'+policy,code:pyStart+`while True:
`+pyPrint+`    sleep_ms(1000)
`},
 rtcSet:{title:'DS1302 · postavljanje i prijestupna godina',hint:intro+'Program pri svakom pokretanju namjerno postavlja 28. 2. 2028. u 23:59:58 (dan 2 = ponedjeljak), zatim pokazuje prijelaz na 29. veljače. To prepisuje zadržano vrijeme. Za nastavak sata koristi primjer čitanja ili ukloni set_datetime().'+policy,code:pyStart+`# Postavlja se jednom na pocetku programa, ne u svakoj iteraciji.
sat.set_datetime(2028, 2, 28, 2, 23, 59, 58)
while True:
`+pyPrint+`    sleep_ms(1000)
`},
 rtcMemory:{title:'DS1302 · CH, zaštita i RAM',hint:intro+'CH=1 zaustavlja brojanje, WP=1 sprečava zapise u sat i RAM. Kontrolni registar može ukinuti WP. Program provjerava odbijen zapis RAM-a, vraća WP=0 i povećava RAM[0] pri svakom Resetu mikroupravljača. RAM je u RTC-u, odvojen od programskih varijabli. Otvori Mjerenja za stvarne bajtove.'+policy,code:pyStart+`sat.write_protect(False)
sat.halted(True)
print("RTC CH=%d" % sat.halted())
sleep_ms(1000)
sat.halted(False)
prethodno = sat.ram(0)
sat.ram(0, (prethodno + 1) % 256)
sat.write_protect(True)
sat.ram(0, 99)  # WP mora odbiti ovaj zapis
print("RTC RAM=%d WP=%d" % (sat.ram(0), sat.read(0x8F)[0] >> 7))
sat.write_protect(False)
while True:
`+pyPrint+`    sleep_ms(1000)
`},
 rtcClock:{title:'DS1302 → TM1637 · sati i minute',hint:intro+'Odvojeni TM1637 ima CLK4/DIO5 na S3 ili CLK2/DIO3 na AVR-u, VCC=5V i LV prema pločici. Program čita RTC, pretvara sate i minute u segmentne bajtove te šalje drugi protokol. Dvotočka prati parnost sekunde; TM1637 sam ne zna vrijeme. '+policy,code:pyStart+`from lab_tm1637 import TM1637
prikaz = TM1637(Pin(4), Pin(5))
prikaz.brightness(7)
while True:
    try:
        y, mo, d, dan, h, m, s = sat.datetime()
        prikaz.number(h * 100 + m, colon=bool(s % 2), leading_zero=True)
        print("RTC DISPLAY=%02d:%02d:%02d" % (h, m, s))
    except ValueError:
        prikaz.segments([0x40] * 4)
        print("RTC ERROR")
    sleep_ms(500)
`},
} as const;
const cppStart=`#include "lab_ds1302.h"
// Uno/Nano: CE=D4, I/O=D5, SCLK=D6, VCC=5V. S3 uses 6/7/8, VCC=3V3.
LabDS1302 sat(4,5,6);
void printClock(){
 LabDS1302::DateTime d;
 if(!sat.datetime(d)){Serial.println(F("RTC ERROR"));return;}
 Serial.print(F("RTC "));Serial.print(d.year);Serial.print('-');Serial.print(d.month);Serial.print('-');Serial.print(d.date);Serial.print(' ');
 Serial.print(d.hour);Serial.print(':');Serial.print(d.minute);Serial.print(':');Serial.print(d.second);Serial.print(F(" DAY="));Serial.println(d.day);
}
`;
export const arduinoRTCExamples={
 rtcRead:{title:'Arduino · '+rtcExamples.rtcRead.title,hint:rtcExamples.rtcRead.hint,code:cppStart+`void setup(){Serial.begin(9600);sat.begin();}
void loop(){printClock();delay(1000);}
`},
 rtcSet:{title:'Arduino · '+rtcExamples.rtcSet.title,hint:rtcExamples.rtcSet.hint,code:cppStart+`void setup(){Serial.begin(9600);sat.begin();const LabDS1302::DateTime d={2028,2,28,2,23,59,58};sat.set(d);}
void loop(){printClock();delay(1000);}
`},
 rtcMemory:{title:'Arduino · '+rtcExamples.rtcMemory.title,hint:rtcExamples.rtcMemory.hint,code:cppStart+`void setup(){
 Serial.begin(9600);sat.begin();sat.writeProtect(false);sat.halt(true);
 Serial.print(F("RTC CH="));Serial.println(sat.halted());delay(1000);sat.halt(false);
 uint8_t before=sat.ram(0);sat.ram(0,uint8_t(before+1));sat.writeProtect(true);sat.ram(0,99);
 Serial.print(F("RTC RAM="));Serial.print(sat.ram(0));uint8_t wp;sat.read(0x8f,&wp);Serial.print(F(" WP="));Serial.println(wp>>7);sat.writeProtect(false);
}
void loop(){printClock();delay(1000);}
`},
 rtcClock:{title:'Arduino · '+rtcExamples.rtcClock.title,hint:rtcExamples.rtcClock.hint,code:cppStart+`#include "lab_tm1637.h"
LabTM1637 prikaz(2,3);
void setup(){Serial.begin(9600);sat.begin();prikaz.begin();prikaz.brightness(7);}
void loop(){LabDS1302::DateTime d;if(sat.datetime(d)){prikaz.number(d.hour*100+d.minute,d.second%2,true);printClock();}else{const uint8_t bars[]={64,64,64,64};prikaz.segments(bars);Serial.println(F("RTC ERROR"));}delay(500);}
`},
} as const;
export const s3RTCExamples=Object.fromEntries(Object.entries(arduinoRTCExamples).map(([key,e])=>[key,{...e,title:e.title.replace('Arduino ·','S3 C++ ·'),code:e.code.replace('sat(4,5,6)','sat(6,7,8)').replace('prikaz(2,3)','prikaz(4,5)')}])) as Record<RTCExample,{title:string;hint:string;code:string}>;
