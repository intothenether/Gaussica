# Gaussica

Ett svenskspråkigt, webbaserat matematikkursprojekt som bygger förståelse från
grunden och framåt. Målet är att täcka matematik från grundskolans årskurs 3
till gymnasiets årskurs 3 utan att göra årskursindelningen till kursens ryggrad.

## Produktidé

Eleven följer en begriplig väg genom matematiska idéer. Varje nytt moment
bygger på förkunskaper som eleven redan har tränat på. Årskurser används som
ungefärliga hållpunkter, inte som låsta kursgränser. Kurser ska gå att lägga
till och förbättra utan att behöva bygga om webbplatsen.

Webbplatsen:

- förklara matematiska idéer och regler med tydliga exempel,
- låta elever experimentera i interaktiva problem,
- ge återkoppling som förklarar varför en lösning inte fungerar och hur
  elevens resonemang kan förbättras,
- visa ett nätverk av lektioner och vilka idéer de bygger på,
- låta eleven välja vilken nod som helst eller följa pilarna i en föreslagen ordning,
- fungera utan AI som kärnfunktion,
- ha riktiga konton: elever och lärare loggar in och allt sparas i en databas på servern.

## Pedagogisk struktur

Innehållet organiseras efter sammanhängande matematiska områden och
förkunskaper, inte som en lista med årskurser:

1. **Tal och räkning** – antal, positionssystem, de fyra räknesätten,
   delbarhet, bråk, negativa tal, potenser och talmönster.
2. **Samband och algebra** – likhetstecknet, obekanta tal, uttryck, ekvationer,
   funktioner, förändring och modeller.
3. **Form och rum** – geometriska former, mätning, skala, koordinater,
   trigonometri och vektorer.
4. **Data och slump** – läsa och beskriva data, medelvärden, sannolikhet,
   kombinatorik och statistisk tolkning.

Områdena får flera nivåer från grundläggande förståelse till gymnasiets mer
avancerade innehåll. Ett moment kan ha flera förkunskaper och kan därför
kopplas till flera delar av lärstigarna. Åk 3–9 och gymnasiet åk 1–3 används
som ungefärliga referenser för lärare, elever och vårdnadshavare, inte som
krav på ordningsföljden.

## Så ska problemlösningen fungera

En uppgift ska hjälpa eleven att förstå, inte bara rätta ett svar. Vid ett
felaktigt svar ska återkopplingen vara kopplad till ett definierat
missuppfattningsmönster eller ett tydligt steg i resonemanget. Den bör:

1. visa vilket steg som behöver ses över,
2. förklara varför det inte fungerar,
3. ge en ledtråd eller ett konkret exempel,
4. låta eleven försöka igen innan lösningen visas.

Interaktiva uppgifter låter eleven ändra värden, undersöka exempel och se hur
matematiska samband förändras. En interaktiv modell ska komplettera
förklaringen och erbjuda ett sätt att resonera, inte bara avslöja rätt svar.

## Webbplatsens första prototyp

Webbplatsen är en responsiv, statisk webbplats med en graf av representativa
lektioner:

- en graf där varje nod är en fristående lektion och pilar visar förkunskaper,
- en graf som går uppifrån och ned; lektioner på samma nivå läggs bredvid
  varandra och radbryts vid behov för att undvika sidscrollning,
- fri start på vilken nod som helst; grafen rekommenderar ordning men låser inte lektioner,
- förklarande moment om positionssystem, bråk och ekvationer,
- grundläggande lektioner om addition, subtraktion, multiplikation, division,
  tid, enhetsomvandling, cirkelns omkrets, area, vinklar och diagram,
- uppgifter med förklarande återkoppling på vanliga missuppfattningar,
- textuppgifter i varje lektion,
- svar, återkoppling och interaktiva inställningar som sparas på elevens konto, så
  eleven kan byta enhet och fortsätta där den slutade,
- en interaktiv bråkmodell där eleven själv ändrar täljare och nämnare,
- separata, redigerbara JSON-filer för varje lektion.

Prototypens innehåll är exempel, inte en komplett kursplan. Att fylla
lärstigen med en heltäckande, kvalitetssäkrad kurs från åk 3 till gymnasiet åk
3 kräver fortsatt innehållsarbete och pedagogisk granskning.

## Skapa och utveckla lektioner

Allt innehåll ligger under `lessons/`. Varje nod har en egen JSON-fil, till
exempel `lessons/brak.json`, med id, område, titel, ungefärlig nivå,
förkunskaps-id:n, förklaringar, regler, exempel, uppgifter, återkoppling och
eventuella interaktiva inställningar. Gränssnittet läser och ritar grafen från
filerna; nytt lektionsinnehåll kräver inga ändringar i webbplatsens kod.

Grafens layoutregler ligger separat i `graph-layout.js`. Där kan du ändra
nodernas minsta/största bredd och höjd, avstånd mellan rader och nivåer,
grafens marginaler samt nivåetiketter. Funktionen `calculate` beräknar
nodernas positioner för den tillgängliga bredden; `edgePath` bestämmer formen
på pilarna. På så sätt kan grafens utseende ändras utan att röra lektionernas
innehåll eller sidans renderingskod.

Så lägger du till en nod:

1. Skapa `lessons/min-nyckel.json` genom att kopiera en befintlig lektion och
   redigera dess innehåll. `id` ska vara unikt och användas som filens
   förkunskapsreferens.
2. Lägg till filnamnet i listan `lessons` i `lessons/index.json`.
3. Lägg till ett eller flera id:n i `prerequisites` för att rita pilar från
   förkunskaperna. Använd `[]` om eleven kan börja direkt med lektionen.
   I översikten av en lektion markeras förkunskaperna för en elev (✓ klar, streckad
   ram om de inte övats än). När eleven har kommit igång och någon förkunskap är helt
   oövad står en rad om det ("Den här lektionen bygger på … som du inte övat än").
   Inget låses: kartan låter fortfarande alla börja var de vill.
4. Kontrollera att id:n i listan verkligen finns, att inga beroendecykler har
   skapats och att JSON-filerna är giltiga.

Grafens nivåer beräknas automatiskt från förkunskapslänkarna. En lektion med
flera förkunskaper får pilar från varje relevant nod. Om eleven filtrerar på
ämnesområde kan pilar till lektioner utanför filtret döljas, men alla noder är
öppna att välja när filtreringen är avstängd.

Interaktiva modeller definieras med `interactive`, till exempel
`{"type":"fraction-model","numerator":3,"denominator":4}`. När en ny
interaktionstyp behövs läggs dess presentation och beteende till i `app.js`;
vanliga nya lektioner och uppgifter behöver inga kodändringar.

Diagram och tabeller kan läggas till via `visual` eller `visuals` direkt i en lektion,
i lektionens `exercise` eller i enskilda `wordProblems`. Följande format stöds:
- **Stapeldiagram (`type: "stapeldiagram"` eller `"bar"`):** visar jämförelser med skalor, rutnät och exakta värden.
- **Cirkeldiagram (`type: "cirkeldiagram"` eller `"pie"`):** visar andelar av en helhet med procentsatser, cirkelsegment och interaktiv teckenförklaring (stöd för munk-/donut-layout).
- **Linjediagram (`type: "linjediagram"` eller `"line"`):** visar förändring över tid eller mönster med sammanhängande linjer, tonad area och datamarkörer.
- **Tabeller (`type: "tabell"` eller `"table"`):** visar frekvenstabeller och värdetabeller med kolumnrubriker, summeringsrader och automatisk taljustering.
- **Flikar (`type: "tabs"`):** låter eleven växla mellan olika representationer (t.ex. stapeldiagram, cirkeldiagram och tabell) för samma dataset.

Varje lektion kan också innehålla en `wordProblems`-lista med uppgifter i
vardagliga sammanhang. Svar, återkoppling, klar-status och interaktiva värden
sparas per lektions-id på elevens konto på servern. Det gör att
lektionen kan återupptas efter att eleven öppnar en annan nod, laddar om
sidan eller loggar in från en annan enhet.

Skriv feedback för begripliga matematiska felsvar uttryckligen. Undvik att
automatiskt anta vad eleven tänkte utifrån enbart fel svar; om en orsak inte
kan avgöras ska webbplatsen säga vad som blev fel och ställa en hjälpande
fråga i stället för att påstå sig veta hur eleven resonerade.

## Figurer i lektioner

Utöver diagram och tabeller kan en lektion (eller en enskild uppgift) ha en
figur som `visual`, ritad av `figures.js`. Typerna är:

| `type` | Visar | Viktiga fält |
| --- | --- | --- |
| `tallinje` | Tallinje med punkter, hopp och markerat intervall | `min`, `max`, `step`, `labelEvery`, `points`, `jumps`, `range`, `animate`, `pet` (elevens djur hoppar längs pilarna) |
| `rektangel` / `kvadrat` | Rektangel med måttangivelser, valfritt rutnät | `w`, `h`, `unit`, `grid`, `outline`, `sides` (`"all"` märker alla sidor) |
| `triangel` | Triangel med sidor, höjd och inritad rektangel | `base`, `height`, `apex`, `labels`, `showHeight`, `showRect` |
| `figurer` | Galleri av former med namn | `items: [{ shape, label }]` |
| `symmetri` | Former med symmetrilinjer | `items: [{ shape, axes, label }]` |
| `monster` | Växande mönster och rutnät av prickar | `steps: [{ label, rows, cols }]` eller `cells` |
| `talrutnat` | Talen från–till, med markerade tal (t.ex. primtal) | `from`, `to`, `columns`, `highlight` |
| `grupper` | Lika stora grupper av saker (multiplikation och division, med rest) | `groups`, `per`, `item` (kula, apple, stjarna, kaka, fisk, blomma, penna), `mode` (`gange` eller `dela`), `remainder`, `hide` |
| `tiobas` | Platsvärde: tusenkuber, hundrarutor, tiostavar och ental | `value` (upp till 9999), `total` |
| `pengar` | Svenska mynt och sedlar | `items: [{ value, n }]`, `total` |
| `brak` | En helhet i lika delar, några färgade | `shape` (cirkel eller rektangel), `parts`, `shaded`, `compare: [{ parts, shaded }]` |
| `termometer` | Termometer, även under noll | `value` eller `values: [{ value, label }]`, `min`, `max`, `step` |
| `linjal` | Linjal med ett föremål, i centimeter | `length`, `from`, `object` (penna, suddgummi, sladd), `hide` |
| `kalender` | En månad, veckan börjar på måndag | `year`, `month`, `days`, `range: { from, to }`, `note` |
| `tidslinje` | Tiden mellan två klockslag | `from`, `to` ("09:20"), `label`, `hide` |
| `tarning` | Tärningar | `values: [1 till 6]` |
| `snurra` | Lyckohjul som snurrar och stannar | `sectors: [{ label, n }]`, `land` |
| `pase` | Påse med kulor | `items: [{ color (rod, bla, gul, gron), n }]` |
| `matglas` | Måttglas med deciliterstreck, fyllt till en nivå | `capacity` (liter), `level` (liter), `label`, `hide` |
| `volym` | Kloss byggd av kuber, lager för lager | `w`, `h`, `d`, `unit`, `label` |
| `graf` | Koordinatsystem med punkter, linjer och kurvor | `xmin`, `xmax`, `ymin`, `ymax`, `points`, `lines`, `curves: [{ fn, label, tone, from, to }]` |
| `stege` | En stege med numrerade pinnar (nerifrån), markeringar på pinnar och pilar för vägen upp och ner. Med `pet` klättrar elevens djur längs pilarna | `rungs`, `marks: [{ at (pinne eller "mitten"), label, tone }]`, `jumps: [{ from, to, label }]`, `numbered`, `animate`, `pet` |
| `karta` | En karta i ett rutnät (rader A, B, C, kolumner 1, 2, 3) där djuret går en väg av rutor | `rows`, `cols`, `cells: { A2: "skola" }`, `path: ["A2", "A3", "A4"]`, `animate`, `pet` |
| `skift` | Siffrorna i ett tal flyttar åt vänster (gånger 10, 100, 1000) eller åt höger (delat med), och nollor kommer eller försvinner | `value`, `places`, `dir` (`hoger` för division), `pet`, `labels` |
| `styckpris` | Ett pris som delas lika på sakerna: priset som en stapel, en prislapp på varje sak | `n`, `total`, `item`, `unit` |
| `cirkel` | En cirkel med radie och diameter, en kvadrat på radien (cirkelns area är ungefär 3,14 sådana) och omkretsen utrullad (lite mer än tre diametrar) | `r`, `unit`, `show` (`radie`, `diameter`, `kvadrat`, `omkrets`), `labels: { r, d, o }` |

Exempel: `{ "type": "tallinje", "min": 0, "max": 20, "step": 1, "points": [{ "value": 13, "label": "?" }] }`.
**Rörelse.** De nya figurerna (`figures-more.js`) rör sig av sig själva när de kommer i bild: sakerna poppar upp en och en, kvicksilvret stiger, hjulet snurrar. Dessutom kan `tallinje` (`"animate": true`: hoppen ritas ett i taget), `klocka` (`"animate": true`: visarna vrider sig till tiden) `rektangel` (`"fill": true`: rutorna fylls en och en, area som antal rutor; `"outline": true, "trace": true`: omkretsen ritas) och `hundrarutor` (`"animate": true`) röra sig. Figuren väntar dold tills den syns, och knappen "Spela igen" visar den en gång till. Med inställningen för minskad rörelse står allt stilla och visas färdigt. Nya typer läggs till med `GaussicaFigures.register(typ, märke, funktion)`. Åk 3 och 4 har fått figurer i `platsvarde`, `addition`, `subtraktion`, `multiplikation`, `division`, `tid-klocka`, `kalendern`, `pengar-vaxel`, `mata-langd`, `halvor-fjardedelar`, `sakert-mojligt`, `stora-tal`, `division-med-rest`, `brak`, `brak-del`, `negativa-tal`, `area`, `kvadratens-area`, `tidsintervall`, `kassakvitto`, `begrepp-sannolikhet` och `vinklar`. Åk 4 till 6 har fått figurer i bland annat `matning-liter-gram` (måttglas), `volym`, `procent`, `procent-vardagen`, `samma-tal-tre-satt`, `brak-likavarda`, `brak-jämfora`, `brak-rakna`, `negativa-tal-rakna`, `delare` och `slump`. Hoppen, klockorna och omkretsarna som fanns rör sig nu. Testerna: `tests/figures-more.js` och `tests/browser/figures-lower.spec.js`.

Kurvor i `graf` ritas från ett uttryck i `x`: `{ "fn": "2^x", "label": "y = 2^x", "tone": "brand" }` (`tone` är `brand` för blått, annars rosa; `from` och `to` begränsar kurvan). Uttrycken kan använda `lg`, `ln`, `exp` och `log(bas, x)` utöver de vanliga funktionerna. Med `"walk": [[1, 1], [4, 1], [4, 3]]` ritas en streckad väg från punkt till punkt, och djuret (`pet`, annars en liten markör) går den när bilden spelas. Djuret i figurerna är elevens eget (`GaussicaPet.current()`); utan djur, eller med djuren avstängda, syns inget djur i figurerna (utom en markör i `karta`, `stege` och `graf` med väg). Rutnätet i `graf` har bara en linje där axeln har en siffra: stegen är 1, 2, 5, 10 och så vidare (högst cirka tio per axel), så att varje linje betyder något och bilden inte fylls av smårutor. Axlarna heter `x` och `y` om inget annat anges; `"xlabel": "Vikt (kg)", "ylabel": "Pris (kr)"` säger vad de mäter (tom sträng utelämnar namnet). Kurvan ritas med 240 punkter och bryts där värdet inte finns (till exempel `ln(x)` för x ≤ 0) eller ligger långt utanför bilden. Exempel finns i lektionerna om exponentialfunktioner, andragradsfunktioner och logaritmer.
Figurerna kan redigeras som JSON i lektionseditorn. Svar med enheter, till exempel
`24 cm`, `24cm` eller `25 cm²`, godkänns som talet.

## Utseende

Färgerna bygger på paletten #425B9A (djupblå), #76C0EC (himmelsblå), #FFF6DC
(kräm) och #FF95A5 (korall), något justerade för kontrast. Grundfärgerna är
variabler i `:root` överst i `styles.css` (`--brand`, `--cream`, `--accent`
m.fl.); "klar" är grönt och "behöver rättas" är korall. Temalagret längst ned i
filen styr former, knappar, grafens färger och läsbarhet. Typsnittet är Nunito.
Stilarna ligger i `styles.css`, utom två delar som hör till egna skript och läses in efter den:
`styles-figures-more.css` (figurerna i `figures-more.js` och deras rörelse) och `styles-algebra.css`
(algebraverktygen: substitutionen, steg för steg, matteknappar, ekvationsmodellen och arbetade
exempel). Nya `.css`-filer i rotmappen länkas i `index.html`; Pages-arbetsflödet kopierar alla
`*.css`, och `tests/stylesheets.js` kontrollerar båda sakerna.
Varje ämnesområde har en egen accentfärg (`--area-tal`, `--area-algebra` …).

## Konton, lagring och körning

Projektet består av en liten Node-server (`server.js`) som både levererar
webbplatsen och sköter konton och lagring. Den har inga beroenden: databasen är
SQLite via Nodes inbyggda `node:sqlite` (Node 22.13 eller nyare), så det finns
inget att installera.

```
npm start            (eller: node server.js)
```

