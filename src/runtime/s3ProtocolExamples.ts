import {irCircuit,type IRExample} from '../circuit/irExamples';
import {spiCircuit,arduinoSPIExamples,type SPIExample} from '../circuit/spiExamples';
import {cppST7735,cppBMP280SPI} from '../circuit/spiDrivers';
import type {Project} from '../project/model';

// MIT. Visible polling source; no interrupt emulation or decoded model input.
export const cppS3NEC=`// MIT. Standard NEC: 8-bit address + inverse, command + inverse, LSB first.
#pragma once
#include <Arduino.h>
class LabS3NEC {
  uint8_t pin,state=0,bits=0,address=0,command=0;
  uint32_t raw=0,edgeAt=0,lastAt=0;
  bool previous=true,haveLast=false,ready=false,repeated=false;
  static bool mark(uint32_t us){return us>=350&&us<=850;}
  void fail(){errors++;state=0;haveLast=false;}
  void edge(bool high,uint32_t now) {
    uint32_t us=now-edgeAt;edgeAt=now;
    if(high) {
      if(us>=6500&&us<=11000){state=1;leaderUs=us;return;}
      if((state==2||state==4||state==5)&&mark(us)) {
        bitMarkUs=us;
        if(state==2){state=3;return;}
        if(state==4){
          if(haveLast&&(uint32_t)(now-lastAt)<=150000){repeated=true;ready=true;lastAt=now;received++;}
          state=0;return;
        }
        uint8_t a=raw,ia=raw>>8,c=raw>>16,ic=raw>>24;
        if((uint8_t)(a^ia)==255&&(uint8_t)(c^ic)==255) {
          address=a;command=c;haveLast=true;lastAt=now;repeated=false;ready=true;received++;
        }else {fail();return;}
        state=0;return;
      }
    }else {
      if(state==1) {
        if(us>=3500&&us<=5500){state=2;bits=0;raw=0;return;}
        if(us>=1600&&us<=2900){state=4;return;}
      }else if(state==3) {
        if(us>=1200&&us<=2100)raw|=(uint32_t)1<<bits;
        else if(!mark(us)){fail();return;}
        bitSpaceUs=us;bits++;state=bits==32?5:2;return;
      }else if(state==0)return;
    }
    if(state||(high&&us>850))fail();
  }
public:
  uint16_t errors=0,leaderUs=0,bitMarkUs=0,bitSpaceUs=0,received=0;
  explicit LabS3NEC(uint8_t rx):pin(rx){}
  void begin(){pinMode(pin,INPUT);previous=digitalRead(pin);edgeAt=micros();}
  bool read(uint8_t &a,uint8_t &cmd,bool &repeat) {
    // Idle window 12 ms; once a leader starts, keep polling through the frame.
    // 25 us sampling is explicit. A slow caller can lose complete frames.
    uint32_t start=micros();
    while((uint32_t)(micros()-start)<100000) {
      bool high=digitalRead(pin);uint32_t now=micros();
      if(high!=previous){previous=high;edge(high,now);}
      if(ready){a=address;cmd=command;repeat=repeated;ready=false;return true;}
      if((state||!high)&&(uint32_t)(now-edgeAt)>12000){fail();return false;}
      if(!state&&high&&(uint32_t)(now-start)>=12000)return false;
      delayMicroseconds(25);
    }
    fail();return false;
  }
};
// LEDC 38 kHz, 85/255 duty. Blocking send: no simultaneous polling receive.
class LabS3NECSender {
  uint8_t pin;
  void mark(uint16_t us){ledcWrite(pin,85);delayMicroseconds(us);ledcWrite(pin,0);}
public:
  explicit LabS3NECSender(uint8_t tx):pin(tx){}
  bool begin(){return ledcAttach(pin,38000,8)&&ledcWrite(pin,0);}
  void repeat(){mark(9000);delayMicroseconds(2250);mark(562);}
  void send(uint8_t a,uint8_t cmd,uint8_t repeats=0) {
    uint32_t start=micros();
    uint8_t bytes[4]={a,(uint8_t)~a,cmd,(uint8_t)~cmd};
    mark(9000);delayMicroseconds(4500);
    for(uint8_t b:bytes)for(uint8_t bit=0;bit<8;bit++){
      mark(562);delayMicroseconds((b&(1<<bit))?1688:562);
    }
    mark(562);repeats=min(repeats,(uint8_t)18);
    for(uint8_t n=0;n<repeats;n++){
      uint32_t target=(uint32_t)(n+1)*110000UL;
      while(true) {
        uint32_t elapsed=(uint32_t)(micros()-start);if(elapsed>=target)break;
        uint32_t left=target-elapsed;
        if(left>2)delayMicroseconds((unsigned int)min(left,(uint32_t)60000));
      }
      repeat();
    }
  }
};
`;

