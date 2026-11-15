// MIT. Arduino-shaped functional API for an ESP32-S3 teaching WASM target.
#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
extern "C" {
 int lab_gpio_mode(int,int);int lab_gpio_write(int,int);int lab_gpio_read(int);
 int lab_adc(int,int,int);int lab_pwm(int,int,int);int lab_clock(int);
 void lab_delay(int,int);void lab_fault(int);int lab_serial(int,int);
 int lab_i2c_config(int,int,int,int);int lab_i2c_tx(int,int,const uint8_t*,int,int);int lab_i2c_rx(int,int,uint8_t*,int,int);
 int lab_spi_config(int,int,int,int,int,int,int);int lab_spi_transfer(int,int);int lab_spi_bytes(int,void*,int,int);int lab_pulse(int,int,int);
 void __wasm_call_ctors();
}
static void check(int n){if(n<0)lab_fault(n);}
long map(long x,long a,long b,long c,long d){if(a==b)lab_fault(-22);return (x-a)*(d-c)/(b-a)+c;}
void pinMode(uint8_t p,uint8_t m){check(lab_gpio_mode(p,m));}
void digitalWrite(uint8_t p,uint8_t v){check(lab_gpio_write(p,v?1:0));}
int digitalRead(uint8_t p){int n=lab_gpio_read(p);check(n);return n;}
unsigned long millis(){return (uint32_t)lab_clock(0);}
unsigned long micros(){return (uint32_t)lab_clock(1);}
void delay(unsigned long ms){lab_delay(ms,0);}
void delayMicroseconds(unsigned int us){lab_delay(us,1);}
void yield(){lab_delay(0,0);}
void noInterrupts(){}
void interrupts(){}
static uint8_t adcBits=12,atten[49];
struct ADCInit{ADCInit(){for(auto &a:atten)a=3;}};static ADCInit adcInit;
void analogReadResolution(uint8_t b){if(b<1||b>16)lab_fault(-22);adcBits=b;}
void analogSetPinAttenuation(uint8_t p,uint8_t a){if(p<1||p>20||a>3)lab_fault(-22);atten[p]=a;}
int analogRead(uint8_t p){if(p<1||p>20)lab_fault(-22);int v=lab_adc(p,adcBits,atten[p]);check(v);return v;}
uint32_t analogReadMilliVolts(uint8_t p){if(p<1||p>20)lab_fault(-22);int v=lab_adc(p,0,atten[p]);check(v);return v;}
static uint32_t frequencies[49],duties[49];static uint8_t resolutions[49];
bool ledcAttach(uint8_t p,uint32_t f,uint8_t b){if(p>=49||b<1||b>14||!f||f>40000000)return false;int n=lab_pwm(p,f,0);if(n<0)return false;frequencies[p]=f;resolutions[p]=b;duties[p]=0;return true;}
bool ledcWrite(uint8_t p,uint32_t d){if(p>=49||!frequencies[p]||d>((1U<<resolutions[p])-1))return false;int n=lab_pwm(p,frequencies[p],(uint32_t)(((uint64_t)d*65535)/((1U<<resolutions[p])-1)));if(n<0)return false;duties[p]=d;return true;}
bool ledcDetach(uint8_t p){if(p>=49||!frequencies[p])return false;int n=lab_pwm(p,0,0);frequencies[p]=0;return n>=0;}
void analogWrite(uint8_t p,int d){if(d<0||d>255)lab_fault(-22);if(p>=49)lab_fault(-22);if(!frequencies[p]&&!ledcAttach(p,1000,8))lab_fault(-16);if(resolutions[p]!=8)lab_fault(-95);if(!ledcWrite(p,d))lab_fault(-22);}
unsigned long pulseIn(uint8_t p,uint8_t level,unsigned long timeout){int n=lab_pulse(p,level,timeout);return n<0?0:n;}
size_t Print::write(const uint8_t* p,size_t n){size_t out=0;while(n--)out+=write(*p++);return out;}
size_t Print::print(unsigned long v,int base){if(base<2||base>36)base=10;char text[33];int i=0;do{unsigned d=v%base;text[i++]=d<10?'0'+d:'A'+d-10;v/=base;}while(v);size_t n=0;while(i)n+=write(text[--i]);return n;}
size_t Print::print(long v,int base){if(base==10&&v<0)return write('-')+print(0UL-(unsigned long)v,base);return print((unsigned long)v,base);}
size_t Print::print(double v,int digits){if(isnan(v))return print("nan");if(!isfinite(v))return print("inf");if(fabs(v)>4294967000.0)return print("ovf");digits=constrain(digits,0,9);size_t n=0;if(v<0){n+=write('-');v=-v;}double rounding=.5;for(int i=0;i<digits;i++)rounding/=10;v+=rounding;auto integral=(unsigned long)v;n+=print(integral);v-=integral;if(digits)n+=write('.');while(digits--){v*=10;uint8_t d=(uint8_t)v;n+=write('0'+d);v-=d;}return n;}
HardwareSerial Serial;
void HardwareSerial::begin(unsigned long baud){check(lab_serial(0,baud));}
int HardwareSerial::available(){return lab_serial(1,0);}
int HardwareSerial::read(){return lab_serial(2,0);}
int HardwareSerial::peek(){return lab_serial(3,0);}
size_t HardwareSerial::write(uint8_t c){check(lab_serial(4,c));return 1;}
TwoWire Wire(0),Wire1(1);
bool TwoWire::begin(int a,int b,uint32_t f){if(a>=0)sda=a;if(b>=0)scl=b;frequency=f;return lab_i2c_config(bus,sda,scl,f)>=0;}
bool TwoWire::end(){return lab_i2c_config(bus,sda,scl,0)>=0;}
bool TwoWire::setClock(uint32_t f){frequency=f;return lab_i2c_config(bus,sda,scl,f)>=0;}
size_t TwoWire::write(uint8_t v){if(used>=sizeof(tx)){overflow=true;return 0;}tx[used++]=v;return 1;}
uint8_t TwoWire::endTransmission(bool stop){if(overflow)return 1;int n=lab_i2c_tx(bus,address,tx,used,stop);return n<0?(n==-19?2:4):0;}
size_t TwoWire::requestFrom(uint8_t addr,size_t n,bool stop){at=length=0;if(n>sizeof(rx))return 0;int r=lab_i2c_rx(bus,addr,rx,n,stop);if(r>=0)length=r;return length;}
SPIClass SPI;
void SPIClass::begin(int s,int i,int o,int){if(s>=0)sck=s;if(i>=0)miso=i;if(o>=0)mosi=o;if(sck<0||mosi<0)lab_fault(-22);pinMode(sck,OUTPUT);pinMode(mosi,OUTPUT);if(miso>=0)pinMode(miso,INPUT);check(lab_spi_config(bus,sck,mosi,miso,settings.clock,settings.mode,settings.order));}
void SPIClass::end(){check(lab_spi_config(bus,sck,mosi,miso,0,0,MSBFIRST));}
void SPIClass::beginTransaction(SPISettings s){settings=s;check(lab_spi_config(bus,sck,mosi,miso,s.clock,s.mode,s.order));}
uint8_t SPIClass::transfer(uint8_t v){int r=lab_spi_transfer(bus,v);check(r);return r;}
uint16_t SPIClass::transfer16(uint16_t v){return ((uint16_t)transfer(v>>8)<<8)|transfer(v&255);}
void SPIClass::transfer(void* data,size_t n){if(n>4096)lab_fault(-22);check(lab_spi_bytes(bus,data,n,1));}
void SPIClass::writeBytes(const uint8_t* data,uint32_t n){if(n>4096)lab_fault(-22);check(lab_spi_bytes(bus,(void*)data,n,0));}
extern "C" size_t strlen(const char* s){size_t n=0;while(s[n])n++;return n;}
extern "C" void* memcpy(void* d,const void* s,size_t n){auto a=(uint8_t*)d;auto b=(const uint8_t*)s;while(n--)*a++=*b++;return d;}
extern "C" void* memmove(void* d,const void* s,size_t n){auto a=(uint8_t*)d;auto b=(const uint8_t*)s;if(a<b)return memcpy(d,s,n);while(n){--n;a[n]=b[n];}return d;}
extern "C" void* memset(void* d,int c,size_t n){auto a=(uint8_t*)d;while(n--)*a++=c;return d;}
extern "C" int memcmp(const void* a,const void* b,size_t n){auto p=(const uint8_t*)a;auto q=(const uint8_t*)b;while(n--){if(*p!=*q)return *p-*q;p++;q++;}return 0;}
extern "C" int strcmp(const char* a,const char* b){while(*a&&*a==*b){a++;b++;}return (unsigned char)*a-(unsigned char)*b;}
extern "C" void __cxa_pure_virtual(){lab_fault(-95);}
// No dynamic heap is promised. Delete exists for virtual destructors only.
void operator delete(void*) noexcept{}
void operator delete(void*,size_t) noexcept{}
alignas(16) static uint8_t asyncStack[131072];
static uint32_t asyncData[2];
extern "C" uint32_t lab_async_data(){asyncData[0]=(uint32_t)asyncStack;asyncData[1]=(uint32_t)(asyncStack+sizeof(asyncStack));return (uint32_t)asyncData;}
void setup();void loop();
extern "C" void lab_init(){__wasm_call_ctors();}
extern "C" void lab_setup(){setup();}
extern "C" void lab_loop(){loop();}
