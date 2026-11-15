import {iliCircuit,cppILI9341} from './ili9341Examples';
import {makePart,terminals,type Circuit} from './model';
import {S3,type BoardId} from '../boards/profiles';
export {cppILI9341};
export type TouchExample='touchRaw'|'touchCalibration'|'touchButton'|'touchRotation';
export function touchCircuit(key:TouchExample,board:BoardId=S3):Circuit {
 const c=iliCircuit('iliGraphics',board),b=c.components[0],avr=board!==S3;
 // Use the supply connector explicitly; IOREF is a logic reference on Uno.
 if(avr)for(const w of c.wires)if(w.to.pin==='VCC')w.from.pin='5V';
 const p=makePart('xpt2046',avr?650:420,560,'touch1');
 Object.assign(p.properties,{moduleVoltage:avr?5:3.3,logicVoltage:avr?5:3.3,touchDisplay:'tft1'});c.components.push(p);
 const wire=(id:string,pin:string,source:number|string)=>c.wires.push({id:'touchwire'+c.wires.length,from:{component:b.id,pin:typeof source==='number'?terminals(b).find(t=>t.gpio===source)!.pin:source},to:{component:id,pin},color:pin==='VCC'?'#d04b46':pin==='GND'?'#334155':'#087f8c',points:[]});
 wire(p.id,'VCC',avr?'5V':terminals(b).find(t=>t.role==='3v3')!.pin);wire(p.id,'GND',terminals(b).find(t=>t.role==='ground')!.pin);
 wire(p.id,'SCK',avr?13:12);wire(p.id,'MOSI',11);wire(p.id,'MISO',avr?12:13);wire(p.id,'CS',7);wire(p.id,'IRQ',2);
 if(key==='touchButton'){
  c.components.push({...makePart('resistor',1070,100,'touchR'),properties:{resistance:680}},makePart('led',1250,100,'touchLED'));
  wire('touchR','1',avr?6:4);
  c.wires.push({id:'touchled-a',from:{component:'touchR',pin:'2'},to:{component:'touchLED',pin:'A'},color:'#087f8c',points:[]});wire('touchLED','K',terminals(b).find(t=>t.role==='ground')!.pin);
 }
 return c;
}
const hint='Dodirni sloj XPT2046 je zaseban kontroler: SCK/MOSI/MISO dijeli s TFT sabirnicom, CS7 je odvojen od TFT CS10 (DC9/RESET8). IRQ2 je opcionalan aktivno LOW izlaz s pull-upom; program ga čita kao ulaz. SPI mode 0, MSB, 1 MHz u primjerima. ESP32 SCK12/MOSI11/MISO13; Uno/Nano D13/D11/D12. VCC/logika 3,3 V za ESP32 ili izričit 5 V carrier s obostranom prilagodbom za Uno/Nano; BL TFT-a ostaje 3V3. Pritisni i drži prikaz DODIR, povuci pa otpusti; tipkovnički su dostupni klizači X/Y i gumb Pritisni/Otpusti. X/Y iz SPI-ja nisu pikseli. Lab krajevi 200–3900 / 250–3850 nisu univerzalna kalibracija fizičkih modula. Z=Z1+4095−Z2 je bezdimenzijski pokazatelj, nije sila ni tlak u Pa. ';
const pyStart=`from machine import Pin, SPI
from time import sleep_ms
from lab_ili9341 import ILI9341
from lab_xpt2046 import XPT2046, calibrate

# Najprije oba CS HIGH, zatim zajednička sabirnica. Nema TFT MISO-a.
tft_cs = Pin(10, Pin.OUT, value=1)
touch_cs = Pin(7, Pin.OUT, value=1)
irq = Pin(2, Pin.IN)
bus = SPI(1, baudrate=1000000, polarity=0, phase=0,
          sck=Pin(12), mosi=Pin(11), miso=Pin(13))
touch = XPT2046(bus, touch_cs, irq)
tft = ILI9341(bus, tft_cs, Pin(9), Pin(8))
`;
export const touchExamples={
 touchRaw:{title:'XPT2046 · sirovi X/Y i pritisak',hint:hint+' Usporedi X/Y s položajem, Z1/Z2 s relativnim pritiskom i IRQ s pritiskom/otpuštanjem. Bez dodira Z1=0, Z2=4095 u ovom determinističkom profilu; stvarni panel može dati neodređene X/Y.',code:pyStart+`
tft.fill(0)
tft.text("SIROVI DODIR", 12, 30, 0xffff, 2)
tft.text("PRATI KONZOLU", 12, 70, 0x07ff, 2)
while True:
    x, y, z1, z2 = touch.raw()
    print("TOUCH RAW X=%d Y=%d Z1=%d Z2=%d IRQ=%d" % (x, y, z1, z2, irq()))
    sleep_ms(100)
`},
 touchCalibration:{title:'XPT2046 · kalibracija u dvije točke',hint:hint+' Program traži gornji lijevi pa donji desni križić. Drži dodir dok se križić ne promijeni, zatim otpusti. Iz dva očitana para računa krajeve, ispisuje ih i prikazuje kalibrirane koordinate. Nakon novog Run kalibriraš ponovno. Dvije točke pretpostavljaju poravnate osi; ne rješavaju zakretanje/smicanje stvarnog panela.',code:pyStart+`
def target(x, y):
    tft.fill(0)
    tft.text("KALIBRACIJA", 45, 140, 0xffff, 2)
    tft.line(x-10, y, x+10, y, 0xffe0)
    tft.line(x, y-10, x, y+10, 0xffe0)

def capture(x, y):
    target(x, y)
    print("CAL TARGET %d %d" % (x, y))
    while True:
        r = touch.raw()
        if touch.valid(r):
            break
        sleep_ms(20)
    # Zadržani dodir ne smije slučajno potvrditi i drugu točku.
    while touch.point() is not None:
        sleep_ms(20)
    return r

a = capture(20, 20)
b = capture(219, 299)
# Linearna ekstrapolacija od oznaka do fizičkih rubova 0/239 i 0/319.
if b[0]-a[0] < 500 or b[1]-a[1] < 500:
    raise ValueError("Pogresne tocke; ponovno pokreni i pogodi oba krizica")
x0 = round(a[0] - (b[0]-a[0])*20/199)
x1 = round(a[0] + (b[0]-a[0])*219/199)
y0 = round(a[1] - (b[1]-a[1])*20/279)
y1 = round(a[1] + (b[1]-a[1])*299/279)
cal = (x0, x1, y0, y1)
print("CAL READY %d %d %d %d" % cal)
tft.fill(0)
tft.text("KALIBRIRANO", 20, 30, 0x07e0, 2)
while True:
    p = touch.point(calibration=cal)
    if p is not None:
        x, y, z = p
        tft.fill_rect(10, 110, 220, 30, 0)
        tft.text("X %d Y %d" % (x, y), 12, 115, 0xffff, 2)
        tft.fill_rect(x-2, y-2, 5, 5, 0xffe0)
        print("CAL POINT %d %d" % (x, y))
    sleep_ms(50)
`},
 touchButton:{title:'XPT2046 · dodirno tipkalo upravlja LED-icom',hint:hint+' Program nakon kalibracije provjerava pravokutnik (30,120)–(209,199) i preklapa LED samo na početku novog dodira unutar njega. Držanje, povlačenje i dodir izvan polja nisu novi pritisak. Vanjska LED s otpornikom: GPIO4 na ESP32, D6 na Uno/Nano. Pokus: izmijeni kalibracijske konstante ili ROTATION pa usporedi odziv.',code:pyStart+`
led = Pin(4, Pin.OUT, value=0)
ROTATION = 0
CALIBRATION = (200, 3900, 250, 3850)
tft.rotation(ROTATION)
tft.fill(0)
tft.text("DODIRNO TIPKALO", 10, 30, 0xffff, 2)
state, was_down = False, False

def draw_button():
    tft.fill_rect(30, 120, 180, 80, 0x07e0 if state else 0x001f)
    tft.text("LED ON" if state else "LED OFF", 48, 150, 0xffff, 3)

draw_button()
print("TOUCH BUTTON READY")
while True:
    p = touch.point(ROTATION, CALIBRATION)
    down = p is not None
    if down and not was_down:
        x, y, z = p
        if 30 <= x < 210 and 120 <= y < 200:
            state = not state
            led(state)
            draw_button()
            print("TOUCH LED=%d X=%d Y=%d" % (state, x, y))
    was_down = down
    sleep_ms(20)
`},
 touchRotation:{title:'XPT2046 · dodir i četiri rotacije',hint:hint+' Svaki novi dodir ispisuje logičke koordinate za prikazanu rotaciju, zatim bira sljedeću rotaciju. Fizički panel ostaje 240×320. Ista fizička točka ima različite logičke X/Y; rotaciju treba uskladiti s MADCTL-om u programu.',code:pyStart+`
rotation, was_down = 0, False

def screen():
    tft.rotation(rotation)
    tft.fill(0)
    tft.rect(0, 0, tft.width, tft.height, 0xffff)
    tft.fill_rect(0, 0, 24, 24, 0xf800)
    tft.text("ROT %d" % rotation, 35, 90, 0x07ff, 3)
    print("TOUCH SCREEN %d" % rotation)

screen()
print("TOUCH ROT READY")
while True:
    p = touch.point(rotation)
    down = p is not None
    if down and not was_down:
        print("TOUCH ROT=%d X=%d Y=%d" % (rotation, p[0], p[1]))
        rotation = (rotation + 1) % 4
        screen()
    was_down = down
    sleep_ms(50)
`},
}as const;
const cppStart=`#include <SPI.h>
#include "lab_ili9341.h"
#include "lab_xpt2046.h"
LabILI9341 tft(10,9,8);
LabXPT2046 touch(7);
void beginDevices(){
 digitalWrite(10,HIGH);pinMode(10,OUTPUT);
 digitalWrite(7,HIGH);pinMode(7,OUTPUT);
 pinMode(2,INPUT);Serial.begin(9600);touch.begin();tft.begin();
}
`;
export const arduinoTouchExamples={
 touchRaw:{...touchExamples.touchRaw,title:'Arduino · '+touchExamples.touchRaw.title,code:cppStart+`
void setup(){beginDevices();tft.fillScreen(0);tft.setCursor(12,30);tft.setTextSize(2);tft.print(F("SIROVI DODIR"));tft.setCursor(12,70);tft.print(F("PRATI KONZOLU"));}
void loop(){
 LabXPT2046::Raw r=touch.raw();
 Serial.print(F("TOUCH RAW X="));Serial.print(r.x);Serial.print(F(" Y="));Serial.print(r.y);
 Serial.print(F(" Z1="));Serial.print(r.z1);Serial.print(F(" Z2="));Serial.print(r.z2);Serial.print(F(" IRQ="));Serial.println(digitalRead(2));delay(100);
}
`},
 touchCalibration:{...touchExamples.touchCalibration,title:'Arduino · '+touchExamples.touchCalibration.title,code:cppStart+`
int16_t x0,x1,y0,y1;
LabXPT2046::Raw capture(int16_t x,int16_t y){
 tft.fillScreen(0);tft.setCursor(45,140);tft.setTextSize(2);tft.print(F("KALIBRACIJA"));
 tft.drawLine(x-10,y,x+10,y,0xffe0);tft.drawLine(x,y-10,x,y+10,0xffe0);
 Serial.print(F("CAL TARGET "));Serial.print(x);Serial.print(' ');Serial.println(y);
 LabXPT2046::Raw r;do{r=touch.raw();delay(20);}while(!LabXPT2046::valid(r));
 LabXPT2046::Point p;while(touch.point(p))delay(20);return r;
}
void setup(){
 beginDevices();LabXPT2046::Raw a=capture(20,20),b=capture(219,299);
 if((long)b.x-a.x<500||(long)b.y-a.y<500){Serial.println(F("CAL ERROR: ponovno pogodi krizice"));while(true)delay(100);}
 // long sprječava 16-bitno prelijevanje pri ekstrapolaciji rubova.
 x0=(long)a.x-((long)b.x-a.x)*20/199;x1=(long)a.x+((long)b.x-a.x)*219/199;
 y0=(long)a.y-((long)b.y-a.y)*20/279;y1=(long)a.y+((long)b.y-a.y)*299/279;
 Serial.print(F("CAL READY "));Serial.print(x0);Serial.print(' ');Serial.print(x1);Serial.print(' ');Serial.print(y0);Serial.print(' ');Serial.println(y1);
 tft.fillScreen(0);tft.setCursor(20,30);tft.setTextColor(0x07e0);tft.print(F("KALIBRIRANO"));
}
void loop(){LabXPT2046::Point p;if(touch.point(p,0,x0,x1,y0,y1)){
 tft.fillRect(10,110,220,30,0);tft.setCursor(12,115);tft.setTextColor(0xffff);tft.print(F("X "));tft.print(p.x);tft.print(F(" Y "));tft.print(p.y);
 tft.fillRect(p.x-2,p.y-2,5,5,0xffe0);Serial.print(F("CAL POINT "));Serial.print(p.x);Serial.print(' ');Serial.println(p.y);
}delay(50);}
`},
 touchButton:{...touchExamples.touchButton,title:'Arduino · '+touchExamples.touchButton.title,code:cppStart+`
const uint8_t ROTATION=0; // Uskladi TFT i programsko mapiranje dodira.
const int16_t X0=200,X1=3900,Y0=250,Y1=3850;
bool state=false,wasDown=false;
void drawButton(){tft.fillRect(30,120,180,80,state?0x07e0:0x001f);tft.setCursor(48,150);tft.setTextSize(3);tft.setTextColor(0xffff);tft.print(state?F("LED ON"):F("LED OFF"));}
void setup(){pinMode(6,OUTPUT);digitalWrite(6,LOW);beginDevices();tft.setRotation(ROTATION);tft.fillScreen(0);tft.setCursor(10,30);tft.setTextSize(2);tft.print(F("DODIRNO TIPKALO"));drawButton();Serial.println(F("TOUCH BUTTON READY"));}
void loop(){
 LabXPT2046::Point p;bool down=touch.point(p,ROTATION,X0,X1,Y0,Y1);
 if(down&&!wasDown&&p.x>=30&&p.x<210&&p.y>=120&&p.y<200){
  state=!state;digitalWrite(6,state);drawButton();Serial.print(F("TOUCH LED="));Serial.print(state);Serial.print(F(" X="));Serial.print(p.x);Serial.print(F(" Y="));Serial.println(p.y);
 }wasDown=down;delay(20);
}
`},
 touchRotation:{...touchExamples.touchRotation,title:'Arduino · '+touchExamples.touchRotation.title,code:cppStart+`
uint8_t rotation=0;bool wasDown=false;
void screen(){tft.setRotation(rotation);tft.fillScreen(0);tft.drawRect(0,0,tft.width(),tft.height(),0xffff);tft.fillRect(0,0,24,24,0xf800);tft.setCursor(35,90);tft.setTextColor(0x07ff);tft.setTextSize(3);tft.print(F("ROT "));tft.print(rotation);Serial.print(F("TOUCH SCREEN "));Serial.println(rotation);}
void setup(){beginDevices();screen();Serial.println(F("TOUCH ROT READY"));}
void loop(){LabXPT2046::Point p;bool down=touch.point(p,rotation);if(down&&!wasDown){
 Serial.print(F("TOUCH ROT="));Serial.print(rotation);Serial.print(F(" X="));Serial.print(p.x);Serial.print(F(" Y="));Serial.println(p.y);rotation=(rotation+1)%4;screen();
}wasDown=down;delay(50);}
`},
}as const;
