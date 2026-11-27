# V1.10 - Usporedi dva temperaturna senzora
# 1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
# 2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
# 3. U Thonnyju spremi ovaj program na uredjaj kao main.py; pritisni RESET.
# 4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
# Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.

class _DioPrograma:
    def __init__(self, vrijednosti):
        for naziv, vrijednost in vrijednosti.items():
            setattr(self, naziv, vrijednost)


# Dio: senzori_i2c
def _pripremi_senzori_i2c():
    from time import sleep_ms
    import struct

    class AHT10:

        def __init__(self, i2c, addr=56):
            self.i2c, self.addr = (i2c, addr)
            sleep_ms(40)
            self.i2c.writeto(addr, b'\xe1\x08\x00')
            sleep_ms(20)
            status = self.i2c.readfrom(addr, 1)[0]
            if not status & 8:
                raise OSError('AHT10 nije kalibriran/inicijaliziran')

        def read(self):
            self.i2c.writeto(self.addr, b'\xac3\x00')
            sleep_ms(80)
            for _ in range(10):
                data = self.i2c.readfrom(self.addr, 6)
                if not data[0] & 128:
                    if not data[0] & 8:
                        raise OSError('AHT10: izgubljen kalibracijski status')
                    rh = data[1] << 12 | data[2] << 4 | data[3] >> 4
                    temp = (data[3] & 15) << 16 | data[4] << 8 | data[5]
                    return (temp * 200 / 1048576 - 50, rh * 100 / 1048576)
                sleep_ms(10)
            raise OSError('AHT10: istek cekanja')

    class BMP180:

        def __init__(self, i2c, addr=119):
            self.i2c, self.addr = (i2c, addr)
            if i2c.readfrom_mem(addr, 208, 1)[0] != 85:
                raise ValueError('Nije potvrden BMP180/BMP085')
            data = i2c.readfrom_mem(addr, 170, 22)
            self.c = struct.unpack('>hhhHHHhhhhh', data)
            if self.c[3] == 0 or self.c[4] == 0:
                raise ValueError('Nevaljani tvornicki koeficijenti')

        def read(self):
            self.i2c.writeto_mem(self.addr, 244, b'.')
            sleep_ms(5)
            ut = int.from_bytes(self.i2c.readfrom_mem(self.addr, 246, 2), 'big')
            self.i2c.writeto_mem(self.addr, 244, b'4')
            sleep_ms(5)
            d = self.i2c.readfrom_mem(self.addr, 246, 3)
            up = (d[0] << 16 | d[1] << 8 | d[2]) >> 8
            return self.compensate(ut, up)

        def compensate(self, ut, up):
            ac1, ac2, ac3, ac4, ac5, ac6, b1, b2, mb, mc, md = self.c
            x1 = (ut - ac6) * ac5 >> 15
            if x1 + md == 0:
                raise ValueError('BMP180: dijeljenje nulom')
            a, b = (mc << 11, x1 + md)
            x2 = abs(a) // abs(b)
            if (a < 0) != (b < 0):
                x2 = -x2
            b5 = x1 + x2
            temp = (b5 + 8 >> 4) / 10
            b6 = b5 - 4000
            x1 = b2 * (b6 * b6 >> 12) >> 11
            x2 = ac2 * b6 >> 11
            b3 = ac1 * 4 + x1 + x2 + 2 >> 2
            x1 = ac3 * b6 >> 13
            x2 = b1 * (b6 * b6 >> 12) >> 16
            x3 = x1 + x2 + 2 >> 2
            b4 = ac4 * (x3 + 32768) >> 15
            if b4 == 0:
                raise ValueError('BMP180: nevaljan koeficijent')
            b7 = (up - b3) * 50000
            pressure = b7 * 2 // b4 if b7 < 2147483648 else b7 // b4 * 2
            x1 = (pressure >> 8) * (pressure >> 8)
            x1 = x1 * 3038 >> 16
            x2 = -7357 * pressure >> 16
            pressure += x1 + x2 + 3791 >> 4
            return (temp, pressure)
    return _DioPrograma({'AHT10': AHT10})

_m_senzori_i2c = _pripremi_senzori_i2c()

# Dio: main
def _pripremi_main():
    from machine import Pin, I2C
    from time import sleep_ms
    AHT10 = _m_senzori_i2c.AHT10
    REPORT_MS = 3000
    HUMIDITY_LIMIT_PCT = 65.0

    def vlaznost_iznad_praga(vlaznost):
        return vlaznost > HUMIDITY_LIMIT_PCT
    if not 2500 <= REPORT_MS <= 60000:
        raise ValueError('Nedopusten interval')
    bus = I2C(0, sda=Pin(8), scl=Pin(9), freq=100000)
    print('I2C adrese:', [hex(a) for a in bus.scan()])
    senzor = None
    while True:
        try:
            if senzor is None:
                senzor = AHT10(bus)
            t, drugo = senzor.read()
            print('T_C:', t, 'RH_POSTO:', drugo, 'IZNAD_PRAGA:', vlaznost_iznad_praga(drugo), 'VALJANO')
        except (OSError, ValueError) as err:
            senzor = None
            print('NEVALJANO:', err)
        sleep_ms(REPORT_MS)
    return _DioPrograma({})

_m_main = _pripremi_main()
