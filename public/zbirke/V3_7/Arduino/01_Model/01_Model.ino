/*
  V3.7 - Demonstriraj prototip i napiši kratku uputu
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  POKUS=0: stvarni senzor; POKUS=1/2: pripremljeni SIM niz iz Worda.
  2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
  3. Spremi, Verify, Upload; Serial Monitor 115200, zatim RESET.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
*/

// Dio izvornog projekta: Postavke.h
#define POKUS 0

#include <Arduino.h>

// UREDI U ARDUINO IDE-U, PREVEDI I PONOVNO PRENESI PROGRAM.
// Serial Monitor (115200 baud) sluzi samo promatranju ispisa.
namespace Postavke {
constexpr char UREDAJ_ID[] = "u07"; // Dodjeljuje nastavnik; nije vjerodajnica.
// UCENIK: mijenjaj jednu vrijednost po pokusu i zabiljezi ocekivanje.
constexpr uint32_t INTERVAL_MJERENJA_MS = 2000; // Dopusteno: 2000 ili 3000.
constexpr float ODOBRENA_KOREKCIJA_C = 0.0f;
constexpr float KOREKCIJA_C = POKUS > 0 ? 0.0f : ODOBRENA_KOREKCIJA_C;             // Samo prethodno odobrena korekcija.
constexpr float ALARM_UKLJUCI_C = 30.0f;
constexpr float ALARM_ISKLJUCI_C = 28.0f;
constexpr bool ISPITNI_ULAZ = (POKUS > 0);           // false = stvarni DS18B20.

// Za simulaciju postavi ISPITNI_ULAZ=true i KOREKCIJA_C=0.0f.
// Vrijednost zadaje SIROVU temperaturu; korekcija se dodaje i u simulaciji.
// Nevaljano stvara pogresku; BezNovihUzoraka ne osvjezava staro mjerenje.
enum class VrstaUzorka { Vrijednost, Nevaljano, BezNovihUzoraka };
struct IspitniKorak {
  uint32_t trajanjeMs;
  VrstaUzorka vrsta;
  float sirovaC;
};
#if POKUS == 1
constexpr IspitniKorak ISPITNI_NIZ[] = {
  {8000, VrstaUzorka::BezNovihUzoraka, 0.0f},
  {8000, VrstaUzorka::Vrijednost, 27.0f},
  {8000, VrstaUzorka::Vrijednost, 26.5f},
  {8000, VrstaUzorka::Vrijednost, 26.0f},
  {8000, VrstaUzorka::Vrijednost, 26.5f},
  {8000, VrstaUzorka::Vrijednost, 27.0f},
  {8000, VrstaUzorka::Nevaljano, 0.0f},
  {8000, VrstaUzorka::Vrijednost, 26.5f},
};
#else
constexpr IspitniKorak ISPITNI_NIZ[] = {{4000, VrstaUzorka::Vrijednost, 26.0f}};
#endif
// Posljednji korak ostaje aktivan nakon zavrsetka niza. Reset ponavlja cijeli niz.
constexpr size_t BROJ_ISPITNIH_KORAKA = sizeof(ISPITNI_NIZ)/sizeof(ISPITNI_NIZ[0]);

// P05: odabir se primjenjuje JEDNOM, nakon prvog valjanog mjerenja.
// Pocetak je uvijek zatvoren. Greska ponistava rucni zahtjev; oporavak ostaje AUTO.
// P13/P14 zanemaruju ovu pocetnu lokalnu postavku: njima upravlja mrezna aplikacija.
enum class LokalniNacin { AUTO, OPEN, CLOSE };
constexpr LokalniNacin POCETNI_LOKALNI_NACIN = LokalniNacin::AUTO;

// NASTAVNIK: prema podatkovnom listu i rasterecenom mehanizmu odobri
// granice i polozaje u MIKROSEKUNDAMA; nula nije odobren polozaj.
// Impulsi su 50 Hz. Numericka provjera nije dokaz mehanicke sigurnosti.
constexpr bool SERVO_OMOGUCEN = false;
constexpr int SERVO_MIN_US = 0;
constexpr int SERVO_MAX_US = 0;
constexpr int SERVO_ZATVORENO_US = 0;
constexpr int SERVO_OTVORENO_US = 0;


// PROVJERE: ove retke ne mijenjaj radi zaobilazenja prijavljene pogreske.
static_assert(INTERVAL_MJERENJA_MS==2000 || INTERVAL_MJERENJA_MS==3000,
              "INTERVAL_MJERENJA_MS mora biti 2000 ili 3000.");
static_assert(KOREKCIJA_C>=-20.0f && KOREKCIJA_C<=20.0f,
              "KOREKCIJA_C mora biti konacna i u rasponu -20..20.");
static_assert(ALARM_ISKLJUCI_C>=-55.0f && ALARM_UKLJUCI_C<=125.0f &&
              ALARM_ISKLJUCI_C<ALARM_UKLJUCI_C,
              "Alarm zahtijeva -55 <= donji < gornji <= 125.");
static_assert(!SERVO_OMOGUCEN ||
              (SERVO_MIN_US>=500 && SERVO_MAX_US<=2500 &&
               SERVO_MIN_US<SERVO_MAX_US &&
               SERVO_ZATVORENO_US>=SERVO_MIN_US && SERVO_ZATVORENO_US<=SERVO_MAX_US &&
               SERVO_OTVORENO_US>=SERVO_MIN_US && SERVO_OTVORENO_US<=SERVO_MAX_US &&
               SERVO_ZATVORENO_US!=SERVO_OTVORENO_US),
              "Prije omogucivanja serva unesi odobrene, razlicite polozaje i granice.");
static_assert(POCETNI_LOKALNI_NACIN==LokalniNacin::AUTO ||
              POCETNI_LOKALNI_NACIN==LokalniNacin::OPEN ||
              POCETNI_LOKALNI_NACIN==LokalniNacin::CLOSE,
              "Nevaljan pocetni lokalni nacin.");
constexpr bool ispravanIspitniNiz() {
  if(BROJ_ISPITNIH_KORAKA==0) return false;
  for(const auto &k:ISPITNI_NIZ) {
    if(k.trajanjeMs<1000 || k.trajanjeMs>60000) return false;
    if(k.vrsta==VrstaUzorka::Vrijednost) {
      if(!(k.sirovaC>=-55.0f && k.sirovaC<=125.0f)) return false;
    } else if(k.vrsta!=VrstaUzorka::Nevaljano && k.vrsta!=VrstaUzorka::BezNovihUzoraka) return false;
  }
  return true;
}
static_assert(ispravanIspitniNiz(),"Provjeri vrstu, trajanje i temperaturu ispitnih koraka.");
} // namespace Postavke


