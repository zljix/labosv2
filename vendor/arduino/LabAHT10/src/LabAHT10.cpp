// MIT. Command and six-byte measurement format: ASAIR AHT10 datasheet.
#include "LabAHT10.h"
uint8_t LabAHT10::status() {
  if (Wire.requestFrom(uint8_t(0x38), uint8_t(1)) != 1) return 0xFF;
  return Wire.read();
}
bool LabAHT10::command(uint8_t a, uint8_t b, uint8_t c) {
  Wire.beginTransmission(0x38); Wire.write(a); Wire.write(b); Wire.write(c);
  return Wire.endTransmission() == 0;
}
bool LabAHT10::begin() {
  Wire.begin(); Wire.setClock(100000); delay(40);
  if (!command(0xE1, 0x08, 0x00)) return false;
  delay(10);
  return (status() & 0x88) == 0x08;
}
bool LabAHT10::read(float &temperature, float &humidity) {
  if (!command(0xAC, 0x33, 0x00)) return false;
  // Conversion takes 80 ms; timeout also handles a disconnected sensor.
  unsigned long start = millis(); uint8_t s;
  do { delay(10); s = status(); if (millis()-start > 150) return false; } while (s & 0x80);
  if (!(s & 0x08) || Wire.requestFrom(uint8_t(0x38), uint8_t(6)) != 6) return false;
  uint8_t b[6]; for (uint8_t i=0; i<6; ++i) b[i] = Wire.read();
  if ((b[0] & 0x88) != 0x08) return false;
  uint32_t h = (uint32_t(b[1])<<12) | (uint16_t(b[2])<<4) | (b[3]>>4);
  uint32_t t = (uint32_t(b[3]&15)<<16) | (uint16_t(b[4])<<8) | b[5];
  humidity = h * (100.0f/1048576.0f);
  temperature = t * (200.0f/1048576.0f) - 50.0f;
  return true;
}
