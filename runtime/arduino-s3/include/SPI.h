// MIT. Functional byte-level SPI; explicit SCK/MISO/MOSI, no silicon cycles.
#pragma once
#include <Arduino.h>
#define SPI_MODE0 0
#define SPI_MODE1 1
#define SPI_MODE2 2
#define SPI_MODE3 3
#define SPI_HAS_TRANSACTION 1
class SPISettings {
 public:uint32_t clock;uint8_t order,mode;
 SPISettings(uint32_t f=1000000,uint8_t o=MSBFIRST,uint8_t m=SPI_MODE0):clock(f),order(o),mode(m){}
};
class SPIClass {
 uint8_t bus;int sck=-1,miso=-1,mosi=-1;SPISettings settings;
 public:
 explicit SPIClass(uint8_t id=1):bus(id){}
 void begin(int=-1,int=-1,int=-1,int=-1);
 void end();
 void beginTransaction(SPISettings);
 void endTransaction(){}
 uint8_t transfer(uint8_t);
 uint16_t transfer16(uint16_t);
 void transfer(void*,size_t);
 void writeBytes(const uint8_t*,uint32_t);
};
extern SPIClass SPI;
