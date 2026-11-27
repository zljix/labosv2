// LV04: oba DHT senzora ostaju spojena. Serial Monitor: 9600 baud.
#include <DHT.h>

DHT dht11(4, DHT11);
DHT dht22(5, DHT22);

// Isti postupak ispisa primjenjujemo na oba senzora.
// const char *oznaka prima tekst naziva, npr. "DHT11".
void ispisiMjerenje(const char *oznaka, float temperatura, float vlaznost) {
  Serial.print(oznaka);

  // isnan() je true kada rezultat nije valjan broj.
  if (isnan(temperatura) || isnan(vlaznost)) {
    Serial.println(F(": GRESKA"));
    return;  // Zavrsi ovaj ispis; nemoj ispisati nevaljana mjerenja.
  }

  Serial.print(F(": T="));
  Serial.print(temperatura, 1);
  Serial.print(F(" C RH="));
  Serial.print(vlaznost, 1);
  Serial.println(F(" %"));
}

void setup() {
  Serial.begin(9600);
  dht11.begin();
  dht22.begin();
  delay(2000);  // Prije prvog mjerenja pricekaj pokretanje senzora.
}

void loop() {
  float temperaturaDHT11 = dht11.readTemperature();
  float vlaznostDHT11 = dht11.readHumidity();
  float temperaturaDHT22 = dht22.readTemperature();
  float vlaznostDHT22 = dht22.readHumidity();

  ispisiMjerenje("DHT11", temperaturaDHT11, vlaznostDHT11);
  ispisiMjerenje("DHT22", temperaturaDHT22, vlaznostDHT22);
  Serial.println();
  delay(3000);  // Senzore ne citamo prebrzo.
}
