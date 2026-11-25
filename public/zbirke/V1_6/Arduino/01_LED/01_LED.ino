/*
  V1.6 - PWM LED-a i dva položaja serva
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
  3. Spremi, Verify, Upload; Serial Monitor 115200, zatim RESET.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
*/


// Dio izvornog projekta: P01_LED.ino
/*
  ESP32-S3-CAM, kamera odspojena, bez prosirnog adaptera.
  GPIO21 -> 1 kohm -> anoda LED; katoda -> GND. Logika GPIO: 3,3 V.
  Serial Monitor 115200 samo prikazuje rezultate, ne prima naredbe.
  Promijeni oznaceni dio, provjeri program i ponovno ga ucitaj.
*/
#include <Arduino.h>

enum LedMode { OFF_MODE, ON_MODE, BLINK_MODE, PWM_MODE };
// === UČENIK MIJENJA ===
constexpr LedMode LED_MODE = BLINK_MODE;
constexpr uint32_t BLINK_PERIOD_MS = 1000;  // cijeli ciklus: ON + OFF
constexpr int PWM_DUTY = 128;          // 0..255, samo za PWM_MODE
// === KRAJ UČENIČKOG DIJELA ===

constexpr uint8_t LED_PIN = 21;
constexpr uint32_t PWM_HZ = 5000;
static_assert(BLINK_PERIOD_MS >= 100 && BLINK_PERIOD_MS <= 10000 &&
              BLINK_PERIOD_MS % 2 == 0, "BLINK_PERIOD_MS: paran broj 100..10000");
static_assert(PWM_DUTY >= 0 && PWM_DUTY <= 255, "PWM_DUTY: 0..255");
static_assert(LED_MODE >= OFF_MODE && LED_MODE <= PWM_MODE, "Odaberi postojeci LED_MODE");
bool pwmReady = false;
bool phase = false;
uint32_t lastToggle = 0;
uint32_t lastReport = 0;
uint8_t actualDuty = 0;

void writeDuty(uint8_t value) {
  if (pwmReady && ledcWrite(LED_PIN, value)) actualDuty = value;
  else {
    pwmReady = false;
    Serial.println("GRESKA: LEDC izlaz nije dostupan.");
  }
}

void printStatus() {
  const char *names[] = {"OFF", "ON", "BLINK", "PWM"};
  Serial.printf("mode=%s; duty=%u/255; period_ms=%lu; PWM_ok=%u\n",
                names[LED_MODE], actualDuty,
                (unsigned long)BLINK_PERIOD_MS, pwmReady);
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);  // izlaz ugasen tijekom pokretanja
  Serial.begin(115200);
  pwmReady = ledcAttach(LED_PIN, PWM_HZ, 8);
  if (pwmReady) writeDuty(0);
  if (pwmReady && LED_MODE == ON_MODE) writeDuty(255);
  if (pwmReady && LED_MODE == PWM_MODE) writeDuty(PWM_DUTY);
  lastToggle = millis();
  Serial.println("P01: postavke su u kodu; Serial Monitor je samo izlaz.");
  printStatus();
}

void loop() {
  const uint32_t now = millis();
  if (pwmReady && LED_MODE == BLINK_MODE &&
      uint32_t(now - lastToggle) >= BLINK_PERIOD_MS / 2) {
    lastToggle = now;
    phase = !phase;
    writeDuty(phase ? 255 : 0);
  }
  if (uint32_t(now - lastReport) >= 1000) {
    lastReport = now;
    printStatus();
  }
}


