# MIT, ESP32 MicroPython Lab contributors.
# Ideal 180 degree servo profile; calibrate pulses for the real servo.
from machine import Pin, PWM

class Servo:
    def __init__(self, pin, min_us=500, max_us=2500):
        if not 0 < min_us < max_us < 20000:
            raise ValueError("Nevaljan raspon servo impulsa")
        self.min_us = min_us
        self.max_us = max_us
        self.pwm = PWM(pin if isinstance(pin, Pin) else Pin(pin), freq=50, duty_ns=1500000)

    def angle(self, degrees):
        if not 0 <= degrees <= 180:
            raise ValueError("Kut treba biti 0-180 stupnjeva")
        pulse_us = self.min_us + (self.max_us - self.min_us) * degrees / 180
        self.pwm.duty_ns(int(pulse_us * 1000))

    def deinit(self):
        self.pwm.deinit()
