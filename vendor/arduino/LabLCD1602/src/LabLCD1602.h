#pragma once
#include <Arduino.h>
#include <Wire.h>
// P0=RS, P1=RW, P2=E, P3=BL, P4..7=D4..7; PCF8574 0x20..0x27.
class LabLCD1602 : public Print {
 public:
  explicit LabLCD1602(uint8_t address=0x27):address_(address){}
  bool begin();
  bool command(uint8_t value);
  bool clear(){return command(1);}
  bool home(){return command(2);}
  bool setCursor(uint8_t column,uint8_t row);
  bool createChar(uint8_t index,const uint8_t rows[8]);
  bool backlight(bool enabled=true);
  bool display(bool enabled=true,bool cursor=false,bool blink=false){return command(8|(enabled?4:0)|(cursor?2:0)|(blink?1:0));}
  bool scrollDisplayLeft(){return command(0x18);}
  bool scrollDisplayRight(){return command(0x1c);}
  size_t write(uint8_t value) override;
  using Print::write;
 private:
  uint8_t address_,light_=8;
  bool nibble(uint8_t value);
  bool send(uint8_t value,uint8_t rs=0);
};
