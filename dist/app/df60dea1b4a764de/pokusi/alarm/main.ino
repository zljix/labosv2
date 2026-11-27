#include "ulazi.h"
#include "ventil.h"

const unsigned long INTERVAL_MS = 2000;
bool otvoren = false;
bool alarm = false;
const float ALARM_ON = 30.0;
const float ALARM_OFF = 28.0;

void setup() {
  Serial.begin(115200);
  senzor.begin();
  pinMode(47, OUTPUT);
  pinMode(21, OUTPUT);
  ledcAttach(14, 50, 14);
}

void loop() {
  unsigned long pocetak = millis();
  float t = ocitaj();
  if (isnan(t)) {
    otvoren = false;
    alarm = true;
    Serial.println("GRESKA DQ");
  } else {
    otvoren = odluka(t, otvoren);
    if (t >= ALARM_ON) alarm = true;
    else if (t <= ALARM_OFF) alarm = false;
    Serial.print("alarm: "); Serial.println(alarm);
    Serial.print("t_ms: "); Serial.print(pocetak);
    Serial.print(" T_C: "); Serial.print(t);
    Serial.print(" cilj: "); Serial.println(otvoren ? "OPEN" : "CLOSE");
  }
  digitalWrite(47, alarm);
  digitalWrite(21, otvoren);
  ledcWrite(14, otvoren ? 1638 : 819);
  unsigned long trajanje = millis() - pocetak;
  if (trajanje < INTERVAL_MS) delay(INTERVAL_MS - trajanje);
}
