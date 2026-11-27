from machine import Pin, ADC
from time import sleep_ms

senzor = ADC(Pin(1), atten=ADC.ATTN_11DB)
led = Pin(21, Pin.OUT)
PRAG = 24000  # read_u16: 0 do 65535

while True:
    svjetlost = senzor.read_u16()
    led.value(svjetlost < PRAG)
    print("ADC:", svjetlost, "LED:", led.value())
    sleep_ms(500)
