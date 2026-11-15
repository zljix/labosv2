// MIT. Reproducible local static app package; no dependencies at launch.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {zipSync,strToU8} from 'fflate';
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const catalogue=JSON.parse(readFileSync('dist/urs-catalog-summary.json','utf8'));
if(catalogue.version!==version)throw Error('Izgradi aktualno izdanje prije pakiranja.');
const entries={};
function tree(root,prefix){for(const f of readdirSync(root,{withFileTypes:true})){const p=root+'/'+f.name,k=prefix+'/'+f.name;if(f.isDirectory())tree(p,k);else entries[k]=new Uint8Array(readFileSync(p));}}
tree('dist','app');
const server=`// ESP32 Lab local server. Node.js 22+. MIT.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'app'),port=Number(process.env.LAB_LOCAL_PORT??4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.py':'text/plain','.csv':'text/csv; charset=utf-8','.zip':'application/zip'};
const server=createServer(async(req,res)=>{try{
 const actual=server.address().port;if(!['127.0.0.1:'+actual,'localhost:'+actual].includes(req.headers.host)||!['GET','HEAD'].includes(req.method)){res.writeHead(403);res.end();return;}
 const url=new URL(req.url,'http://127.0.0.1:'+port),path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!path.startsWith(root+sep)||(await stat(path)).isDirectory()){res.writeHead(404);res.end();return;}
 const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404);res.end();}});
server.on('error',e=>{console.error('Ne mogu pokrenuti lokalni Lab: '+e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('ESP32 Lab: http://127.0.0.1:'+server.address().port+'/\\nOstavi ovaj prozor otvoren. Zaustavljanje: Ctrl+C.'));
`;
entries['start-local.mjs']=strToU8(server);
entries['Pokreni.cmd']=strToU8('@echo off\r\ncd /d "%~dp0"\r\nnode start-local.mjs\r\npause\r\n');
entries['README.txt']=strToU8(`ESP32 MicroPython Lab ${version} — etapa 22I

Raspakiraj cijeli ZIP u zasebnu mapu. Potreban je Node.js 22 ili noviji.
Windows: Pokreni.cmd. Linux/macOS: node start-local.mjs
Otvori http://127.0.0.1:4173/ i ostavi terminal otvoren.
Worker i WASM trebaju HTTP. Ako je port zauzet, zatvori raniji lokalni Lab.
Za rad aplikacije nakon raspakiravanja nisu potrebni npm ni vanjska mreza.

NOVO: Pregled razreda — do 30 URS ZIP/JSON predaja, pojedinacna provjera
formata, popunjenosti i podudaranja programa/sklopa. Pregledaj odgovore,
otvori zaustavljenu kopiju za pokus i upisi vlastitu biljesku/status.
JSON evidencije cuva biljeske; CSV daje pregled svih radova bez obzira na filtre.
Za nastavak sacuvaj JSON i izvorne ucenicke ZIP-ove, pa ih ponovno ucitaj.
Biljeske se vracaju samo uz potpuno jednaki sadrzaj rada (oba cvora i odgovori).
Ostaju u otvorenoj aplikaciji dok ih ne izvezes; nisu automatski spremljene.
Projekt s biljeskom mozes preuzeti kao ZIP. Nema automatske ocjene ili
potvrde autorstva. Pocetne V1-V5 i dalje se pregledavaju pojedinacno.

URS18 — automatski I2C pretvornik u dvije naponske domene.
LV=3V3, HV=5V, GND zajednicki; SDA_L/SCL_L i SDA_H/SCL_H su odvojene mreze.
Nema DIR-a. Lab carrier ima cetiri uklonjiva 10 kOhm pull-up otpornika.
BMP280 i OLED128x32 primjeri rade za S3 MicroPython, S3 C++, Uno i Nano.
S3 strana je 3,3 V, udaljeni modul izriciti 5 V carrier s regulatorom/prilagodbom.
Uno/Nano strana je 5 V, udaljeni modul izvorni 3,3 V profil.
Promatraj oba HIGH napona, I2C ACK/bajtove i novo mjerenje ili piksele.
Model prikazuje DC i I2C transakcije, bez RC bridova, clock-stretchinga,
hot-swap modela ili jamstva fizicke frekvencije. Nije SPI/DHT/1-Wire adapter.
Bez valjanih napajanja model odbija prijenos; to nije fizicka potvrda izolacije.

URS17 zadrzava zasebni SN74LVC2T45 GPIO profil sa zajednickim DIR-om.
Vjezbe -> URS zbirka: ${catalogue.lessons} tema, ${catalogue.variants} varijanti.
${catalogue.targets.map(t=>t.label+': '+t.count+'/'+catalogue.variants).join('; ')}.
Ukupno ${catalogue.total} kombinacija; matrica ima ${catalogue.components} stavki x 4 cilja.
Upute uvode pojmove prije pokusa. Izvedi promjenu, kvar i oporavak; upisi
stvarna opazanja i odgovore. Stop -> Zabiljezi pregled sadrzaja -> URS predaja ZIP.
Ponovno uvezi ZIP i provjeri. Hash nije potvrda autorstva ni automatska ocjena.
Skolske LV1/LV2 i pocetne V1-V5 ostaju zasebne.

Postojeci mjerni, GPIO, TFT/dodir, pogonski i radijski primjeri ostaju dostupni.
Dva cvora spremaju oba programa i sklopa u jedan projekt; NRF24 koristi SPI,
ACK/retry i izricit virtualni radijski model. microSD: SDSC 8 MiB / FAT16,
datoteka do 64 KiB, do 256 izmijenjenih sektora. DS1302: virtualni BCD sat i RAM.
SD/RTC stanje sacuvaj u projekt prije izvoza. Stop zamrzava prikaz; Run/Reset
pokrecu novu sesiju i zadrzavaju samo izricito sacuvana stanja prema uputama.
MAX30102 koristi sintetski signal; nema SpO2 ili zdravstvenog mjerenja.

Pocetni C++ primjeri imaju tocne postojece prevedene programe. Novi ili
promijenjeni C++ izvor/header treba ponovno prevesti preko gumba Prevedi.
S3 koristi funkcionalni WASM profil; simulator ne izvodi fizicki ESP32 firmware.
Ranijih 69 tocnih S3 izvoza ima zasebne Espressif 3.3.12 compiler dokaze;
novo provjeravanje njihovih hashova nije ponovno prevođenje niti fizicki pokus.
Za lokalni compiler most prije pokretanja postavi:
Windows cmd: set LAB_ARDUINO_SITE=http://127.0.0.1:4173
Linux/macOS: export LAB_ARDUINO_SITE=http://127.0.0.1:4173
Upute za potrebne alate nalaze se u paketu prevoditelja dostupnom kroz Prevedi.

Projekti se cuvaju u pregledniku za taj origin. ZIP/JSON prenosi rad na drugo
racunalo. Obrazac pilota sprema nacrt JSON i biljezi stvarno opazene korake.
Lokalni HTTP rad uz ukljucen posluzitelj nije dokaz hladnog offline otvaranja
privatne produkcijske adrese. Fizicki moduli, skolska oprema, Windows/macOS,
iOS/Safari/Android i samostalan ucenicki pilot jos traze zasebne provjere.
Izdanje ostaje nastavna beta.
`);

const output=resolve(process.argv[2]??('ESP32_MicroPython_Lab_'+version.split('-')[0]+'_Lokalno.zip'));
writeFileSync(output,zipSync(entries,{level:6}));console.log(output);
