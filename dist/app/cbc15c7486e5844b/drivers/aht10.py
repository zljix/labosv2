# MIT, ESP32 MicroPython Lab contributors.
# AHT10 protocol driver. Uses only ordinary machine.I2C transactions.
from time import sleep_ms

class AHT10:
    def __init__(self, i2c, address=0x38):
        self.i2c = i2c
        self.address = address
        sleep_ms(40)
        if not self.i2c.readfrom(self.address, 1)[0] & 0x08:
            self.i2c.writeto(self.address, b"\xe1\x08\x00")
            sleep_ms(10)
        # Browser waits have millisecond granularity. Poll both calibrated and
        # not-busy instead of assuming a nominal 10 ms wait ended precisely.
        for _ in range(20):
            status = self.i2c.readfrom(self.address, 1)[0]
            if status & 0x88 == 0x08:
                break
            sleep_ms(5)
        else:
            raise OSError(110)

    def read(self):
        # Trigger a conversion, then wait for its busy flag to clear.
        self.i2c.writeto(self.address, b"\xac\x33\x00")
        sleep_ms(80)
        for _ in range(10):
            data = self.i2c.readfrom(self.address, 6)
            if not data[0] & 0x80:
                humidity_raw = (data[1] << 12) | (data[2] << 4) | (data[3] >> 4)
                temperature_raw = ((data[3] & 0x0f) << 16) | (data[4] << 8) | data[5]
                return temperature_raw * 200 / 1048576 - 50, humidity_raw * 100 / 1048576
            sleep_ms(10)
        raise OSError(110)
