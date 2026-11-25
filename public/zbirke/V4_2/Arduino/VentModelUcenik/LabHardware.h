#pragma once
// PRIPREMLJENA POTPORA: sabirnica i izlazni pogon nisu ucenicki zadatak.
#include "VentModelUcenik.h"


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
