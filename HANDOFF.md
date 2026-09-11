# Waar we zijn en wat er nog moet

Bijgewerkt op vrijdag 11 september 2026. Dit bestand staat in de repo, zodat een nieuwe sessie op elke computer weet waar hij instapt. Lees ook `README.md` voor hoe de app werkt en `BOUWPLAN.md` in de app-plan-map voor het plan van record.

Examen: woensdag 28 oktober 2026. De app is live op https://beebzoo.github.io/44-van-de-50/ en installeerbaar op telefoon en computer.

## Wat af is

**Fase 0 en fase 1 zijn allebei gebouwd**, ruim voor de deadlines uit het bouwplan (13 en 20 september).

De app: schil met de Belijning-tokens in licht en donker, Route met aftelling en hectometerpaaltjes, Leren, Blok, Lezen, Vraag, Antwoord, Quiz-einde, Blok gehaald, Borden, Fouten, Instellingen. Vraagsoorten ja/nee, meerkeuze, meervoudig, hotspot, volgorde en reeks. Quizmotor met steekproef per leespagina, de 100%-regel uit bouwplan sectie 2, herstelronde en de vraag "Wat ging er mis?". Dagelijkse herhaling met vijf Leitner-dozen. Foutenlijst met de vier fouttypen en "Oefen deze". Meld fout tijdens het studeren. Alles offline na installatie, geverifieerd met het netwerk uit.

De tekeningen: `js/scene.js` tekent kruispunten, rotondes, uitritten en rechte wegen met auto's, trams, fietsers, voetgangers, borden op palen, markering, bedoelingspijlen en volgordebadges. De taal staat in `content/schema/SCENES.md`; `preview.html` toont alle tekeningen naast elkaar, `?s=S-U03` filtert op blok.

De koppeling: telefoon en computer lopen gelijk via een koppelcode van 26 tekens in de kopregel `x-learner`. Supabase-project `bgxirhzdcntzmtvywmxf`, tabellen en policy in `_tools/supabase.sql`, sleutels in `js/config.js`. De policy is getest: zonder code krijg je niets, met een andere code krijg je niets, en een insert die over een andere leerling liegt wordt geweigerd. Een workflow pingt het project twee keer per week zodat de gratis tier niet in slaap valt.

De borden: 200 tekeningen in `assets/signs.svg`, uit de MIT-set van NDW plus de gaten van Wikimedia Commons. `content/signs/manifest.json` heeft 347 regels uit hoofdstuk 14 met betekenis, bron en nearMiss-lijsten.

De feiten: `content/facts/registry.json` heeft 233 getallen, elk met een letterlijk anker in boek of cursus. `feiten-en-cijfers.md` in de Rijbewijs-map is daaruit gegenereerd; `content/facts/REGISTRY-NOTES.md` somt op wat er uit het oude stampblad verdween en waar het boek iets anders zegt.

## De inhoud

| Blok | Titel | Stand |
|---|---|---|
| 0 | Zo denkt het examen | 3 leespagina's, geen quiz, af |
| 1 | Begrippen: wie en wat | 4 pagina's, 24 vragen, gecheckt en live |
| 2 | Verkeerstekens en rangorde | 5 pagina's, 24 geschreven plus 48 gegenereerde bordvragen, gecheckt en live |
| 3 | Voorrang op kruispunten | 5 pagina's, 36 vragen, 29 tekeningen, gecheckt en live |
| 4 | Voor laten gaan en afslaan | 6 pagina's, 36 vragen, 36 tekeningen waarvan 35 in gebruik, gecheckt en live |
| 5 | Rotondes, uitritten, erf en 30-zone | 4 pagina's, 36 vragen, 30 tekeningen, gecheckt en live |
| 6 | Snelheid, afstand en remmen | 6 pagina's, 38 geschreven plus 2 gegenereerd, 7 tekeningen, gecheckt en live |
| 7 | Plaats op de weg en inhalen | 7 pagina's, 36 geschreven plus 24 gegenereerd, 16 tekeningen, gecheckt en live |
| 8 | Autoweg en autosnelweg | 6 pagina's, 38 geschreven plus 24 gegenereerd, 1 tekening, gecheckt en live |
| 9 | Overwegen, haltes, bruggen en tunnels | 6 pagina's, 36 geschreven plus 12 gegenereerd, 8 tekeningen, gecheckt en live |

