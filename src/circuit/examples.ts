import { demoCircuit, type Circuit } from "./model";
export function pwmProgram(starter = false) {
  return `${starter
    ? '# Pomiči klizač i prati broj u konzoli. Dopuni označeni dio za upravljanje LED-icom.'
    : '# Okreni potenciometar i usporedi očitanje klizača sa svjetlinom LED-ice.'}

from machine import Pin, ADC, PWM
from time import sleep_ms

# Krajevi potenciometra: 1 na 3V3, 3 na GND; klizač 2 na GPIO1.
adc = ADC(Pin(1), atten=ADC.ATTN_11DB)
led = PWM(Pin(4), freq=1000, duty_u16=0)
prethodno = -1

while True:
    # ADC daje broj od 0 do 65535. PWM prihvaća isti raspon pa očitanje može
    # izravno zadati udio vremena tijekom kojeg LED svijetli.
    vrijednost = adc.read_u16()
    ${starter
      ? '# TODO: zadaj radni omjer LED-ice prema upravo očitanoj vrijednosti.'
      : 'led.duty_u16(vrijednost)'}

    # Za ispis pretvori isti broj u postotak. Na polovini raspona dobiješ
    # približno 50 %.
    postotak = vrijednost * 100 // 65535
    if postotak != prethodno:
        print("ADC:", vrijednost, "PWM:", postotak, "%")
        prethodno = postotak
    sleep_ms(30)
`;
}

export const basicExamples = {
  blink: {
    title:"Treptanje LED-ice",
    hint:"GPIO4 → 330 Ω → anoda LED; katoda preko breadboarda na GND. Promijeni sleep_ms ili spoji vodič na drugi GPIO i prilagodi kôd.",
    code:`# Usporedi trajanje svijetle i tamne faze LED-ice. Promijeni samo jedno
# čekanje pa ponovno pokreni program.

from machine import Pin
from time import sleep_ms

# GPIO je broj signala, a ne redni broj priključka na pločici.
led = Pin(4, Pin.OUT, value=0)
print("Treptanje: GPIO4, 500 ms ukljuceno / iskljuceno")

while True:
    # Izlaz ostaje uključen tijekom prvog čekanja i isključen tijekom
    # drugog. Zbroj tih vremena daje period treptanja.
    led.on()
    sleep_ms(500)
    led.off()
    sleep_ms(500)
`,
  },
  button: {
    title:"Tipkalo upravlja LED-icom",
    hint:"PULL_UP drži GPIO5 na 1 dok je tipkalo otvoreno. Pritisak ga spaja na GND (0); program tada uključuje LED na GPIO4.",
    code:`# Pritisni pa otpusti tipkalo i prati kada se upali LED-ica.

from machine import Pin
from time import sleep_ms

led = Pin(4, Pin.OUT, value=0)

# Unutarnji otpornik drži otvoreni ulaz na 1. Pritiskom tipkala ulaz se
# spaja na masu pa program očitava 0.
tipkalo = Pin(5, Pin.IN, Pin.PULL_UP)
prethodno = None

while True:
    pritisnuto = tipkalo.value() == 0
    led.value(pritisnuto)

    # Zapamti prikazano stanje. Tako jedan dugi pritisak daje samo jednu
    # poruku o promjeni.
    if pritisnuto != prethodno:
        print("Tipkalo:", "pritisnuto" if pritisnuto else "otpusteno")
        prethodno = pritisnuto
    sleep_ms(20)
`,
  },
  pwm: {
    title:"Potenciometar regulira svjetlinu",
    hint:"Klizač potenciometra ide na ADC GPIO1. read_u16 daje 0–65535; isti broj postavlja duty_u16. Model 11 dB zasićuje na 3,1 V.",
    code: pwmProgram(),
  },
};
export type BasicExample = keyof typeof basicExamples;
export function exampleCircuit(key:BasicExample):Circuit {
  const c=demoCircuit();
  const removed=key === "blink" ? ["sw1","pot1"] : key === "button" ? ["pot1"] : ["sw1"];
  c.components=c.components.filter(p=>!removed.includes(p.id));
  c.wires=c.wires.filter(w=>!removed.includes(w.from.component)&&!removed.includes(w.to.component));
  return c;
}
