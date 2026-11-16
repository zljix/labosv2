// MIT. Transaction-level teaching models; no bit timing or analog sensor noise.
export class PeripheralError extends Error {
  constructor(message, code = -5) { super(message); this.code = code; }
}
const unsupported = message => { throw new PeripheralError(message, -95); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class AHT10 {
  constructor(device, now = () => performance.now()) {
    this.device = device; this.now = now; this.reset(); this.sample = 0;
  }
  reset() {
    this.calibrated = false; this.until = this.now() + 20;
    this.pending = undefined; this.result = new Uint8Array(6);
    this.measuredTemperature = null; this.measuredHumidity = null;
  }
  update(now = this.now()) {
    if (this.pending && now >= this.until) {
      const {temperature, humidity} = this.pending;
      const h = clamp(Math.round(humidity * 1048576 / 100), 0, 1048575);
      const t = clamp(Math.round((temperature + 50) * 1048576 / 200), 0, 1048575);
      this.result = Uint8Array.of(8, h >> 12, (h >> 4) & 255, ((h & 15) << 4) | (t >> 16), (t >> 8) & 255, t & 255);
      this.measuredHumidity = h * 100 / 1048576;
      this.measuredTemperature = t * 200 / 1048576 - 50;
      this.pending = undefined; this.sample++;
    }
  }
  status(now = this.now()) { this.update(now); return (this.calibrated ? 8 : 0) | (now < this.until ? 128 : 0); }
  write(bytes) {
    if (!bytes.length) return;
    if (bytes.length === 1 && bytes[0] === 0xBA) { this.reset(); return; }
    if (bytes.length === 1 && bytes[0] === 0x71) return;
    const now = this.now(); this.update(now);
    if (now < this.until) throw new PeripheralError('AHT10 je zauzet; pričekaj dovršetak pretvorbe.');
    if (bytes.length === 3 && bytes[0] === 0xE1 && bytes[1] === 8 && bytes[2] === 0) {
      this.calibrated = true; this.until = now + 10; return;
    }
    if (bytes.length === 3 && bytes[0] === 0xAC && bytes[1] === 0x33 && bytes[2] === 0) {
      if (!this.calibrated) throw new PeripheralError('AHT10 nije inicijaliziran (E1 08 00).');
      this.pending = {temperature:this.device.temperature, humidity:this.device.humidity};
      this.until = now + 80; return;
    }
    unsupported('AHT10: podržani su E1 08 00, AC 33 00, BA i 71.');
  }
  read(length) {
    if (![0,1,6].includes(length)) unsupported('AHT10: čitanje statusa (1 bajt) ili mjerenja (6 bajtova); AHT10 nema CRC bajt.');
    const status = this.status();
    if (!length) return new Uint8Array();
    if (length === 1) return Uint8Array.of(status);
    const bytes = this.result.slice(); bytes[0] = status; return bytes;
  }
  snapshot(powered) {
    return {powered, temperature:this.device.temperature, humidity:this.device.humidity,
      busy:!!(this.status() & 128), calibrated:this.calibrated, sample:this.sample,
      measuredTemperature:this.measuredTemperature, measuredHumidity:this.measuredHumidity};
  }
}

export class SSD1306 {
  constructor(height = 64) {
    if (![32,64].includes(height)) throw new PeripheralError('SSD1306: podržana visina je 32 ili 64.');
    this.height = height; this.multiplex = height - 1; this.comPins = height === 32 ? 2 : 0x12;
    this.ram = new Uint8Array(1024); this.mode = 2; this.col = 0; this.page = 0;
    this.x0 = 0; this.x1 = 127; this.p0 = 0; this.p1 = 7;
    this.on = false; this.inverse = false; this.entire = false; this.contrast = 127;
    this.segmentRemap = false; this.comRemap = false; this.startLine = 0; this.offset = 0;
    this.pending = undefined;
  }
  command(byte) {
    if (this.pending) {
      this.pending.args.push(byte);
      if (this.pending.args.length < this.pending.count) return;
      const {cmd,args} = this.pending; this.pending = undefined;
      if (cmd === 0x20) { if (args[0] > 2) unsupported('SSD1306: nevaljan način adresiranja.'); this.mode=args[0]; }
      if (cmd === 0x21) { if (args[0]>args[1]||args[1]>127) unsupported('SSD1306: nevaljan raspon stupaca.'); [this.x0,this.x1]=args; this.col=this.x0; }
      if (cmd === 0x22) { if (args[0]>args[1]||args[1]>7) unsupported('SSD1306: nevaljan raspon stranica.'); [this.p0,this.p1]=args; this.page=this.p0; }
      if (cmd === 0x81) this.contrast=args[0];
      if (cmd === 0xA8) { if (args[0] !== this.height-1) unsupported(`SSD1306 128 × ${this.height}: multiplex treba biti ${this.height-1}.`); this.multiplex=args[0]; }
      if (cmd === 0xDA) { if (args[0] !== (this.height===32?2:0x12)) unsupported(`SSD1306 128 × ${this.height}: neodgovarajuća COM konfiguracija.`); this.comPins=args[0]; }
      if (cmd === 0xD3) { if (args[0]>63) unsupported('SSD1306: pomak je 0–63.'); this.offset=args[0]; }
      // Analog timing, charge pump, IREF and COM pin configuration are retained as
      // accepted driver setup bytes; their electrical effects are outside this model.
      return;
    }
    if ([0x20,0x21,0x22,0x81,0xA8,0xD3,0xD5,0xD9,0xDA,0xDB,0x8D,0xAD].includes(byte)) {
      this.pending = {cmd:byte,count:byte===0x21||byte===0x22?2:1,args:[]}; return;
    }
    if (byte<=0x0F) {this.col=(this.col&0xF0)|byte; return;}
    if (byte>=0x10&&byte<=0x1F) {this.col=((byte&7)<<4)|(this.col&15); return;}
    if (byte>=0x40&&byte<=0x7F) {this.startLine=byte&63;return;}
    if (byte>=0xB0&&byte<=0xB7) {this.page=byte&7;return;}
    if (byte===0xAE||byte===0xAF) {this.on=byte===0xAF;return;}
    if (byte===0xA0||byte===0xA1) {this.segmentRemap=byte===0xA1;return;}
    if (byte===0xC0||byte===0xC8) {this.comRemap=byte===0xC8;return;}
    if (byte===0xA4||byte===0xA5) {this.entire=byte===0xA5;return;}
    if (byte===0xA6||byte===0xA7) {this.inverse=byte===0xA7;return;}
    if (byte===0x2E||byte===0xE3) return;
    unsupported(`SSD1306: naredba 0x${byte.toString(16)} nije podržana (scroll/blink/zoom nisu modelirani).`);
  }
  data(byte) {
    this.ram[this.page*128+this.col]=byte;
    if (this.mode===1) {
      if (++this.page>this.p1) {this.page=this.p0;if(++this.col>this.x1)this.col=this.x0;}
    } else if (this.mode===0) {
      if (++this.col>this.x1) {this.col=this.x0;if(++this.page>this.p1)this.page=this.p0;}
    } else this.col=(this.col+1)&127;
  }
  write(bytes) {
    for (let i=0;i<bytes.length;) {
      const control=bytes[i++];
      if (control&63) unsupported('SSD1306: nevaljan kontrolni bajt I2C.');
      const continuation=!!(control&128),data=!!(control&64);
      if (i===bytes.length) throw new PeripheralError('SSD1306: kontrolni bajt nema podatak.');
      const end=continuation?i+1:bytes.length;
      for(;i<end;i++) data?this.data(bytes[i]):this.command(bytes[i]);
    }
  }
  read() { unsupported('SSD1306 I2C profil podržava samo upis; GDDRAM se ne može čitati preko ovog sučelja.'); }
  snapshot(powered) {
    const bytes=new Uint8Array(128*this.height/8);
    if (powered&&this.on) for(let y=0;y<this.height;y++) for(let x=0;x<128;x++) {
      const rx=this.segmentRemap?x:127-x, py=this.comRemap?y:this.height-1-y;
      const ry=(py+this.startLine-this.offset+64)&63;
      const on=this.entire||!!(this.ram[rx+(ry>>3)*128]&(1<<(ry&7)));
      if (on!==this.inverse) bytes[x+(y>>3)*128]|=1<<(y&7);
    }
    return {kind:"oled",width:128,height:this.height,powered,on:this.on,multiplex:this.multiplex,comPins:this.comPins,contrast:this.contrast,bytes:Array.from(bytes)};
  }
}
