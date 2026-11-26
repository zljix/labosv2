// Ista mjerna pretvorba daje temperaturu i tlak BMP180.
#pragma once
#include <LabI2CSensors.h>
class Adafruit_BMP085 {
  LabBMP180 sensor;
  float temperature = NAN, pressure = NAN;
public:
  bool begin() { return sensor.begin(); }
  float readTemperature() {
    if (!sensor.read(temperature, pressure)) temperature = pressure = NAN;
    return temperature;
  }
  float readPressure() { return pressure; }
};
