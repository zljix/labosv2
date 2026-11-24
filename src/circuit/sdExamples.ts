import {emptyCircuit,makePart,terminals,type Circuit} from './model';
import {rtcCircuit} from './rtcExamples';
import {S3,type BoardId} from '../boards/profiles';
export type SDExample='sdInspect'|'sdBlocks'|'sdFiles'|'sdLogger';
export function sdCircuit(key:SDExample='sdFiles',board:BoardId=S3):Circuit{
 const c=key==='sdLogger'?rtcCircuit('rtcRead',board):emptyCircuit(board),b=c.components[0],avr=board!==S3;
 b.x=40;b.y=60;const sd=makePart('microSD',avr?650:420,150,'sd1');sd.properties.moduleVoltage=sd.properties.logicVoltage=avr?5:3.3;
 if(key==='sdLogger'){const rtc=c.components.find(p=>p.kind==='ds1302')!;rtc.x=sd.x;rtc.y=450;}
 c.components.push(sd);const pin=(n:number)=>terminals(b).find(t=>t.gpio===n)!.pin,rail=(r:string)=>terminals(b).find(t=>t.role===r)!.pin;
 for(const [from,to,color]of [[rail(avr?'5v':'3v3'),'VCC','#d04b46'],[rail('ground'),'GND','#334155'],[pin(avr?13:12),'SCK','#3867d6'],[pin(11),'MOSI','#087f8c'],[pin(avr?12:13),'MISO','#d59218'],[pin(10),'CS','#8b52ba']])c.wires.push({id:'sdw'+c.wires.length,from:{component:b.id,pin:from},to:{component:sd.id,pin:to},color,points:[]});
 return c;
}
const intro='microSD koristi SPI: S3 SCK12/MOSI11/MISO13/CS10 i 3V3; Uno/Nano SCK13/MOSI11/MISO12/CS10 i izričiti 5 V carrier s obostranom prilagodbom. GND je zajednički. Kartica je ograničeni SDSC v2 profil od 8 MiB: adresa naredbe je broj sektora × 512, a nije SDHC adresa. Inicijalizacija do 400 kHz, zatim do 10 MHz. ';
const policy=' Kartica se čuva preko Reseta MCU-a u aktivnoj sesiji. Za prijenos i ponovno otvaranje zaustavi program, klikni Sačuvaj karticu u projekt pa izvezi projekt. Slika diska (.img) i datoteke dostupne su nakon Stop. Najviše 256 izmijenjenih sektora; granica daje odbijen zapis. Vađenje tijekom zapisa nije sigurno odspajanje FAT-a. ';
const pythonSdCardSetup = `from machine import Pin, SPI
from lab_sdcard import SDCard

spi = SPI(
    1,
    baudrate=100000,
    polarity=0,
    phase=0,
    sck=Pin(12),
    mosi=Pin(11),
    miso=Pin(13),
)
sd = SDCard(spi, Pin(10))
`;

const pythonFatSetup = `${pythonSdCardSetup}# Vidljivi ograničeni FAT16 VFS; nije ugrađeni VfsFat.
from lab_fat16 import FAT16
import os

os.mount(FAT16(sd), '/sd')
`;

