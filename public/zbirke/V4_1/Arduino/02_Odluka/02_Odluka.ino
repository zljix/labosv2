/*
  V4.1 - Napiši korekciju i odluku otvora
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  Ucenicke funkcije odmah su ispod ovih uputa; okvir je vec pripremljen.
  2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
  3. Spremi, Verify, Upload; Serial Monitor 115200, zatim RESET.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
  Koraci: 01_Funkcije, 02_Odluka, 03_Model; dokaze lijepi u isti Word.
*/

#include <Arduino.h>
#include <math.h>
constexpr float PRAG_OTVARANJA_C=27.0f;
constexpr float PRAG_ZATVARANJA_C=26.0f;
bool mojOtvor(float temperatura,bool prethodni) {
  // T>=27: true; T<=26: false; izmedju vrati prethodni.
  return false; // DOPUNI
}
// Pripremljena provjera: nevaljano ocitanje zaobilazi ucenicku funkciju.
const float ulazi[]={27.0f,26.5f,26.0f,NAN};
unsigned korak=0;bool cilj=false;uint32_t last=0;
void setup(){Serial.begin(115200);last=millis()-2000u;}
void loop(){
  if(uint32_t(millis()-last)<2000u){delay(1);return;}
  last=millis();if(korak==0)cilj=false;
  float t=ulazi[korak];bool valjano=isfinite(t);
  cilj=valjano?mojOtvor(t,cilj):false;
  if(valjano)Serial.printf("PROVJERA OTVOR %.1f %s\n",t,cilj?"OPEN":"CLOSED");
  else Serial.printf("PROVJERA OTVOR NEVALJANO %s\n",cilj?"OPEN":"CLOSED");
  korak=(korak+1)%4;
}
