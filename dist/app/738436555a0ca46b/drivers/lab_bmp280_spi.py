# MIT · ESP32 MicroPython Lab · 1.0.0 · 4-wire SPI, no IIR/3-wire.
from lab_i2c_sensors import BMP280
class _Registers:
    def __init__(self, spi, cs):
        self.spi, self.cs = spi, cs
        cs.init(cs.OUT, value=1)
    def readfrom_mem(self, address, register, n):
        self.cs.value(0)
        try:
            self.spi.write(bytes([register | 128]))
            return self.spi.read(n)
        finally:
            self.cs.value(1)
    def writeto_mem(self, address, register, data):
        self.cs.value(0)
        try:
            for value in data:
                self.spi.write(bytes([register & 127, value]))
        finally:
            self.cs.value(1)
class BMP280SPI(BMP280):
    def __init__(self, spi, cs):
        super().__init__(_Registers(spi, cs))
