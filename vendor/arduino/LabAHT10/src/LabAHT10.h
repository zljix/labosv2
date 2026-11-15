// MIT. AHT10 only. Uses real Wire transfers, never simulator-specific calls.
#pragma once
#include <Arduino.h>
#include <Wire.h>
class LabAHT10 {
  uint8_t status();
  bool command(uint8_t a, uint8_t b, uint8_t c);
public:
  bool begin();
  bool read(float &temperature, float &humidity);
};
