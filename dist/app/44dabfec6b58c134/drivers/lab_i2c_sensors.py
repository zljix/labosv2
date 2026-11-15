"""MIT. Project I2C drivers: Bosch register compensation and AM2320 CRC16.

These use machine.I2C transactions and work independently of the simulator.
read() returns temperature in C and pressure in Pa or relative humidity in %.
"""
from time import sleep_ms, ticks_ms, ticks_us, ticks_diff


def _signed(v):
    return v - 65536 if v & 0x8000 else v


class BMP180:
    def __init__(self, bus):
        self.bus = bus
        sleep_ms(10)
        if bus.readfrom_mem(0x77, 0xd0, 1) != b'\x55':
            raise OSError('BMP180 chip ID')
        b = bus.readfrom_mem(0x77, 0xaa, 22)
        self.c = [int.from_bytes(b[i:i+2], 'big') for i in range(0, 22, 2)]
        for i in (0, 1, 2, 6, 7, 8, 9, 10):
            self.c[i] = _signed(self.c[i])
        if not self.c[3] or not self.c[4]:
            raise OSError('BMP180 calibration')

    def _wait_conversion(self, delay_ms):
        # Fixed waits can resume early in a browser host. SCO is the device truth.
        started = ticks_ms()
        sleep_ms(delay_ms)
        while self.bus.readfrom_mem(0x77, 0xf4, 1)[0] & 0x20:
            if ticks_diff(ticks_ms(), started) > 100:
                raise OSError('BMP180 conversion timeout')
            sleep_ms(1)

    def read(self, oss=0):
        if oss not in (0, 1, 2, 3):
            raise ValueError('OSS 0-3')
        c = self.c
        self.bus.writeto_mem(0x77, 0xf4, b'\x2e')
        self._wait_conversion(5)
        ut = int.from_bytes(self.bus.readfrom_mem(0x77, 0xf6, 2), 'big')
        x1 = ((ut-c[5])*c[4]) >> 15
        x2 = int(c[9]*2048/(x1+c[10]))  # C signed division truncates toward zero
        b5 = x1+x2
        temperature = ((b5+8) >> 4)/10
        self.bus.writeto_mem(0x77, 0xf4, bytes((0x34 | (oss << 6),)))
        self._wait_conversion((5, 8, 14, 26)[oss])
        up = int.from_bytes(self.bus.readfrom_mem(0x77, 0xf6, 3), 'big') >> (8-oss)
        b6 = b5-4000
        x1 = (c[7]*((b6*b6) >> 12)) >> 11
        x2 = (c[1]*b6) >> 11
        b3 = (((c[0]*4+x1+x2)*(1 << oss))+2) >> 2
        x1 = (c[2]*b6) >> 13
        x2 = (c[6]*((b6*b6) >> 12)) >> 16
        b4 = (c[3]*(((x1+x2+2) >> 2)+32768)) >> 15
        b7 = (up-b3)*(50000 >> oss)
        pressure = b7*2//b4 if b7 < 0x80000000 else (b7//b4)*2
        x1 = ((pressure >> 8)**2*3038) >> 16
        x2 = (-7357*pressure) >> 16
        return temperature, pressure+((x1+x2+3791) >> 4)


class BMP280:
    def __init__(self, bus, address=0x76):
        self.bus, self.address = bus, address
        sleep_ms(5)
        if bus.readfrom_mem(address, 0xd0, 1) != b'\x58':
            raise OSError('BMP280 chip ID')
        bus.writeto_mem(address, 0xe0, b'\xb6')
        sleep_ms(5)
        b = bus.readfrom_mem(address, 0x88, 24)
        self.c = [int.from_bytes(b[i:i+2], 'little') for i in range(0, 24, 2)]
        for i in range(12):
            if i not in (0, 3):
                self.c[i] = _signed(self.c[i])
        if not self.c[3]:
            raise OSError('BMP280 calibration')
        bus.writeto_mem(address, 0xf5, b'\x00')

    def read(self):
        self.bus.writeto_mem(self.address, 0xf4, b'\x25')
        sleep_ms(8)
        b = self.bus.readfrom_mem(self.address, 0xf7, 6)
        ap = int.from_bytes(b[:3], 'big') >> 4
        at = int.from_bytes(b[3:], 'big') >> 4
        if ap == 0x80000 or at == 0x80000:
            raise OSError('BMP280 skipped measurement')
        c = self.c
        v1 = (((at >> 3)-c[0]*2)*c[1]) >> 11
        v2 = (((((at >> 4)-c[0])**2) >> 12)*c[2]) >> 14
        fine = v1+v2
        temperature = ((fine*5+128) >> 8)/100
        x = fine-128000
        y = x*x*c[8]+x*c[7]*131072+c[6]*34359738368
        x = ((((1 << 47)+((x*x*c[5]) >> 8)+x*c[4]*4096)*c[3]) >> 33)
        p = (((1048576-ap)*(1 << 31)-y)*3125)//x
        x = (c[11]*(p >> 13)*(p >> 13)) >> 25
        y = (c[10]*p) >> 19
        p = ((p+x+y) >> 8)+c[9]*16
        return temperature, p/256


def crc16(data):
    crc = 0xffff
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xa001 if crc & 1 else crc >> 1
    return crc


class AM2320:
    def __init__(self, bus):
        self.bus = bus
        self._wait_min(2000)

    def _wait_min(self, milliseconds):
        # Host timers can resume early. The device needs elapsed time, not
        # merely a completed sleep call. Keep all I2C ACK/CRC checks intact.
        started = ticks_us()
        sleep_ms(milliseconds)
        while ticks_diff(ticks_us(), started) < milliseconds * 1000:
            sleep_ms(1)

    def read(self):
        try:
            self.bus.writeto(0x5c, b'')  # NACK is expected while waking
        except OSError:
            pass
        self._wait_min(1)
        self.bus.writeto(0x5c, b'\x03\x00\x04')
        self._wait_min(2)
        b = self.bus.readfrom(0x5c, 8)
        if b[:2] != b'\x03\x04' or crc16(b[:6]) != int.from_bytes(b[6:], 'little'):
            raise OSError('AM2320 header or CRC16')
        humidity = int.from_bytes(b[2:4], 'big')/10
        t = int.from_bytes(b[4:6], 'big')
        return (-(t & 0x7fff)/10 if t & 0x8000 else t/10), humidity
