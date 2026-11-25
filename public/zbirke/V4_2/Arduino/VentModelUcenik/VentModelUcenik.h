#pragma once
// VentModelUcenik: javno sucelje. Autor dopunjava oznacenu implementaciju.


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


const char* libraryVersion();
const char* libraryAuthor();
const char* librarySource();
