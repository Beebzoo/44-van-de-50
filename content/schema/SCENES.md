# Scenes schrijven

Een scene is een JSON-bestand in `content/scenes/`, id `S-Uxx-nnn` (of `S-Uxx-nnn-a`, `-b`, `-c` voor de frames van een reeks). De app tekent hem als een bovenaanzicht, 4:3, in asfaltkleuren. De witte auto ben jij, altijd, met een klein blauw "jij"-merkje. Andere auto's zijn grijs, de tram geel, fietsers groen, voetgangers donker.

Je typt geen coördinaten. Je zegt op welke arm iemand staat, hoe ver van het kruispunt, en wat hij van plan is.

## Velden

| Veld | Wat |
|---|---|
| `vorm` | `plus` (vier armen), `T` (drie armen, noem ze in `armen`), `rotonde`, `uitrit` (doorgaande weg noord-zuid met een uitrit aan de oostkant), `recht` (een rechte weg zonder kruispunt) |
| `armen` | welke armen bestaan: `noord`, `oost`, `zuid`, `west`. Jij komt bijna altijd van `zuid` (van onderen) |
| `voorrang` | `gelijkwaardig`, `voorrangsweg`, `voorrangskruispunt`, `afbuigend`, `verkeerslichten`, `uitrit`. Alleen informatief; de borden en markering bepalen wat je ziet |
| `hoofdweg` | bij voorrangsweg of afbuigende voorrang: de armen die de voorrangsweg vormen, bijvoorbeeld `["noord","zuid"]` of `["zuid","oost"]` |
| `onverhard` | armen die onverhard zijn (getekend als zandweg) |
| `fietspad` | armen met een vrijliggend fietspad ernaast; werkt ook op een `recht`e weg |
| `borden`. Met `"onderbord": "verloop voorrangsweg"` komt er een wit plaatje onder waarop het verloop van de `hoofdweg` getekend staat | `{"code": "B6", "arm": "zuid"}`: het bord staat rechts van die arm, vlak voor het kruispunt, gericht naar wie op die arm nadert |
| `markering` | `{"soort": "haaientanden", "arm": "zuid"}`; soorten: `haaientanden`, `stopstreep`, `zebrapad`, `fietsoversteek`, `drempel`, `blokmarkering`, `fietsstrook` (rode strook met een onderbroken streep), `fietsstrook-doorgetrokken` (dezelfde strook met een doorgetrokken streep), `rails` (tramrails over die arm en over het kruispunt), `verdrijvingsvlak` |
| `actoren` | zie hieronder |
| `volgorde` | actor-ids in de volgorde waarin ze mogen gaan; de app tekent genummerde blauwe rondjes. Zet `toonVolgorde: false` als de vraag juist om die volgorde vraagt |
| `alt` | een of twee zinnen die de tekening beschrijven, voor de checker en voor wie de tekening niet ziet |
| `inspiratie` | vrij: `{"boek": 106, "beeld": "foto rechtsonder"}` of `{"slide": 123}` |

## Actoren

```json
{"id": "ego", "soort": "auto", "arm": "zuid", "richting": "rechtdoor", "afstand": 1}
```

- `id`: precies een actor heet `ego` (jij). De rest krijgt korte ids: `tram`, `grijs`, `fietser`, `motor`, `voetganger`.
- `soort`: `auto`, `bestelauto`, `vrachtauto`, `bus`, `tram`, `motorfiets`, `bromfiets`, `fiets`, `voetganger`, `ruiter`, `hulpdienst` (voorrangsvoertuig), `colonne`.
- `arm`: de arm waarop de actor het kruispunt nadert. Een `fiets` of `voetganger` op een fietspad of stoep krijgt de arm van de weg plus `"zijde": "rechts"` of `"links"` (gezien in de rijrichting van die arm). Op een rotonde: `"arm": "rotonde"` met `"hoek"` in graden (0 is noord, met de klok mee) en eventueel `"uitgang"`.
- `richting`: `rechtdoor`, `links`, `rechts`, `keren`, `stil`. Links en rechts zijn de bedoeling van de actor, gezien vanuit de actor. De app tekent een stippellijn met een pijl.
- `afstand`: 1 (vlak voor het kruispunt), 2 (midden), 3 (ver). Standaard 1.
- `signaal`: `links` of `rechts` als de richtingaanwijzer aanstaat en dat ertoe doet.
- `label`: de naam in een volgorde-vraag, bijvoorbeeld `"de tram"`, `"de grijze auto"`, `"jij"`.

