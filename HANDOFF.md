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

Alle zestien blokken zijn geschreven en gecheckt. Veertien van de vijftien
blokken met een quiz halen het aantal geschreven vragen dat het bouwplan ervoor
vraagt; blok 15 staat op 18 van de 60 en dat blijft een keuze, want het heeft
290 gegenereerde bordvragen in zijn pool.

| Blok | Titel | Vragen |
|---|---|---|
| 0 | Zo denkt het examen | leespagina's, geen quiz |
| 1 | Begrippen: wie en wat | 36 geschreven |
| 2 | Verkeerstekens en rangorde | 36 geschreven plus 86 gegenereerd |
| 3 | Voorrang op kruispunten | 60 geschreven plus 12 gegenereerd, 41 tekeningen |
| 4 | Voor laten gaan en afslaan | 36 geschreven plus 2 gegenereerd, 36 tekeningen |
| 5 | Rotondes, uitritten, erf en 30-zone | 36 geschreven plus 6 gegenereerd, 30 tekeningen |
| 6 | Snelheid, afstand en remmen | 38 geschreven plus 18 gegenereerd, 7 tekeningen |
| 7 | Plaats op de weg en inhalen | 60 geschreven plus 30 gegenereerd, 22 tekeningen |
| 8 | Autoweg en autosnelweg | 38 geschreven plus 32 gegenereerd |
| 9 | Overwegen, haltes, bruggen en tunnels | 36 geschreven plus 22 gegenereerd, 8 tekeningen |
| 10 | Stilstaan en parkeren | 36 geschreven plus 10 gegenereerd, 8 tekeningen |
| 11 | Licht, signalen en weer | 36 geschreven |
| 12 | File, pech en ongeval | 36 geschreven, 6 tekeningen |
| 13 | De bestuurder en de wet | 36 geschreven |
| 14 | Voertuig, lading, aanhanger en milieu | 39 geschreven plus 4 gegenereerd |
| 15 | Alle borden op een rij | 18 geschreven plus 290 gegenereerd |

Blok 3, 4 en 5 zijn twee keer door een checker gegaan. De tweede ronde vond in
die drie blokken samen achttien dingen, waaronder twee afleiders die bij nader
inzien gewoon waar waren.

## Het eerste wat moet gebeuren

De inhoud is klaar. Wat er nog ligt is app-werk en aankleding, in de volgorde
waarin het de meeste waarde heeft:

1. **De vier losse diagrammen** uit het bouwplan: remweg en stopafstand met een
   snelheidsschuif, de dode hoek, andreaskruisen en de handsignalen. Geen van
   vier bestaat, en het zijn precies de dingen die je niet uit tekst leert.
2. **De renderer uitbreiden**: verkeerslichten, voorsorteerstroken en pijlen op
   het wegdek, meer dan een rijstrook per richting, invoegstroken, turborotonde.
   Daar hangt inhoud aan vast. Blok 8 heeft 38 vragen en nauwelijks een
   tekening, blok 7 heeft er vier over invoegen en ritsen zonder beeld, en
   U04-Q026 raakte zijn tekening kwijt omdat de renderer geen voorsorteerpijl
   kan zetten.
3. **Zes samengestelde oefenexamens** met een vaste mix. De motor staat er, dus
   dit is nog het samenstellen van zes vaste sets in plaats van steeds opnieuw
   trekken.
4. **De weekweergave op Route**: gepland tegenover werkelijk, minuten,
   simulaties, zwakste onderwerp.
5. **27 bordcodes hebben geen tekening** in `assets/borden`, waaronder alle
   C22e-onderborden voor milieuzones en de hele E8-reeks. Die kunnen in geen
   enkele gegenereerde bordvraag terecht. `node _tools/build.js` noemt ze bij
   naam onder "zonder tekening".

Wat je verder moet weten over de staat van het gereedschap:

- `_tools/check-scenes.js` is het tweede paar ogen van de checker en vindt
  negen soorten fouten die eerder met de hand gezocht werden. Draai hem altijd
  voordat je zelf begint. Wat je bewust zo laat, zet je met een reden in
  `_tools/check-scenes-ack.json`.
