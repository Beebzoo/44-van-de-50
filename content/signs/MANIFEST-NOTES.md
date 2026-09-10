# MANIFEST-NOTES

Generated from `/home/alardus/Admin/09 Voertuig/Rijbewijs/bronnen/VekaBest-theorieboek-VOLLEDIG.md`, chapter 14 (lines 6584 to 7159), pages 238 to 255.
Build script: `/tmp/claude-1000/-home-alardus-Claude-Code/ce0e0ebd-ebba-4b05-8822-c6e13fedcddf/scratchpad/build-manifest.js` (scratchpad, not part of the app).

## Counts

- Total entries: 347
- Coded entries (code printed in the book): 202
- Uncoded entries (`zonderCode: true`, generated `ZC-...` ids): 145
- Rows dropped: 1 (see below)

## Families (lettered tables, pages 238 to 249)

| Letter | Naam | Coded | Uncoded |
|---|---|---|---|
| A | Snelheid | 5 | 4 |
| B | Voorrang | 7 | 0 |
| C | Geslotenverklaring | 38 | 0 |
| D | Rijrichting | 7 | 0 |
| E | Parkeren en stilstaan | 19 | 4 |
| F | Overige geboden en verboden | 22 | 0 |
| G | Verkeersregels | 16 | 4 |
| H | Bebouwde kom | 4 | 0 |
| J | Waarschuwing | 39 | 5 |
| K | Bewegwijzering | 14 | 2 |
| L | Informatie | 31 | 0 |

The J family carries an `opmerking` ("Alle J-borden zijn rode driehoeken met de punt omhoog...") because the book states this once above the table and the per-row `omschrijving` for J signs only names the symbol, not the shape. An app that renders J signs from `omschrijving` should show that note too.

## Groups (unlettered tables, pages 249 to 255)

| id | Naam | Entries | Pages |
|---|---|---|---|
| zones | Zoneborden | 14 | 249 |
| overige-aanduidingen | Overige aanduidingen | 23 | 250 |
| hectometer | Hectometerborden | 7 | 251 |
| onderborden | Onderborden | 45 | 251 tot 253 |
| wegwerkzaamheden | Wegwerkzaamheden | 18 | 253 tot 254 |
| markeringsborden | Markeringsborden | 11 | 254 |
| aanwijzingen | Aanwijzingen | 8 | 255 |

All group rows are uncoded in the book, so every group entry has a generated `ZC-<groepid>-<nn>` id and `zonderCode: true`.

The hectometer group (page 251) also holds the two rows of the second table on that page (bermpaaltjes and CADO), because they sit under the "3 Hectometer" heading in the book. The onderborden group carries an `opmerking` with the sentence the book prints above the category onderborden.

## Codes that appear twice

- `H1` (page 244, source line 6796): kept as a second entry with `variant: "toekomstig"`. Raw: `| **H1** | Blauw bord met de plaatsnaam `Stokkum` en daaronder een silhouet van een dorpsgezicht | *Bebouwde kom (toekomstig bord).* |`
- `H2` (page 244, source line 6797): kept as a second entry with `variant: "toekomstig"`. Raw: `| **H2** | Hetzelfde bord met een rode diagonale streep | *Einde bebouwde kom (toekomstig bord).* |`

The book prints the same code for the current bord and the future bord, so `code` is NOT unique for H1 and H2. An app that keys on `code` should key on `code` plus `variant`, or drop the two `variant: "toekomstig"` entries.

K2 is printed twice on page 246 but only once in the manifest; see the dropped row below.

## Dropped rows

- Page 246, source line 6866: the Betekenis cell is only a transcriber note, so the row has no meaning to learn. Raw: `| **K2** | Blauw bord met `A12` (rood) en `E35` (groen) en een lijst doelen met afstanden: `Den Haag 44`, `Apeldoorn 23`, `Utrecht 2`, `Breda 61`, `Rotterdam 58` | *(bij K1 afgebeeld als tweede paneel)* |`

## Rows whose Betekenis was copied from another row

The transcription marks these with `(idem)`, `(afgebeeld bij K2)` or `(bij het vorige bord afgebeeld)`. The manifest copies the meaning of the row named in `from`.

