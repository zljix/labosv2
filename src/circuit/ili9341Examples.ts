import {spiCircuit} from './spiExamples';
import {CATALOG,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
export {cppILI9341} from './ili9341Driver';
export type ILIExample='iliGraphics'|'iliRotation'|'iliPartial'|'iliDashboard';
export function iliCircuit(key:ILIExample,board:BoardId=S3):Circuit {
 const c=spiCircuit(key==='iliDashboard'?'spiDashboard':'tftGraphics',board);
 for(const p of c.components){if(p.kind==='st7735'){p.kind='ili9341';p.label=CATALOG.ili9341.short;}if(p.kind==='bmp280_spi')p.y=610;}
 return c;
}
const hint='ILI9341 je kontroler zaslona 240×320. SPI: SCK=takt, MOSI=pločica→uređaj, CS LOW bira uređaj; DC LOW=naredba, HIGH=podaci. RGB565 šalje dva bajta po pikselu, viši prvi. CASET/PASET biraju prozor, RAMWR upisuje piksele. ESP32 SCK12/MOSI11/MISO13; Uno/Nano D13/D11/D12. TFT CS10/DC9/RESET8, BMP280 CS7. BL=3V3 na svim pločicama. Uno/Nano koristi izričit 5 V carrier s regulatorom i SPI prilagodbom; fizički modul zasebno provjeri. Vidljivi Lab driver, bez punog framebuffera i bez dodira u ovim primjerima; XPT2046 ima zasebne primjere.';
const pyStart=`from machine import Pin, SPI
from time import sleep_ms
from lab_ili9341 import ILI9341

# Neaktivni CS postavi HIGH prije pokretanja zajedničke SPI sabirnice.
tft_cs = Pin(10, Pin.OUT, value=1)
sensor_cs = Pin(7, Pin.OUT, value=1)
bus = SPI(1, baudrate=1000000, polarity=0, phase=0,
          sck=Pin(12), mosi=Pin(11), miso=Pin(13))
tft = ILI9341(bus, tft_cs, Pin(9), Pin(8))
`;
export const iliExamples={
 iliGraphics:{title:'ILI9341 · boje, tekst i geometrija',hint:hint+' Pokus: promijeni 0xf800 u 0x001f; program treba obojiti prvu traku plavo. Naredba print sama ne crta na zaslonu.',code:pyStart+`
tft.fill(0x0000)
# Tri trake koriste 16-bitne boje: crvena, zelena i plava.
tft.fill_rect(0, 0, 80, 48, 0xf800)
tft.fill_rect(80, 0, 80, 48, 0x07e0)
tft.fill_rect(160, 0, 80, 48, 0x001f)
tft.text("ILI9341", 25, 70, 0xffff, 4)
tft.rect(10, 125, 220, 180, 0xffe0)
tft.line(11, 126, 228, 303, 0x07ff)
tft.line(228, 126, 11, 303, 0xf81f)
# y=319 zahtijeva oba bajta adrese; ST7735 ima manju geometriju.
tft.pixel(239, 319, 0xf81f)
print("ILI GRAPHICS READY")
while True:
    sleep_ms(100)
`},
 iliRotation:{title:'ILI9341 · četiri rotacije',hint:hint+' MADCTL mijenja smjer adresiranja; logička širina/visina postaju 240×320 ili 320×240. Fizički panel ostaje uspravan. Crvena oznaka pokazuje logički gornji lijevi kut. Nema ST7735 pomaka panela.',code:pyStart+`
while True:
    for rotation in range(4):
        tft.rotation(rotation)
        tft.fill(0)
        tft.fill_rect(0, 0, 24, 24, 0xf800)
        tft.rect(0, 0, tft.width, tft.height, 0xffff)
        tft.text("ROT %d" % rotation, 36, tft.height//2, 0x07e0, 3)
        print("ILI ROT=%d %dx%d" % (rotation, tft.width, tft.height))
        sleep_ms(1000)
`},
 iliPartial:{title:'ILI9341 · djelomično osvježavanje',hint:hint+' Puni zaslon briše se jednom. Petlja upisuje samo prozor 180×70; okvir i naslov ostaju u memoriji kontrolera. To je prozorski upis, zaseban od partial display moda. Pokus: smanji širinu brisanja i promatraj ostatke starog teksta.',code:pyStart+`
tft.fill(0x000f)
tft.text("PROZOR RAM", 20, 38, 0xffff, 3)
tft.rect(20, 120, 200, 100, 0xffff)
broj = 0
while True:
    boja = 0x07e0 if broj % 2 == 0 else 0xf800
    tft.fill_rect(30, 135, 180, 70, boja)
    tft.text("BROJ %d" % broj, 40, 155, 0, 2)
    print("ILI PARTIAL=%d" % broj)
    broj = (broj + 1) % 100
    sleep_ms(1000)
`},
 iliDashboard:{title:'ILI9341 · SPI instrument s BMP280',hint:hint+' Zajednički SCK/MOSI, odvojeni CS10/CS7; MISO koristi BMP280. Driver čita ID, kalibraciju i sirove registre te računa temperaturu/tlak. U Mjerenjima promijeni okoliš i usporedi sljedeće očitanje sa slikom.',code:pyStart+`
from lab_bmp280_spi import BMP280SPI
sensor = BMP280SPI(bus, sensor_cs)
tft.fill(0)
tft.text("SPI INSTRUMENT", 10, 20, 0x07ff, 2)
tft.rect(8, 75, 224, 150, 0xffff)
while True:
    temperature, pressure = sensor.read()
    tft.fill_rect(12, 90, 216, 125, 0)
    tft.text("%.1f C" % temperature, 16, 105, 0xffe0, 3)
    tft.text("%.1f HPA" % (pressure/100), 16, 165, 0x07e0, 2)
    print("ILI DASH T=%.2f P=%.0f Pa" % (temperature, pressure))
    sleep_ms(1000)
`},
}as const;
const cppStart=`#include <SPI.h>
#include "lab_ili9341.h"
// D oznake Uno/Nano. Slika je u RAM-u kontrolera, ne u 2 KB MCU SRAM-a.
LabILI9341 tft(10,9,8);
`;
export const arduinoILIExamples={
 iliGraphics:{...iliExamples.iliGraphics,title:'Arduino · '+iliExamples.iliGraphics.title,code:cppStart+`
void setup(){
 Serial.begin(9600);tft.begin();tft.fillScreen(0);
 tft.fillRect(0,0,80,48,0xf800);tft.fillRect(80,0,80,48,0x07e0);tft.fillRect(160,0,80,48,0x001f);
 tft.setCursor(25,70);tft.setTextSize(4);tft.print(F("ILI9341"));
 tft.drawRect(10,125,220,180,0xffe0);tft.drawLine(11,126,228,303,0x07ff);tft.drawLine(228,126,11,303,0xf81f);
 tft.drawPixel(239,319,0xf81f);Serial.println(F("ILI GRAPHICS READY"));
}
void loop(){delay(100);}
`},
 iliRotation:{...iliExamples.iliRotation,title:'Arduino · '+iliExamples.iliRotation.title,code:cppStart+`
void setup(){Serial.begin(9600);tft.begin();}
void loop(){for(byte r=0;r<4;r++){
 tft.setRotation(r);tft.fillScreen(0);tft.fillRect(0,0,24,24,0xf800);tft.drawRect(0,0,tft.width(),tft.height(),0xffff);
 tft.setCursor(36,tft.height()/2);tft.setTextColor(0x07e0);tft.setTextSize(3);tft.print(F("ROT "));tft.print(r);
 Serial.print(F("ILI ROT="));Serial.print(r);Serial.print(' ');Serial.print(tft.width());Serial.print('x');Serial.println(tft.height());delay(1000);
}}
`},
 iliPartial:{...iliExamples.iliPartial,title:'Arduino · '+iliExamples.iliPartial.title,code:cppStart+`
byte broj=0;
void setup(){
 Serial.begin(9600);tft.begin();tft.fillScreen(0x000f);
 tft.setCursor(20,38);tft.setTextSize(3);tft.print(F("PROZOR RAM"));tft.drawRect(20,120,200,100,0xffff);
}
void loop(){
 // Samo ovaj prozor dobiva nove piksele. Puni se zaslon ne briše u petlji.
 tft.fillRect(30,135,180,70,broj%2?0xf800:0x07e0);
 tft.setCursor(40,155);tft.setTextColor(0);tft.setTextSize(2);tft.print(F("BROJ "));tft.print(broj);
 Serial.print(F("ILI PARTIAL="));Serial.println(broj);broj=(broj+1)%100;delay(1000);
}
`},
 iliDashboard:{...iliExamples.iliDashboard,title:'Arduino · '+iliExamples.iliDashboard.title,code:cppStart+`
#include "lab_bmp280_spi.h"
LabBMP280SPI sensor(7);
void setup(){
 Serial.begin(9600);digitalWrite(7,HIGH);pinMode(7,OUTPUT);tft.begin();
 if(!sensor.begin()){Serial.println(F("BMP280 SPI ID/SPOJ ERROR"));while(true)delay(100);}
 tft.fillScreen(0);tft.setCursor(10,20);tft.setTextColor(0x07ff);tft.setTextSize(2);tft.print(F("SPI INSTRUMENT"));tft.drawRect(8,75,224,150,0xffff);
}
void loop(){float t,p;if(sensor.read(t,p)){
 tft.fillRect(12,90,216,125,0);tft.setCursor(16,105);tft.setTextColor(0xffe0);tft.setTextSize(3);tft.print(t,1);tft.print(F(" C"));
 tft.setCursor(16,165);tft.setTextColor(0x07e0);tft.setTextSize(2);tft.print(p/100,1);tft.print(F(" HPA"));
 Serial.print(F("ILI DASH T="));Serial.print(t,2);Serial.print(F(" P="));Serial.print(p,0);Serial.println(F(" Pa"));
}delay(1000);}
`},
}as const;
