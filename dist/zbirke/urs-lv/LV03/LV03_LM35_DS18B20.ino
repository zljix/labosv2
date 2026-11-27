// LV03: mjerenje temperature senzorima LM35 i DS18B20.
// Serial Monitor: 9600 baud. Nazivi varijabli su bez dijakritika.
#include <OneWire.h>
#include <DallasTemperature.h>

const byte PIN_LM35 = A0;
const float VREF = 5.00;  // Ovdje upisi izmjereni napon 5V-GND.
OneWire sabirnica(2);
DallasTemperature ds18b20(&sabirnica);

void setup() {
  Serial.begin(9600);
  analogReference(DEFAULT);
  ds18b20.begin();
  ds18b20.setResolution(12);
}

void loop() {
  // Prosjek deset ADC ocitanja ublazava kolebanje signala LM35.
  long zbrojOcitanja = 0;
  for (byte broj = 0; broj < 10; broj++) {
    zbrojOcitanja = zbrojOcitanja + analogRead(PIN_LM35);
    delay(2);
  }
  float prosjekADC = zbrojOcitanja / 10.0;
  float naponLM35 = prosjekADC * VREF / 1024.0;
  float temperaturaLM35 = naponLM35 * 100.0;  // 10 mV po stupnju C.

  // Ovaj poziv ceka pretvorbu DS18B20: do 750 ms na 12 bita.
  ds18b20.requestTemperatures();
  float temperaturaDS18B20 = ds18b20.getTempCByIndex(0);

  // F() cuva stalni tekst u programskoj memoriji Nano plocice.
  Serial.print(F("LM35 ADC="));
  Serial.print(prosjekADC, 1);
  Serial.print(F(" U="));
  Serial.print(naponLM35, 3);
  Serial.print(F(" V T="));
  Serial.print(temperaturaLM35, 1);
  Serial.print(F(" C | DS18B20="));

  // Kod odspojenog senzora ispisujemo pogresku, a ne temperaturu.
  if (temperaturaDS18B20 == DEVICE_DISCONNECTED_C) {
    Serial.println(F("GRESKA"));
  } else {
    Serial.print(temperaturaDS18B20, 2);
    Serial.println(F(" C"));
  }
  delay(1500);
}