- Page 246, source line 6868, copied from `K2`. Raw: `| (geen code) | Blauw bord met `A12 Westervoort`, `N 28 Duiven Zevenaar`, `600 m` en een schematische afrit | *(afgebeeld bij K2)* |`
- Page 252, source line 7064, copied from `ZC-onderborden-27`. Raw: `| `geef ritser ruimte` | *(idem)* |`
- Page 252, source line 7065, copied from `ZC-onderborden-28`. Raw: `| `ritsen vanaf hier` | *(idem)* |`
- Page 253, source line 7105, copied from `ZC-wegwerkzaamheden-07`. Raw: `| Geel bord met een slingerende pijl en `600m` | *(idem)* |`
- Page 254, source line 7132, copied from `ZC-markeringsborden-06`. Raw: `| Geel bord met `EXTRA LONG` en een pictogram van een lange combinatie tussen twee pijlen | *(idem)* |`
- Page 254, source line 7134, copied from `ZC-markeringsborden-08`. Raw: `| Wit bord met een rode `S` en `H` gescheiden door een rode diagonale streep | *(bij het vorige bord afgebeeld)* |`

## Rows I was unsure about

- Page 242, source line 6720: Code family L differs from the table family E; familie set from the code as rule 1 says. Raw: `| **L52** | Blauw vierkant met `K+R` en het onderschrift `halen en brengen` | *Gelegenheid voor het kort stilstaan om passagiers te brengen of op te halen.* |`
- Page 253, source line 7103: Betekenis was only a transcriber note in parentheses; replaced by the literal reading of the note. Raw: `| Hetzelfde bord met een diagonale streep | *(einde omleidingsroute voor vrachtauto's)* |`
- Page 240, C22e5 and C22e7: the Bord column literally reads "Idem, andere klassen gemarkeerd"; kept verbatim as the rule says, but it is not a usable drawing description on its own.
- Page 246, K family: K2 is printed twice; the first K2 row (a doelenbord with distances) only has the note "(bij K1 afgebeeld als tweede paneel)" and was dropped. The manifest K2 is the second row (voorwegwijzer afgaande richting).
- Page 251, onderborden, first row: the non-italic "(eerste twee)" and "(laatste twee)" are kept because they are not italic transcriber notes and they carry meaning.
- Page 255, aanwijzingen: the transcription marks this page with `## Pagina 255` only (no `### Pagina 255` line); the build script treats that single-page heading as the page marker, so these rows get `bron.boek` 255.
- Page 255, aanwijzingen: the table columns are Houding and Onderschrift; Houding went into `omschrijving`, Onderschrift into `betekenis`.

## House-rule edits to the book text

- No en or em dashes were present in chapter 14; nothing had to be replaced.
- Exclamation marks removed from 5 rows (LET OP, let op bussluis, zwaailicht? maak ruimte, LET OP EXTRA LANG):
  - Page 246, source line 6859: `| (geen code) | Geel bord met `LET OP!` en een pictogram van een snorfietser | *Opvallende waarschuwing voor snorfietsers op de rijbaan.* |`
  - Page 249, source line 6937: `| **L205** | Blauw bord met `let op ! bussluis` en een auto die in een verzakking valt | *Waarschuwing voor vastrijden in verband met een bussluis.* |`
  - Page 249, source line 6938: `| **L213** | Blauw bord met `zwaailicht? maak ruimte!` en auto's die naar de zijkanten uitwijken met een hulpverleningsvoertuig ertussen | *Maak ruimte zodat de hulpdiensten middendoor tussen de rijstroken kunnen rijden.* |`
  - Page 253, source line 7106: `| Geel bord met `zwaailicht? maak ruimte!` en auto's die uitwijken | *Maak ruimte zodat de hulpdiensten middendoor tussen de rijstroken kunnen rijden (tijdelijk bord).* |`
  - Page 254, source line 7131: `| Geel bord met oranje rand en `LET OP! EXTRA LANG` | *Markeringsbord voor lange zware voertuigcombinaties (LZV's).* |`
- Markdown emphasis (`*`, `**`) and code spans (backticks) were stripped from both text columns. Nothing else was reworded.

## nearMiss

- Every coded sign has 1 to 3 nearMiss codes. The pairs the briefing listed are all linked (checked by the build script). Beyond those, a few cross-family classics were added: F5/J29 (tegenliggers), J9/D1 (rotonde), L1/C19 (hoogte), F10/C2, F9/A3, C22f/F8, and L52 points at E12/E4 because it sits in the E table.
- L52 (K+R) is printed inside the E table on page 242; `familie` is "L" per rule 1 (leading letter).
- Uncoded entries got nearMiss where a natural pair exists (begin/einde, same pictogram with and without stripe, the three tankstation signs, and so on). Uncoded entries without an obvious partner have an empty list.

