// Labos: sučelje za naredbe radnog lista, preko U8g2 i stvarne I2C sabirnice.
#pragma once
#include <U8g2lib.h>
#include <Wire.h>

const uint8_t SSD1306_SWITCHCAPVCC = 2;
const uint8_t SSD1306_WHITE = 1;
const uint8_t SSD1306_BLACK = 0;

class Adafruit_SSD1306 : public Print {
  U8G2_SSD1306_128X32_UNIVISION_F_HW_I2C oled;
  int16_t x = 0, y = 0;
  uint8_t scale = 1, color = 1;
public:
  Adafruit_SSD1306(uint8_t, uint8_t, TwoWire*, int8_t) : oled(U8G2_R0) {}
  bool begin(uint8_t, uint8_t address) {
    Wire.begin();
    Wire.beginTransmission(address);
    if (Wire.endTransmission() != 0) return false;
    oled.setI2CAddress(address << 1);
    oled.begin();
    oled.setFont(u8g2_font_6x10_tf);
    oled.setFontPosTop();
    return true;
  }
  void clearDisplay() { oled.clearBuffer(); }
  void display() { oled.sendBuffer(); }
  void setTextColor(uint8_t value) { color = value; }
  void setTextSize(uint8_t value) { scale = constrain(value, 1, 2); }
  void setCursor(int16_t left, int16_t top) { x = left; y = top; }
  void drawRect(int16_t left, int16_t top, int16_t width, int16_t height, uint8_t ink) {
    if (width > 0 && height > 0) {
      oled.setDrawColor(ink);
      oled.drawFrame(left, top, width, height);
    }
  }
  void fillRect(int16_t left, int16_t top, int16_t width, int16_t height, uint8_t ink) {
    if (width > 0 && height > 0) {
      oled.setDrawColor(ink);
      oled.drawBox(left, top, width, height);
    }
  }
  using Print::write;
  size_t write(uint8_t character) override {
    if (character == '\r') return 1;
    if (character == '\n' || x + 6 * scale > 128) {
      x = 0;
      y += 8 * scale;
      if (character == '\n') return 1;
    }
    oled.setDrawColor(color);
    if (scale == 2) oled.drawGlyphX2(x, y, character);
    else oled.drawGlyph(x, y, character);
    x += 6 * scale;
    return 1;
  }
};
