/*
  V1.5 - Svjetlost, prag LED-a i temperatura
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
  3. Spremi, Verify, Upload; Serial Monitor 115200, zatim RESET.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
*/


// Dio izvornog projekta: P02_LDR.ino
/*
  ESP32-S3-CAM, kamera odspojena, bez prosirnog adaptera.
  3V3 -> LDR -> cvor GPIO1 -> otpornik 10k -> GND.
  GPIO21 -> 1k -> anoda LED; katoda -> GND. Spojeve mijenjaj bez napajanja.
  Veca osvijetljenost ovog djelila obicno daje veci raw.
  Serial Monitor 115200 samo prikazuje rezultate, ne prima naredbe.
*/
#include <Arduino.h>

// === UČENIK MIJENJA: prag odredi mjerenjem svijetlog i tamnog stanja ===
constexpr uint16_t LED_THRESHOLD = 1800;  // 0..4095; nije univerzalni prag
constexpr uint32_t SAMPLE_MS = 500;
bool ledShouldBeOn(uint16_t raw) {
  return raw < LED_THRESHOLD;           // LED svijetli kad je tamnije
}
// === KRAJ UČENIČKOG DIJELA ===

constexpr uint8_t LDR_PIN = 1;
constexpr uint8_t LED_PIN = 21;
static_assert(LED_THRESHOLD <= 4095, "LED_THRESHOLD: 0..4095");
static_assert(SAMPLE_MS >= 50 && SAMPLE_MS <= 60000, "SAMPLE_MS: 50..60000");
uint32_t lastSample = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(LDR_PIN, INPUT);
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetPinAttenuation(LDR_PIN, ADC_11db);
  Serial.println("P02: LDR i LED rade zajedno; raw i mV dva su odvojena ocitanja.");
  Serial.println("mV nije laboratorijska kalibracija; 4095 nije nuzno 3300 mV.");
  lastSample = millis() - SAMPLE_MS;
}

void loop() {
  const uint32_t now = millis();
  if (uint32_t(now - lastSample) >= SAMPLE_MS) {
    const uint16_t raw = analogRead(LDR_PIN);
    const uint32_t millivolts = analogReadMilliVolts(LDR_PIN);
    const bool ledOn = ledShouldBeOn(raw);
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
    lastSample = millis();
    Serial.printf("ADC_raw=%u; mV=%lu; threshold=%u; LED=%s\n", raw,
                  (unsigned long)millivolts, LED_THRESHOLD, ledOn ? "ON" : "OFF");
  }
}


