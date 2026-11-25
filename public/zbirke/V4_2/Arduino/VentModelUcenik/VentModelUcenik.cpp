// Nakon vlastite dopune S1-S3 i pregleda nastavnika postavi true.
constexpr bool BIBLIOTEKA_DOVRSENA = false;
static_assert(BIBLIOTEKA_DOVRSENA, "V4.2: dovrsi S1-S3; zatim oznaci BIBLIOTEKA_DOVRSENA=true");
#include "VentModelUcenik.h"
#include <cmath>

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
  // TODO S1: odbij nekonacne ulaze i raw izvan -55..125.
  // Izracunaj raw + offsetC; odbij nekonacan ili izvanrasponski rezultat.
  // Tek pri uspjehu zapisi out i vrati true. Pri odbijanju out ostaje isti.
  (void)raw; (void)offsetC; (void)out;
  return false;
}
bool selectPulse(Target t, const Config& c, int& out) {
  // TODO S2: provjeri validConfig(c), pa dopusteni cilj Closed ili Open.
  // Pri uspjehu odaberi c.closedUs ili c.openUs, zapisi out i vrati true.
  // Pri odbijanju vrati false bez promjene out. Ovdje nema GPIO poziva.
  (void)t; (void)c; (void)out;
  return false;
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
  // TODO S3: najprije ready_, zatim dopusteni cilj.
  // Ako je servo omogucen: provjeri servoAttached(), odaberi impuls sa S2,
  // zatim pozovi hw_.writePulse(pulse). Kod odbijanja nema izlaznog poziva.
  // Pri uspjehu postavi LED preko hw_.targetLed, spremi target_ i vrati Accepted.
  // Servo iskljucen: i dalje treba provjeriti cilj te postaviti LED i target_.
  (void)t;
  return CommandStatus::NotReady;
}

const char* libraryVersion() { return "1.0.0"; }
const char* libraryAuthor() { return "UPISI IME I PREZIME"; }
const char* librarySource() { return __FILE__; }