// Dio izvornog projekta: P05_Model.ino

// Dio izvornog projekta: ModelCore.h

// Nastavni model s oznacenim postavkama i kratkom alarmnom funkcijom. Arduino-ESP32 3.x; kamera i prosirna ploca odspojene.
#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>
#include <esp_system.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include <math.h>


// Dio izvornog projekta: Zadatak.h

// UCENICKI DIO: procitaj, promijeni zadani prag na pocetku programa ili jednu
// oznacenu usporedbu, predvidi granicne rezultate, prevedi i ponovno prenesi.
// Za referentni primjer ukljucive su granice >= gornji i <= donji.
// Vrati ovu provjerenu verziju nakon usporednog pokusa.
// Okvir ovu funkciju poziva SAMO za valjanu i svjezu korigiranu temperaturu.
// Nevaljan podatak ne smije se pretvoriti u nulu niti izbrisati memoriju alarma.
inline bool alarmniUvjet(float t, bool prethodno) {
  if (t >= Postavke::ALARM_UKLJUCI_C) {   // OZNACENA USPOREDBA UKLJUCIVANJA
    return true;
  }
  if (t <= Postavke::ALARM_ISKLJUCI_C) {  // OZNACENA USPOREDBA POVRATKA
    return false;
  }
  return prethodno;                     // PAMCENJE U PODRUCJU HISTEREZE
}


// Dio izvornog projekta: LabRecord.h

