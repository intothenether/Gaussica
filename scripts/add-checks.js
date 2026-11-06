"use strict";
// Adds the short question at the end of the explanation (lesson.check) to lessons: node scripts/add-checks.js
// Each check is true-or-false statements about what the explanation of the lesson said (nothing of it is kept or counted, see lesson-player.js).
// A lesson that has one already is left as it is. To add a check by hand, put "check": { prompt, statements: [{ text, answer, explain }], correct } in
// the lesson file; tests/lessons.js checks it.
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "lessons");

const T = (text, answer, explain) => ({ text: text, answer: answer, explain: explain });
const CHECKS = {
  platsvarde: [[T("I talet 3 482 är siffran 4 värd 400.", true, "4:an står på hundratalens plats, så den är värd fyra hundratal."), T("Siffran 3 är värd lika mycket i 3 och i 30.", false, "I 30 står 3:an på tiotalens plats och är värd 30. En siffra får sitt värde från platsen den står på.")], "Rätt! En siffras värde beror på vilken plats den står på."],
  "storre-mindre": [[T("8 > 3 läses ”åtta är större än tre”.", true, "Munnen öppnar sig mot det största talet, 8."), T("Tecknet < betyder större än.", false, "< betyder mindre än. Munnen öppnar sig mot det största talet.")], "Rätt! Munnen öppnar sig alltid mot det största talet."],
  "inte-lika-med": [[T("3 + 4 ≠ 8 stämmer, för sidorna är olika mycket.", true, "3 + 4 är 7 och 8 är något annat, så de är olika."), T("Tecknet ≠ visar vilken sida som är störst.", false, "≠ säger bara att sidorna är olika. < och > visar vilken som är störst.")], "Rätt! ≠ betyder bara att sidorna är olika mycket."],
  addition: [[T("Tio ental kan bytas mot ett tiotal.", true, "Det kallas att växla, och talets värde ändras inte."), T("När vi växlar ändras talets värde.", false, "Värdet ändras inte när vi växlar. Det är samma mängd med ett nytt namn.")], "Rätt! Växling byter namn på samma mängd."],
  subtraktion: [[T("Ett hundratal är lika mycket som tio tiotal.", true, "Därför kan du växla ett hundratal till tio tiotal när du behöver fler."), T("Växling tar bort något från talet.", false, "Växling byter bara namn på samma mängd. Den tar inte bort något.")], "Rätt! Växling ändrar inte hur mycket det är."],
  "addition-uppstallning": [[T("I en uppställning börjar du med entalen.", true, "Du lägger ihop en plats i taget, från höger till vänster."), T("Talen skrivs så att tiotalen står under entalen.", false, "Entalen står under entalen och tiotalen under tiotalen.")], "Rätt! Du börjar med entalen och skriver platserna under varandra."],
  "subtraktion-uppstallning": [[T("Går det inte att dra ifrån lånar du ett tiotal från platsen till vänster.", true, "1 tiotal är 10 ental, så du får fler ental att dra ifrån."), T("Du kontrollerar en subtraktion med division.", false, "Du kontrollerar med addition: svaret plus det nedre talet ska bli det övre.")], "Rätt! Du lånar när det inte går, och kollar med addition."],
  "pengar-vaxel": [[T("Pris plus växel är lika med det du betalar.", true, "Därför kan du kontrollera växeln genom att lägga ihop den med priset."), T("En bok för 37 kronor som betalas med en 50-lapp ger 15 kronor i växel.", false, "Från 37 till 40 är det 3 och från 40 till 50 är det 10, så växeln är 13 kronor.")], "Rätt! Du kan räkna upp växeln eller dra ifrån, och kolla med addition."],
  multiplikation: [[T("7 · 8 betyder sju grupper med åtta i varje.", true, "Det är samma sak som 8 + 8 + 8 + 8 + 8 + 8 + 8, fast kortare."), T("7 · 8 och 8 · 7 ger olika svar.", false, "Ordningen spelar ingen roll. Båda ger 56.")], "Rätt! Multiplikation är lika stora grupper, och ordningen spelar ingen roll."],
  multiplikationstabellen: [[T("3 · 7 och 7 · 3 ger samma svar.", true, "Du kan byta plats på talen, så du behöver bara lära dig hälften av tabellen."), T("Femmans tabell slutar alltid på 3 eller 8.", false, "Femmans tabell slutar alltid på 5 eller 0.")], "Rätt! Du kan byta plats på talen, och mönster hjälper dig."],
  division: [[T("Eftersom 7 · 8 = 56 får varje grupp 8 när 56 delas lika i 7 grupper.", true, "Division går åt andra hållet än multiplikation."), T("Du kontrollerar en division genom att lägga ihop talen.", false, "Du kontrollerar genom att multiplicera svaret med talet du delade med.")], "Rätt! Division och multiplikation hör ihop."],
  "tid-klocka": [[T("En timme är 60 minuter.", true, "Tiden räknas med timmar och minuter, inte i hundratal."), T("En timme är 100 minuter.", false, "En timme är 60 minuter.")], "Rätt! En timme är 60 minuter."],
  "digital-klocka": [[T("På en digital klocka står timmarna före kolonet.", true, "08:25 betyder 8 timmar och 25 minuter."), T("15:00 är klockan tio på kvällen.", false, "15:00 är klockan tre på eftermiddagen. Klockan tio på kvällen är 22:00.")], "Rätt! Efter klockan 12 lägger du till 12 timmar."],
  tallinjen: [[T("Addition är att hoppa åt höger på tallinjen.", true, "Åt höger blir talen större."), T("Avståndet mellan två streck på en tallinje är olika stort.", false, "Avståndet är alltid lika stort.")], "Rätt! Åt höger lägger du till och åt vänster tar du bort."],
  "geometriska-figurer": [[T("En triangel har tre sidor och tre hörn.", true, "En figur har lika många sidor som hörn."), T("En cirkel har fyra hörn.", false, "En cirkel har ingen rak sida och inget hörn.")], "Rätt! En sida är en rak kant och ett hörn är där två sidor möts."],
  symmetri: [[T("En kvadrat har fyra symmetrilinjer.", true, "Du kan vika den på fyra sätt så att halvorna täcker varandra."), T("En rektangel har tre symmetrilinjer.", false, "En rektangel har två symmetrilinjer.")], "Rätt! En symmetrilinje delar figuren i två halvor som täcker varandra."],
  "monster-fortsatt": [[T("I mönstret 2, 4, 6, 8 ökar talen med 2 varje gång.", true, "Titta på ändringen från ett steg till nästa."), T("Nästa tal i mönstret 3, 6, 9, 12 är 14.", false, "Talen ökar med 3 varje gång, så nästa tal är 15.")], "Rätt! Hitta ändringen och använd den en gång till."],
  "mata-langd": [[T("1 meter är 100 centimeter.", true, "Små saker mäter vi i centimeter och längre saker i meter."), T("När du mäter med linjal börjar du räkna vid 1.", false, "Du lägger 0 mot början och läser av där det slutar.")], "Rätt! Börja vid 0 när du mäter."],
  "var-ar-det": [[T("I rutan B3 läser du först bokstaven och sedan siffran.", true, "Raderna har bokstäver och kolumnerna har siffror."), T("Att gå åt höger ändrar bokstaven.", false, "Åt höger ändrar siffran. Nedåt ändrar bokstaven.")], "Rätt! Rutan namnges med bokstav och siffra."],
  "tabell-lasa": [[T("När du läser en tabell läser du rubrikerna först.", true, "De visar vad varje kolumn betyder."), T("Rubrikerna i en tabell är svaren.", false, "Rubrikerna visar vad varje kolumn betyder. Svaren står i raderna.")], "Rätt! Läs rubrikerna först, sedan rätt rad."],
  "halvor-fjardedelar": [[T("Delarna måste vara lika stora för att de ska kallas halvor.", true, "Annars har namnet ingen betydelse."), T("Hälften av 8 äpplen är 8 äpplen.", false, "Hälften av 8 äpplen är 4 äpplen, för du delar lika i två grupper.")], "Rätt! Delarna måste vara lika stora."],
  "udda-jamna": [[T("Ett tal som slutar på 6 är jämnt.", true, "Du behöver bara titta på sista siffran."), T("Talet 1 573 är jämnt.", false, "Det slutar på 3, så det är udda.")], "Rätt! Sista siffran avgör om talet är jämnt eller udda."],
  "sakert-mojligt": [[T("Det är omöjligt att en tärning med siffrorna 1 till 6 visar 7.", true, "Omöjligt betyder att det aldrig kan hända."), T("Det är säkert att du drar en blå kula ur en påse med nio blå och en röd.", false, "Det är troligt, men inte säkert, för det finns en röd kula.")], "Rätt! Säkert händer alltid, omöjligt händer aldrig."],
  "stegvisa-instruktioner": [[T("Stegen i en instruktion görs ett i taget, uppifrån och ned.", true, "Så får också en dator sina instruktioner."), T("Ordningen på stegen spelar ingen roll.", false, "Samma steg i en annan ordning kan ge ett annat svar.")], "Rätt! Ordningen spelar roll."],
  kalendern: [[T("En vecka är 7 dygn.", true, "Och ett dygn är 24 timmar."), T("Ett dygn är 12 timmar.", false, "Ett dygn är 24 timmar.")], "Rätt! En vecka är 7 dygn och ett dygn är 24 timmar."],
  "uppskatta-rimligt": [[T("Ett överslag visar om ett svar är rimligt.", true, "Du räknar med avrundade tal och ser om svaret ligger nära."), T("Ett överslag ger alltid det exakta svaret.", false, "Ett överslag är bara ungefär, men det visar om svaret kan stämma.")], "Rätt! Ett överslag är ungefärligt men visar om svaret är rimligt."]
};

Object.assign(CHECKS, require("./checks-grade-4-5.js")(T));   // åk 4 and åk 5

let added = 0, skipped = 0;
Object.keys(CHECKS).forEach((id) => {
  const file = path.join(DIR, id + ".json");
  let t = fs.readFileSync(file, "utf8");
  if (/"check"\s*:/.test(t)) { skipped++; return; }
  const eol = /\r\n/.test(t) ? "\r\n" : "\n";
  const check = { prompt: "Sant eller falskt?", statements: CHECKS[id][0], correct: CHECKS[id][1] };
  const block = '  "check": ' + JSON.stringify(check, null, 2).replace(/\n/g, "\n  ") + "," + "\n";
  const m = /^  "exercise":/m.exec(t.replace(/\r\n/g, "\n"));
  if (!m) throw new Error("no exercise in " + id);
  const lf = t.replace(/\r\n/g, "\n");
  const out = lf.slice(0, m.index) + block + lf.slice(m.index);
  fs.writeFileSync(file, eol === "\r\n" ? out.replace(/\n/g, "\r\n") : out);
  added++;
});
console.log(added + " checks added, " + skipped + " lessons had one already");
