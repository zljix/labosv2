#include "ulazi.h"

const unsigned long INTERVAL_MS = 2000;
unsigned long broj = 0;

void setup() {
  Serial.begin(115200);
  senzor.begin();
}

void loop() {
  unsigned long pocetak = millis();
  float t = ocitaj();
  if (isnan(t)) {
    Serial.println("Pogreska senzora: provjeri DQ");
  } else {
    Serial.print("uzorak: "); Serial.print(++broj);
    Serial.print(" t_ms: "); Serial.print(millis());
    Serial.print(" T_C: "); Serial.println(t);
  }
  unsigned long trajanje = millis() - pocetak;
  if (trajanje < INTERVAL_MS) delay(INTERVAL_MS - trajanje);
}
