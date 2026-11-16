# Dokazi etape 24C

`analog-results.json` nastaje izvršavanjem `npm run test:school-analog`. Svaki zapis zadržava cilj, rubriku, pobudu, hash snimke i ugovora, rezultat, kriterije i opažene uzorke. Isti početni program izvodi se tri puta na svakom cilju. Neovisno prevođenje novih C++ izvora traži uključene `LAB_S3_COMPILER_TEST` i `LAB_GRADING_COMPILER_TEST`; preskok nije prolaz.

`mysql-analog.json` nastaje nakon uspješne provjere stvarnog PHP/MySQL tijeka `npm run test:school-analog-api`. Baza mora biti zasebna prazna `labosv2_test_*` baza. Dokaz uključuje objavu osam novih ugovora, točne rezultate, zaključavanje, odbijanje tuđeg ugovora i očuvanje ranijeg digitalnog praga.

Razvojni i GitHub rezultati označavaju se zasebno. GitHub verzija ima `sourceCommit` i izvršene skupove prevoditelja. Stvarni školski pilot nije zamijenjen ovim zapisima.

Lokalna isporuka razdvaja `functional-results.json` (sve rubrike i tri ponavljanja), `s3-compiled-results.json`, `avr-compiled-results.json` i dodatnu provjeru komparatora od `final-compiled-results.json` (alternativni izvori na završnom provjeravaču te odbijanje lažnih digitalnih ispisa). Svaki rezultat zadržava vlastiti `checkerHash`; završni sažetak navodi provedene skupove i ograničenja. `sourceCommit: null` označava lokalni pokus i ne predstavlja GitHub integraciju.
