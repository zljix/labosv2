// MIT. Functional teaching API, NOT the Espressif Arduino core or Xtensa firmware.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
#include <math.h>
#include <string.h>
#include <pgmspace.h>
#define HIGH 1
#define LOW 0
#define INPUT 1
#define OUTPUT 3
#define INPUT_PULLUP 5
#define INPUT_PULLDOWN 9
#define OUTPUT_OPEN_DRAIN 19
#define MSBFIRST 1
#define LSBFIRST 0
#define DEC 10
#define HEX 16
#define OCT 8
#define BIN 2
#define PI 3.14159265358979323846
#define F(s) (s)
// No asynchronous hardware interrupts are exposed by this functional target.
// Portable polling libraries can still delimit their timing-critical sections.
void noInterrupts();
void interrupts();
// GPIO polling advances one virtual microsecond per host call. This scales
// library timeout counters; it is not an ESP32 CPU-cycle conversion.
#define microsecondsToClockCycles(us) ((us)*1UL)
#define bitRead(value, bit) (((value) >> (bit)) & 1UL)
#define bitSet(value, bit) ((value) |= (1UL << (bit)))
#define bitClear(value, bit) ((value) &= ~(1UL << (bit)))
#define bitWrite(value, bit, bitvalue) ((bitvalue) ? bitSet(value, bit) : bitClear(value, bit))
using byte=uint8_t;
using boolean=bool;
using word=uint16_t;
template<class T> constexpr T min(T a,T b){return a<b?a:b;}
template<class T> constexpr T max(T a,T b){return a>b?a:b;}
template<class T,class A,class B> constexpr auto constrain(T x,A a,B b){return x<a?a:x>b?b:x;}
template<class T> constexpr T abs(T x){return x<0?-x:x;}
long map(long,long,long,long,long);
void pinMode(uint8_t,uint8_t);
void digitalWrite(uint8_t,uint8_t);
int digitalRead(uint8_t);
unsigned long millis();
unsigned long micros();
void delay(unsigned long);
void delayMicroseconds(unsigned int);
void yield();
int analogRead(uint8_t);
uint32_t analogReadMilliVolts(uint8_t);
void analogReadResolution(uint8_t);
void analogSetPinAttenuation(uint8_t,uint8_t);
enum {ADC_0db=0,ADC_2_5db=1,ADC_6db=2,ADC_11db=3,ADC_ATTEN_DB_0=0,ADC_ATTEN_DB_2_5=1,ADC_ATTEN_DB_6=2,ADC_ATTEN_DB_11=3};
void analogWrite(uint8_t,int);
bool ledcAttach(uint8_t,uint32_t,uint8_t);
bool ledcWrite(uint8_t,uint32_t);
bool ledcDetach(uint8_t);
unsigned long pulseIn(uint8_t,uint8_t,unsigned long=1000000);
class Print {
 public:
  virtual size_t write(uint8_t)=0;
  virtual ~Print()=default;
  size_t write(const uint8_t*,size_t);
  size_t write(const char* s){return write((const uint8_t*)s,strlen(s));}
  size_t write(int n){return write((uint8_t)n);}
  size_t write(unsigned int n){return write((uint8_t)n);}
  size_t write(long n){return write((uint8_t)n);}
  size_t write(unsigned long n){return write((uint8_t)n);}
  size_t print(const char* s){return write(s?s:"(null)");}
  size_t print(char c){return write((uint8_t)c);}
  size_t print(unsigned long,int=DEC);
  size_t print(long,int=DEC);
  size_t print(unsigned int x,int base=DEC){return print((unsigned long)x,base);}
  size_t print(int x,int base=DEC){return print((long)x,base);}
  size_t print(unsigned char x,int base=DEC){return print((unsigned long)x,base);}
  size_t print(double,int=2);
  size_t println(){return write("\r\n");}
  template<class T> size_t println(T v){size_t n=print(v);return n+println();}
  template<class T> size_t println(T v,int arg){size_t n=print(v,arg);return n+println();}
};
class HardwareSerial:public Print {
 public:
  void begin(unsigned long);
  int available();
  int read();
  int peek();
  void flush(){}
  using Print::write;
  size_t write(uint8_t) override;
  explicit operator bool() const{return true;}
};
extern HardwareSerial Serial;