// Same bounded panel profile as MicroPython/AVR. Batch writes avoid one WASM
// host crossing per pixel byte. 256 B buffer, not a 32768 B framebuffer.
export const cppS3ST7735=cppST7735
 .replace('#include <avr/pgmspace.h>','#include <pgmspace.h>')
 .replace('while(n--){SPI.transfer(color>>8);SPI.transfer(color&255);}',
  'uint8_t block[256];for(int i=0;i<256;i+=2){block[i]=color>>8;block[i+1]=color&255;}while(n){uint32_t take=min((uint32_t)128,(uint32_t)n);SPI.writeBytes(block,take*2);n-=take;}');

const irHint='S3: IR VCC=3V3, GND, OUT=GPIO4 (aktivno LOW, 30 kΩ pull-up). Vidljivi lab_s3_nec.h mjeri GPIO bridove uz čekanje 25 µs između očitanja: standardni NEC 8-bit, inverzni bajtovi, repeat do 150 ms. read() traži početak u 12 ms, a započeti okvir prati do kraja, najviše 100 ms. Program s dugim delay() može propustiti okvir. Nema attachInterrupt(), AVR INT0/Timer2 ni opće IRremote podrške.';
const irStart=`#include "lab_s3_nec.h"
LabS3NEC ir(4);
`;
const printFrame=`Serial.print("S3 NEC A=");Serial.print(a);Serial.print(" C=");Serial.print(cmd);Serial.print(" R=");Serial.println(repeat?1:0);`;
const spiHint='S3 SPI: SCK12/MOSI11/MISO13, TFT CS10/DC9/RESET8, BMP280 CS7. VCC/logika/BL=3V3, GND zajednički. CS se najprije postavlja HIGH. SPI.begin(12,13,11) zadaje stvarne GPIO-e. ST7735 je postojeći 128×128 Lab green-tab profil (RGB565, pomaci i četiri rotacije); driver ima 256 B blok bez punog framebuffera. BMP280 čita ID/kalibraciju i računa forced uzorak. SPI nema ACK.';
const spiCode=(key:SPIExample)=>arduinoSPIExamples[key].code
 .replace('// Pin brojevi su D oznake Uno/Nano, nisu fizički redni brojevi.',
  '// S3 GPIO: SCK12/MOSI11/MISO13. Svaki uredjaj ima zaseban CS.')
 .replace('Serial.begin(9600);','Serial.begin(9600);\n // Odabiri su neaktivni prije pokretanja zajednicke sabirnice.\n digitalWrite(10,HIGH);pinMode(10,OUTPUT);digitalWrite(7,HIGH);pinMode(7,OUTPUT);\n SPI.begin(12,13,11);');

