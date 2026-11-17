"""MIT. Lab GPIO transport for upstream onewire.py; no sensor-value API.

Standard-speed slots on the functional virtual microsecond clock. The normal
machine.Pin OPEN_DRAIN adapter drives LOW or releases the actual circuit net.
"""
from machine import disable_irq, enable_irq
from time import sleep_us


def reset(pin):
    pin(1)
    sleep_us(10)
    state = disable_irq()
    try:
        pin(0)
        sleep_us(480)
        pin(1)
        sleep_us(70)
        presence = pin() == 0
        sleep_us(410)
        return presence
    finally:
        enable_irq(state)


def readbit(pin):
    state = disable_irq()
    try:
        pin(0)
        sleep_us(3)
        pin(1)
        sleep_us(10)
        value = pin()
        sleep_us(53)
        return value
    finally:
        enable_irq(state)


def writebit(pin, value):
    state = disable_irq()
    try:
        pin(0)
        sleep_us(10 if value else 65)
        pin(1)
        sleep_us(55 if value else 5)
    finally:
        enable_irq(state)


def readbyte(pin):
    value = 0
    for i in range(8):
        value |= readbit(pin) << i
    return value


def writebyte(pin, value):
    for i in range(8):
        writebit(pin, (value >> i) & 1)


def crc8(data):
    crc = 0
    for value in data:
        for i in range(8):
            mix = (crc ^ value) & 1
            crc >>= 1
            if mix:
                crc ^= 0x8C
            value >>= 1
    return crc
