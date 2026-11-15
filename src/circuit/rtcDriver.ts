// MIT. Visible portable DS1302 GPIO driver, 1.0.0.
export const cppDS1302=`#pragma once
#include <Arduino.h>
class LabDS1302 {
 uint8_t ce,io,clk;
 static uint8_t bcd(uint8_t n){return (n/10)*16+n%10;}
 static int dec(uint8_t n){return (n&15)>9||(n>>4)>9?-1:(n>>4)*10+(n&15);}
 void start(){digitalWrite(ce,LOW);digitalWrite(clk,LOW);pinMode(io,OUTPUT);digitalWrite(io,LOW);delayMicroseconds(10);digitalWrite(ce,HIGH);delayMicroseconds(10);}
 void release(){pinMode(io,INPUT);digitalWrite(io,LOW);}
 void end(){digitalWrite(ce,LOW);release();}
 void byte(uint8_t value,bool reading=false){
  for(uint8_t bit=0;bit<8;bit++){
   digitalWrite(io,(value>>bit)&1);delayMicroseconds(10);
   digitalWrite(clk,HIGH);delayMicroseconds(10);
   // First reply bit is on the falling edge after command bit 7.
   if(reading&&bit==7)release();
   digitalWrite(clk,LOW);delayMicroseconds(10);
  }
 }
 uint8_t input(){uint8_t v=0;for(uint8_t bit=0;bit<8;bit++){v|=digitalRead(io)<<bit;digitalWrite(clk,HIGH);delayMicroseconds(10);digitalWrite(clk,LOW);delayMicroseconds(10);}return v;}
public:
 struct DateTime {uint16_t year;uint8_t month,date,day,hour,minute,second;};
 LabDS1302(uint8_t select,uint8_t data,uint8_t clock):ce(select),io(data),clk(clock){}
 void begin(){pinMode(ce,OUTPUT);digitalWrite(ce,LOW);pinMode(clk,OUTPUT);digitalWrite(clk,LOW);release();}
 void read(uint8_t command,uint8_t* data,uint8_t count=1){if(!count||count>31)return;start();byte(command|1,true);for(uint8_t i=0;i<count;i++)data[i]=input();end();}
 void write(uint8_t command,const uint8_t* data,uint8_t count=1){if(!count||count>31)return;start();byte(command&254);for(uint8_t i=0;i<count;i++)byte(data[i]);end();}
 void writeProtect(bool on){uint8_t v=on?128:0;write(0x8e,&v);}
 bool halted(){uint8_t v;read(0x81,&v);return v&128;}
 void halt(bool on){uint8_t v;read(0x81,&v);v=(v&127)|(on?128:0);write(0x80,&v);}
 uint8_t ram(uint8_t index){if(index>30)return 0;uint8_t v;read(0xc1+2*index,&v);return v;}
 bool ram(uint8_t index,uint8_t value){if(index>30)return false;write(0xc0+2*index,&value);return true;}
 static bool valid(const DateTime &d){const uint8_t days[]={31,28,31,30,31,30,31,31,30,31,30,31};return d.year>=2000&&d.year<=2099&&d.month>=1&&d.month<=12&&d.date>=1&&d.date<=days[d.month-1]+(d.month==2&&d.year%4==0)&&d.day>=1&&d.day<=7&&d.hour<24&&d.minute<60&&d.second<60;}
 bool datetime(DateTime &d){
  uint8_t r[8];read(0xbf,r,8);int s=dec(r[0]&127),m=dec(r[1]&127),h=dec(r[2]&(r[2]&128?31:63)),date=dec(r[3]&63),month=dec(r[4]&31),year=dec(r[6]);
  if(s<0||m<0||h<0||date<0||month<0||year<0)return false;
  if(r[2]&128){if(h<1||h>12)return false;h=h%12+(r[2]&32?12:0);}
  d.year=2000+year;d.month=month;d.date=date;d.day=r[5]&7;d.hour=h;d.minute=m;d.second=s;return valid(d);
 }
 bool set(const DateTime &d){if(!valid(d))return false;writeProtect(false);const uint8_t r[]={bcd(d.second),bcd(d.minute),bcd(d.hour),bcd(d.date),bcd(d.month),d.day,bcd(d.year-2000),0};write(0xbe,r,8);return true;}
};
`;