## Drie voorbeelden

Gelijkwaardig kruispunt, tram van links, grijze auto van rechts (boek p. 105 en 112, slides 115 t/m 118):

```json
{
  "id": "S-VB-001", "vorm": "plus", "voorrang": "gelijkwaardig",
  "armen": ["noord", "oost", "zuid", "west"],
  "markering": [{"soort": "rails", "arm": "west"}, {"soort": "rails", "arm": "oost"}],
  "actoren": [
    {"id": "ego", "soort": "auto", "arm": "zuid", "richting": "rechtdoor", "label": "jij"},
    {"id": "tram", "soort": "tram", "arm": "west", "richting": "rechtdoor", "label": "de tram"},
    {"id": "grijs", "soort": "auto", "arm": "oost", "richting": "rechtdoor", "label": "de grijze auto"}
  ],
  "volgorde": ["tram", "grijs", "ego"], "toonVolgorde": false,
  "alt": "Gelijkwaardig kruispunt zonder borden. Jij komt van onderen en gaat rechtdoor. Van links nadert een tram, van rechts een grijze auto."
}
```

Jij nadert met haaientanden, auto van links op de voorrangsweg:

```json
{
  "id": "S-VB-002", "vorm": "plus", "voorrang": "voorrangsweg", "hoofdweg": ["west", "oost"],
  "armen": ["noord", "oost", "zuid", "west"],
  "borden": [{"code": "B6", "arm": "zuid"}, {"code": "B1", "arm": "west"}],
  "markering": [{"soort": "haaientanden", "arm": "zuid"}, {"soort": "haaientanden", "arm": "noord"}],
  "actoren": [
    {"id": "ego", "soort": "auto", "arm": "zuid", "richting": "links"},
    {"id": "grijs", "soort": "auto", "arm": "west", "richting": "rechtdoor", "afstand": 2}
  ],
  "alt": "Je nadert een voorrangsweg. Voor je liggen haaientanden en rechts staat bord B6. Van links komt een grijze auto over de voorrangsweg. Je wilt linksaf."
}
```

Rotonde met fietser in de voorrang:

```json
{
  "id": "S-VB-003", "vorm": "rotonde", "voorrang": "voorrangsweg",
  "armen": ["noord", "oost", "zuid", "west"], "fietspad": ["noord", "oost", "zuid", "west"],
  "borden": [{"code": "B6", "arm": "zuid"}, {"code": "D1", "arm": "rotonde"}],
  "markering": [{"soort": "haaientanden", "arm": "zuid"}, {"soort": "fietsoversteek", "arm": "oost"}],
  "actoren": [
    {"id": "ego", "soort": "auto", "arm": "rotonde", "hoek": 150, "richting": "rechts", "uitgang": "oost"},
    {"id": "fietser", "soort": "fiets", "arm": "oost", "zijde": "rechts", "richting": "rechtdoor", "afstand": 1}
  ],
  "alt": "Je rijdt op een rotonde en wilt er bij de oostelijke arm af. Op het fietspad rond de rotonde nadert een fietser de oversteek van die arm. Voor jou liggen haaientanden bij het verlaten."
}
```

## Regels

- Precies een `ego`. Elke `arm` van een actor of bord staat in `armen` (of is `rotonde`, `uitrit`, `fietspad`).
- Bordcodes bestaan in `content/signs/manifest.json`.
- Geen streepjes, geen uitroeptekens in `alt`.
- Een reeks (dynamisch beeld) is 2 of 3 scenes met dezelfde `armen` en actor-ids, waarin alleen verandert wat in een paar seconden kan veranderen: `afstand`, `hoek`, `richting` of `signaal`. Een nieuwe actor introduceren mag niet, want dan kijkt de leerling naar twee verschillende situaties in plaats van naar twee momenten: `S-U04-007-a`, `-b`, `-c`. De vraag verwijst ernaar met `"media": {"reeks": ["S-U04-007-a", "S-U04-007-b", "S-U04-007-c"]}`.
- Een volgorde-vraag verwijst naar een scene met `volgorde` en `toonVolgorde: false`; de `opties` van de vraag zijn de actor-ids met hun `label` als tekst en `correct` is de volgorde.
