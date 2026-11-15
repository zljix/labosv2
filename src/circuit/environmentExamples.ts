import {touchExamples,touchCircuit,type TouchExample} from './touchExamples';
import {iliExamples,iliCircuit,type ILIExample} from './ili9341Examples';
import {spiExamples,spiCircuit,type SPIExample} from './spiExamples';
import {stepperExamples,stepperCircuit,type StepperExample} from './stepperExamples';
import {actuatorExamples,actuatorCircuit,type ActuatorExample} from './actuatorExamples';
import {tmExamples,tmCircuit,type TMExample} from './tm1637Examples';
import {irExamples,irCircuit,type IRExample} from './irExamples';
import {encoderExamples,encoderCircuit,type EncoderExample} from './encoderExamples';
import {oneWireExamples,oneWireCircuit,oneWireDriverNames,type OneWireExample} from "./oneWireExamples";
import {dhtExamples,dhtCircuit,type DHTExample} from "./dhtExamples";
import {analogExamples,analogCircuit,type AnalogExample} from "./analogExamples";
import {emptyCircuit,makePart,terminals,type Circuit,type Kind} from './model';
import {S3,type BoardId} from '../boards/profiles';
import {runtimeAsset} from '../platform/assets';
import {displayExamples,displayCircuit,type DisplayExample} from './displayExamples';
export type EnvironmentExample=TouchExample|ILIExample|SPIExample|StepperExample|ActuatorExample|TMExample|IRExample|EncoderExample|OneWireExample|DHTExample|AnalogExample|DisplayExample|'bmp180'|'bmp280'|'am2320'|'weather';
const intros={
  bmp180:'BMP180: temperatura i tlak. Driver čita 11 kalibracijskih koeficijenata i zasebne sirove pretvorbe; tlak je u Pa (100 Pa = 1 hPa).',
  bmp280:'BMP280: zasebna registarska mapa, little-endian kalibracija i forced način. Adresa 0x76; nije BME280 i ne mjeri vlagu. SPI ima zaseban 6-izvodni profil; IIR filtar nije modeliran.',
  am2320:'AM2320: I2C 0x5C pri 100 kHz; buđenje s očekivanim NACK-om, zaglavlje i CRC16. Početno čekanje 2 s. Vraća prethodni uzorak, pa promjena okoliša kasni jedan ciklus. Očitanja razmakni barem 2 s.',
  weather:'Meteorološka stanica: BMP180 0x77, BMP280 0x76, AM2320 0x5C i OLED 0x3C dijele I2C. Svaki senzor ima vlastiti okoliš; za usporedbu postavi jednake vrijednosti. AM2320 vraća prethodni uzorak. AHT10 zadržava zasebnu sabirnicu.',
};
export function environmentCircuit(key:EnvironmentExample,board:BoardId=S3):Circuit {
  if(key in touchExamples)return touchCircuit(key as TouchExample,board);
  if(key in iliExamples)return iliCircuit(key as ILIExample,board);
  if(key in spiExamples)return spiCircuit(key as SPIExample,board);
  if(key in stepperExamples)return stepperCircuit(key as StepperExample,board);
  if(key in actuatorExamples)return actuatorCircuit(key as ActuatorExample,board);
  if(key in tmExamples)return tmCircuit(key as TMExample,board);
  if(key in irExamples)return irCircuit(key as IRExample,board);
  if(key in encoderExamples)return encoderCircuit(key as EncoderExample,board);
  if(key in oneWireExamples)return oneWireCircuit(key as OneWireExample,board);
  if(key in dhtExamples)return dhtCircuit(key as DHTExample,board);
  if(key in analogExamples)return analogCircuit(key as AnalogExample,board);
  if(key in displayExamples)return displayCircuit(key as DisplayExample,board);
  const c=emptyCircuit(board),b=c.components[0];b.x=40;b.y=120;
  const avr=board!==S3;
  const pin=(gpio:number)=>terminals(b).find(t=>t.gpio===gpio)!.pin;
  const kinds:Kind[]=key==='weather'?['bmp180','bmp280','am2320','ssd1306']:[key as Kind];
  for(const [i,kind]of kinds.entries()){
    const p=makePart(kind,avr?600+(i%3)*230:400+(i%3)*230,i===3?440:100,kind+'1');
    if(avr)p.properties.moduleVoltage=5;c.components.push(p);
    for(const [k,boardPin,color]of [['VCC',avr?'5V':'J1.1','#d04b46'],['GND',avr?'GND':'J1.22','#334155'],['SDA',avr?'A4':pin(8),'#087f8c'],['SCL',avr?'A5':pin(9),'#d59218']]){
      c.wires.push({id:'env'+c.wires.length,from:{component:b.id,pin:boardPin},to:{component:p.id,pin:k},color,points:[]});
    }
  }
  return c;
}
const pySingle=(key:'bmp180'|'bmp280'|'am2320')=>`from machine import Pin, I2C
from time import sleep_ms
from lab_i2c_sensors import ${key.toUpperCase()}

# SDA su podaci, SCL je takt. Adresa nije GPIO broj.
bus = I2C(0, sda=Pin(8), scl=Pin(9), freq=100000)
senzor = ${key.toUpperCase()}(bus)
while True:
    temperatura, vrijednost = senzor.read()
    print("${key.toUpperCase()} T=%.2f ${key==='am2320'?'RH=%.2f':'P=%.0f Pa'}" % (temperatura, vrijednost))
    sleep_ms(2100)
`;
export const environmentExamples={
  ...touchExamples,
  ...iliExamples,
  ...spiExamples,
  ...stepperExamples,
  ...actuatorExamples,
  ...tmExamples,
  ...irExamples,
  ...encoderExamples,
  ...oneWireExamples,
  ...dhtExamples,
  ...displayExamples,
  ...analogExamples,
  bmp180:{title:'BMP180 · temperatura i tlak',hint:intros.bmp180,code:pySingle('bmp180')},
  bmp280:{title:'BMP280 · registri i repeated-start',hint:intros.bmp280,code:pySingle('bmp280')},
  am2320:{title:'AM2320 · buđenje i CRC16',hint:intros.am2320,code:pySingle('am2320')},
  weather:{title:'Meteorološka stanica · četiri I2C uređaja',hint:intros.weather,code:`from machine import Pin, I2C
from time import sleep_ms
from lab_i2c_sensors import BMP180, BMP280, AM2320
from ssd1306 import SSD1306_I2C

bus = I2C(0, sda=Pin(8), scl=Pin(9), freq=100000)
bmp180 = BMP180(bus)
bmp280 = BMP280(bus, address=0x76)
am2320 = AM2320(bus)
oled = SSD1306_I2C(128, 64, bus)
while True:
    t180, p180 = bmp180.read()
    t280, p280 = bmp280.read()
    temperatura, vlaga = am2320.read()
    oled.fill(0)
    oled.text("BMP180:%.1fhPa" % (p180/100), 0, 0)
    oled.text("BMP280:%.1fhPa" % (p280/100), 0, 14)
    oled.text("AM2320 %.1f C" % temperatura, 0, 28)
    oled.text("RH %.1f %%" % vlaga, 0, 42)
    oled.show()
    print("BMP180 T=%.2f P=%.0f Pa" % (t180, p180))
    print("BMP280 T=%.2f P=%.0f Pa" % (t280, p280))
    print("AM2320 T=%.2f RH=%.2f" % (temperatura, vlaga))
    sleep_ms(2100)
`},
};
export async function loadEnvironmentDrivers(key:EnvironmentExample){
  if(key in stepperExamples)return {};
  if(key in actuatorExamples&&key!=='sg90Sweep'&&key!=='servoMotorTone')return {};
  if(key==='encoderRaw')return {};
  if(key in analogExamples)return {};
  const names=key in touchExamples?['lab_ili9341.py','lab_xpt2046.py']:key in iliExamples?(key==='iliDashboard'?['lab_ili9341.py','lab_bmp280_spi.py','lab_i2c_sensors.py']:['lab_ili9341.py']):key in spiExamples?(key==='bmp280SPI'?['lab_bmp280_spi.py','lab_i2c_sensors.py']:key==='spiDashboard'?['lab_st7735.py','lab_bmp280_spi.py','lab_i2c_sensors.py']:['lab_st7735.py']):key in actuatorExamples?['servo.py']:key in tmExamples?['lab_tm1637.py']:key in irExamples?['lab_ir.py']:key in encoderExamples?['lab_encoder.py']:key in oneWireExamples?[...oneWireDriverNames]:key in dhtExamples?['dht.py']:key==='oled32'?['ssd1306.py']:key==='lcd1602'?['lcd1602.py']:key==='lcdWeather'?['lcd1602.py','lab_i2c_sensors.py']:key==='weather'?['lab_i2c_sensors.py','ssd1306.py']:['lab_i2c_sensors.py'];
  return Object.fromEntries(await Promise.all(names.map(async name=>{const r=await fetch(runtimeAsset('drivers/'+name));if(!r.ok)throw Error('Nedostaje upravljačka datoteka '+name);return [name,await r.text()];})));
}
const cppSingle=(key:'bmp180'|'bmp280'|'am2320')=>`#include <LabI2CSensors.h>
Lab${key.toUpperCase()} senzor;
void setup() {
  Serial.begin(9600);
  if (!senzor.begin()) Serial.println(F("${key.toUpperCase()}: provjeri spoj"));
}
void loop() {
  float temperatura, vrijednost;
  if (senzor.read(temperatura, vrijednost)) {
    Serial.print(F("${key.toUpperCase()} T=")); Serial.print(temperatura, 2);
    Serial.print(F("${key==='am2320'?' RH=':' P='}")); Serial.println(vrijednost, ${key==='am2320'?2:0});
  } else Serial.println(F("${key.toUpperCase()}: nema valjanog mjerenja"));
  delay(2100);
}
`;
export const arduinoEnvironmentExamples={
  bmp180:{title:'Arduino · '+environmentExamples.bmp180.title,hint:intros.bmp180+' Modul s prilagodbom na 5 V, SDA=A4, SCL=A5, VCC=5 V i GND.',libraries:['LabI2CSensors'],code:cppSingle('bmp180')},
  bmp280:{title:'Arduino · '+environmentExamples.bmp280.title,hint:intros.bmp280+' Modul s prilagodbom na 5 V, SDA=A4, SCL=A5, VCC=5 V i GND.',libraries:['LabI2CSensors'],code:cppSingle('bmp280')},
  am2320:{title:'Arduino · '+environmentExamples.am2320.title,hint:intros.am2320+' Modul s prilagodbom na 5 V, SDA=A4, SCL=A5, VCC=5 V i GND.',libraries:['LabI2CSensors'],code:cppSingle('am2320')},
  weather:{title:'Arduino · meteorološka stanica',hint:intros.weather+' Svi su moduli izričito profili s prilagodbom razina na 5 V. SDA=A4, SCL=A5; U8g2 koristi stranice od 128 B.',libraries:['LabI2CSensors','U8g2'],code:`#include <LabI2CSensors.h>
#include <U8g2lib.h>
LabBMP180 bmp180;
LabBMP280 bmp280;
LabAM2320 am2320;
// _1_ koristi stranicu od 128 B, cijela slika je u memoriji OLED kontrolera.
U8G2_SSD1306_128X64_NONAME_1_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);
void setup() {
  Serial.begin(9600);
  if (!bmp180.begin()) Serial.println(F("BMP180: provjeri spoj"));
  if (!bmp280.begin()) Serial.println(F("BMP280: provjeri spoj"));
  am2320.begin();
  oled.begin(); oled.setFont(u8g2_font_6x10_tf);
}
void loop() {
  float t180, p180, t280, p280, temperatura, vlaga;
  if (!bmp180.read(t180,p180) || !bmp280.read(t280,p280) || !am2320.read(temperatura,vlaga)) {
    Serial.println(F("Stanica: provjeri spoj, adresu i CRC")); delay(2100); return;
  }
  oled.firstPage();
  do {
    oled.setCursor(0,12); oled.print(F("BMP180 ")); oled.print(p180/100,1); oled.print(F(" hPa"));
    oled.setCursor(0,26); oled.print(F("BMP280 ")); oled.print(p280/100,1); oled.print(F(" hPa"));
    oled.setCursor(0,40); oled.print(F("AM2320 ")); oled.print(temperatura,1); oled.print(F(" C"));
    oled.setCursor(0,54); oled.print(F("RH ")); oled.print(vlaga,1); oled.print(F(" %"));
  } while(oled.nextPage());
  Serial.print(F("BMP180 T=")); Serial.print(t180,2); Serial.print(F(" P=")); Serial.println(p180,0);
  Serial.print(F("BMP280 T=")); Serial.print(t280,2); Serial.print(F(" P=")); Serial.println(p280,0);
  Serial.print(F("AM2320 T=")); Serial.print(temperatura,2); Serial.print(F(" RH=")); Serial.println(vlaga,2);
  delay(2100);
}
`},
}as const;
