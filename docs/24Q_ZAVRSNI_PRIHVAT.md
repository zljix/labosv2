# 24Q · završni tehnički pregled i prijelaz u pilot

17. studenoga 2026. · završna dorada 0.14.15-beta.2

## Potvrđeno

Potpuna školska regresija završila je uspješno u [izvođenju 44158859956](https://github.com/zljix/labosv2/actions/runs/44158859956). Provjereni izvor `58e8ac0f75c2bd492ed2064cb05b82a5bd0de64d` ima isti Git tree `43fb0a47486b272b2478838107fc9dcd632ec494` kao javno objavljena 24Q beta.1 (`0fc488a49ebe9e024bfe64d3b26c1ac8653af38d`). To nije pretpostavka na temelju broja verzije: uspoređeni su identifikatori stabla izvora. Pojedinačni koraci sačuvani su u `stage24q-evidence/school-acceptance.json`.

Prošli su stvarni PHP/MySQL računi, razredi i dodjele, revizije i istodobno spremanje, bodovanje, zaključavanje i dopuštena dorada, nastavnički pregled, arhiva i povrat sigurnosne kopije. Prošao je i sintetski test opterećenja s 30 korisnika; to nije pilot sa stvarnim učenicima. Integracijski test sučelja koristi React u JSDOM-u s pravim PHP/MySQL servisom, a ne ručni pregled prijavljenog školskog portala u pregledniku.

Preuzet je CI paket beta.1 i provjereno svih 955 stavki njegove inventure: nema razlika veličine ni SHA-256. Vanjski CI artefakt još ima povijesni naziv `Labosv2-24O-Skolski-paket`; sadržaj i inventura potvrđuju 24Q / 0.14.15-beta.1. SHA-256 arhive CI artefakta: `218b152cb9307f71d9146bbc82560dbd3c60d0068dba4e04f723affab40389c7`.

## Završna dorada beta.2

- Vraćen je vidljiv natpis **Povijest** u projektnom izborniku na uskom zaslonu.
- Editor prikazuje uputu **Esc, zatim Tab** za izlazak tipkovnicom, povezanu i preko `aria-describedby`. U Chromiumu je potvrđen prelazak na karticu Konzola bez izmjene koda.
- Algoritmi provjeravača, rubrike, školski API i sinkronizacija nisu mijenjani. Potpuna prethodna regresija odnosi se na navedeni beta.1 izvor; beta.2 ima zasebne ciljane provjere prikaza, izgradnje i paketa. Ne pripisujemo prethodno izvođenje novom commitu.

Nakon tih izmjena prošle su ciljane provjere sučelja, metodičkih uputa, sinkronizacije, završnog sažetka, prikaza izvještaja i GitHub Pages paketa (32 testa bez preskakanja). Zasebno je prošlo još 10 testova root/offline izdanja i školskog paketa: ukupno 42 ciljane provjere beta.2 bez preskakanja. Postojeći dokazi u paketu navode vlastiti izvor i opseg; nisu nova provjera svake kombinacije.

## Pregled u Chromiumu

| Prikaz | Provjereno | Granica dokaza |
|---|---|---|
| Povećanje preglednika 200 % | Dijalog vježbi, V1 upute, unos odgovora, dostupnost predaje; nema prelijevanja cijele stranice | Stolni preglednik 1363 × 936 fizičkih piksela, efektivno 681 × 468 CSS px |
| Okvir 1366 × 768 | V1 sklop, editor, kartice, obje teme i glavne radnje | Pravi CSS viewport unutar privremenog iframea; uspravni pomak sadržaja ostaje dostupan |
| Okvir 390 × 844 | Status spremanja, mobilne kartice, kôd, projektni izbornik i vidljiv natpis Povijest | Sintetska širina u Chromiumu, bez stvarnog dodira i mobilne tipkovnice |
| Okvir 768 × 390 | Dijalog zbirke, pomicanje sadržaja i zatvaranje tipkom Esc | Sintetski vodoravni prikaz |
| Tipkovnica | Home/strelice za kartice; Esc zatvara izbornik/dijalog; Esc pa Tab napušta editor | Nije provjera čitačem zaslona |

Privremena stranica za provjeru veličina ne ulazi u objavu ni paket.

## Pilot koji se mora provesti u školi

Za bilješke koristiti postojeći `pilot.html` i `docs/stage23i-pilot.md`; rezultati ostaju prazni do stvarnog opažanja.

1. Na školskom poslužitelju provjeriti račun učenika i nastavnika. Učenik otvara dodijeljenu V1 ili V3, napravi izmjenu i čeka potvrdu revizije. Nastavnik treba vidjeti upravo tu spremljenu snimku.
2. Na odabranoj URS varijanti otvoriti istraživačku kopiju, promijeniti program i vratiti izvorni projekt iz izbornika Projekt → Projekti. Kopija mora ostati lokalna, bez službene predaje; izvorni pokušaj mora ostati sačuvan.
3. U izvornom pokušaju usporediti službeni rezultat s posljednjom spremljenom revizijom. Pregledati završni sažetak, potvrditi zaključavanje i u nastavničkom pregledu usporediti reviziju, bodove, kôd, sklop i odgovore. Provjeriti da je za novu doradu potreban nastavnikov novi pokušaj.
4. Sa 3–5 učenika bilježiti vrijeme do prvog pokretanja, broj potrebnih pojašnjenja, razumijevanje razlike spremljeno/provjereno/predano i razlikovanje pokusa od bodovanog zadatka.
5. Na stvarnom iPhoneu/Safariju i Androidu provjeriti dodir, tipkovnicu, uspravni/vodoravni prikaz i spremanje nakon povratka u aplikaciju. Odvojeno provjeriti čitač zaslona i nekoliko zadataka na fizičkom sklopovlju.
6. Nakon ispravaka opaženih poteškoća provesti puni nastavni blok. Funkcionalne bodove ne pretvarati automatski u dokaz razumijevanja ili ocjenu.

Tehnička priprema ne potvrđuje nastavnu učinkovitost, stvarne mobilne uređaje ni punu WCAG sukladnost. Ti dijelovi prihvata ostaju otvoreni do stvarne provedbe.
