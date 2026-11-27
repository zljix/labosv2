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


# Dio: main
def _pripremi_main():
    from machine import Pin
    from time import sleep_ms
    import dht
    import math
    DHT_MODEL = 'DHT22'
    REPORT_MS = 3000
    if DHT_MODEL not in ('DHT11', 'DHT22') or not 2500 <= REPORT_MS <= 60000:
        raise ValueError('Provjeri tip senzora i razmak mjerenja')
    senzor = dht.DHT22(Pin(15)) if DHT_MODEL == 'DHT22' else dht.DHT11(Pin(15))
    sleep_ms(2000)
    while True:
        try:
            senzor.measure()
            t, rh = (senzor.temperature(), senzor.humidity())
            if not math.isfinite(t) or not math.isfinite(rh) or (not 0 <= rh <= 100):
                raise ValueError('Nevaljan rezultat DHT senzora')
            print('T_C:', t, 'RH_POSTO:', rh, 'VALJANO')
        except (OSError, ValueError) as err:
            print('NEVALJANO:', err)
        sleep_ms(REPORT_MS)
    return _DioPrograma({})

_m_main = _pripremi_main()
