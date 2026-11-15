// MIT · Lab BMP280 4-wire SPI 1.0.0; Bosch integer compensation.
#pragma once
#include <Arduino.h>
#include <SPI.h>
class LabBMP280SPI {
  uint8_t cs;bool ready=false;int32_t c[12];
  bool put(uint8_t reg,uint8_t value){SPI.beginTransaction(SPISettings(1000000,MSBFIRST,SPI_MODE0));digitalWrite(cs,LOW);SPI.transfer(reg&127);SPI.transfer(value);digitalWrite(cs,HIGH);SPI.endTransaction();return true;}
  bool get(uint8_t reg,uint8_t *buf,uint8_t n){SPI.beginTransaction(SPISettings(1000000,MSBFIRST,SPI_MODE0));digitalWrite(cs,LOW);SPI.transfer(reg|128);while(n--)*buf++=SPI.transfer(0);digitalWrite(cs,HIGH);SPI.endTransaction();return true;}
 public:
  LabBMP280SPI(uint8_t select):cs(select){}
  bool begin();
  bool read(float &temperature,float &pressure);
};
bool LabBMP280SPI::begin() {
  ready=false;digitalWrite(cs,HIGH);pinMode(cs,OUTPUT);SPI.begin();delay(5);uint8_t id,b[24];
  if(!get(0xd0,&id,1)||id!=0x58||!put(0xe0,0xb6))return false;
  delay(5);if(!get(0x88,b,24))return false;
  for(uint8_t i=0;i<12;i++){uint16_t v=((uint16_t)b[2*i]|((uint16_t)b[2*i+1]<<8));c[i]=(i==0||i==3)?(int32_t)v:(int32_t)(int16_t)v;}
  if(!put(0xf5,0))return false; // IIR off, I2C profile
  return ready=c[3]!=0;
}
bool LabBMP280SPI::read(float &temperature,float &pressure) {
  if(!ready||!put(0xf4,0x25))return false; // temperature x1, pressure x1, forced
  delay(8);uint8_t b[6];if(!get(0xf7,b,6))return false;
  int32_t ap=((uint32_t)b[0]<<12)|((uint16_t)b[1]<<4)|(b[2]>>4);
  int32_t at=((uint32_t)b[3]<<12)|((uint16_t)b[4]<<4)|(b[5]>>4);
  if(ap==0x80000||at==0x80000)return false;
  int32_t v1=(((at>>3)-c[0]*2)*c[1])>>11;
  int32_t v2=(((((at>>4)-c[0])*((at>>4)-c[0]))>>12)*c[2])>>14;
  int32_t fine=v1+v2;temperature=((fine*5+128)>>8)/100.0f;
  int64_t x=fine-128000,y=x*x*c[8];
  y+=x*c[7]*131072;y+=(int64_t)c[6]*34359738368LL;
  x=((x*x*c[5])>>8)+x*c[4]*4096;
  x=(((1LL<<47)+x)*c[3])>>33;if(!x)return false;
  int64_t p=1048576-ap;p=(((p<<31)-y)*3125)/x;
  x=((int64_t)c[11]*(p>>13)*(p>>13))>>25;y=((int64_t)c[10]*p)>>19;
  p=((p+x+y)>>8)+(int64_t)c[9]*16;
  pressure=p/256.0f;return true;
}