Öppna sedan <http://localhost:8000/>. Första gången servern startar skapas
databasen i `data/gaussica.db` och en **lärarkod** skrivs ut. Visa den igen med
`node server.js --teacher-code`. **Säkerhetskopiera genom att kopiera `data/`.**

**Konton**

- Lärare skapar konto med lärarkoden, skapar klasser och får en *klasskod* per klass.
- Elever skapar konto med klasskoden och hamnar i den klassen. En lärare ser bara
  elever i sina egna klasser.
- Lösenord lagras som scrypt-hash; inloggningen är en HttpOnly-cookie. Inloggnings-
  och registreringsförsök begränsas. Glömt elevlösenord återställer läraren i
  lärarvyn (tillfälligt lösenord). Det finns ingen e-post, så lärarens eget
  lösenord kan inte återställas av någon annan; byt det i kontomenyn.

**Vad som sparas på servern:** elevernas framsteg per lektion, varje inskickat
svar (med försöksnummer, rätt svar, tid och diagnos) och lektioner som lärare
redigerat eller skapat i editorn (de ersätter filerna i `lessons/` för alla).
Lektionsfilerna i `lessons/` är fortfarande grundinnehållet.

**Inställningar (miljövariabler):** `PORT` (8000), `HOST` (standard
`127.0.0.1`; sätt `0.0.0.0` för att nå servern från andra enheter i nätverket),
`DATA_DIR` (`./data`), `TEACHER_CODE` (egen lärarkod), `CAREGIVER_SIGNUP=off` (stänger av konton för vårdnadshavare),
`COOKIE_SECURE=1` (sätt när sidan serveras över https).

**Publicering:** eftersom inloggning och lagring kräver servern räcker det inte
längre att publicera som statisk webbplats på GitHub Pages. Kör servern på en
dator eller värd med Node och lägg den bakom https (till exempel via en
omvänd proxy) innan den används med riktiga elever, eftersom lösenord annars
skickas okrypterat. Den gamla Pages-arbetsflödet i `.github/` publicerar bara
den statiska delen och visar därför ett meddelande om att servern saknas.

Webbplatsen använder i övrigt vanliga HTML-, CSS-, JavaScript- och JSON-filer
och kräver ingen byggkedja.

## Fortsatt väg framåt

1. Bygg ut innehållsmodellen och lärstigen med fler grundläggande moment och
   tydligare förkunskapskopplingar.
2. Lägg till fler felsvarsmönster och metoder för att uttrycka och testa
   matematiska regler.
3. Skapa fler interaktiva modeller inom tal, algebra, geometri, data och
   sannolikhet.
4. Utöka innehållet stegvis mot samtliga mål från grundskolans åk 3 till
   gymnasiets åk 3 och kvalitetsgranska förklaringar och uppgifter.
5. Förbättra tillgänglighet, mobilstöd och elevens möjlighet att återuppta
   lärandet; behåll en statisk publicering så länge den uppfyller behoven.

## Pyssla (interaktiva noder)

- Varje lektion har `"grade"` (årskurs 3–10). Grafen ordnas efter årskurs; en lektion hamnar aldrig tidigare än sina förkunskaper. Årskursen kan ändras i redigeraren (fältet "Årskurs").
- `"kind": "pyssel"` gör lektionen till en pyssla-nod (rundad ruta med glitter i grafen).
- Nya komponenttyper i `components`:
  - `pyssel`: `params` (reglage med name/min/max/step/value), `vars` (name/expr), `view`/`views` (figurer), `readouts` (text med `{uttryck}`, valfri `when`) och `goals` (id/text/conditions). En utmaning bockas inte av när ett reglage råkar passera rätt värde, för då räcker det att dra reglaget hela vägen utan att titta. Eleven ställer in reglagen och trycker på **Kolla** (knappen ligger under reglagen, inte under figuren, så att man slipper rulla på en telefon), och först då prövas utmaningarna. Stämmer inget står det "Inte riktigt än", utan att avslöja vad som är fel.
  - `ritrutnat`: spegelritning på rutnät (`cols`, `rows`, `preset`, `goal.minCells`, `autoMirror`).
  - `primtalssil`: Eratosthenes såll (`to`, `goal`).
  - `tarning`: tärning/mynt (`goal.minRolls`).
  - `robot`: bygg ett program av kommandona framåt, höger och vänster (`cols`, `rows`, `start` med `dir` 0 upp, 1 höger, 2 ner, 3 vänster, `target`, `walls`, `goal.maxCommands`). Klicka på ett kommando i programmet för att upprepa det (1 till 5 gånger).
- Uttryck: `"=expr"` ger ett tal, `"{expr}"` fylls i i text. Funktioner: abs, sqrt, round, floor, ceil, min, max, pow, mod, divcount, isprime, sgd, fact samt `pi`.
- Villkor i mål: `{expr, equals|min|max, tol}` eller `{all:[...]}`.
- Utmaningar räknas som uppgifter i framsteg och lärarvyn.
- Nya figurtyper: staplar, vinkel, graf, hundrarutor, klocka (och fler lägen för tallinje, monster, talrutnat).

## Publicera på GitHub Pages (demoläge)

GitHub Pages kan bara visa statiska filer, så där finns ingen Node-server. Då startar Gaussica automatiskt i **demoläge**: `local-backend.js` svarar på samma `/api`-anrop men sparar konton, klasser, framsteg och redigerade lektioner i webbläsarens `localStorage`.

- Allt är bundet till en webbläsare på en enhet. Elever och lärare delar alltså bara data om de använder samma dator och webbläsare, och rensas webbläsardata försvinner kontona.
- Lärarkoden i demoläget är `GAUSSICA` (visas på registreringssidan).
- Vill ni ha konton som fungerar mellan enheter: kör `npm start` på en server (se ovan) eller lägg till en riktig backend.
- Workflowen `.github/workflows/deploy-pages.yml` publicerar bara de statiska filerna (inte `server/`, `data/` eller testskript).

## Rityta på varje uppgift

Varje fråga (Din tur, textuppgifter och uppgiftskomponenter) har en rityta (`canvas-pad.js`) ovanför svarsfältet. Eleven kan rita med penna, skriva text, dra linjer och pilar, sudda, ångra och lägga ut och flytta saker: tal- och operatorbrickor, prickar, ental/tiotal/hundratal, geometriska former och tallinjer (dubbelklicka för att ändra tal och tallinjens start/slut). Svaret skrivs fortfarande i svarsfältet och rättas automatiskt.

- Ritytan är rutat papper. Text, tal, figurer och linjer fastnar på rutorna (knappen "Fäst i rutor" stänger av det). Figurer ritas genom att dra i rutan, eller klicka för en vanlig storlek, och får runda punkter att dra i för att ändra storleken. Kvadrat och cirkel förblir kvadratiska, rektangel och triangel kan ändras i bredd och höjd, och linjer kan dras ut i ena änden. Under ritytan finns knappar för att kopiera och ta bort markerad sak och, för text, göra den större eller mindre. Piltangenterna flyttar markerad sak en ruta.
- **Skriv på rutorna.** Verktyget "Skriv" skriver ett tecken per ruta, som på rutat papper: klicka på en ruta och skriv, Enter går till nästa rad och piltangenterna flyttar markören. Det passar för uppställning, eftersom siffrorna hamnar i rätt kolumner. Knappen "Sträck" under pappret drar ett streck under talen du har skrivit (lika brett som raderna ovanför) och flyttar markören till raden under, redo för svaret. På surfplattor visas sifferknappar under pappret (knappen "Abc" tar fram tangentbordet för bokstäver, och "Sifferknappar" under "Mer" slår på dem på dator). I "Skriv" och "Textruta" flyttar du det som redan finns genom att dra i det, och ett vanligt klick skriver eller ändrar, så eleven behöver inte byta verktyg. Knappen **╱ Stryk** (bredvid ▬ Sträck) lägger ett snedstreck över tecknet vid markören, eller över det före om rutan är tom, till exempel när eleven växlar i uppställning. Ett tryck till tar bort strecket. Strecket är ett vanligt linjeobjekt, så det sparas, flyttas och suddas som andra linjer (`slashColumn` och `slashItem` i `canvas-pad.js`, testade i `tests/canvas-slash.js`). På en telefon (smalare än 560 px) är pappret högre (4:3 i stället för 800 · 440), zoomreglaget är litet, och knapparna Sträck och Stryk ligger rakt under pappret, ovanför sifferknapparna.
- **Oändligt papper.** Dra på tomt papper (verktygen Flytta och Skriv), håll ned mellanslag och dra, eller dra med två fingrar för att flytta pappret. Nyp eller använd knapparna +, − och ⤢ för att zooma. Rullhjulet flyttar pappret när man har klickat på det, och Ctrl + hjul zoomar. Visar vyn inget av det eleven ritat kommer knappen "Visa mitt arbete". Vyn sparas med ritningen, och läraren ser hela ritningen.
- Ritytan sparas som liten JSON (`canvas`) i elevens framsteg (`progress.answers[uppgift].canvas`) och följer med inskickade försök när den ändrats sedan förra försöket.
- I lärarvyn visas den under varje försök ("Rityta vid detta försök") och som "Elevens rityta" för påbörjade uppgifter.
- Gamla kladdtexter (`scratchpad`) visas fortfarande i lärarvyn, men det finns inget kladdfält längre.

## Delad databas (Cloudflare D1)

För att använda samma konton och data på både GitHub Pages och din egen dator, följ [cloudflare/README.md](cloudflare/README.md). Sätt sedan `apiBase` i [config.js](config.js). Ordningen är: `apiBase` satt → Cloudflare-API:t, annars Node-servern på samma adress, annars demoläge i webbläsaren.

## Nästa steg, Öva mer och Repetera

- **Nästa steg.** `coach.js` föreslår vad eleven ska göra härnäst: lektionen eleven senast arbetade i, annars nästa lektion vars förkunskaper är klara (lägst årskurs först). Förslaget visas som ett kort ovanför lärstigen, i knappen i hero-sektionen och som en glödande nod i grafen.
- **Öva mer.** En lektion kan ha `practice`, en lista med mallar som skapar nya frågor med nya tal. Knappen finns på lektionssidan och efter en klar lektion. Frågorna rättas som vanliga frågor, loggas i lärarvyn ("Övning och repetition") men påverkar inte lektionens framsteg.
- **Repetera.** Räknas ut från elevens svarslogg: varje fel svar ger ett poäng, varje svar som är rätt på första försöket tar bort ett. Ligger en lektion på två poäng eller mer (senaste 30 dagarna) föreslås repetition, och mallarna som eleven haft svårast med väljs oftare.

### Övningsmallar: så skriver du dem

**I lektionsredigeraren.** Öppna lektionen, välj "Övningsmallar (Öva mer)" överst i listan till vänster och gör så här:

1. Öppna **Galleri** längst ned och tryck "Lägg till" på den färdiga mall som liknar det du vill ha (heltal, decimaltal, namn och saker, procent, bråk, ekvation, uttryck, figurer och så vidare).
2. Ändra mallen i formuläret: **Slumptal** (namn, lägst, högst och eventuellt steg), **Slumpord**, **Uträknade värden**, **Villkor**, **Frågan**, **Rätt svar** och **Vanliga fel**. Texten i frågan fylls i av namnen: `{a}` blir talet a, `{$namn}` ett slumpord och `{a+b}` en uträkning.
3. Titta på **Exempel och kontroll** under mallen. Där ser du fyra nya frågor med rätt svar, figurer och vanliga fel, och en kontroll som provar 200 frågor. Den varnar för namn som saknas, frågor som blir för lika, villkor som aldrig går att uppfylla och felsvar som egentligen är rätta. Det går inte att spara en lektion med en mall som har fel.
4. Under "Liknar uppgiften" bockar du för vilka av lektionens uppgifter mallen motsvarar. Då får en elev som svarat fel på uppgiften fler frågor av just den typen.

Under varje mall finns "Svarsform, extra tangenter och figur" och "Avancerat: mallens JSON". JSON-rutan kan ändra allt, även det formuläret inte har.

**Så ser en mall ut** (samma sak som formuläret skriver, se `practice.js`):

```json
{ "id": "summa", "for": ["exercise"],
  "pick": { "namn": ["Mira", "Omar"] },
  "vars": { "a": [120, 899], "b": [120, 899] },
  "derive": [ { "name": "s", "expr": "a+b" } ],
  "where": [ { "expr": "a-b", "min": 1 } ],
  "prompt": "Räkna ut {a} + {b}.",
  "answer": ["=s"],
  "correct": "Rätt! {a} + {b} = {s}.",
  "feedback": [ { "answers": ["=a-b"], "message": "Du har tagit bort i stället för att lägga till." } ] }
```

- `vars`: `[lägst, högst]` eller `[lägst, högst, steg]`. `[100, 900, 50]` ger 100, 150, 200 och så vidare.
- `derive`: räknas ut i ordning, så ett värde kan använda de före det.
- `where`: talen slumpas om tills alla villkor stämmer. `{ "expr": "a-b", "min": 1 }` betyder att a ska vara större än b. `min` och `max` kan kombineras.
- `answer`: `"=s"` ger talet s (med decimalkomma av sig självt), vanlig text får innehålla `{uttryck}`. Skriv flera svar om flera skrivsätt ska godtas: `["=r", "{r} kr"]`.
- `feedback`: felsvar och ett meddelande. Felsvaret kan också vara ett uttryck (`"=a+b"`).
- Uttryck: `+ - * / ^` och `abs sqrt round floor ceil min max pow mod sgd divcount isprime primecount nextprime fact`, samt `sin cos tan asin acos atan` (i grader) och `pi`. `{h|2}` ger två siffror, `{x|+}` visar tecken. Mycket små tal (0,0042) skrivs ut med alla decimaler.
- Frågan får aldrig vara lika varje gång: kontrollen varnar om det bara blir färre än fem olika frågor. Lägg då till `pick` eller bredare talintervall.
- Textuppgifter i Öva mer: `"for": ["word-0"]` (och `word-1`, `word-2`) gör mallen till en variant av lektionens första, andra eller tredje textuppgift. Det är så en lektion får fler textuppgifter utan att antalet uppgifter i lektionen ändras (och därmed utan att något som en elev redan har klarat ändras). Lektionerna för åk 3, 4 och 5 har flera mallar för varje textuppgift (åk 3 med enklare ord och färre steg): vardagsproblem med pengar, tid, mått, form och data, där svaret kräver ett steg mer än den fasta uppgiften (växel, omvandling, två räknesätt). Varje mall har ett vanligt fel som tips (till exempel att lägga ihop i stället för att multiplicera, eller att glömma nollorna).

**Specialfall.** Allt nedan finns som färdiga mallar i galleriet. Så här fungerar de:

| Vill du ha | Gör så |
|---|---|
| Ett svar som ord eller text | Skriv orden som rätt svar: `"answer": ["mindre"]`. Texten måste stämma tecken för tecken (stor och liten bokstav spelar ingen roll). Lägg slumpord i `pick` så att frågorna skiljer sig åt. |
| Svar med rest | Skriv båda varianterna: `"answer": ["{q} r {r}", "{q} rest {r}"]`. |
| Bråk eller förhållande som måste vara förkortat | `"form": "forenklat"` och svaret som `"{a}/{b}"`. Ett rätt men ofullständigt förkortat svar får tipset att förkorta mer. Lägg inte det oförkortade bråket som felsvar, det är ju också rätt. |
| Blandad form eller bråk | `"form": "blandad"` (1 3/4) eller `"form": "brak"` (7/4). |
| Ett uttryck med x som svar | Svaret jämförs som algebra, så `3x+12` och `12+3x` räknas lika. Skriv potenser som `x^2` och lägg till `"keys": ["^"]` så att eleven får en tangent för tecknet. Be eleven skriva "x² som x^2" i frågan. |
| Uttryck där parentesen ska multipliceras ut | `"form": "utanparentes"`. Annars godtas `(x+3)^2` som svar på "utveckla (x+3)²". |
| Grundpotensform | `"form": "grundpotens"`, och svaret som `["{a/10}·10^{e}", "{a/10}*10^{e}"]`. Tala om i frågan att eleven skriver `*` och `^`. |
| Roten ur | Skriv svaret i alla former som ska godtas: `["{k}√{m}", "{k}*√{m}", "{k}sqrt({m})", "{k}*sqrt({m})"]`, och lägg till `"keys": ["√"]`. |
| En figur | `"visual"` med en figur från tabellen över figurer ovan, där `"=a"` hämtar slumptalet a och `"{a} cm"` blir text med talet. Exempel: `{ "type": "staplar", "data": [{ "label": "Äpple", "value": "=a" }] }`. Prova figuren med menyn "Sätt in en figur" i formuläret. Siffrorna i figuren och i svaret måste komma från samma slumptal. |
| Trigonometri | Använd `sin`, `cos`, `tan` (grader) och runda svaret: `"=round(h*sin(v)*10)/10"`. Lägg ett villkor som undviker avrundningsgränser: `{ "expr": "abs(mod(h*sin(v)*100,10)-5)", "min": 0.5 }`. |
| Positiva heltalssvar i en ekvation | Slumpa svaret x först och bygg ekvationen baklänges med `derive` (`c = a*x+b`), så blir x alltid ett heltal. |
| Begreppsmatchning | Använd knappen "Skapa av begreppskorten", som bygger en matchningsmall och en "vilket begrepp är det här"-mall av lektionens begreppskort. Mallen har `pool` i stället för `vars` och redigeras som JSON. |
| Att svar med en uträkning får godtas | `"allowExpression": true` i mallen, eller inställningen "Uträkning som svar" på lektionen. |
| Ett löst exempel när eleven kört fast | `"steps": ["Lägg ihop entalen och tiotalen.", "{a} + {b} = {s}"]`, ett lösningssteg per rad (i redigeraren: "Lösningssteg"). Efter två fel i rad erbjuder spelaren "Se ett löst exempel" med en liknande fråga med andra tal, och stegen visas med talen ifyllda. Utan `steps` visas mallens rättmeddelande (`correct`) som lösning. |

