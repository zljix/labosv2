// MIT. Project drivers for documented I2C protocols, not simulator shortcuts.
#pragma once
#include <Arduino.h>
#include <Wire.h>
class LabBMP180 {
 public:
  bool begin();
  bool read(float &temperature, float &pressure, uint8_t oss=0);
 private:
  int32_t c[11];
  bool ready=false;
};
class LabBMP280 {
 public:
  bool begin(uint8_t address=0x76);
  bool read(float &temperature, float &pressure);
 private:
  uint8_t address=0x76;
  int32_t c[12];
  bool ready=false;
};
class LabAM2320 {
 public:
  bool begin();
  bool read(float &temperature, float &humidity);
};
