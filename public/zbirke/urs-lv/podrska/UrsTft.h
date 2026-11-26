// Naredbe za ST7735 iz LV07 služe se SPI upravljačkim programom Labosa.
#pragma once
#include "LabST7735.h"
const uint8_t INITR_144GREENTAB = 1;
const uint16_t ST77XX_BLACK = 0x0000, ST77XX_WHITE = 0xffff, ST77XX_RED = 0xf800,
               ST77XX_GREEN = 0x07e0, ST77XX_BLUE = 0x001f, ST77XX_YELLOW = 0xffe0,
               ST77XX_CYAN = 0x07ff, ST77XX_MAGENTA = 0xf81f, ST77XX_ORANGE = 0xfc00;
class Adafruit_ST7735 : public LabST7735 {
public:
  using LabST7735::LabST7735;
  void initR(uint8_t) { begin(); }
  void fillCircle(int16_t x, int16_t y, int16_t radius, uint16_t color) {
    for (int16_t dy = -radius; dy <= radius; dy++) {
      int16_t dx = sqrt((long)radius * radius - (long)dy * dy);
      fillRect(x - dx, y + dy, 2 * dx + 1, 1, color);
    }
  }
};