**Tips.** Håll slumptalen så att svaret blir rimligt (inga negativa tal om eleven inte kan det, inga för stora tal). Skriv gärna ett vanligt fel per vanlig missuppfattning, med ett meddelande som säger vad eleven gjorde och hur det ska vara. Provkör alltid några exempel i redigeraren innan du sparar, och kör `npm test` om du redigerar JSON-filerna direkt.

## Mina knepiga

Ett anteckningsblock över frågor som varit knepiga (`notebook.js`, kortet "Mina knepiga" på startsidan, route `#knepiga`). Inget extra sparas för själva listan: den räknas ut från svarsloggen. En fråga är knepig när ett svar blev fel innan den löstes (eller den aldrig löstes). Frågorna grupperas efter sort när det finns en övningsmall bakom (en genererad fråga och lektionsfrågan den speglar hör ihop), annars per fråga. Varje fråga visar frågan, elevens fel svar, rätta svaret, hur många gånger den gick fel och, med en knapp, ett löst exempel på ett liknande tal (samma funktion som i lektionen), eller en genväg till lektionen.

- **Träna på dem** startar en runda med nya frågor av samma sort (inte samma tal igen), i spelaren under namnet "Mina knepiga". Rätt på första försöket två gånger i rad lägger undan frågan i "Det här kan du nu 🎉". Ett fel mellan räknar om, och en fråga som kunde men blir fel igen kommer tillbaka.
- **Jag kan det här** lägger undan en fråga på egen hand. Det enda som sparas är vilka frågor som lagts undan, i elevens framsteg under nyckeln `notebook` (`{ hidden: { nyckel: tid } }`). Frågan kommer tillbaka om den går fel igen efteråt.
- Frågor utan övningsmall listas men kan inte tränas om med nya tal (att köra om en fast lektionsfråga i en runda skulle ändra lektionens framsteg), de har bara en knapp till lektionen.
- `tests/notebook.js` kontrollerar vad som räknas som knepigt, när en fråga läggs undan, att den kommer tillbaka och rundan.

## Resan

En bild av samma framsteg som "Din väg" och kartan (`journey.js`, kortet "Resan"): lektionerna i ett område som en slingrande väg genom ett landskap, med djuret (eller en vandrare om eleven inte har något) på det stopp där eleven är. Fem landskap: Ängen (tal), Skogen (algebra), Bergen (form och rum), Stranden (tid och mätning) och Staden (data). Vägen delas i etapper om åtta stopp, med knappar och prickar för att bläddra. Klara stopp är gröna med en bock, påbörjade blå, sådana nivåtestet visar att eleven kan ljusgröna, och stoppet där eleven är gult med en pulserande ring. Tryck på ett stopp för att se vad det är och starta det. När ett område är klart regnar det konfetti. På smala skärmar scrollar bilden i sidled med det aktuella stoppet i mitten, och varje stopp har en stor tryckyta. Inget sparas, och inget går förlorat av att stå still. Landskapen är ritade i SVG i koden, så ingen bildfil behövs och allt fungerar offline.

## Planera efter mål

Sektionen "🎯 Planera efter mål" i lärarvyn (`planner.js`). Läraren väljer klass och ett mål ur kursplanen (centralt innehåll, samma lista som i bedömningsunderlaget, ordning efter kursplanen eller efter störst behov), ser hur klassen ligger till (klara, delvis) och får de lektioner som övar målet som förslag, lättast först, med hur många som klarat varje lektion. Lektioner som alla redan klarat, eller som redan är ett uppdrag till hela klassen, är avmarkerade. Läraren kan ta bort lektioner, lägga till ett prov på lektionerna (20 minuter, eleverna får egna tal) och ett meddelande ("Vi övar: ..." som förslag) och datum, och ger sedan hela klassen planen med en knapp: ett uppdrag per lektion, och provet sist. Inget skickas före knappen. Målens text är en kort sammanfattning med egna ord, kontrollera mot Skolverkets kursplan. `tests/planner.js` och `tests/api-planner.js` (som skickar förslagen till den riktiga servern) kontrollerar förslagen och uppdragen.

## Hitta din nivå (nivåtest)

Knappen "Hitta din nivå" överst i "Din väg" (och `#nivatest`) startar ett kort test som hittar var i lärstigen eleven ska börja (`placement.js`, `test-mode.js`). Eleven väljer årskurs och svarar på ungefär 15 till 25 genererade frågor, en i taget och utan tips. Testet går i lärstigens förkunskapsgraf som en binärsökning: en lektion prövas med två eller tre frågor. Kan eleven den räknas allt den bygger på som känt. Kan eleven den inte räknas allt som bygger på den som inte känt än. Nästa lektion som prövas är den som avgör flest av de lektioner som återstår, och högst 12 lektioner prövas. "Vet inte" avgör en lektion direkt. Frågorna kommer från lektionernas övningsmallar, så bara lektioner med mallar prövas direkt. Svaren loggas inte som försök, så nivåtestet påverkar varken "Repetera" eller lärarens statistik.

- **Resultat.** Sparas i elevens framsteg under nyckeln `placement` (`{ at, grade, level, known, unknown, start }`), alltså utan ändring i databasen. Eleven ser hur många lektioner som verkar kända och vilka tre som är bästa start.
- **Vad det ändrar.** Kända lektioner får en grön markering ("Verkar kunna") i kartan och räknas som klara när "Din väg" avgör vad som är redo, och förslagen börjar vid kanten av det eleven kan i stället för längst ned. Inget låses: eleven kan alltid öppna och göra lektionerna ändå. "Gör om testet" ersätter resultatet.
- **Läraren** ser resultatet i elevens detaljvy och som ljusgröna rutor i klassöversikten.
- Logiken (`GaussicaPlacement.create`) går att köra utan sida och testas i `tests/placement.js` med simulerade elever.

## Prov

I lärarvyn, avsnittet "📝 Prov" (`prov.js`): välj lektioner, antal frågor per lektion, tidsgräns, klass (eller en elev), sista dag och om eleven ska se resultatet direkt. Varje elev får sin egen variant (andra tal, samma varje gång för samma elev), och lektioner utan övningsmallar ger sina egna frågor till alla. Provet visas hos eleven som ett uppdrag med knappen "Starta provet".

- **Under provet** (`test-mode.js`): en fråga i taget, ett svar per fråga, ingen väg tillbaka, inga tips och ingen återkoppling om det blev rätt. "Hoppa över" finns. En klocka visar tiden, och när den tar slut lämnas provet in. Eleven kan stänga fliken och fortsätta, men tiden går. Svaren rättas direkt med samma regler som i lektionerna (uträkning i stället för tal och fel skrivsätt räknas som fel).
- **Resultat.** Läraren ser per prov hur många som lämnat in, snittet, hur varje lektion gick och per elev varje fråga med elevens svar, rätt svar och tid. Eleven ser resultatet med rätt svar om läraren valt det. Nedtaget prov försvinner från lärarens lista.
- **Lagring.** Ett prov är ett uppdrag av typen `prov` vars inställningar ligger i den nya kolumnen `assignments.config` (Node: schemaversion 6, Cloudflare: kör `migrations/005-prov.sql` en gång, se cloudflare/README.md). Elevens svar sparas i elevens framsteg under nyckeln `prov-<uppdragets id>`, så de följer med exporten.
- Provfrågorna loggas inte som vanliga försök och påverkar därför inte "Repetera".

## Klassöversikt

Överst i lärarvyn, under siffrorna: "🗺 Klassöversikt" (`heatmap.js`). Eleverna ligger längs sidan och lektionerna på tvären, i årskursordning. Varje ruta är en färg: **klar**, **klar men osäker** (nyligen fel), **pågår**, **kört fast** (fel som inte lösts eller många fel nyligen), **verkar kunna** (nivåtestet) och **inte påbörjad**. Håll musen över en ruta för detaljerna, klicka på rutan eller elevens namn för att öppna eleven, och klicka på en lektion för att se vilka som är var.

- **Vem behöver dig idag?** Elever som kört fast den senaste veckan, ställt en fråga som inte besvarats, har försenade uppdrag eller inte varit aktiva på över två veckor. Med knappar för att öppna eleven eller ge Öva mer direkt.
- **Nästa steg.** Grupper med en knapp för varje: elever som har problem med samma lektion ("Ge dessa Öva mer"), elever som är redo för nästa lektion ("Ge lektionen") och elever som inte kommit igång. Knapparna skickar vanliga uppdrag, så de syns som vanligt hos eleverna.
- Du väljer om kartan visar lektionerna klassen arbetat med eller alla, och kan begränsa den till ett område. Klassfiltret följer med.

## Ditt djur och mynt

Mest tänkt för åk 3 till 5. Eleven väljer ett av tretton djur (mops, tax, katt, pingvin, kanin, igelkott, räv, hamster, drake, axolotl, gris, ko eller nymfkakadua, fyra färger var, axolotlen fem med en blå), ger den ett namn och tjänar **mynt** genom att lära sig. Mynten används i butiken ("Mitt djur och butiken") till hattar, ansikte (glasögon, mustasch, clownnäsa), halsband och tapeter och möbler till djurets rum, 98 vanliga saker för 15 till 60 mynt, och dessutom fem **teman**, ett för varje område (Siffervännen, Mysteriet x, Formvännen, Tidsvännen och Slumpvännen) med en hatt, glasögon och ett halsband var. Delarna i ett tema öppnas när eleven klarat 2, 4 och 6 lektioner i området, och köps sedan med mynt (30 till 50). Sitter hela temat på djuret syns det med ett sken. På så sätt blir det roligt att prova lektioner i ett område man annars hoppar över. Temana har ingen egen flik: de ligger bland de vanliga sakerna i Hattar, Ansikte, Halsband och Bakgrund, med temats namn och ett lås ("🔒 4 lektioner") så länge de är stängda. Dessutom finns tolv **märkessaker** (Liten planta, Stjärnkrona, Tiomedalj, Lagerkrans, Siktesglasögon, Kämpapannband, Pysslarhatt, Ordboken, Uppdragsbricka, Träningshallen, Tabellrummet och Regnbågen) som öppnas när eleven fått ett visst märke (de som visas under Märken, se `rewards.js`), och Regnbågen först när alla fem områdesmärkena är fått. De köps sedan med mynt som allt annat. Under rutnätet förklarar "Vad öppnar de låsta sakerna?" vad som krävs och hur långt eleven har kommit. Djuret ritas som SVG (`pet-art.js`, inga bildfiler), rör sig lite (andas, blinkar, viftar, hoppar av glädje när man klappar det eller köper något) och rörelsen stängs av för den som bett om mindre rörelse. Logiken och skärmarna finns i `pet.js`.

- **Mynt för att lära sig, inte för att klicka.** En klar lektion ger 10 mynt (2 till 4 till för två eller tre stjärnor). Löser eleven en fråga efter ett fel ger det 1 mynt, högst 3 per lektion, så att den som kämpar också tjänar. Öva mer och Repetera ger 1 mynt per ny fråga, högst 10 om dagen, så det lönar sig inte att spamma lätta frågor. **Tillbaka igen:** gick en sorts fråga fel en dag (en lektionsfråga och de genererade frågorna från samma mall räknas som samma sorts, som i Mina knepiga) och eleven klarar en sådan på första försöket en senare dag ger det 2 mynt, högst tre gånger om dagen. Samma dag räknas inte, så det går inte att göra fel med flit och rätt direkt efter. **Klart uppdrag:** varje uppdrag från läraren (lektion, Öva mer eller prov) som eleven blir klar med ger 10 mynt, en gång. Första gången appen ser att uppdraget är klart skrivs det in i djurets post (`quests`), så mynten ligger kvar även om läraren tar bort uppdraget efteråt, och ett uppdrag som redan var klart när djuret valdes ger också mynt. Uppdragskortet visar vad det ger, och på sammanfattningen står det vilka mynt som kom från uppdraget. Nivåtestet ger 5 och djuret ger 20 i present. Läraren kan ge **presentmynt**: dekalerna "5, 10 eller 25 mynt till ditt djur" bland dekalerna i meddelandena.
- **Inget går förlorat.** Djuret är aldrig ledset eller hungrigt, det finns inga serier och inga dagliga mål, och ingen jämförelse mellan elever. Djuret pratar i en pratbubbla i lektionens nederkant: ett lugnt "Ta det lugnt, ett steg i taget" vid första frågan, uppmuntran och en påminnelse om tipset och det lösta exemplet när det blir fel, "Bra att du fortsatte!" när det blir rätt efter ett fel, och beröm när lektionen är klar. Raderna finns i `SAYINGS` i `pet.js`. Utan djur visas samma meddelanden som vanlig text.
- **Mynten visas där de hör hemma:** på sammanfattningen när en lektion eller en runda är klar (djuret hoppar, "Du fick 14 nya mynt") och på startsidan, aldrig mitt i en fråga och aldrig i nivåtest eller prov.
- **Ingen ändring i databasen.** Djuret (art, färg, namn, vad som köpts och har på sig) sparas i elevens framsteg under nyckeln `pet`. Mynten räknas ut från elevens egna data (klara lektioner, svarsloggen, presentdekaler) minus det som köpts, så de är de samma på alla enheter och går inte att ändra i webbläsaren. Ändras ett pris senare påverkas inte det som redan köpts, för priset som betalades sparas.
- **Rum med möbler.** Fliken "Rum" i butiken: 56 saker att köpa (15 till 50 mynt) för väggen (19 tapeter), mattan, bädden, fönstret, hyllan, lampan, växten och leksaken, och tre tapeter till som märken öppnar. Djuret bor i sitt rum, och rummet visas överallt där djuret visas. Det finns inga bakgrunder längre: varje gammal bakgrund är en tapet (Äng, Strand, Snö, Klassrummet, Rymden, Skogen, Regnbåge, Öknen, Solnedgång, och Stjärnhimmel och Under vattnet som de tidigare tapeterna Stjärnvägg och Havsvägg). Ett djur som hade köpt en bakgrund äger nu tapeten för samma pris (inga mynt ändras) och har den på väggen om bakgrunden var påsatt; flyttningen görs av `migrate` i `pet-art.js` när eleven öppnar sidan och sparas då i `pet`. Rummet ritas av `roomSvg` i `pet-art.js`; nya saker läggs till i `ROOM_ITEMS` (plats, id, namn, pris, ritning). Rummet sparas i djurets post som `room` (och `scene` är alltid `"room"`).
- **Butiken.** 125 saker: 16 hattar, 13 ansiktssaker (glasögon, mask, ögonlapp, fräknar), 13 halsband och 56 rumssaker, plus de femton tematiska sakerna som öppnas av lektioner i ett område och de tolv märkessakerna (varav tre tapeter) som öppnas av märken (`badges` i `ITEMS`, `lockOf` i `pet.js`; utan lista över märken räknas inget som låst av märken, så att `buyItem` och testerna går att använda utan `rewards.js`). Allt ritas i `pet-art.js` (`ITEMS`, `ROOM_ITEMS`) och testas på alla djur, färger och miner i `tests/pet.js`. Hela butiken kostar ungefär 3 800 mynt, så ingen behöver köpa allt, och testet kräver att den ändå går att nå med 24 mynt per lektion.
- **Djuret lever i rummet.** På startsidan och i djurrummet gör djuret något då och då (`LIFE`, `startLife` i `pet.js`): det sover i sängen med slutna ögon och en "z z z"-bubbla, sitter på mattan, leker med sin leksak (leksaken studsar), tittar på bokhyllan, nosar på växten och tittar ut genom fönstret. Det som finns i rummet avgör vad det kan göra, utan rum hoppar det, lutar på huvudet eller blundar en stund, och på kvällen och natten (efter 21 och före 6) sover det mycket mer. Pratbubblan på startsidan säger vad det gör. Det är lugnt och kort, ingenting begärs av eleven, det görs aldrig två gånger i rad, det pausas när en lektion är öppen eller fliken är dold, och med reducerad rörelse står djuret kvar och bara ögon, tanke och ord ändras. Alla djur har slutna ögon (`pet-eyes-closed`) och en `pet-actor`-grupp som kan flyttas.
- **Små reaktioner.** Djurets ögon följer markören (`followGaze` i `pet.js`; nära djuret tittar det lite, långt bort så långt det går, och en finger på en pekskärm släpps efter en stund; inte med reducerad rörelse och inte medan det sover). Att klappa det (klick eller tryck på djuret på startsidan eller i djurrummet) ger hjärtan som svävar upp och ett svar i pratbubblan, och de tre första klappen per dag ger ett hjärta åt vänskapen (`petPet`, `use.petted`; fler klappar är bara roliga, så det går inte att dra upp vänskapen genom att klicka). Djuret reagerar olika på olika saker (`reactionFor`): en hatt, glasögon eller ett halsband visas upp (en pose med glitter och en kommentar, inga hjärtan), en godsak äts (tuggar, och hjärtan om det är favoriten), en leksak leks med (hoppar), en ny tapet eller rumssak tittas på, och klappar ger hjärtan. Att ta av något ger ingen reaktion.
- **Djuret tittar fram.** Djuret är inte bara i sin egen ruta (`peek` i `pet.js`). På startsidan tittar det upp över nedre kanten av dagens stegkort, bredvid knappen, och en arm pekar på knappen (den knackar till ibland; med reducerad rörelse står den still). Varje djur har sin egen arm (`pointer` i `pet-art.js`): en tass för mops, tax, katt, räv, kanin, hamster och igelkott (sedda ovanifrån med tre tår längst fram och linjer mellan dem, räven har svarta tassar och kaninen och igelkotten ljusa), en klöv för gris och ko, en liten hand med tre fingrar för axolotln, en klo för draken, en simfot för pingvinen och en vinge för nymfkakadun, i djurets färger. Armen är liten (ungefär 52 px bred) och bara huvudet beskärs (vid hakan), så armen klipps aldrig när den rör sig. I en lektion tittar det upp över bottenfältets övre kant (`.pl-peek` i en `.pl-footwrap` runt bottenfältet, som själv rullar och därför inte kan ha det inuti): det tittar på svarsfältet, upp mot tipset när svaret var fel, och är glatt när det var rätt. Pratbubblan i bottenfältet har då inget eget ansikte (`faceless`), så djuret inte syns två gånger. Det göms när tangentbordet är uppe eller skärmen är kort (en telefon på sidan). Huvudet beskärs vid hakan (`PEEK_CROP`) så det ser ut som att det står bakom kanten. Tester: `tests/peek.js`.
- **Djuret i uppgifterna.** I en handfull uppgifter (14 lektioner, inte alla) handlar det om elevens djur: `@djur` blir djurets namn, `@djurs` namnet med s och `@mat` det djuret gillar att äta i plural (morötter, fiskar, kanelbullar; `countable` i `pet-art.js`). Utan djur, för lärare och på utskrivna papper blir det Mio och äpplen. Texterna är skrivna utan pronomen för djuret, eftersom det inte går att veta vilket som passar. Bytet görs på en kopia av uppgiften (`personalize` i `lesson-model.js`), för lektionens egna filer ändras aldrig, och gäller uppgifter, svar, ledtrådar och genererade övningsfrågor. Testerna (`tests/personal.js`) kontrollerar att inga okända tecken och inga pronomen finns kvar.
- **Djuret på kartan.** I lärandegrafen sitter djuret på lektionen eleven är vid (den att fortsätta eller börja), och går dit när det byter plats (var det var sparas i webbläsaren). Klara lektioner har ett litet tassavtryck. Med reducerad rörelse hoppar djuret direkt dit.
- **Läraren ser djuret** (`pet-teacher.js`): en kolumn "Djur" i elevlistan (djurets namn och mynt) och en ruta i elevens vy med antal mynt, köpta saker och senaste presenter. Där ger läraren mynt med en anledning (5, 10 eller 25 mynt och en kort text, med färdiga förslag som "Du gav inte upp"). Det skickas som ett meddelande med en myntdekal, så eleven ser varför.
- **Mat och lek.** Fliken "Mat och lek": nio godsaker och sju leksaker för 1 till 3 mynt, som tar slut direkt och sätter igång en kort animation (godsaken flyger till munnen, bollen studsar, frisbeen flyger, garnet rullar, ballongen och bubblorna svävar uppåt; med reducerad rörelse hoppar animationen över). Varje djur har en favoritgodsak och en favoritleksak. Varje sak ger ett hjärta, favoriten två, och hjärtana gör att vänskapen växer: Nya vänner, Kompisar (6), Bästisar (20), Superbästisar (50). För att det ska förbli litet och lugnt finns en gräns per dag, 3 godsaker och 5 lekar, och sedan är djuret mätt eller trött (inget dras då). Djuret mår lika bra om eleven inget gör, så det är bara något trevligt att använda mynt till. Det sparas i djurets post (`use`: dagens antal, summor, hjärtan och använda mynt, som räknas av från saldot). Läraren ser antal godsaker och lekar och vänskapen i elevens ruta.
- **Tretton djur.** Mops, tax, katt, pingvin, kanin, igelkott, räv, hamster, drake, axolotl, gris, ko och nymfkakadua. Alla ritas i samma 200 x 200-ruta med huvudet på samma ställe, så att alla hattar, glasögon och halsband passar. Taxen ritas från sidan (huvudet vänt mot betraktaren) för att se lång ut.
- **Läraren** slår av djuret för en klass med samma ruta som stjärnor och märken ("Stjärnor, märken och djur" i klasslistan).
- Nya saker läggs till i listan `ITEMS` i `pet-art.js` (id, plats, namn, pris och ritning), nya godsaker och leksaker i `FOODS` och `TOYS`, och ett nytt djur i `KINDS` (färger, namn, favoriter), `SHIFT` och en egen ritfunktion. `tests/pet.js` ritar alla kombinationer av djur, färg och sak och kontrollerar hur mynt tjänas.

