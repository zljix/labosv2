from machine import Pin
from time import sleep_ms
from onewire import OneWire
from ds18x20 import DS18X20

senzor = DS18X20(OneWire(Pin(4)))


def ocitaj():
    # Novi uzorak nastaje nakon pretvorbe. Pogreška veze nije mjerenje od 0 °C.
    romovi = senzor.scan()
    if not romovi:
        raise ValueError("Provjeri DQ i napajanje senzora")
    senzor.convert_temp()
    sleep_ms(750)
    return senzor.read_temp(romovi[0])
