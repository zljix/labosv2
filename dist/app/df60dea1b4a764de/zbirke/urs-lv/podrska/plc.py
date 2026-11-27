# Simulator LV16. Svoj ST program mijenjas u deklaracije.txt i program.txt.
from machine import Pin
from time import sleep_ms, ticks_ms, ticks_diff
from plc_st import Plc

with open('/deklaracije.txt') as source:
    declarations = source.read()
with open('/program.txt') as source:
    plc = Plc(declarations, source.read())

start = Pin(4, Pin.IN, Pin.PULL_UP)
stop = Pin(5, Pin.IN, Pin.PULL_UP)
protection = Pin(6, Pin.IN, Pin.PULL_UP)
reset = Pin(7, Pin.IN, Pin.PULL_UP)
motor = Pin(21, Pin.OUT, value=0)
previous = None
last_tick = ticks_ms()
elapsed = 0
last_print = -1000

while True:
    tick = ticks_ms()
    elapsed += ticks_diff(tick, last_tick)
    last_tick = tick
    values = plc.scan({'START': not start.value(), 'STOPOK': bool(stop.value()),
                       'PROTECTIONOK': bool(protection.value()), 'RESET': not reset.value()}, elapsed)
    motor.value(int(values['MOTOR']))
    watched = [key for key in sorted(values) if not key.endswith('.ET')]
    current = ' '.join('%s=%d' % (key, values[key]) for key in watched)
    if current != previous or elapsed - last_print >= 1000:
        print('%d ms | %s' % (elapsed, current))
        previous, last_print = current, elapsed
    sleep_ms(20)
