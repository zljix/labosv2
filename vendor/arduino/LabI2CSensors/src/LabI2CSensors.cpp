// MIT. Bosch datasheet compensation formulas; AM2320 Modbus CRC16.
#include "LabI2CSensors.h"
static bool put(uint8_t a,uint8_t reg,uint8_t value) {
  Wire.beginTransmission(a);Wire.write(reg);Wire.write(value);
  return Wire.endTransmission()==0;
}
static bool get(uint8_t a,uint8_t reg,uint8_t *b,uint8_t n) {
  Wire.beginTransmission(a);Wire.write(reg);
  // Keep ownership of the bus: SLA+W, register, repeated START, SLA+R.
  if(Wire.endTransmission(false)!=0)return false;
  if(Wire.requestFrom(a,n,(uint8_t)true)!=n)return false;
  for(uint8_t i=0;i<n;i++)b[i]=Wire.read();
  return true;
}
static uint16_t be(const uint8_t *b){return ((uint16_t)b[0]<<8)|b[1];}
static uint16_t le(const uint8_t *b){return ((uint16_t)b[1]<<8)|b[0];}
bool LabBMP180::begin() {
  ready=false;Wire.begin();delay(10);uint8_t id,b[22];
  if(!get(0x77,0xd0,&id,1)||id!=0x55||!get(0x77,0xaa,b,22))return false;
  for(uint8_t i=0;i<11;i++){uint16_t v=be(b+2*i);c[i]=(i>=3&&i<=5)?(int32_t)v:(int32_t)(int16_t)v;}
  return ready=c[3]!=0&&c[4]!=0;
}
bool LabBMP180::read(float &temperature,float &pressure,uint8_t oss) {
  if(!ready||oss>3)return false;
  uint8_t b[3];
  if(!put(0x77,0xf4,0x2e))return false;delay(5);
  if(!get(0x77,0xf6,b,2))return false;
  int32_t ut=be(b),x1=((ut-c[5])*c[4])>>15;
  if(x1+c[10]==0)return false;
  int32_t x2=c[9]*2048/(x1+c[10]),b5=x1+x2;
  temperature=((b5+8)>>4)/10.0f;
  if(!put(0x77,0xf4,0x34|(oss<<6)))return false;
  const uint8_t waits[4]={5,8,14,26};delay(waits[oss]);
  if(!get(0x77,0xf6,b,3))return false;
  int32_t up=(((uint32_t)b[0]<<16)|((uint16_t)b[1]<<8)|b[2])>>(8-oss),b6=b5-4000;
  x1=(c[7]*((b6*b6)>>12))>>11;x2=(c[1]*b6)>>11;
  int32_t b3=(((c[0]*4+x1+x2)*(1L<<oss))+2)>>2;
  x1=(c[2]*b6)>>13;x2=(c[6]*((b6*b6)>>12))>>16;
  uint32_t b4=((uint32_t)c[3]*(uint32_t)(((x1+x2+2)>>2)+32768))>>15;
  if(!b4)return false;
  uint32_t b7=(uint32_t)(up-b3)*(50000UL>>oss);
  int32_t p=b7<0x80000000UL?(b7*2)/b4:(b7/b4)*2;
  x1=(p>>8)*(p>>8);x1=(x1*3038)>>16;x2=(-7357*p)>>16;
  pressure=p+((x1+x2+3791)>>4);return true;
}
bool LabBMP280::begin(uint8_t a) {
  ready=false;address=a;Wire.begin();delay(5);uint8_t id,b[24];
  if(!get(a,0xd0,&id,1)||id!=0x58||!put(a,0xe0,0xb6))return false;
  delay(5);if(!get(a,0x88,b,24))return false;
  for(uint8_t i=0;i<12;i++){uint16_t v=le(b+2*i);c[i]=(i==0||i==3)?(int32_t)v:(int32_t)(int16_t)v;}
  if(!put(a,0xf5,0))return false; // IIR off, I2C profile
  return ready=c[3]!=0;
}
bool LabBMP280::read(float &temperature,float &pressure) {
  if(!ready||!put(address,0xf4,0x25))return false; // temperature x1, pressure x1, forced
  delay(8);uint8_t b[6];if(!get(address,0xf7,b,6))return false;
  int32_t ap=((uint32_t)b[0]<<12)|((uint16_t)b[1]<<4)|(b[2]>>4);
  int32_t at=((uint32_t)b[3]<<12)|((uint16_t)b[4]<<4)|(b[5]>>4);
  if(ap==0x80000||at==0x80000)return false;
  int32_t v1=(((at>>3)-c[0]*2)*c[1])>>11;
  int32_t v2=(((((at>>4)-c[0])*((at>>4)-c[0]))>>12)*c[2])>>14;
  int32_t fine=v1+v2;temperature=((fine*5+128)>>8)/100.0f;
  int64_t x=fine-128000,y=x*x*c[8];
  y+=x*c[7]*131072;y+=(int64_t)c[6]*34359738368LL;
  x=((x*x*c[5])>>8)+x*c[4]*4096;
  x=(((1LL<<47)+x)*c[3])>>33;if(!x)return false;
  int64_t p=1048576-ap;p=(((p<<31)-y)*3125)/x;
  x=((int64_t)c[11]*(p>>13)*(p>>13))>>25;y=((int64_t)c[10]*p)>>19;
  p=((p+x+y)>>8)+(int64_t)c[9]*16;
  pressure=p/256.0f;return true;
}
bool LabAM2320::begin(){Wire.begin();Wire.setClock(100000);delay(2000);return true;}
bool LabAM2320::read(float &temperature,float &humidity) {
  Wire.setClock(100000); // A graphics driver may have changed the shared bus clock.
  Wire.beginTransmission(0x5c);Wire.endTransmission(); // expected wake NACK
  delay(1);Wire.beginTransmission(0x5c);Wire.write(3);Wire.write(0);Wire.write(4);
  if(Wire.endTransmission()!=0)return false;
  delay(2);uint8_t b[8];if(Wire.requestFrom((uint8_t)0x5c,(uint8_t)8)!=(uint8_t)8)return false;
  for(uint8_t i=0;i<8;i++)b[i]=Wire.read();
  if(b[0]!=3||b[1]!=4)return false;
  uint16_t crc=0xffff;for(uint8_t i=0;i<6;i++){crc^=b[i];for(uint8_t j=0;j<8;j++)crc=(crc&1)?(crc>>1)^0xa001:crc>>1;}
  if(crc!=le(b+6))return false;
  humidity=be(b+2)/10.0f;uint16_t t=be(b+4);temperature=(t&0x7fff)/10.0f;if(t&0x8000)temperature=-temperature;
  return true;
}
