# ESP32 MicroPython Lab — etapa 22I: pregled predaja razreda

**0.12.7-beta.1 · 14. studenoga 2026.** Polazište: `36aaeef7e958142417abd8629e795ffc26a31de8`, izdanje 0.12.6. Završna izgradnja: `11bf3173ac74417a`.

## Dovršena mogućnost

Gumb **Pregled razreda** u alatnoj traci i u izborniku Vježbe otvara nastavnički pregled više URS predaja. Učitavanje ZIP/JSON projekta ne pokreće program i ne dodaje ga automatski u popis projekata. Za izričit pokus **Otvori za pokus u laboratoriju** stvara zaustavljenu kopiju uz prethodno spremanje otvorenog projekta. Pregled čuva odabrani rad i bilješke pri zatvaranju dijaloga i povratku iz laboratorija.

U jednoj sesiji stane do **30 različitih predaja**, do 30 odabranih datoteka odjednom, ukupno do 64 MiB po odabiru i do 2 MiB po projektu. Svaki paket prolazi postojeći parser projekta i URS radnog lista. Pogreška jedne datoteke ne prekida ostale. Istovjetan sadržaj zadržava prvu učitanu kopiju; duplikat se jasno navodi među preskočenima. Uvezeni tekst prikazuje se kao tekst.

Popis pokazuje učenika, grupu, temu, cilj, broj popunjenih odgovora i opažanja te nedostajući ili zastarjeli pregled programa/sklopa. Pretraga, grupa i nastavnički status filtriraju popis. Promjena bilješke vraća status na čekanje, ali zadržava odabrani rad čak i kad više ne prolazi aktivni filtar. Prazna bilješka ne može dobiti završni status Pregledano ili Potrebna dorada. Broj popunjenih polja nije provjera točnosti odgovora.

Detalj sadrži pitanja, odgovore, tri opažanja i ugrađene kriterije odabrane teme. Nastavnički zapis koji je stigao u učeničkom projektu prikazuje se zasebno, uz provjeru podudaranja. Ne postavlja automatski status novog pregleda. Nastavnik sam ponavlja pokuse i upisuje opaženo. Nema prijavljene nastavničke uloge, automatske ocjene ili ovjere autorstva.

## Spremanje i nastavak

**Preuzmi evidenciju JSON** sprema do 60 zapisa s bilješkama, statusima, vremenima i hashom sadržaja. Projekti i njihove izvorne datoteke ostaju u učeničkim ZIP-ovima. Evidencija živi u otvorenoj aplikaciji i nije automatski trajno spremljena. Prije ponovnog učitavanja/zatvaranja treba sačuvati JSON i izvorne ZIP-ove. Nespremljena sesija registrira upozorenje preglednika pri napuštanju stranice; njegova primjena ovisi o pregledniku.

Pri nastavku se JSON i predaje mogu učitati bilo kojim redom. Bilješka se veže samo uz isti sadržaj programa, sklopa, obaju radijskih čvorova, identiteta učenika/grupe, odgovora i opažanja. Ime datoteke ili učenika nije ključ. Izmijenjen rad ostaje zaseban i na čekanju. Zapisi bez odgovarajućih predaja ostaju vidljivi i ponovno ulaze u JSON. Uvoz ne prepisuje različitu lokalnu bilješku; sukob se navodi. Uvezeni status označen je kao ručni zapis.

**Preuzmi pregled CSV** obuhvaća sve učitane predaje i zapise koji čekaju svoje ZIP-ove, neovisno o filtrima. UTF-8 BOM, točka sa zarezom, navodnici i višeredne ćelije prilagođeni su tabličnom pregledu; tekst koji može započeti formulom dobiva vodeći apostrof. CSV služi pregledu, JSON nastavku s bilješkama.

**Preuzmi projekt s bilješkom ZIP** dodaje postojeći URS nastavnički zapis uz točan hash sadržaja i vrijeme ručne odluke. Početna učitana predaja ostaje sačuvana u sesiji. Za potpune predaje s važećim pregledom ponovno se stvara pregledni tekst. Za nepotpune ili zastarjele predaje izostavlja se stari `urs-predaja.md`; povratna informacija ostaje u radnom listu. Izvori, upravljačke datoteke, prevedeni programi, oba čvora i spremljena medijska stanja ostaju vezani uz isti sadržaj.

## Provjere

