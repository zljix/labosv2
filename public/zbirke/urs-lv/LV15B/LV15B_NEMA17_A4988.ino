// LV15B: NEMA 17 i A4988 u punom koraku.
// Motor, izvor i strujno ogranicenje priprema nastavnik.
const byte PIN_STEP = 2;
const byte PIN_DIR = 3;
const byte PIN_START = 4;
const byte PIN_EN = 8;
const unsigned int BROJ_KORAKA = 100;
const unsigned long RAZMAK_KORAKA_US = 5000UL;  // 200 impulsa/s.
unsigned int preostaliKoraci = 0;
unsigned long vrijemeZadnjegKoraka = 0;
unsigned long vrijemePromjeneTipke = 0;
bool motorSeKrece = false;
bool prethodnoOcitanje = HIGH;
bool stabilnoStanjeTipke = HIGH;
bool tipkaJeBilaOtpustena = false;

bool novaTipkaPritisnuta() {
  bool ocitanjeTipke = digitalRead(PIN_START);
  if (ocitanjeTipke == HIGH) {
    tipkaJeBilaOtpustena = true;
  }
  if (ocitanjeTipke != prethodnoOcitanje) {
    prethodnoOcitanje = ocitanjeTipke;
    vrijemePromjeneTipke = millis();
  }
  if (millis() - vrijemePromjeneTipke >= 30 &&
      ocitanjeTipke != stabilnoStanjeTipke) {
    stabilnoStanjeTipke = ocitanjeTipke;
    return stabilnoStanjeTipke == LOW && tipkaJeBilaOtpustena;
  }
  return false;
}

void setup() {
  digitalWrite(PIN_EN, HIGH);  // EN=HIGH iskljucuje A4988.
  pinMode(PIN_EN, OUTPUT);
  pinMode(PIN_STEP, OUTPUT);
  digitalWrite(PIN_STEP, LOW);
  pinMode(PIN_DIR, OUTPUT);
  digitalWrite(PIN_DIR, HIGH);
  pinMode(PIN_START, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  bool noviPritisak = novaTipkaPritisnuta();
  if (noviPritisak && !motorSeKrece) {
    preostaliKoraci = BROJ_KORAKA;
    motorSeKrece = true;
    digitalWrite(PIN_EN, LOW);  // Omoguci izlaze A4988.
    vrijemeZadnjegKoraka = micros();
  }

  if (motorSeKrece &&
      (unsigned long)(micros() - vrijemeZadnjegKoraka) >= RAZMAK_KORAKA_US) {
    vrijemeZadnjegKoraka = micros();
    if (preostaliKoraci == 0) {
      // Nakon zadnjeg impulsa pricekaj jos cijeli interval pa ugasi pogon.
      digitalWrite(PIN_EN, HIGH);
      motorSeKrece = false;
      Serial.println(F("GOTOVO"));
    } else {
      // Jedan STEP impuls: HIGH najmanje 3 us, zatim LOW.
      digitalWrite(PIN_STEP, HIGH);
      delayMicroseconds(3);
      digitalWrite(PIN_STEP, LOW);
      preostaliKoraci = preostaliKoraci - 1;
    }
  }
}
