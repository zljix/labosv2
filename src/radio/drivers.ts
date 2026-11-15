// Own MIT teaching drivers, version 1.0.0. Static 8-byte example packets.
export const pythonNRF24=`# LabNRF24 1.0.0 — MIT. Static payload, polling STATUS.
from time import sleep_ms, sleep_us, ticks_ms, ticks_diff

class LabNRF24:
    def __init__(self, spi, cs, ce, channel=76, address=b"URS01", ack=True):
        if len(address) != 5 or not 0 <= channel <= 125:
            raise ValueError("channel/address")
        self.spi, self.cs, self.ce = spi, cs, ce
        self.cs(1)
        self.ce(0)
        self.reg(0, 0x0c)  # CRC16, power-down while configuring
        self.reg(1, 1 if ack else 0)
        self.reg(2, 1)     # enable RX pipe 0
        self.reg(3, 3)     # five address bytes
        self.reg(4, 0x13)  # 500 us interval, at most three retries
        self.reg(5, channel)
        self.reg(6, 6)     # 1 Mbps; power setting is only a register
        self.reg(0x11, 8)  # static RX width = 8 bytes
        self.command(0x2a, address)
        self.command(0x30, address)  # TX_ADDR = RX_ADDR_P0 for ACK
        self.command(0xe1)
        self.command(0xe2)
        self.reg(7, 0x70)  # write 1 to clear the three status flags
        self.reg(0, 0x0e)  # PWR_UP, TX, CRC16
        sleep_ms(5)
        if self.read_reg(5) != channel:
            raise OSError("NRF24 SPI: provjeri napajanje i spojeve")

    def command(self, command, data=b"", read=0):
        tx = bytearray(1 + max(len(data), read))
        tx[0] = command
        tx[1:1+len(data)] = data
        rx = bytearray(len(tx))
        self.cs(0)
        try:
            self.spi.write_readinto(tx, rx)
        finally:
            self.cs(1)
        return rx

    def reg(self, register, value):
        self.command(0x20 | register, bytes([value]))

    def read_reg(self, register):
        return self.command(register, read=1)[1]

    def listen(self):
        self.ce(0)
        self.reg(0, 0x0f)
        self.ce(1)
        sleep_ms(1)  # at least 130 us RX settling

    def available(self):
        return not (self.read_reg(0x17) & 1)

    def receive(self):
        if not self.available():
            return None
        data = bytes(self.command(0x61, read=8)[1:])
        self.reg(7, 0x40)
        return data

    def send(self, data):
        if len(data) != 8:
            raise ValueError("Ovaj driver koristi tocno 8 bajtova")
        self.ce(0)
        self.reg(0, 0x0e)
        self.reg(7, 0x30)
        self.command(0xe1)
        self.command(0xa0, data)
        self.ce(1)
        sleep_us(15)  # CE must be high for at least 10 us
        self.ce(0)
        start = ticks_ms()
        while ticks_diff(ticks_ms(), start) < 100:
            status = self.read_reg(7)
            if status & 0x30:
                self.reg(7, status & 0x30)
                if status & 0x10:
                    self.command(0xe1)
                    return False
                return True
            sleep_ms(1)
        raise OSError("NRF24 status timeout")
`;
export const cppNRF24=`// LabNRF24 1.0.0 — MIT. Static 8-byte payload, polling STATUS.
#ifndef LAB_NRF24_H
#define LAB_NRF24_H
#include <Arduino.h>
#include <SPI.h>
class LabNRF24 {
    uint8_t cs, ce;
    uint8_t command(uint8_t op, const uint8_t* tx, uint8_t* rx, uint8_t n) {
        SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
        digitalWrite(cs, LOW);
        uint8_t status = SPI.transfer(op);
        for (uint8_t i = 0; i < n; ++i) {
            uint8_t value = SPI.transfer(tx ? tx[i] : 0);
            if (rx) rx[i] = value;
        }
        digitalWrite(cs, HIGH);
        SPI.endTransaction();
        return status;
    }
public:
    LabNRF24(uint8_t csPin, uint8_t cePin) : cs(csPin), ce(cePin) {}
    void reg(uint8_t r, uint8_t value) { command(0x20 | r, &value, 0, 1); }
    uint8_t readReg(uint8_t r) {
        uint8_t value = 0; command(r, 0, &value, 1); return value;
    }
    bool begin(uint8_t channel, const uint8_t* address, bool ack = true) {
        pinMode(cs, OUTPUT); digitalWrite(cs, HIGH);
        pinMode(ce, OUTPUT); digitalWrite(ce, LOW);
        reg(0, 0x0c); reg(1, ack ? 1 : 0); reg(2, 1); reg(3, 3);
        reg(4, 0x13); // ARD=500 us, ARC=3
        reg(5, channel); reg(6, 6); reg(0x11, 8);
        command(0x2a, address, 0, 5); // RX pipe 0
        command(0x30, address, 0, 5); // TX = RX pipe 0 for ACK
        command(0xe1, 0, 0, 0); command(0xe2, 0, 0, 0);
        reg(7, 0x70); reg(0, 0x0e); delay(5);
        return readReg(5) == channel;
    }
    void listen() {
        digitalWrite(ce, LOW); reg(0, 0x0f);
        digitalWrite(ce, HIGH); delay(1);
    }
    bool available() { return !(readReg(0x17) & 1); }
    bool receive(uint8_t* data) {
        if (!available()) return false;
        command(0x61, 0, data, 8); reg(7, 0x40); return true;
    }
    bool send(const uint8_t* data) {
        digitalWrite(ce, LOW); reg(0, 0x0e); reg(7, 0x30);
        command(0xe1, 0, 0, 0); command(0xa0, data, 0, 8);
        digitalWrite(ce, HIGH); delayMicroseconds(15); digitalWrite(ce, LOW);
        uint32_t start = millis();
        while ((uint32_t)(millis() - start) < 100) {
            uint8_t status = readReg(7);
            if (status & 0x30) {
                reg(7, status & 0x30);
                if (status & 0x10) { command(0xe1, 0, 0, 0); return false; }
                return true;
            }
            delay(1);
        }
        return false;
    }
};
#endif
`;
