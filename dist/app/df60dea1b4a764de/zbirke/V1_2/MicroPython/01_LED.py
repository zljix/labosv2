# V1.2 - Spoji LED i izmjeri napon
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
    from machine import Pin, PWM
    from time import sleep_ms
    LED_MODE = 'BLINK'
    BLINK_PERIOD_MS = 1000
    PWM_DUTY = 128
    if LED_MODE not in ('ON', 'OFF', 'BLINK', 'PWM'):
        raise ValueError('Nepoznat LED_MODE')
    if not 100 <= BLINK_PERIOD_MS <= 60000 or not 0 <= PWM_DUTY <= 255:
        raise ValueError('Postavka je izvan dopustenog podrucja')
    print('P01_LED; LED_MODE:', LED_MODE)
    print('BLINK_PERIOD_MS:', BLINK_PERIOD_MS, 'PWM_DUTY:', PWM_DUTY)
    led = Pin(21, Pin.OUT, value=0)
    pwm = None
    try:
        if LED_MODE == 'PWM':
            pwm = PWM(led, freq=1000, duty_u16=PWM_DUTY * 257)
        while True:
            if LED_MODE == 'BLINK':
                led.on()
                sleep_ms(BLINK_PERIOD_MS // 2)
                led.off()
                sleep_ms(BLINK_PERIOD_MS - BLINK_PERIOD_MS // 2)
            else:
                if LED_MODE in ('ON', 'OFF'):
                    led.value(LED_MODE == 'ON')
                sleep_ms(100)
    finally:
        if pwm is not None:
            pwm.deinit()
        Pin(21, Pin.OUT, value=0)
    return _DioPrograma({})

_m_main = _pripremi_main()
