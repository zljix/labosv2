from machine import Pin, PWM
from time import ticks_ms, ticks_diff, sleep_ms
from ulazi import ocitaj
from ventil import odluka

# Lokalni model isporuke poruka. Svaki red pripada jednome uzorku sata.
# Broj naredbe, radnja, starost u koracima. OFFLINE predstavlja prekid dostave.
PROTOKOL = "HTTP"
PORUKE = ((1, "OPEN", 0), (1, "OPEN", 0), (2, "CLOSE", 4),
          (3, "X", 0), (4, "CLOSE", 0), (0, "OFFLINE", 0),
          (0, "WAIT", 0), (5, "AUTO", 0))
INTERVAL_MS = 2000
led = Pin(21, Pin.OUT)
alarm_led = Pin(47, Pin.OUT)
servo = PWM(Pin(14), freq=50)
uzorak = 0
zadnji_id = 0
nacin = "AUTO"
automatski = False
alarm = False

while True:
    pocetak = ticks_ms()
    try:
        t = ocitaj()
        automatski = odluka(t, automatski)
        if t >= 30: alarm = True
        if t <= 28: alarm = False
    except Exception:
        t = None
        alarm = True
        automatski = False
    print("device=u07 boot=1 seq=", uzorak + 1, "t_ms=", pocetak, "T_C=", t)
    i = uzorak % len(PORUKE)
    broj, radnja, starost = PORUKE[i]
    broj += 10 * (uzorak // len(PORUKE))
    if radnja == "OFFLINE":
        print("OFFLINE: lokalno mjerenje, bez dostave")
        nacin = "AUTO"
    elif radnja == "WAIT":
        print("WAIT: odgovor još nije stigao")
    else:
        print("POST /uzorak -> odgovor" if PROTOKOL == "HTTP" else "TCP zapis -> odgovor" if PROTOKOL == "TCP" else "PUBLISH u07/uzorak <- u07/naredba")
        if starost > 2: odgovor = "STARA"
        elif broj <= zadnji_id: odgovor = "DUPLIKAT"
        elif radnja not in ("OPEN", "CLOSE", "AUTO"): odgovor = "NEPOZNATA"
        else:
            nacin = radnja
            zadnji_id = broj
            odgovor = "PRIHVACENO"
        print("ack_id:", broj, radnja, odgovor)
    otvoren = t is not None and (automatski if nacin == "AUTO" else nacin == "OPEN")
    led.value(otvoren)
    alarm_led.value(alarm)
    servo.duty_ns(2000000 if otvoren else 1000000)
    print("cilj:", "OPEN" if otvoren else "CLOSE", "alarm:", alarm)
    uzorak += 1
    sleep_ms(max(0, INTERVAL_MS - ticks_diff(ticks_ms(), pocetak)))
