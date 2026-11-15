// MIT. Portable visible Wire driver; one six-byte buffer, no large AVR array.
export const cppMAX30102=`#pragma once
#include <Arduino.h>
#include <Wire.h>
class LabMAX30102 {
 TwoWire &bus;uint8_t channels=2;static const uint8_t address=0x57;
 public:
 explicit LabMAX30102(TwoWire &w=Wire):bus(w){}
 bool get(uint8_t reg,uint8_t *data,uint8_t count=1){
  bus.beginTransmission(address);bus.write(reg);
  if(bus.endTransmission(false)!=0)return false;
  if(bus.requestFrom(address,count)!=count)return false;
  for(uint8_t i=0;i<count;i++)data[i]=bus.read();return true;
 }
 bool put(uint8_t reg,uint8_t value){bus.beginTransmission(address);bus.write(reg);bus.write(value);return bus.endTransmission()==0;}
 bool begin(){uint8_t id;return get(0xff,&id)&&id==0x15;}
 bool clearFIFO(){
  bus.beginTransmission(address);bus.write((uint8_t)4);bus.write((uint8_t)0);bus.write((uint8_t)0);bus.write((uint8_t)0);
  if(bus.endTransmission()!=0)return false;uint8_t status;return get(0,&status);
 }
 bool configure(uint8_t mode=3,uint8_t average=1){
  uint8_t shift=0;while(shift<5&&(1<<shift)!=average)shift++;
  if((mode!=2&&mode!=3)||(1<<shift)!=average||!put(9,0x40))return false;
  uint32_t start=millis();uint8_t config;
  do {delay(1);if(!get(9,&config)||uint32_t(millis()-start)>100)return false;}while(config&0x40);
  channels=mode==2?1:2;
  return put(8,shift<<5)&&put(10,0x27)&&put(12,31)&&put(13,31)&&put(9,mode)&&clearFIFO();
 }
 int available(){uint8_t s,p[3];if(!get(0,&s)||!get(4,p,3))return -1;int n=(p[0]-p[2])&31;return n==0&&((s&128)||p[1])?32:n;}
 int overflow(){uint8_t n;return get(5,&n)?n:-1;}
 // 1=sample, 0=empty, -1=communication error. No valid data on failure.
 int read(uint32_t &red,uint32_t &ir){
  int n=available();if(n<=0)return n;uint8_t b[6];if(!get(7,b,channels*3))return -1;
  red=(((uint32_t)b[0]<<16)|((uint32_t)b[1]<<8)|b[2])&0x3ffff;
  ir=channels==1?0:(((uint32_t)b[3]<<16)|((uint32_t)b[4]<<8)|b[5])&0x3ffff;return 1;
 }
 bool shutdown(bool on){uint8_t mode;return get(9,&mode)&&put(9,(mode&7)|(on?128:0));}
};
`;
