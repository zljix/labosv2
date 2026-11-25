from machine import Pin, PWM
from time import sleep_ms

servo = PWM(Pin(14), freq=50)
led = PWM(Pin(21), freq=1000)
DRUGA_SVJETLINA = 75  # postotak uključenja
DRUGI_KUT = 90

while True:
    for kut, postotak in ((30, 15), (DRUGI_KUT, DRUGA_SVJETLINA)):
        led.duty_u16(postotak * 65535 // 100)
        print("PWM %:", postotak)
        # Virtualni SG90: 1–2 ms unutar svakog perioda od 20 ms.
        impuls_us = 1000 + kut * 1000 // 180
        servo.duty_ns(impuls_us * 1000)
        print("kut:", kut, "impuls_us:", impuls_us)
        sleep_ms(1500)
