// LV11: potenciometar predstavlja razinu, a relej predstavlja pumpu.
// Nema stvarne pumpe ni automatske promjene razine.
const byte PIN_POTENCIOMETRA = A0;
const byte PIN_RELEJA = 7;
const bool RELEJ_AKTIVAN_NA_LOW = true;
const int DONJI_PRAG = 30;
const int GORNJI_PRAG = 70;
bool pumpaUkljucena = false;

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
}

void loop() {
  int razina = map(analogRead(PIN_POTENCIOMETRA), 0, 1023, 0, 100);
  if (razina <= DONJI_PRAG) {
    pumpaUkljucena = true;
  } else if (razina >= GORNJI_PRAG) {
    pumpaUkljucena = false;
  }
  // Izmedju pragova ostaje prethodno stanje pumpe.
  postaviRelej(pumpaUkljucena);

  Serial.print(F("MODEL razine="));
  Serial.print(razina);
  if (pumpaUkljucena) {
    Serial.println(F(" % PUMPA ON"));
  } else {
    Serial.println(F(" % PUMPA OFF"));
  }
  delay(100);
}
