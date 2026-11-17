import {identityText,STUDENT_NAME_LIMIT,CLASS_NAME_LIMIT} from '../project/identity';
import { basicExamples, exampleCircuit } from '../circuit/examples';
import { peripheralCircuit, peripheralExample } from '../circuit/peripheralExamples';
import { newProject, type Project } from '../project/model';
import type { Circuit } from '../circuit/model';

export const LESSON_VERSION = 1;
export const WORK_FILE = 'vjezba.json';
export const RESULT_FILE = 'provjera.json';
export interface Lesson {
  id: string; number: number; title: string; minutes: string; goal: string;
  before: string; concepts: {term:string; explanation:string}[];
  connections: [string,string][]; guided: string; steps: string[];
  questions: string[]; criteria: string[]; tips: string[];
}
const ledConnections: [string,string][] = [
  ['GPIO4 → otpornik 330 Ω → LED A', 'Izlaz i ograničavanje struje; A je anoda.'],
  ['LED K → GND', 'Katoda zatvara strujni krug na zajedničku masu.'],
  ['Breadboard', 'A–E i F–J su odvojene skupine u istom stupcu. Lište su prekinute između 15 i 16; u predlošku je prepojka.'],
];
const i2cConnections: [string,string][] = [
  ['AHT10: VCC / GND / SDA / SCL', '3V3 / GND / GPIO8 / GPIO9 · I2C0 · 0x38'],
  ['OLED: VCC / GND / SDA / SCL', '3V3 / GND / GPIO10 / GPIO11 · I2C1 · 0x3C'],
];
export const lessons: Lesson[] = [
  {
    id:'led-time', number:1, title:'LED i vrijeme', minutes:'35–45 min',
    goal:'Sastaviti zatvoren strujni krug i programirati period treptanja od jedne sekunde.',
    before:'Dovoljno je prepoznati Python petlju i uvlačenje. Prvo pročitaj pojmove, zatim pogledaj spojeve i kôd.',
    concepts:[
      {term:'GPIO izlaz',explanation:'Program na priključku postavlja 0 ili 1, u ovom modelu približno 0 V ili 3,3 V. Broj 4 u Pin(4) znači GPIO4, a ne četvrti fizički priključak.'},
      {term:'LED i otpornik',explanation:'LED provodi od anode A prema katodi K. Serijski otpornik ograničava struju; sam GPIO bez zatvorene veze prema masi ne može upaliti LED.'},
      {term:'Period i čekanje',explanation:'sleep_ms(250) čeka 250 milisekundi. Period je zbroj trajanja uključenja i isključenja: 250 + 750 = 1000 ms. Čekanje ne mijenja već postavljeno stanje pina.'},
      {term:'Frekvencija',explanation:'Frekvencija f govori koliko se punih ciklusa ponovi u sekundi: f = 1/T, gdje period T izražavamo u sekundama. Za T = 1000 ms = 1 s vrijedi f = 1/1 = 1 Hz. Za T = 500 ms = 0,5 s vrijedi f = 2 Hz.'},
    ], connections:ledConnections,
    guided:'led.on()\nsleep_ms(500)  # stanje ostaje ukljuceno tijekom cekanja\nled.off()\nsleep_ms(500)',
    steps:[
      'U Sastavljanju pronađi LED i otpornik. Nedostaje veza između breadboarda e8 i LED A. Alatom Vodič poveži ta dva priključka ili koristi „Veza iz popisa”.',
      'Otvori Provjeru spojeva, zatim Pokreni. Početni program trepće 500 ms / 500 ms. Zaustavi program prije izmjene sklopa.',
      'U main.py promijeni trajanje na 250 ms uključeno i 750 ms isključeno. Ponovno pokreni i promatraj nekoliko ciklusa.',
      'Pokreni Provjeri rad. Nakon ispravaka ponovi provjeru, zapiši opažanje i pripremi predaju.',
    ],
    questions:['Objasni zašto su u krugu potrebni otpornik i povratni spoj prema masi.','Koliki su period i frekvencija treptanja za 250 ms / 750 ms? Navedi što si opažao.','Što se dogodilo kada si prekinuo jedan vodič i ponovno pokrenuo program? Nakon pokusa vrati ispravan spoj.'],
    criteria:['LED se naizmjence uključuje i isključuje kroz najmanje tri ciklusa.','Uključenje približno 250 ms, isključenje približno 750 ms; provjera dopušta kašnjenje preglednika.'],
    tips:['LED je stalno ugašena: provjeri A/K, nedostajući vodič i prepojku mase na breadboardu.','Promjena sleep_ms utječe tek na novo pokretanje. Provjera pokreće zasebnu kopiju programa.'],
  },
  {
    id:'button', number:2, title:'Tipkalo kao ulaz', minutes:'35–45 min',
    goal:'Uključiti LED samo dok je tipkalo pritisnuto i objasniti aktivno nisku logiku.',
    before:'Nastavlja se GPIO izlaz iz prve vježbe. U ovoj vježbi dodajemo ulaz; pripremljeni sklop već ima sve vodiče.',
    concepts:[
      {term:'Digitalni ulaz',explanation:'Pin.IN čita električnu razinu. Ulaz mora imati određenu razinu i kada nitko ne pritišće tipkalo.'},
      {term:'PULL_UP',explanation:'Slabi unutarnji otpornik povlači otvoreni ulaz prema 3,3 V, pa value() vraća 1. Tipkalo ga pritiskom spaja na GND, pa vraća 0.'},
      {term:'Aktivno niska logika',explanation:'Pritisnuto znači 0, stoga uvjet glasi tipkalo.value() == 0. Kontakti A1–A2 uvijek su spojeni; B1–B2 također. Pritisak povezuje strane A i B.'},
    ], connections:[...ledConnections,['Tipkalo A1 / B1','GPIO5 / GND; u programu Pin(5, Pin.IN, Pin.PULL_UP).']],
    guided:'tipkalo = Pin(5, Pin.IN, Pin.PULL_UP)\npritisnuto = tipkalo.value() == 0\n# led.value(True) ukljucuje, led.value(False) iskljucuje.',
    steps:['Pokreni početni kôd i u Sastavljanju mijenjaj stanje tipkala. U konzoli poveži očitano 0/1 sa stanjem tipkala.','Unutar petlje dopuni naredbu koja uključuje LED samo pri value() == 0. Zadrži kratko čekanje od 20 ms.','Isprobaj najmanje dva pritiska i otpuštanja, a zatim Provjeri rad.','Zaustavi program, privremeno odspoji signal tipkala, pokreni i objasni opažanje. Vrati vodič i ponovi provjeru prije predaje.'],
    questions:['Zašto otvoreno tipkalo uz PULL_UP daje 1, a pritisnuto 0?','Zapiši LED stanje za otvoreno i pritisnuto tipkalo te opažanje nakon odspajanja signalnog vodiča.'],
    criteria:['LED je ugašena pri otpuštenom tipkalu.','Dva pritiska uključuju LED, a oba otpuštanja je isključuju unutar približno 300 ms.'],
    tips:['Ako LED radi obrnuto, provjeri uspoređuješ li ulaz s 0 ili s 1.','Povezivanje A1 i A2 na signal/masu stvorilo bi trajnu vezu; pritiskom se spajaju strane A i B.'],
  },
  {
    id:'adc-pwm', number:3, title:'Potenciometar i PWM', minutes:'40–50 min',
    goal:'Pretvoriti analogno očitanje u radni omjer i postupno regulirati svjetlinu LED-ice.',
    before:'Poznaješ GPIO i petlju. Sada ulaz nije samo 0/1, nego broj koji predstavlja napon.',
    concepts:[
      {term:'Potenciometar',explanation:'Izvodi 1 i 3 su krajevi otporne staze. Izvod 2 je pomični klizač koji daje dio napona između 3,3 V i mase.'},
      {term:'ADC',explanation:'Analogno-digitalni pretvornik napon pretvara u broj. read_u16() vraća 0–65535. Ovaj model ima 12-bitnu kvantizaciju i uz ATTN_11DB zasićuje na približno 3,1 V.'},
      {term:'PWM',explanation:'Izlaz brzo izmjenjuje 0 i 1. Radni omjer je udio vremena uključenja; duty_u16(0) znači 0 %, a duty_u16(65535) 100 %. Frekvencija od 1000 Hz nije svjetlina.'},
      {term:'Primjer pretvorbe',explanation:'Na 50 % klizača napon je približno 3,3 × 0,5 = 1,65 V. Uz zasićenje ADC-a na 3,1 V udio je 1,65 / 3,1 ≈ 0,532. Zato read_u16 daje približno 1,65 / 3,1 × 65535 ≈ 34882, a jednak duty_u16 oko 53,2 %. Kvantizacija može malo promijeniti broj.'},
    ], connections:[...ledConnections,['Potenciometar 1 / 2 / 3','3V3 / GPIO1 (ADC) / GND.']],
    guided:'adc = ADC(Pin(1), atten=ADC.ATTN_11DB)\nled = PWM(Pin(4), freq=1000, duty_u16=0)\nvrijednost = adc.read_u16()\n# Jednaki rasponi 0–65535 omogucuju izravno zadavanje duty_u16.',
    steps:['Pokreni kôd i mijenjaj položaj potenciometra 0 / 25 / 50 / 100 %. Prati ADC u konzoli.','Dopuni petlju tako da očitanje određuje led.duty_u16(...). Svjetlina treba rasti postupno.','Provjeri rad pa u Mjerenjima usporedi PWM pri 50 % i 100 % klizača.','Objasni zašto sredina klizača daje oko 53 % PWM-a u ovom modelu, a ne točno 50 %.'],
    questions:['Opiši put informacije od klizača preko ADC-a do LED-ice.','Navedi opaženi radni omjer pri 0, 50 i 100 % klizača. Zašto 50 % položaja nije točno 50 % PWM-a?'],
    criteria:['Pri 0 % klizača LED je ugašena, a pri 100 % uključena.','Međupoložaji 25 % i 50 % daju rastuću svjetlinu u odnosu na najveću vrijednost.'],
    tips:['Klizač je izvod 2; ne spajaj ga na 5 V.','Za duty_u16 koristi raspon 0–65535. duty() ima drugi raspon, 0–1023.'],
  },
  {
    id:'aht-oled', number:4, title:'AHT10 i OLED', minutes:'45–60 min',
    goal:'Očitati temperaturu i relativnu vlagu te ih stalno osvježavati na OLED-u.',
    before:'Senzor i zaslon nisu obični GPIO ulazi/izlazi: razmjenjuju nizove bajtova preko sabirnice.',
    concepts:[
      {term:'I2C i adresa',explanation:'SDA prenosi podatke, a SCL takt. Adresa određuje uređaj: AHT10 je 0x38, OLED 0x3C. Zbog odabranog AHT10 profila koristimo dvije zasebne sabirnice, obje s pull-up otpornicima na 3,3 V.'},
      {term:'Upravljačka datoteka',explanation:'aht10.py šalje naredbu pretvorbe i dekodira temperaturu/vlagu. ssd1306.py šalje memoriju slike na zaslon. Datoteke moraju ostati u projektu i uključene su u ZIP.'},
      {term:'Memorija slike i show()',explanation:'fill(0) briše staru sliku, text() upisuje tekst u memoriju, a show() je šalje na OLED. Sam text() ne osvježava fizički prikaz.'},
    ], connections:i2cConnections,
    guided:'temperatura, vlaga = senzor.read()\nzaslon.fill(0)\nzaslon.text("T: %.1f C" % temperatura, 0, 0)\n# Dodaj RH s jednim decimalnim mjestom na drugom retku.\nzaslon.show()',
    steps:['Pregledaj dvije I2C inicijalizacije i upravljačke datoteke. Pokreni: početni kôd prikazuje samo temperaturu.','Dopuni prikaz relativne vlage, npr. zaslon.text("RH: %.1f %%" % vlaga, 0, 16). Svakim očitanjem briši i osvježi oba retka.','Prikaži obje vrijednosti s jednim decimalnim mjestom standardnom text() funkcijom, na različitim redcima unutar zaslona. Osvježavaj najkasnije svake 2 s. Provjera traži brojke u stvarnim pikselima, ne ispis u konzoli.','Promijeni temperaturu i vlagu odvojeno. Provjeri rad, zatim u zaustavljenom sklopu promijeni OLED adresu na 0x3D bez promjene koda. Zabilježi pogrešku i vrati ispravnu adresu.'],
    questions:['Koja je razlika između GPIO broja i I2C adrese?','Zašto su potrebni fill(0) i show()? Što si opazio nakon promjene adrese samo u svojstvima zaslona?','Zapiši dvije različite kombinacije temperature/vlage i vrijednosti koje je OLED prikazao.'],
    criteria:['AHT10 obavlja nova očitanja pri zadanim promjenama okoliša.','OLED u standardnom fontu prikazuje brojke temperature i vlage s jednim decimalnim mjestom; raspored teksta i nazivi varijabli su slobodni.'],
    tips:['NACK / ENODEV: provjeri SDA/SCL, napajanje, zajedničku masu i adresu.','Vrijednosti koje su samo u konzoli nisu dokaz da je OLED osvježen. Ne preskoči show().'],
  },
  {
    id:'regulator', number:5, title:'Regulator sa servom', minutes:'50–60 min',
    goal:'Povezati mjerenje, prikaz i aktuator te zadržati stanje između dva praga.',
    before:'Koristi se senzor i zaslon iz četvrte vježbe. Servo prima PWM signal, a upravljačka odluka ovisi i o prethodnom stanju.',
    concepts:[
      {term:'Prag',explanation:'Uključivanje iznad 28 °C i isključivanje ispod 26 °C dva su različita uvjeta. Za ovaj zadatak kod može uključiti na ≥28 i isključiti na ≤26.'},
      {term:'Histereza',explanation:'Između pragova ne mijenjamo stanje. Nakon otvaranja na 29 °C pri 27 °C ostaje otvoreno; nakon zatvaranja na 25 °C pri 27 °C ostaje zatvoreno.'},
      {term:'Servo impuls',explanation:'Profil koristi 50 Hz (period 20 ms), a širina impulsa 500–2500 µs određuje 0–180°. Servo.angle(90) daje približno 1500 µs. Model prikazuje zadani položaj, bez momenta ili gibanja pod opterećenjem.'},
    ], connections:[...i2cConnections,['Servo V+ / GND / SIG','5V / zajednička GND / GPIO4. Fizički servo zahtijeva odgovarajuće napajanje; ovaj spoj nije proračun struje motora.']],
    guided:'if temperatura >= 28:\n    otvoreno = True\nelif temperatura <= 26:\n    otvoreno = False\n# Izmedju pragova ne dodaj else koji brise prethodno stanje.\nservo.angle(90 if otvoreno else 0)',
    steps:['Pokreni početni regulator s jednim pragom od 28 °C. Isprobaj 29 → 27 → 25 °C i primijeti kada se zatvara.','Promijeni donji prag zatvaranja na 26 °C. Očuvaj varijablu stanja između iteracija i oba brojčana prikaza OLED-a.','Ručno provjeri slijed 24 → 29 → 27 → 25 → 27 → 29 °C. Očekivani kutovi su 0 → 90 → 90 → 0 → 0 → 90°.','Provjeri rad, odgovori na pitanja i izvezi predaju. Paket uključuje sklop, kôd, upravljačke datoteke, upute, odgovore i zapis provjere.'],
    questions:['Objasni zašto pri 27 °C regulator može imati dva različita ispravna stanja.','Zapiši kutove za slijed 24 → 29 → 27 → 25 → 27 → 29 °C i usporedi ih s očekivanjima.','Koje veličine virtualni servo ne modelira i što treba provjeriti prije rada s fizičkim motorom?'],
    criteria:['Servo slijedi slijed 0 → 90 → 90 → 0 → 0 → 90° uz nova senzorska očitanja.','OLED nastavlja prikazivati temperaturu i vlagu. U području histereze čuva se prethodno stanje.'],
    tips:['Ako se pri povratku na 27 °C uvijek zatvori, oba praga su ista ili else prepisuje stanje.','Ne stvaraj otvoreno = False unutar petlje prije svakog mjerenja.'],
  },
];
export const getLesson = (id:string) => lessons.find(l=>l.id===id);
export interface LessonWork { format:'esp32-lab-work'; version:1; lessonId:string; lessonVersion:1; student:string; group:string; answers:string[] }
export function readWork(p:Project):LessonWork|undefined {
  if(p.language!=="micropython")return;
  try {
    const v=JSON.parse(p.files[WORK_FILE]??'null'), l=getLesson(v?.lessonId);
    if(!l||v.format!=='esp32-lab-work'||v.version!==1||v.lessonVersion!==LESSON_VERSION||
      !identityText(v.student,STUDENT_NAME_LIMIT)||!identityText(v.group,CLASS_NAME_LIMIT)||
      !Array.isArray(v.answers)||v.answers.length!==l.questions.length||v.answers.some((x:unknown)=>typeof x!=='string'||x.length>2000)) return;
    return {format:'esp32-lab-work',version:1,lessonId:l.id,lessonVersion:1,student:v.student,group:v.group,answers:[...v.answers]};
  } catch { return; }
}
export const learningDocuments = new Set([WORK_FILE,RESULT_FILE,'predaja.md','upute.md','scenarij.json']);
export function programFiles(p:Project):Record<string,string> {
  // Assessment documents are visible and archived, but cannot become hidden
  // inputs to a lesson's MicroPython program or its behaviour fingerprint.
  const ursDocuments=new Set(['urs-vjezba.json','urs-upute.md','urs-predaja.md']);
  return readWork(p)||p.files['urs-vjezba.json']?Object.fromEntries(Object.entries(p.files).filter(([name])=>!learningDocuments.has(name)&&!ursDocuments.has(name))):p.files;
}
export function lessonCircuit(id:string, solution=false):Circuit {
  const l=getLesson(id); if(!l)throw Error('Nepoznata vježba.');
  if(l.number<=3){
    const c=exampleCircuit(l.number===1?'blink':l.number===2?'button':'pwm');
    if(l.number===1&&!solution)c.wires=c.wires.filter(w=>w.id!=='w5');
    return c;
  }
  const c=peripheralCircuit();
  if(l.number===4){c.components=c.components.filter(p=>p.kind!=='servo');c.wires=c.wires.filter(w=>w.from.component!=='servo1'&&w.to.component!=='servo1');}
  return c;
}
const sensorCode = (solution:boolean) => `from machine import Pin, I2C
from time import sleep_ms
from aht10 import AHT10
from ssd1306 import SSD1306_I2C

senzor = AHT10(I2C(0, sda=Pin(8), scl=Pin(9), freq=100000))
zaslon = SSD1306_I2C(128, 64, I2C(1, sda=Pin(10), scl=Pin(11)), addr=0x3C)
while True:
    temperatura, vlaga = senzor.read()
    zaslon.fill(0)
    zaslon.text("T: %.1f C" % temperatura, 0, 0)
    ${solution?'zaslon.text("RH: %.1f %%" % vlaga, 0, 16)':'# TODO: prikazi relativnu vlagu s jednim decimalnim mjestom'}
    zaslon.show()
    print(temperatura, vlaga)
    sleep_ms(500)
`;
export function lessonCode(id:string, solution=false):string {
  switch(id){
    case 'led-time':return solution?basicExamples.blink.code.replace('sleep_ms(500)','sleep_ms(250)').replace('sleep_ms(500)','sleep_ms(750)').replace('500 ms ukljuceno / iskljuceno','250 ms ukljuceno / 750 ms iskljuceno'):basicExamples.blink.code;
    case 'button':return solution?basicExamples.button.code:`from machine import Pin
from time import sleep_ms

led = Pin(4, Pin.OUT, value=0)
tipkalo = Pin(5, Pin.IN, Pin.PULL_UP)
while True:
    vrijednost = tipkalo.value()
    # TODO: led.value(...) ukljucuje LED samo kada je ulaz 0
    print("Ulaz:", vrijednost)
    sleep_ms(20)
`;
    case 'adc-pwm':return solution?basicExamples.pwm.code:basicExamples.pwm.code.replace('led.duty_u16(vrijednost)','# TODO: prenesi ocitanje u led.duty_u16(...)');
    case 'aht-oled':return sensorCode(solution);
    case 'regulator':return solution?peripheralExample.code:peripheralExample.code.replace('PRAG_ZATVARANJA = 26','PRAG_ZATVARANJA = 28  # TODO: zaseban donji prag za histerezu');
    default:throw Error('Nepoznata vježba.');
  }
}
export function lessonMarkdown(l:Lesson){
  return `# Vježba ${l.number}: ${l.title}\n\n${l.goal}\n\n## Prije početka\n\n${l.before}\n\n## Novi pojmovi\n\n${l.concepts.map(c=>`**${c.term}.** ${c.explanation}`).join('\n\n')}\n\n## Referentne veze\n\n| Veza | Objašnjenje |\n|---|---|\n${l.connections.map(c=>`| ${c[0]} | ${c[1]} |`).join('\n')}\n\n## Vođeni primjer\n\n\`\`\`python\n${l.guided}\n\`\`\`\n\n## Samostalni rad\n\n${l.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\n## Provjera ponašanja\n\n${l.criteria.map(s=>'- '+s).join('\n')}\n\n## Pitanja i dokazi\n\n${l.questions.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\nProvjera izvršava stvarni MicroPython u zasebnoj sesiji. Ne provjerava nazive varijabli. Lokalni zapis nije ovjerena ocjena niti dokaz autorstva; nastavnik treba pregledati sklop/kôd/odgovore i ponoviti provjeru.\n`;
}
export function createLessonProject(id:string,drivers:Record<string,string>={},solution=false):Project {
  const l=getLesson(id);if(!l)throw Error('Nepoznata vježba.');
  const p=newProject(lessonCode(id,solution),`V${l.number} · ${l.title}${solution?' — nastavnički uzorak':''}`);
  const needed=l.number===5?['aht10.py','ssd1306.py','servo.py']:l.number===4?['aht10.py','ssd1306.py']:[];
  for(const name of needed){if(!drivers[name])throw Error('Nedostaje upravljačka datoteka '+name);p.files[name]=drivers[name];}
  const work:LessonWork={format:'esp32-lab-work',version:1,lessonId:id,lessonVersion:1,student:'',group:'',answers:l.questions.map(()=>'')};
  p.circuit=lessonCircuit(id,solution);p.settings.example='lesson-'+id;
  p.files[WORK_FILE]=JSON.stringify(work,null,2);p.files['upute.md']=lessonMarkdown(l);
  p.files['scenarij.json']=JSON.stringify({format:'esp32-lab-scenario',version:1,lessonId:id,lessonVersion:1,criteria:l.criteria,source:'Ugrađeni scenarij aplikacije; uvezeni sadržaj ne određuje izvršnu provjeru.'},null,2);
  return p;
}