## Kursplanen (Lgr22) och bedömningsunderlag

Varje lektion är kopplad till centralt innehåll i kursplanen för matematik (`lgr22.js`): 53 punkter i tre stadier (åk 1–3, 4–6, 7–9) och sex områden (taluppfattning, algebra, geometri, sannolikhet och statistik, samband och förändring, problemlösning). **Beskrivningarna av innehållet är en kort sammanfattning med egna ord, inte kursplanens text. Kontrollera dem mot Skolverket (skolverket.se, Lgr22, matematik) innan de används som dokumentation**, och ändra raderna i `CONTENT` om din skola läser innehållet på ett annat sätt. Kopplingen lektion till innehåll ligger i `MAP` i samma fil. Testet `tests/lgr22.js` kräver att varje lektion är kopplad och att varje punkt har minst en lektion, så en ny lektion måste läggas in i `MAP`. Lektioner som lärare skapar i redigeraren saknar koppling och listas som det i översikten.

- **Klassen** ("📋 Kursplanen och bedömningsunderlag" i lärarvyn): per punkt hur många elever som är klara, delvis klara eller bara "verkar kunna" (nivåtestet), och hur många lektioner punkten har. Filtreras per stadium.
- **Nedladdning (CSV, semikolon, öppnas i Excel):** en rad per elev och punkt med status, klara lektioner och andel rätt på första försöket, och en sammanfattning per elev (lektioner, uppgifter, aktiva dagar, förmågor, prov).
- **Underlag för en elev** (knappen "📋 Bedömningsunderlag" i elevens vy): en sida att skriva ut eller spara som PDF, med översikt, vad eleven täckt av centralt innehåll, indikationer för förmågorna, provresultat, nivåtest och en ruta för lärarens egen bedömning. En punkt är **klar** när alla dess lektioner är klara, **delvis** när någon är påbörjad, och problemlösning räknas av lösta textuppgifter. Av förmågorna kan loggen visa begrepp (begreppslektionerna), metod (räkneuppgifterna), problemlösning (textuppgifterna) och kommunikation (om eleven ritat eller skrivit på ritytan). Resonemang kan inte avläsas och lämnas åt läraren.
- Underlaget **sätter inget betyg**. Det visar vad eleven gjort på Gaussica och är ett stöd för lärarens bedömning.

## Lektioner för åk 3 till 5

Kopplingen till kursplanen visade luckor i de yngre årskurserna, så tolv lektioner har lagts till: Mönster (åk 3), Mäta längd (åk 3), Rutnät och riktningar (åk 3), Läs en tabell (åk 3), Halvor, tredjedelar och fjärdedelar (åk 3), Udda och jämna tal (åk 3), Säkert, möjligt, omöjligt (åk 3), Problemlösning: rita och prova (åk 4), Olika sorters trianglar (åk 5), Linjediagram (åk 5), Bråk, decimaltal och procent (åk 5) och Pris per kilo och per styck (åk 5). Alla har förklaring, regel, exempel, en uppgift, tre textuppgifter och övningsmallar för Öva mer, och följer reglerna om ord för de yngre åren.

## Färgteman och utseende

Eleven väljer färgtema under Konto, Utseende (`theme.js`). Fem teman: **Bubbelgum och marin** (standard: rosa ytor och marin knapp), Rosa dimma, Hallon och plommon, Korall och persika och Blå och kräm (utseendet som sidan hade förut). Ett tema är en komplett uppsättning färgvariabler (sidan, korten, tonerna, skuggorna, fokus) som läggs på `:root`, så ingenting annat på sidan behöver veta vilket som är valt. Färger som betyder något (grönt för klart, rött för fel, guld för mynt, djurens färger och landskapen i Resan) hör inte till ett tema.

- **Inget blink.** `theme.js` läses i `<head>` utan `defer` och lägger det senast valda temat på sidan innan något ritas. Valet kommer ihåg i webbläsaren (`gaussica.theme`) och sparas i kontot under nyckeln `theme` i elevens framsteg, så det följer med till andra enheter (vid inloggning gäller kontots val). Inloggningssidan använder webbläsarens val.
- **Standardvärdena i `styles.css` är Bubbelgum och marin** (`tests/theme.js` kontrollerar att de är desamma som i `theme.js`), så sidan ser rätt ut även utan JavaScript. De färger som bär sidans utseende (sida, kort, blå och rosa toner, textgrå, skuggor) är variabler. Nya teman läggs till i listan `THEMES`.
- **Läsbarhet.** Varje tema testas för kontrast: text mot sidan och korten, vit text på knappar och på rosa knappar, och fokusringen. Ett tema som är för ljust eller för svagt får inte in i listan.
- **Ett fokusfärg och en markeringsfärg** (följer temat) och `accent-color` för reglage och kryssrutor.
- **Mjukare text.** Rubriker är i vikt 800, text som läses i 600 och knappar och etiketter i 700 (det var 800 och 900 nästan överallt).
- **Kort på startsidan har ett sätt att ramas in:** samma kantlinje och mjuka skugga. Bara dagens steg (Din väg) och uppdragen från läraren har en egen kantfärg. Guld används bara för mynt.
- **En lugnare startsida.** Under rubriken "Idag" finns dagens steg (Din väg) först och sedan djuret. Resten (Mina knepiga, Resan, Snabbträning och Verkstaden) ligger under "Mer att utforska", som är stängd tills eleven öppnat den (valet kommer ihåg), med namnen på det som finns där, och en siffra på listan när det finns knepiga frågor.

## Hero: du, djuret och dagens steg

Hero-rutan på startsidan är en ren tvåkolumnsruta. Till vänster en **djurpanel** (`GaussicaPet.render(container, { layout: "hero" })`): pratbubbla med djurets replik, djuret i sitt rum (tryck på det så blir det glatt), namnet, mynten och en knapp till rummet och butiken. Till höger en hälsning, "Hej Kim!", och **dagens steg** som ett kort med en knapp (`GaussicaPathView.heroStep`): uppdraget från läraren, att fortsätta där eleven slutade eller första steget, med lektionens namn, hur många uppgifter som är klara, ett framstegsstreck och en knapp. Är allt klart står det i stället "Du har klarat allt just nu" och en länk till lärstigen.

- **Din väg fortsätter där hero slutar.** Under hero visar "Din väg" resten av stegen, numrerade från 2 (`hideNow`), så att samma steg inte står två gånger. Rubriken "Idag" är borta: hero är dagen.
- **Eleven utan djur** ser en inbjudan i panelen (tre djur och "Välj ditt djur"). **Lärare** och elever i klasser där djuret är avstängt får ingen panel, och texten tar hela bredden: rubriken "Utforska matematiken, en idé i taget" och en knapp till lärstigen, som förut.
- **På smala skärmar** ligger djurpanelen som en remsa ovanför texten (djuret till vänster, bubbla, namn, mynt och knapp bredvid).
- Det gamla hero-diagrammet med lärstigen, de svävande etiketterna, ordchipsen, anteckningen och djurkortet under "Idag" är borta, ungefär 90 CSS-regler med dem. `tests/theme.js` kontrollerar att hero har djurpanelen först och sedan rubriken och dagens steg, och inget av det gamla.

## Lektioner som fyller luckor i hela kursen

Efter åk 3 till 5 jämfördes lektionerna igen med kursplanen och med årskurserna. Det som saknades mest var algebra i åk 5 och 6 (inga lektioner alls), flera mål i åk 7 till 9 som bara hade en lektion, statistik och likformighet i åk 7 till 9 och målet "stegvisa instruktioner" i åk 1 till 3 (ingen lektion). Arton lektioner har lagts till:

- **Algebra:** Stegvisa instruktioner (åk 3), Obekant tal (åk 5), Formler (åk 6), Mönster: regeln för plats n (åk 6) och Från text till ekvation (åk 8).
- **Tid och mätning:** Kalendern (åk 3), Hur lång tid? Tidsintervall (åk 4) och Hastighet, sträcka och tid (åk 6).
- **Tal:** Avrunda decimaltal (åk 5), Division av bråk (åk 8) och Ränta på ränta (åk 9).
- **Data:** Relativ frekvens (åk 6), Diagram som kan vilseleda (åk 7) och Spridning: variationsbredd och lådagram (åk 8).
- **Geometri:** Area av sammansatta figurer (åk 7), Vinkelsumman i månghörningar (åk 7), Volym: prisma och cylinder (åk 8) och Likformighet och skalfaktor (åk 9).

Alla har problemet först, förklaring, regel, exempel, en uppgift, tre textuppgifter med ledtrådar och tre övningsmallar för Öva mer. Två nya mål lades till i `lgr22.js` (Spridningsmått och lådagram, samt Likformighet), och varje lektion är kopplad till sitt centrala innehåll. Testerna (`tests/lessons.js`, `tests/practice.js`, `tests/lgr22.js`) kontrollerar svaren, att ledtrådar inte är samma som rätt svar, att varje mall ger tillräckligt olika frågor och att varje lektion är kopplad till kursplanen.

## Femton lektioner till, och de första på gymnasienivå

Sajten säger "från åk 3 till gymnasiet", men det fanns inga lektioner efter åk 9. Nu finns åtta lektioner som fyller luckor i grundskolan och sju på gymnasienivå (årskurs 10, som visas som GYMNASIET i kartan):

- **Åk 3 till 6:** Uppskatta: är svaret rimligt? (åk 3), Kassakvitto: pris, summa och växel (åk 4), Delbarhetsregler (åk 5), Cirkeldiagram (åk 6) och Flytta, spegla och vrid i koordinatsystemet (åk 6).
- **Åk 9:** Rationella och irrationella tal, Ordningar: fakultet och permutationer samt Sannolikhet utan återläggning.
- **Gymnasiet:** Potenslagarna, Exponentialfunktioner, Logaritmer, Andragradsfunktioner och parabler, Sinussatsen och cosinussatsen, Förändringshastighet samt Punktdiagram och trendlinje.

Alla har samma form som de övriga: problemet först, förklaring, regel, exempel, en uppgift, tre textuppgifter med ledtrådar och övningsmallar för Öva mer. Gymnasielektionerna är kopplade till de centrala innehållen i åk 7 till 9 i `lgr22.js` (kursplanens sista steg i grundskolan), eftersom gymnasiets kurser inte ligger i den modellen än. Uttrycksspråket för övningsmallar fick funktionen `fact(n)` (fakultet). Lärare med matematikbakgrund bör läsa igenom förklaringarna innan de används i klass.

## Snabbträning

"Snabbträning" på startsidan (`fluency.js`, rutten `#traning`) tränar tabellerna och räknefakta i korta rundor om 5, 10 eller 20 frågor: multiplikation och division med tabellerna (2 till 10, valfria tabeller), tiokompisar, kompisar till 20 samt plus och minus till 20, eller en blandning. Det finns ingen klocka som tickar, inga mynt och inget streck att förlora. Vad som mäts är hur rätt och hur snabbt varje faktum är (svarstiden räknas från att frågan visas), och ett svar som blir fel kommer tillbaka en gång senare i samma runda.

- **Vingliga fakta kommer oftare.** Varje faktum ligger i en av fem lådor (0 till 4, enkel upprepning med mellanrum): rätt och snabbt flyttar upp en låda, rätt men långsamt håller det i minst låda 1, fel skickar det till låda 0. Valet av frågor till en runda vägs efter lådan, så vingliga fakta är med nästan varje gång och snabba sällan. Högst fyra av tio frågor är nya. Gränsen för "snabbt" är 3,5 till 6 sekunder beroende på typ (skrivtiden ingår).
- **Eleven ser framsteg, inte poäng:** efter rundan "snabbare än förra gången" (medianen av de rätta svaren), vilka som kommer tillbaka, och "Min karta" med alla fakta i färger från inte tränad till snabb.
- **Lagring.** I elevens framsteg under nyckeln `fluency` (statistik per faktum och de 40 senaste rundorna), så inget i databasen ändras. Läraren ser en rad i elevens vy. Logiken testas i `tests/fluency.js`.

## Repetition som sitter kvar

En klar lektion (med övningsmallar) får en plats i ett schema som kommer tillbaka efter 3 dagar, sedan 1, 3, 8 och 20 veckor om det går bra (`coach.js`, nyckeln `review` i elevens framsteg). Är det dags dyker lektionen upp som ett lugnt förslag i "Din väg" ("Dags att fräscha upp: …, det finns ingen brådska") och ingår i "Repetera", efter de lektioner där eleven nyligen svarat fel. Efter en runda flyttas lektionerna: rätt direkt på tre av fyra eller fler ger ett steg uppåt, ungefär hälften rätt ger samma steg men tidigare, och mest fel börjar om om två dagar. Det finns inga serier och inga krav, en lektion som väntar blir bara kvar. Elever med lång historik får sina lektioner utspridda, högst två om dagen från första dagen, så att inte allt kommer på en gång. Läraren ser antalet i schemat och hur många som är aktuella. Se `tests/spaced.js`.

