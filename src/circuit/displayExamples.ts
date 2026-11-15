import {emptyCircuit,makePart,terminals,type Circuit,type Kind} from './model';
import {S3,type BoardId} from '../boards/profiles';
export type DisplayExample='oled32'|'lcd1602'|'lcdWeather';
export function displayCircuit(key:DisplayExample,board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=40;b.y=95;
 const pin=(gpio:number)=>terminals(b).find(t=>t.gpio===gpio)!.pin;
 const rail=(role:string)=>terminals(b).find(t=>t.role===role)!.pin;
 const kinds:Kind[]=key==='oled32'?['ssd1306_32']:key==='lcd1602'?['lcd1602']:['lcd1602','bmp280'];
 for(const [i,kind]of kinds.entries()){
  const p=makePart(kind,avr?600:390,80+i*300,kind==='bmp280'?'bmp2801':'display1');
  if(kind==='lcd1602')p.properties.logicVoltage=avr?5:3.3;
  else if(avr)p.properties.moduleVoltage=5;
  c.components.push(p);
  const connections=[['VCC',rail(kind==='lcd1602'||avr?'5v':'3v3'),'#d04b46'],['GND',rail('ground'),'#334155'],['SDA',avr?'A4':pin(8),'#087f8c'],['SCL',avr?'A5':pin(9),'#d59218']];
  if(kind==='lcd1602')connections.push(['LV',rail(avr?'5v':'3v3'),'#8b52ba']);
  for(const [target,source,color]of connections)c.wires.push({id:'displayWire'+c.wires.length,from:{component:b.id,pin:source},to:{component:p.id,pin:target},color,points:[]});
 }
 return c;
}
const bus='from machine import Pin, I2C\nfrom time import sleep_ms\nbus = I2C(0, sda=Pin(8), scl=Pin(9), freq=100000)\n';
const oledHint='OLED 0,91 inča ima 128 × 32 piksela. SSD1306_I2C(128, 32, bus) šalje multiplex 31 i COM 0x02; tekst stane u četiri reda od 8 piksela. I2C 0x3C, SDA=GPIO8, SCL=GPIO9.';
const lcdHint='LCD ima 16 stupaca i 2 retka; move_to/setCursor počinje s 0. PCF8574 0x27: P0=RS, P1=RW, P2=E, P3=svjetlo, P4–P7=podaci. Najviše 100 kHz. VCC=5 V i GND; ESP32 koristi dvosmjerni I2C pretvornik s LV na 3V3. Ovaj složeni profil ima zaseban LV priključak; svaki fizički backpack treba provjeriti.';
const smile='(0, 10, 10, 0, 17, 14, 0, 0)';
export const displayExamples={
 oled32:{title:'OLED 128 × 32 · četiri retka',hint:oledHint,code:bus+`from ssd1306 import SSD1306_I2C
# 32 je stvarna visina, nije smanjen crtez zaslona 128x64.
oled = SSD1306_I2C(128, 32, bus)
brojac = 0
while True:
    oled.fill(0)
    oled.text("OLED 128 x 32", 0, 0)
    oled.text("URS laboratorij", 0, 8)
    oled.text("Brojac: %d" % brojac, 0, 16)
    oled.text("Redak 4", 0, 24)
    oled.show()
    print("OLED32 brojac=%d" % brojac)
    brojac += 1
    sleep_ms(1000)
`},
 lcd1602:{title:'LCD1602 · tekst i vlastiti znak',hint:lcdHint+' custom_char() pohranjuje 5 × 8 točaka u CGRAM. Tekst je ASCII; č/ć/ž/š/đ nisu dio ovog profila.',code:bus+`from lcd1602 import LCD1602
lcd = LCD1602(bus, address=0x27)
lcd.custom_char(0, ${smile})
lcd.putstr("Pozdrav, URS! " + chr(0))
brojac = 0
while True:
    lcd.move_to(0, 1)
    lcd.putstr((("Brojac: %d" % brojac) + " " * 16)[:16])
    print("LCD1602 brojac=%d" % brojac)
    brojac += 1
    sleep_ms(1000)
`},
 lcdWeather:{title:'BMP280 → LCD1602 · mjerenje i prikaz',hint:lcdHint+' BMP280 dijeli sabirnicu na 0x76. Driver čita registre i izračunava T/P; LCD prima tekst iz programa. Promijeni okoliš BMP280 tijekom rada.',code:bus+`from lcd1602 import LCD1602
from lab_i2c_sensors import BMP280
lcd = LCD1602(bus)
senzor = BMP280(bus)
while True:
    temperatura, tlak = senzor.read()
    lcd.move_to(0, 0)
    lcd.putstr((("T: %.1f C" % temperatura) + " " * 16)[:16])
    lcd.move_to(0, 1)
    lcd.putstr((("P: %.1f hPa" % (tlak / 100)) + " " * 16)[:16])
    print("LCD T=%.2f P=%.0f Pa" % (temperatura, tlak))
    sleep_ms(1000)
`},
};
export const arduinoDisplayExamples={
 oled32:{title:'Arduino · OLED 128 × 32',hint:oledHint+' Uno/Nano: modul s prilagodbom na 5 V, SDA=A4, SCL=A5. U8g2_12832 sadrži UNIVISION profil i stranicu od 128 B.',libraries:['U8g2_12832'],code:`#include <U8g2lib.h>
// _1_ koristi samo 128 B stranice; GDDRAM je u zaslonu.
U8G2_SSD1306_128X32_UNIVISION_1_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);
unsigned long brojac = 0;
void setup(){Serial.begin(9600);oled.begin();oled.setFont(u8g2_font_6x10_tf);}
void loop(){
 oled.firstPage();
 do {
  oled.setCursor(0,8);oled.print(F("OLED 128 x 32"));
  oled.setCursor(0,18);oled.print(F("Brojac: "));oled.print(brojac);
  oled.setCursor(0,30);oled.print(F("Zadnji redak"));
 } while(oled.nextPage());
 Serial.print(F("OLED32 brojac="));Serial.println(brojac++);delay(1000);
}
`},
 lcd1602:{title:'Arduino · LCD1602 i vlastiti znak',hint:lcdHint+' Uno/Nano: LV=5 V, SDA=A4, SCL=A5; izravni 5 V profil. Pošalji b za pozadinsko svjetlo ili d za prikaz.',libraries:['LabLCD1602'],code:`#include <LabLCD1602.h>
LabLCD1602 lcd;
unsigned long brojac=0;
bool svjetlo=true,prikaz=true,spreman=false;
const uint8_t znak[8]={0,10,10,0,17,14,0,0};
void setup(){
 Serial.begin(9600);spreman=lcd.begin();
 if(!spreman){Serial.println(F("LCD: provjeri spoj i adresu"));return;}
 lcd.createChar(0,znak);lcd.print(F("Pozdrav, URS! "));lcd.write((uint8_t)0);
 Serial.println(F("LCD spreman: b=svjetlo d=prikaz"));
}
void loop(){
 if(!spreman){delay(100);return;}
 while(Serial.available()){
  char c=Serial.read();if(c=='b'){svjetlo=!svjetlo;lcd.backlight(svjetlo);}
  if(c=='d'){prikaz=!prikaz;lcd.display(prikaz);}
 }
 lcd.setCursor(0,1);lcd.print(F("                "));lcd.setCursor(0,1);
 lcd.print(F("Brojac: "));lcd.print(brojac);
 Serial.print(F("LCD1602 brojac="));Serial.println(brojac++);delay(1000);
}
`},
 lcdWeather:{title:'Arduino · BMP280 → LCD1602',hint:lcdHint+' Uno/Nano: LV=5 V, SDA=A4, SCL=A5; BMP280 odabran kao modul s prilagodbom na 5 V.',libraries:['LabLCD1602','LabI2CSensors'],code:`#include <LabLCD1602.h>
#include <LabI2CSensors.h>
LabLCD1602 lcd;
LabBMP280 senzor;
bool spreman=false;
void setup(){Serial.begin(9600);spreman=lcd.begin()&&senzor.begin();if(!spreman)Serial.println(F("LCD/BMP280: provjeri spoj"));}
void loop(){
 float temperatura,tlak;
 if(!spreman||!senzor.read(temperatura,tlak)){Serial.println(F("Nema mjerenja"));delay(1000);return;}
 lcd.setCursor(0,0);lcd.print(F("                "));lcd.setCursor(0,0);
 lcd.print(F("T: "));lcd.print(temperatura,1);lcd.print(F(" C"));
 lcd.setCursor(0,1);lcd.print(F("                "));lcd.setCursor(0,1);
 lcd.print(F("P: "));lcd.print(tlak/100,1);lcd.print(F(" hPa"));
 Serial.print(F("LCD T="));Serial.print(temperatura,2);Serial.print(F(" P="));Serial.println(tlak,0);delay(1000);
}
`},
}as const;
