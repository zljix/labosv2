from machine import Pin, PWM
from time import ticks_ms, ticks_diff, sleep_ms
from ulazi import ocitaj
from ventil import odluka

INTERVAL_MS = 2000
led = Pin(21, Pin.OUT)
servo = PWM(Pin(14), freq=50)
otvoren = False
alarm = False
alarm_led = Pin(47, Pin.OUT)
ALARM_ON = 30.0
ALARM_OFF = 28.0

while True:
    pocetak = ticks_ms()
    try:
        t = ocitaj()
        otvoren = odluka(t, otvoren)
        if t >= ALARM_ON:
            alarm = True
        elif t <= ALARM_OFF:
            alarm = False
        print("alarm:", alarm)
        print("t_ms:", pocetak, "T_C:", t, "cilj:", "OPEN" if otvoren else "CLOSE")
    except Exception as greska:
        otvoren = False
        alarm = True
        print("GRESKA DQ:", greska)
    alarm_led.value(alarm)
    led.value(otvoren)
    servo.duty_ns(2000000 if otvoren else 1000000)
    sleep_ms(max(0, INTERVAL_MS - ticks_diff(ticks_ms(), pocetak)))
