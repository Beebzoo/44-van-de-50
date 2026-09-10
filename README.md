# 44 van de 50

Studie-app voor het CBR theorie-examen B. Lezen, quizzen, uitleg bij elk antwoord. Draait als PWA op de telefoon en op de computer, ook zonder bereik.

Live: https://beebzoo.github.io/44-van-de-50/

## Hoe het werkt

Zestien blokken in leervolgorde. Elk blok heeft leespagina's en een pool vragen. Een quiz is een steekproef van 12 uit die pool, gewogen naar wat je het minst gezien of eerder fout hebt gehad. Een blok is gehaald na twee foutloze quizzen met minstens 12 uur ertussen en hooguit 4 dezelfde vragen, en als elke vraag uit de pool minstens een keer goed is beantwoord. Twijfel telt als fout.

Alles wat je doet staat in een logboek van pogingen op het apparaat (IndexedDB). Voortgang, ontgrendeling en de foutenlijst worden daaruit afgeleid. Koppelen tussen telefoon en computer komt in fase 1.

## Bronnen

Alle inhoud komt uit twee transcripties van VekaBest-lesmateriaal (het theorieboek en de online SpeedTheorie). Elke regel en elke vraag citeert een pagina of slide met een letterlijk anker dat de validator terugvindt. De transcripties zelf staan niet in deze repo.

## Bouwen

```
node _tools/build.js        valideren, bordvragen genereren, index en precache-lijst schrijven
node _tools/validate.js     alleen de twaalf kwaliteitspoorten
node _tools/trace.js U01-Q003   laat zien waar een vraag zijn bewijs vandaan haalt
node _tools/merge-batch.js content/questions/U01/batch-01.json   gecheckte batch in de bank
```

De cacheversie in `sw.js` en `sw-assets.js` is een hash van de inhoud. Nooit met de hand ophogen.

## Mappen

| Map | Wat |
|---|---|
| `js/` | de app: `app.js` (state en render), `router.js`, `store.js`, `quiz.js`, `lezen.js`, `signs.js`, `voortgang.js` |
| `content/units/` | leespagina's per blok |
| `content/questions/` | geschreven batches, onveranderlijk |
| `content/bank/` | gevalideerde vragenpools |
| `content/generated/` | bordvragen, gegenereerd uit het bordenregister |
| `content/signs/` | het bordenregister uit hoofdstuk 14 van het boek |
| `content/facts/` | het feitenregister: elk getal met zijn bron |
| `content/schema/` | de vormen van unit, vraag, scene en bron |
| `assets/borden/` | een genormaliseerd SVG-bestand per bord |
| `assets/signs.svg` | de sprite, gegenereerd |
| `_tools/` | build, validator, merge, trace, ophaalscripts |

## Huisregels

Geen em dashes, en dashes of dubbele streepjes, nergens. Nederlands, je-vorm, decimale komma, km/u, geen uitroeptekens. Vaste id's voor elke unit, pagina en vraag; nooit hernummeren, wel uitzetten via `content/retired.json`. Na elke push controleren of de deploy groen is.