## Verkstad

"Verkstad" (`workshop.js`, kortet på startsidan och knappen 🧰 överst i lektionsläget) har fem verktyg att bygga och prova med. Inget räknas eller sparas, och varje verktyg har en frivillig utmaning med kontroll:

- **Platsvärdesblock:** hundra-, tio- och entalsblock, växla 10 till 1 och 1 till 10, talet och talet i ord. Utmaning: bygg ett tal med så få block som möjligt.
- **Bråkstavar:** bitar från halv till tolftedel som läggs efter varandra, med summan som bråk, blandad form och decimaltal. Utmaning: bygg ett bråk med minst två olika sorters bitar (likvärdiga bråk).
- **Tallinje:** dra kulan eller hoppa, med bågar och ekvationen ("5 + 2 = 7"). Utmaning: gå till ett mål med så få hopp som möjligt (minsta antalet räknas ut).
- **Balansvåg:** hitta det dolda talet genom att lägga vikter, eller ta bort lika mycket från båda sidor tills x står ensamt.
- **Rutnät:** fria rutor eller dra en rektangel, med area, omkrets och multiplikationen. Utmaning: gör en form med en viss area och omkrets.

Beräkningarna bakom verktygen (växling, bråksumma, minsta antal hopp, area och omkrets) finns utan ritning i `logic` och testas i `tests/workshop.js`.

## Läsning och uppläsning

Knappen "Aa Läsning" (i toppmenyn och i lektionsläget, `reading.js`) öppnar inställningar som sparas i webbläsaren (`localStorage`, nyckeln `gaussica-reading`): **textstorlek** (vanlig, större, störst), **typsnitt** (Lexend, ett typsnitt som många med lässvårigheter tycker är lätt att läsa), **luftig text** (större radavstånd och ordavstånd) och **talhastighet**. Knappen "🔊 Lyssna" vid förklaringar och frågor läser texten med webbläsarens svenska röst (`speechSynthesis`). Matematiken görs om till ord: ett bråk blir "tre fjärdedelar", `2^3` blir "2 upphöjt till 3", `·` blir "gånger" och så vidare (`GaussicaSpeech.toSpeech`, testad i `tests/speech.js`). Vilka röster som finns beror på enheten. Utan svensk röst visas en rad om det.

## Arbetsblad

Läraren väljer "🖨 Arbetsblad" i lärarvyn (`worksheet.js`): en eller flera lektioner, antal uppgifter per lektion och om bladet är **ett till alla**, **ett per elev i en klass** (varje elev får andra tal, namnet står på bladet) eller **flera varianter**. Uppgifterna skapas av lektionernas övningsmallar, och lektioner utan mallar ger sina egna uppgifter. Bladet har figurer, plats för uträkning (rutor eller linjer), sant eller falskt som rutor att kryssa i och matchning som numrerade begrepp mot bokstäver. **Facit** hamnar på sista sidan med alla blads svar. Tryck "Skriv ut" och välj "Spara som PDF" om du vill ha en fil. Samma alternativ ger alltid samma blad.

## Offline och snabbare start

- **En fil för kursen.** Vid publicering samlar `npm run build` (`scripts/build-bundle.js`) index och alla lektioner i `lessons/bundle.json`, så sidan hämtar kursen i en förfrågan i stället för över hundra. Filen skapas av GitHub-workflowen och checkas inte in (den står i `.gitignore`). Finns den inte, som när du kör `npm start` lokalt, läser sidan lektionsfilerna en och en. Den lokala servern delar medvetet inte ut bundlen, så dina ändringar syns direkt.
- **Fungerar utan uppkoppling.** `sw.js` (registreras av `offline.js`) sparar sidans egna filer och typsnitten efter första besöket. Filerna hämtas alltid från nätet först, så en ny version används direkt när det finns uppkoppling. Allt under `/api/` och allt från databasen sparas aldrig av tjänstearbetaren.
- **Konto och framsteg utan nät.** De tre läsningar som sidan behöver vid start (`/api/me`, `/api/me/data`, `/api/lessons`) sparas i webbläsaren och används bara när servern inte går att nå. De tas bort när eleven loggar ut.
- **Svar utan nät.** Svar och framsteg som inte kan skickas sparas i webbläsaren (`gaussica.outbox.<användare>`) och skickas automatiskt när uppkopplingen är tillbaka, även efter att fliken stängts. En liten ruta överst visar att du är offline.
- **Installera som app.** `manifest.webmanifest` och ikonerna `icon-192.png` och `icon-512.png` gör att sidan kan läggas på hemskärmen eller installeras från webbläsaren. Ikonerna ritas av samma former som `favicon.svg`.

## Integritetstext

Texten "Så hanteras dina uppgifter" (`privacy.js`) visas från sidfoten och inloggningsrutan. Lägg gärna in en kontaktadress i `config.js` (`contact`), så visas den i texten. Om skolan eller huvudmannen använder sidan bör de också kontrollera texten mot sina egna regler för personuppgifter.

## För skolor: avtal, konsekvensbedömning och radering

Svenska skolor behöver ofta ett personuppgiftsbiträdesavtal, en konsekvensbedömning och besked om var uppgifterna lagras innan en tjänst får användas. Mappen [`docs/skola/`](docs/skola/README.md) har mallar och underlag på svenska:

- `personuppgiftsbitradesavtal.md`: avtalsmall enligt artikel 28 med bilagor för behandling, säkerhet och underbiträden.
- `konsekvensbedomning.md`: kort konsekvensbedömning med risker och åtgärder.
- `dataplats-och-underbitraden.md`: var databasen ligger (Cloudflare D1 med EU-jurisdiktion), vad som går till tredje part och hur man flyttar en databas till EU.
- `radering-och-gallring.md`: vem som kan radera vad, rekommenderad gallring och hur du som driver sidan raderar på begäran.

I själva tjänsten kan:

- **eleven** ladda ner sina uppgifter och radera sitt konto (Konto, Mina uppgifter; raderingen kräver lösenordet),
- **läraren** ladda ner en elevs uppgifter, radera en elev eller radera en hel klass (lärarvyn, Klasser, Radera klassen, där klassens namn måste skrivas för att bekräfta),
- **läraren** radera sitt eget konto, och då följer lärarens klasser och alla elever i dem med.

Raderingen tar bort allt som hör till kontot: svar, framsteg, ritningar, meddelanden, uppdrag, sessioner och feedback till tjänsten som personen skickat som inloggad. Den görs i Node-servern, Cloudflare-workern och demoläget med samma regler. `tests/api-delete.js` och `tests/worker-delete.js` kontrollerar att inget blir kvar och att ingen annans uppgifter berörs (workertestet kör workerns riktiga SQL mot SQLite). Mallarna är underlag, inte juridisk rådgivning: fyll i det som står inom hakparentes och låt skolans dataskyddsombud granska dem.

Typsnitten (Nunito och Lexend) ligger i mappen `fonts/` och hämtas från sidans egen server, inte från Google, så ingen elevs IP-adress går dit. De är fria typsnitt (SIL Open Font License), se `fonts/README.md`.

## Uppdrag och återkoppling

- **Uppdrag.** I lärarvyn (rutan "Uppdrag") ger du en klass, eller en enskild elev, en lektion att göra, med datum och en hälsning. Du kan också trycka "Ge som uppdrag" på en lektion när du är inloggad som lärare. Uppdraget räknas som klart när eleven klarat alla uppgifter i lektionen, och du ser per elev om den är klar, påbörjad eller inte påbörjad.
- **Återkoppling.** Under varje elev kan du skriva ett meddelande, och under varje fråga i elevens svarslogg kan du skriva om just den frågan. Lägg gärna till en dekal (⭐ 👍 💪 🚀 💡 🎉 ❤️). Du ser om meddelandet är läst.
- **Elevens vy.** Uppdrag och nya meddelanden visas i en stor rosa ruta överst på sidan, med en knapp i toppmenyn ("📬 Uppdrag" med antal), en rosa "UPPDRAG"-flagga på lektionen i grafen, en remsa på lektionssidan och hälsningen ovanför just den fråga den gäller. Knappen i hero-rutan blir "Gör uppdraget →". Sidan hämtar nytt var andra minut och när fliken blir synlig igen.
- **Databas.** Två nya tabeller, `assignments` och `feedback`. Node-servern uppgraderar sig själv. För Cloudflare: kör `npx wrangler d1 execute gaussica --remote --file=schema.sql` en gång och sedan `npx wrangler deploy` (se `cloudflare/README.md`).

## Fråga läraren (chatt)

- **Eleven.** Knappen "💬 Fråga läraren" finns i toppmenyn och uppe i varje lektion och övning. Skriver eleven därifrån följer uppgiften med: lektionen, frågan, det eleven hunnit svara och om det blev rätt eller fel. Eleven kan bocka ur "Visa läraren vilken uppgift jag tittar på". Svaret syns i samma ruta, med en gul remsa överst på sidan och en prick på knappen. En elev kan skicka sex meddelanden i rad innan läraren hunnit svara.
- **Läraren.** Rutan "💬 Frågor från elever" högst upp i lärarvyn visar varje samtal, med de olästa först, och uppgiften eleven tittade på under varje fråga. Svara direkt där, markera som läst eller tryck "Visa elevens svar". Ett svar räknas också som läst. Knappen "Lärarvy" visar antalet obesvarade frågor, och sidan hämtar nytt varje minut (utan att skriva över ett svar som du håller på att skriva).
- **Databas.** Tabellen `chat`. Node-servern uppgraderar sig själv (schemaversion 4). För Cloudflare: kör `migrations/003-chat.sql` en gång (se cloudflare/README.md). Tills dess fungerar resten av sidan som förut, och chatten svarar att den inte är påslagen.
- **API.** `POST /api/me/chat`, `POST /api/me/chat/read`, `POST /api/teacher/chat`, `POST /api/teacher/chat/read`, `GET /api/teacher/chat/unread`. Samtalen följer med i `/api/me/data` (elev) och `/api/teacher/students` (lärare).

## Feedback (e-post till dig)

- **Knappen.** "Skicka feedback 📣" finns i sidfoten och uppe i varje lektion och övning. Besökaren väljer Något är fel, Ett förslag eller Något annat, skriver och kan lämna sin e-post för att få svar. Från en lektion följer frågan med (om besökaren låter den göra det), och är besökaren inloggad följer namn och klass med.
- **E-post.** Servern skickar varje meddelande till dig via Resend (gratis för några hundra mejl i månaden). Skapa ett konto på resend.com med den adress du vill ha feedback på, skapa en API-nyckel och sätt `RESEND_API_KEY` och `FEEDBACK_TO` (din adress). Med Node-servern är det miljövariabler (`RESEND_API_KEY=… FEEDBACK_TO=… node server.js`), med Cloudflare är det secrets, se cloudflare/README.md. Utan en egen domän skickas mejlet från onboarding@resend.dev och kan bara gå till adressen du registrerade kontot med. Vill du ha en egen avsändare, sätt `FEEDBACK_FROM`.
- **Sparas även.** Varje meddelande sparas i tabellen `site_feedback` (Node: schemaversion 5, Cloudflare: kör `migrations/004-site-feedback.sql` en gång), så inget går förlorat om mejlet inte går fram.
- **Skydd.** Fem meddelanden per timme och adress, en dold ruta som robotar fyller i och längdgränser.
- **Demoläge.** Utan server öppnas besökarens e-postprogram med ett färdigt meddelande till `contact` i config.js.
- **API.** `POST /api/feedback`, öppet för alla.

## Introduktionssidor och regler i lektionen

- **Introduktionen delas upp.** En lång förklaring läses på flera sidor ("Del 1 av 3"). Texten delas mellan meningar (`explanationParts` i `lesson-model.js`, förkortningar som t.ex. och decimaler som 3,5 räknas inte som meningsslut) i sidor på ungefär 380 tecken, och varje sida visas i korta stycken. En text under ca 560 tecken är en enda sida. Figur och regelruta kommer på sista sidan. Texten är större än förut (19 px, 18 px på mobil).
- **"Problemet:".** Börjar förklaringen med "Problemet:" tas ordet bort ur texten och visas som en gul etikett, 🧩 Problemet, ovanför problemtexten.
- **Regler när som helst.** Knappen 💡 Regler uppe till höger i lektionen och övningen öppnar en ruta med regelrutan, figuren och en hopfälld "Läs förklaringen igen" (öppen direkt om lektionen saknar regel). Rutan stänger man med Tillbaka till uppgiften, ✕, Esc eller ett tryck utanför, och uppgiften och svaret är kvar. I en övningsrunda visas regeln för just den frågans lektion.

## Sant eller falskt

En frågetyp där eleven tar ställning till påståenden. Den passar särskilt bra i begreppslektioner, men fungerar överallt.

- **Så ser det ut för eleven.** Varje påstående har två knappar, Sant och Falskt, och under dem knappen Kolla svaret (den blir tryckbar när alla är besvarade). Eleven får veta hur många som är rätt och hur många som är fel, men aldrig vilka (att peka ut ett fel påstående är att ge rätt svar, eftersom det bara finns sant och falskt), inte heller efter flera försök. Är allt rätt visas en förklaring under varje påstående. Förklaringarna är alltså där man lär sig varför, inte bara att det var fel.
- **I lektionen.** Ett block i `components`, och ett eget uppdrag med id `sf-<blockets nummer>`:

```json
{ "type": "santfalskt", "prompt": "Sant eller falskt?", "shuffle": true,
  "statements": [
    { "text": "Ett kast med en tärning är ett försök.", "answer": true, "explain": "Ett försök är en gång du gör något där slumpen bestämmer." },
    { "text": "Det är omöjligt att få en sexa på en tärning.", "answer": false, "explain": "En sexa kan hända." } ] }
```

  `answer` ska vara `true` eller `false`. `explain` och `shuffle` (blandad ordning) är valfria. Blanda sanna och falska påståenden, annars är det lätt att gissa (`npm test` varnar). Påståendena visas som all annan text, så bråk, potenser och rötter ritas.
- **I redigeraren.** Lägg till blocket "Sant/falskt" och skriv påståendena, eller tryck "Skapa sant/falskt av korten" på ett begreppskort: då blir det sex påståenden av typen "Slump betyder: …", med rätt förklaring eller nästa korts förklaring, sanna och falska om vartannat. Läs igenom dem, för det är maskinskrivna påståenden. "Skapa av begreppskorten" under Övningsmallar gör också en sant/falskt-mall.
- **Övning och repetition.** I `practice` finns två nya slag av mall, båda med ett Sant/falskt-uppdrag som resultat och med `"for": ["sf-3"]` för att repetera just det uppdraget:
  - Lista: `{ "id": "sf", "mode": "santfalskt", "size": 4, "pool": [{ "text": "…", "answer": true, "explain": "…" }, …] }`. Varje gång väljs `size` påståenden slumpmässigt, med både sanna och falska när listan har båda.
  - Slumptal: en vanlig mall med `vars`, `derive` och `statements: [{ "text": "{a} + {b} = {s}", "answer": true }, { "text": "{a} är större än {b}", "answer": { "expr": "a-b", "min": 1 } }]`. `answer` är `true`/`false`, ett uttryck (`"=s"`, inte noll är sant) eller ett villkor `{ expr, min, max }` när sanningen beror på talen. Mallarna finns som färdiga startmallar i galleriet.
- **Lärarvyn.** Varje kontroll loggas som ett försök med elevens svar ("1: Sant · 2: Falskt") och vilka påståenden som var fel. Frågan till läraren (Fråga läraren) tar med påståendena.
- **Redan utdelade lektioner.** Lägger du ett sant/falskt-block i en lektion som redan är utdelad kommer det som en ny uppgift: elever som var klara med lektionen har då en uppgift kvar. Använd formatet i nya lektioner, eller lägg det i en kopia.

## Matematik i texten och språk för de yngre åren

- **Så skrivs det.** Alla texter, frågor och tabeller visar matematik som på papper (`richtext.js`): `1/2` blir ett bråk, `x^2` och `10^-3` får upphöjt tal (även negativt och `x^(-1)`), och `√50`, `√x` och `√(a + b)` ritas med rottecken och ett streck över talet under roten, utan parenteser. Rottecknet växer med det som står under det, till exempel `√((p/2)^2 − q)`. Skriv rötter så i lektionstexterna. Eleven skriver svar som `√2` eller `sqrt(2)`.
- **Yngre åk.** Ord införs i en lektion och används sedan bara i lektionerna nedanför den i trädet. I åk 3 undviker lektionerna svåra ord: man lägger ihop och drar ifrån, växlar (inte grupperar om), räknar på platser och gör ett överslag. Orden addera, subtrahera, summa, differens, produkt, kvot, term och faktor införs i "Begrepp: räknesätt och svar" (åk 4), och lektioner som använder dem har den som förkunskap. Platsvärde och position går bra från åk 4. Ordet utfall införs i "Begrepp: chans och slump" (åk 4), som kommer före lektionen om sannolikhet. `npm test` kontrollerar att inget av orden används i en lektion som kommer före sin begreppslektion (före åk 6).
- **Regler utan bokstäver.** Före algebran skrivs regler med ord och tal: "Du kan byta plats på talen: 3 · 7 = 7 · 3", "Area = längd · bredd", "Omkrets = 4 · sidan". Bokstäver som a, b och n som stand-in för tal används först från åk 6 (och x som okänt tal i lektionerna om likhet och balansvåg).

## Mobil och tangentbord

