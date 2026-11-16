"""MIT. Polling Gray decoder: four valid transitions per full detent at AB=11.

CLK=A (high bit), DT=B (low bit). CW: 11,01,00,10,11.
No IRQ dependency. Call update() often; missed edges cannot be reconstructed.
Initial physical position is unknown to an incremental encoder.
"""
from time import ticks_ms, ticks_diff


class Encoder:
    _delta = (0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0)

    def __init__(self, clk, dt, sw):
        self.clk, self.dt, self.sw = clk, dt, sw
        self.previous = (clk.value() << 1) | dt.value()
        self.partial = 0
        self.position = 0
        self.errors = 0
        self.ready = self.previous == 3
        self.raw_button = self.sw.value()
        self.button = self.raw_button
        self.changed_at = ticks_ms()

    def update(self):
        now = (self.clk.value() << 1) | self.dt.value()
        step = 0
        if now != self.previous:
            if (now ^ self.previous) == 3:
                self.partial = 0
                self.errors += 1
                self.ready = False
            elif self.ready:
                self.partial += self._delta[(self.previous << 2) | now]
            if now == 3:
                if self.ready and abs(self.partial) == 4:
                    step = 1 if self.partial > 0 else -1
                    self.position += step
                self.partial = 0
                self.ready = True
            self.previous = now
        # SW is independent of A/B. Accept a changed level after 20 ms.
        raw = self.sw.value()
        if raw != self.raw_button:
            self.raw_button = raw
            self.changed_at = ticks_ms()
        pressed = False
        if raw != self.button and ticks_diff(ticks_ms(), self.changed_at) >= 20:
            self.button = raw
            pressed = raw == 0
        return step, pressed

    def reset(self):
        self.position = 0
        self.partial = 0
        self.previous = (self.clk.value() << 1) | self.dt.value()
        self.ready = self.previous == 3
