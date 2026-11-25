/*
  V1.10 - Usporedi dva temperaturna senzora
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
  3. Spremi, Verify, Upload; Serial Monitor 115200, zatim RESET.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
*/


// Dio izvornog projekta: P07_AHT10.ino
/*
  ESP32-S3-CAM, kamera odspojena, bez prosirnog adaptera.
  VCC=3V3, GND, SDA=GPIO8, SCL=GPIO9; samo AHT10 na ovoj sabirnici.
  Serial Monitor 115200 samo prikazuje rezultate, ne prima naredbe.
  Biblioteka moze blokirati tijekom BUSY cekanja: zaseban mjerni pokus,
  ne upravljacki regulator. Nakon kvara iskljuci napajanje, provjeri spoj i pokreni.
*/
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <math.h>

// === UČENIK MIJENJA: period mjerenja i uvjet oznake povisene vlage ===
constexpr uint32_t SAMPLE_MS = 3000;
constexpr float HUMIDITY_LIMIT_PCT = 60.0f;
bool humidityAboveLimit(float humidity) {
  return humidity > HUMIDITY_LIMIT_PCT;
}
// === KRAJ UČENIČKOG DIJELA ===

constexpr uint8_t SDA_PIN = 8;
constexpr uint8_t SCL_PIN = 9;
constexpr uint8_t AHT_ADDRESS = 0x38;
static_assert(SAMPLE_MS >= 1000 && SAMPLE_MS <= 60000, "SAMPLE_MS: 1000..60000");
static_assert(HUMIDITY_LIMIT_PCT >= 0.0f && HUMIDITY_LIMIT_PCT <= 100.0f,
              "HUMIDITY_LIMIT_PCT: 0..100");
Adafruit_AHTX0 aht;
bool ready = false;
bool haveAttempt = false;
bool valid = false;
float temperatureC = NAN;
float humidityPct = NAN;
uint32_t lastSample = 0;
uint32_t sampleFinished = 0;

bool sensorPresent() {
  Wire.beginTransmission(AHT_ADDRESS);
  return Wire.endTransmission() == 0;
}

void printStatus() {
  Serial.printf("ready=%u; ", ready);
  if (!haveAttempt) { Serial.println("nema dovrsenog pokusaja"); return; }
  Serial.printf("valid=%u; age_ms=%lu; ", valid,
                (unsigned long)(millis() - sampleFinished));
  if (valid) Serial.printf("T_C=%.2f; RH_pct=%.2f; above_limit=%u\n",
                          temperatureC, humidityPct, humidityAboveLimit(humidityPct));
  else Serial.println("T_C=NA; RH_pct=NA; above_limit=NA");
}

void setup() {
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);
  Wire.setTimeOut(50); // Rok pojedine I2C transakcije, ne cijelog getEvent().
  // begin/getEvent mogu cekati BUSY bez ukupnog vremenskog roka.
  // Provjera prisutnosti umanjuje rizik, ali ga ne uklanja tijekom transakcije.
  ready = sensorPresent() && aht.begin(&Wire);
  lastSample = millis();
  Serial.printf("P07: SAMPLE_MS=%lu; HUMIDITY_LIMIT_PCT=%.1f\n",
                (unsigned long)SAMPLE_MS, HUMIDITY_LIMIT_PCT);
  if (!ready) Serial.println("GRESKA: AHT10 nije dostupan. Iskljuci napajanje i provjeri spoj.");
  printStatus();
}

void loop() {
  const uint32_t now = millis();
  if (ready && uint32_t(now - lastSample) >= SAMPLE_MS) {
    lastSample = now;
    sensors_event_t humidityEvent = {};
    sensors_event_t temperatureEvent = {};
    const bool ok = sensorPresent() && aht.getEvent(&humidityEvent, &temperatureEvent);
    temperatureC = ok ? temperatureEvent.temperature : NAN;
    humidityPct = ok ? humidityEvent.relative_humidity : NAN;
    valid = ok && isfinite(temperatureC) && isfinite(humidityPct) &&
            temperatureC >= -40.0f && temperatureC <= 85.0f &&
            humidityPct >= 0.0f && humidityPct <= 100.0f;
    haveAttempt = true;
    sampleFinished = millis();
    if (!valid) {
      temperatureC = NAN;
      humidityPct = NAN;
      ready = false;
      Serial.println("GRESKA mjerenja. Iskljuci napajanje, provjeri spoj i ponovno pokreni.");
    }
    printStatus();
  }
}


