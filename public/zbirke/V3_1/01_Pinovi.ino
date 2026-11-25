/*
  V3.1 - Pronađi podatke o stvarnim komponentama
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  2. Procitaj oznake: senzor GPIO4, LED GPIO21, signal serva GPIO14.
  3. Program ne prenosis; oznake usporedi s nenapajanom plocicom.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
*/


// Dio izvornog projekta: P00_USB.ino
#include <Arduino.h>

// === UČENIK MIJENJA: poruku i razmak između ispisa ===
constexpr uint32_t REPORT_MS = 2000;
// Uloge: DS18B20 DQ=GPIO4; servo SIGNAL=GPIO14; LED=GPIO21.
constexpr char MESSAGE[] = "ESP32-S3-CAM: program radi";
// === KRAJ UČENIČKOG DIJELA ===
static_assert(REPORT_MS >= 100 && REPORT_MS <= 60000, "REPORT_MS: 100..60000");
uint32_t lastReportMs = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  const uint32_t now = millis();
  if (uint32_t(now - lastReportMs) >= REPORT_MS) {
    lastReportMs = now;
    Serial.println(MESSAGE);
  }
}