- **Följer det som syns.** `viewport.js` mäter den del av skärmen som är synlig (`visualViewport`) och skriver `--vv-h` och `--vv-top` på `<html>`. Lektionsspelaren, chatten, feedbackrutan och inloggningen använder dem i stället för 100 %, så de inte hamnar bakom tangentbordet. Metataggen `interactive-widget=resizes-content` gör samma sak åt Android.
- **Kompakt läge.** När ett textfält har fokus och den synliga höjden krympt (tangentbordet är uppe), eller på en mobil som hålls på tvären, får `<html>` klassen `is-keyboard` eller `is-short`. Då krymper spelaren: översta fältet visar bara förloppet och ✕, frågan upprepas ovanför svarsfältet, tipset begränsas till två rader, svarsfältet och knappen delar en rad, och Tillbaka och Hoppa över döljs tills tangentbordet försvinner.
- **Ritytan.** På skärmar under 640 px är ritytan ihopfälld ("Rita ▾") tills eleven öppnar den, om inget är ritat. Bredare skärmar visar den alltid.
- **Inzoomad rityta.** En ny teckning börjar inzoomad på smala skärmar, så att en ruta blir ungefär 20 bildpunkter och det går att trycka där man vill. Knappen med procenttalet går tillbaka till den storleken och ⤢ visar allt som är ritat. Sparade teckningar öppnas som de lämnades.
- **Svarsfält.** Svarsfältet och textrutorna på ritytan har autoversaler, autokorrigering och stavningskontroll avstängda, så att telefonen inte gör om x = 4 till X = 4. Rättningen ignorerar dessutom stora och små bokstäver (`symbolic-math.js`).
- **Fokus.** Ett fält som får fokus rullas fram om det skulle hamna bakom tangentbordet.
- Fungerar bara på riktiga telefoner fullt ut: testa gärna med tangentbordet uppe på både Android och iPhone.

## Svara med tal eller med uträkning

Där ett vanligt tal väntas som svar räknas en uträkning inte: "36/6" eller "3*6" är rätt värde, men eleven får tipset att räkna ut svaret och skriva talet. Det gäller åk 3–6, där poängen är att träna på att räkna. Från åk 7 tillåts uträkningar (lutning, ekvationer, formler), eftersom räknesteget då ses som enkelt. Frågor där svaret redan är ett bråk eller ett uttryck ("1/6", "x+3") påverkas inte.

Du kan styra det per lektion (fältet "Uträkning som svar" i redigeraren) eller per fråga, och per övningsmall, med `"allowExpression": true` eller `false`. Frågan går före lektionen, och lektionen före årskursen.

## Din väg och hela kartan

Eleverna ser först "Din väg": ett kort steg i taget med **Nu** (uppdrag från läraren, annars lektionen de håller på med, annars nästa lektion), upp till två **Sen**-lektioner och en **Pyssla**-lektion, med en stor knapp på varje kort. Hela lärandegrafen ligger bakom knappen "Visa hela kartan" (valet kommer ihåg). "Mer om lektionen" öppnar lektionsöversikten som en ruta över sidan, precis som ett klick på en nod i kartan (ingenting rullas, Esc, krysset eller ett klick bredvid stänger den, och fokus går tillbaka dit det kom från; testerna ligger i `tests/browser/popup.spec.js`). Lärare ser alltid hela kartan. Urvalet görs i `coach.js` (`path`) och ritas av `path-view.js`. **Årskursen syns tydligt:** varje förslag har en tydlig bricka (ÅK 7, GYMNASIET), och när lektionen ligger över elevens egen nivå står det hur långt över, till exempel "Det här ligger två år över din nivå (du verkar vara på åk 5)" med en mjukt markerad ruta när det är två år eller mer. Nivån räknas i `coach.js` (`levelOf`) som tre fjärdedelar uppåt bland årskurserna på de lektioner eleven är klar med (eller känner till enligt nivåtestet), och först när minst tre lektioner är klara eller nivåtestet är gjort. Elever utan nivå ser bara brickan. Det är bara en upplysning, inget stoppar eleven från att prova något svårare.

## Begreppslektioner

Lektioner med `"kind": "begrepp"` (märkta "BEGREPP" och "Aa" i grafen) lär ut vad matematiska ord betyder och testar sedan eleven genom att para ihop varje begrepp med rätt förklaring.

- `{ "type": "begreppskort", "cards": [{ "term", "definition", "example" }] }` visar begreppen som kort (steget "lär dig").
- `{ "type": "koppla", "prompt", "pairs": [{ "term", "definition" }] }` är ihopparningstestet, en egen fråga per omgång. Eleven väljer ett begrepp och en förklaring. Rätt par låses med en färg och ett nummer. Fel par loggas, och lärarvyn visar vilka begrepp som blandas ihop ("Blandade ihop X med Y"). Testet räknas som en uppgift i framsteg.
- Övningsmallar med `pool` ger fler omgångar: `"mode": "koppla"` (ihopparning, `size` par) och `"mode": "fraga"` (en förklaring, eleven skriver begreppet, `alt` anger andra godkända stavningar).

De åtta första lektionerna är: räknesätt, siffror och tal, former och mått, koordinatsystem, bråk och decimaltal, delare och primtal, statistik och chans samt algebra.

## Lärare: visa som elev

Knappen "👀 Visa som elev" i toppmenyn låter läraren se sidan som en elev ser den ("Din väg", rutan med uppdrag, kartan bakom en knapp). Ett rosa fält påminner om att man förhandsgranskar, och "Tillbaka till lärarvyn" tar en tillbaka. Svar man ger i elevvyn sparas på lärarkontot, inte hos eleverna. Valet minns tills fliken stängs.

## Stjärnor och märken

Eleverna får lätt och frivillig motivation, utan ranking och utan jämförelse mellan elever (`rewards.js`):

- **Stjärnor per lektion.** En stjärna för en klar lektion, två om de flesta svar blev rätt på första försöket och tre om alla blev det. De syns på lektionssidan, på slutskärmen och som en summa i toppmenyn (⭐).
- **Märken.** Till exempel "Första steget", "Fem klara", "Rätt direkt", "Ge inte upp", "Pysslaren", "Begreppsmästare", "Övaren" och "Uppdragsklar". "Mina märken" öppnas från stjärnan i toppmenyn och visar hur långt man kommit på de som saknas. När ett märke vinns visas en kort ruta och lite konfetti (inte om webbläsaren är inställd på mindre rörelse).
- **Ingen dagsmål-press.** Inget dagligt mål eller streak. Allt räknas ut från elevens egna svar, så inget extra sparas i databasen. Bara vilka märken som redan firats minns webbläsaren.
- **Läraren kan stänga av det.** I lärarvyns klasslista finns en ruta "Stjärnor och märken" per klass. När den är avstängd ser klassens elever varken stjärnor, märken eller konfetti. Inställningen ligger i tabellen `class_settings`.

## Lärarverktyg

- **Flera lektioner på en gång.** I rutan "Uppdrag" kan du lägga till flera lektioner (knappen "+ Lägg till fler lektioner"). Varje lektion blir ett eget uppdrag med samma klass, elev, datum och hälsning.
- **Öva mer som uppdrag.** Välj "Öva mer" under "Vad ska eleverna göra?" för att ge eleverna nya övningsfrågor i stället för själva lektionen. Uppdraget är klart när eleven svarat rätt på 5 olika övningsfrågor efter att uppdraget skapades. Det går bara för lektioner som har övningsmallar.
- **Förslag utifrån klassen.** Under formuläret visas lektioner där flera elever haft många fel de senaste veckorna (samma underlag som elevens "Repetera"). "Ge klassen Öva mer" fyller i formuläret, och "Ge bara dessa" skickar ett personligt uppdrag till de elever som behöver det.
- **Snabbsvar.** Ovanför varje meddelanderuta finns färdiga korta kommentarer. Skriv en egen text och tryck "+ Spara texten som snabbsvar" för att behålla den. Egna snabbsvar sparas i webbläsaren.
- **Rapport för utskrift.** "🖨 Rapport för utskrift" under en elev öppnar en ren sida med nyckeltal, lektioner, vad som är bra att öva mer på, uppdrag, senaste kommentarer och en ruta för egna anteckningar. Tryck "Skriv ut" och välj "Spara som PDF" om du vill ha en fil.
- **Redigeraren och begreppslektioner.** I redigeraren finns blocken "Begreppskort" och "Para ihop", typen "Begrepp (kort och matchning)" och, under lektionsinfo, rutan "Övningsmallar (Öva mer)". Knapparna "Skapa matchningstest av korten" och "Skapa av begreppskorten" bygger testerna och övningsmallarna åt dig. "Lägg till en räkne-mall" ger en mall att utgå från.

## Uppställning, potenser och Pythagoras i lektionerna

- **Uppställning steg för steg** (`figures.js`, typen `uppstallning`): `{ "type": "uppstallning", "op": "+" | "-" | "*" | "/", "a": 478, "b": 356 }`. Bilden ställer upp talen och eleven trycker på "Nästa steg". Varje steg markerar kolumnen, visar minnessiffror eller lån och förklarar med en mening. Multiplikation och division (kortdivision) tar en siffra som `b`. Figuren kan ligga som `visual`, eller som ett block i `components` och sedan i `layout`, så att en lektion kan ha flera exempel.
- **Pythagoras** (`type: "pythagoras"`): `{ "a": 3, "b": 4, "unit": "cm", "hideC": true }` ritar en rätvinklig triangel med en kvadrat på varje sida. `hideA`, `hideB` och `hideC` döljer en längd som eleven ska räkna ut.
- **Potenser i text.** Skriv `2^5`, `x^2` eller `(a+b)^2` så visas exponenten upphöjd, i alla texter, uppgifter och återkoppling.
- **Frågetexten** är större i lektionsläget, så att uppgifterna är lättare att läsa.

## Tester och mappar

- `npm test` kör alla kontroller: syntax i alla skript, alla lektioner (index, förkunskaper, svar och ledtrådar, inga × eller långa tankstreck), de genererade övningsfrågorna, hur svar jämförs och serverns API (startas på en ledig port med en tillfällig databas, så `data/` rörs aldrig). GitHub kör samma tester före varje publicering, så en trasig lektion stoppar publiceringen. Kör bara en del med till exempel `node tests/run.js lessons`.
- `tests/api-*.js` och `tests/practice.js` går också att köra var för sig. Cloudflare-API:t testas separat med `wrangler dev` (se `cloudflare/README.md`).
- Äldre statusrapporter och planer ligger i `docs/archive/`. Äldre skript och oanvända filer ligger i `dev/archive/`. `docs/` har guiderna för GitHub Pages och lärare, och `docs/logo-proposals/` har logotypförslagen.
- Nya svarsformer: `"form": "blandad"`, `"brak"` eller `"forenklat"` på en fråga kräver att rätt värde skrivs på ett visst sätt (1 3/4, 7/4 eller 2:3). Blandad form som `1 3/4` förstås som 7/4.
- Nya figurer: `tradiagram`, `parallellogram` och `trapets` (se början av `figures.js`).
- Uppställning av multiplikation med ett tvåsiffrigt tal (`"b": 23` med två siffror) visas med två rader och en slutlig addition. Figuren `vag` är en balansvåg: `{ "left": [{ "n": 7, "tone": "x" }, { "n": 3 }], "right": [{ "n": 10 }] }` ritar klossar och lutar efter vilken sida som väger mest. I en pyssla kan `n` vara ett uttryck som `"=x"`, så vågen ändras när eleven drar i ett reglage.

- Figurer för åk 5 till 9: `langdivision` (`a`, `b`: hela uträkningen med produkt och rest i varje steg), `areamodell` (`cols`, `rows`, `cells`: en rektangel delad i fyra, för (x + 3)(x + 2) och (a + b)²) och `trigonometri` (`angle`, `names`, `labels` med `hyp`, `opp`, `adj` och `angle`: en rätvinklig triangel med sidorna namngivna från en vinkel).
- Uttryck i övningsmallar kan även använda `sin`, `cos`, `tan`, `asin`, `acos` och `atan`, alla i grader. Mycket små tal skrivs ut med alla decimaler (0,0042).
- Svarsformer (`form` på en fråga): `blandad`, `brak`, `forenklat`, `utanparentes` (ett rätt svar som fortfarande har parenteser godtas inte, för uppgifter där parenteser ska multipliceras ut) och `grundpotens` (a · 10^n med a från 1 upp till 10). Kvadratrötter kan skrivas som √2 eller sqrt(2).
- Nya figurer för åk 4: `kroppar` (`items` med `shape`: kub, ratblock, cylinder, klot, kon, pyramid), `linjer` (`items` med `kind`: parallella, vinkelrata, skarande) och `strecktabell` (`rows` med `label` och `n`, `counts` visar antalet). Trapetsen kan visa sina parallella sidor med `"showHeight": false` och egna `labels`.

## Prenumeration för vårdnadshavare

Hemma-konton kan bli en prenumeration utan att något kostar att driva. Allt är avstängt tills du sätter på det, och alla konton som finns när migreringen körs har gratis åtkomst för alltid. Hela handboken, med startordning, Paddle, e-post på din egen domän och `scripts/admin.js`, står i [docs/prenumeration.md](docs/prenumeration.md). Kortfattat:

- **E-post för vuxna** (`server/account.js`, `cloudflare/worker.js`): vårdnadshavaren anger en adress som bekräftas med en länk, och "Glömt lösenord?" skickar en länk till en bekräftad adress (en timme, bara en gång; ett och samma svar oavsett om adressen finns). Mejlen går via Resend. Barn har ingen e-post.
- **Åtkomst** (`server/billing-core.js`, samma kod i workern, kontrolleras av `tests/billing-core.js`): gratis (orsak och ev. slutdatum), prov (14 dagar) eller betald. Barnen följer familjen, lärare betalar inte. Utan åtkomst får barn 402 när de försöker spara, och sidan visar en skärm för barnet och en för vårdnadshavaren (`subscription.js`). Ladda ner och radera går alltid.
- **Betalning med Paddle** (merchant of record: de är säljare och tar hand om moms, kvitton och återbetalning; privatpersoner och enskilda näringsidkare kan sälja): betalsida, kundportal och en signerad webhook som sätter familjens åtkomst. Reglerna och hela flödet testas mot en låtsas-Paddle i `tests/account-scenario.js` (Node-servern och workern).
- **Gratis åtkomst**: `node scripts/admin.js grant|revoke|show|code`, och koder som en vårdnadshavare löser in under Mitt konto.
- **Villkor**: texterna i `docs/juridik/` blir `villkor.html`, `integritet.html` och `angerratt.html` med `node scripts/build-legal.js`. De är utkast med [platshållare] tills `"utkast"` sätts till `false`; `tests/legal.js` vägrar färdiga sidor med platshållare kvar. De behöver läsas av någon med juridisk kunskap innan du tar betalt.
- **Databasen**: migreringen `cloudflare/migrations/008-account-billing.sql` (och version 9 i Node-servern) lägger till e-post, villkorsgodkännande, `entitlements`, `billing_events` och `access_codes`.

## Vårdnadshavare (hemma, utan skola)

När Gaussica används hemma finns ingen lärare och ingen klass. Då skapar en vårdnadshavare ett konto med knappen "Jag är vårdnadshavare" (ingen lärarkod behövs) och får en **familj** med en kod. Barnen skapar konto med familjekoden, eller så lägger vårdnadshavaren till deras konton själv (namn, användarnamn och lösenord, för barn som inte klarar det ensamma). En familj har plats för tio barn och varje vårdnadshavare har en familj.

**Så är det byggt.** Ett konto som vårdnadshavare är ett lärarkonto med markeringen `caregiver` (kolumn i `users`, migreringen `cloudflare/migrations/006-caregiver.sql`), och familjen är en klass. Därför fungerar uppdrag, återkoppling med dekaler, chatt, arbetsblad, målplanering, lösenordsåterställning, export och radering som för lärare, och en vårdnadshavare ser bara barnen i sin egen familj. Webbplatsen får rollen `caregiver` från servern (`publicUser`); ett barn vars familj tillhör en vårdnadshavare får `guide: "caregiver"`. Det en vårdnadshavare inte får är att ändra lektioner (`PUT /api/lessons/:id` kräver riktig lärare) och att skapa fler än en familj. Nytt API: `POST /api/teacher/students` (lägg till ett barn, även för lärare), i alla tre bakändarna (servern, Cloudflare och demoläget) med tester i `tests/api-caregiver.js` och `tests/worker-caregiver.js`.

**Vad vårdnadshavaren ser** (`teacher-view.js`, "Mina barn"): *Den här veckan* med ett kort per barn (dagar med övning, rätta svar, ungefärlig tid, vad barnet jobbat med och senast aktiv), *Att prata om* (det barnet inte fått rätt än, med barnets svar och rätt svar "för vuxna", och rådet att fråga hur barnet tänkte innan svaret visas), en knapp *Heja på* (en stjärna), familjekoden och formuläret för att lägga till barn, uppdrag, målplanering, arbetsblad och barnets alla försök. Skolsaker som prov, klassöversikten, svåraste uppgifterna och Bedömningsunderlag visas inte.

**Orden.** `words.js` byter orden där sidan själv talar: lärare blir vårdnadshavare, elev blir barn och klass blir familj för vårdnadshavaren (lärarvyn, kontot, felmeddelanden), och "din lärare" blir "din vårdnadshavare" för barnet (chatten, uppdragen, djurets ord). Lektionerna, svaren och det människor har skrivit ändras aldrig (`tests/words.js`, och webbläsartestet `tests/browser/caregiver.spec.js` letar efter ord som läckt kvar).

