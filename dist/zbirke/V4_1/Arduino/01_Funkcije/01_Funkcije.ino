/*
  V4.1 - Napiši korekciju i odluku otvora
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  Ucenicke funkcije odmah su ispod ovih uputa; okvir je vec pripremljen.
  2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
  3. Spremi, Verify, Upload; Serial Monitor 115200, zatim RESET.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
*/
#include <Arduino.h>
#include <math.h>
#include <cstring>
// Najave tipova za Arduino IDE; pripremljeni dio.
enum class Target; enum class Action;
struct Config; struct Reading; struct AlarmBlink; struct Decision;
// UCENIK - vlastite kratke funkcije ove vjezbe
constexpr float PRAG_OTVARANJA_C = 27.0f;
constexpr float PRAG_ZATVARANJA_C = 26.0f;
float mojaKorekcija(float sirovo, float korekcija) {
  // Vrati zbroj dvaju ulaza.
  return NAN; // DOPUNI
}
bool mojUvjet(float temperatura) {
  // Vrati je li temperatura <= 26.0.
  return false; // DOPUNI
}
bool mojOtvor(float temperatura, bool prethodni) {
  // true je OPEN; false je CLOSED; izmedju pragova pamti prethodni.
  return false; // DOPUNI
}
bool mojAlarm(float temperatura, bool prethodni) {
  // 30 i vise ukljucuje; 28 i manje iskljucuje; izmedju pamti.
  if (temperatura >= 30.0f) return true;
  if (temperatura <= 28.0f) return false;
  return prethodni;
}
bool mojaNaredba(const char* tekst, size_t n) {
  // Dopustene su tocno OPEN, CLOSE i AUTO. Dovrsi logicki izraz.
  return (n==4 && std::memcmp(tekst,"OPEN",4)==0) ||
         (n==5 && std::memcmp(tekst,"CLOSE",5)==0) ||
         (n==4 && std::memcmp(tekst,"AUTO",4)==0);
}
// KRAJ UCENICKIH FUNKCIJA
void provjeriMojeFunkcije() {
  Serial.printf("PROVJERA KOREKCIJA 24.8+0.5=%.2f; 26+0=%.2f\n",mojaKorekcija(24.8f,0.5f),mojaKorekcija(26.0f,0.0f));
  Serial.printf("PROVJERA UVJET 25.9=%d; 26.1=%d\n",mojUvjet(25.9f),mojUvjet(26.1f));
  bool cilj=false;
  for(float t : {27.0f,26.5f,26.0f}) {cilj=mojOtvor(t,cilj);Serial.printf("PROVJERA OTVOR T=%.1f cilj=%s\n",t,cilj?"OPEN":"CLOSED");}
  Serial.println("PROVJERA OTVOR nevaljano cilj=CLOSED (zastita okvira)");
  Serial.printf("PROVJERA IZ CLOSED T27=%s T28=%s\n",mojOtvor(27,false)?"OPEN":"CLOSED",mojOtvor(28,false)?"OPEN":"CLOSED");
  bool alarm=false;
  for(float t : {30.0f,29.0f,28.0f}) {alarm=mojAlarm(t,alarm);Serial.printf("PROVJERA ALARM T=%.1f alarm=%s\n",t,alarm?"ON":"OFF");}
}


// Dio izvornog projekta: C4_01_Funkcije.ino

// Dio izvornog projekta: Funkcije.h

float correctedTemperature(float raw,float offsetC);
bool shouldClose(float t);


#include <cmath>
// Samo racunski pokus M1/M2/M3. Nema senzora ni GPIO poziva.
void setup(){Serial.begin(115200); provjeriMojeFunkcije();}
void loop(){
  static uint32_t last=0;
  if(uint32_t(millis()-last)<2000u)return;last=millis();
  if(Serial.availableForWrite()<120)return;
  bool m1=std::fabs(correctedTemperature(24.8f,0.5f)-25.3f)<0.001f &&
          std::fabs(correctedTemperature(25.4f,-0.5f)-24.9f)<0.001f &&
          correctedTemperature(26.0f,0.0f)==26.0f;
  bool m2=shouldClose(25.9f)&&shouldClose(26.0f)&&!shouldClose(26.1f);
  Serial.printf("M1=%s M2=%s; SIMULACIJA, bez GPIO\n",m1?"PASS":"FAIL",m2?"PASS":"FAIL");
}


// Dio izvornog projekta: Funkcije.cpp

#include <cmath>
float correctedTemperature(float raw,float offsetC) {
  return mojaKorekcija(raw, offsetC);
}
bool shouldClose(float t) {
  return mojUvjet(t);
}