export const sdExamples={
 sdInspect:{title:'microSD · inicijalizacija i boot sektor',hint:intro+'Naredbe CMD0/CMD8/CMD55/ACMD41/CMD58/CMD9 pripremaju karticu. CMD17 čita 512 B. Sektor je adresirani blok; FAT16 boot sektor opisuje raspored diska. Program provjerava potpis 55 AA i montira postojeću sliku bez automatskog formatiranja.'+policy,code:`# Pregledaj početni sektor virtualne SD kartice i provjeri prepoznaje li
# program njezin datotečni sustav.

${pythonSdCardSetup}boot = bytearray(512)

# Sektor je blok od 512 bajtova. Zadnja dva bajta prvog sektora sadržavaju
# potpis koji možeš usporediti s ispisom.
sd.readblocks(0, boot)
print(
    'SD SECTORS=%d SIGNATURE=%02X%02X'
    % (sd.ioctl(4, 0), boot[510], boot[511])
)
# Vidljivi ograničeni FAT16 VFS; nije ugrađeni VfsFat.
from lab_fat16 import FAT16
import os

os.mount(FAT16(sd), '/sd')
print('SD FILES', os.listdir('/sd'))
os.umount('/sd')
`},
 sdBlocks:{title:'microSD · zapis i provjera jednog bloka',hint:intro+'CMD24 prima token FE, 512 B i CRC; odgovor potvrđuje prihvaćanje, zatim kartica javlja busy. Primjer namjerno zapisuje zadnji sektor (16383) i provjerava svih 512 bajtova kroz CMD17. To je sirovi pokus na praznoj kartici, bez datoteke; nemoj ga izvoditi nad važnom FAT slikom.'+policy,code:`# Upiši poznati niz u pokusni sektor virtualne kartice. Nakon čitanja
# provjeri jesu li svi bajtovi jednaki.

${pythonSdCardSetup}
# Uzorak ovisi o položaju bajta. Tako usporedba nakon čitanja otkriva i
# pogrešan redoslijed podataka.
uzorak = bytearray((i * 7 + 19) & 255 for i in range(512))
sd.writeblocks(16383, uzorak)
procitano = bytearray(512)
sd.readblocks(16383, procitano)
print('SD BLOCK MATCH=%d BYTES=%d' % (procitano == uzorak, len(procitano)))
`},
 sdFiles:{title:'microSD · FAT16 datoteka i dopisivanje',hint:intro+'FAT je tablica povezanih klastera, a unos korijena sadrži ime, prvi klaster i duljinu. Vidljivi lab_fat16 driver montira ograničeni VFS u /sd; standardni open() piše kroz SPI sektore. Kratka imena 8.3, korijen do 64 datoteke, datoteka do 64 KiB. Primjer dopisuje redak pri svakom Resetu; close/with ispisuje podatke i metapodatke na karticu. Nema mapa, LFN-a, brisanja, FAT32 ili exFAT-a.'+policy,code:`# Dodaj redak na kraj datoteke LAB.TXT i ponovno je pročitaj. Ponovi pokus
# pa usporedi veličinu datoteke.

${pythonFatSetup}
# Dodavanje počinje iza prethodnog sadržaja. Za razliku od pristupa sirovom
# sektoru, ovdje podatke pronalazimo imenom datoteke.
with open('/sd/LAB.TXT', 'a') as f:
    f.write('Pozdrav iz FAT16 preko SPI!\\n')
with open('/sd/LAB.TXT', 'r') as f:
    tekst = f.read()
print('SD FILE BYTES=%d' % os.stat('/sd/LAB.TXT')[6])
print(tekst)
print('SD FILES', os.listdir('/sd'))
os.umount('/sd')
`},
 sdLogger:{title:'DS1302 → microSD · CSV zapisivač',hint:intro+'DS1302 koristi zasebne CE/I/O/SCLK: GPIO6/7/8 i 3V3 na S3, D4/5/6 i 5V na AVR-u. RTC čita kalendar, a SD pohranjuje CSV tekst s brojem uzorka i vremenskom oznakom. CSV je tekstualni format s poljima odvojenim zarezom; datoteka nije dio izvornog koda. Zapis se zatvara svake sekunde. Izvadi karticu ili uključi zaštitu i promatraj pogrešku; nakon vraćanja ponovno pokreni program radi inicijalizacije/montiranja. Timestamp je sadržaj CSV-a; FAT metapodaci imaju izričit početni datum profila.'+policy,code:`# Poveži očitanje sata s retkom u datoteci LOG.CSV. Usporedi redne brojeve i
# vrijeme susjednih zapisa.

${pythonFatSetup}from lab_ds1302 import DS1302
from time import sleep_ms

sat = DS1302(Pin(6), Pin(7), Pin(8))
try:
    os.stat('/sd/LOG.CSV')
except OSError:
    with open('/sd/LOG.CSV', 'w') as f:
        f.write('uzorak,vrijeme\\n')
uzorak = 0

while True:
    try:
        # Zapiši vrijeme koje je vratio sat DS1302. Redni broj uzorka pomaže
        # provjeriti kojim su redom zapisi nastali.
        y, mo, d, dan, h, m, s = sat.datetime()
        redak = '%d,%04d-%02d-%02d %02d:%02d:%02d\\n' % (
            uzorak,
            y,
            mo,
            d,
            h,
            m,
            s,
        )

        # Zarez odvaja redni broj od vremena, a novi red odvaja dva uzorka.
        # Sljedeći zapis dodaje se na kraj datoteke.
        with open('/sd/LOG.CSV', 'a') as f:
            f.write(redak)
        print('SD CSV', redak.strip())
        uzorak += 1
    except (OSError, ValueError) as e:
        print('LOGGER ERROR', e)
        break  # Za oporavak vrati karticu/napajanje i ponovno pokreni.
    sleep_ms(1000)
`},
} as const;
const arduinoSdSetup = `#include "lab_sd.h"
LabSD sd(10);
bool spremno = false;

void setup() {
  Serial.begin(9600);
`;

