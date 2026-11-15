import {opticalCircuit,arduinoOpticalExamples,s3OpticalExamples,type OpticalExample} from '../circuit/max30102Examples';
import {cppMAX30102} from '../circuit/max30102Driver';
import {s3SDExamples,sdCircuit,type SDExample} from '../circuit/sdExamples';
import {cppSD} from '../circuit/sdDriver';
import {s3RTCExamples,rtcCircuit,type RTCExample} from '../circuit/rtcExamples';
import {cppDS1302} from '../circuit/rtcDriver';
import {cppTM1637} from '../circuit/tm1637Examples';
import {S3} from '../boards/profiles';
import {newProject} from '../project/model';
import {exampleCircuit} from '../circuit/examples';
import {peripheralCircuit} from '../circuit/peripheralExamples';
import {environmentCircuit} from '../circuit/environmentExamples';
import {actuatorCircuit} from '../circuit/actuatorExamples';
import {displayCircuit} from '../circuit/displayExamples';
import {touchCircuit,arduinoTouchExamples} from '../circuit/touchExamples';
import {cppILI9341} from '../circuit/ili9341Driver';
import {cppXPT2046} from '../circuit/touchDriver';
import {AVR_LIBRARY_FILE,libraryManifest} from '../../public/avr-contract.mjs';
import {S3_BUILD_FILE,validateArtifact} from '../../public/s3-contract.mjs';
import {runtimeAsset} from '../platform/assets';
import {s3LibraryExamples,attachS3LibraryExample} from './s3LibraryExamples';
import {s3AnalogExamples,attachS3AnalogExample} from './s3AnalogExamples';
import {s3ControlExamples,attachS3ControlExample} from './s3ControlExamples';
import {s3ProtocolExamples,attachS3ProtocolExample} from './s3ProtocolExamples';
import {s3CompletionExamples,attachS3CompletionExample} from './s3CompletionExamples';
export const s3Examples={
 blink:{title:'S3 C++ · treptanje i millis()',hint:'GPIO4 → 330 Ω → LED → GND. Stvarni C++ program poziva digitalWrite i delay; millis prati funkcionalno virtualno vrijeme. Nema ugrađene LED L na D13.',code:`void setup(){pinMode(4,OUTPUT);Serial.begin(9600);}
void loop(){digitalWrite(4,HIGH);Serial.print("S3 LED=1 ms=");Serial.println(millis());delay(300);digitalWrite(4,LOW);Serial.print("S3 LED=0 ms=");Serial.println(millis());delay(300);}
`},
 button:{title:'S3 C++ · tipkalo i serijski unos',hint:'GPIO5 je INPUT_PULLUP, tipkalo ga spaja na GND. GPIO4 upravlja LED-icom. Serijski pošalji 1, 0 ili b za povratak tipkalu. Novi ulaz djeluje i tijekom delay() poziva.',code:`int daljinski=-1,prethodno=-1;
void setup(){Serial.begin(9600);pinMode(5,INPUT_PULLUP);pinMode(4,OUTPUT);Serial.println("S3 READY 1/0/b");}
void loop(){if(Serial.available()){char c=Serial.read();if(c=='1')daljinski=1;if(c=='0')daljinski=0;if(c=='b')daljinski=-1;}int state=daljinski<0?digitalRead(5)==LOW:daljinski;digitalWrite(4,state);if(state!=prethodno){Serial.print("S3 LED=");Serial.println(state);prethodno=state;}delay(20);}
`},
 adc:{title:'S3 C++ · ADC i PWM',hint:'Potenciometar je na 3V3/GND, klizač na GPIO1. Linearni ADC: 12 bita, 11 dB, zasićenje 3,1 V. Vrijednost 0–4095 mapira se na PWM 0–255 na GPIO4. Ovo nije hardverska kalibracija ADC-a.',code:`void setup(){Serial.begin(9600);analogReadResolution(12);analogSetPinAttenuation(1,ADC_11db);}
void loop(){int value=analogRead(1);int duty=map(value,0,4095,0,255);analogWrite(4,duty);Serial.print("S3 ADC=");Serial.print(value);Serial.print(" PWM=");Serial.println(duty);delay(100);}
`},
 regulator:{title:'S3 C++ · AHT10 → OLED → servo',hint:'Wire: AHT10 SDA8/SCL9; Wire1: OLED SDA10/SCL11. LabAHT10 čita stvarne I2C podatke. Vidljivi mali OLED driver šalje piksele. LEDC na GPIO4 stvara 50 Hz servo impuls 500–2500 µs: otvara na 28 °C, zatvara na 26 °C.',code:`#include <Wire.h>
#include <LabAHT10.h>
#include "lab_oled.h"
LabAHT10 sensor;LabOLED oled(Wire1);bool opened=false;
void setup(){Serial.begin(9600);Wire.begin(8,9,100000);Wire1.begin(10,11,400000);if(!sensor.begin())Serial.println("AHT ERROR");oled.begin();if(!ledcAttach(4,50,14))Serial.println("PWM ERROR");}
void loop(){float t,h;if(!sensor.read(t,h)){Serial.println("AHT READ ERROR");delay(1000);return;}if(t>=28)opened=true;else if(t<=26)opened=false;int pulse=opened?1500:500;ledcWrite(4,(uint32_t)pulse*16383/20000);oled.clear();oled.setCursor(0,0);oled.print("T:");oled.print(t,1);oled.print(" C");oled.setCursor(0,16);oled.print("RH:");oled.print(h,1);oled.print("%");oled.bar(h);oled.show();Serial.print("S3 T=");Serial.print(t);Serial.print(" RH=");Serial.print(h);Serial.print(" SERVO=");Serial.println(opened?90:0);delay(1900);}
`},
 sensors:{title:'S3 C++ · BMP180, BMP280 i AM2320',hint:'Zajednički Wire na GPIO8/9. Tri stvarna drivera LabI2CSensors čitaju registre, kalibraciju i CRC. OLED 0x3C prikazuje BMP280 T/P kroz vidljivi driver. AM2320 namjerno vraća prethodni uzorak; razmak 2 s.',code:`#include <Wire.h>
#include <LabI2CSensors.h>
#include "lab_oled.h"
LabBMP180 a;LabBMP280 b;LabAM2320 c;LabOLED oled(Wire);
void setup(){Serial.begin(9600);Wire.begin(8,9,100000);a.begin();b.begin();c.begin();oled.begin();}
void loop(){float t,p,h;if(a.read(t,p)){Serial.print("BMP180 ");Serial.print(t);Serial.print(" ");Serial.println(p);}if(b.read(t,p)){Serial.print("BMP280 ");Serial.print(t);Serial.print(" ");Serial.println(p);oled.clear();oled.setCursor(0,0);oled.print("T:");oled.print(t,1);oled.setCursor(0,16);oled.print("P:");oled.print(p/100,1);oled.show();}if(c.read(t,h)){Serial.print("AM2320 ");Serial.print(t);Serial.print(" ");Serial.println(h);}delay(2000);}
`},
 servo:{title:'S3 C++ · SG90 i LEDC impuls',hint:'GPIO6, zasebni izvor 5 V i zajednička masa. Profil 1000–2000 µs daje 0–180°. LEDC API radi po priključku (Arduino-ESP32 3.x stil); Servo AVR biblioteka ovdje nije podržana.',code:`void setup(){Serial.begin(9600);if(!ledcAttach(6,50,14))Serial.println("LEDC ERROR");}
void loop(){for(int angle=0;angle<=180;angle+=90){int pulse=1000+angle*1000/180;ledcWrite(6,(uint32_t)pulse*16383/20000);Serial.print("S3 SG90=");Serial.println(angle);delay(600);}}
`},
 lcd:{title:'S3 C++ · LCD1602 i vlastiti znak',hint:'LabLCD1602 i Wire koriste GPIO8/9, 100 kHz. VCC=5 V, LV=3V3; potreban je izričiti profil backpacka s prilagodbom. Tekst i CGRAM nastaju iz PCF8574 prijenosa.',code:`#include <Wire.h>
#include <LabLCD1602.h>
LabLCD1602 lcd;unsigned count=0;
void setup(){Serial.begin(9600);Wire.begin(8,9,100000);if(!lcd.begin())Serial.println("LCD ERROR");const uint8_t smile[8]={0,10,10,0,17,14,0,0};lcd.createChar(0,smile);lcd.setCursor(0,0);lcd.print("S3 C++ LAB ");lcd.write((uint8_t)0);}
void loop(){lcd.setCursor(0,1);lcd.print("COUNT ");lcd.print(count);lcd.print("     ");Serial.println(count++);delay(1000);}
`},
 touch:{title:'S3 C++ · TFT dodir upravlja LED-icom',hint:'ILI9341 i XPT2046 dijele SCK12/MOSI11/MISO13; CS10 i CS7 su zasebni. Program čita 12-bitni dodir, kalibrira X/Y i tek nakon hit-testa uključuje GPIO4. BL=3V3; kratki dodir može promaknuti polling petlji.',code:arduinoTouchExamples.touchButton.code.replace('void beginDevices(){','void beginDevices(){\n SPI.begin(12,13,11);').replaceAll('pinMode(6,OUTPUT)','pinMode(4,OUTPUT)').replaceAll('digitalWrite(6,','digitalWrite(4,')},
 ...s3LibraryExamples,
 ...s3AnalogExamples,
 ...s3ControlExamples,
 ...s3ProtocolExamples,
 ...s3CompletionExamples,
 ...s3OpticalExamples,
 ...s3SDExamples,
 ...s3RTCExamples,
} as const;
export type S3Example=keyof typeof s3Examples;
export const cppOLED=`// MIT. Small 128x64 SSD1306 driver; explicit I2C bytes, digit/T/R/H/P/C font.
#pragma once
#include <Wire.h>
class LabOLED:public Print {
 TwoWire &bus;uint8_t buffer[1024];int x=0,y=0;
 void command(uint8_t c){bus.beginTransmission(0x3c);bus.write((uint8_t)0);bus.write(c);bus.endTransmission();}
 public:
 explicit LabOLED(TwoWire &w):bus(w){}
 void begin(){const uint8_t init[]={0xae,0x20,0,0x40,0xa1,0xc8,0xa8,63,0xd3,0,0xda,0x12,0xd5,0x80,0xd9,0xf1,0xdb,0x30,0x81,0xff,0xa4,0xa6,0x8d,0x14,0xaf};for(uint8_t c:init)command(c);clear();show();}
 void clear(){memset(buffer,0,sizeof(buffer));}
 void setCursor(int a,int b){x=a;y=b;}
 void bar(float value){int n=constrain((int)(value*1.24f),0,124);for(int row=50;row<58;row++)for(int col=2;col<2+n;col++)buffer[(row/8)*128+col]|=1<<(row%8);}
 using Print::write;
 size_t write(uint8_t c) override {const char chars[]="0123456789TRHPC.:%- ";const uint8_t font[][5]={{62,81,73,69,62},{0,66,127,64,0},{66,97,81,73,70},{65,73,73,73,54},{24,20,18,127,16},{39,69,69,69,57},{60,74,73,73,48},{1,113,9,5,3},{54,73,73,73,54},{6,73,73,41,30},{1,1,127,1,1},{127,9,25,41,70},{127,8,8,8,127},{127,9,9,9,6},{62,65,65,65,65},{0,96,96,0,0},{0,54,54,0,0},{99,19,8,100,99},{8,8,8,8,8},{0,0,0,0,0}};int i=19;for(int k=0;k<20;k++)if(chars[k]==c){i=k;break;}for(int col=0;col<5;col++)for(int row=0;row<7;row++){int px=x+col,py=y+row;if(px>=0&&px<128&&py>=0&&py<64&&(font[i][col]&(1<<row)))buffer[(py/8)*128+px]|=1<<(py%8);}x+=6;return 1;}
 void show(){command(0x21);command(0);command(127);command(0x22);command(0);command(7);for(int i=0;i<1024;i+=32){bus.beginTransmission(0x3c);bus.write((uint8_t)0x40);bus.write(buffer+i,32);bus.endTransmission();}}
};
`;
export function s3ExampleProject(key:S3Example){
 const e=s3Examples[key],p=newProject(e.code,e.title,S3,'arduino-cpp');p.settings.example='s3-'+key;
 if(key==='blink'||key==='button'||key==='adc')p.circuit=exampleCircuit(key==='adc'?'pwm':key);
 if(key==='regulator'){p.circuit=peripheralCircuit();p.files['lab_oled.h']=cppOLED;p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'LabAHT10',version:'1.0.0'}]);}
 if(key==='sensors'){p.circuit=environmentCircuit('weather');p.files['lab_oled.h']=cppOLED;p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'LabI2CSensors',version:'1.0.0'}]);}
 if(key==='servo')p.circuit=actuatorCircuit('sg90Sweep');
 if(key==='lcd'){p.circuit=displayCircuit('lcd1602');p.files[AVR_LIBRARY_FILE]=libraryManifest([{name:'LabLCD1602',version:'1.0.0'}]);}
 if(key==='touch'){p.circuit=touchCircuit('touchButton');p.files['lab_ili9341.h']=cppILI9341.replace('#include <avr/pgmspace.h>','#include <pgmspace.h>').replace('while(n--){SPI.transfer(color>>8);SPI.transfer(color&255);}', 'uint8_t block[256];for(int i=0;i<256;i+=2){block[i]=color>>8;block[i+1]=color&255;}while(n){uint32_t take=min((uint32_t)128,n);SPI.writeBytes(block,take*2);n-=take;}');p.files['lab_xpt2046.h']=cppXPT2046;}
 if(key in s3OpticalExamples){p.circuit=opticalCircuit(key as OpticalExample);p.files['lab_max30102.h']=cppMAX30102;}
 if(key in s3SDExamples){p.circuit=sdCircuit(key as SDExample);p.files['lab_sd.h']=cppSD;if(key==='sdLogger')p.files['lab_ds1302.h']=cppDS1302;}
 if(key in s3RTCExamples){p.circuit=rtcCircuit(key as RTCExample);p.files['lab_ds1302.h']=cppDS1302;if(key==='rtcClock')p.files['lab_tm1637.h']=cppTM1637;}
 attachS3LibraryExample(p,key);
 attachS3AnalogExample(p,key);
 attachS3ControlExample(p,key);
 attachS3ProtocolExample(p,key);
 attachS3CompletionExample(p,key);
 return p;
}
export async function loadS3Example(key:S3Example){const p=s3ExampleProject(key),r=await fetch(runtimeAsset('s3-examples.json'));if(!r.ok)throw Error('Ne mogu učitati prevedeni S3 primjer.');const a=await validateArtifact(p,(await r.json())[key]);p.files[S3_BUILD_FILE]=JSON.stringify(a);return p;}
