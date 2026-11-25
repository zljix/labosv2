#pragma once
#include <OneWire.h>
#include <DallasTemperature.h>

OneWire sabirnica(4);
DallasTemperature senzor(&sabirnica);

float ocitaj() {
  senzor.requestTemperatures();
  float t = senzor.getTempCByIndex(0);
  return t == DEVICE_DISCONNECTED_C ? NAN : t;
}
