from time import ticks_ms, ticks_diff, sleep_ms
from ulazi import ocitaj

from machine import Pin
from dht import DHT22

drugi = DHT22(Pin(5))
sleep_ms(2100)
INTERVAL_MS = 2500
broj = 0
while True:
    pocetak = ticks_ms()
    try:
        t = ocitaj()
        drugi.measure()
        t2 = drugi.temperature()
        print("DS18B20:", t, "DHT22:", t2, "razlika:", t - t2)
        broj += 1
        print("uzorak:", broj, "t_ms:", ticks_ms(), "T_C:", t)
    except Exception as greska:
        print("Pogreska senzora:", greska)
    sleep_ms(max(0, INTERVAL_MS - ticks_diff(ticks_ms(), pocetak)))
