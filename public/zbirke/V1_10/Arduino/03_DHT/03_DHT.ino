/*
  V1.10 - Usporedi dva temperaturna senzora
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
  3. Spremi, Verify, Upload; Serial Monitor 115200, zatim RESET.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
*/


// Dio izvornog projekta: P06_DHT.ino
/*
  ESP32-S3-CAM, kamera odspojena, bez prosirnog adaptera.
  DATA=GPIO15, pull-up 10k na 3V3, zajednicki GND.
  Za VCC=3V3 prethodno potvrdi podrsku tocne izvedbe senzora/modula.
  Serial Monitor 115200 samo prikazuje rezultate, ne prima naredbe.
  Pri promjeni fizickog senzora prvo odspoji napajanje.
*/
#include <Arduino.h>
#include <DHT.h>
#include <math.h>

// === UČENIK MIJENJA: SENSOR_TYPE mora odgovarati spojenom senzoru ===
constexpr uint8_t SENSOR_TYPE = DHT22;  // DHT11 ili DHT22
constexpr uint32_t SAMPLE_MS = 3000;
// === KRAJ UČENIČKOG DIJELA ===

constexpr uint8_t DHT_PIN = 15;
static_assert(SENSOR_TYPE == DHT11 || SENSOR_TYPE == DHT22, "SENSOR_TYPE: DHT11 ili DHT22");
static_assert(SAMPLE_MS >= 2000 && SAMPLE_MS <= 60000, "SAMPLE_MS: 2000..60000");
DHT sensor(DHT_PIN, SENSOR_TYPE);
uint32_t lastSample = 0;
uint32_t sampleFinished = 0;
bool haveAttempt = false;
bool valid = false;
float temperatureC = NAN;
float humidityPct = NAN;

void printStatus() {
  Serial.printf("type=DHT%u; ", SENSOR_TYPE);
  if (!haveAttempt) { Serial.println("cekanje prvog citanja"); return; }
  Serial.printf("valid=%u; age_ms=%lu; ", valid,
                (unsigned long)(millis() - sampleFinished));
  if (valid) Serial.printf("T_C=%.2f; RH_pct=%.2f\n", temperatureC, humidityPct);
  else Serial.println("T_C=NA; RH_pct=NA; provjeri tip, napajanje i DATA.");
}

void setup() {
  Serial.begin(115200);
  sensor.begin();
  lastSample = millis();
  Serial.printf("P06: SENSOR_TYPE=DHT%u; SAMPLE_MS=%lu\n", SENSOR_TYPE, (unsigned long)SAMPLE_MS);
  printStatus();
}

void loop() {
  const uint32_t now = millis();
  if (uint32_t(now - lastSample) >= SAMPLE_MS) {
    lastSample = now;
    humidityPct = sensor.readHumidity();
    temperatureC = sensor.readTemperature();
    valid = isfinite(temperatureC) && isfinite(humidityPct) &&
            humidityPct >= 0.0f && humidityPct <= 100.0f;
    haveAttempt = true;
    sampleFinished = millis();
    if (!valid) { temperatureC = NAN; humidityPct = NAN; }
    printStatus();
  }
}