export const arduinoSDExamples={
 sdInspect:{title:'Arduino · '+sdExamples.sdInspect.title,hint:sdExamples.sdInspect.hint,code:`// Pregledaj početni sektor virtualne SD kartice i provjeri prepoznaje li
// program njezin datotečni sustav.

${arduinoSdSetup}#if defined(ARDUINO_ARCH_ESP32)
  SPI.begin(12, 13, 11, 10);
#else
  SPI.begin();
#endif
  if (!sd.begin()) {
    Serial.println(sd.error());
    return;
  }

  // Sektor je blok od 512 bajtova. Zadnja dva bajta prvog sektora
  // sadržavaju potpis koji možeš usporediti s ispisom.
  if (!sd.readBlock(0)) {
    Serial.println(sd.error());
    return;
  }
  Serial.print(F("SD SECTORS=16384 SIGNATURE="));
  Serial.print(sd.buffer()[510], HEX);
  Serial.println(sd.buffer()[511], HEX);
  Serial.print(F("SD FAT16 MOUNT="));
  Serial.println(sd.mount());
}

void loop() {
  delay(1000);
}
`},
 sdBlocks:{title:'Arduino · '+sdExamples.sdBlocks.title,hint:sdExamples.sdBlocks.hint,code:`// Upiši poznati niz u pokusni sektor virtualne kartice. Nakon čitanja
// provjeri jesu li svi bajtovi jednaki.

${arduinoSdSetup}#if defined(ARDUINO_ARCH_ESP32)
  SPI.begin(12, 13, 11, 10);
#else
  SPI.begin();
#endif
  if (!sd.begin()) {
    Serial.println(sd.error());
    return;
  }

  // Uzorak ovisi o položaju bajta. Tako usporedba nakon čitanja otkriva i
  // pogrešan redoslijed podataka.
  for (int i = 0; i < 512; i++) {
    sd.buffer()[i] = (i * 7 + 19) & 255;
  }
  if (!sd.writeBlock(16383) || !sd.readBlock(16383)) {
    Serial.println(sd.error());
    return;
  }
  bool match = true;
  for (int i = 0; i < 512; i++) {
    if (sd.buffer()[i] != ((i * 7 + 19) & 255)) {
      match = false;
    }
  }
  Serial.print(F("SD BLOCK MATCH="));
  Serial.print(match);
  Serial.println(F(" BYTES=512"));
}

void loop() {
  delay(1000);
}
`},
 sdFiles:{title:'Arduino · '+sdExamples.sdFiles.title,hint:sdExamples.sdFiles.hint+' C++ koristi vidljive LabSD mount/append/printFile metode i jedan međuspremnik 512 B; ne proglašava se podrška proizvoljnoj SD.h biblioteci.',code:`// Dodaj redak na kraj datoteke LAB.TXT i ponovno je pročitaj. Ponovi pokus
// pa usporedi veličinu datoteke.

${arduinoSdSetup}#if defined(ARDUINO_ARCH_ESP32)
  SPI.begin(12, 13, 11, 10);
#else
  SPI.begin();
#endif
  if (!sd.begin()) {
    Serial.println(sd.error());
    return;
  }

  // Dodavanje počinje iza prethodnog sadržaja. Za razliku od pristupa
  // sirovom sektoru, ovdje podatke pronalazimo imenom datoteke.
  if (!sd.mount() ||
      !sd.append("LAB.TXT", "Pozdrav iz FAT16 preko SPI!\\n")) {
    Serial.println(sd.error());
    return;
  }
  Serial.print(F("SD FILE BYTES="));
  Serial.println(sd.fileSize("LAB.TXT"));
  sd.printFile("LAB.TXT", Serial);
}

void loop() {
  delay(1000);
}
`},
 sdLogger:{title:'Arduino · '+sdExamples.sdLogger.title,hint:sdExamples.sdLogger.hint+' C++ LabSD koristi jedan sektorski međuspremnik; SD.h i ESP32 SD_MMC nisu deklarirani.',code:`// Poveži očitanje sata s retkom u datoteci LOG.CSV. Usporedi redne brojeve
// i vrijeme susjednih zapisa.

#include "lab_ds1302.h"
LabDS1302 sat(4, 5, 6);
unsigned uzorak = 0;

void csvNumber(char *&p, uint32_t v, uint8_t digits = 1) {
  char tmp[10];
  uint8_t n = 0;
  do {
    tmp[n++] = char(48 + v % 10);
    v /= 10;
  } while (v);
  while (n < digits) {
    tmp[n++] = '0';
  }
  while (n) {
    *p++ = tmp[--n];
  }
}

#include "lab_sd.h"
LabSD sd(10);
bool spremno = false;

void setup() {
  Serial.begin(9600);
#if defined(ARDUINO_ARCH_ESP32)
  SPI.begin(12, 13, 11, 10);
#else
  SPI.begin();
#endif
  if (!sd.begin()) {
    Serial.println(sd.error());
    return;
  }
  sat.begin();
  if (!sd.mount()) {
    Serial.println(F("FAT MOUNT ERROR"));
    return;
  }
  if (!sd.fileSize("LOG.CSV") &&
      !sd.append("LOG.CSV", "uzorak,vrijeme\\n")) {
    Serial.println(sd.error());
    return;
  }
  spremno = true;
}

void loop() {
  if (!spremno) {
    delay(1000);
    return;
  }
  LabDS1302::DateTime d;

  // Zapiši vrijeme koje je vratio sat DS1302. Redni broj uzorka pomaže
  // provjeriti kojim su redom zapisi nastali.
  if (!sat.datetime(d)) {
    Serial.println(F("RTC ERROR"));
    delay(1000);
    return;
  }
  char row[64];
  char *p = row;
  csvNumber(p, uzorak);
  *p++ = ',';
  csvNumber(p, d.year, 4);
  *p++ = '-';
  csvNumber(p, d.month, 2);
  *p++ = '-';
  csvNumber(p, d.date, 2);
  *p++ = ' ';
  csvNumber(p, d.hour, 2);
  *p++ = ':';
  csvNumber(p, d.minute, 2);
  *p++ = ':';
  csvNumber(p, d.second, 2);
  *p++ = 10;
  *p = 0;

  // Zarez odvaja redni broj od vremena, a novi red odvaja dva uzorka.
  // Sljedeći zapis dodaje se na kraj datoteke.
  if (!sd.append("LOG.CSV", row)) {
    Serial.print(F("LOGGER ERROR "));
    Serial.println(sd.error());
    spremno = false;
    return;
  }
  Serial.print(F("SD CSV "));
  Serial.print(row);
  uzorak++;
  delay(1000);
}
`},
} as const;
export const s3SDExamples=Object.fromEntries(Object.entries(arduinoSDExamples).map(([k,e])=>[k,{...e,title:e.title.replace('Arduino ·','S3 C++ ·'),code:e.code.replace('sat(4, 5, 6)','sat(6, 7, 8)').replace('#if defined(ARDUINO_ARCH_ESP32)\n  SPI.begin(12, 13, 11, 10);\n#else\n  SPI.begin();\n#endif','  SPI.begin(12, 13, 11, 10);')}])) as Record<SDExample,{title:string;hint:string;code:string}>;
