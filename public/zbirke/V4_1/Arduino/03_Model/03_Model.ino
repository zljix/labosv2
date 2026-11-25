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
#include <DallasTemperature.h>
class LabServo;
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

// Dio izvornog projekta: Postavke.h

constexpr bool SIMULACIJA=true;
constexpr bool SENZOR_ODOBREN=false;
constexpr bool SERVO_OMOGUCEN=false; // ovdje odobrava samo servo
static_assert(!(SIMULACIJA && SERVO_OMOGUCEN),"Simulacija nema fizicki pogon");
constexpr float KOREKCIJA_C=0.0f;
constexpr int MIN_US=0,MAX_US=0,CLOSED_US=0,OPEN_US=0; // vlastita odobrena kartica
// Prvo stvarni senzor: SIMULACIJA=false, SENZOR_ODOBREN=true, SERVO_OMOGUCEN=false.
// Pohrana: sve tri zastavice false. Najprije potvrdi da signal vise nije aktivan.


// Dio izvornog projekta: V41_C_Model.ino
#include <OneWire.h>
#include <DallasTemperature.h>

// Dio izvornog projekta: LabServoPWM.h

#include <Arduino.h>
#include <esp32-hal-ledc.h>

// Nastavni adapter, nije klasa iz ESP32Servo. Jedan servo na GPIO14.
// Iskljucivo PWM14F_50HZ; ne mijenja sat/frekvenciju zajednickih timera.
// Provjera API rezultata nije mjerenje signala ni fizickog polozaja.
class LabServo {
 public:
  LabServo() = default; // bez GPIO poziva
  LabServo(const LabServo&) = delete;
  LabServo& operator=(const LabServo&) = delete;
  ~LabServo() { detach(); }

  void setPeriodHertz(int hz) { frequency_ = hz; if(hz != 50) detach(); }
  void setTimerWidth(int bits) { bits_ = bits; if(bits != 14) detach(); }
  int readTimerWidth() const { return bits_; }
  bool attached() const { return active_; }
  int readTicks() const { return int(ticks_); }

  bool attach(int pin, int minUs, int maxUs) {
    if(!detach()) return false;
    if(pin != 14 || frequency_ != 50 || bits_ != 14 || minUs < 500 ||
       maxUs > 2500 || minUs >= maxUs) return false;
    min_ = minUs; max_ = maxUs; pin_ = pin;
    if(!ledcAttach(uint8_t(pin_), 50, 14)) { pin_ = -1; return false; }
    allocated_ = true;
    // Ne izdaje polozajni impuls pri inicijalizaciji.
    if(ledcReadFreq(uint8_t(pin_)) != 50 || !ledcWrite(uint8_t(pin_), 0)) {
      detach(); return false;
    }
    active_ = true;
    return true;
  }

  bool writeMicroseconds(int us) {
    if(!active_) return false;
    if(us < min_) us = min_;
    if(us > max_) us = max_;
    const uint32_t duty = (uint32_t(us) * 16384u) / 20000u;
    if(!ledcWrite(uint8_t(pin_), duty)) { detach(); return false; }
    ticks_ = duty;
    return true;
  }

  bool detach() {
    active_ = false; ticks_ = 0;
    if(!allocated_) { pin_ = -1; return true; }
    const bool zeroed = ledcWrite(uint8_t(pin_), 0);
    const bool removed = ledcDetach(uint8_t(pin_));
    if(removed) {
      allocated_ = false;
      pinMode(pin_, OUTPUT); digitalWrite(pin_, LOW);
      pin_ = -1;
    }
    // Ako odvajanje nije uspjelo, nema ponovnog attach ni tvrdnje da je spreman.
    // Kvar/skolsku opasnost rjesava odobreni prekid napajanja na postaji.
    return zeroed && removed;
  }
 private:
  int pin_ = -1, min_ = 500, max_ = 2500, frequency_ = 50, bits_ = 14;
  uint32_t ticks_ = 0;
  bool allocated_ = false, active_ = false;
};


#include <cmath>

// Dio izvornog projekta: Funkcije.h

enum class Target { Closed, Open };
struct Decision { Target target; bool measurementError; };
float correctedTemperature(float raw,float offsetC);
bool shouldClose(float t);
Target automaticTarget(float t,Target previous);
Decision handleSample(bool validSample,float t,Target previous);


// Dio izvornog projekta: Pozivi.h

bool pripremiSenzor(DallasTemperature& ds,DeviceAddress& address){
 ds.begin();
 if(ds.getDeviceCount()!=1 || !ds.getAddress(address,0) || address[0]!=0x28)return false;
 ds.setResolution(address,12);if(ds.getResolution(address)!=12)return false;
 ds.setWaitForConversion(false);return true;
}
float procitajDovrseniPokus(DallasTemperature& ds,DeviceAddress& address){return ds.getTempC(address);}
bool pripremiServo(LabServo& servo,int minUs,int maxUs){
 servo.setPeriodHertz(50);servo.attach(14,minUs,maxUs);
 // PWM14F_50HZ: adapter provjerava LEDC; potvrdi spremnost i sirinu.
 if(servo.attached())servo.setTimerWidth(14);
 if(!servo.attached() || servo.readTimerWidth()!=14){servo.detach();return false;}
 return true;
}


