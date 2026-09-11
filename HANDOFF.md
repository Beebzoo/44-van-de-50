# Waar we zijn en wat er nog moet

Bijgewerkt op vrijdag 11 september 2026. Dit bestand staat in de repo, zodat een nieuwe sessie op elke computer weet waar hij instapt. Lees ook `README.md` voor hoe de app werkt en `/home/alardus/Admin/09 Voertuig/Rijbewijs/app-plan/BOUWPLAN.md` voor het plan van record.

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
| 4 | Voor laten gaan en afslaan | 6 pagina's, 36 vragen, 36 tekeningen, **nog niet gecheckt** |
| 5 | Rotondes, uitritten, erf en 30-zone | 4 pagina's, 36 vragen, 30 tekeningen, gecheckt en live |

## Het eerste wat moet gebeuren

**Blok 4 door de checker halen.** De vragen staan in `content/questions/U04/batch-01.json` tot `batch-03.json`, allemaal nog op `status: concept`. De checkerronde is twee keer afgebroken door een limiet en heeft niets opgeslagen. De opdracht staat hieronder onder "De checkerprompt". Daarna:

```
node _tools/merge-batch.js content/questions/U04/batch-01.json   (en 02, 03)
node _tools/build.js
git add -A && git commit -m "..." && git push
gh run list -R Beebzoo/44-van-de-50 --limit 3     moet groen zijn
```

## Wat een nieuwe computer nodig heeft

1. `git clone https://github.com/Beebzoo/44-van-de-50.git`
2. De twee transcripties staan bewust niet in de repo. Kopieer `VekaBest-theorieboek-VOLLEDIG.md` en `VekaBest-SpeedTheorie-transcriptie.md` uit `/home/alardus/Admin/09 Voertuig/Rijbewijs/bronnen/` en zet de paden goed in `_tools/sources.json`. Zonder die bestanden slaat de validator de brongates stil over en kan er geen inhoud geschreven of gecheckt worden.
3. Node 22 of nieuwer. Verder niets: geen framework, geen bundler, geen npm-install (svgo wordt via npx gehaald en alleen bij het importeren van borden gebruikt).

## Hoe de inhoud gemaakt wordt

Schrijver, dan een aparte checker, dan `merge-batch.js`. Geef een schrijver altijd exacte regelnummers in de twee transcripties en laat hem `validate.js` en `trace.js` draaien. Tekeningen worden eerst geschreven volgens `SCENES.md`, dan gerenderd en bekeken, en pas daarna worden de vragen vertrouwd.

Wat de checkers tot nu toe vonden, en waar de volgende op moet letten:

- De renderer tekent een voetganger of fietser dwars over de arm waarop hij staat. Blok 3 had zeven voetgangers op de verkeerde arm. Blok 5 had vijf vragen die "de rode auto" noemden terwijl de renderer elke auto grijs tekent.
- In de cursustranscriptie delen slides soms een blok, bijvoorbeeld "Slide 123 t/m 133". Een anker uit elke slide in dat bereik valideert dan tegen slide 123, dus schrijvers citeerden overal 123. Zet het nummer van de slide waar de zin echt staat.
- Een anker dat over een opmaakhaakje loopt, zoals "alle **bestuurders** (in lichtblauw) die van rechts komen", lost nooit op. Houd een anker binnen een doorlopend stuk brontekst.
- Schrijvers maken regels strenger dan de bron. "Alleen als", "de enige toegestane reden" en dat soort woorden zijn bijna altijd te sterk.

Bronconflicten staan in `content/conflicts.md`. De belangrijkste: boek p. 48 en p. 49 geven D6, D7 en J11 verkeerde codes (hoofdstuk 14 is leidend), en de boektranscriptie noemt de erfborden G7 en G8 terwijl de cursus en het manifest G5 en G6 zeggen.

## Daarna, uit het bouwplan

Fase 2 loopt tot zondag 4 oktober: blokken 6 tot en met 11, de renderer uitbreiden (turborotonde, invoegstroken, meer rijstroken), getalvragen, dashboardpictogrammen, het oefenexamen met 52 vragen in 30 minuten en het examenklaar-lampje, de bordencatalogus met detailvenster, en de weekweergave op Route. Fase 3 loopt tot 11 oktober: blokken 12 tot en met 14, derde batches, zes samengestelde oefenexamens. Vanaf 12 oktober geen nieuwe inhoud meer, alleen fixes.

