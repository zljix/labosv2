// MIT. Standard NEC: 8-bit address + inverse, command + inverse, LSB first.
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
