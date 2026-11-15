import {emptyCircuit,makePart,terminals,type Circuit,type Endpoint} from './model';
import {runtimeAsset} from '../platform/assets';
export const peripheralExample = {
  title:'AHT10 → OLED → servo',
  hint:'I2C0: AHT10 na SDA8/SCL9; I2C1: OLED na SDA10/SCL11 (0x3C). Servo: GPIO4, 5 V i zajednička masa. Očitanje svake 2 s; otvara iznad 28 °C, zatvara ispod 26 °C. Mijenjaj okoliš i prati stvarne piksele te zapis mjerenja.',
  code:`from machine import Pin, I2C
from time import sleep_ms
from aht10 import AHT10
from ssd1306 import SSD1306_I2C
from servo import Servo

# SDA su podaci, SCL je takt. Adresa identificira uredjaj na sabirnici.
# AHT10 ima zasebnu sabirnicu prema uputi proizvodjaca.
senzor_bus = I2C(0, sda=Pin(8), scl=Pin(9), freq=100000)
zaslon_bus = I2C(1, sda=Pin(10), scl=Pin(11), freq=400000)
print("I2C0:", [hex(a) for a in senzor_bus.scan()])
print("I2C1:", [hex(a) for a in zaslon_bus.scan()])
senzor = AHT10(senzor_bus)
zaslon = SSD1306_I2C(128, 64, zaslon_bus, addr=0x3C)
servo = Servo(4)

# Dva praga (histereza) sprjecavaju stalno otvaranje/zatvaranje oko granice.
PRAG_OTVARANJA = 28
PRAG_ZATVARANJA = 26
otvoreno = False
while True:
    temperatura, vlaga = senzor.read()
    if temperatura >= PRAG_OTVARANJA:
        otvoreno = True
    elif temperatura <= PRAG_ZATVARANJA:
        otvoreno = False
    kut = 90 if otvoreno else 0
    servo.angle(kut)
    zaslon.fill(0)
    zaslon.text("T: %.1f C" % temperatura, 0, 0)
    zaslon.text("RH: %.1f %%" % vlaga, 0, 14)
    zaslon.text("Servo: %d deg" % kut, 0, 28)
    zaslon.text("OTVORENO" if otvoreno else "ZATVORENO", 0, 42)
    zaslon.rect(0, 55, 128, 9, 1)
    zaslon.fill_rect(2, 57, int(vlaga * 124 / 100), 5, 1)
    zaslon.show()  # framebuf -> I2C upis -> pikseli OLED-a
    print("T=%.2f C, RH=%.2f %%, servo=%d deg" % (temperatura, vlaga, kut))
    sleep_ms(1920)  # oko 2 s izmedju mjerenja, ukljucujuci 80 ms pretvorbe
`,
};
export const peripheralDriverNames=['aht10.py','ssd1306.py','servo.py'] as const;
export async function loadPeripheralDrivers():Promise<Record<string,string>> {
  const pairs=await Promise.all(peripheralDriverNames.map(async name=>{
    const r=await fetch(runtimeAsset('drivers/'+name),{cache:'no-store'});
    if(!r.ok)throw Error('Ne mogu učitati upravljačku datoteku '+name);
    return [name,await r.text()];
  }));return Object.fromEntries(pairs);
}
export function peripheralCircuit():Circuit {
  const c=emptyCircuit();
  c.components.push(makePart('aht10',600,160,'aht1'),makePart('ssd1306',1000,100,'oled1'),makePart('servo',900,510,'servo1'));
  const pin=(gpio:number)=>terminals(c.components[0]).find(t=>t.gpio===gpio)!.pin;
  const add=(a:Endpoint,b:Endpoint,color:string)=>c.wires.push({id:'pwire'+(c.wires.length+1),from:a,to:b,color,points:[]});
  const board=(p:string):Endpoint=>({component:'esp32',pin:p}),dev=(id:string,p:string):Endpoint=>({component:id,pin:p});
  add(board('J1.1'),dev('aht1','VCC'),'#d04b46');
  add(board('J1.22'),dev('aht1','GND'),'#334155');
  add(board(pin(8)),dev('aht1','SDA'),'#087f8c');
  add(board(pin(9)),dev('aht1','SCL'),'#d59218');
  add(board('J1.2'),dev('oled1','VCC'),'#d04b46');
  add(board('J3.1'),dev('oled1','GND'),'#334155');
  add(board(pin(10)),dev('oled1','SDA'),'#3867d6');
  add(board(pin(11)),dev('oled1','SCL'),'#8b52ba');
  add(board('J1.21'),dev('servo1','V+'),'#d04b46');
  add(board('J3.22'),dev('servo1','GND'),'#334155');
  add(board(pin(4)),dev('servo1','SIG'),'#d59218');
  return c;
}
