from machine import Pin
from time import sleep_ms

led = Pin(21, Pin.OUT)
UKLJUCENO_MS = 500
ISKLJUCENO_MS = 500

while True:
    led.on()
    print("LED ON")
    sleep_ms(UKLJUCENO_MS)
    led.off()
    print("LED OFF")
    sleep_ms(ISKLJUCENO_MS)
