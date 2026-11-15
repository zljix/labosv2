import {environmentCircuit,arduinoEnvironmentExamples} from '../circuit/environmentExamples';
import {oneWireCircuit,arduinoOneWireExamples} from '../circuit/oneWireExamples';
import {tmCircuit,arduinoTMExamples,cppTM1637} from '../circuit/tm1637Examples';
import {iliCircuit,arduinoILIExamples,cppILI9341} from '../circuit/ili9341Examples';
import {touchCircuit,arduinoTouchExamples} from '../circuit/touchExamples';
import {cppXPT2046} from '../circuit/touchDriver';
import {AVR_LIBRARY_FILE,libraryManifest} from '../../public/avr-contract.mjs';
import type {Project} from '../project/model';

export const cppS3ILI9341=cppILI9341.replace('#include <avr/pgmspace.h>','#include <pgmspace.h>')
 .replace('while(n--){SPI.transfer(color>>8);SPI.transfer(color&255);}',
 'uint8_t block[256];for(int i=0;i<256;i+=2){block[i]=color>>8;block[i+1]=color&255;}while(n){uint32_t take=min((uint32_t)128,n);SPI.writeBytes(block,take*2);n-=take;}');
const i2c=(key:'bmp180'|'bmp280'|'am2320')=>arduinoEnvironmentExamples[key].code
 .replace('#include <LabI2CSensors.h>','#include <Wire.h>\n#include <LabI2CSensors.h>')
 .replace('Serial.begin(9600);','Serial.begin(9600);Wire.begin(8,9,100000);');
const tm=(key:'tmSegments'|'tmClock')=>arduinoTMExamples[key].code
 .replace('// CLK=D2, DIO=D3. VCC i LV na 5 V, GND zajednicki.','// S3: CLK=GPIO4, DIO=GPIO5, VCC=5 V, LV=3V3 i zajednicki GND.')
 .replace('LabTM1637 prikaz(2, 3);','LabTM1637 prikaz(4, 5);');
const ili=(key:'iliGraphics'|'iliRotation')=>arduinoILIExamples[key].code
 .replace('// D oznake Uno/Nano. Slika je u RAM-u kontrolera, ne u 2 KB MCU SRAM-a.','// S3 GPIO: SCK12/MOSI11/MISO13, CS10/DC9/RESET8; BL=3V3.')
 .replace('Serial.begin(9600);','Serial.begin(9600);digitalWrite(10,HIGH);pinMode(10,OUTPUT);SPI.begin(12,13,11);');
const touch=(key:'touchRaw'|'touchCalibration'|'touchRotation')=>arduinoTouchExamples[key].code
 // Espressif Arduino.h includes math.h, whose global y0/y1 functions would
 // collide with the original AVR calibration variables. Keep both exports
 // and simulation on the same explicitly named calibration source.
 .replace(/\b[xy][01]\b/g,name=>'cal'+name.toUpperCase())
 .replace('void beginDevices(){','void beginDevices(){\n // S3: izriciti SPI pinovi; oba CS HIGH prije inicijalizacije.\n digitalWrite(10,HIGH);pinMode(10,OUTPUT);digitalWrite(7,HIGH);pinMode(7,OUTPUT);\n SPI.begin(12,13,11);');
