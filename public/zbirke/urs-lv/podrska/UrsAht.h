// Jedna pretvorba senzora AHT10 daje par temperature i vlage.
#pragma once
#include <LabAHT10.h>
const uint8_t AHT1x_SENSOR = 0, AHTXX_USE_READ_DATA = 0, AHTXX_NO_ERROR = 0;
class AHTxx {
  LabAHT10 sensor;
  float temperature = NAN, humidity = NAN;
  bool valid = false;
public:
  AHTxx(uint8_t, uint8_t) {}
  bool begin() { return sensor.begin(); }
  float readTemperature() {
    valid = sensor.read(temperature, humidity);
    return valid ? temperature : NAN;
  }
  float readHumidity(uint8_t) { return valid ? humidity : NAN; }
  uint8_t getStatus() { return valid ? 0 : 1; }
};
