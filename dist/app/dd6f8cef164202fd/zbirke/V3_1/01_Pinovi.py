# V3.1 - Pronađi podatke o stvarnim komponentama
# 1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
# 2. Procitaj oznake: senzor GPIO4, LED GPIO21, signal serva GPIO14.
# 3. Program ne prenosis; oznake usporedi s nenapajanom plocicom.
# 4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
# Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.

class _DioPrograma:
    def __init__(self, vrijednosti):
        for naziv, vrijednost in vrijednosti.items():
            setattr(self, naziv, vrijednost)


# Dio: main
def _pripremi_main():
    import sys
    import os
    from time import sleep_ms
    REPORT_MS = 2000
    MESSAGE = 'ESP32-S3: program radi'
    if not 100 <= REPORT_MS <= 60000:
        raise ValueError('REPORT_MS mora biti 100..60000 ms')
    print('MicroPython:', sys.implementation)
    print('Sustav:', os.uname())
    while True:
        print(MESSAGE)
        sleep_ms(REPORT_MS)
    return _DioPrograma({})

_m_main = _pripremi_main()