**Flera vuxna och flera klasser.** En klass eller familj kan ha flera vuxna (tabellen `class_guides`): den som skapade den har en kod för vuxna, och den andra vårdnadshavaren skriver koden när hen skapar konto ("Kod för vuxna") eller under "Gå med i en annan familj" i Mina barn. Båda ser då samma barn, uppdrag, hejarop och frågor, och den som skapade familjen kan ta bort en vuxen (en vuxen kan lämna själv). Ett barn kan vara med i flera klasser (tabellen `class_members`): en skolklass och en familj, med "Gå med i en klass eller familj till med en kod" i Mitt konto. Barnet ser uppdrag och hejarop från alla, och väljer vem hen frågar ("Vem frågar du?"). Det som läraren skrev stannar i skolklassen och det som föräldrarna skrev i familjen: hejarop och meddelanden hör till en klass (`class_id`), medan barnets framsteg och svar syns för alla vuxna, eftersom det är samma konto. Raderar man en klass behåller barn som är med i en annan klass sitt konto, och bara barn som inte har någon klass kvar raderas. Stjärnor och djur är på om någon av klasserna har dem på. Skolord och familjeord blandas inte: ett barn i båda ser "lärare" och "vårdnadshavare" med namn. Nytt API: `POST /api/me/classes` och `DELETE /api/me/classes/:id` (barnet), `POST /api/teacher/join` och `DELETE /api/teacher/classes/:id/guides/:userId` (de vuxna). Migrering för Cloudflare: `cloudflare/migrations/007-multi.sql`, som måste köras före driftsättningen. Tester: `tests/multi-scenario.js` körs mot servern, Cloudflare-API:t och demoläget (`tests/api-multi.js`, `tests/worker-multi.js`, `tests/local-multi.js`) och `tests/browser/multi.spec.js`.

**Hjälp för vuxna.** I översikten av en lektion (rutan som öppnas från kartan) har en vårdnadshavare en ruta "Hjälp för vuxna: så förklarar du det" med tre delar: *Så förklarar du det*, *Det här går ofta fel* och *Prata om det*, och ett *Facit till frågorna*. Rutan syns inte när sidan visas som barnet ser den. För 14 lektioner är texten skriven för hand i `parent-guides.js` (platsvärde, addition, subtraktion, multiplikation, division, division med rest, tid, pengar och växel, bråk, täljare och nämnare, negativa tal, area, decimaltal och procent); de är utkast som en lärare bör läsa. För alla andra görs hjälpen av lektionens egen text i `parent-guide.js`: frågan lektionen börjar med, regeln och exemplet, och tipsen lektionen ger för vanliga felsvar blir "det här går ofta fel". Under "Att prata om" i veckokortet står dessutom ett mönster om sidan känner igen det ("Glömde att växla") och en knapp som öppnar hjälpen för just den lektionen. Test: `tests/parent-guide.js` och `tests/browser/caregiver.spec.js`.

**Hemma och integritet.** Texten "Så hanteras dina uppgifter" har ett eget avsnitt, "Hemma: för vårdnadshavare" (`privacy.js`): vårdnadshavaren ansvarar för barnets konto, ser barnets framsteg, kan ge andra vuxna koden och ta bort dem, ladda ner allt om barnet och radera barnet eller familjen. Skolans avtal och konsekvensbedömning gäller inte hemma. När en vårdnadshavare skapar ett konto åt ett barn måste hen kryssa i att hen är barnets vårdnadshavare och godkänner att kontot skapas (och kan läsa texten med ett klick). Kryssrutan är en bekräftelse i formuläret; servern sparar inget om den.

**Inte gjort än** (förslag, i ungefär den ordning de är värda att göra):
- Ett veckobrev med sammanfattningen per e-post (kräver att vårdnadshavaren anger en adress; Resend används redan för feedback).
- Skärmtid: en vårdnadshavare ställer in "klart för idag efter 20 minuter", med ett vänligt stopp i spelaren.
- Egna belöningar: vårdnadshavaren skriver vad mynten kan bytas mot ("välja film", "glass på lördag") och godkänner när barnet vill lösa in.
- Bildinloggning eller PIN för barn som inte kan skriva lösenord än.
- "Vad gör vi i skolan nu?": välj ämnet från skolans läsår (kursplanen i `lgr22.js` finns redan) så att övningen hemma följer det barnet möter i klassrummet.

## Mönster i felsvar (siffror)

`symbolic-math.js` känner igen fel i algebra. `misconceptions.js` känner igen fel i tal: glömd växling, att minska det mindre talet från det större, ett andra rad som inte flyttats i uppställningen, att lägga ihop i stället för att multiplicera, att lägga ihop täljare och nämnare, att tro att fler decimaler är större, minustecken som tappats, glömd delning med 100, fel växlingstal mellan enheter (cm och m, dl och l, g och kg), siffran i stället för dess värde, och 100 minuter i en timme. Ett svar känns bara igen om det är precis det som felet ger, och bara när frågan är den uträkningen (rätt svar måste vara det talen och tecknet ger). Det som lektionen själv skriver om ett felsvar går före. Då får eleven "Upptäckt mönster: ..." med en förklaring, och mönstret syns för läraren och vårdnadshavaren. Ett nytt mönster läggs till som en funktion i `misconceptions.js` med fall i `tests/misconceptions.js`. Vad som händer när inget mönster passar står under "Återkoppling vid fel svar" nedan.

## Återkoppling vid fel svar

Ett fel svar får tips i den här ordningen: lektionens egna regler (`feedback` på uppgiften), mönster som `misconceptions.js` och `symbolic-math.js` känner igen, och sist de försiktiga tipsen i `slips.js`. Först när inget av det passar får eleven det allmänna "Det svaret stämmer inte riktigt ännu".

**Försiktiga tips (`slips.js`).** För ett svar som är ett vanligt tal, när inget känt mönster passar, säger sidan vad som troligen hände, som en fråga eller en pekning, aldrig lösningen:
- *Ett första steg*: svaret är det en del av rätt väg ger ("Det ser ut som att du har räknat 3 · 12, och det kan vara ett första steg. Är du klar, eller fattas något?"). Rätt väg hittas genom att prova alla sätt att räkna med talen i frågan, och sägs bara när den är tydlig.
- *Ett annat räknesätt*: svaret är vad ett enda annat räknesätt med två av talen ger ("Det ser ut som att du har lagt ihop 12 och 5. Är det den uträkningen frågan vill ha?"), bara när exakt en uträkning ger svaret.
- *Annan ordning*: samma tal och tecken som rätt väg, men ihopsatta på ett annat sätt (40 + 12 · 5 räknat som (40 + 12) · 5).
- *Ett tal ur frågan*: svaret står redan i frågan.
- *Ett slarvfel i skrivandet*: siffrorna i annan ordning ("Tänk på ordningen i ditt svar."), en siffra för mycket eller för lite, kommatecknet eller nollorna, avrundat, eller mycket nära. Tipset säger att något är fel i skrivandet, inte vad det ska vara.
- *Storleken*: "Ditt svar verkar för stort. Vad kan ha blivit fel?", med några olika formuleringar som turas om (och för mycket stort eller litet, lite för stort eller litet, och om tecknet är det motsatta: "Kan svaret verkligen vara negativt här?"). Det är ett tips utan mönster, så läraren ser det som "Generellt beräkningsfel".

`tests/slips.js` provar tipsen på varje talfråga i kursen, de fasta och de som Öva mer gör (omkring 47 000 felsvar): inget tips innehåller rätta svaret, och varje uträkning som ett tips nämner ger just det svar som eleven skrev.

**Tydligare vid fel (`feedback-signals.js`).**
- Svarsfältet får en korallfärgad ram och skakar till (inte för den som bett om mindre rörelse). Ramen går när eleven ändrar svaret, men tipset ligger kvar medan svaret ändras.
- Tipset klipps inte längre av efter tre rader med tangentbordet uppe: rutan växer upp till en tredjedel av den synliga höjden, och om tipset ändå är längre står det "Fler rader, rulla" tills slutet är nått.
- Under **Läsning** finns två inställningar: *Vibrera lite när svaret blir fel* (på, på telefoner som kan) och *Läs upp tipset av sig självt när svaret blir fel* (av, eftersom ljud i ett klassrum är en överraskning).
- Kommer ett andra fel svar snabbare än tipset hinner läsas (omkring 1,2 sekunder plus 0,26 sekunder per ord, mellan 2,5 och 7 sekunder) tas nästa felaktiga svar inte på tre sekunder: "Kolla svaret" visar "Läs tipset först…", tipset pulserar och djuret ber eleven läsa. Alla svar rättas ändå, och ett rätt svar tas alltid direkt.

**Rättare tips.** `symbolic-math.js` letade efter fasta tal som 16 och 260 och efter bråk i lektionens förklaring, så "Ekvationsbalans" kunde dyka upp på en fråga om bussar. Nu läses varje diagnos ur frågans egna tal (ax + b = c, a − (b + c), bråk med division, "hur många fler"), och exemplen i `misconceptions.js` (växling, decimaler) använder frågans tal i stället för 8 + 6.

**Kontroller av återkopplingen (`tests/feedback-lint.js`, med i `npm test`).** Varje regel i varje lektion och i varje mall (byggd med 40 olika slumptal) kontrolleras: ett felsvar som är det rätta svaret, en regel som aldrig kan nås eftersom tidigare regler redan tar alla dess svar, en regel som aldrig gäller med något tal, ett tips som säger en uträkning som inte stämmer ("12 + 5 = 18"), och att de automatiska tipsen bara nämner tal ur frågan eller svaren. Att ett tips nämner ett tal som inte finns i frågan listas som varning (`node tests/feedback-lint.js --all`). Kontrollen hittade en regel i `brak` som aldrig kunde nås och som gav fel tips åt svaret 1/2.

**Felsvar utan eget tips.** Läraröversikten har en lista "Felsvar utan eget tips": de felsvar som många elever gav och som bara fick det allmänna tipset, per fråga, med rätt svar och en knapp som laddar ner listan som text. Samma lista går att göra av en export (Exportera data, JSON) med `node scripts/feedback-gaps.js gaussica-elever-2026-11-03.json` (`--top 10`, `--json`). Skriptet skriver ut frågorna och svaren, inga namn, och för varje fråga raden att lägga i `feedback` i lektionsfilen. Öva mer-frågorna får en post per mall med några exempel (ett felsvar på en fråga säger inget om nästa, som har andra tal). Logiken finns i `gaps.js`.

## Begreppsövning, stavning och ordbank

**Öva mer i begreppslektionerna.** De nio lektionerna `begrepp-*` hade tre mallar (para ihop, förklaring till begrepp, sant/falskt) med tio begrepp och en fast förklaring var, så man lärde sig förklaringens nyckelord. De har nu 91 mallar till, gjorda med slumptal så att svaret inte går att lära sig utantill:
- **Begreppet på ett verkligt tal**: "54 + 24 = 78. Vad kallas talet 78?" (summa, term, differens, produkt, faktor, kvot), "I talet 539 står siffran 3 på en plats. Vad kallas platsen?", "I bråket 3/7 står talet 3 över bråkstrecket", "I uttrycket 6x + 3 kallas talet 6 något särskilt", "Punkten (5, 0) ligger på en av axlarna".
- **Tvärtom, med ett tal som svar**: "Vilket av talen 54, 24 och 78 är summan?", "Vilket tal är nämnaren i 3/7?". Eleven måste läsa det som står.
- **Använd begreppet till något**: "Räkna ut produkten av 6 och 4", "Vad är differensen mellan 68 och 16?", "Vad blir resten när du delar 57 med 6?", "Vad är medianen av 21, 15, 12, 7, 19?" (med talen i blandad ordning). Felsvaret som är en annan räkning får ett eget tips ("Du har räknat summan. Produkten är svaret när talen multipliceras").
- **Sortera efter vad som hör ihop**: räknesätt (summa, term, plus … till addition), platser i ett tal, bråk, decimaltal och procent, primtal och sammansatta tal, omkrets och area, x-axeln och y-axeln, uttryck och ekvationer, säker, omöjlig och möjlig, medelvärde, median, typvärde och variationsbredd.
- Förklarings-frågan (`fraga`) säger nu också vad ett annat begrepp betyder när eleven skriver det ("Produkt betyder: Svaret på en multiplikation. Det är inte det som frågas.").
Mallarna är vanliga mallar i `practice` (`tests/practice.js` bygger varje med 300 olika slumptal och `tests/feedback-lint.js` kontrollerar deras tips). Fler begreppslektioner får samma sorts mallar genom att man följer mönstret i `lessons/begrepp-rakna.json`.

**Flera sätt att fråga, begrepp som lätt blandas ihop, och hur väl varje begrepp sitter.**
- **Förklaring eller exempel.** Varje begrepp i en begreppslektion har två meningar som använder det (`examples` på begreppet i mallens `pool`). Förklaringsfrågan (`fraga`) ställs ibland med förklaringen och ibland med en av meningarna där ordet är borttaget ("I 3 + 4 = 7 är 7 ___." Vilket ord fattas?). Para ihop (`koppla`) visar för varje par antingen förklaringen eller en mening med ordet borttaget. Ordet gömmer sig i alla former som godtas (summa och summan), och en mening som skulle lämna kvar en del av ordet används inte.
- **De som lätt blandas ihop kommer tillsammans.** En runda Para ihop börjar med ett slumpat begrepp och tar sedan de tre vars förklaringar liknar dess förklaring mest (de delar flest ord: "Svaret på en addition", "Svaret på en subtraktion", "Svaret på en multiplikation", "Svaret på en division"), så att eleven inte kan para ihop på nyckelordet. Ordbanken i förklaringsfrågan erbjuder samma närmaste begrepp.
- **Hur väl varje begrepp sitter (`terms.js`).** Mallarna säger vilka begrepp de handlar om (`terms`) och hur mycket de kräver (`level`: 1 känna igen, 2 komma ihåg, 3 använda på tal eleven inte sett förut). Av svaren som redan finns, utan att något nytt sparas, räknas varje begrepp ut som *ny*, *övar*, *kan* eller *säker*. Säkert blir det först när eleven har använt det på två olika frågor med nya tal, skrivit det för en förklaring, och inte nyss svarat fel (inte två av de tre senaste). Ett fel svar gör begreppet svagt. Lektionssidan visar "Dina begrepp: 4 av 10 säkra" med varje begrepp, och Öva mer frågar oftare om de begrepp som inte är säkra och ber om att använda dem när de bara kan förklaras (`GaussicaPractice.fresh` tar fram åtta frågor och drar en, de som behövs mest med störst chans).

**Frågor som lär ut idén.** Fem lektioner som mycket annat bygger på fick nya Öva mer-frågor (45 mallar), gjorda för att eleven ska förstå och inte bara träna en sorts uppgift med andra tal: platsvärde, bråk (del av helhet, likvärdiga bråk), negativa tal och procent. Slagen är:
- **Hitta felet** i en uträkning med ett typiskt tankefel ("1/8 är större än 1/4 eftersom 8 är större än 4", "−3 + 5 = −8", "25 % rabatt på 400 kr är 400 − 25"), med förklaring av vad som är fel och en ledtråd.
- **Sant eller falskt om missuppfattningarna**, med förklaring: "Först 50 % rabatt och sedan 50 % till ger 100 % rabatt", "Lägger du till samma tal i täljare och nämnare får du ett likvärdigt bråk".
- **Sortera och ordna med resonemang**: bråk som mindre än, precis eller mer än hälften, tal med samma siffror i olika ordning, temperaturer, 25 %, 50 % och 10 % som bråk, decimaltal och ord.
- **Luckor som är ett resonemang**: "Från −2 går du 8 steg åt höger. Efter ___ steg är du på noll, och sedan går du ___ steg till."
- **Figurer att läsa**: två figurer delade i olika många delar ("Är det lika mycket färgat i dem?").
- **Samma idé åt andra hållet**: "10 % av ett tal är 12. Vad är hela talet?", "Du har 1/8 av en pizza. Hur många åttondelar saknas?", "Temperaturen blev −2 efter att den sjunkit 4 grader. Vad var den först?", och att uppskatta utan att räkna ("Är 75 % av 120 mer eller mindre än hälften?").
Alla har tips som säger vad som gick fel, och `tests/practice.js` och `tests/feedback-lint.js` kontrollerar dem.

**Stavning (`spelling.js`).** En elev kan kunna ordet utan att kunna stava det än. I frågor där svaret är ett ord räknas ett svar som är nästan rätt stavat som rätt ord: "sumna" och "suma" för summa, "taljare" för täljare, "jamnt" för jämnt. Eleven får se hur ordet stavas ("Ordet stavas ”summa”."). Det som räknas som en felstavning är samma ord med å ä ö skrivet a och o, dubbla bokstäver skrivna enkla, ck som k, w som v, en bokstav för mycket, för lite eller fel, eller två bokstäver som bytt plats (åtta bokstäver eller fler får två fel). Ord under fyra bokstäver ändras aldrig, bara å ä ö och dubbelskrivningen. Säkerheten är att svaret aldrig tas för en felstavning om det är lika nära ett annat ord i lektionen (felsvaren som har egna tips, begreppskortens ord och övningsmallarnas begrepp): "produkt" blir aldrig "summa", och "yaxeln" blir aldrig "x-axeln". `tests/spelling.js` kontrollerar det på alla ord i kursen: ingen felstavning tas för ett annat ord, och 211 av 212 vanliga felstavningar av begreppen tas för rätt ord. Siffror, bråk och uträkningar rörs aldrig. En fråga kan kräva exakt stavning med `"exact": true`.
- **Inställningen** finns under Läsning (på enheten): nästan rätt räknas och rätt stavning visas (standard), nästan rätt räknas utan notis, eller bara exakt stavning.
- **Läraren och vårdnadshavaren** ser att svaret räknades med stavfel: försöket får rubriken "Stavning: skrev ”sumna”, ska vara ”summa”", och läraröversikten visar dem under "Stavning" i stället för bland missuppfattningarna. De hamnar inte heller i "Felsvar utan eget tips".
- **Inte gjort:** en inställning per klass eller familj (den skulle behöva en ny kolumn i databasen, alltså en ny migrering), och en egen stavningsövning ("Mina ord").

