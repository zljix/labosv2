/*
  V4.4 - Mjerenje tijekom čekanja mrežnog odgovora
  Potvrdi CLOSE i ACK -> Pauziraj nadzor -> vise od 6 s OFFLINE/AUTO -> Obnovi nadzor: ONLINE/AUTO, bez stare naredbe.
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
#include <espMqttClientAsync.h>
namespace MqttTip=espMqttClientTypes;
// Najave tipova za Arduino IDE; pripremljeni dio.
enum class Target; enum class Action;
struct Config; struct Reading; struct AlarmBlink; struct Decision;
// UCENIK - vlastite kratke funkcije ove vjezbe
constexpr float PRAG_OTVARANJA_C = 27.0f;
constexpr float PRAG_ZATVARANJA_C = 26.0f;
float mojaKorekcija(float sirovo, float korekcija) {
  // Vrati zbroj dvaju ulaza.
  return sirovo + korekcija;
}
bool mojUvjet(float temperatura) {
  // Vrati je li temperatura <= 26.0.
  return temperatura <= 26.0f;
}
bool mojOtvor(float temperatura, bool prethodni) {
  // true je OPEN; false je CLOSED; izmedju pragova pamti prethodni.
  if (temperatura >= PRAG_OTVARANJA_C) return true;
  if (temperatura <= PRAG_ZATVARANJA_C) return false;
  return prethodni;
}
bool mojAlarm(float temperatura, bool prethodni) {
  // 30 i vise ukljucuje; 28 i manje iskljucuje; izmedju pamti.
  if (temperatura >= 30.0f) return true;
  if (temperatura <= 28.0f) return false;
  return prethodni;
}
bool mojaNaredba(const char* tekst, size_t n) {
  // Dopustene su tocno OPEN, CLOSE i AUTO. Dovrsi logicki izraz.
  return false; // DOPUNI
}
// KRAJ UCENICKIH FUNKCIJA
void provjeriMojeFunkcije() {
  Serial.printf("PROVJERA KOREKCIJA 24.8+0.5=%.2f; 26+0=%.2f\n",mojaKorekcija(24.8f,0.5f),mojaKorekcija(26.0f,0.0f));
  Serial.printf("PROVJERA UVJET 25.9=%d; 26.1=%d\n",mojUvjet(25.9f),mojUvjet(26.1f));
  bool cilj=false;
  for(float t : {27.0f,26.5f,26.0f}) {cilj=mojOtvor(t,cilj);Serial.printf("PROVJERA OTVOR T=%.1f cilj=%s\n",t,cilj?"OPEN":"CLOSED");}
  const float losUlaz=NAN; const bool losCilj=isfinite(losUlaz)?mojOtvor(losUlaz,true):false;
  Serial.printf("PROVJERA OTVOR nevaljano cilj=%s (zastita okvira)\n",losCilj?"OPEN":"CLOSED");
  Serial.printf("PROVJERA IZ CLOSED T27=%s T28=%s\n",mojOtvor(27,false)?"OPEN":"CLOSED",mojOtvor(28,false)?"OPEN":"CLOSED");
  bool alarm=false;
  for(float t : {30.0f,29.0f,28.0f}) {alarm=mojAlarm(t,alarm);Serial.printf("PROVJERA ALARM T=%.1f alarm=%s\n",t,alarm?"ON":"OFF");}
}

// MREZNE POSTAVKE
constexpr char UREDJAJ[]="u07";
constexpr char WIFI_SSID[]="";
constexpr char WIFI_LOZINKA[]="";
constexpr char BROKER_IP[]="";
constexpr char MQTT_KORISNIK[]="";
constexpr char MQTT_LOZINKA[]="";

// Dio izvornog projekta: VentModel.h

#include <stdint.h>
#include <stddef.h>

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


enum class Target { Closed, Open };
struct Config {
  float offsetC;
  int closedUs, openUs, minPulseUs, maxPulseUs, frequencyHz;
  bool servoEnabled = false;
};
enum class ReadingStatus { NotReady, Valid, Invalid };
struct Reading {
  ReadingStatus status = ReadingStatus::NotReady;
  float valueC = 0;
  uint32_t sequence = 0, completedAtMs = 0;
  LabRecord record;
};
enum class InitStatus { Ready, BadConfig, SensorUnavailable, ServoUnavailable };
enum class PollStatus { NotReady, Idle, Busy, Updated };
enum class CommandStatus { Accepted, NotReady, BadTarget };
struct SensorRequest { bool result; uint32_t timestamp; };

// Konstruktor i ove zamjene pripadaju okviru. Konstruktor ne pristupa GPIO-u.
// Sve vremenske oznake jednoga pokusa moraju pripadati istom satu.
class VentHardware {
 public:
  virtual ~VentHardware() = default;
  virtual uint32_t now() const = 0;
  virtual bool sensorBegin() = 0;
  virtual bool servoBegin(const Config&) = 0;
  virtual bool servoAttached() const = 0;
  virtual SensorRequest request() = 0;
  virtual float readRaw() = 0;
  virtual void writePulse(int) = 0;
  virtual void targetLed(bool) = 0;
};

float correctedTemperature(float raw, float offsetC);                 // M1
bool shouldClose(float t);                                           // M2
Target automaticTarget(float t, Target previous);
bool validConfig(const Config&);
bool correctedTemperature(float raw, float offsetC, float& out);
bool selectPulse(Target, const Config&, int& out);
bool usableReading(const Reading&, uint32_t now);

class VentModel {
 public:
  explicit VentModel(VentHardware& hw) : hw_(hw) {}
  InitStatus begin(const Config&);
  PollStatus tick(uint32_t now);
  Reading reading() const { return last_; }
  CommandStatus setTarget(Target);
  Target target() const { return target_; }
 private:
  VentHardware& hw_;
  Config config_{};
  bool ready_ = false, pending_ = false, hasRequested_ = false;
  uint32_t requestedAt_ = 0;
  Target target_ = Target::Closed;
  Reading last_{};
};

enum class Action { Open, Close, Auto };
bool parseAction(const char* text, size_t length, Action& out);        // M4
bool alarmAfterValidSample(float t, bool previous);                   // M5
struct AlarmBlink {
  bool inUnknown = false, level = false;
  uint32_t changedAtMs = 0;
};
bool alarmLedLevel(bool usable, bool memory, uint32_t now, AlarmBlink&);

// Projekt B potrosi događaj jednom i kad ga odbije. Pozivatelj salje isNew
// samo jednom; povrat funkcije nije mjerenje fizickog polozaja.
Target manualTestTarget(const Reading&, uint32_t now, Target previous,
                        bool isNew, Target requested);


// Dio izvornog projekta: Postavke.h

// Za prve pokuse ostaje SIMULACIJA=true. Nema stvarnog GPIO izlaza.
constexpr bool SIMULACIJA = true;
constexpr bool SENZOR_ODOBREN = false;
static_assert(!(SIMULACIJA && SENZOR_ODOBREN), "Odaberi samo jedan izvor");
// Servo je neovisan o senzoru. Nule se zamjenjuju odobrenim impulsima samo za servo.
constexpr bool SERVO_OMOGUCEN = false;
constexpr Config ODOBRENI_MODEL{0.0f, 0, 0, 0, 0, 50, SERVO_OMOGUCEN};
// Za kopiju za pohranu: SIMULACIJA=false i SENZOR_ODOBREN=false.


// Dio izvornog projekta: C4_04_Asinkrono.ino

// Dio izvornog projekta: Mreza.h

// Dio izvornog projekta: C4App.h

#ifdef ARDUINO
#include <Arduino.h>
#include <WiFi.h>
#include <espMqttClientAsync.h>

// Dio izvornog projekta: C4Core.h

#include <cstring>

namespace c4 {
constexpr size_t MaxPayload = 192, MaxTopic = 64, QueueSize = 4;
constexpr uint32_t Lifetime = 6000;
struct Packet {
  char topic[MaxTopic]{}, payload[MaxPayload + 1]{};
  size_t length = 0;
  uint32_t receivedAt = 0, epoch = 0;
  bool usableAtArrival = false;
};
struct FragmentInfo { uint16_t packetId; uint8_t qos; bool retain; };
enum class FragmentResult { Partial, Complete, Rejected };
class Assembler {
 public:
  FragmentResult add(FragmentInfo, const char*, const uint8_t*, size_t len,
                     size_t index, size_t total, uint32_t now, uint32_t epoch,
                     bool usable, Packet& completed);
  void clear() { active_ = false; copied_ = total_ = 0; }
 private:
  bool active_ = false;
  size_t copied_ = 0, total_ = 0;
  FragmentInfo info_{};
  Packet work_{};
};

// Pristup iz vise zadataka: pozivatelj drzi isti kriticni odsjek za SVAKU
// metodu. Prekid nije clan reda; prezivi i kada nema mjesta u redu.
class Mailbox {
 public:
  bool push(const Packet&);
  bool pop(Packet&);
  void disconnect() { lost_ = true; count_ = head_ = 0; ++epoch_; assembler.clear(); }
  bool takeDisconnect() { bool b = lost_; lost_ = false; return b; }
  uint32_t epoch() const { return epoch_; }
  size_t size() const { return count_; }
  void discard() { count_ = head_ = 0; assembler.clear(); }
  void invalidateMeasurement() {
    for(size_t i=0;i<count_;++i)packets_[(head_+i)%QueueSize].usableAtArrival=false;
    assembler.clear();
  }
  Assembler assembler;
 private:
  Packet packets_[QueueSize]{};
  size_t head_ = 0, count_ = 0;
  bool lost_ = false;
  uint32_t epoch_ = 0;
};

// Primljeni profil je ravan JSON objekt s tocno propisanim poljima.
// Tekstovi su neescapirani ASCII; brojevi su pozitivni cijeli uint32_t.
// Time se nedvosmisleno odbijaju duplikati, bool, decimalni brojevi i pretvorbe.
enum class MessageType { Command, LeaseAck, ProbeReply };
struct Message {
  MessageType type{};
  char device[17]{}, boot[25]{}, session[25]{};
  uint32_t lease = 0, command = 0, probe = 0;
  Action action = Action::Auto;
  bool actionValid = true;
};
bool parseMessage(const char* payload, size_t length, Message& out);

enum class Result {
  Accepted, LeaseConfirmed, ProbeReceived, BadJson, WrongDevice, WrongBoot,
  WrongSession, NotSubscribed, ExpiredLease, Duplicate, MeasurementError,
  NotReady, UnknownProbe, BadAction
};
const char* resultName(Result);
struct Lease { uint32_t id = 0, issuedAt = 0; };
class Controller {
 public:
  Controller(const char* device, const char* boot);
  void connected();
  void disconnected();
  void subscribed(bool qosOne);
  bool needsSession() const { return connected_ && subscribed_ && !session_[0]; }
  void startSession(const char* token);
  bool issueLease(uint32_t now, Lease& out);
  bool poll(const Reading& r, uint32_t now, bool modelReady);
  Result process(const Message&, const Reading&, uint32_t now, bool modelReady,
                 bool usableAtArrival = true);
  void startProbe(uint32_t id) { pendingProbe_ = id; }
  const char* session() const { return session_; }
  const char* device() const { return device_; }
  const char* boot() const { return boot_; }
  bool online() const { return alive_; }
  bool manual() const { return manual_; }
  bool alarm() const { return alarm_; }
  Target target() const { return target_; }
  uint32_t executions() const { return executions_; }
  uint32_t lastCommand() const { return highCommand_; }
 private:
  void invalidate();
  const Lease* findLease(uint32_t id, uint32_t now) const;
  char device_[17]{}, boot_[25]{}, session_[25]{};
  bool connected_ = false, subscribed_ = false, alive_ = false;
  bool manual_ = false, alarm_ = false, issued_ = false, seenSample_ = false;
  uint32_t confirmedAt_ = 0, lastIssue_ = 0, nextLease_ = 0, highCommand_ = 0;
  uint32_t lastSequence_ = 0, executions_ = 0, pendingProbe_ = 0;
  Target target_ = Target::Closed;
  Lease leases_[4]{};
  size_t leaseSlot_ = 0;
};
} // namespace c4


// Dio izvornog projekta: C4Hardware.h

#ifdef ARDUINO
#include <Arduino.h>
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


class EspVentHardware : public VentHardware {
 public:
  EspVentHardware() : sensor_(&wire_) {} // OneWire bez broja pina: bez I/O u konstruktoru.
  uint32_t now() const override { return millis(); }
  bool sensorBegin() override {
    pinMode(21,OUTPUT);digitalWrite(21,LOW);
    pinMode(14,OUTPUT);digitalWrite(14,LOW);
    wire_.begin(4); sensor_.begin();
    if (sensor_.getDeviceCount()!=1 || !sensor_.getAddress(address_,0) || address_[0]!=0x28)
      return false;
    sensor_.setResolution(address_,12);
    if(sensor_.getResolution(address_)!=12)return false;
    sensor_.setWaitForConversion(false);
    return true;
  }
  bool servoBegin(const Config& c) override {
    servo_.setPeriodHertz(c.frequencyHz);
    servo_.attach(14,c.minPulseUs,c.maxPulseUs);
    // LabServoPWM: stvarni LEDC rezultati; sirina je 14 vec pri attach.
    if(servo_.attached())servo_.setTimerWidth(14);
    if(!servo_.attached() || servo_.readTimerWidth()!=14){servo_.detach();return false;}
    pinMode(21,OUTPUT);digitalWrite(21,LOW);return true;
  }
  bool servoAttached() const override { return servo_.attached(); }
  SensorRequest request() override {
    const auto r=sensor_.requestTemperaturesByAddress(address_);
    return {r.result,r.timestamp};
  }
  float readRaw() override { return sensor_.getTempC(address_); }
  void writePulse(int us) override { servo_.writeMicroseconds(us); }
  void targetLed(bool on) override { digitalWrite(21,on?HIGH:LOW); }
 private:
  OneWire wire_;
  DallasTemperature sensor_;
  DeviceAddress address_{};
  LabServo servo_;
};

// Potpuni programski model senzora, sata i izlaza. Ne poziva GPIO.
// Za N/Q/G točne ulaze daje racunalni test; ovdje je ponovljivi vidljivi slijed.
class SimVentHardware : public VentHardware {
 public:
  uint32_t now() const override { return millis(); }
  bool sensorBegin() override { startedAt_=millis();return true; }
  bool servoBegin(const Config&) override { attached_=true;return true; }
  bool servoAttached() const override { return attached_; }
  SensorRequest request() override { return {true,millis()}; }
  float readRaw() override {
    const uint32_t elapsed=uint32_t(millis()-startedAt_)/8000u;
    const uint32_t phase=elapsed<6u?elapsed:5u;
    const float values[]={26.0f,27.0f,30.0f,NAN,29.0f,28.0f};
    return values[phase];
  }
  void writePulse(int us) override { lastPulse=us;++writes; }
  void targetLed(bool on) override { led=on; }
  int lastPulse=0;uint32_t writes=0;bool led=false;
 private:
  bool attached_=false;uint32_t startedAt_=0;
};
#endif


struct C4Settings {
  bool simulation, hardwareApproved, network, alarm;
  const char *device, *ssid, *wifiPassword, *broker, *mqttUser, *mqttPassword;
  uint16_t port;
  Config physicalConfig;
};
class C4App {
 public:
  explicit C4App(const C4Settings& settings);
  void begin();
  void step();
  void connectedCallback(bool sessionPresent);
  void disconnectedCallback(espMqttClientTypes::DisconnectReason);
  void messageCallback(const espMqttClientTypes::MessageProperties&,const char*,
                       const uint8_t*,size_t,size_t,size_t);
  espMqttClientAsync mqtt;
 private:
  void subscribeCallback(uint16_t,const espMqttClientTypes::SubscribeReturncode*,size_t);
  void networkStep();
  void publishState(const char* result,uint32_t command=0);
  bool publish(const char* suffix,const char* payload);
  void log(const char* event,uint32_t a=0,uint32_t b=0);
  void flushLogs();
  bool takeLoss();
  void nonce(char* out);
  const C4Settings settings_;
  EspVentHardware real_;
  SimVentHardware sim_;
  VentModel model_;
  c4::Controller controller_{"u07","unstarted"};
  c4::Mailbox inbox_;
  portMUX_TYPE lock_=portMUX_INITIALIZER_UNLOCKED;
  bool ready_=false, netEnabled_=false, connectEvent_=false, subEvent_=false;
  bool callbackUsable_=false, qosOne_=false, callbackConnected_=false;
  uint16_t subId_=0, reportedSubId_=0;
  uint32_t dropped_=0,lastDropped_=0,lastTelemetry_=0,lastConnect_=0,lastWifi_=0;
  uint32_t lastProbe_=0,probeId_=0,lastLoop_=0,maxGap_=0,lastSequence_=0,publishFailures_=0;
  bool attempted_=false;
  bool alarmLogStarted_=false,lastAlarmMemory_=false,lastUsable_=false;
  char commandTopic_[c4::MaxTopic]{},clientId_[64]{};
  AlarmBlink blink_;
  char logs_[16][384]{};
  size_t logLengths_[16]{},logHead_=0,logCount_=0,logOffset_=0;
  uint32_t lostLogs_=0;
};
#endif


// Mijenja ucenik s nastavnikom; prazna mreza iskljucuje mrezni dio.


C4Settings postavke{SIMULACIJA,SENZOR_ODOBREN,true,false,
 UREDJAJ,WIFI_SSID,WIFI_LOZINKA,BROKER_IP,MQTT_KORISNIK,MQTT_LOZINKA,1883,ODOBRENI_MODEL};
C4App app(postavke);
namespace MqttTip=espMqttClientTypes;
void naSpajanje(bool sessionPresent) {
  app.connectedCallback(sessionPresent);
}
void naPrekid(MqttTip::DisconnectReason reason) {
  app.disconnectedCallback(reason);
}
void naPoruku(const MqttTip::MessageProperties& props,const char* topic,
 const uint8_t* payload,size_t len,size_t index,size_t total) {
  app.messageCallback(props,topic,payload,len,index,total);
}
void setup() {
  app.mqtt.onConnect(naSpajanje).onDisconnect(naPrekid).onMessage(naPoruku);
  app.begin();
}
void loop() {
  app.step();
}


// Dio izvornog projekta: C4App.cpp
#ifdef ARDUINO

#include <esp_system.h>
#include <cstdio>
#include <cstring>

C4App::C4App(const C4Settings& s) : settings_(s),model_(s.simulation?
 static_cast<VentHardware&>(sim_):static_cast<VentHardware&>(real_)) {}
void C4App::nonce(char* out) {
  std::snprintf(out,17,"%08lx%08lx",(unsigned long)esp_random(),(unsigned long)esp_random());
}
void C4App::log(const char* event,uint32_t a,uint32_t b) {
  // Poziva samo glavna petlja. Bounded red cuva i niz povezanih dogadjaja
  // koji ne stane odjednom u UART/USB spremnik; ne ceka citaca.
  if(logCount_==16){++lostLogs_;return;}
  const size_t slot=(logHead_+logCount_)%16;
  int n=std::snprintf(logs_[slot],sizeof(logs_[slot]),
    "%lu %s source=%s a=%lu b=%lu sample_seq=%lu sample_time_ms=%lu communication_state=%s mode=%s target=%s alarm=%s\n",
    (unsigned long)millis(),event,settings_.simulation?"SIM":"DS18B20",(unsigned long)a,(unsigned long)b,
    (unsigned long)model_.reading().record.sampleSeq,(unsigned long)model_.reading().record.sampleTimeMs,
    controller_.online()?"ONLINE":"OFFLINE",controller_.manual()?"MANUAL":"AUTO",
    controller_.target()==Target::Open?"OPEN":"CLOSED",
    usableReading(model_.reading(),millis())?(controller_.alarm()?"ON":"OFF"):"UNKNOWN");
  if(n>0 && size_t(n)<sizeof(logs_[slot])){logLengths_[slot]=size_t(n);++logCount_;}
}
void C4App::flushLogs() {
  if(logCount_) {
    int available=Serial.availableForWrite();
    if(available>0) {
      size_t n=logLengths_[logHead_]-logOffset_;
      if(n>size_t(available))n=size_t(available);
      logOffset_+=Serial.write(reinterpret_cast<const uint8_t*>(logs_[logHead_])+logOffset_,n);
      if(logOffset_==logLengths_[logHead_]){logHead_=(logHead_+1)%16;--logCount_;logOffset_=0;}
    }
  }
  if(lostLogs_ && logCount_<16){uint32_t lost=lostLogs_;lostLogs_=0;log("LOG_DROPPED",lost);}
}
void C4App::begin() {
  Serial.begin(115200); provjeriMojeFunkcije();
  char boot[17];nonce(boot);controller_=c4::Controller(settings_.device,boot);
  if(settings_.simulation && settings_.hardwareApproved){log("INVALID_MODE");return;}
  if(settings_.simulation || settings_.hardwareApproved) {
    // Ovi brojevi vrijede SAMO za zamjene bez GPIO-a.
    Config c=settings_.simulation?Config{0,1200,1600,1100,1700,50}:settings_.physicalConfig;
    const auto status=model_.begin(c);ready_=status==InitStatus::Ready;
    log("begin_status",uint32_t(status));
  } else log("HARDVER_ONEMOGUCEN");
  if(settings_.alarm && settings_.hardwareApproved && ready_) {
    pinMode(47,OUTPUT);digitalWrite(47,LOW);
  }
  netEnabled_=settings_.network && settings_.ssid[0] && settings_.broker[0];
  if(!netEnabled_)return;
  IPAddress broker;
  if(!broker.fromString(settings_.broker)){netEnabled_=false;log("BROKER_IP_REQUIRED");return;}
  std::snprintf(commandTopic_,sizeof(commandTopic_),"iot/%s/command",settings_.device);
  std::snprintf(clientId_,sizeof(clientId_),"c4-%s-%s",settings_.device,boot);
  mqtt.setClientId(clientId_).setServer(broker,settings_.port).setCleanSession(true)
      .setKeepAlive(3).setTimeout(3);
  if(settings_.mqttUser[0])mqtt.setCredentials(settings_.mqttUser,settings_.mqttPassword);
  mqtt.onSubscribe([this](uint16_t id,const espMqttClientTypes::SubscribeReturncode* codes,size_t n){
    subscribeCallback(id,codes,n);
  });
  WiFi.persistent(false);WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);
  WiFi.begin(settings_.ssid,settings_.wifiPassword);lastWifi_=millis();
}
void C4App::connectedCallback(bool sessionPresent) {
  (void)sessionPresent; // MQTT sesija nije nasa aplikacijska sesija.
  portENTER_CRITICAL(&lock_);
  inbox_.discard();callbackConnected_=true;connectEvent_=true;subEvent_=false;
  portEXIT_CRITICAL(&lock_);
}
void C4App::disconnectedCallback(espMqttClientTypes::DisconnectReason reason) {
  (void)reason;
  portENTER_CRITICAL(&lock_);
  inbox_.disconnect();callbackConnected_=false;connectEvent_=subEvent_=false;
  portEXIT_CRITICAL(&lock_);
}
void C4App::subscribeCallback(uint16_t id,const espMqttClientTypes::SubscribeReturncode* codes,size_t n) {
  portENTER_CRITICAL(&lock_);
  reportedSubId_=id;qosOne_=n==1 && codes && static_cast<int>(codes[0])==1;
  subEvent_=true;
  portEXIT_CRITICAL(&lock_);
}
void C4App::messageCallback(const espMqttClientTypes::MessageProperties& p,const char* topic,
 const uint8_t* data,size_t len,size_t index,size_t total) {
  const uint32_t now=millis();c4::Packet packet;
  portENTER_CRITICAL(&lock_);
  if(!callbackConnected_){++dropped_;portEXIT_CRITICAL(&lock_);return;}
  auto status=inbox_.assembler.add({p.packetId,p.qos,p.retain},topic,data,len,index,total,
                                   now,inbox_.epoch(),callbackUsable_,packet);
  if(status==c4::FragmentResult::Rejected ||
     (status==c4::FragmentResult::Complete && !inbox_.push(packet)))++dropped_;
  portEXIT_CRITICAL(&lock_);
}
bool C4App::takeLoss() {
  portENTER_CRITICAL(&lock_);bool lost=inbox_.takeDisconnect();portEXIT_CRITICAL(&lock_);
  if(lost){controller_.disconnected();subId_=0;attempted_=false;lastConnect_=millis();log("mqtt_lost");}
  return lost;
}
bool C4App::publish(const char* suffix,const char* payload) {
  if(!mqtt.connected())return false;
  if(mqtt.queueSize()>=8){++publishFailures_;log("publish_queue_full",publishFailures_);return false;}
  char topic[c4::MaxTopic];std::snprintf(topic,sizeof(topic),"iot/%s/%s",settings_.device,suffix);
  const bool queued=mqtt.publish(topic,0,false,payload)!=0;
  if(!queued){++publishFailures_;log("publish_rejected",publishFailures_);}
  return queued; // QoS 0: prihvaceno u klijenta, nije potvrda aplikacije.
}
void C4App::networkStep() {
  if(!netEnabled_)return;
  takeLoss();
  bool connected=false,sub=false,good=false;uint16_t reported=0;
  portENTER_CRITICAL(&lock_);
  connected=connectEvent_;connectEvent_=false;sub=subEvent_;subEvent_=false;
  good=qosOne_;reported=reportedSubId_;
  portEXIT_CRITICAL(&lock_);
  if(connected){
    controller_.connected();subId_=mqtt.subscribe(commandTopic_,1);log("mqtt_connected",subId_);
    if(!subId_){mqtt.disconnect(true);controller_.disconnected();}
  }
  if(sub){
    bool accepted=subId_ && reported==subId_ && good;
    controller_.subscribed(accepted);log("suback",accepted);
    if(!accepted)mqtt.disconnect(true);
  }
  uint32_t now=millis();
  if(WiFi.status()!=WL_CONNECTED) {
    if(mqtt.connected())mqtt.disconnect(true);
    if(uint32_t(now-lastWifi_)>=10000u){lastWifi_=now;WiFi.reconnect();}
  } else if(mqtt.disconnected() && uint32_t(now-lastConnect_)>=3000u) {
    lastConnect_=now;attempted_=mqtt.connect();log("connect_attempt",attempted_);
  }
  if(controller_.needsSession()) {char token[17];nonce(token);controller_.startSession(token);}
  c4::Lease lease;
  if(controller_.issueLease(millis(),lease)) {
    char body[192];std::snprintf(body,sizeof(body),
      "{\"type\":\"lease\",\"device_id\":\"%s\",\"boot_id\":\"%s\",\"session_token\":\"%s\",\"lease_id\":%lu,\"last_cmd_id\":%lu}",
      controller_.device(),controller_.boot(),controller_.session(),(unsigned long)lease.id,
      (unsigned long)controller_.lastCommand());
    publish("state",body);
  }
  // Najvise dvije poruke po prolasku; prioritetni prekid se provjerava prije svake.
  for(unsigned i=0;i<2;++i) {
    if(takeLoss())break;
    c4::Packet p;uint32_t epoch;
    portENTER_CRITICAL(&lock_);bool got=inbox_.pop(p);epoch=inbox_.epoch();portEXIT_CRITICAL(&lock_);
    if(!got)break;
    if(p.epoch!=epoch || std::strcmp(p.topic,commandTopic_))continue;
    c4::Message m;
    if(!c4::parseMessage(p.payload,p.length,m)){log("BAD_JSON");publishState("BAD_JSON");continue;}
    if(takeLoss())break;
    auto result=controller_.process(m,model_.reading(),millis(),ready_,p.usableAtArrival);
    log(c4::resultName(result),m.command);
    if(result==c4::Result::ProbeReceived){
      log("probe_callback_time",m.probe,p.receivedAt);log("probe_processed",m.probe);
    }
    if(m.type==c4::MessageType::Command)publishState(c4::resultName(result),m.command);
  }
  now=millis();
  if(controller_.online() && uint32_t(now-lastProbe_)>=15000u) {
    lastProbe_=now;if(++probeId_==0)++probeId_;
    controller_.startProbe(probeId_);
    char body[144];std::snprintf(body,sizeof(body),
      "{\"type\":\"probe\",\"device_id\":\"%s\",\"boot_id\":\"%s\",\"probe_id\":%lu}",
      controller_.device(),controller_.boot(),(unsigned long)probeId_);
    if(publish("state",body))log("probe_start",probeId_,model_.reading().sequence);
    else controller_.startProbe(0);
  }
}
void C4App::publishState(const char* result,uint32_t command) {
  char body[512];std::snprintf(body,sizeof(body),
   "{\"type\":\"state\",\"device_id\":\"%s\",\"boot_id\":\"%s\",\"result\":\"%s\",\"cmd_id\":%lu,\"mode\":\"%s\",\"target\":\"%s\",\"target_state\":\"%s\",\"command_id\":%lu,\"command_status\":\"%s\",\"physical_state\":\"UNKNOWN\"}",
   controller_.device(),controller_.boot(),result,(unsigned long)command,
   controller_.manual()?"MANUAL":"AUTO",controller_.target()==Target::Open?"OPEN":"CLOSED",
   controller_.target()==Target::Open?"OPEN":"CLOSED",(unsigned long)command,
   command?(std::strcmp(result,"ACCEPTED")==0?"ACCEPTED":"REJECTED"):"NONE");
  publish("state",body);
}
void C4App::step() {
  flushLogs();
  uint32_t now=millis();
  if(lastLoop_ && uint32_t(now-lastLoop_)>maxGap_)maxGap_=uint32_t(now-lastLoop_);
  lastLoop_=now;
  const auto pollStatus=model_.tick(now);
  Reading r=model_.reading();now=millis();
  bool expired=controller_.poll(r,now,ready_);
  if(expired)log("app_expired");
  portENTER_CRITICAL(&lock_);
  callbackUsable_=ready_&&usableReading(r,now);
  if(!callbackUsable_)inbox_.invalidateMeasurement();
  portEXIT_CRITICAL(&lock_);
  networkStep();
  takeLoss();
  // Posljednja provjera nakon mrezne obrade, prije jedinog mjesta izlaza.
  now=millis();controller_.poll(r,now,ready_);
  if(ready_ && model_.target()!=controller_.target()) {
    auto status=model_.setTarget(controller_.target());log("target_status",uint32_t(status),uint32_t(model_.target()));
    if(status!=CommandStatus::Accepted){ready_=false;controller_.poll(r,millis(),false);}
  }
  const bool usable=ready_&&usableReading(r,millis());
  const bool led=alarmLedLevel(usable,controller_.alarm(),millis(),blink_);
  if(settings_.alarm && settings_.hardwareApproved && ready_)digitalWrite(47,led?HIGH:LOW);
  if(settings_.alarm && (!alarmLogStarted_ || lastAlarmMemory_!=controller_.alarm() || lastUsable_!=usable)) {
    alarmLogStarted_=true;lastAlarmMemory_=controller_.alarm();lastUsable_=usable;
    log("alarm_state",lastAlarmMemory_,lastUsable_);
  }
  if(pollStatus==PollStatus::Updated && r.sequence!=lastSequence_) {
    lastSequence_=r.sequence;log("sample_completed",r.sequence,r.completedAtMs);
  }
  portENTER_CRITICAL(&lock_);uint32_t dropped=dropped_;portEXIT_CRITICAL(&lock_);
  if(dropped!=lastDropped_){lastDropped_=dropped;log("callback_rejected",dropped);}
  if(netEnabled_ && mqtt.connected() && uint32_t(millis()-lastTelemetry_)>=1000u) {
    lastTelemetry_=millis();char temp[24]="null";
    if(usable)std::snprintf(temp,sizeof(temp),"%.3f",double(r.valueC));
    const char* alarm=!usable?"unknown":controller_.alarm()?"on":"off";
    char fields[640];
    if(!r.record.json(fields,sizeof(fields),millis())){log("RECORD_TOO_LONG");return;}
    char body[1536];std::snprintf(body,sizeof(body),
      "{\"type\":\"telemetry\",\"device_id\":\"%s\",\"boot_id\":\"%s\",\"source\":\"%s\",\"sequence\":%lu,\"completed_at_ms\":%lu,\"age_ms\":%lu,\"usable\":%s,\"temperature_c\":%s,\"mode\":\"%s\",\"target\":\"%s\",\"alarm\":\"%s\",\"max_loop_gap_ms\":%lu,\"target_state\":\"%s\",\"communication_state\":\"%s\",%s}",
      controller_.device(),controller_.boot(),settings_.simulation?"SIMULACIJA":"SENZOR",
      (unsigned long)r.sequence,(unsigned long)r.completedAtMs,
      (unsigned long)(millis()-r.completedAtMs),usable?"true":"false",temp,
      controller_.manual()?"MANUAL":"AUTO",controller_.target()==Target::Open?"OPEN":"CLOSED",
      alarm,(unsigned long)maxGap_,controller_.target()==Target::Open?"OPEN":"CLOSED",controller_.online()?"ONLINE":"OFFLINE",fields);
    publish("telemetry",body);
    if(settings_.alarm){
      std::snprintf(body,sizeof(body),"{\"type\":\"alarm\",\"device_id\":\"%s\",\"boot_id\":\"%s\",\"alarm\":\"%s\",\"memory\":%s}",
       controller_.device(),controller_.boot(),alarm,controller_.alarm()?"true":"false");
      publish("alarm",body);
    }
  }
  flushLogs();
  yield(); // Nijedan MQTT loop(): espMqttClientAsync koristi dogadjaje AsyncTCP-a.
}
#endif


// Dio izvornog projekta: C4Core.cpp

#include <cstdio>
#include <limits>

namespace c4 {
FragmentResult Assembler::add(FragmentInfo p, const char* topic, const uint8_t* data,
 size_t len, size_t index, size_t total, uint32_t now, uint32_t epoch,
 bool usable, Packet& completed) {
  auto reject = [this]() { clear(); return FragmentResult::Rejected; };
  if (!topic || !data || !len || !total || total > MaxPayload ||
      index > total || len > total-index || p.qos != 1 || !p.packetId || p.retain)
    return reject();
  size_t topicLen = 0;
  while (topicLen < MaxTopic && topic[topicLen]) ++topicLen;
  if (!topicLen || topicLen == MaxTopic) return reject();
  if (index == 0) {
    clear(); work_ = Packet{};
    std::memcpy(work_.topic, topic, topicLen + 1);
    work_.receivedAt = now; work_.epoch = epoch; work_.usableAtArrival = usable;
    total_ = total; info_ = p; active_ = true;
  }
  if (!active_ || index != copied_ || total != total_ ||
      info_.packetId != p.packetId || info_.qos != p.qos || info_.retain != p.retain ||
      work_.epoch != epoch || std::strcmp(work_.topic, topic) != 0) return reject();
  // Izgubljena uporabljivost tijekom prijenosa ne smije ozivjeti staru naredbu.
  work_.usableAtArrival = work_.usableAtArrival && usable;
  std::memcpy(work_.payload + copied_, data, len); copied_ += len;
  if (copied_ < total_) return FragmentResult::Partial;
  work_.length = total_; work_.payload[total_] = '\0'; completed = work_;
  clear(); return FragmentResult::Complete;
}
bool Mailbox::push(const Packet& p) {
  if (count_ == QueueSize) return false;
  packets_[(head_ + count_) % QueueSize] = p; ++count_; return true;
}
bool Mailbox::pop(Packet& p) {
  if (!count_) return false;
  p = packets_[head_]; head_ = (head_+1) % QueueSize; --count_; return true;
}

namespace {
struct Field { char key[17]{}, text[33]{}; bool number=false; uint32_t value=0; };
class Parser {
 public:
  Parser(const char* p, size_t n) : p_(p), n_(n) {}
  bool parse(Field* f, size_t& count) {
    if (!p_ || !n_ || n_ > MaxPayload || !take('{')) return false;
    if (take('}')) return finish();
    do {
      if (count == 7 || !string(f[count].key, sizeof(f[count].key)) || !take(':')) return false;
      for (size_t i=0;i<count;++i) if (!std::strcmp(f[i].key,f[count].key)) return false;
      space();
      if (at_ < n_ && p_[at_] == '"') {
        if (!string(f[count].text,sizeof(f[count].text))) return false;
      } else {
        f[count].number=true;
        if (!positiveInteger(f[count].value)) return false;
      }
      ++count;
      if (take('}')) return finish();
    } while (take(','));
    return false;
  }
 private:
  void space() { while(at_<n_ && (p_[at_]==' '||p_[at_]=='\n'||p_[at_]=='\r'||p_[at_]=='\t')) ++at_; }
  bool take(char c) { space(); if(at_==n_||p_[at_]!=c)return false; ++at_;return true; }
  bool finish() { space();return at_==n_; }
  bool string(char* out,size_t cap) {
    if(!take('"'))return false;
    size_t i=0;
    while(at_<n_ && p_[at_]!='"') {
      unsigned char c=static_cast<unsigned char>(p_[at_++]);
      if(c<32 || c>126 || c=='\\' || i+1>=cap)return false;
      out[i++]=char(c);
    }
    if(at_==n_)return false;
    ++at_;out[i]=0;return true;
  }
  bool positiveInteger(uint32_t& v) {
    space();if(at_==n_ || p_[at_]<'1'||p_[at_]>'9')return false;
    v=0;
    while(at_<n_ && p_[at_]>='0'&&p_[at_]<='9') {
      unsigned d=unsigned(p_[at_++]-'0');
      if(v>(UINT32_MAX-d)/10u)return false;
      v=v*10u+d;
    }
    return true;
  }
  const char* p_;size_t n_,at_=0;
};
bool strField(const Field* f,size_t n,const char* key,char* out,size_t cap) {
  for(size_t i=0;i<n;++i)if(!std::strcmp(f[i].key,key)) {
    size_t k=std::strlen(f[i].text);
    if(f[i].number||!k||k>=cap)return false;
    std::memcpy(out,f[i].text,k+1);return true;
  } return false;
}
bool numField(const Field* f,size_t n,const char* key,uint32_t& out) {
  for(size_t i=0;i<n;++i)if(!std::strcmp(f[i].key,key)) {
    if(!f[i].number)return false;
    out=f[i].value;return true;
  } return false;
}
}
bool parseMessage(const char* p,size_t len,Message& out) {
  Field f[7];size_t n=0;Parser parser(p,len);Message m;char type[17],action[8];
  if(!parser.parse(f,n) || !strField(f,n,"type",type,sizeof(type)) ||
     !strField(f,n,"device_id",m.device,sizeof(m.device)) ||
     !strField(f,n,"boot_id",m.boot,sizeof(m.boot)))return false;
  if(!std::strcmp(type,"probe_reply")) {
    m.type=MessageType::ProbeReply;
    if(n!=4 || !numField(f,n,"probe_id",m.probe))return false;
  } else {
    if(!strField(f,n,"session_token",m.session,sizeof(m.session)) ||
       !numField(f,n,"lease_id",m.lease))return false;
    if(!std::strcmp(type,"command")) {
      m.type=MessageType::Command;
      if(n!=7 || !numField(f,n,"cmd_id",m.command) ||
         !strField(f,n,"command",action,sizeof(action)))return false;
      m.actionValid=parseAction(action,std::strlen(action),m.action);
    } else if(!std::strcmp(type,"lease_ack")) {
      m.type=MessageType::LeaseAck;if(n!=5)return false;
    } else return false;
  }
  out=m;return true;
}
Controller::Controller(const char* d,const char* b) {
  std::snprintf(device_,sizeof(device_),"%s",d);
  std::snprintf(boot_,sizeof(boot_),"%s",b);
}
void Controller::invalidate() {
  session_[0]=0;alive_=false;manual_=false;highCommand_=0;pendingProbe_=0;
  issued_=false;nextLease_=0;leaseSlot_=0;
  for(auto& x:leases_)x=Lease{};
}
void Controller::connected(){invalidate();connected_=true;subscribed_=false;}
void Controller::disconnected(){invalidate();connected_=subscribed_=false;}
void Controller::subscribed(bool ok){subscribed_=ok;if(!ok)invalidate();}
void Controller::startSession(const char* token) {
  if(!needsSession() || !token || !token[0] || std::strlen(token)>=sizeof(session_))return;
  std::snprintf(session_,sizeof(session_),"%s",token);
}
bool Controller::issueLease(uint32_t now,Lease& out) {
  if(!connected_||!subscribed_||!session_[0])return false;
  if(issued_ && uint32_t(now-lastIssue_)<2000u)return false;
  if(nextLease_==UINT32_MAX){invalidate();return false;}
  issued_=true;lastIssue_=now;out=Lease{++nextLease_,now};
  leases_[leaseSlot_]=out;leaseSlot_=(leaseSlot_+1)%4;return true;
}
const Lease* Controller::findLease(uint32_t id,uint32_t now)const {
  for(const auto& l:leases_)if(l.id && l.id==id && uint32_t(now-l.issuedAt)<=Lifetime)return &l;
  return nullptr;
}
bool Controller::poll(const Reading& r,uint32_t now,bool ready) {
  bool expired=false;
  if(alive_ && uint32_t(now-confirmedAt_)>Lifetime){invalidate();expired=true;}
  const bool usable=ready && usableReading(r,now);
  if(!usable){manual_=false;target_=Target::Closed;return expired;}
  if(!seenSample_||r.sequence!=lastSequence_) {
    alarm_=alarmAfterValidSample(r.valueC,alarm_);lastSequence_=r.sequence;seenSample_=true;
  }
  if(!alive_)manual_=false;
  if(!manual_)target_=automaticTarget(r.valueC,target_);
  return expired;
}
Result Controller::process(const Message& m,const Reading& r,uint32_t now,bool ready,bool atArrival) {
  poll(r,now,ready); // Ponovno provjeri vrijeme u trenutku obrade.
  if(std::strcmp(m.device,device_))return Result::WrongDevice;
  if(std::strcmp(m.boot,boot_))return Result::WrongBoot;
  if(!connected_||!subscribed_)return Result::NotSubscribed;
  if(m.type==MessageType::ProbeReply) {
    if(!pendingProbe_||m.probe!=pendingProbe_)return Result::UnknownProbe;
    pendingProbe_=0;return Result::ProbeReceived;
  }
  if(!session_[0]||std::strcmp(m.session,session_))return Result::WrongSession;
  const Lease* lease=findLease(m.lease,now);
  if(!lease)return Result::ExpiredLease;
  if(m.type==MessageType::LeaseAck) {
    // Starija potvrda ne smije pomaknuti rok ni naprijed ni unatrag.
    if(!alive_ || uint32_t(now-lease->issuedAt)<uint32_t(now-confirmedAt_))confirmedAt_=lease->issuedAt;
    alive_=true;return Result::LeaseConfirmed;
  }
  if(!alive_)return Result::WrongSession;
  if(!ready)return Result::NotReady;
  if(m.command<=highCommand_)return Result::Duplicate;
  if (!m.actionValid) {highCommand_=m.command; return Result::BadAction;}
  highCommand_=m.command; // I odbijeni svjezi zahtjev potrosi se; nema ozivljavanja.
  if(m.action!=Action::Auto && (!atArrival||!usableReading(r,now)))return Result::MeasurementError;
  ++executions_;
  if(m.action==Action::Auto) {
    manual_=false;
    target_=usableReading(r,now)?automaticTarget(r.valueC,target_):Target::Closed;
  } else { manual_=true;target_=m.action==Action::Open?Target::Open:Target::Closed; }
  return Result::Accepted;
}
const char* resultName(Result r) {
  switch(r) {
    case Result::Accepted:return "ACCEPTED";case Result::LeaseConfirmed:return "LEASE_CONFIRMED";
    case Result::ProbeReceived:return "PROBE_RECEIVED";case Result::BadJson:return "BAD_JSON";
    case Result::WrongDevice:return "WRONG_DEVICE";case Result::WrongBoot:return "WRONG_BOOT";
    case Result::WrongSession:return "WRONG_SESSION";case Result::NotSubscribed:return "NOT_SUBSCRIBED";
    case Result::ExpiredLease:return "EXPIRED_LEASE";case Result::Duplicate:return "DUPLICATE";
    case Result::MeasurementError:return "MEASUREMENT_ERROR";case Result::NotReady:return "NOT_READY";
    case Result::UnknownProbe:return "UNKNOWN_PROBE";case Result::BadAction:return "BAD_ACTION";
  } return "UNKNOWN";
}
} // namespace c4


// Dio izvornog projekta: VentModel.cpp

#include <cmath>
#include <cstring>

float correctedTemperature(float raw, float offsetC) {
  return mojaKorekcija(raw, offsetC);
}
bool shouldClose(float t) {
  return mojUvjet(t);
}
Target automaticTarget(float t, Target previous) {
  if (!std::isfinite(t)) return Target::Closed;
  return mojOtvor(t, previous==Target::Open) ? Target::Open : Target::Closed;
}
bool validConfig(const Config& c) {
  if (!std::isfinite(c.offsetC) || c.frequencyHz != 50) return false;
  if (!c.servoEnabled) return true;
  return
    c.minPulseUs >= 500 && c.maxPulseUs <= 2500 &&
    c.minPulseUs < c.maxPulseUs && c.closedUs != c.openUs &&
    c.closedUs >= c.minPulseUs && c.closedUs <= c.maxPulseUs &&
    c.openUs >= c.minPulseUs && c.openUs <= c.maxPulseUs;
}
bool correctedTemperature(float raw, float offsetC, float& out) {
  if (!std::isfinite(raw) || !std::isfinite(offsetC) || raw == -127.0f ||
      raw < -55.0f || raw > 125.0f) return false;
  const float corrected = mojaKorekcija(raw, offsetC);
  if (!std::isfinite(corrected) || corrected < -55.0f || corrected > 125.0f)
    return false;
  out = corrected;
  return true;
}
bool selectPulse(Target t, const Config& c, int& out) {
  if (!validConfig(c)) return false;
  if (t == Target::Closed) out = c.closedUs;
  else if (t == Target::Open) out = c.openUs;
  else return false;
  return true;
}
bool usableReading(const Reading& r, uint32_t now) {
  return r.status == ReadingStatus::Valid && std::isfinite(r.valueC) &&
         uint32_t(now - r.completedAtMs) <= 6000u;
}
InitStatus VentModel::begin(const Config& c) {
  // Ugovor: begin jednom za novi objekt, prije prve uporabe.
  ready_ = false;
  if (!validConfig(c)) return InitStatus::BadConfig;
  if (!hw_.sensorBegin()) return InitStatus::SensorUnavailable;
  if (c.servoEnabled && (!hw_.servoBegin(c) || !hw_.servoAttached())) return InitStatus::ServoUnavailable;
  config_ = c;
  if (c.servoEnabled) hw_.writePulse(c.closedUs);
  hw_.targetLed(false);
  target_ = Target::Closed;
  ready_ = true;
  return InitStatus::Ready;
}
PollStatus VentModel::tick(uint32_t now) {
  if (!ready_) return PollStatus::NotReady;
  if (!pending_) {
    if (hasRequested_ && uint32_t(now - requestedAt_) < 2000u) return PollStatus::Idle;
    const SensorRequest r = hw_.request();
    hasRequested_ = true;
    if (!r.result) {
      requestedAt_ = hw_.now();
      last_.status = ReadingStatus::Invalid;
      last_.completedAtMs = requestedAt_;
      ++last_.sequence;
      last_.record.complete(0,false,last_.completedAtMs);
      return PollStatus::Updated;
    }
    requestedAt_ = r.timestamp;
    pending_ = true;
    return PollStatus::Busy;
  }
  if (uint32_t(now - requestedAt_) < 750u) return PollStatus::Busy;
  float value;
  const bool ok = correctedTemperature(hw_.readRaw(), config_.offsetC, value);
  last_.status = ok ? ReadingStatus::Valid : ReadingStatus::Invalid;
  if (ok) last_.valueC = value;  // Status odlucuje smije li se broj uporabiti.
  last_.completedAtMs = hw_.now();
  ++last_.sequence;
  last_.record.complete(ok?value:0,ok,last_.completedAtMs);
  pending_ = false;
  return PollStatus::Updated;
}
CommandStatus VentModel::setTarget(Target t) {
  if (!ready_) return CommandStatus::NotReady;
  if (t != Target::Closed && t != Target::Open) return CommandStatus::BadTarget;
  if (config_.servoEnabled) {
    if (!hw_.servoAttached()) return CommandStatus::NotReady;
    int pulse;
    if (!selectPulse(t, config_, pulse)) return CommandStatus::BadTarget;
    hw_.writePulse(pulse);
  }
  hw_.targetLed(t == Target::Open);
  target_ = t;
  return CommandStatus::Accepted;
}
bool parseAction(const char* text, size_t n, Action& out) {
  if (!text || !mojaNaredba(text,n)) return false;
  if (n == 4 && std::memcmp(text, "OPEN", 4) == 0) out = Action::Open;
  else if (n == 5 && std::memcmp(text, "CLOSE", 5) == 0) out = Action::Close;
  else if (n == 4 && std::memcmp(text, "AUTO", 4) == 0) out = Action::Auto;
  else return false;
  return true;
}
bool alarmAfterValidSample(float t, bool previous) {
  return mojAlarm(t, previous);
}
bool alarmLedLevel(bool usable, bool memory, uint32_t now, AlarmBlink& b) {
  if (usable) { b.inUnknown = false; b.level = memory; return b.level; }
  if (!b.inUnknown) { b.inUnknown = true; b.level = true; b.changedAtMs = now; }
  else if (uint32_t(now - b.changedAtMs) >= 250u) {
    b.level = !b.level; b.changedAtMs = now;
  }
  return b.level;
}
Target manualTestTarget(const Reading& r, uint32_t now, Target previous,
                        bool isNew, Target requested) {
  if (!usableReading(r, now)) return Target::Closed;
  if (isNew && (requested == Target::Closed || requested == Target::Open)) return requested;
  return previous;
}

