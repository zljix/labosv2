# V1.5 - Svjetlost, prag LED-a i temperatura
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
    from machine import Pin, ADC
    from time import sleep_ms
    LED_THRESHOLD = 2000
    SAMPLE_MS = 200

    def led_treba_svijetliti(raw):
        return raw < LED_THRESHOLD
    if not 0 <= LED_THRESHOLD <= 4095 or not 100 <= SAMPLE_MS <= 60000:
        raise ValueError('Nevaljana postavka')
    adc = ADC(Pin(1), atten=ADC.ATTN_11DB)
    led = Pin(21, Pin.OUT, value=0)
    try:
        while True:
            raw = (adc.read_u16() * 4095 + 32767) // 65535  # zajednicka skala 0..4095
            cilj_led = led_treba_svijetliti(raw)
            led.value(cilj_led)
            print('raw:', raw, 'LED:', int(cilj_led))
            sleep_ms(SAMPLE_MS)
    finally:
        led.off()
    return _DioPrograma({})

_m_main = _pripremi_main()
