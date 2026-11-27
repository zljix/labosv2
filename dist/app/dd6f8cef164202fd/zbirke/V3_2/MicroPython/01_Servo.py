# V3.2 - Odaberi dijelove i usporedi cilj serva
# 1. Procitaj kratko ponavljanje i postupak u Wordu iz iste mape.
# 2. Uredi samo postavku ili funkciju navedenu u trenutnom koraku.
# 3. U Thonnyju spremi ovaj program na uredjaj kao main.py; pritisni RESET.
# 4. Trazene retke i slike kopiraj u mjesta DOKAZ u istom Wordu.
# Spojeve mijenjaj bez napajanja. Servo ukljuci samo nakon pregleda nastavnika.
# Slijed: cekaj 3 s; START 2 s; TARGET 2 s; povratak START 2 s; STOP.


from machine import Pin, PWM
from time import sleep_ms, ticks_ms

# UCENIK: samo vrijednosti s odobrene kartice stvarnog serva.
SERVO_ENABLED = False
SERVO_MIN_US = 0
SERVO_MAX_US = 0
SERVO_START_US = 0
SERVO_TARGET_US = 0
START_DELAY_MS = 3000
POSITION_HOLD_MS = 2000

# PRIPREMLJENI DIO: START -> TARGET -> START -> STOP, samo jedan ciklus.
def provjeri():
    if type(SERVO_ENABLED) is not bool:
        raise ValueError('SERVO_ENABLED mora biti True ili False')
    if not SERVO_ENABLED:
        return
    values = (SERVO_MIN_US, SERVO_MAX_US, SERVO_START_US, SERVO_TARGET_US)
    if not all(type(x) is int for x in values):
        raise ValueError('Upisi cetiri odobrene cijele vrijednosti u us')
    # 500..2500 su granice programa, a ne odobrenje bilo kojeg serva.
    if not 500 <= SERVO_MIN_US < SERVO_MAX_US <= 2500:
        raise ValueError('Nedostaje odobren raspon serva')
    if not all(SERVO_MIN_US <= x <= SERVO_MAX_US for x in values[2:]):
        raise ValueError('START ili TARGET izvan odobrenog raspona')

def status(step, us):
    print('SERVO etapa=%s t_ms=%d requested_us=%d' % (step, ticks_ms(), us))

signal = Pin(14, Pin.OUT, value=0)
pwm = None
try:
    provjeri()
    print('Zadani impuls nije izmjereni kut. Ispis je samo izlaz.')
    if SERVO_ENABLED:
        print('SERVO CEKANJE 3000 ms; zatim START TARGET START STOP. Odmakni ruke.')
        sleep_ms(START_DELAY_MS)
        pwm = PWM(signal, freq=50, duty_ns=SERVO_START_US * 1000)
        status('START', SERVO_START_US)
        sleep_ms(POSITION_HOLD_MS)
        pwm.duty_ns(SERVO_TARGET_US * 1000)
        status('TARGET', SERVO_TARGET_US)
        sleep_ms(POSITION_HOLD_MS)
        pwm.duty_ns(SERVO_START_US * 1000)
        status('RETURN', SERVO_START_US)
        sleep_ms(POSITION_HOLD_MS)
    else:
        print('SERVO ONEMOGUCEN: provjeri ENABLED i cetiri odobrene vrijednosti.')
finally:
    if pwm is not None:
        pwm.deinit()
    Pin(14, Pin.OUT, value=0)
    status('STOP', 0)
    print('Ciklus zavrsen. Napajanje serva nije iskljuceno.')
