#include "ulazi.h"
#include "ventil.h"

// Lokalni model isporuke. Jedan događaj po mjerenju, bez mrežnih vjerodajnica.
const char PROTOKOL[] = "HTTP";
struct Poruka { int id; const char* radnja; int starost; };
const Poruka PORUKE[] = {{1,"OPEN",0},{1,"OPEN",0},{2,"CLOSE",4},{3,"X",0},
                        {4,"CLOSE",0},{0,"OFFLINE",0},{0,"WAIT",0},{5,"AUTO",0}};
const unsigned long INTERVAL_MS = 2000;
unsigned long uzorak = 0, zadnjiId = 0;
const char* nacin = "AUTO";
bool automatski = false, alarm = false;

void setup() {
  Serial.begin(115200);
  senzor.begin();
  pinMode(21, OUTPUT);
  pinMode(47, OUTPUT);
  ledcAttach(14, 50, 14);
}

void loop() {
  unsigned long pocetak = millis();
  float t = ocitaj();
  if (isnan(t)) { automatski = false; alarm = true; }
  else {
    automatski = odluka(t, automatski);
    if (t >= 30) alarm = true;
    if (t <= 28) alarm = false;
  }
  Serial.print("device=u07 boot=1 seq="); Serial.print(uzorak + 1);
  Serial.print(" t_ms="); Serial.print(pocetak);
  Serial.print(" T_C="); Serial.println(t);
  const int brojPoruka = sizeof(PORUKE) / sizeof(PORUKE[0]);
  Poruka p = PORUKE[uzorak % brojPoruka];
  unsigned long broj = p.id + 10 * (uzorak / brojPoruka);
  if (!strcmp(p.radnja, "OFFLINE")) {
    Serial.println("OFFLINE: lokalno mjerenje, bez dostave");
    nacin = "AUTO";
  } else if (!strcmp(p.radnja,"WAIT")) {
    Serial.println("WAIT: odgovor još nije stigao");
  } else {
    Serial.println(!strcmp(PROTOKOL,"HTTP") ? "POST /uzorak -> odgovor" : !strcmp(PROTOKOL,"TCP") ? "TCP zapis -> odgovor" : "PUBLISH u07/uzorak <- u07/naredba");
    const char* odgovor;
    if (p.starost > 2) odgovor = "STARA";
    else if (broj <= zadnjiId) odgovor = "DUPLIKAT";
    else if (strcmp(p.radnja,"OPEN") && strcmp(p.radnja,"CLOSE") && strcmp(p.radnja,"AUTO")) odgovor = "NEPOZNATA";
    else { nacin = p.radnja; zadnjiId = broj; odgovor = "PRIHVACENO"; }
    Serial.print("ack_id: "); Serial.print(broj); Serial.print(" "); Serial.print(p.radnja);
    Serial.print(" "); Serial.println(odgovor);
  }
  bool otvoren = !isnan(t) && (!strcmp(nacin,"AUTO") ? automatski : !strcmp(nacin,"OPEN"));
  digitalWrite(21, otvoren);
  digitalWrite(47, alarm);
  ledcWrite(14, otvoren ? 1638 : 819);
  Serial.print("cilj: "); Serial.print(otvoren ? "OPEN" : "CLOSE");
  Serial.print(" alarm: "); Serial.println(alarm);
  ++uzorak;
  unsigned long trajanje = millis() - pocetak;
  if (trajanje < INTERVAL_MS) delay(INTERVAL_MS - trajanje);
}
