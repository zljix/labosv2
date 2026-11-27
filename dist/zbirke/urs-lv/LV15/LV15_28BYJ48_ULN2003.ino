// LV15: motor 28BYJ-48 5 V i ULN2003; napajanje motora je odvojeno.
const byte PINOVI_NAMOTA[4] = {8, 9, 10, 11};  // IN1, IN2, IN3, IN4.
const byte PIN_TIPKE = 4;
const unsigned int BROJ_KORAKA = 512;  // Broj POLUKORAKA, ne stupnjeva.
const unsigned long RAZMAK_KORAKA_US = 3000UL;

// Svaki redak zadaje cetiri izlaza. Indeksi redaka su 0-7.
// Nakon retka 7 slijedi redak 0; jedinica ukljucuje odgovarajuci namot.
const byte slijedPobude[8][4] = {
  {1, 0, 0, 0},
  {1, 1, 0, 0},
  {0, 1, 0, 0},
  {0, 1, 1, 0},
  {0, 0, 1, 0},
  {0, 0, 1, 1},
  {0, 0, 0, 1},
  {1, 0, 0, 1}
};
byte faza = 0;
unsigned int preostaliKoraci = 0;
unsigned long vrijemeZadnjegKoraka = 0;
unsigned long vrijemePromjeneTipke = 0;
bool motorSeKrece = false;
bool prethodnoOcitanje = HIGH;
bool stabilnoStanjeTipke = HIGH;
bool tipkaJeBilaOtpustena = false;

bool novaTipkaPritisnuta() {
  bool ocitanjeTipke = digitalRead(PIN_TIPKE);
  if (ocitanjeTipke == HIGH) {
    tipkaJeBilaOtpustena = true;
  }
  if (ocitanjeTipke != prethodnoOcitanje) {
    prethodnoOcitanje = ocitanjeTipke;
    vrijemePromjeneTipke = millis();
  }
  // Pri pokretanju prvo treba otpustiti tipku. Promjena miruje 30 ms.
  if (millis() - vrijemePromjeneTipke >= 30 &&
      ocitanjeTipke != stabilnoStanjeTipke) {
    stabilnoStanjeTipke = ocitanjeTipke;
    return stabilnoStanjeTipke == LOW && tipkaJeBilaOtpustena;
  }
  return false;
}

void iskljuciNamote() {
  for (byte izlaz = 0; izlaz < 4; izlaz++) {
    digitalWrite(PINOVI_NAMOTA[izlaz], LOW);
  }
}

void setup() {
  for (byte izlaz = 0; izlaz < 4; izlaz++) {
    pinMode(PINOVI_NAMOTA[izlaz], OUTPUT);
  }
  iskljuciNamote();
  pinMode(PIN_TIPKE, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  bool noviPritisak = novaTipkaPritisnuta();
  if (noviPritisak && !motorSeKrece) {
    preostaliKoraci = BROJ_KORAKA;
    motorSeKrece = true;
    vrijemeZadnjegKoraka = micros();  // Vrijeme u mikrosekundama.
  }

  if (motorSeKrece &&
      (unsigned long)(micros() - vrijemeZadnjegKoraka) >= RAZMAK_KORAKA_US) {
    vrijemeZadnjegKoraka = micros();
    if (preostaliKoraci == 0) {
      // Zadnja pobuda traje cijeli interval, zatim gasimo namote.
      iskljuciNamote();
      motorSeKrece = false;
      Serial.println(F("GOTOVO"));
    } else {
      faza = (faza + 1) % 8;  // % 8 vraca slijed na 0 nakon 7.
      for (byte izlaz = 0; izlaz < 4; izlaz++) {
        digitalWrite(PINOVI_NAMOTA[izlaz], slijedPobude[faza][izlaz]);
      }
      preostaliKoraci = preostaliKoraci - 1;
    }
  }
}