#include <stdint.h>
#include <stddef.h>
#include <cmath>
#include <cstdio>
// Zadana infrastruktura v5. Lokalni sat, intervali kraci od polovine opsega.
struct LabRecord {
  bool hasSample=false, hasAttempt=false, attemptValid=false;
  uint32_t sampleSeq=0, sampleTimeMs=0, attemptTimeMs=0;
  float sampleValue=0;
  void complete(float value, bool valid, uint32_t now) {
    hasAttempt=true; attemptTimeMs=now;
    attemptValid=valid && std::isfinite(value) && value>=-55.0f && value<=125.0f;
    if(attemptValid){hasSample=true; ++sampleSeq; sampleTimeMs=now; sampleValue=value;}
  }
  const char* sampleStatus(uint32_t now, uint32_t maximum=6000) const {
    return !hasSample?"UNKNOWN":uint32_t(now-sampleTimeMs)>maximum?"STALE":"VALID";
  }
  const char* attemptStatus() const {return !hasAttempt?"UNKNOWN":attemptValid?"VALID":"INVALID";}
  bool usable(uint32_t now) const {return hasSample && attemptValid && uint32_t(now-sampleTimeMs)<=6000u;}
  // JSON fragment; no credentials, no comparison of clocks on different devices.
  bool json(char* out, size_t capacity, uint32_t now) const {
    char st[24]="null",sa[24]="null",at[24]="null",aa[24]="null",v[32]="null";
    if(hasSample){std::snprintf(st,sizeof(st),"%lu",(unsigned long)sampleTimeMs);
      std::snprintf(sa,sizeof(sa),"%lu",(unsigned long)(now-sampleTimeMs));
      std::snprintf(v,sizeof(v),"%.3f",double(sampleValue));}
    if(hasAttempt){std::snprintf(at,sizeof(at),"%lu",(unsigned long)attemptTimeMs);
      std::snprintf(aa,sizeof(aa),"%lu",(unsigned long)(now-attemptTimeMs));}
    int n=std::snprintf(out,capacity,
      "\"sample_seq\":%lu,\"sample_time_ms\":%s,\"sample_age_ms\":%s,\"attempt_time_ms\":%s,\"attempt_age_ms\":%s,\"sample_value\":%s,\"sample_unit\":\"degC\",\"sample_status\":\"%s\",\"attempt_status\":\"%s\",\"control_usable\":%s,\"message_age_ms\":null,\"message_age_reason\":\"UNSYNCHRONIZED_CLOCKS\",\"estimated_state\":\"UNKNOWN\",\"physical_state\":\"UNKNOWN\"",
      (unsigned long)sampleSeq,st,sa,at,aa,v,sampleStatus(now),attemptStatus(),usable(now)?"true":"false");
    return n>0 && size_t(n)<capacity;
  }
};


static String nonce16() {
  char b[17]; snprintf(b,sizeof(b),"%08lx%08lx",(unsigned long)esp_random(),(unsigned long)esp_random());
  return String(b);
}
static SemaphoreHandle_t modelMutex=nullptr;
struct ModelLock {
  ModelLock(){ xSemaphoreTake(modelMutex,portMAX_DELAY); }
  ~ModelLock(){ xSemaphoreGive(modelMutex); }
};

class ModelCore {
 public:
  static constexpr uint8_t DQ=4, SERVO=14, TARGET_LED=21, ALARM_LED=47;
  OneWire wire{DQ};
  DallasTemperature ds{&wire};
  DeviceAddress address{};
  bool sensorFound=false, pending=false, requested=false;
  bool test=Postavke::ISPITNI_ULAZ, simulationStarted=false, simulationFinished=false;
  size_t simulationStep=0;
  uint32_t simulationBootMs=0,simulationStepMs=0;
  bool initialLocalModeApplied=false;
  String initialLocalResult="WAITING_FOR_VALID_SAMPLE";
  bool hasGood=false, latestGood=false, targetOpen=false, manual=false;
  bool alarmMemory=false, armed=false, servoConfigured=false;
  bool appOnline=false, supervised=false;
  uint32_t networkEpoch=0, lastHeartbeatMs=0;
  uint32_t requestMs=0, lastGoodMs=0, lastTestMs=0, seq=0, periodMs=Postavke::INTERVAL_MJERENJA_MS;
  float raw=NAN, value=NAN, offset=Postavke::KOREKCIJA_C;
  int minUs=0,maxUs=0,closedUs=0,openUs=0,lastPulse=-1;
  String bootId;
  LabRecord record;

