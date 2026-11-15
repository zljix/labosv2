"""MIT. Standard NEC 8-bit address/command driver over measured GPIO pulses.

The receiver returns (address, command, repeat). Extended NEC/NEC2 are not
accepted. disable_irq in this simulator locks virtual microseconds; it does
not install an ESP32 interrupt handler. read() waits for a leader within a bounded 12 ms window; yield between calls.
"""
from machine import Pin, PWM, disable_irq, enable_irq, time_pulse_us
from time import ticks_us, ticks_diff, sleep_us


class NECReceiver:
    def __init__(self, pin):
        self.pin = pin
        self.pin.init(Pin.IN)
        self.last = None
        self.last_at = 0
        self.errors = 0
        self.pulses = []

    def _pulse(self, level, timeout):
        width = time_pulse_us(self.pin, level, timeout)
        self.pulses.append(width)
        return width

    def read(self):
        # A bounded pulse wait also catches a leader that starts between polls.
        # The simulator advances virtual time here; sleep_ms in the caller
        # yields to the Worker so new user input and Stop remain responsive.
        token = disable_irq()
        try:
            self.pulses = []
            leader = self._pulse(0, 12000)
            if leader == -2:
                return None
            if not 6500 <= leader <= 11000:
                raise ValueError("NEC: nevaljan uvodni impuls")
            gap = self._pulse(1, 6000)
            if 1600 <= gap <= 2900:
                if not 350 <= self._pulse(0, 1000) <= 850:
                    raise ValueError("NEC: nevaljan repeat impuls")
                now = ticks_us()
                if self.last is not None and ticks_diff(now, self.last_at) <= 150000:
                    self.last_at = now
                    return self.last[0], self.last[1], True
                return None  # a repeat has no address or command of its own
            if not 3500 <= gap <= 5500:
                raise ValueError("NEC: nevaljan razmak zaglavlja")
            raw = 0
            for bit in range(32):
                if not 350 <= self._pulse(0, 1000) <= 850:
                    raise ValueError("NEC: nevaljan bitni impuls")
                space = self._pulse(1, 2400)
                if 1200 <= space <= 2100:
                    raw |= 1 << bit
                elif not 350 <= space <= 850:
                    raise ValueError("NEC: nevaljan bitni razmak")
            if not 350 <= self._pulse(0, 1000) <= 850:
                raise ValueError("NEC: nedostaje zavrsni impuls")
            a, ia, cmd, icmd = ((raw >> (8 * n)) & 255 for n in range(4))
            if a ^ ia != 255 or cmd ^ icmd != 255:
                raise ValueError("NEC: nevaljan inverzni bajt")
            self.last = (a, cmd)
            self.last_at = ticks_us()
            return a, cmd, False
        except ValueError:
            self.errors += 1
            self.last = None
            raise
        finally:
            enable_irq(token)


class NECTransmitter:
    def __init__(self, pin):
        self.carrier = PWM(pin, freq=38000, duty_u16=0)

    def _mark(self, us):
        self.carrier.duty_u16(21845)  # one third duty; 38 kHz inside a burst
        sleep_us(us)
        self.carrier.duty_u16(0)

    def send(self, address, command, repeats=0):
        if not 0 <= address <= 255 or not 0 <= command <= 255:
            raise ValueError("Standardni NEC koristi 8-bitnu adresu i naredbu")
        if not isinstance(repeats, int) or not 0 <= repeats <= 18:
            raise ValueError("Broj ponavljanja mora biti 0-18")
        token = disable_irq()
        try:
            start = ticks_us()
            self._mark(9000)
            sleep_us(4500)
            for byte in (address, address ^ 255, command, command ^ 255):
                for bit in range(8):
                    self._mark(562)
                    sleep_us(1688 if byte & (1 << bit) else 562)
            self._mark(562)
            for n in range(repeats):
                remaining = (n + 1) * 110000 - ticks_diff(ticks_us(), start)
                if remaining > 0:
                    sleep_us(remaining)
                self._mark(9000)
                sleep_us(2250)
                self._mark(562)
        finally:
            self.carrier.duty_u16(0)
            enable_irq(token)
