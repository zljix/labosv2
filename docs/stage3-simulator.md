# Osnovni simulator v0.1 — ugovor podrške

Datum: 12. studenoga 2026. Nadogradnja postojećeg projekta i formata schemaVersion 2 / modelVersion 1. Arhivski pokusi jezgre imaju vlastiti fiksni spoj i ostaju odvojeni.

## Put od koda do sklopa

`compileCircuit` validira projekt, provjerava statičke pogreške i izračunava mreže istim `buildNets` modulom koji koristi editor. Fiksne veze, rupe breadboarda i krajevi vodiča čine osnovne mreže; kontakti tipkala zatvaraju se unutar Workera. Time se ne zamjenjuje sklop skrivenim primjerom s unaprijed zadanim GPIO-ima.

Worker prima strukturiranu kopiju topologije i svih projektnih datoteka. Stvarni MicroPython 1.29.0 poziva `machine.py`, zatim ograničeni C modul `_lab` i funkcionalni model mreže u istom Workeru. Nema prepisivanja učenikova Pythona u JavaScript. GPIO se izvodi iz profila priključka, nikada iz koordinata nacrta.

Run i Reset stvaraju novi Worker, heap, privremene datoteke i identitet sesije. Stop poništava aktivno pokretanje i odbacuje poruke stare sesije. Run/Reset odbacuju prethodne promjene ulaza i koriste početne vrijednosti iz projekta. Završeni konačni program ostavlja zadano stanje izlaza do novog pokretanja ili Stop. Prisilni Stop ne jamči izvođenje Python `finally` bloka.

Promjena vodiča, svojstava komponente, pomicanje, zakretanje ili vraćanje sklopa zaustavlja program. Mijenjanje koda tijekom rada dopušteno je, uz oznaku da vrijedi od sljedećeg pokretanja. Tipkalo i potenciometar tijekom rada mijenjaju samo ulaz pokretanja; ne prepisuju spremljene početne vrijednosti ni povijest projekta. U zaustavljenom stanju kontrole uređuju početne vrijednosti i normalno se spremaju.

## Podržani API

| API | Podrška v0.1 |
| --- | --- |
| `Pin(id, mode=-1, pull=None, *, value=None)` | Izloženi GPIO0–21 i GPIO38–48; GPIO35–37 nisu dostupni (PSRAM), GPIO22–34 nisu izloženi. `IN`, `OUT`, `PULL_UP`, `PULL_DOWN`, `init`, `value`, poziv objekta, `on`, `off`. Početni izlazni `value` primjenjuje se zajedno s uključivanjem izlaza. |
| `ADC(Pin(n), atten=...)` ili `ADC(n, atten=...)` | GPIO1–20, 12 bita. `read` 0–4095, `read_u16` skaliranje istog 12-bitnog uzorka na 0–65535, `read_uv`, `atten`, `init(atten=...)`, `width(12)`. |
| `PWM(Pin(n), freq=..., duty_u16=...)` | Do osam kanala na dostupnim GPIO-ima. `init`, `freq`, `duty_u16` 0–65535, ESP32 `duty` 0–1023, `duty_ns`, `deinit`. Frekvencija 1–40 000 000 Hz je konfiguracija modela, nije obećanje točnosti takta. Istodobno se zadaje samo jedan oblik radnog omjera. `invert` nije implementiran. |
| `time` | Naslijeđene izvorne funkcije `sleep`, `sleep_ms`, `sleep_us`, `ticks_ms`, `ticks_diff`. Čekanje kroz Asyncify prepušta kontrolu za obradu ulaza. Pozitivni mikrosekundni zastoji zaokružuju se na milisekunde. |
| `I2C`, `framebuf` | Dijagnostički echo i izvorni framebuf zadržani su u arhivskim pokusima. Uređivani sklop bez I2C uređaja vraća prazan scan i NACK na pristup. AHT10/SSD1306/servo pripadaju etapi 4. |

Ostali dijelovi `machine` (prekidi, timeri, mreža, SPI, UART, open-drain i sl.) nisu podržani. Nepostojeći API ne predstavlja se kao uspješno simulirana funkcija. Nisu emulirani resetni strapping proces, ugrađena RGB LED ni stvarni USB/UART čipovi.

## Električni i vremenski model

