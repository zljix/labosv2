import {dhtCircuit,arduinoDHTExamples} from '../circuit/dhtExamples';
import {oneWireCircuit,arduinoOneWireExamples} from '../circuit/oneWireExamples';
import {displayCircuit} from '../circuit/displayExamples';
import type {Project} from '../project/model';
import {AVR_LIBRARY_FILE,libraryManifest} from '../../public/avr-contract.mjs';

const dhtSource=(key:keyof typeof arduinoDHTExamples)=>arduinoDHTExamples[key].code
  .replace('DHT senzor(2,','DHT senzor(4,')
  .replace('VCC=5 V, GND, DATA=D2; vanjski 4,7 kOhm DATA-5 V.','VCC=3,3 V, GND, DATA=GPIO4; vanjski 4,7 kOhm DATA-3,3 V.');
const dsSource=(key:keyof typeof arduinoOneWireExamples)=>arduinoOneWireExamples[key].code
  .replace('OneWire bus(2);','OneWire bus(4);')
  .replace('VDD=5 V, GND, DQ=D2; jedan vanjski 4,7 kOhm DQ-5 V.','VDD=3,3 V, GND, DQ=GPIO4; jedan vanjski 4,7 kOhm DQ-3,3 V.');
const oledSource=(small:boolean)=>`#include <Wire.h>
#include <U8g2lib.h>
// Stvarna U8g2 biblioteka: stranice od 128 B, font 6x10.
// Wire.begin s izricitim pinovima potreban je i za fizicki ESP32 izvoz.
U8G2_SSD1306_${small?'128X32_UNIVISION':'128X64_NONAME'}_1_HW_I2C oled(U8G2_R0,U8X8_PIN_NONE);
unsigned count=0;
void setup(){Serial.begin(9600);Wire.begin(8,9,100000);oled.setBusClock(100000);oled.begin();oled.setFont(u8g2_font_6x10_tf);}
void loop(){oled.firstPage();do{oled.drawStr(0,10,"ESP32-S3 U8g2");oled.setCursor(0,24);oled.print("COUNT ");oled.print(count);oled.drawFrame(100,0,28,${small?32:64});}while(oled.nextPage());Serial.print("S3 OLED${small?32:64} COUNT=");Serial.println(count++);delay(1000);}
`;
export const s3LibraryExamples={
 dht11:{title:'S3 C++ · DHT11 i kontrolni zbroj',hint:'Adafruit DHT 1.4.6: stvarni start i 40 bitova kroz GPIO4. VCC/pull-up=3,3 V; razmak 2,1 s po pravilima biblioteke. GPIO polling koristi funkcionalni µs sat. Fizička DHT11 izvedba može zahtijevati drugi napon.',code:dhtSource('dht11')},
 dht22:{title:'S3 C++ · DHT22 i negativna temperatura',hint:'GPIO4, VCC/pull-up=3,3 V. Stvarna DHT 1.4.6 provjerava peti bajt, predznak i desetinke. Pokušaj −12,3 °C i 67,8 %RH. Unutar 2 s biblioteka vraća predmemorirani rezultat.',code:dhtSource('dht22')},
 dhtErrors:{title:'S3 C++ · DHT22 pogreške i oporavak',hint:'readHumidity(true) pokušava novi prijenos svakih 300 ms. Senzor traži najmanje 2 s; NaN znači nevaljan uzorak. U živim ulazima isprobaj checksum i timeout pa vrati uredan prijenos.',code:dhtSource('dhtErrors')},
 ds18Multi:{title:'S3 C++ · tri DS18B20 na GPIO4',hint:'OneWire 2.3.8 i DallasTemperature 4.0.6 stvarno pretražuju ROM identitete i čitaju scratchpad/CRC. Tri senzora dijele GPIO4 i jedan 4,7 kΩ pull-up na 3,3 V. Početno 25 / −10,125 / 60 °C. Redoslijed ROM pretrage nije redoslijed dodavanja senzora.',code:dsSource('ds18Multi')},
 ds18Resolution:{title:'S3 C++ · DS18B20 razlučivost 9–12 bita',hint:'GPIO4 i 3,3 V s vanjskim pull-upom. Program piše konfiguracijski registar i čeka pretvorbu: 94/188/375/750 ms. Korak 0,5/0,25/0,125/0,0625 °C označava razlučivost. Ne označava točnost senzora.',code:dsSource('ds18Resolution')},
 oled64:{title:'S3 C++ · U8g2 OLED 128 × 64',hint:'Zaključana U8g2 2.37.1: HW I2C GPIO8/9, font 6×10 i stvarni prijenosi stranica. SSD1306 128×64, adresa 0x3C, VCC=3,3 V. Vidljivi pikseli nastaju iz U8g2 C/C++ izvora.',code:oledSource(false)},
 oled32:{title:'S3 C++ · U8g2 OLED 128 × 32',hint:'Zaseban U8g2_12832 2.37.1 paket: SSD1306 UNIVISION, 128×32, multiplex 31 i COM 0x02. GPIO8/9, 0x3C i 3,3 V. Stranični buffer 128 B i font 6×10; nije smanjen crtež 128×64.',code:oledSource(true)},
} as const;
export function attachS3LibraryExample(p:Project,key:string){
 let libraries:{name:string;version:string}[]=[];
 if(key==='dht11'||key==='dht22'||key==='dhtErrors'){p.circuit=dhtCircuit(key);libraries=[{name:'DHT',version:'1.4.6'}];}
 if(key==='ds18Multi'||key==='ds18Resolution'){p.circuit=oneWireCircuit(key);libraries=[{name:'OneWire',version:'2.3.8'},{name:'DallasTemperature',version:'4.0.6'}];}
 if(key==='oled64'||key==='oled32'){const c=displayCircuit('oled32');if(key==='oled64'){const panel=c.components.find(c=>c.id==='display1')!;panel.kind='ssd1306';panel.label='OLED 128×64';}p.circuit=c;libraries=[{name:key==='oled32'?'U8g2_12832':'U8g2',version:'2.37.1'}];}
 if(libraries.length)p.files[AVR_LIBRARY_FILE]=libraryManifest(libraries);
}
