/*
  V1.4 - Prikupi i opiši temperaturna očitanja
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
  3. Spremi, Verify, Upload; Serial Monitor 115200, zatim RESET.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
*/


// Dio izvornog projekta: P03_DS18B20.ino
/*
  ESP32-S3-CAM, kamera odspojena, bez prosirnog adaptera.
  DQ=GPIO4, VDD=3V3, GND; DQ -> 4,7k -> 3V3.
  Jedan DS18B20 s odvojenim VDD; bez parazitnog napajanja.
  Serial Monitor 115200 samo prikazuje rezultate, ne prima naredbe.
*/
#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>

// === UČENIK MIJENJA: korekciju izvedi iz usporedbe s referencom ===
constexpr float OFFSET_C = 0.0f;
constexpr uint32_t REQUEST_MS = 2000;
float correctedTemperature(float raw) {
  return raw + OFFSET_C;
}
// === KRAJ UČENIČKOG DIJELA ===

constexpr uint8_t DQ_PIN = 4;
constexpr uint32_t CONVERSION_MS = 750;
static_assert(OFFSET_C >= -10.0f && OFFSET_C <= 10.0f, "OFFSET_C: -10..10");
static_assert(REQUEST_MS >= 1000 && REQUEST_MS <= 60000, "REQUEST_MS: 1000..60000");
OneWire oneWire(DQ_PIN);
DallasTemperature sensors(&oneWire);
DeviceAddress sensorAddress;
bool haveAddress = false;
bool converting = false;
bool lastValid = false;
bool haveAttempt = false;
float rawC = NAN;
uint32_t lastRequest = 0;
uint32_t conversionStarted = 0;
uint32_t lastFinished = 0;

uint32_t sampleSeq=0;
void printStatus() {
  Serial.printf("seq=%lu; t_ms=%lu; ", (unsigned long)++sampleSeq, (unsigned long)lastFinished);
  Serial.printf("converting=%u; offset_C=%.3f; ", converting, OFFSET_C);
  if (!haveAttempt) { Serial.println("nema dovrsenog pokusaja"); return; }
  Serial.printf("valid=%u; age_ms=%lu; ", lastValid,
                (unsigned long)(millis() - lastFinished));
  if (lastValid) Serial.printf("raw_C=%.3f; corrected_C=%.3f\n", rawC, correctedTemperature(rawC));
  else Serial.println("raw_C=NA; corrected_C=NA");
}

void invalidSample() {
  haveAttempt = true;
  lastValid = false;
  rawC = NAN;
  lastFinished = millis();
  haveAddress = false;
  converting = false;
  printStatus();
}

bool findSensor() {
  sensors.begin();
  sensors.setWaitForConversion(false);
  sensors.setAutoSaveScratchPad(false);
  if (sensors.getDeviceCount() != 1 || !sensors.getAddress(sensorAddress, 0) ||
      sensorAddress[0] != 0x28 || sensors.isParasitePowerMode()) {
    Serial.println("GRESKA: spoji tocno jedan DS18B20 s odvojenim VDD na 3V3.");
    return false;
  }
  sensors.setResolution(sensorAddress, 12);
  return sensors.getResolution(sensorAddress) == 12;
}

void startConversion() {
  lastRequest = millis();
  if (!haveAddress) haveAddress = findSensor();
  if (!haveAddress) { invalidSample(); return; }
  const auto request = sensors.requestTemperaturesByAddress(sensorAddress);
  if (!request.result) {
    invalidSample();
    return;
  }
  // Rok se broji nakon slanja naredbe, ne prije pretrage senzora.
  conversionStarted = request.timestamp;
  converting = true;
}

void setup() {
  Serial.begin(115200);
  Serial.printf("P03: REQUEST_MS=%lu; OFFSET_C=%.3f; pretvorba 12 bita / 750 ms.\n",
                (unsigned long)REQUEST_MS, OFFSET_C);
  startConversion();
}

void loop() {
  const uint32_t now = millis();
  if (converting && uint32_t(now - conversionStarted) >= CONVERSION_MS) {
    const float measured = sensors.getTempC(sensorAddress);
    converting = false;
    if (!isfinite(measured) || measured == DEVICE_DISCONNECTED_C ||
        measured < -55.0f || measured > 125.0f) invalidSample();
    else {
      rawC = measured;
      lastValid = true;
      haveAttempt = true;
      lastFinished = millis();
      printStatus();
    }
  }
  if (!converting && uint32_t(millis() - lastRequest) >= REQUEST_MS) startConversion();
}