  void begin(bool useNetwork=false) {
    supervised=useNetwork; bootId=nonce16();
    pinMode(TARGET_LED,OUTPUT); digitalWrite(TARGET_LED,LOW);
    pinMode(ALARM_LED,OUTPUT); digitalWrite(ALARM_LED,LOW);
    pinMode(SERVO,INPUT); // Bez impulsa dok nastavnik ne odobri konfiguraciju u kodu.
    minUs=Postavke::SERVO_MIN_US; maxUs=Postavke::SERVO_MAX_US;
    closedUs=Postavke::SERVO_ZATVORENO_US; openUs=Postavke::SERVO_OTVORENO_US;
    servoConfigured=minUs>=500 && maxUs<=2500 && minUs<maxUs &&
      closedUs>=minUs && closedUs<=maxUs && openUs>=minUs && openUs<=maxUs && closedUs!=openUs;
    if(Postavke::SERVO_OMOGUCEN && servoConfigured) {
      armed=ledcAttach(SERVO,50,14);
      if(armed) outputs(millis());
    }
    if(!test){ds.begin(); ds.setWaitForConversion(false); ds.setAutoSaveScratchPad(false);}
    simulationBootMs=millis();
    if(supervised) initialLocalResult="REMOTE_MODEL_STARTS_AUTO";
  }
  bool valid(uint32_t now) const {
    return hasGood && latestGood && uint32_t(now-lastGoodMs)<=6000u;
  }
  const char *readingStatus(uint32_t now) const {
    if(!latestGood) return hasGood?"INVALID":"UNAVAILABLE";
    return uint32_t(now-lastGoodMs)>6000u?"STALE":"VALID";
  }
  void decide(uint32_t now) {
    if(!valid(now)){ manual=false; targetOpen=false; return; }
    if(!manual) {
      if(value>=27.0f) targetOpen=true;
      else if(value<=26.0f) targetOpen=false;
    }
    alarmMemory=alarmniUvjet(value,alarmMemory);
  }
  void completed(float t, bool ok, uint32_t now) {
    ++seq; raw=t;
    latestGood=ok && isfinite(t) && t>=-55.0f && t<=125.0f &&
               isfinite(t+offset) && t+offset>=-55.0f && t+offset<=125.0f;
    if(latestGood){ value=t+offset; hasGood=true; lastGoodMs=now; }
    else value=NAN;
    record.complete(value,latestGood,now);
    decide(now);
  }
  void invalidate() { latestGood=false; value=NAN; raw=NAN; manual=false; targetOpen=false; }
  void networkLost() {
    if(appOnline) { appOnline=false; ++networkEpoch; }
    manual=false; decide(millis());
  }
  void heartbeat(uint32_t now) { appOnline=true; lastHeartbeatMs=now; }
  void outputs(uint32_t now) {
    digitalWrite(TARGET_LED,targetOpen?HIGH:LOW);
    digitalWrite(ALARM_LED,valid(now)?(alarmMemory?HIGH:LOW):((now/250u)%2u?HIGH:LOW));
    if(armed) {
      const int pulse=targetOpen?openUs:closedUs;
      if(pulse!=lastPulse) {
        // PWM14F_50HZ: 14 bita i cjelobrojno odsijecanje, jednako P04/C4 Servo sloju.
        uint32_t duty=(uint32_t(pulse)*16384u)/20000u;
        if(ledcWrite(SERVO,duty)) lastPulse=pulse;
        else { ledcDetach(SERVO); pinMode(SERVO,INPUT); armed=false; lastPulse=-1; }
      }
    }
  }
  void simulate(uint32_t now) {
    bool stepChanged=false;
    if(!simulationStarted) {
      // Vidljiv pocetak bez valjanog mjerenja; isti statusni ugovor kao senzor.
      if(uint32_t(now-simulationBootMs)<750u) return;
      simulationStarted=true; simulationStepMs=now; stepChanged=true;
    }
    const auto *step=&Postavke::ISPITNI_NIZ[simulationStep];
    if(uint32_t(now-simulationStepMs)>=step->trajanjeMs) {
      if(simulationStep+1<Postavke::BROJ_ISPITNIH_KORAKA) {
        ++simulationStep; simulationStepMs=now; step=&Postavke::ISPITNI_NIZ[simulationStep];stepChanged=true;
      } else simulationFinished=true;
    }
    if(step->vrsta==Postavke::VrstaUzorka::BezNovihUzoraka) return;
    if(stepChanged || uint32_t(now-lastTestMs)>=periodMs) {
      const bool ok=step->vrsta==Postavke::VrstaUzorka::Vrijednost;
      completed(ok?step->sirovaC:NAN,ok,now);lastTestMs=now;
    }
  }
  void tick() {
    uint32_t now=millis();
    if(supervised && appOnline && uint32_t(now-lastHeartbeatMs)>6000u) networkLost();
    if(test) {
      simulate(now);
    } else if(pending) {
      if(uint32_t(now-requestMs)>=750u) {
        float t=sensorFound?ds.getTempC(address):NAN;
        completed(t,sensorFound && t!=DEVICE_DISCONNECTED_C,millis()); pending=false;
      }
    } else if(!requested || uint32_t(now-requestMs)>=periodMs) {
      // Ovaj spoj zahtijeva tocno jedan DS18B20 s vlastitim VDD napajanjem.
      // Pretraga obnavlja popis nakon fizickog odspajanja/ponovnog spajanja.
      // Rezolucija se ne zapisuje u EEPROM u svakoj iteraciji.
      // DallasTemperature::begin() nekih inacica ima namjerne stanke i
      // pamti detektirano parazitno napajanje. Zato ovdje izravno pretrazujemo
      // 1-Wire i provjeravamo tocno jedan ROM; ne zovemo begin u svakoj petlji.
      DeviceAddress other{};
      wire.reset_search();
      sensorFound=wire.search(address) && OneWire::crc8(address,7)==address[7] &&
                  address[0]==0x28 && !wire.search(other);
      ds.setOneWire(&wire); ds.setWaitForConversion(false); ds.setAutoSaveScratchPad(false);
      sensorFound=sensorFound && !ds.readPowerSupply(address);
      if(sensorFound) {
        ds.setResolution(address,12,true);
        sensorFound=ds.getResolution(address)==12;
      }
      bool started=false;
      requestMs=millis();
      if(sensorFound) {
        const auto request=ds.requestTemperaturesByAddress(address);
        started=request.result;
        requestMs=started?request.timestamp:millis();
      }
      requested=true; pending=started;
      if(!started) completed(NAN,false,requestMs);
    }
    now=millis(); decide(now);
    if(!supervised && !initialLocalModeApplied && valid(now)) {
      initialLocalModeApplied=true;
      const auto mode=Postavke::POCETNI_LOKALNI_NACIN;
      initialLocalResult=action(mode==Postavke::LokalniNacin::OPEN?"OPEN":
                                mode==Postavke::LokalniNacin::CLOSE?"CLOSE":"AUTO");
    }
    outputs(millis());
  }
  String action(const String &cmd) {
    decide(millis());
    if(cmd=="AUTO") { manual=false; decide(millis()); outputs(millis()); return "OK"; }
    if(cmd!="OPEN" && cmd!="CLOSE") return "BAD_ACTION";
    if(!valid(millis())) return "INVALID_MEASUREMENT";
    manual=true; targetOpen=(cmd=="OPEN"); outputs(millis()); return "OK";
  }
  void fill(JsonDocument &doc) const {
    const uint32_t now=millis(); const bool good=valid(now);
    doc["device_id"]=Postavke::UREDAJ_ID;
    doc["boot_id"]=bootId; doc["seq"]=seq; doc["attempt_seq"]=seq; doc["source"]=test?"test":"sensor";
    if(isfinite(raw)) doc["raw_c"]=raw; else doc["raw_c"]=nullptr;
    if(good) doc["temperature_c"]=value; else doc["temperature_c"]=nullptr;
    doc["valid"]=good; doc["reading_status"]=readingStatus(now);
    if(hasGood) doc["sample_age_ms"]=uint32_t(now-lastGoodMs); else doc["sample_age_ms"]=nullptr;
    doc["mode"]=manual?"MANUAL":"AUTO"; doc["target"]=targetOpen?"OPEN":"CLOSED";
    doc["alarm"]=good?(alarmMemory?"ON":"OFF"):"UNKNOWN";
    doc["alarm_state"]=good?(alarmMemory?"ON":"OFF"):"UNKNOWN";
    doc["communication_state"]=!supervised?"UNKNOWN":appOnline?"ONLINE":"OFFLINE";
    doc["alarm_memory"]=alarmMemory; doc["actuatorArmed"]=armed;
    doc["servo_configured"]=servoConfigured; doc["offset_c"]=offset; doc["period_ms"]=periodMs;
    doc["app_online"]=appOnline; doc["uptime_ms"]=now;
    doc["physical_position_verified"]=false;
    doc["sample_seq"]=record.sampleSeq;
    if(record.hasSample){doc["sample_time_ms"]=record.sampleTimeMs; doc["sample_value"]=record.sampleValue;}
    else{doc["sample_time_ms"]=nullptr; doc["sample_value"]=nullptr;}
    if(record.hasAttempt){doc["attempt_time_ms"]=record.attemptTimeMs; doc["attempt_age_ms"]=uint32_t(now-record.attemptTimeMs);}
    else{doc["attempt_time_ms"]=nullptr; doc["attempt_age_ms"]=nullptr;}
    doc["sample_unit"]="degC"; doc["sample_status"]=record.sampleStatus(now);
    doc["attempt_status"]=record.attemptStatus(); doc["control_usable"]=good;
    doc["message_age_ms"]=nullptr; doc["message_age_reason"]="UNSYNCHRONIZED_CLOCKS";
    doc["target_state"]=targetOpen?"OPEN":"CLOSED";
    doc["estimated_state"]="UNKNOWN"; doc["physical_state"]="UNKNOWN";
    doc["alarm_on_c"]=Postavke::ALARM_UKLJUCI_C;doc["alarm_off_c"]=Postavke::ALARM_ISKLJUCI_C;
    if(test && simulationStarted)doc["test_step"]=simulationStep+1;else doc["test_step"]=nullptr;
    doc["test_finished"]=simulationFinished;doc["initial_local_result"]=initialLocalResult;
  }
  String status() const { JsonDocument d; fill(d); String s; serializeJson(d,s); return s; }

};
static ModelCore model;
static void localControlTask(void *) {
  TickType_t wake=xTaskGetTickCount();
  for(;;){ { ModelLock lock; model.tick(); } vTaskDelayUntil(&wake,pdMS_TO_TICKS(10)); }
}
static bool startModel(bool network=false) {
  modelMutex=xSemaphoreCreateMutex(); if(!modelMutex) return false;
  model.begin(network);
  return xTaskCreatePinnedToCore(localControlTask,"lokalni_model",8192,nullptr,2,nullptr,1)==pdPASS;
}


void setup() {
  Serial.begin(115200);
  if(!startModel(false)){Serial.println("FATAL: lokalni zadatak nije pokrenut.");while(true)delay(1000);}
  Serial.println("P05 MODEL | DQ4 SERVO14 LED21 ALARM47");
  Serial.println("Ovaj program: uredi oznaceno, prevedi i prenesi. Serial je samo izlaz.");
  Serial.println(Postavke::SERVO_OMOGUCEN?"Servo: nastavnicka konfiguracija u kodu.":"Servo: iskljucen, pokus se moze pratiti LED-ovima.");
}
void loop() {
  static uint32_t last=0;
  if(uint32_t(millis()-last)>=1000u){last=millis();String s;{ModelLock lock;s=model.status();}Serial.println(s);}
  delay(2);
}


