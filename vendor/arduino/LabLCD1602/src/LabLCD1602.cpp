#include "LabLCD1602.h"
bool LabLCD1602::nibble(uint8_t value){
 value|=light_;Wire.beginTransmission(address_);
 Wire.write(value);Wire.write(value|4);Wire.write(value);
 bool ok=Wire.endTransmission()==0;delayMicroseconds(1);return ok;
}
bool LabLCD1602::send(uint8_t value,uint8_t rs){
 if(!nibble((value&0xf0)|rs)||!nibble(((value<<4)&0xf0)|rs))return false;
 delayMicroseconds(50);return true;
}
bool LabLCD1602::command(uint8_t value){bool ok=send(value);if(value<=3&&value)delay(2);return ok;}
bool LabLCD1602::begin(){
 if(address_<0x20||address_>0x27)return false;
 Wire.begin();Wire.setClock(100000);delay(50);
 Wire.beginTransmission(address_);Wire.write(light_);if(Wire.endTransmission()!=0)return false;delay(1);
 if(!nibble(0x30))return false;delay(5);
 if(!nibble(0x30))return false;delay(1);
 if(!nibble(0x30))return false;delay(1);
 if(!nibble(0x20))return false;delay(1);
 return command(0x28)&&command(0x0c)&&command(6)&&clear();
}
bool LabLCD1602::setCursor(uint8_t column,uint8_t row){return column<16&&row<2&&command(0x80|(column+row*0x40));}
bool LabLCD1602::createChar(uint8_t index,const uint8_t rows[8]){
 if(index>7||!command(0x40|index*8))return false;
 for(uint8_t i=0;i<8;i++)if(!send(rows[i]&31,1))return false;
 return home();
}
bool LabLCD1602::backlight(bool enabled){light_=enabled?8:0;Wire.beginTransmission(address_);Wire.write(light_);return Wire.endTransmission()==0;}
size_t LabLCD1602::write(uint8_t value){return send(value,1)?1:0;}
