from time import ticks_ms, ticks_diff, sleep_ms
from ulazi import ocitaj

INTERVAL_MS = 2000
KOREKCIJA_C = 0.0
REFERENCA_C = 25.0
broj = 0
while True:
    pocetak = ticks_ms()
    try:
        t = ocitaj()
        broj += 1
        print("sirovo:", t, "ispravljeno:", t + KOREKCIJA_C, "referenca:", REFERENCA_C)
        print("uzorak:", broj, "t_ms:", ticks_ms(), "T_C:", t)
    except Exception as greska:
        print("Pogreska senzora:", greska)
    sleep_ms(max(0, INTERVAL_MS - ticks_diff(ticks_ms(), pocetak)))
