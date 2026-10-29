"use strict";
// The words for families (words.js): what is changed, and what must stay as it is.
global.window = {};
const W = require("../words.js");
let failures = 0;
const is = (got, want, m) => { const good = got === want; console.log((good ? "ok   " : "FAIL ") + m + (good ? "" : "\n       got:  " + got + "\n       want: " + want)); if (!good) failures++; };
const cg = (s) => W.t(s, "caregiver");
const fam = (s) => W.t(s, "family");

// a caregiver sees barn, familj and vårdnadshavare
is(cg("Se hur varje elev klarar uppgifterna"), "Se hur varje barn klarar uppgifterna", "elev becomes barn");
is(cg("Eleverna skapar sitt eget konto med klasskoden."), "Barnen skapar sitt eget konto med familjekoden.", "eleverna and klasskoden");
is(cg("Du ser bara elever i dina egna klasser."), "Du ser bara barn i dina egna familjer.", "elever and klasser");
is(cg("Eleven finns inte i dina klasser."), "Barnet finns inte i din familj.", "an error message from the server");
is(cg("Ge en klass eller en enskild elev en lektion"), "Ge en familj eller ett enskilt barn en lektion", "en enskild elev takes ett enskilt barn");
is(cg("Det här är en elev som behöver hjälp"), "Det här är ett barn som behöver hjälp", "en elev takes ett barn");
is(cg("Radera klassen och alla elevkonton"), "Radera familjen och alla barnkonton", "compounds: elevkonton");
is(cg("Frågor från elever"), "Frågor från barn", "frågor från elever");
is(cg("Elevens svar och elevernas uppgifter"), "Barnets svar och barnens uppgifter", "elevens and elevernas");
is(cg("Lärarvy 📊"), "Mina barn 📊", "the link to the teacher view");
is(cg("Den här sidan är bara för lärare."), "Den här sidan är bara för vårdnadshavare.", "lärare becomes vårdnadshavare");
is(cg("Nytt lösenord åt Eleven"), "Nytt lösenord åt Barnet", "the case of the first letter is kept");
is(cg("Klasser"), "Familjer", "Klasser");
is(cg("Skapa en klass ovan"), "Skapa en familj ovan", "klass");

// a child of a caregiver
is(fam("Fråga din lärare"), "Fråga din vårdnadshavare", "fråga din lärare");
is(fam("Fråga läraren"), "Fråga vårdnadshavaren", "fråga läraren");
is(fam("Uppdrag från din lärare"), "Uppdrag från din vårdnadshavare", "uppdrag");
is(fam("Din lärare får veta att du inte längre finns i klassen."), "Din vårdnadshavare får veta att du inte längre finns i familjen.", "klassen becomes familjen");
is(fam("Eleverna räknar"), "Eleverna räknar", "elev is not changed for a child");

// a teacher and a student of a teacher see no change, and words inside words are left alone
is(W.t("Fråga din lärare", null), "Fråga din lärare", "no mode, no change");
is(cg("Chefselevens klassiska skolväska"), "Chefselevens klassiska skolväska", "words that only contain elev or klass are left alone");
is(cg("klassisk musik"), "klassisk musik", "klassisk is not klass");
is(cg("Pelevaren"), "Pelevaren", "the middle of a word");

// the page: the places where the words change, and the places that are left alone
const { JSDOM } = (() => { try { return require("jsdom"); } catch (e) { return {}; } })();
console.log(failures ? "\n" + failures + " FAILED" : "\nAll word checks passed");
process.exit(failures ? 1 : 0);
