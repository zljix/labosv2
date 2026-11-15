// MIT. Explicit pins, bounded buffers, two independent functional I2C controllers.
#pragma once
#include <Arduino.h>
class TwoWire:public Print {
 uint8_t bus,address=0;int sda=-1,scl=-1;uint32_t frequency=100000;
 uint8_t tx[128],rx[128];size_t used=0,length=0,at=0;bool overflow=false;
 public:
 explicit TwoWire(uint8_t id):bus(id){}
 bool begin(int=-1,int=-1,uint32_t=100000);
 bool end();
 bool setClock(uint32_t);
 void beginTransmission(uint8_t addr){address=addr;used=0;overflow=false;}
 using Print::write;
 size_t write(uint8_t) override;
 uint8_t endTransmission(bool=true);
 size_t requestFrom(uint8_t,size_t,bool=true);
 int available(){return length-at;}
 int read(){return at<length?rx[at++]:-1;}
 int peek(){return at<length?rx[at]:-1;}
};
extern TwoWire Wire;
extern TwoWire Wire1;
