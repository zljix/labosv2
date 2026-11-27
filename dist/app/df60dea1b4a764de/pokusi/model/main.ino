#include "ulazi.h"
#include "ventil.h"

const unsigned long INTERVAL_MS = 2000;
bool otvoren = false;

void setup() {
  Serial.begin(115200);
  senzor.begin();
  pinMode(21, OUTPUT);
  ledcAttach(14, 50, 14);
}

void loop() {
  unsigned long pocetak = millis();
  float t = ocitaj();
  if (isnan(t)) {
    otvoren = false;
    Serial.println("GRESKA DQ");
  } else {
    otvoren = odluka(t, otvoren);
    Serial.print("t_ms: "); Serial.print(pocetak);
    Serial.print(" T_C: "); Serial.print(t);
    Serial.print(" cilj: "); Serial.println(otvoren ? "OPEN" : "CLOSE");
  }
  digitalWrite(21, otvoren);
  ledcWrite(14, otvoren ? 1638 : 819);
  unsigned long trajanje = millis() - pocetak;
  if (trajanje < INTERVAL_MS) delay(INTERVAL_MS - trajanje);
}