## Huisregels

Geen em dashes, en dashes of dubbele streepjes, nergens, ook niet in code of commits. Nederlands, je-vorm, decimale komma, km/u, geen uitroeptekens. Commitberichten zijn gewone zinnen in Martijns stem, zonder attributieregel. Vaste id's voor elke unit, pagina, vraag en tekening; nooit hernummeren, wel uitzetten via `content/retired.json`. De cacheversie nooit met de hand ophogen, die komt uit de inhoud. Na elke push controleren of de deploy groen is.

## De checkerprompt voor blok 4

Geef dit aan een subagent (of doe het zelf):

> Je bent de CHECKER voor blok 4 van "44 van de 50", de studie-app voor het CBR theorie-examen B. Blok 4 is "Voor laten gaan en afslaan". Er liggen 6 leespagina's, 36 vragen in drie batches en 36 tekeningen. Controleer alles tegen de brontekst en tegen de tekeningen, herstel wat fout is, en markeer wat je geverifieerd hebt. Werk op volgorde en sla na elke batch op.
>
> Bestanden: `content/questions/U04/batch-01.json` tot `batch-03.json` (U04-Q001 tot Q036), `content/units/U04.json` (U04-P01 tot P06), `content/scenes/S-U04-*.json` inclusief de reeksparen `-a` en `-b`. Lees `content/schema/question.json` en `content/schema/SCENES.md`.
>
> Bronnen, de enige waarheid: boek `VekaBest-theorieboek-VOLLEDIG.md` sectie 6.3 (regels 3102 tot 3134, p. 111 tot 112), 9.3 tot 9.5 (3775 tot 3910, p. 135 tot 140), 8.1 (3548 tot 3653, p. 127 tot 131), 5.5 (2584 tot 2622, p. 91 tot 92), 6.5 (3166 tot 3241, p. 114 tot 116); cursus `VekaBest-SpeedTheorie-transcriptie.md` slide 91, 105 tot 108, 119 tot 121, het blok "Slide 123 t/m 133", 151 tot 154 en 160 tot 164. `node _tools/trace.js U04-Q016` toont de geciteerde blokken met het anker gemarkeerd.
>
> Per vraag: zoek de zin die de sleutel juist maakt; lees de tekening waar de vraag naar wijst en controleer dat die toont wat de vraag aanneemt; bevestig dat elke afleider echt fout is; controleer elk fouttype; controleer dat de feedback klopt, dat `uitleg.regel` de boekwoorden volgt en dat `uitleg.waarom` echte redenering is; bij een volgordevraag: `correct` is exact de `volgorde` van de tekening en de optie-ids zijn de actor-ids; herijk `moeilijkheid`; zet `status` op `gecheckt` met een `checker`-blok met een letterlijk citaat van 6 tot 30 woorden en de bron; nooit een vraag weggooien of hernummeren.
>
> Let vooral op Q016 (uitvaartstoet bij groen licht, p. 116), Q027 (colonne doorsnijden op een voorrangsweg, p. 115), Q024 optie c (stoppen op een kruispunt; het boek noemt twee gevallen, slide 105 er drie), Q019 (de opsomming blinden, slechtzienden en mensen die zich moeilijk voortbewegen komt alleen van slide 152), Q003 (voetganger die stilstaat) en Q017 ("waar let je vooral op" bij een T-kruising). De schrijver heeft alle zes pagina's ingekort en een voorbeeld, een regel en een callout geschrapt: controleer of er niets wezenlijks weg is.
>
> Huisregels: Nederlands, je-vorm, decimale komma, km/u, geen uitroeptekens, geen em dashes, en dashes of dubbele streepjes, geen Engelse woorden. Ankers zijn letterlijke stukken van 6 tot 15 woorden uit het geciteerde blok.
>
> Valideer onderweg: `node _tools/validate.js content/questions/U04/batch-01.json` na elke batch en `node _tools/validate.js` voor de hele bank. Alles moet "Gehaald" met 0 fouten geven. Draai `merge-batch.js` niet en commit niet.
