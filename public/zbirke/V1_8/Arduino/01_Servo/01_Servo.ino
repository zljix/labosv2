/*
  V1.8 - Poveži impuls serva s opaženim položajem
  1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
  2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
  3. Spremi, Verify, Upload; Serial Monitor 115200, zatim RESET.
  4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
  Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
  Slijed: cekaj 3 s; START 2 s; TARGET 2 s; povratak START 2 s; STOP.
*/
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



constexpr int SERVO_PIN = 14;
// UCENIK: samo vrijednosti s odobrene kartice stvarnog serva.
constexpr bool SERVO_ENABLED = false;
constexpr int SERVO_MIN_US = 0;
constexpr int SERVO_MAX_US = 0;
constexpr int SERVO_START_US = 0;
constexpr int SERVO_TARGET_US = 0;
constexpr uint32_t START_DELAY_MS = 3000;
constexpr uint32_t POSITION_HOLD_MS = 2000;
// PRIPREMLJENI DIO: START -> TARGET -> START -> STOP, samo jedan ciklus.
LabServo servo;
uint8_t phase=0;
uint32_t phaseStarted=0;
bool testAllowed=false;
bool approvedRange() {
  // 500..2500 su granice programa, a ne odobrenje bilo kojeg serva.
  return SERVO_MIN_US>=500 && SERVO_MAX_US<=2500 && SERVO_MIN_US<SERVO_MAX_US &&
    SERVO_START_US>=SERVO_MIN_US && SERVO_START_US<=SERVO_MAX_US &&
    SERVO_TARGET_US>=SERVO_MIN_US && SERVO_TARGET_US<=SERVO_MAX_US;
}
bool stopPulses() {
  bool ok=servo.detach();
  if(ok){pinMode(SERVO_PIN,OUTPUT);digitalWrite(SERVO_PIN,LOW);}
  return ok;
}
void status(const char* step,int us) {
  Serial.printf("SERVO etapa=%s t_ms=%lu requested_us=%d\n",step,(unsigned long)millis(),us);
}
bool setPosition(const char* step,int us,uint32_t now) {
  if(!servo.writeMicroseconds(us)) {
    testAllowed=false;stopPulses();
    Serial.println("SERVO ERROR: nema potvrde PWM izlaza; prekini pokus.");return false;
  }
  phaseStarted=now;status(step,us);return true;
}
void setup() {
  Serial.begin(115200);bool stopped=stopPulses();phaseStarted=millis();
  testAllowed=stopped && SERVO_ENABLED && approvedRange();
  Serial.println("Zadani impuls nije izmjereni kut. Serial je samo izlaz.");
  if(testAllowed)Serial.println("SERVO CEKANJE 3000 ms; zatim START TARGET START STOP. Odmakni ruke.");
  else Serial.println("SERVO ONEMOGUCEN: provjeri ENABLED i cetiri odobrene vrijednosti.");
}
void loop() {
  if(!testAllowed){delay(1);return;}
  uint32_t now=millis();
  if(phase==0 && uint32_t(now-phaseStarted)>=START_DELAY_MS) {
    servo.setPeriodHertz(50);servo.setTimerWidth(14);
    if(!servo.attach(SERVO_PIN,SERVO_MIN_US,SERVO_MAX_US)) {
      testAllowed=false;stopPulses();Serial.println("SERVO ERROR attach");return;
    }
    if(setPosition("START",SERVO_START_US,now))phase=1;
  } else if(phase==1 && uint32_t(now-phaseStarted)>=POSITION_HOLD_MS) {
    if(setPosition("TARGET",SERVO_TARGET_US,now))phase=2;
  } else if(phase==2 && uint32_t(now-phaseStarted)>=POSITION_HOLD_MS) {
    if(setPosition("RETURN",SERVO_START_US,now))phase=3;
  } else if(phase==3 && uint32_t(now-phaseStarted)>=POSITION_HOLD_MS) {
    testAllowed=false;phase=4;
    if(stopPulses())status("STOP",0);
    else Serial.println("SERVO ERROR stop: nastavnik provjerava prekid impulsa.");
    Serial.println("Ciklus zavrsen. Napajanje serva nije iskljuceno.");
  }
  delay(1);
}
