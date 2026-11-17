// MIT · ESP32 MicroPython Lab · XPT2046 teaching driver 1.0.0.
// 12-bit differential SPI, 24 clocks/conversion. No full framebuffer.
#pragma once
#include <Arduino.h>
#include <SPI.h>
class LabXPT2046 {
  uint8_t cs;
  uint16_t read(uint8_t command){
    SPI.beginTransaction(SPISettings(1000000,MSBFIRST,SPI_MODE0));
    digitalWrite(cs,LOW);SPI.transfer(command);
    uint16_t value=(uint16_t)SPI.transfer(0)<<8;value|=SPI.transfer(0);
    digitalWrite(cs,HIGH);SPI.endTransaction();return value>>3;
  }
 public:
  struct Raw {uint16_t x,y,z1,z2;};
  struct Point {int16_t x,y;uint16_t z;};
  LabXPT2046(uint8_t pin):cs(pin){}
  void begin(){digitalWrite(cs,HIGH);pinMode(cs,OUTPUT);SPI.begin();}
  Raw raw(){Raw r;r.x=read(0xd0);r.y=read(0x90);r.z1=read(0xb0);r.z2=read(0xc0);return r;}
  static bool valid(const Raw &r){return r.x<=4095&&r.y<=4095&&r.z1>0&&r.z1<=4095&&r.z2>=r.z1&&r.z2<=4095&&r.z1+4095-r.z2>=300;}
  // Reversed endpoints supported. Values are bounded before narrowing to int16.
  static bool calibrate(const Raw &r,Point &p,uint8_t rot=0,int16_t x0=200,int16_t x1=3900,int16_t y0=250,int16_t y1=3850){
    if(rot>3||x0==x1||y0==y1)return false;
    long x=((long)r.x-x0)*239/(x1-x0),y=((long)r.y-y0)*319/(y1-y0);
    x=constrain(x,0L,239L);y=constrain(y,0L,319L);
    if(rot==1){p.x=y;p.y=239-x;}else if(rot==2){p.x=239-x;p.y=319-y;}else if(rot==3){p.x=319-y;p.y=x;}else{p.x=x;p.y=y;}
    p.z=r.z1+4095-r.z2;return true;
  }
  bool point(Point &p,uint8_t rot=0,int16_t x0=200,int16_t x1=3900,int16_t y0=250,int16_t y1=3850){
    Raw r=raw();if(!valid(r))return false;return calibrate(r,p,rot,x0,x1,y0,y1);
  }
};