**Ordbank (`wordbank.js`).** I en fråga där svaret är ett ord står det under svarsfältet det rätta ordet och några som det lätt blandas ihop med (orden i frågans egna tips, eller en lista `bank` på frågan, och för en fråga utan sådana begreppen i lektionen), att trycka på i stället för att skriva. Då är stavningen inget hinder medan det handlar om att kunna begreppet. Den försvinner när det går bra: den visas alltid först, efter åtta poäng bara efter ett fel svar, och efter sexton poäng bara när man trycker på "Visa ordbank". Ett rätt svar ger en poäng om ett ord trycktes och två om det skrevs, så den som bara trycker stannar kvar längre. Under Läsning kan den hållas på alltid eller av. Frågor med tal som svar, ja eller nej, och val mellan bara två ord får ingen ordbank.

## Algebra: kontrollera steg, förklara fel och visa idén

Algebraspåret har fått verktyg för att kontrollera hur eleven tänker, inte bara vad svaret blir. Logiken ligger i `algebra.js` (testad i `tests/algebra.js`), skärmarna i `steps.js`, `substitution.js`, `mathinput.js`, `worked-steps.js` och `figures-algebra.js`.

**Räknaren läser rätt.** `symbolic-math.js` tolkade −x² som (−x)², så −x² och x² räknades som lika. Minustecknet framför en potens gäller nu hela potensen (−x² är −(x²), och 2^−1 går bra), och x² och x³ i svaret läses som potenser.

**Lös steg för steg (`steps.js`).** I lektioner med `"stepSolve": true` (Låt båda sidor väga lika, Ekvationer med x på båda sidor, Parenteser och förenkling, Kvadreringsreglerna, Andragradsekvationer, Samla lika termer, Bryt ut en gemensam faktor) finns en ruta över svarsfältet där eleven skriver lösningen rad för rad. Varje rad kontrolleras mot raden ovanför: den ska ha samma lösningar (ekvationer, upp till grad två) eller samma värde (uttryck). En rad som är fel säger vad som troligen hände utan att nämna ett tal i lösningen: en term som flyttades utan att byta tecken, något som bara gjordes på ena sidan, bara några termer som delades, fel räknesätt för att få x ensamt, eller ett räknefel. "Gör samma sak på båda sidor" låter sidan göra steget (plus, minus, gånger, delat med), vilket är själva metoden. När x står ensamt fylls svaret i. Allt är frivilligt, och stegen sparas med svaret så att läraren ser hur eleven tänkte. Första lektionen om x (Uttryck med x) har ingen steg-ruta, eftersom eleverna då inte ska lösa med algebra än.

**Svaret sätts in i ekvationen (`substitution.js`).** När eleven svarar på en fråga om en ekvation spelas kontrollen upp som på papper innan svaret rättas: ekvationen, svaret i stället för x (3x + 2 = 14 blir 3 · 5 + 2 = 14), vad de två sidorna blir (17 = 14) och sedan antingen "Det stämmer inte riktigt, försök igen" eller (14 = 14) "Det stämmer: båda sidorna blir 14". Ett klick eller ännu ett tryck på Kolla svaret hoppar till slutet, med mindre rörelse visas allt direkt, och en skärmläsare får hela kontrollen som en mening. Ekvationen hämtas ur frågan (`GaussicaAlgebra.extractMath`), så ingen lektion behöver ändras. `tests/algebra.js` sätter in det rätta svaret i varje ekvation i algebrafrågorna (192 st, med Öva mer) och kräver att sidorna blir lika: ett fel i en lektion hittas på så sätt.

**Bibliotek över algebrafel (`algebra.js`, `diagnose`).** Svar på uttryck jämförs med vad en enda felaktig regel ger: bara första termen multiplicerad in i parentesen, (a + b)² som a² + b², (2x)² som 2x², minustecknet som bara gäller första termen, bara en term delad, termer som inte är lika ihoplagda, exponenter multiplicerade i stället för adderade, √(a + b) som √a + √b, och teckenfel. Svar på ekvationer jämförs med vad ett felaktigt steg ger (flytt utan teckenbyte, halvfärdig lösning, multiplicerat i stället för delat, delat tvärtom, fel tecken, bara ena sidan). Tipset säger vad som hände och ger en kontroll med tal: "Prova: med x = 2 blir uttrycket i frågan 18, men ditt svar blir 10. De är inte lika." Det sägs bara när exakt en regel ger svaret. Lektionens egna regler går före.

**Förenkla betyder så kort som möjligt.** En fråga som börjar med Förenkla eller Utveckla godtar inte bara rätt värde: 4x + 5 − x för 4x + 3 − x + 2 har rätt värde men x-termerna ligger kvar åt varsitt håll, och det får svaret "Det stämmer, men du kan förenkla mer" (`simplifyNote` i `algebra.js`). Termer med samma bokstäver (xy och yx är samma term, x och x² är det inte) och vanliga tal ska vara ihoplagda, och en parentes som går att multiplicera ut ska vara borta (men inte parentesen i sqrt(2)). Kontrollen gäller bara när det rätta svaret självt är förenklat, och inte bråk. `tests/algebra.js` kontrollerar att det rätta svaret i alla 170 Förenkla- och Utveckla-frågor i kursen godtas.

**Skriva matematik (`mathinput.js`).** Lektioner med `"input": "math"` har knappar under svarsfältet för x², xⁿ, √, bråk, parentes, · och −, som inte tar fokus (tangentbordet på en telefon stannar uppe), och en rad som visar det skrivna som på papper (upphöjt, bråk med streck, rot). Tecknen som en fråga själv anger i `keys` (< > ≤ ≥) kommer efter.

**Modeller och arbetade exempel.**
- `{ "type": "ekvationsmodell", "a": 3, "b": 2, "c": 14 }` (eller `"d"` för x på högra sidan) är en ekvation med bitar: rutor x och ettor, en knapp för nästa steg och symbolerna bredvid som byts samtidigt: 3x + 2 = 14, 3x = 12, x = 4 (`figures-algebra.js`). Vågen väger lika hela tiden, och det som tas bort tas bort från båda sidor.
- `{ "type": "hoppa-pa-linjen", "title", "intro", "min", "max", "start", "hops": [1, 3, 5], "thermometer", "missions": [{ "text", "start", "target" | "above" | "below", "done" }] }` är en tallinje att leka på (`hopplek.js`): elevens eget djur står på linjen och hoppar dit knapparna eller en tryckning på linjen säger, hoppet ritas som en pil och skrivs som en summa (−3 + 5 = 2), en termometer visar samma tal som temperatur och några uppdrag ber om att landa på ett visst ställe. Pilknapparna hoppar ett steg. Inget betygsätts och inga mynt delas ut. Utan djur (eller med djuren avstängda) är det en liten rund hoppare, och med reducerad rörelse står djuret bara där det landar. Komponenten får en egen sida i lektionsspelaren.
- `{ "type": "arbetat-exempel", "title", "intro", "start", "steps": [{ "line", "say", "wrong"? }], "figure"?, "note"? }` är ett exempel som läses ett steg i taget, med vad som gjordes till varje rad och eventuellt en figur (areamodell) ovanför. Ett steg med `"wrong": [...]` (en till tre vanliga felsteg) visas inte direkt: eleven väljer först vad som ska göras härnäst, bland första meningen i `say` och de felaktiga, och raden kommer när valet är rätt. Efter två felval kan steget visas ändå, och "Visa alla steg" finns alltid, så ingen fastnar. Beräkningssteg utan något att välja mellan har ingen `wrong` och visas direkt. `tests/algebra.js` kontrollerar att varje rad i varje arbetat exempel är samma som raden ovanför och att `wrong` är välformad.

**Tre nya lektioner.** Samla lika termer (åk 7, före Parenteser och förenkling), Bryt ut en gemensam faktor (åk 8, efter den) och Olikheter (åk 8, efter ekvationerna med x på båda sidor). Var och en har ett arbetat exempel, sortera, hitta felet, sant eller falskt, fyra frågor och Öva mer med både slumptal och mallar som lär ut idén. För bryta ut har frågor `"form": "utbrutet"`: svaret måste ha en parentes och den största faktorn utbruten (6x + 9, 2(6x + 9) och 2(3x + 4,5) är alla lika med 3(2x + 3), men bara det sista är klart). Olikheter kontrolleras som x < 4 och 4 > x lika, ≤ och <= lika, och steg kontrolleras med vändning av tecknet vid division med ett negativt tal.

## Koden är delad i filer

`app.js` var en enda fil på 3 800 rader. Det som hänger ihop och inte behöver dela tillstånd har flyttats till egna filer som får det de behöver från `app.js` genom `init()` (sist i `app.js`): `dom.js` (små verktyg: `makeElement`, `downloadJSON`), `visuals.js` (diagram, tabeller och figurer som block, bråkmodellen), `patterns.js` (problemmönster), `questions.js` (frågorna eleven möter: begreppskort, para ihop, sant eller falskt, formaten och frågan med svar), `account.js` (Mitt konto) och `admin-page.js` (lärar- och vårdnadshavarsidan). `slips.js`, `feedback-signals.js` och `gaps.js` (se "Återkoppling vid fel svar") och `spelling.js`, `wordbank.js` och `terms.js` (se "Begreppsövning, stavning och ordbank") och `algebra.js`, `steps.js`, `substitution.js`, `mathinput.js`, `worked-steps.js` och `figures-algebra.js` (se "Algebra: kontrollera steg, förklara fel och visa idén") är också egna filer. `app.js` har kvar kursen, kartan, popupen, hjälten, framstegen, inkorgen och rutterna. En ny fil läggs in i `index.html` före `app.js`; servern och publiceringen hittar den där.

## Webbläsartester och CI

`npm run test:browser` kör riktiga webbläsartester med Playwright (`tests/browser/`): startsidan, lektionsformaten, Verkstad, Pyssla, ritytan, djuret, telefonstorlek, kurvorna, Öva mer för formaten, lektionsredigerarens formulär, tillgänglighet och tangentbord. Testerna startar en egen webbserver på port 8126 med demoläge (konton och data finns bara i webbläsaren), så varken `data/` eller Cloudflare rörs. Första gången: `npm ci` och `npx playwright install chromium`. Har du Chrome installerat går det att hoppa över nedladdningen med `PW_CHANNEL=chrome npm run test:browser`. `npm run test:all` kör alla kontroller och webbläsartesterna. `npm run test:changed` kör enhetstesterna och bara de webbläsartester som hör till filerna du har ändrat sedan senaste commit (`--base main` jämför med main, `--dry` visar bara vilka som skulle köras, `--all` kör allt). Vilka tester en fil hör till står i `RULES` i `scripts/test-changed.js`; en lektion hör till de tester som nämner den. Det är ett hjälpmedel medan du jobbar: kör hela sviten innan du pushar.

GitHub kör kontrollerna vid varje push och pull request (`.github/workflows/test.yml`: ett jobb för `npm test` och ett för webbläsartesterna), och publiceringen till Pages (`deploy-pages.yml`) körs bara om båda är gröna.

## Tillgänglighet

`tests/browser/a11y.spec.js` kör axe-core (WCAG 2 A och AA) på startsidan, inloggningen, lektioner med de nya formaten och kurvor, Verkstad, djurets rum (alla flikar), läsinställningarna, Snabbträning och Mina knepiga. `tests/browser/keyboard.spec.js` provar tangentbordet: djurets rum och läsinställningarna öppnas med Enter, stängs med Esc och fokus går tillbaka dit det kom från, Sortera och Ordna går att lösa utan mus, Esc lämnar en lektion och första Tab hamnar på "Hoppa till innehållet". Det som rättades efter första körningen: stegindikatorn i lektionerna var en `progressbar` med knappar i (nu en grupp med `aria-current` på aktuellt steg), kartan i Resan var en bild med knappar i, knappar hade egna `aria-label` som inte innehöll den synliga texten (Mina märken, mynt, Läsning, kontomenyn och knapparna i lektionens överkant), djurbilder med text i låg under knapparnas namn, två rutor hade `aria-label` utan roll, och djurets rum tog inte emot fokus och gick inte att stänga med Esc om fokus låg bakom. Det en automatisk kontroll inte kan avgöra, som om ordningen är rimlig eller om texten går att förstå, kräver en människa. Inte testat: skärmläsare (NVDA, VoiceOver) och kontrast på alla teman.

## Telefon

Siten har testats i iPhone-storlek (390 · 844 stående, 844 · 390 liggande, och 390 · 500 med tangentbordet uppe). Det som rättades efter testet: i liggande läge göms inte längre knapparna Fortsätt, Tillbaka och Hoppa över i lektionerna (de göms bara medan tangentbordet är uppe, `html.is-keyboard`), Kolla i pyssla ligger bredvid reglagen, ritytan är högre och har sina knappar under pappret, och på telefon är knappar och chips minst 44 px höga och text aldrig under 12 px (utom de små etiketterna BEGREPP och KAPITEL, 10 px). Inget ger sidledes rullning, och alla fält är 16 px eller större så att iOS inte zoomar. Inte testat: riktig Safari på en iPhone, lärarvyn, inloggning och chatt.

## Nya format

Fyra nya sätt att ställa en fråga i en lektion, förutom att skriva ett svar, para ihop och sant/falskt (`formats.js`, lektionsmodellen i `lesson-model.js`, testerna i `tests/formats.js`). De ligger i `components` som de andra blocken, räknas som uppgifter (id `so-<n>`, `or-<n>`, `hf-<n>` och `lt-<n>`), kollas med "Kolla svaret", säger hur många som är rätt och efter andra försöket vilka som är fel, och inget går förlorat av att prova igen. Alla fyra har exempel i lektionerna (14 uppgifter i 14 lektioner, efter "Din tur"):

- **Sortera** (`sortera`): välj grupp för varje sak, till exempel jämna eller udda, primtal eller inte, rationellt eller irrationellt. `{ "type": "sortera", "prompt": "...", "categories": ["Jämna", "Udda"], "items": [{ "text": "14", "category": 0, "explain": "..." }] }`. `category` är gruppens nummer (från 0) eller dess namn. Sakerna blandas för varje elev om inte `"shuffle": false`.
- **Ordna** (`ordna`): flytta med pilarna tills allt står i rätt ordning (minst först, stegen i en metod). `{ "type": "ordna", "prompt": "...", "items": ["0,05", "0,5", "0,55"], "top": "Minst", "bottom": "Störst" }`. Sakerna står i den rätta ordningen i filen och blandas för eleven, aldrig i rätt ordning från början. Tre till åtta saker, och inga två lika.
- **Hitta felet** (`hittafelet`): en lösning med ett steg som är fel, som eleven pekar ut. `{ "type": "hittafelet", "prompt": "...", "steps": ["3x + 2 = 14", "3x = 14 + 2", "..."], "wrong": 1, "explain": "...", "fix": "...", "hint": "..." }`. `wrong` är det felaktiga stegets nummer (från 0). Ett steg som stämmer säger "Steg N stämmer", efter andra försöket kommer tipset, och när rätt steg pekats ut visas förklaringen och hur det ska vara.
- **Fyll i luckorna** (`lucktext`): en text med luckor som skrivs eller väljs. `{ "type": "lucktext", "prompt": "...", "text": "En vecka har {1} dagar.", "blanks": [{ "answer": ["7", "sju"], "options": ["5", "7"], "hint": "..." }] }`. Versaler, mellanslag och komma eller punkt i decimaltal spelar ingen roll. Med `options` blir luckan en lista att välja i.

`GaussicaFormats.problems(component)` listar vad som är fel i ett block (för testerna och för kontrollen i redigeraren).

**I redigeraren** läggs formaten till med ett exempel och ändras i egna formulär (inte JSON): grupper och saker med val av grupp för Sortera, saker med pilar för Ordna, steg med en markering för det felaktiga för Hitta felet, och text, luckor och svar för Fyll i luckorna (en ny lucka lägger också `{n}` i texten, och flera svar skrivs med komma). Under formuläret står en lista över vad som behöver fixas, eller "Uppgiften ser bra ut". Tomma rader tas bort när lektionen sparas.

**Öva mer.** Formaten har också övningsmallar, så eleven får nya omgångar av dem: `"mode": "sortera"`, `"ordna"` och `"hittafelet"` drar några saker ur en lista (`pool`) varje gång, och `"mode": "lucktext"` är en text med slumptal (`vars`) där luckorna skrivs `[[1]]`, `[[2]]` och rätt svar är uttryck som `"=w*7"`. `for` pekar ut uppgiften mallen hör till (`so-1`, `lt-2` och så vidare). Mallarna kontrolleras av `tests/practice.js` (varje fråga måste vara ett bra block enligt `GaussicaFormats.problems`) och i övningsredigeraren, som har en startmall för varje format. Tolv lektioner har sådana mallar.