export const s3ProtocolExamples={
 irPulses:{title:'S3 C++ · IR NEC trajanja impulsa',hint:irHint+' Ispisuje izmjereni uvod, posljednji bitni impuls i razmak; to nije ispis svih impulsa okvira.',code:irStart+`void setup(){Serial.begin(9600);ir.begin();Serial.println("S3 IR READY");}
void loop(){
 uint8_t a,cmd;bool repeat;
 if(ir.read(a,cmd,repeat)){
  ${printFrame}
  Serial.print("S3 PULSE LEADER=");Serial.print(ir.leaderUs);
  Serial.print(" MARK=");Serial.print(ir.bitMarkUs);
  Serial.print(" SPACE=");Serial.println(ir.bitSpaceUs);
 }
 delay(1);
}
`},
 irNEC:{title:'S3 C++ · NEC adresa, naredba i repeat',hint:irHint+' Nevaljani inverzi/vremena povećavaju errors i brišu povijest ponavljanja; novi valjani okvir obnavlja prijam.',code:irStart+`uint16_t errors=0;
void setup(){Serial.begin(9600);ir.begin();Serial.println("S3 IR READY");}
void loop(){
 uint8_t a,cmd;bool repeat;
 if(ir.read(a,cmd,repeat)){${printFrame}}
 if(ir.errors!=errors){errors=ir.errors;Serial.print("S3 NEC ERROR=");Serial.println(errors);}
 delay(1);
}
`},
 irLED:{title:'S3 C++ · IR upravlja PWM LED-icom',hint:irHint+' LED preko 680 Ω na GPIO7. Adresa 0: POWER69 preklapa samo novi okvir, PLUS70/MINUS21 mijenjaju svjetlinu za 10 % i pri repeat. analogWrite koristi zaseban LEDC izlaz.',code:irStart+`int brightness=0;
void setup(){Serial.begin(9600);ir.begin();analogWrite(7,0);Serial.println("S3 IR READY LED=0");}
void loop(){
 uint8_t a,cmd;bool repeat;
 if(ir.read(a,cmd,repeat)&&a==0){
  if(cmd==69&&!repeat)brightness=brightness?0:50;
  else if(cmd==70)brightness=min(100,brightness+10);
  else if(cmd==21)brightness=max(0,brightness-10);
  else {delay(1);return;} // Nepoznata naredba ne mijenja izlaz.
  analogWrite(7,(long)brightness*255/100);
  Serial.print("S3 LED=");Serial.print(brightness);
  Serial.print(" R=");Serial.println(repeat?1:0);
 }
 delay(1);
}
`},
 irTransmit:{title:'S3 C++ · IR predajnik LEDC 38 kHz',hint:irHint+' Predajnik SIG=GPIO5, VCC=3V3 i GND. LEDC daje 38000 Hz, 85/255 duty. Šalje naredbe 69/70 i po dva repeat okvira, s počecima približno svakih 110 ms. Blokirajući predajnik pokazuje trag uparenog OUT u Mjerenjima; isti program ne dekodira vlastito slanje.',code:`#include "lab_s3_nec.h"
LabS3NECSender tx(5);
uint8_t command=69;
void setup(){
 Serial.begin(9600);
 if(!tx.begin()){Serial.println("S3 IR LEDC ERROR");while(true)delay(100);}
 Serial.println("S3 IR TX READY");
}
void loop(){
 tx.send(0,command,2);
 Serial.print("S3 IR TX A=0 C=");Serial.print(command);Serial.println(" REPEATS=2");
 command=command==69?70:69;delay(1000);
}
`},
 tftGraphics:{title:'S3 C++ · ST7735 boje, tekst i geometrija',hint:spiHint+' Promijeni RGB565 bajtove ili tekst i ponovno prevedi; konzolna poruka ne crta sliku.',code:spiCode('tftGraphics')},
 tftRotation:{title:'S3 C++ · ST7735 četiri rotacije',hint:spiHint+' Logički crveni kut seli se kroz četiri fizička kuta; pomaci panela pripadaju ovom profilu i nisu potvrda svakog fizičkog green-tab modula.',code:spiCode('tftRotation')},
 bmp280SPI:{title:'S3 C++ · BMP280 preko SPI-ja',hint:spiHint+' Odspojeni MISO daje 0xFF i početnu pogrešku ID/SPOJ. Promjena okoliša utječe na sljedeću forced pretvorbu; rezultat je u °C i Pa.',code:spiCode('bmp280SPI')},
 spiDashboard:{title:'S3 C++ · BMP280 → ST7735 instrument',hint:spiHint+' Zajednički SCK/MOSI, zasebni CS10/7. Okoliš mijenja očitane registre, programski izračun i tekstualne piksele.',code:spiCode('spiDashboard')},
} as const;

export function attachS3ProtocolExample(p:Project,key:string){
 if(!(key in s3ProtocolExamples))return;
 if(key.startsWith('ir')){
  p.circuit=irCircuit(key as IRExample);p.files['lab_s3_nec.h']=cppS3NEC;
 }else{
  p.circuit=spiCircuit(key as SPIExample);
  if(key!=='bmp280SPI')p.files['lab_st7735.h']=cppS3ST7735;
  if(key==='bmp280SPI'||key==='spiDashboard')p.files['lab_bmp280_spi.h']=cppBMP280SPI;
 }
}