const touchHint='S3: ILI9341 i XPT2046 dijele SCK12/MOSI11/MISO13, zasebni CS10/7, TFT DC9/RESET8, opcionalni IRQ2. VCC/logika/BL=3V3 i zajednički GND. Vidljivi driveri primaju 12-bitne X/Y/Z1/Z2 podatke kroz SPI; kalibracija i rotacija računaju se u programu. Z nije sila. Lab krajevi 200–3900/250–3850 nisu univerzalna fizička kalibracija. ';
export const s3CompletionExamples={
 bmp180:{title:'S3 C++ · BMP180 pojedinačno',hint:'GPIO8/9, VCC=3V3 i GND. LabI2CSensors čita BMP180 kalibraciju i odvojene pretvorbe, zatim računa °C/Pa. Wire.begin ima izričite pinove. Nevaljan prijenos ne ispisuje lažno mjerenje.',code:i2c('bmp180')},
 bmp280:{title:'S3 C++ · BMP280 pojedinačno I2C',hint:'GPIO8/9, VCC=3V3 i GND, adresa 0x76. Zaključani LabI2CSensors čita kalibraciju, forced uzorak i računa °C/Pa. Za SPI koristi zaseban BMP280 SPI primjer. Nema mjerenja vlage ni IIR filtra.',code:i2c('bmp280')},
 am2320:{title:'S3 C++ · AM2320 pojedinačno',hint:'GPIO8/9, 100 kHz, VCC=3V3 i GND, adresa 0x5C. Očekivani NACK pri buđenju, početno čekanje, zaglavlje i CRC. Razmak 2,1 s; model vraća prethodni uzorak pa okoliš djeluje s odgodom.',code:i2c('am2320')},
 ds18Errors:{title:'S3 C++ · DS18B20 svježina i CRC',hint:'DQ=GPIO4, VDD=3V3 i GND; jedan vanjski 4,7 kΩ DQ–3V3. OneWire 2.3.8 / DallasTemperature 4.0.6. Program pokazuje početnih 85 °C, stari registar prije dovršetka i novi nakon 750 ms. CRC ne dokazuje svježinu. Pogrešan CRC/odspojeni DQ daju nevaljan rezultat, ne 0 °C.',code:arduinoOneWireExamples.ds18Errors.code.replace('OneWire bus(2);','OneWire bus(4);').replace('VDD=5 V, GND, DQ=D2; jedan vanjski 4,7 kOhm DQ-5 V.','VDD=3,3 V, GND, DQ=GPIO4; jedan vanjski 4,7 kOhm DQ-3,3 V.')},
 tmSegments:{title:'S3 C++ · TM1637 segmentni bajtovi',hint:'CLK4/DIO5, VCC=5 V, LV=3V3, GND. LV je izričiti idealni prilagodnik Lab profila. Vidljivi lab_tm1637.h šalje LSB prvo, čita deveti ACK takt i pali bitove segmenata. Bit7 druge znamenke daje dvotočku; to nije I2C.',code:tm('tmSegments')},
 tmClock:{title:'S3 C++ · TM1637 programske minute i sekunde',hint:'CLK4/DIO5, VCC=5 V, LV=3V3, GND. Brojilo počinje na 12:34, mijenja dvotočku svakih 500 ms i sekundu svake petlje. Ovo nije RTC. Vidljivi GPIO driver šalje stvarne segmentne bajtove s ACK-om.',code:tm('tmClock')},
 iliGraphics:{title:'S3 C++ · ILI9341 boje, tekst i geometrija',hint:touchHint+' Ovaj primjer nema dodirni kontroler. RGB565, stvarni prozorski upisi i piksel (239,319); vidljivi driver koristi 256 B blok bez punog framebuffera.',code:ili('iliGraphics')},
 iliRotation:{title:'S3 C++ · ILI9341 četiri rotacije',hint:touchHint+' Ovaj primjer nema dodirni kontroler. MADCTL daje logičkih 240×320 ili 320×240 bez ST7735 pomaka; crveni kut prati rotaciju.',code:ili('iliRotation')},
 touchRaw:{title:'S3 C++ · XPT2046 sirovi podaci',hint:touchHint+' Usporedi sirove koordinate, Z1/Z2 i aktivni LOW IRQ s pritiskom i otpuštanjem. Sirovi brojevi nisu zaslonski pikseli.',code:touch('touchRaw')},
 touchCalibration:{title:'S3 C++ · XPT2046 kalibracija u dvije točke',hint:touchHint+' Dodirni i drži prvi križić (20,20), otpusti pa drugi (219,299) i otpusti. Program računa krajeve i kalibrirani položaj; pogrešne točke traže novi Run. Dvije točke ne rješavaju smicanje fizičkog panela.',code:touch('touchCalibration')},
 touchRotation:{title:'S3 C++ · XPT2046 četiri rotacije',hint:touchHint+' Svaki novi pritisak računa položaj u trenutačnoj rotaciji pa bira sljedeću. Držanje i povlačenje nisu novi pritisak. Otpusti prije idućeg dodira.',code:touch('touchRotation')},
} as const;
export function attachS3CompletionExample(p:Project,key:string){
 if(!(key in s3CompletionExamples))return;
 if(key==='bmp180'||key==='bmp280'||key==='am2320'){
  p.circuit=environmentCircuit(key);p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'LabI2CSensors',version:'1.0.0'}]);
 }else if(key==='ds18Errors'){
  p.circuit=oneWireCircuit(key);p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'OneWire',version:'2.3.8'},{name:'DallasTemperature',version:'4.0.6'}]);
 }else if(key==='tmSegments'||key==='tmClock'){
  p.circuit=tmCircuit(key);p.files['lab_tm1637.h']=cppTM1637;
 }else{
  p.circuit=key==='iliGraphics'||key==='iliRotation'?iliCircuit(key):touchCircuit(key as 'touchRaw'|'touchCalibration'|'touchRotation');
  p.files['lab_ili9341.h']=cppS3ILI9341;if(key.startsWith('touch'))p.files['lab_xpt2046.h']=cppXPT2046;
 }
}

