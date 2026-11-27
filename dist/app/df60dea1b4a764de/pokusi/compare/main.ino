#include "ulazi.h"

#include <DHT.h>
DHT drugi(5, DHT22);
const unsigned long INTERVAL_MS = 2500;
unsigned long broj = 0;

void setup() {
  Serial.begin(115200);
  senzor.begin();
  drugi.begin();
  delay(2100);
}

void loop() {
  unsigned long pocetak = millis();
  float t = ocitaj();
  float t2 = drugi.readTemperature();
  if (isnan(t) || isnan(t2)) {
    Serial.println("Pogreska senzora: provjeri DQ");
  } else {
    Serial.print("DS18B20: "); Serial.print(t);
    Serial.print(" DHT22: "); Serial.print(t2);
    Serial.print(" razlika: "); Serial.println(t - t2);
    Serial.print("uzorak: "); Serial.print(++broj);
    Serial.print(" t_ms: "); Serial.print(millis());
    Serial.print(" T_C: "); Serial.println(t);
  }
  unsigned long trajanje = millis() - pocetak;
  if (trajanje < INTERVAL_MS) delay(INTERVAL_MS - trajanje);
}