- Idealni izvori 0, 3,3 i 5 V te digitalni izlazi. Izlazi ne računaju pad napona ni dozvoljenu struju GPIO-a. Različiti aktivni izvori na istoj vodičkoj mreži uzrokuju pogrešku i dijagnostiku s pripadajućim priključcima. Dva promjenjiva PWM izlaza na istoj mreži prijavljuju se kao sukob jer njihova faza nije modelirana.
- Linearni otpornici i otporna staza potenciometra; klizač 0% je kraj 3, a 100% kraj 1. Krajevi se mogu zamijeniti i rezultat slijedi veze. Unutarnji pull je idealiziran na 45 kΩ.
- DC mreža računa se čvornom analizom. Otoci bez izvora ostaju nepobuđeni. Digitalni LOW ≤ 0,825 V, HIGH ≥ 2,475 V; međupodručje daje jasnu pogrešku pri digitalnom očitanju. To su konzervativne simulacijske granice 25%/75% domene 3,3 V.
- LED je pojednostavljeni diodni model: prag crvena 1,8 V, zelena 2,1 V, plava 2,8 V, žuta 2,0 V te dinamički otpor 10 Ω u vodljivom stanju. Srednja struja i relativna svjetlina ovise o polaritetu, otporu, potpunoj putanji i izlazu programa. Svjetlina 100% označuje 5 mA ili više; nije mjerenje lumena. Nema modela pregaranja, kapaciteta, topline ili tolerancije.
- ADC je linearan i idealan, s rasponima 0–0,95 / 1,25 / 1,75 / 3,1 V za četiri postavke prigušenja. Iznad odabranog raspona očitanje zasićuje; iznad 3,6 V prijavljuje se neprikladan napon. `read_uv` je idealizirano pretvaranje kvantiziranog uzorka, bez eFuse kalibracije i šuma. Potenciometar na 3,3 V doseže najveći rezultat prije krajnjeg položaja pri 11 dB.
- PWM svjetlina je srednja vrijednost stacionarnih uključenih/isključenih stanja ponderiranih radnim omjerom. Za više kanala koristi se idealizirana zajednička normalizirana faza pri računanju prikaza; fazni odnosi i dijeljenje hardverskih timera nisu implementirani. Digitalno/ADC uzorkovanje PWM vala koristi trenutak programskog poziva i nema jamstvo preciznosti ispod milisekunde. Simulator nije alat za provjeru komunikacijskih valnih oblika.
- Vrijeme prati izvođenje u pregledniku, bez ubrzavanja ili determinističkog virtualnog takta. Poruke prikaza ograničene su na približno 30/s. Konzola i trag sesije ostaju ograničeni.

Nema općeg analognog analizatora ili potvrde električne sigurnosti proizvoljnog sklopa. Za nastavu treba provjeriti konkretan sklop i deklarirani model komponente.

## Primjeri i očekivanja

1. Treptanje: GPIO4 → 330 Ω → LED A; LED K → naponska lišta → GND. Razdoblja su 500 + 500 ms.
2. Tipkalo: GPIO5 s `PULL_UP`, tipkalo prema GND; `led.value(tipkalo.value() == 0)` na GPIO4. Pritisak i otpuštanje dostupni su tijekom petlje.
3. Potenciometar: 3V3 / GND, klizač na GPIO1; ADC 11 dB → PWM GPIO4 1000 Hz. Pri 50% idealnog klizača 1,65 V daje 12-bitni uzorak 2180, `read_u16()` 34888 i radni omjer oko 53,2%. Uz crvenu LED i 330 Ω model računa oko 2,349 mA; svjetlina oko 47% referentnih 5 mA.

Promjena samo broja GPIO4 u kodu na GPIO6 ne pali postojeću LED. Nakon premještanja odgovarajućeg vodiča na GPIO6 ponovno radi. Uklanjanje prepojke naponske lište ili katodnog vodiča gasi LED. Obrnut polaritet također ne daje svjetlinu. Otvoreni ADC priključak javlja nepobuđen ulaz.

## Izvori potpisa i raspona

- [MicroPython v1.29.0 — Pin](https://docs.micropython.org/en/v1.29.0/library/machine.Pin.html)
- [MicroPython v1.29.0 — ADC](https://docs.micropython.org/en/v1.29.0/library/machine.ADC.html)
- [MicroPython v1.29.0 — PWM](https://docs.micropython.org/en/v1.29.0/library/machine.PWM.html)
- [MicroPython v1.29.0 — ESP32](https://docs.micropython.org/en/v1.29.0/esp32/quickref.html)
- [Espressif — GPIO ESP32-S3](https://docs.espressif.com/projects/esp-idf/en/v5.2/esp32s3/api-reference/peripherals/gpio.html)
- [Espressif — ADC rasponi po čipu](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html)

Pojednostavljenja iz gornjeg popisa odluke su našeg modela, a ne tvrdnja da službene biblioteke emuliraju taj sklop.