OneWire wire;DallasTemperature ds(&wire);DeviceAddress address{};LabServo servo;
bool sensorReady=false,servoReady=false,pending=false,requested=false,validSample=false;
uint32_t requestAt=0,completedAt=0,sequence=0,startedAt=0;
float value=0;Target target=Target::Closed;int lastPulse=-1;
void setup(){
 Serial.begin(115200); provjeriMojeFunkcije();startedAt=millis();
 if(SIMULACIJA){sensorReady=true;return;}
 if(!SENZOR_ODOBREN)return;
 wire.begin(4);sensorReady=pripremiSenzor(ds,address);
 pinMode(21,OUTPUT);digitalWrite(21,LOW);
 const bool configOK=std::isfinite(KOREKCIJA_C) && MIN_US>=500 && MAX_US<=2500 &&
  MIN_US<MAX_US && CLOSED_US!=OPEN_US && CLOSED_US>=MIN_US && CLOSED_US<=MAX_US &&
  OPEN_US>=MIN_US && OPEN_US<=MAX_US;
 if(sensorReady && SERVO_OMOGUCEN && configOK)servoReady=pripremiServo(servo,MIN_US,MAX_US);
 if(servoReady){servo.writeMicroseconds(CLOSED_US);lastPulse=CLOSED_US;}
}
void dokonci(float raw,bool status){
 bool ok=status && std::isfinite(raw) && raw!=-127.0f && raw>=-55 && raw<=125 && std::isfinite(KOREKCIJA_C);
 float candidate=ok?correctedTemperature(raw,KOREKCIJA_C):NAN;
 validSample=ok && std::isfinite(candidate) && candidate>=-55 && candidate<=125;
 if(validSample)value=candidate;
 completedAt=millis();++sequence;pending=false;
}
void loop(){
 if(!sensorReady){yield();return;}
 uint32_t now=millis();bool updated=false;
 if(pending && uint32_t(now-requestAt)>=750u){
  float raw;
  if(SIMULACIJA){const float values[]={26,27,30,NAN,29,28};const uint32_t phase=uint32_t(now-startedAt)/8000u;raw=values[phase<6u?phase:5u];}
  else raw=procitajDovrseniPokus(ds,address);
  dokonci(raw,true);updated=true;
 }else if(!pending && (!requested || uint32_t(now-requestAt)>=2000u)){
  requested=true;
  if(SIMULACIJA){requestAt=millis();pending=true;}
  else {auto request=ds.requestTemperaturesByAddress(address);requestAt=request.result?request.timestamp:millis();
   if(request.result)pending=true;else{dokonci(NAN,false);updated=true;}}
 }
 now=millis();bool usable=sequence && validSample && uint32_t(now-completedAt)<=6000u;
 Decision d=handleSample(usable,value,target);
 // Okvir ne dopusta zaobici zastitu nedovrsenom ucenickom odlukom.
 if(!usable)d={Target::Closed,true};
 if(d.target!=Target::Open && d.target!=Target::Closed)d={Target::Closed,true};
 target=d.target;
 if(!SIMULACIJA && SENZOR_ODOBREN)digitalWrite(21,target==Target::Open?HIGH:LOW);
 int pulse=target==Target::Open?OPEN_US:CLOSED_US;
 if(servoReady && servo.attached() && pulse>=MIN_US && pulse<=MAX_US && pulse!=lastPulse){
  servo.writeMicroseconds(pulse);lastPulse=pulse;
 }
 if(updated && Serial.availableForWrite()>=110)Serial.printf("%s seq=%lu usable=%d value=%.3f target=%d error=%d servo=%d\n",
  SIMULACIJA?"SIMULACIJA":"SENZOR",(unsigned long)sequence,usable,double(value),int(target),d.measurementError,servoReady);
 yield();
}


// Dio izvornog projekta: Funkcije.cpp

#include <cmath>
float correctedTemperature(float raw,float offsetC){
  return mojaKorekcija(raw, offsetC);
}
bool shouldClose(float t){
  return mojUvjet(t);
}
Target automaticTarget(float t,Target previous){
  if (!std::isfinite(t)) return Target::Closed;
  return mojOtvor(t, previous==Target::Open) ? Target::Open : Target::Closed;
}
Decision handleSample(bool validSample,float t,Target previous){
  if(!validSample || !std::isfinite(t))return {Target::Closed,true};
  return {automaticTarget(t,previous),false};
}

