import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
import {cppST7735,cppBMP280SPI} from './spiDrivers';
export {cppST7735,cppBMP280SPI};
export type SPIExample='tftGraphics'|'tftRotation'|'bmp280SPI'|'spiDashboard';
export function spiCircuit(key:SPIExample,board:BoardId=S3):Circuit{
 const c=emptyCircuit(board),b=c.components[0],avr=board!==S3;b.x=40;b.y=120;
 const wire=(id:string,pin:string,gpio:number|string,color='#087f8c')=>c.wires.push({id:'spi'+c.wires.length,from:{component:b.id,pin:typeof gpio==='number'?terminals(b).find(t=>t.gpio===gpio)!.pin:gpio},to:{component:id,pin},color,points:[]});
 const supply=terminals(b).find(t=>t.role===(avr?'5v':'3v3'))!.pin,gnd=terminals(b).find(t=>t.role==='ground')!.pin,bl=terminals(b).find(t=>t.role==='3v3')!.pin;
 const kinds=key==='bmp280SPI'?['bmp280_spi']:key==='spiDashboard'?['st7735','bmp280_spi']:['st7735'];
 for(const kind of kinds){const p=makePart(kind as 'st7735'|'bmp280_spi',avr?650:420,kind==='st7735'?100:520,kind==='st7735'?'tft1':'bmpSPI');p.properties.moduleVoltage=avr?5:3.3;p.properties.logicVoltage=avr?5:3.3;c.components.push(p);
  wire(p.id,'VCC',supply,'#d04b46');wire(p.id,'GND',gnd,'#334155');wire(p.id,'SCK',avr?13:12,'#d59218');wire(p.id,'MOSI',11);wire(p.id,'CS',kind==='st7735'?10:7,'#3867d6');
  if(kind==='st7735'){wire(p.id,'DC',9,'#8b52ba');wire(p.id,'RESET',8,'#3867d6');wire(p.id,'BL',bl,'#d04b46');}else wire(p.id,'MISO',avr?12:13,'#8b52ba');
 }
 return c;
}
const hint='SPI prenosi bajtove: SCK=takt, MOSI=pločica→uređaj, MISO=uređaj→pločica, CS LOW=odabir. Svaki uređaj ima zaseban CS. ESP32: SCK12/MOSI11/MISO13; Uno/Nano: D13/D11/D12. TFT: CS10/DC9/RESET8; BMP280: CS7. BL uvijek 3V3. 5 V carrier izričito uključuje regulator i prilagodbu SPI razina; provjeri fizičku izvedbu.';
const pyStart=`from machine import Pin, SPI
from time import sleep_ms

# CS se postavlja HIGH prije inicijalizacije zajedničke sabirnice.
tft_cs = Pin(10, Pin.OUT, value=1)
sensor_cs = Pin(7, Pin.OUT, value=1)
bus = SPI(1, baudrate=1000000, polarity=0, phase=0,
          sck=Pin(12), mosi=Pin(11), miso=Pin(13))
`;
const pyTFT=`from lab_st7735 import ST7735
tft = ST7735(bus, tft_cs, Pin(9), Pin(8))
`;
const pySensor=`from lab_bmp280_spi import BMP280SPI
sensor = BMP280SPI(bus, sensor_cs)
`;
const graphics=`tft.fill(0x0000)
tft.fill_rect(0, 0, 42, 26, 0xf800)   # RGB565: crvena
tft.fill_rect(42, 0, 43, 26, 0x07e0)  # zelena
tft.fill_rect(85, 0, 43, 26, 0x001f)  # plava
tft.text("SPI TFT", 10, 38, 0xffff, 2)
tft.rect(4, 65, 120, 58, 0xffe0)
tft.line(5, 66, 122, 121, 0x07ff)
tft.line(122, 66, 5, 121, 0xf81f)
print("TFT GRAPHICS READY")
while True:
    sleep_ms(100)
`;
export const spiExamples={
 tftGraphics:{title:'ST7735 · boje, tekst i geometrija',hint:hint+' RGB565 koristi 16 bita po pikselu; tekst rasterizira vidljivi driver 5×7, bez pune slike u RAM-u pločice.',code:pyStart+pyTFT+graphics},
 tftRotation:{title:'ST7735 · četiri rotacije',hint:hint+' Rotacija mijenja MADCTL i pomake panela, zatim se šalju novi pikseli. Crvena oznaka označava logički gornji lijevi kut. Promijeni pomake u driveru za pokus odrezane slike.',code:pyStart+pyTFT+`while True:
    for rotation in range(4):
        tft.rotation(rotation)
        tft.fill(0)
        tft.fill_rect(0, 0, 18, 18, 0xf800)
        tft.rect(0, 0, 128, 128, 0xffff)
        tft.text("ROT %d" % rotation, 30, 48, 0x07e0, 2)
        print("TFT ROT=%d" % rotation)
        sleep_ms(900)
`},
 bmp280SPI:{title:'BMP280 · mjerenje preko SPI-ja',hint:hint+' Driver čita ID 0x58, 24 kalibracijska bajta, pokreće forced pretvorbu i računa temperaturu/tlak iz sirovih registara. SPI nema ACK; odspojeni MISO daje 0xFF.',code:pyStart+pySensor+`while True:
    temperature, pressure = sensor.read()
    print("BMP280 SPI T=%.2f P=%.0f Pa" % (temperature, pressure))
    sleep_ms(1000)
`},
 spiDashboard:{title:'SPI · BMP280 i TFT na istoj sabirnici',hint:hint+' Ista SCK/MOSI mreža, zasebni CS10/CS7 i MISO samo za BMP280. Klizači okoliša mijenjaju sljedeće mjerenje; tekst na zaslonu nastaje iz očitanih registara.',code:pyStart+pyTFT+pySensor+`tft.fill(0)
tft.text("SPI STANICA", 7, 10, 0x07ff)
while True:
    temperature, pressure = sensor.read()
    tft.fill_rect(0, 35, 128, 64, 0)
    tft.text("%.1f C" % temperature, 8, 40, 0xffe0, 2)
    tft.text("%.1f HPA" % (pressure/100), 8, 74, 0x07e0)
    print("SPI DASH T=%.2f P=%.0f Pa" % (temperature, pressure))
    sleep_ms(1000)
`},
} as const;
const cppStart=`#include <SPI.h>
// Pin brojevi su D oznake Uno/Nano, nisu fizički redni brojevi.
`;
const cppTFT=`#include "lab_st7735.h"
LabST7735 tft(10,9,8);
`;
const cppSensor=`#include "lab_bmp280_spi.h"
LabBMP280SPI sensor(7);
`;
export const arduinoSPIExamples={
 tftGraphics:{...spiExamples.tftGraphics,title:'Arduino · '+spiExamples.tftGraphics.title,code:cppStart+cppTFT+`void setup(){
 Serial.begin(9600);tft.begin();tft.fillScreen(0);
 tft.fillRect(0,0,42,26,0xf800);tft.fillRect(42,0,43,26,0x07e0);tft.fillRect(85,0,43,26,0x001f);
 tft.setCursor(10,38);tft.setTextSize(2);tft.print(F("SPI TFT"));
 tft.drawRect(4,65,120,58,0xffe0);tft.drawLine(5,66,122,121,0x07ff);tft.drawLine(122,66,5,121,0xf81f);
 Serial.println(F("TFT GRAPHICS READY"));
}
void loop(){delay(100);}
`},
 tftRotation:{...spiExamples.tftRotation,title:'Arduino · '+spiExamples.tftRotation.title,code:cppStart+cppTFT+`void setup(){Serial.begin(9600);tft.begin();}
void loop(){for(byte r=0;r<4;r++){
 tft.setRotation(r);tft.fillScreen(0);tft.fillRect(0,0,18,18,0xf800);tft.drawRect(0,0,128,128,0xffff);
 tft.setCursor(30,48);tft.setTextColor(0x07e0);tft.setTextSize(2);tft.print(F("ROT "));tft.print(r);
 Serial.print(F("TFT ROT="));Serial.println(r);delay(900);
}}
`},
 bmp280SPI:{...spiExamples.bmp280SPI,title:'Arduino · '+spiExamples.bmp280SPI.title,code:cppStart+cppSensor+`void setup(){Serial.begin(9600);if(!sensor.begin()){Serial.println(F("BMP280 SPI ID/SPOJ ERROR"));while(true)delay(100);}}
void loop(){float t,p;if(sensor.read(t,p)){Serial.print(F("BMP280 SPI T="));Serial.print(t,2);Serial.print(F(" P="));Serial.print(p,0);Serial.println(F(" Pa"));}delay(1000);}
`},
 spiDashboard:{...spiExamples.spiDashboard,title:'Arduino · '+spiExamples.spiDashboard.title,code:cppStart+cppTFT+cppSensor+`void setup(){
 Serial.begin(9600);digitalWrite(7,HIGH);pinMode(7,OUTPUT);tft.begin();
 if(!sensor.begin()){Serial.println(F("BMP280 SPI ID/SPOJ ERROR"));while(true)delay(100);}
 tft.fillScreen(0);tft.setCursor(7,10);tft.setTextColor(0x07ff);tft.print(F("SPI STANICA"));
}
void loop(){float t,p;if(sensor.read(t,p)){
 tft.fillRect(0,35,128,64,0);tft.setCursor(8,40);tft.setTextColor(0xffe0);tft.setTextSize(2);tft.print(t,1);tft.print(F(" C"));
 tft.setCursor(8,74);tft.setTextColor(0x07e0);tft.setTextSize(1);tft.print(p/100,1);tft.print(F(" HPA"));
 Serial.print(F("SPI DASH T="));Serial.print(t,2);Serial.print(F(" P="));Serial.print(p,0);Serial.println(F(" Pa"));
}delay(1000);}
`},
} as const;
