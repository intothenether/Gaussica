// "Hjälp för vuxna": what a caregiver can say and do for a lesson, written by hand for the lessons where it matters most. A lesson that is not here gets
// a guide made from its own text (see parent-guide.js). The guides are short on purpose: what to say first, what often goes wrong and what to ask.
//
//   id: { explain: ["..."], mistakes: ["..."], talk: ["..."] }
//
// These texts are drafts to be read by a teacher before they are relied on.

window.GaussicaParentGuides = {
  platsvarde: {
    explain: [
      "Börja med talet 333. Fråga vilken trea som är värd mest. Alla tre ser likadana ut, men den längst till vänster är tre hundratal, nästa tre tiotal och den sista tre ental.",
      "Använd saker du har hemma: tio knappar i en kopp är ett tiotal, tio koppar är ett hundratal. Det är bara en kopp till, och sedan en större kopp, när det blir tio.",
      "Platsvärdet är det som gör att tio siffror räcker till alla tal."
    ],
    mistakes: [
      "Barnet svarar med siffran i stället för värdet: ”6” när frågan är vad 6:an är värd i 2 643. Fråga: på vilken plats står den, och hur många sådana är det?",
      "Barnet blandar ihop tiotal och hundratal. Rita tre rutor märkta hundratal, tiotal och ental och skriv en siffra i varje."
    ],
    talk: [
      "Be barnet bygga talet 3 482 med klossar eller pengar: tusenlappar, hundralappar, tior och enkronor.",
      "Fråga: vad händer med värdet på en siffra när den flyttas ett steg åt vänster?"
    ]
  },
  addition: {
    explain: [
      "Att växla är att byta tio små mot en större: tio ental är ett tiotal. Visa med tio enkronor och en tia.",
      "Räkna plats för plats, från höger. Blir det tio eller mer på en plats skriver du det som blir över och flyttar tiotalet med dig till nästa plats (minnessiffran)."
    ],
    mistakes: [
      "Barnet skriver hela svaret på en plats, till exempel 14 under entalen. Fråga: får det plats? Hur många ental kan du skriva?",
      "Barnet glömmer minnessiffran. Be barnet skriva den med en liten siffra ovanför nästa plats innan hen börjar räkna där."
    ],
    talk: [
      "Be barnet göra en egen additionsuppgift där man måste växla, och visa den med pengar.",
      "Fråga: hur kan du kontrollera svaret? (Subtrahera ett av talen från summan.)"
    ]
  },
  subtraktion: {
    explain: [
      "När det översta talet är mindre på en plats växlar du: ta ett tiotal från platsen till vänster och byt det mot tio ental. Det är samma sak som att växla en tia mot tio enkronor.",
      "I 502 − 278 finns inga tiotal att växla från, så börja med att växla ett hundratal till tio tiotal, och sedan ett av tiotalen till tio ental."
    ],
    mistakes: [
      "Barnet tar alltid det minsta talet från det största i varje kolumn (8 − 2 blir 6). Fråga: vilket tal ska minska? Det översta.",
      "Barnet glömmer att ta bort det som växlades, så platsen till vänster har kvar sitt gamla värde."
    ],
    talk: [
      "Be barnet visa 502 − 278 med pengar: fem hundralappar och två enkronor, och sedan växla.",
      "Fråga: hur kan du kontrollera med addition? (278 + svaret ska bli 502.)"
    ]
  },
  multiplikation: {
    explain: [
      "Multiplikation är lika stora grupper. 7 · 8 är sju grupper med åtta i varje. Lägg upp det med kulor, kakor eller knappar, så ser barnet grupperna.",
      "Tabellerna sitter bäst när barnet förstår att 7 · 8 är en grupp till än 6 · 8. Börja gärna med tabellerna 2, 5 och 10 och bygg därifrån."
    ],
    mistakes: [
      "Barnet lägger ihop i stället för att multiplicera (7 + 8 = 15). Fråga: hur många grupper är det, och hur många i varje?",
      "Barnet kan tabellen bara utantill och blandar ihop 7 · 8 och 6 · 8. Visa att 6 · 8 = 48 och att en grupp till ger 56."
    ],
    talk: [
      "Be barnet rita 4 grupper med 6 i varje och skriva multiplikationen.",
      "Fråga: finns det grupper hemma? (Äggkartonger, ägg i en kartong, hjul på bilar.)"
    ]
  },
  division: {
    explain: [
      "Division är att dela lika, eller att se hur många grupper det blir. 56 delat med 7 frågar: om 56 saker delas på 7 grupper, hur många får varje?",
      "Division och multiplikation hör ihop: eftersom 7 · 8 = 56 vet du att 56 delat med 7 är 8. Låt barnet leta i tabellen baklänges."
    ],
    mistakes: [
      "Barnet delar tvärtom (7 delat med 56). Fråga: vilket tal ska delas upp?",
      "Barnet svarar med antalet grupper i stället för hur många som får plats i varje."
    ],
    talk: [
      "Dela ut kort eller godis lika mellan fler personer och prata om hur många var och en får.",
      "Fråga: vilken multiplikation hjälper dig att svara?"
    ]
  },
  "division-med-rest": {
    explain: [
      "Ibland går det inte jämnt ut. Dela 17 kakor på 5 barn: alla får 3, och 2 blir över. Den som blir över kallas rest.",
      "Resten är alltid mindre än det du delar med. Annars hade du kunnat dela ut en gång till."
    ],
    mistakes: [
      "Barnet svarar bara med hur många varje får och glömmer resten. Be barnet kontrollera: 5 · 3 + 2 = 17.",
      "Barnet gör resten större än talet man delar med. Då kan man dela ut en gång till."
    ],
    talk: [
      "Dela 23 kuber på 4 lag och låt barnet skriva svaret som ”5 rest 3”.",
      "Fråga: när spelar resten roll i vardagen? (Bilar och platser, bussar och elever.)"
    ]
  },
  "tid-klocka": {
    explain: [
      "En timme är 60 minuter, så tiden räknas inte som vanliga tal. Gå först till nästa hela timme och räkna sedan resten: från 14:35 till 15:00 är det 25 minuter.",
      "Låt barnet använda en riktig klocka med visare och flytta visarna."
    ],
    mistakes: [
      "Barnet skriver 14:75 när det blir mer än 60 minuter. Fråga: hur många minuter har en timme?",
      "Barnet blandar ihop timvisaren och minutvisaren. Den korta visar timmar, den långa minuter."
    ],
    talk: [
      "Be barnet säga vad klockan är på hela, halva och kvart i och sedan flytta fram den 40 minuter.",
      "Fråga: hur länge är det till middag, till film eller till skolan?"
    ]
  },
  "pengar-vaxel": {
    explain: [
      "Växel räknas lättast uppåt, som kassapersonalen gör. Köper du för 37 kronor och betalar med 50 kronor: till 40 är det 3, till 50 är det 10, alltså 13.",
      "Låt barnet betala på riktigt med mynt och sedlar."
    ],
    mistakes: [
      "Barnet drar ifrån och tappar bort sig. Prova uppåt-metoden.",
      "Barnet blandar ihop vad något kostar med vad man betalar med."
    ],
    talk: [
      "Spela affär hemma med riktiga mynt och prislappar.",
      "Be barnet räkna ut växeln på ett kvitto från er senaste affärsrunda."
    ]
  },
  brak: {
    explain: [
      "Ett bråk är en del av en helhet. En halv pizza är en av två lika stora delar. Dela något hemma i lika delar och peka på delarna.",
      "För att lägga ihop bråk måste delarna vara lika stora. En halv är lika mycket som två fjärdedelar."
    ],
    mistakes: [
      "Barnet lägger ihop täljarna och nämnarna (1/2 + 1/4 blir 2/6). Fråga: är delarna lika stora? Gör dem lika stora först.",
      "Barnet tror att större nämnare betyder större bråk. Fråga: hur stora är bitarna om pizzan delas i 8 respektive 2?"
    ],
    talk: [
      "Dela en chokladkaka i fyra delar och be barnet visa tre fjärdedelar.",
      "Fråga: är 1/3 mer eller mindre än 1/4? Hur vet du?"
    ]
  },
  "brak-del": {
    explain: [
      "Nämnaren (nederst) säger hur många lika stora bitar helheten är delad i. Täljaren (överst) säger hur många av bitarna du har.",
      "Rita en cirkel eller en rektangel, dela den och färglägg. Låt barnet läsa av bråket."
    ],
    mistakes: [
      "Barnet byter plats på täljare och nämnare. Fråga: vad är nederst? (Hur många bitar helheten är delad i.)",
      "Barnet delar i ojämna delar. Delarna måste vara lika stora."
    ],
    talk: [
      "Be barnet rita 3/5 och 5/8 av en rektangel.",
      "Fråga: vilket bråk har ni ätit av pizzan?"
    ]
  },
  "negativa-tal": {
    explain: [
      "Negativa tal ligger under noll. Termometern är det bästa exemplet: −3 grader är tre grader under noll.",
      "Rita en tallinje som går förbi noll åt båda hållen. Plus går åt höger, minus åt vänster."
    ],
    mistakes: [
      "Barnet lägger ihop ”−3 + 5” till −8. Fråga: börjar du över eller under noll, och vilket håll går du?",
      "Barnet tror att −5 är större än −2 eftersom 5 är större än 2. Be barnet markera dem på tallinjen."
    ],
    talk: [
      "Titta på utetemperaturen hela veckan och räkna hur många grader det skiljer mellan dagarna.",
      "Fråga: kan det vara kallare än −10? Vad betyder det?"
    ]
  },
  area: {
    explain: [
      "Area är hur många rutor en yta täcker. En rektangel som är 8 cm lång och 5 cm bred rymmer 5 rader med 8 rutor, så arean är 8 · 5 = 40 kvadratcentimeter.",
      "Lägg rutigt papper över en bok eller bord och räkna rutorna."
    ],
    mistakes: [
      "Barnet räknar omkretsen i stället (8 + 5 + 8 + 5). Fråga: räknar du ytan inuti eller sträckan runt om?",
      "Barnet skriver cm i stället för cm² i svaret. Arean mäts i rutor, kvadratenheter."
    ],
    talk: [
      "Mät golvet i ett rum och räkna ut hur många kvadratmeter det är.",
      "Fråga: vilken yta täcker en frimärke jämfört med ett A4-ark?"
    ]
  },
  decimaltal: {
    explain: [
      "Decimaltal är delar av en helhet: 0,5 är fem tiondelar, 0,25 är tjugofem hundradelar. Hundrarutor eller pengar är bra hjälp: 0,25 är en kvarts krona.",
      "För att jämföra decimaltal: jämför plats för plats, först hela tal, sedan tiondelar, sedan hundradelar."
    ],
    mistakes: [
      "Barnet tror att 0,25 är större än 0,5 eftersom 25 är större än 5. Skriv 0,50 och 0,25 under varandra och jämför tiondelarna.",
      "Barnet tror att tal med fler decimaler är större. Fråga: hur stora är delarna?"
    ],
    talk: [
      "Be barnet ordna fem priser från billigast till dyrast.",
      "Fråga: var använder vi decimaltal i vardagen? (Priser, mått, vikt.)"
    ]
  },
  procent: {
    explain: [
      "Procent betyder hundradelar. 25 % är 25 av 100, eller en fjärdedel. Rita en hundrarutad ruta och färglägg 25 rutor.",
      "Hitta procent av ett tal genom att dela med 100 och sedan multiplicera: 10 % av 50 är 50 delat med 10, alltså 5."
    ],
    mistakes: [
      "Barnet glömmer att dela med 100 och svarar 1000 på ”20 % av 50”. Fråga: ska delen vara större eller mindre än hela 50?",
      "Barnet tror att 50 % av ett tal är hälften av procenttalet. Rita rutan och visa."
    ],
    talk: [
      "Leta efter procent på en reaskylt och räkna ut vad den nya prislappen blir.",
      "Fråga: är 25 % och 1/4 samma sak? Hur kan du visa det?"
    ]
  }
};
