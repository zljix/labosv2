// LV13: DS18B20 mjeri temperaturu; relej je samo MODEL grijaca.
#include <OneWire.h>
#include <DallasTemperature.h>

OneWire sabirnica(2);
DallasTemperature ds18b20(&sabirnica);
const byte PIN_RELEJA = 7;
const bool RELEJ_AKTIVAN_NA_LOW = true;
const float H = 0.5;  // Polusirina pojasa histereze, u stupnjevima C.
bool grijanjeUkljuceno = false;
unsigned long pocetakMjerenja = 0;

void postaviRelej(bool ukljucen) {
  if (RELEJ_AKTIVAN_NA_LOW) {
    if (ukljucen) {
      digitalWrite(PIN_RELEJA, LOW);
    } else {
      digitalWrite(PIN_RELEJA, HIGH);
    }
  } else {
    if (ukljucen) {
      digitalWrite(PIN_RELEJA, HIGH);
    } else {
      digitalWrite(PIN_RELEJA, LOW);
    }
  }
}

void setup() {
  postaviRelej(false);
  pinMode(PIN_RELEJA, OUTPUT);
  Serial.begin(9600);
  ds18b20.begin();
  ds18b20.setResolution(12);
  ds18b20.setWaitForConversion(false);  // Pokreni, ali ne cekaj ovdje.
  ds18b20.requestTemperatures();
  pocetakMjerenja = millis();
}

void loop() {
  if (millis() - pocetakMjerenja < 750UL) {
    return;  // Pretvorba jos traje; provjeri ponovno u sljedecem loop().
  }

  float temperatura = ds18b20.getTempCByIndex(0);
  float zadanaTemperatura = 15.0 + analogRead(A0) * 20.0 / 1023.0;
  bool mjerenjeValjano = temperatura != DEVICE_DISCONNECTED_C &&
                        temperatura >= 0 && temperatura <= 60;

  if (!mjerenjeValjano) {
    grijanjeUkljuceno = false;
  } else if (temperatura <= zadanaTemperatura - H) {
    grijanjeUkljuceno = true;
  } else if (temperatura >= zadanaTemperatura + H) {
    grijanjeUkljuceno = false;
  }
  // Unutar pojasa zadrzi stanje; pogreska mjerenja uvijek gasi izlaz.
  postaviRelej(grijanjeUkljuceno);

  Serial.print(F("T="));
  if (mjerenjeValjano) {
    Serial.print(temperatura, 2);
  } else {
    Serial.print(F("GRESKA"));
  }
  Serial.print(F(" SP="));
  Serial.print(zadanaTemperatura, 1);
  if (grijanjeUkljuceno) {
    Serial.println(F(" GRIJAC MODEL ON"));
  } else {
    Serial.println(F(" GRIJAC MODEL OFF"));
  }

  ds18b20.requestTemperatures();  // Zapocni sljedece mjerenje.
  pocetakMjerenja = millis();
}
