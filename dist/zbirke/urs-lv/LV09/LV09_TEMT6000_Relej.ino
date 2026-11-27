// LV09: TEMT6000 upravlja relejem koji predstavlja rasvjetu.
// Kontakti releja ostaju prazni; ne prikljucuj 230 V.
const byte PIN_SVJETLOSNOG_SENZORA = A0;
const byte PIN_RELEJA = 7;
const bool RELEJ_AKTIVAN_NA_LOW = true;
const int PRAG_MRAKA = 300;     // Prilagodi izmjerenim uvjetima.
const int PRAG_SVJETLA = 500;   // Mora biti veci od PRAG_MRAKA.
bool rasvjetaUkljucena = false;

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
  postaviRelej(false);  // Iskljucena razina prije ukljucenja izlaza.
  pinMode(PIN_RELEJA, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int osvijetljenost = analogRead(PIN_SVJETLOSNOG_SENZORA);
  if (osvijetljenost <= PRAG_MRAKA) {
    rasvjetaUkljucena = true;
  } else if (osvijetljenost >= PRAG_SVJETLA) {
    rasvjetaUkljucena = false;
  }
  // Izmedju pragova ne mijenjamo zapamceno stanje: to je histereza.
  postaviRelej(rasvjetaUkljucena);

  Serial.print(F("Svjetlo ADC="));
  Serial.print(osvijetljenost);
  if (rasvjetaUkljucena) {
    Serial.println(F(" RASVJETA ON"));
  } else {
    Serial.println(F(" RASVJETA OFF"));
  }
  delay(100);
}