- `_tools/schermen.js` fotografeert elk scherm en vindt de browser zelf op
  Windows en Linux. Gebruik hem om te kijken of iets echt werkt in plaats van
  erop te hopen. Start er een lokale server bij, bijvoorbeeld op poort 8765.
  Vlaggen: `licht` of `donker` (zonder een van beide kiest de headless browser
  zelf, en dat is donker), `breed`, `enkel`, en `vrij`. Die laatste zaait eerst
  een foutloze ronde per blok in het wegwerpprofiel, zodat de quiz- en
  examenschermen echt iets tonen in plaats van "nog geen quiz". Draai twee
  rondes niet tegelijk in dezelfde map, want ze schrijven in elkaars uitvoer.
- Het oefenexamen trekt zijn 52 vragen alleen uit vrijgespeelde blokken, dus op
  een leeg profiel kun je er geen doen. Dat is met opzet.

### Nederlands en Engels

De app kent twee talen. Rechtsboven in de kopbalk staat NL | EN, en dezelfde
keuze staat in Instellingen. De keuze wordt bewaard als instelling en ook in
localStorage, zodat de taal al goed staat voordat de eerste verf op het scherm
komt.

Wat er vertaalt en wat niet, en dat is met opzet:

- **De schil is tweetalig.** Elke zin in de code gaat door `t()` in
  `js/taal.js`, met de Nederlandse zin als sleutel. Staat een zin niet in het
  woordenboek, dan blijft hij Nederlands: de app kan nooit een lege knop of een
  sleutel tonen. `node _tools/build.js` noemt bij naam welke zinnen nog geen
  Engelse tegenhanger hebben.
- **De leespagina's zijn tweetalig.** Het Nederlands in `content/units/` is de
  bron, en `content/units-en/UXX.json` is een overlay: dezelfde pagina's,
  dezelfde blokken in dezelfde volgorde, alleen de te vertalen velden. De app
  legt ze op index over elkaar heen. Ontbreekt een blok, een pagina of een heel
  bestand, dan staat daar het Nederlands.
- **De vragen, hun uitleg en de bordbetekenissen blijven Nederlands**, in beide
  talen. Dat zijn de woorden waarop het CBR toetst, en Martijn doet het examen
  in het Nederlands. Wie dat ooit wil omgooien: het is een tweede overlay naast
  `content/bank/`, met dezelfde gedachte.

Gereedschap: `node _tools/check-en.js U07` kijkt één overlay na tegen de
Nederlandse pagina (vorm, aantal blokken, dezelfde getallen, dezelfde
bordcodes, niets dat Nederlands bleef). Zonder argument doet hij alle blokken.
Het is geen poort in de bouw, want de terugval op Nederlands is veilig; het is
de checklist voor wie vertaalt. De vertaalbrief die de vertalers kregen staat
in de scratchpad van die ronde en is het waard om opnieuw te schrijven als er
ooit een tweede taal bij komt.

### Hoe de parallelle rondes werkten

Schrijvers en checkers draaien naast elkaar, elk op een eigen blok, elk met
exacte regelnummers in de twee transcripties. Dat is drie tot vier keer sneller
dan blok voor blok en de kwaliteit blijft staan omdat de checker een ander is
dan de schrijver. Drie dingen die daarbij misgaan als je niet oplet:

- **Bouw niet in dezelfde map terwijl er schrijvers draaien.** Hun halve
  bestanden belanden dan in de precache. Zet er een worktree naast met
  `git worktree add --detach <pad> HEAD`, bouw daar, en kopieer
  `content/index.json`, `sw.js` en `sw-assets.js` terug.
- **Merge pas als alle blokken van de ronde klaar zijn**, anders toont de app een
  blok met leespagina's en nul vragen.
- **Kijk naar de exitcode van build.js, niet naar het woord Gehaald in zijn
  uitvoer.** Dat woord komt van de validator die erin draait; de bouw kan daarna
  alsnog stoppen. Ik heb daar een keer een rode deploy mee veroorzaakt.

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
