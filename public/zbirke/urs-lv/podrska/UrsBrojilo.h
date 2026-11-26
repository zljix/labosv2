#pragma once
#include "LabTM1637.h"
class TM1637Display : public LabTM1637 {
public:
  using LabTM1637::LabTM1637;
  void setBrightness(uint8_t value, bool on = true) { begin(); brightness(value, on); }
  void showNumberDec(int value, bool zeros = false) { number(value, false, zeros); }
};
