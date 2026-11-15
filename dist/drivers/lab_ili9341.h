// MIT · ESP32 MicroPython Lab · original bounded ILI9341 driver 1.0.0.
// Direct RGB565 SPI. Only small uppercase ASCII font; no full framebuffer.
#pragma once
#include <Arduino.h>
#include <SPI.h>
#include <avr/pgmspace.h>
static const char labIliChars[] PROGMEM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.:-/%? ";
static const uint8_t labIliFont[] PROGMEM = {62,81,73,69,62,0,66,127,64,0,66,97,81,73,70,65,73,73,73,54,24,20,18,127,16,79,73,73,73,49,62,73,73,73,48,1,113,9,5,3,54,73,73,73,54,6,73,73,73,62,126,9,9,9,126,127,73,73,73,54,62,65,65,65,65,127,65,65,65,62,127,73,73,73,65,127,9,9,9,1,62,65,73,73,121,127,8,8,8,127,0,65,127,65,0,48,64,65,63,1,127,8,20,34,65,127,64,64,64,64,127,2,12,2,127,127,2,4,8,127,62,65,65,65,62,127,9,9,9,6,62,65,81,33,94,127,9,25,41,70,70,73,73,73,49,1,1,127,1,1,63,64,64,64,63,31,32,64,32,31,127,32,24,32,127,99,20,8,20,99,3,4,120,4,3,97,81,73,69,67,0,0,96,96,0,0,0,54,54,0,8,8,8,8,8,64,48,8,6,1,67,51,8,102,97,2,1,81,9,6,0,0,0,0,0};
class LabILI9341 : public Print {
  uint8_t cs,dc,rst,rot=0;
  int16_t screenWidth=240,screenHeight=320;
  int16_t cursorX=0,cursorY=0;
  uint16_t textColor=65535;
  uint8_t textScale=1;
  void start(bool data){SPI.beginTransaction(SPISettings(4000000,MSBFIRST,SPI_MODE0));digitalWrite(dc,data);digitalWrite(cs,LOW);}
  void end(){digitalWrite(cs,HIGH);SPI.endTransaction();}
 public:
  LabILI9341(uint8_t c,uint8_t d,uint8_t r):cs(c),dc(d),rst(r){}
  void command(uint8_t cmd,const uint8_t *a=nullptr,uint8_t n=0){start(false);SPI.transfer(cmd);digitalWrite(dc,HIGH);while(n--)SPI.transfer(*a++);end();}
  void begin(){digitalWrite(cs,HIGH);pinMode(cs,OUTPUT);pinMode(dc,OUTPUT);pinMode(rst,OUTPUT);SPI.begin();digitalWrite(rst,LOW);delay(10);digitalWrite(rst,HIGH);delay(150);command(1);delay(150);command(0x11);delay(150);uint8_t fmt=0x55;command(0x3a,&fmt,1);setRotation(0);command(0x13);command(0x29);}
  void setRotation(uint8_t r){rot=r&3;screenWidth=(rot&1)?320:240;screenHeight=(rot&1)?240:320;const uint8_t m[4]={0x48,0x28,0x88,0xe8};command(0x36,m+rot,1);}
  int16_t width() const {return screenWidth;}
  int16_t height() const {return screenHeight;}
  void window(uint16_t x,uint16_t y,uint16_t w,uint16_t h){uint16_t x1=x+w-1,y1=y+h-1;uint8_t a[4]={(uint8_t)(x>>8),(uint8_t)x,(uint8_t)(x1>>8),(uint8_t)x1};command(0x2a,a,4);a[0]=y>>8;a[1]=y;a[2]=y1>>8;a[3]=y1;command(0x2b,a,4);command(0x2c);}
  void fillRect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t color){int16_t x1=min(screenWidth,(int16_t)(x+w)),y1=min(screenHeight,(int16_t)(y+h));x=max((int16_t)0,x);y=max((int16_t)0,y);if(x1<=x||y1<=y)return;window(x,y,x1-x,y1-y);start(true);uint32_t n=(uint32_t)(x1-x)*(y1-y);while(n--){SPI.transfer(color>>8);SPI.transfer(color&255);}end();}
  void fillScreen(uint16_t c){fillRect(0,0,screenWidth,screenHeight,c);}
  void drawPixel(int16_t x,int16_t y,uint16_t c){fillRect(x,y,1,1,c);}
  void drawRect(int16_t x,int16_t y,int16_t w,int16_t h,uint16_t c){fillRect(x,y,w,1,c);fillRect(x,y+h-1,w,1,c);fillRect(x,y,1,h,c);fillRect(x+w-1,y,1,h,c);}
  void drawLine(int16_t x,int16_t y,int16_t x1,int16_t y1,uint16_t c){int16_t dx=abs(x1-x),dy=-abs(y1-y),sx=x<x1?1:-1,sy=y<y1?1:-1,err=dx+dy;for(;;){drawPixel(x,y,c);if(x==x1&&y==y1)break;int16_t e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}}
  void setCursor(int16_t x,int16_t y){cursorX=x;cursorY=y;}
  void setTextColor(uint16_t c){textColor=c;}
  void setTextSize(uint8_t s){textScale=constrain(s,1,4);}
  using Print::write;
  size_t write(uint8_t c) override {if(c=='\r')return 1;if(c=='\n'){cursorX=0;cursorY+=8*textScale;return 1;}if(c>='a'&&c<='z')c-=32;uint8_t idx=41;for(uint8_t i=0;i<sizeof(labIliChars)-1;i++)if(pgm_read_byte(labIliChars+i)==c){idx=i;break;}for(uint8_t col=0;col<5;col++){uint8_t bits=pgm_read_byte(labIliFont+idx*5+col);for(uint8_t row=0;row<7;row++)if(bits&(1<<row))fillRect(cursorX+col*textScale,cursorY+row*textScale,textScale,textScale,textColor);}cursorX+=6*textScale;return 1;}
};
