// LV05: svih pet temperaturnih senzora i tri mjerenja vlaznosti.
// Serial Monitor: 9600 baud. Svi senzori ostaju spojeni.
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <AHTxx.h>

OneWire sabirnica(2);
DallasTemperature ds18b20(&sabirnica);
DHT dht11(4, DHT11);
DHT dht22(5, DHT22);
AHTxx aht10(0x38, AHT1x_SENSOR);
const float VREF = 5.00;  // Upisi izmjereni napon 5V-GND.

// Polje je skup vrijednosti. Indeks prve vrijednosti je 0.
// Temperature: 0 LM35, 1 DS18B20, 2 DHT11, 3 DHT22, 4 AHT10.
float temperature[5];
// Vlaznosti: 0 DHT11, 1 DHT22, 2 AHT10.
float vlaznosti[3];
bool valjano[5];  // true = mjerenje je proslo provjeru.
bool ahtPokrenut = false;

void ispisiVrijednost(float vrijednost, bool mjerenjeValjano) {
  if (mjerenjeValjano) {
    Serial.print(vrijednost, 1);
  } else {
    Serial.print(F("ERR"));  // Pogreska nije vrijednost nula.
  }
}

void setup() {
  Serial.begin(9600);
  analogReference(DEFAULT);
  ds18b20.begin();
  ds18b20.setResolution(12);
  dht11.begin();
  dht22.begin();
  Wire.begin();
  Wire.setWireTimeout(25000, true);  // Ogranici cekanje I2C sabirnice.
  ahtPokrenut = aht10.begin();
  Serial.println(F("LM35;DS18B20;DHT11;DHT22;AHT10;RH11;RH22;RH_AHT"));
  delay(2000);
}

void loop() {
  unsigned long pocetakCiklusa = millis();  // Vrijeme u milisekundama.

  // 1. LM35: prosjek ADC ocitanja pretvaramo u temperaturu.
  long zbrojOcitanja = 0;
  for (byte broj = 0; broj < 10; broj++) {
    zbrojOcitanja = zbrojOcitanja + analogRead(A0);
  }
  temperature[0] = (zbrojOcitanja / 10.0) * VREF / 1024.0 * 100.0;
  valjano[0] = temperature[0] >= 0 && temperature[0] <= 60;
  // Ova provjera raspona ne moze dokazati da je LM35 ispravno spojen.

  // 2. DS18B20: knjiznica daje poseban kod kada nema senzora.
  ds18b20.requestTemperatures();
  temperature[1] = ds18b20.getTempCByIndex(0);
  valjano[1] = temperature[1] != DEVICE_DISCONNECTED_C;

  // 3. DHT11 i DHT22: par T/RH vrijedi samo ako su oba broja valjana.
  temperature[2] = dht11.readTemperature();
  vlaznosti[0] = dht11.readHumidity();
  temperature[3] = dht22.readTemperature();
  vlaznosti[1] = dht22.readHumidity();
  valjano[2] = !isnan(temperature[2]) && !isnan(vlaznosti[0]);
  valjano[3] = !isnan(temperature[3]) && !isnan(vlaznosti[1]);

  // 4. AHT10: NAN znaci da valjano mjerenje jos nije dostupno.
  temperature[4] = NAN;
  vlaznosti[2] = NAN;
  valjano[4] = false;
  if (ahtPokrenut) {
    temperature[4] = aht10.readTemperature();
    vlaznosti[2] = aht10.readHumidity(AHTXX_USE_READ_DATA);
    // Status bez greske i oba rezultata u dopustenim rasponima.
    valjano[4] = aht10.getStatus() == AHTXX_NO_ERROR &&
                 temperature[4] >= -40 && temperature[4] <= 85 &&
                 vlaznosti[2] >= 0 && vlaznosti[2] <= 100;
  }

  // 5. Redoslijed ispisa jednak je redoslijedu u zaglavlju.
  for (byte indeks = 0; indeks < 5; indeks++) {
    ispisiVrijednost(temperature[indeks], valjano[indeks]);
    Serial.print(';');
  }
  for (byte indeks = 0; indeks < 3; indeks++) {
    // Vlaznosti 0, 1, 2 pripadaju senzorima 2, 3, 4.
    ispisiVrijednost(vlaznosti[indeks], valjano[indeks + 2]);
    if (indeks < 2) {
      Serial.print(';');
    }
  }
  Serial.println();

  // Ciklus traje najmanje 3 s, ukljucujuci vrijeme mjerenja.
  while ((unsigned long)(millis() - pocetakCiklusa) < 3000UL) {
    delay(1);
  }
}