Završni ciljani skup ima **359/359 prolaza, bez preskakanja**: 338 provjera projekta, pločica, početnih vježbi, URS zbirke i pregleda razreda te 21 provjera offline paketa i pilota. U 338 ulazi 26 novih provjera pregleda razreda; ponovljeni novi skup ne povećava broj. Ovo nije ponovno izvođenje cijele prethodne regresije od 1.308 testova.

Nove provjere obuhvaćaju sva četiri cilja, radio čvor B, stvarne ZIP/JSON izvoze, potpunost, zastarjele zapise, izmjene identiteta/odgovora/sklopa, duplikate, neispravne arhive, granice, provjeru formata evidencije, vraćanje u oba redoslijeda, sukobe bilježaka, CSV i ZIP s bilješkom. TypeScript provjera i produkcijska izgradnja prolaze. Početno pokretanje novog testnog izvora otkrilo je `await` u običnoj funkciji provjere; test je ispravljen prije završnog skupa, bez promjene aplikacijskog ponašanja. Zapis početnog izoliranog prolaza je `class-review.tap`; završni skup je `project-urs-review.tap`, a offline/pilot `offline-pilot.tap`.

U Chromeu/Linuxu najprije je pregledan razvojni kod, zatim stvarni završni statički **dist 0.12.7**. Učitano je šest predaja: četiri cilja, izmijenjeni izvor i nepotpun rad. Oštećen ZIP i duplikat s nastavničkim zapisom preskočeni su uz poruku. Vraćeni JSON povezao je bilješke s izvornim ZIP-ovima. Provjereni su filtri, povrat na isti rad, vraćanje statusa na čekanje i zadržavanje detalja izvan filtra. Uno kopija izričito je pokrenuta i zaustavljena; konzola je izmjenjivala LED=1/0 približno svakih 200 ms virtualnog vremena. Završni JSON, CSV i ZIP preuzeti su kroz preglednik; JSON ima šest zapisa i jedan ručni pregled, a ZIP hash odgovara sadržaju i bilješci. To su sintetski razvojni radovi, bez stvarnih učenika. `browser-review.json` opisuje opseg; pripadaju mu stvarne preuzete datoteke. Zajednički automatizirani pokušaj preuzimanja istekao je nakon što je uklanjanje filtra odabralo prvi nepregledani red; pojedinačni izvozi s izričito odabranom pregledanom predajom zatim su uspjeli.

Šest ključnih datoteka izvršavanja i artefakata bajtno je jednako polazištu: MicroPython WASM/JS, S3 i AVR primjeri, radijski primjeri i S3 core lock. `retained-artifacts.json` bilježi veličine i SHA-256. Fizički S3 prijevodi nisu ponovno izvođeni ovom etapom. Povijesni zapis `stage5-reference-results.json`, koji postojeći test mijenja pri pokretanju, vraćen je na izvorne bajtove; novo opažanje nalazi se u dnevniku etape 22I.

## Lokalni paket

`ESP32_MicroPython_Lab_0.12.7_Lokalno.zip`: **5.193.151 B**; SHA-256:

`f945edb99a3184d6412352bd8f78a810f0f16d4e9c07962e9f86959b2e2924e0`

Stvarnim raspakiravanjem i loopback HTTP posluživanjem provjereno je svih **188 resursa / 15.304.659 B**, njihove veličine i hashovi te oba WASM MIME odgovora. Novi odvojeno učitani JS/CSS pregleda razreda nalaze se u manifestu i paketu. `local-package.json` čuva rezultat. Node.js 22+; Windows `Pokreni.cmd`, Linux/macOS `node start-local.mjs`, adresa `http://127.0.0.1:4173/`.

## Granice i nastavak

Zbirka ostaje 18 tema, 67 varijanti po cilju i 268 kombinacija; postojeća numeracija URS01–18, V1–V5 i školske LV1/LV2 ostaje. Ovaj pregled obrađuje URS radne listove; V1–V5 koriste postojeći pojedinačni pregled. Podržanost svih budućih izvora, komponenti ili proizvoljnih binarnih datoteka nije izvedena iz broja zapisa.

Stvarna oprema, školsko računalo, Windows/macOS, ciljni Safari/iOS/Android, hladno offline otvaranje i samostalan učenički pilot još traže svoja opažanja. SFM-20B, DevKitC V4 i CAM trebaju točno određen fizički profil. Izdanje ostaje **nastavna beta**. Nastavnički pregled omogućuje prikupljanje stvarnih opažanja i povratnih informacija; ne zamjenjuje te provjere.