## Het eerste wat moet gebeuren

**Blok 10 tot en met 14 schrijven.** Op 11 september zijn de blokken 6 tot en met 9 in een middag geschreven en gecheckt, vier schrijvers en vier checkers naast elkaar. De bank staat op 418 vragen en tien van de zestien blokken zijn speelbaar. Wat er nog moet:

- blok 10 stilstaan en parkeren (boek 10.1 t/m 10.4, 9.1, 9.2; slides 158, 159, 181 t/m 185)
- blok 11 licht, signalen en weer (boek 11.1 t/m 11.5; slides 197 t/m 208)
- blok 12 file, pech en ongeval (boek 10.5 t/m 10.8; slides 186 t/m 194)
- blok 13 de bestuurder en de wet (boek 1.1 t/m 1.4, 2.1, 2.6 t/m 2.8)
- blok 14 voertuig, lading, aanhanger en milieu (boek 13.1 t/m 13.8, 12.1 t/m 12.4)
- blok 15 bordenconsolidatie, grotendeels gegenereerd uit het manifest
- derde batches voor blok 1 en 2, die nog op 24 staan, en blok 3 naar 60

Daarnaast staat uit fase 2 nog open: het oefenexamen met 52 vragen in 30 minuten en het examenklaar-lampje, de bordencatalogus met detailvenster, de weekweergave op Route, de getalvraag met varianten, en de renderer uitbreiden.

### Hoe die middag werkte, voor wie het overdoet

Vier schrijvers tegelijk, elk op een eigen blok, elk met exacte regelnummers in de twee transcripties en een schrijversbrief die de valkuilen opsomt. Daarna vier checkers, ook parallel, ook elk op een eigen blok. Dat is ongeveer drie tot vier keer sneller dan blok voor blok, en de kwaliteit blijft staan omdat de checker een ander is dan de schrijver.

Twee dingen die daarbij misgaan als je niet oplet:

- **Bouw niet in dezelfde map terwijl er schrijvers draaien.** Hun halve bestanden belanden dan in de precache. Zet er een worktree naast met `git worktree add --detach <pad> HEAD`, bouw daar, en kopieer `content/index.json`, `sw.js` en `sw-assets.js` terug.
- **Merge pas als alle blokken van de ronde klaar zijn.** Een unit-bestand zonder gemergede vragen komt wel in `content/index.json` terecht, dus de app zou een blok tonen met leespagina's en nul vragen.

Alle vier de schrijvers meldden onafhankelijk dat de paginanummers uit hun opdracht net naast de werkelijkheid zaten: een sectie begint vaak in het paginablok ervoor. Geef een schrijver dus regelnummers, die kloppen wel, en laat hem de pagina zelf opzoeken.

## Wat een nieuwe computer nodig heeft

1. `git clone https://github.com/Beebzoo/44-van-de-50.git`
2. De twee transcripties staan bewust niet in de repo. Kopieer `VekaBest-theorieboek-VOLLEDIG.md` en `VekaBest-SpeedTheorie-transcriptie.md` naar de nieuwe computer en zet het pad erbij in `_tools/sources.json`. Elke bron daarin is een lijst paden en de eerste die echt bestaat wint, dus je zet je eigen pad erbij en gooit dat van de andere computer niet weg. Zonder die bestanden slaat de validator de brongates stil over en kan er geen inhoud geschreven of gecheckt worden.
3. Node 22 of nieuwer. Verder niets: geen framework, geen bundler, geen npm-install (svgo wordt via npx gehaald en alleen bij het importeren van borden gebruikt).

## Hoe de inhoud gemaakt wordt

Schrijver, dan een aparte checker, dan `merge-batch.js`. Draaien er meerdere schrijvers tegelijk in dezelfde map, bouw dan niet in die map: hun halve bestanden komen dan in de precache terecht. Zet er een worktree naast met `git worktree add --detach <pad> HEAD`, draai `build.js` daar, en kopieer `content/index.json`, `sw.js` en `sw-assets.js` terug. Geef een schrijver altijd exacte regelnummers in de twee transcripties en laat hem `validate.js` en `trace.js` draaien. Tekeningen worden eerst geschreven volgens `SCENES.md`, dan gerenderd en bekeken, en pas daarna worden de vragen vertrouwd.

Draai eerst `node _tools/check-scenes.js Uxx`. Dat script zoekt de zes dingen die de checkers van blok 3, 4 en 5 met de hand vonden en scheelt je het meeste zoekwerk. Wat het meldt is een vraag, geen oordeel; wat je bewust zo laat, zet je met een reden in `_tools/check-scenes-ack.json`. Daarna lees je zelf de vragen die het niet kan beoordelen.

Wat de checkers tot nu toe vonden, en waar de volgende op moet letten:

- De renderer tekent een voetganger of fietser dwars over de arm waarop hij staat. Blok 3 had zeven voetgangers op de verkeerde arm. Blok 5 had vijf vragen die "de rode auto" noemden terwijl de renderer elke auto grijs tekent.
- In de cursustranscriptie delen slides soms een blok, bijvoorbeeld "Slide 123 t/m 133". Een anker uit elke slide in dat bereik valideert dan tegen slide 123, dus schrijvers citeerden overal 123. Zet het nummer van de slide waar de zin echt staat. Blok 4 had er zes van; ze wezen in werkelijkheid naar 125, 126, 127, 131 en 132.
- Een anker dat over een opmaakhaakje loopt, zoals "alle **bestuurders** (in lichtblauw) die van rechts komen", lost nooit op. Houd een anker binnen een doorlopend stuk brontekst.
- Schrijvers maken regels strenger dan de bron. "Alleen als", "de enige toegestane reden" en dat soort woorden zijn bijna altijd te sterk.
- Schrijvers beschrijven in de stam wat ze voor zich zien in plaats van wat de tekening toont: bomen, geparkeerde auto's, iemand die met zijn gezicht naar de weg staat. Lees elke stam naast de tekening en schrap wat er niet staat.
- Blok 4 miste bij het inkorten een regel uit het boek: het aandachtspunt op p. 140 dat je duidelijk laat zien of je voor of achter de tegenligger langs gaat. Loop bij een ingekorte pagina het bronblok nog een keer na.

Bronconflicten staan in `content/conflicts.md`. De belangrijkste: boek p. 48 en p. 49 geven D6, D7 en J11 verkeerde codes (hoofdstuk 14 is leidend), en de boektranscriptie noemt de erfborden G7 en G8 terwijl de cursus en het manifest G5 en G6 zeggen.

## Daarna, uit het bouwplan

Fase 2 loopt tot zondag 4 oktober: blokken 6 tot en met 11, de renderer uitbreiden (turborotonde, invoegstroken, meer rijstroken), getalvragen, dashboardpictogrammen, het oefenexamen met 52 vragen in 30 minuten en het examenklaar-lampje, de bordencatalogus met detailvenster, en de weekweergave op Route. Fase 3 loopt tot 11 oktober: blokken 12 tot en met 14, derde batches, zes samengestelde oefenexamens. Vanaf 12 oktober geen nieuwe inhoud meer, alleen fixes.

## Huisregels

Geen em dashes, en dashes of dubbele streepjes, nergens, ook niet in code of commits. Nederlands, je-vorm, decimale komma, km/u, geen uitroeptekens. Commitberichten zijn gewone zinnen in Martijns stem, zonder attributieregel. Vaste id's voor elke unit, pagina, vraag en tekening; nooit hernummeren, wel uitzetten via `content/retired.json`. De cacheversie nooit met de hand ophogen, die komt uit de inhoud. Wel altijd `node _tools/build.js` draaien voordat je een inhoudswijziging commit: de workflow controleert of de gegenereerde bestanden nog bij de inhoud passen en zet de deploy anders op rood. Na elke push controleren of de deploy groen is.
