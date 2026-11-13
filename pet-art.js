// The drawings of the pets: a pug, a dachshund, a cat, a penguin, a rabbit, a hedgehog, a fox, a hamster, a dragon, an axolotl, a pig, a cow and a cockatiel, with clothes and accessories and a few backgrounds.
// Everything is plain SVG made here, so there are no image files and it works offline.
//
//   GaussicaPetArt.KINDS                      { dog (a pug), tax (a dachshund), cat, penguin, rabbit, hedgehog, fox, hamster, dragon, axolotl, pig, cow, cockatiel }:
//                                             name, colours, default names, and the favourite food and toy (likes: { food, toy })
//   GaussicaPetArt.ITEMS                      the shop: [{ id, slot, name, price, view, set?, need?, badges? }]  (slot: hat | face | neck | bg)
//                                             a piece with `set` and `need` is locked until enough lessons of the area are finished; a piece with `badges`
//                                             (ids of the badges of rewards.js, "märken") until all of them are earned
//   GaussicaPetArt.SETS                       the themed sets, one for each area of the course: pieces with set and need
//                                             (the number of finished lessons in the area that unlocks the piece)
//   GaussicaPetArt.item(id)                   one item
//   GaussicaPetArt.svg(pet, options)          the pet as an SVG string. pet = { kind, color, worn: { hat, face, neck }, bg }
//                                             options = { mood: "happy", size, bare, label }
//   GaussicaPetArt.thumb(itemId)              an item on its own, for the shop
//   GaussicaPetArt.FOODS, TOYS, thing(id), snack(id)   treats and toys (food and play, see pet.js), and one drawn on its own
//
// The room (ROOM_SLOTS: wall, rug, bed, window, shelf, lamp, plant, toy) is drawn when pet.scene is "room"; its things are in pet.room.
// All parts are drawn in a 200 x 200 box, with the head at about (100, 86), so that every item fits every animal.
// The CSS classes pet-bob, pet-tail, pet-eyes, pet-wing and pet-prop are animated in styles.css.

window.GaussicaPetArt = (function () {
  "use strict";

  const INK = "#2a2630";
  let counter = 0;

  const KINDS = {
    dog: {
      name: "Mops", names: ["Mopsen", "Gus", "Doris", "Bamse"],
      colors: [
        { id: "fawn", name: "Ljusbrun", body: "#e3bf8b", dark: "#4a3a30", light: "#f7e8cc" },
        { id: "aprikos", name: "Aprikos", body: "#efb374", dark: "#5a4032", light: "#fbe2bd" },
        { id: "silver", name: "Silver", body: "#cdcdd6", dark: "#4b4b58", light: "#eceaf0" },
        { id: "svart", name: "Svart", body: "#43434e", dark: "#24242c", light: "#7b7b88" }
      ]
    },
    tax: {
      name: "Tax", names: ["Korv", "Dixie", "Ludde", "Greta"],
      colors: [
        { id: "rod", name: "Rödbrun", body: "#b8683c", dark: "#8c4a28", light: "#dea06f" },
        { id: "svart", name: "Svart och tan", body: "#3b3441", dark: "#25202b", light: "#bf8f5e" },
        { id: "choklad", name: "Choklad", body: "#7b4b35", dark: "#59341f", light: "#cb9a72" },
        { id: "kram", name: "Gräddvit", body: "#edd3a6", dark: "#c99b5d", light: "#f9ecd4" }
      ]
    },
    cat: {
      name: "Katt", names: ["Misse", "Luna", "Tigger", "Smulan"],
      colors: [
        { id: "orange", name: "Orange", body: "#f2a550", dark: "#d4802a", light: "#fff0d9" },
        { id: "gra", name: "Grå", body: "#a4acb8", dark: "#7d8694", light: "#eef1f5" },
        { id: "svart", name: "Svart", body: "#4a4a57", dark: "#2e2e38", light: "#8b8b99" },
        { id: "vit", name: "Vit", body: "#f6f3ee", dark: "#d8d2c8", light: "#ffffff" }
      ]
    },
    penguin: {
      name: "Pingvin", names: ["Pingo", "Frost", "Sigge", "Isa"],
      colors: [
        { id: "klassisk", name: "Klassisk", body: "#2d3552", dark: "#1f2540", light: "#fbf7ee" },
        { id: "bla", name: "Blå", body: "#3f74b8", dark: "#2c5690", light: "#fbf7ee" },
        { id: "lila", name: "Lila", body: "#7d5eb4", dark: "#5c4290", light: "#fbf7ee" },
        { id: "rosa", name: "Rosa", body: "#e07ba0", dark: "#bd5b80", light: "#fff5f8" }
      ]
    },
    rabbit: {
      name: "Kanin", names: ["Nusse", "Pelle", "Bella", "Hoppe"],
      colors: [
        { id: "vit", name: "Vit", body: "#f6f2ec", dark: "#d9d1c6", light: "#ffffff" },
        { id: "brun", name: "Brun", body: "#b98a60", dark: "#8d6340", light: "#efdcc3" },
        { id: "gra", name: "Grå", body: "#aeb2bc", dark: "#858a96", light: "#eceef2" },
        { id: "kram", name: "Gräddgul", body: "#ecd2a0", dark: "#c9a468", light: "#fbf1dc" }
      ]
    },
    hedgehog: {
      name: "Igelkott", names: ["Piggen", "Taggis", "Lilla", "Ville"],
      colors: [
        { id: "brun", name: "Brun", body: "#7c5a44", dark: "#573d2d", light: "#f1dcc0" },
        { id: "gra", name: "Gråbrun", body: "#8d8a92", dark: "#65626b", light: "#efe6dc" },
        { id: "ljus", name: "Ljus", body: "#c9a470", dark: "#9a7a4a", light: "#fbeed8" },
        { id: "mork", name: "Mörk", body: "#4d4150", dark: "#352c38", light: "#e8d6c2" }
      ]
    },
    fox: {
      name: "Räv", names: ["Rufus", "Saga", "Foxy", "Sixten"],
      colors: [
        { id: "rod", name: "Röd", body: "#e8843c", dark: "#4b2d1c", light: "#fff3e4" },
        { id: "silver", name: "Silver", body: "#98a1ae", dark: "#3a404c", light: "#f1f3f6" },
        { id: "arktis", name: "Arktisk", body: "#f1f3f6", dark: "#9fb0c4", light: "#ffffff" },
        { id: "sand", name: "Sand", body: "#dba96c", dark: "#6a4a2a", light: "#fff1da" }
      ]
    },
    hamster: {
      name: "Hamster", names: ["Nöt", "Frasse", "Kula", "Pyret"],
      colors: [
        { id: "guld", name: "Guld", body: "#e8b068", dark: "#bd8641", light: "#fdf0d8" },
        { id: "vit", name: "Vit", body: "#f6f2ec", dark: "#d9cfc2", light: "#ffffff" },
        { id: "gra", name: "Grå", body: "#a7a4ac", dark: "#7c7983", light: "#efedf0" },
        { id: "brun", name: "Brun", body: "#9a6d48", dark: "#704a2c", light: "#f0dcc2" }
      ]
    },
    dragon: {
      name: "Drake", names: ["Draco", "Gnistan", "Smulle", "Eldor"],
      colors: [
        { id: "gron", name: "Grön", body: "#5cbf7a", dark: "#3a9a5a", light: "#e1f5d4" },
        { id: "lila", name: "Lila", body: "#9a73d6", dark: "#7150b0", light: "#eadffb" },
        { id: "bla", name: "Blå", body: "#4f9de8", dark: "#2f74c0", light: "#d9ecfb" },
        { id: "rod", name: "Röd", body: "#e5564f", dark: "#b53a33", light: "#ffe4c8" }
      ]
    },
    axolotl: {
      name: "Axolotl", names: ["Axel", "Lotta", "Mudde", "Bubbla"],
      colors: [
        { id: "rosa", name: "Rosa", body: "#f7bccb", dark: "#e8728f", light: "#ffe6ec" },
        { id: "guld", name: "Guld", body: "#f3dc92", dark: "#e3a25a", light: "#fff3cf" },
        { id: "vit", name: "Vit", body: "#f8f2ea", dark: "#f08a9a", light: "#ffffff" },
        { id: "mork", name: "Mörk", body: "#6a6874", dark: "#45434f", light: "#9a98a6" },
        { id: "bla", name: "Blå", body: "#8fdcf2", dark: "#2f9bd0", light: "#e2f8fd" }
      ]
    },
    pig: {
      name: "Gris", names: ["Kalle", "Rosa", "Gullegris", "Nosen"],
      colors: [
        { id: "rosa", name: "Rosa", body: "#f7b4c3", dark: "#e58ba1", light: "#fbd4de" },
        { id: "vit", name: "Ljus", body: "#fcebe8", dark: "#f0b9b4", light: "#fff4f1" },
        { id: "brun", name: "Rödbrun", body: "#c98a63", dark: "#9f6544", light: "#e8b996" },
        { id: "svart", name: "Svart", body: "#55505c", dark: "#3a3641", light: "#9a8f99" }
      ]
    },
    cow: {
      name: "Ko", names: ["Bella", "Märta", "Mumma", "Klöver"],
      colors: [
        { id: "svartvit", name: "Svartvit", body: "#fffdf8", dark: "#3a3641", light: "#f7b8c4" },
        { id: "brunvit", name: "Brunvit", body: "#fffaf0", dark: "#9a5f3b", light: "#f6bcc0" },
        { id: "rodvit", name: "Rödvit", body: "#fff8f2", dark: "#c4553f", light: "#f7bcc2" },
        { id: "gradde", name: "Gräddig", body: "#f6e7c9", dark: "#c9a770", light: "#f3b8b4" }
      ]
    },
    cockatiel: {
      name: "Nymfkakadua", names: ["Pippi", "Sol", "Kiwi", "Tuffe"],
      colors: [
        { id: "normal", name: "Grå", body: "#9aa0ab", dark: "#6c7280", light: "#f8e06c" },
        { id: "lutino", name: "Gul", body: "#f4ebc4", dark: "#d4c898", light: "#fbe673" },
        { id: "vit", name: "Vit", body: "#f7f6f2", dark: "#d5d3cb", light: "#fdf6dc" },
        { id: "kanel", name: "Kanel", body: "#d4b08a", dark: "#ac8460", light: "#f9e58a" }
      ]
    }
  };

  // what each animal likes best (see pet.js, "Mat och lek"): a food and a toy
  const LIKES = {
    dog: { food: "ben", toy: "frisbee" }, tax: { food: "ben", toy: "boll" }, cat: { food: "fisk", toy: "nystan" }, penguin: { food: "fisk", toy: "snobollen" },
    rabbit: { food: "morot", toy: "ballong" }, hedgehog: { food: "applet", toy: "bubblor" }, fox: { food: "blabar", toy: "snobollen" },
    hamster: { food: "fron", toy: "boll" }, dragon: { food: "bulle", toy: "ballong" },
    axolotl: { food: "fisk", toy: "bubblor" }, pig: { food: "majs", toy: "boll" }, cow: { food: "klover", toy: "klocka" }, cockatiel: { food: "fron", toy: "klocka" }
  };
  Object.keys(LIKES).forEach(function (k) { KINDS[k].likes = LIKES[k]; });

  // how much an item moves for each animal, so that it sits right on the head, face and neck
  const SHIFT = {
    dog: { hat: 2, face: 1, neck: 0 },
    tax: { hat: 2, face: 5, neck: 5, place: "translate(-23 14) scale(.9)", crop: "4 24 126 114" },
    rabbit: { hat: 4, face: 1, neck: 0 },
    hedgehog: { hat: -4, face: 5, neck: 0 },
    fox: { hat: 3, face: 1, neck: 0 },
    hamster: { hat: 5, face: 3, neck: -2 },
    dragon: { hat: 0, face: -2, neck: 0 },
    axolotl: { hat: 2, face: 5, neck: 4 },
    pig: { hat: 4, face: 2, neck: -2 },
    cow: { hat: 3, face: 2, neck: 0 },
    cockatiel: { hat: 6, face: 4, neck: -4 },
    cat: { hat: 0, face: 1, neck: 0 },
    penguin: { hat: 12, face: 1, neck: -3 }
  };

  // The head of each animal: { cx, cy, rx, ry } (the centre, and half the width and the height of the part that is the head), measured in the drawing. Items that sit on the
  // head and not at a fixed place on it (headphones) are drawn from this: art(head). The y is already corrected for the shift of the face, because it is drawn inside it.
  const HEAD = {
    dog: { cx: 100, cy: 88, rx: 47, ry: 43 }, tax: { cx: 100, cy: 90, rx: 47, ry: 43 }, cat: { cx: 100, cy: 86, rx: 44, ry: 44 }, penguin: { cx: 100, cy: 94, rx: 44, ry: 33 },
    rabbit: { cx: 100, cy: 88, rx: 42, ry: 42 }, hedgehog: { cx: 100, cy: 90, rx: 44, ry: 42 }, fox: { cx: 100, cy: 86, rx: 45, ry: 40 }, hamster: { cx: 100, cy: 90, rx: 50, ry: 42 },
    dragon: { cx: 100, cy: 86, rx: 45, ry: 41 }, axolotl: { cx: 100, cy: 88, rx: 58, ry: 43 }, pig: { cx: 100, cy: 86, rx: 45, ry: 41 }, cow: { cx: 100, cy: 86, rx: 42, ry: 40 },
    cockatiel: { cx: 100, cy: 88, rx: 41, ry: 40 }
  };
  function headOf(kind) {
    const h = HEAD[kind] || HEAD.dog;
    return { cx: h.cx, cy: h.cy - ((SHIFT[kind] || SHIFT.dog).face || 0), rx: h.rx, ry: h.ry };
  }

  function colorOf(kind, id) {
    const list = KINDS[kind].colors;
    return list.find(function (c) { return c.id === id; }) || list[0];
  }

  // ===== the animals =====
  function eyePos(kind) {
    return kind === "penguin" ? [[86, 82], [114, 82]] : kind === "cat" ? [[84, 83], [116, 83]] : kind === "tax" ? [[81.2, 87.4], [118.8, 87.4]] :
      kind === "rabbit" ? [[85, 85], [115, 85]] : kind === "hedgehog" ? [[84, 88], [116, 88]] : kind === "fox" ? [[83, 85], [117, 85]] :
      kind === "hamster" ? [[80, 88], [120, 88]] : kind === "dragon" ? [[84, 82], [116, 82]] :
      kind === "axolotl" ? [[77, 88], [123, 88]] : kind === "pig" ? [[82, 80], [118, 80]] : kind === "cow" ? [[82, 82], [118, 82]] : kind === "cockatiel" ? [[84, 80], [116, 80]] : [[82, 84], [118, 84]];
  }

  // Closed eyes, drawn with the open ones and shown only while the pet sleeps (.is-sleeping, see styles.css).
  function closedEyes(kind, pos) {
    const line = kind === "dog" ? "#f6efe4" : INK;
    return '<g class="pet-eyes-closed">' + pos.map(function (p) {
      return '<path d="M' + (p[0] - 7) + ',' + (p[1] - 1) + ' Q' + p[0] + ',' + (p[1] + 6) + ' ' + (p[0] + 7) + ',' + (p[1] - 1) + '" fill="none" stroke="' + line + '" stroke-width="3.4" stroke-linecap="round"/>';
    }).join("") + '</g>';
  }

  function eyes(kind, mood, c) {
    const pos = eyePos(kind);
    const open = eyeShapes(kind, mood, c, pos);
    // the group .pet-gaze slides a little towards the cursor (see followGaze in pet.js)
    return '<g class="pet-gaze">' + (mood === "happy" ? open : open + closedEyes(kind, pos)) + '</g>';
  }

  function eyeShapes(kind, mood, c, pos) {
    if (mood === "happy") {
      const line = kind === "dog" ? "#f6efe4" : INK;
      return '<g class="pet-eyes is-happy">' + pos.map(function (p) {
        return '<path d="M' + (p[0] - 7) + ',' + (p[1] + 3) + ' Q' + p[0] + ',' + (p[1] - 8) + ' ' + (p[0] + 7) + ',' + (p[1] + 3) + '" fill="none" stroke="' + line + '" stroke-width="3.6" stroke-linecap="round"/>';
      }).join("") + '</g>';
    }
    if (kind === "dog") {
      return '<g class="pet-eyes">' + pos.map(function (p) {
        return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="10" fill="#fdfaf3"/><circle cx="' + p[0] + '" cy="' + (p[1] + 0.5) + '" r="6.6" fill="' + INK + '"/><circle cx="' + (p[0] + 2.4) + '" cy="' + (p[1] - 2.4) + '" r="2.4" fill="#fff"/><circle cx="' + (p[0] - 2) + '" cy="' + (p[1] + 3) + '" r="1.2" fill="#fff" opacity=".8"/>';
      }).join("") + '</g>';
    }
    if (kind === "tax") {
      return '<g class="pet-eyes">' + pos.map(function (p) {
        return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="9.7" ry="10.5" fill="' + INK + '"/><circle cx="' + (p[0] + 3.1) + '" cy="' + (p[1] - 4) + '" r="3.8" fill="#fff"/><circle cx="' + (p[0] - 3.1) + '" cy="' + (p[1] + 4) + '" r="1.8" fill="#fff" opacity=".85"/>';
      }).join("") + '</g>';
    }
    if (kind === "axolotl") {
      // big dark eyes with two shines
      return '<g class="pet-eyes">' + pos.map(function (p) {
        return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="7.4" ry="9" fill="' + INK + '"/><circle cx="' + (p[0] + 3) + '" cy="' + (p[1] - 4) + '" r="3" fill="#fff"/><circle cx="' + (p[0] - 3) + '" cy="' + (p[1] + 4) + '" r="1.4" fill="#fff" opacity=".8"/>';
      }).join("") + '</g>';
    }
    const ry = kind === "cat" ? 7.5 : kind === "tax" ? 7 : 6.5;
    return '<g class="pet-eyes">' + pos.map(function (p) {
      return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="6.2" ry="' + ry + '" fill="' + INK + '"/><circle cx="' + (p[0] + 2) + '" cy="' + (p[1] - 2.5) + '" r="2.2" fill="#fff"/>';
    }).join("") + '</g>';
  }

  // a pug: short and stocky, a flat dark face with wrinkles, small folded ears, a curly tail
  function dog(c, mood) {
    return '<g class="pet-tail pet-tail-dog"><path d="M132,138 Q160,132 154,112 Q148,98 136,106 Q130,112 138,118" fill="none" stroke="' + c.body + '" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<ellipse cx="78" cy="177" rx="16" ry="8" fill="' + c.body + '"/><ellipse cx="122" cy="177" rx="16" ry="8" fill="' + c.body + '"/>' +
      '<ellipse cx="100" cy="146" rx="42" ry="34" fill="' + c.body + '"/><ellipse cx="100" cy="153" rx="25" ry="24" fill="' + c.light + '"/>' +
      '<path d="M82,170 V178 M96,172 V179 M104,172 V179 M118,170 V178" stroke="rgba(0,0,0,.14)" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      '<path d="M60,52 Q46,66 54,88 Q70,84 78,66 Z" fill="' + c.dark + '"/><path d="M140,52 Q154,66 146,88 Q130,84 122,66 Z" fill="' + c.dark + '"/>' +
      '<ellipse cx="100" cy="88" rx="47" ry="43" fill="' + c.body + '"/>' +
      '<path d="M82,58 Q100,52 118,58 M78,66 Q100,59 122,66" stroke="rgba(0,0,0,.2)" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="82" cy="85" rx="17" ry="15" fill="' + c.dark + '" opacity=".9"/><ellipse cx="118" cy="85" rx="17" ry="15" fill="' + c.dark + '" opacity=".9"/>' +
      '<ellipse cx="100" cy="106" rx="29" ry="22" fill="' + c.dark + '"/>' +
      '<path d="M88,95 Q100,90 112,95" stroke="rgba(255,255,255,.18)" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      '<circle cx="64" cy="100" r="7" fill="#ff9bb0" opacity=".3"/><circle cx="136" cy="100" r="7" fill="#ff9bb0" opacity=".3"/>' +
      eyes("dog", mood, c) +
      '<ellipse cx="100" cy="99" rx="10" ry="6.5" fill="#15131a"/><ellipse cx="97" cy="97" rx="3" ry="1.6" fill="#fff" opacity=".45"/>' +
      '<path d="M100,105 V110 Q94,116 87,111 M100,110 Q106,116 113,111" stroke="#0e0c12" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".85"/>' +
      '<path d="M95,114 Q100,126 105,114 Z" fill="#ee7f93"/>';
  }

  // a dachshund, puppy style: the body is seen from the side (long and low on short thick legs) and the head is turned to the
  // viewer, big and round and joined straight onto the chest (no neck), so that the hats and glasses fit like on the others. The
  // drawing is wider than the box, so SHIFT.tax moves and shrinks the whole animal (clothes included) to fit.
  function tax(c, mood) {
    const leg = function (cx, fill) {
      return '<rect x="' + (cx - 9) + '" y="154" width="18" height="23" rx="8" fill="' + fill + '"/><ellipse cx="' + (cx - 1) + '" cy="177" rx="13" ry="7.5" fill="' + fill + '"/>' +
        '<path d="M' + (cx - 6) + ',175 V179.5 M' + (cx - 1) + ',176 V181 M' + (cx + 4) + ',175 V179.5" stroke="rgba(0,0,0,.15)" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
    };
    return '<g class="pet-tail pet-tail-tax"><path d="M200,146 Q226,150 220,118" fill="none" stroke="' + c.body + '" stroke-width="12" stroke-linecap="round"/></g>' +
      leg(112, c.dark) + leg(190, c.dark) +
      '<rect x="82" y="134" width="124" height="38" rx="19" fill="' + c.body + '"/>' +
      '<rect x="104" y="158" width="84" height="12" rx="6" fill="' + c.light + '"/>' +
      '<ellipse cx="184" cy="152" rx="18" ry="18" fill="' + c.body + '"/>' +
      leg(94, c.body) + leg(184, c.body) +
      '<ellipse cx="100" cy="90" rx="47" ry="43" fill="' + c.body + '"/>' +
      '<ellipse cx="100" cy="111.5" rx="26" ry="18" fill="' + c.light + '"/>' +
      '<circle cx="69" cy="104" r="8" fill="#ff9bb0" opacity=".38"/><circle cx="131" cy="104" r="8" fill="#ff9bb0" opacity=".38"/>' +
      '<circle cx="81" cy="63" r="2.8" fill="' + c.light + '" opacity=".85"/><circle cx="119" cy="63" r="2.8" fill="' + c.light + '" opacity=".85"/>' +
      '<ellipse cx="56" cy="105.6" rx="14" ry="19" transform="rotate(7 56 95.2)" fill="' + c.dark + '"/>' +
      '<ellipse cx="144" cy="105.6" rx="14" ry="19" transform="rotate(-7 144 95.2)" fill="' + c.dark + '"/>' +
      eyes("tax", mood, c) +
      '<ellipse cx="100" cy="95.2" rx="8" ry="5.6" fill="#15131a"/><ellipse cx="97.6" cy="93.4" rx="2.6" ry="1.4" fill="#fff" opacity=".5"/>' +
      '<path d="M100,100.2 V104.2 Q94,110.2 88,105.2 M100,104.2 Q106,110.2 112,105.2" stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M95,108.2 Q100,122.2 105,108.2 Z" fill="#ee7f93"/>';
  }

  // a rabbit: tall ears, a round fluffy body with a cotton-ball tail, two front teeth
  function rabbit(c, mood) {
    return '<circle cx="146" cy="164" r="13" fill="' + c.light + '" stroke="rgba(0,0,0,.08)" stroke-width="2"/>' +
      '<ellipse cx="80" cy="177" rx="15" ry="8" fill="' + c.body + '"/><ellipse cx="120" cy="177" rx="15" ry="8" fill="' + c.body + '"/>' +
      '<ellipse cx="100" cy="146" rx="38" ry="34" fill="' + c.body + '"/><ellipse cx="100" cy="153" rx="22" ry="24" fill="' + c.light + '"/>' +
      '<g class="pet-ears"><ellipse cx="76" cy="36" rx="12" ry="30" transform="rotate(-12 76 36)" fill="' + c.body + '"/><ellipse cx="76" cy="38" rx="6" ry="21" transform="rotate(-12 76 38)" fill="#f4a0b4"/>' +
      '<ellipse cx="124" cy="36" rx="12" ry="30" transform="rotate(12 124 36)" fill="' + c.body + '"/><ellipse cx="124" cy="38" rx="6" ry="21" transform="rotate(12 124 38)" fill="#f4a0b4"/></g>' +
      '<circle cx="100" cy="88" r="42" fill="' + c.body + '"/>' +
      '<ellipse cx="100" cy="106" rx="21" ry="14" fill="' + c.light + '"/>' +
      '<circle cx="68" cy="100" r="7" fill="#ff9bb0" opacity=".35"/><circle cx="132" cy="100" r="7" fill="#ff9bb0" opacity=".35"/>' +
      eyes("rabbit", mood, c) +
      '<path d="M95,97 H105 L100,103 Z" fill="#f08aa0"/>' +
      '<path d="M100,103 V107 M100,107 Q95,112 90,108 M100,107 Q105,112 110,108" stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<rect x="95.5" y="108" width="9" height="9" rx="2.4" fill="#fff" stroke="rgba(0,0,0,.18)" stroke-width="1.4"/><path d="M100,108.5 V116" stroke="rgba(0,0,0,.18)" stroke-width="1.2"/>' +
      '<path d="M78,104 L56,99 M78,109 L56,112 M122,104 L144,99 M122,109 L144,112" stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>';
  }

  // the points of a ring of spikes round an ellipse, from one angle (degrees) to another
  function spikeRing(cx, cy, rx, ry, count, len, from, to) {
    const pts = [];
    for (let i = 0; i <= count * 2; i++) {
      const a = (from + (to - from) * i / (count * 2)) * Math.PI / 180;
      const out = i % 2 ? len : 0;
      pts.push((cx + (rx + out) * Math.cos(a)).toFixed(1) + "," + (cy + (ry + out) * Math.sin(a)).toFixed(1));
    }
    return pts.join(" ");
  }

  // a hedgehog: a dome of spikes over the head and back, a small pale face with a pointed nose
  function hedgehog(c, mood) {
    return '<polygon points="' + spikeRing(100, 146, 44, 36, 11, 11, 150, 390) + '" fill="' + c.dark + '"/>' +
      '<ellipse cx="80" cy="177" rx="14" ry="7.5" fill="' + c.light + '"/><ellipse cx="120" cy="177" rx="14" ry="7.5" fill="' + c.light + '"/>' +
      '<ellipse cx="100" cy="148" rx="36" ry="30" fill="' + c.light + '"/>' +
      '<polygon points="' + spikeRing(100, 88, 48, 44, 13, 12, 162, 378) + '" fill="' + c.body + '"/>' +
      '<polygon points="' + spikeRing(100, 88, 40, 36, 13, 7, 170, 370) + '" fill="' + c.dark + '" opacity=".55"/>' +
      '<circle cx="66" cy="76" r="10" fill="' + c.light + '"/><circle cx="134" cy="76" r="10" fill="' + c.light + '"/>' +
      '<path d="M54,100 Q56,66 100,62 Q144,66 146,100 Q148,122 100,124 Q52,122 54,100 Z" fill="' + c.light + '"/>' +
      '<circle cx="70" cy="104" r="6.5" fill="#ff9bb0" opacity=".35"/><circle cx="130" cy="104" r="6.5" fill="#ff9bb0" opacity=".35"/>' +
      eyes("hedgehog", mood, c) +
      '<ellipse cx="100" cy="104" rx="8.5" ry="6" fill="#2a2228"/><ellipse cx="97.5" cy="102.2" rx="2.4" ry="1.4" fill="#fff" opacity=".5"/>' +
      '<path d="M100,110 Q94,117 88,112 M100,110 Q106,117 112,112" stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
  }

  // a fox: pointed ears, white cheeks, a big bushy tail with a pale tip, dark socks
  function fox(c, mood) {
    return '<g class="pet-tail pet-tail-fox"><path d="M130,160 Q176,172 180,128 Q182,100 160,92 Q162,118 142,132 Z" fill="' + c.body + '"/>' +
      '<path d="M160,92 Q182,100 180,128 Q179,141 172,148 Q176,122 160,92 Z" fill="' + c.light + '"/></g>' +
      '<ellipse cx="80" cy="177" rx="14" ry="8" fill="' + c.dark + '"/><ellipse cx="120" cy="177" rx="14" ry="8" fill="' + c.dark + '"/>' +
      '<ellipse cx="100" cy="144" rx="35" ry="36" fill="' + c.body + '"/><ellipse cx="100" cy="150" rx="20" ry="26" fill="' + c.light + '"/>' +
      '<polygon points="54,72 56,20 92,52" fill="' + c.dark + '"/><polygon points="146,72 144,20 108,52" fill="' + c.dark + '"/>' +
      '<polygon points="62,64 63,36 82,54" fill="' + c.light + '"/><polygon points="138,64 137,36 118,54" fill="' + c.light + '"/>' +
      '<ellipse cx="100" cy="86" rx="45" ry="40" fill="' + c.body + '"/>' +
      '<path d="M55,92 Q70,120 100,126 Q130,120 145,92 Q122,104 100,102 Q78,104 55,92 Z" fill="' + c.light + '"/>' +
      '<circle cx="70" cy="101" r="6" fill="#ff9bb0" opacity=".3"/><circle cx="130" cy="101" r="6" fill="#ff9bb0" opacity=".3"/>' +
      eyes("fox", mood, c) +
      '<ellipse cx="100" cy="100" rx="6.5" ry="4.8" fill="#1d1620"/>' +
      '<path d="M100,104 Q95,111 89,107 M100,104 Q105,111 111,107" stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
  }

  // a hamster: round and chubby, full cheeks, small round ears, a tiny nose and two teeth
  function hamster(c, mood) {
    return '<ellipse cx="82" cy="178" rx="13" ry="7" fill="#f4b5a0"/><ellipse cx="118" cy="178" rx="13" ry="7" fill="#f4b5a0"/>' +
      '<ellipse cx="100" cy="150" rx="40" ry="32" fill="' + c.body + '"/><ellipse cx="100" cy="157" rx="25" ry="22" fill="' + c.light + '"/>' +
      '<ellipse cx="84" cy="142" rx="8" ry="6" fill="#f4b5a0"/><ellipse cx="116" cy="142" rx="8" ry="6" fill="#f4b5a0"/>' +
      '<circle cx="62" cy="58" r="14" fill="' + c.body + '"/><circle cx="62" cy="58" r="8" fill="#f4a0b4"/>' +
      '<circle cx="138" cy="58" r="14" fill="' + c.body + '"/><circle cx="138" cy="58" r="8" fill="#f4a0b4"/>' +
      '<ellipse cx="100" cy="90" rx="50" ry="42" fill="' + c.body + '"/>' +
      '<ellipse cx="100" cy="62" rx="20" ry="9" fill="' + c.dark + '" opacity=".35"/>' +
      '<ellipse cx="66" cy="104" rx="17" ry="14" fill="' + c.light + '"/><ellipse cx="134" cy="104" rx="17" ry="14" fill="' + c.light + '"/>' +
      '<ellipse cx="100" cy="104" rx="25" ry="18" fill="' + c.light + '"/>' +
      eyes("hamster", mood, c) +
      '<ellipse cx="100" cy="98" rx="5.5" ry="3.8" fill="#ef8aa0"/>' +
      '<path d="M100,101 V105 M100,105 Q95,110 90,106 M100,105 Q105,110 110,106" stroke="' + INK + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<rect x="96.5" y="106" width="7" height="7.5" rx="2" fill="#fff" stroke="rgba(0,0,0,.18)" stroke-width="1.2"/>' +
      '<path d="M76,104 L58,100 M76,108 L58,110 M124,104 L142,100 M124,108 L142,110" stroke="' + INK + '" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>';
  }

  // a small dragon: horns, little wings, a spade-tipped tail, a pale belly
  function dragon(c, mood) {
    return '<g class="pet-tail pet-tail-dragon"><path d="M134,160 Q176,168 176,136 Q176,120 188,114" fill="none" stroke="' + c.body + '" stroke-width="12" stroke-linecap="round"/>' +
      '<polygon points="184,104 199,116 181,121" fill="' + c.dark + '"/></g>' +
      '<g class="pet-wing pet-wing-l"><path d="M70,130 Q30,114 26,76 Q42,86 50,78 Q54,92 66,94 Q64,110 78,118 Z" fill="' + c.dark + '"/></g>' +
      '<g class="pet-wing pet-wing-r"><path d="M130,130 Q170,114 174,76 Q158,86 150,78 Q146,92 134,94 Q136,110 122,118 Z" fill="' + c.dark + '"/></g>' +
      '<ellipse cx="80" cy="177" rx="15" ry="8" fill="' + c.body + '"/><ellipse cx="120" cy="177" rx="15" ry="8" fill="' + c.body + '"/>' +
      '<ellipse cx="100" cy="146" rx="38" ry="35" fill="' + c.body + '"/><ellipse cx="100" cy="152" rx="24" ry="27" fill="' + c.light + '"/>' +
      '<path d="M80,140 Q100,146 120,140 M78,152 Q100,158 122,152 M80,164 Q100,170 120,164" stroke="rgba(0,0,0,.12)" stroke-width="2" stroke-linecap="round" fill="none"/>' +
      '<polygon points="66,62 54,24 84,50" fill="' + c.light + '"/><polygon points="134,62 146,24 116,50" fill="' + c.light + '"/>' +
      '<ellipse cx="55" cy="88" rx="8" ry="14" fill="' + c.dark + '"/><ellipse cx="145" cy="88" rx="8" ry="14" fill="' + c.dark + '"/>' +
      '<ellipse cx="100" cy="86" rx="45" ry="41" fill="' + c.body + '"/>' +
      '<circle cx="100" cy="58" r="4" fill="' + c.dark + '" opacity=".4"/><circle cx="88" cy="63" r="3" fill="' + c.dark + '" opacity=".4"/><circle cx="112" cy="63" r="3" fill="' + c.dark + '" opacity=".4"/>' +
      '<ellipse cx="100" cy="104" rx="25" ry="17" fill="' + c.light + '"/>' +
      '<circle cx="68" cy="100" r="6.5" fill="#ff9bb0" opacity=".35"/><circle cx="132" cy="100" r="6.5" fill="#ff9bb0" opacity=".35"/>' +
      eyes("dragon", mood, c) +
      '<circle cx="92" cy="101" r="2.4" fill="' + c.dark + '" opacity=".6"/><circle cx="108" cy="101" r="2.4" fill="' + c.dark + '" opacity=".6"/>' +
      '<path d="M88,111 Q100,120 112,111" stroke="' + INK + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  }

  // an axolotl: a salamander, round and cuddly. A wide round head with big shiny eyes, blushing cheeks and a small smile, three long gills on each side that sweep
  // out and up like feathers (a wavy stalk with many fine curved filaments along both sides of it, longest in the middle), a small round body that sits up on four
  // short legs, and a flat tail with a fin.
  function axolotl(c, mood) {
    const num = function (n) { return Math.round(n * 10) / 10; };
    // one gill: an S-shaped stalk (a cubic from P0 to P3) with ten filaments on each side, leaning forward and bending a little further at the end. side: -1 left, 1 right.
    const gill = function (side, P0, C1, C2, P3) {
      const X = function (x) { return side < 0 ? x : 200 - x; };
      const at = function (u) { const v = 1 - u; return [v * v * v * P0[0] + 3 * v * v * u * C1[0] + 3 * v * u * u * C2[0] + u * u * u * P3[0], v * v * v * P0[1] + 3 * v * v * u * C1[1] + 3 * v * u * u * C2[1] + u * u * u * P3[1]]; };
      const tangent = function (u) {
        const v = 1 - u;
        const dx = 3 * v * v * (C1[0] - P0[0]) + 6 * v * u * (C2[0] - C1[0]) + 3 * u * u * (P3[0] - C2[0]), dy = 3 * v * v * (C1[1] - P0[1]) + 6 * v * u * (C2[1] - C1[1]) + 3 * u * u * (P3[1] - C2[1]);
        const l = Math.sqrt(dx * dx + dy * dy) || 1;
        return [dx / l, dy / l];
      };
      const along = [0.1, 0.19, 0.28, 0.37, 0.46, 0.55, 0.64, 0.73, 0.82, 0.9], lengths = [8, 12, 15, 17, 18, 17, 15, 12, 9, 6];
      let out = "";
      along.forEach(function (u, i) {
        const p = at(u), d = tangent(u), n = [-d[1], d[0]];
        [-1, 1].forEach(function (s) {
          const dir = [d[0] * 0.55 + n[0] * 0.83 * s, d[1] * 0.55 + n[1] * 0.83 * s];
          const len = lengths[i];
          const ctl = [p[0] + dir[0] * len * 0.55, p[1] + dir[1] * len * 0.55];
          const tip = [p[0] + dir[0] * len + d[0] * 3.2, p[1] + dir[1] * len + d[1] * 3.2];
          out += '<path d="M' + num(X(p[0])) + ',' + num(p[1]) + ' Q' + num(X(ctl[0])) + ',' + num(ctl[1]) + ' ' + num(X(tip[0])) + ',' + num(tip[1]) + '" stroke="' + c.dark + '" stroke-width="2.3" stroke-linecap="round" fill="none"/>';
        });
      });
      const end = at(1);
      return '<path d="M' + X(P0[0]) + ',' + P0[1] + ' C' + X(C1[0]) + ',' + C1[1] + ' ' + X(C2[0]) + ',' + C2[1] + ' ' + X(P3[0]) + ',' + P3[1] + '" stroke="' + c.dark + '" stroke-width="4.6" stroke-linecap="round" fill="none"/>' + out +
        '<circle cx="' + num(X(end[0])) + '" cy="' + num(end[1]) + '" r="2.6" fill="' + c.dark + '"/>';
    };
    const gills = function (side) {
      return gill(side, [49, 70], [26, 76], [43, 46], [18, 32]) + gill(side, [44, 89], [30, 100], [28, 73], [17, 84]) + gill(side, [49, 106], [26, 102], [43, 128], [18, 134]);
    };
    return '<g class="pet-tail"><path d="M128,166 Q158,168 170,148 Q178,162 166,178 Q148,184 128,176 Z" fill="' + c.body + '"/>' +
      '<path d="M140,170 Q160,168 168,152" stroke="' + c.dark + '" stroke-width="2" stroke-linecap="round" fill="none" opacity=".3"/></g>' +
      '<ellipse cx="78" cy="182" rx="15" ry="7" fill="' + c.body + '"/><ellipse cx="122" cy="182" rx="15" ry="7" fill="' + c.body + '"/>' +
      '<ellipse cx="100" cy="152" rx="37" ry="33" fill="' + c.body + '"/><ellipse cx="100" cy="158" rx="23" ry="23" fill="' + c.light + '"/>' +
      '<ellipse cx="66" cy="152" rx="9" ry="15" fill="' + c.body + '" transform="rotate(14 66 152)"/><ellipse cx="134" cy="152" rx="9" ry="15" fill="' + c.body + '" transform="rotate(-14 134 152)"/>' +
      '<circle cx="62" cy="166" r="3.4" fill="' + c.body + '"/><circle cx="68" cy="168" r="3.4" fill="' + c.body + '"/><circle cx="138" cy="166" r="3.4" fill="' + c.body + '"/><circle cx="132" cy="168" r="3.4" fill="' + c.body + '"/>' +
      gills(-1) + gills(1) +
      '<ellipse cx="100" cy="88" rx="58" ry="43" fill="' + c.body + '"/>' +
      '<circle cx="55" cy="104" r="9" fill="#ff8fa5" opacity=".45"/><circle cx="145" cy="104" r="9" fill="#ff8fa5" opacity=".45"/>' +
      eyes("axolotl", mood, c) +
      '<path d="M88,106 Q94,113.5 100,106 Q106,113.5 112,106" stroke="' + INK + '" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="96" cy="98" r="1.2" fill="' + INK + '" opacity=".4"/><circle cx="104" cy="98" r="1.2" fill="' + INK + '" opacity=".4"/>';
  }

  // a pig: a round pink head with a big snout, floppy ears, a round body, a curly tail and little hooves
  function pig(c, mood) {
    return '<g class="pet-tail"><path d="M136,152 Q160,148 154,132 Q148,122 158,120 Q164,126 158,132" stroke="' + c.dark + '" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>' +
      '<ellipse cx="80" cy="177" rx="14" ry="8" fill="' + c.dark + '"/><ellipse cx="120" cy="177" rx="14" ry="8" fill="' + c.dark + '"/>' +
      '<ellipse cx="100" cy="146" rx="42" ry="35" fill="' + c.body + '"/><ellipse cx="100" cy="153" rx="27" ry="22" fill="' + c.light + '"/>' +
      '<path d="M58,64 Q44,34 74,42 Q88,50 82,66 Z" fill="' + c.dark + '"/><path d="M142,64 Q156,34 126,42 Q112,50 118,66 Z" fill="' + c.dark + '"/>' +
      '<path d="M64,60 Q56,44 72,48 Q80,54 76,62 Z" fill="' + c.light + '" opacity=".6"/><path d="M136,60 Q144,44 128,48 Q120,54 124,62 Z" fill="' + c.light + '" opacity=".6"/>' +
      '<ellipse cx="100" cy="86" rx="45" ry="41" fill="' + c.body + '"/>' +
      '<circle cx="66" cy="98" r="8" fill="#ff8fa8" opacity=".4"/><circle cx="134" cy="98" r="8" fill="#ff8fa8" opacity=".4"/>' +
      eyes("pig", mood, c) +
      '<ellipse cx="100" cy="102" rx="23" ry="16" fill="' + c.light + '"/><ellipse cx="100" cy="102" rx="23" ry="16" fill="none" stroke="' + c.dark + '" stroke-width="2" opacity=".5"/>' +
      '<ellipse cx="91" cy="102" rx="3.6" ry="5.4" fill="' + c.dark + '"/><ellipse cx="109" cy="102" rx="3.6" ry="5.4" fill="' + c.dark + '"/>' +
      '<path d="M90,117 Q100,124 110,117" stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
  }

  // a cow: patches, small horns, ears to the sides, a big pink muzzle and a tail with a tuft
  function cow(c, mood) {
    return '<g class="pet-tail"><path d="M138,162 Q166,152 160,126" stroke="' + c.dark + '" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="160" cy="122" rx="6.5" ry="10" fill="' + c.dark + '"/></g>' +
      '<ellipse cx="80" cy="177" rx="14" ry="8" fill="' + c.dark + '"/><ellipse cx="120" cy="177" rx="14" ry="8" fill="' + c.dark + '"/>' +
      '<ellipse cx="100" cy="146" rx="42" ry="35" fill="' + c.body + '"/><ellipse cx="80" cy="140" rx="17" ry="14" fill="' + c.dark + '"/><ellipse cx="126" cy="158" rx="13" ry="10" fill="' + c.dark + '"/>' +
      '<path d="M64,54 Q54,38 66,30 Q71,42 76,54 Z" fill="#f3e6c8"/><path d="M136,54 Q146,38 134,30 Q129,42 124,54 Z" fill="#f3e6c8"/>' +
      '<ellipse cx="54" cy="76" rx="17" ry="9" transform="rotate(-18 54 76)" fill="' + c.body + '" stroke="rgba(0,0,0,.1)" stroke-width="1.5"/><ellipse cx="54" cy="76" rx="9" ry="4.5" transform="rotate(-18 54 76)" fill="' + c.light + '"/>' +
      '<ellipse cx="146" cy="76" rx="17" ry="9" transform="rotate(18 146 76)" fill="' + c.body + '" stroke="rgba(0,0,0,.1)" stroke-width="1.5"/><ellipse cx="146" cy="76" rx="9" ry="4.5" transform="rotate(18 146 76)" fill="' + c.light + '"/>' +
      '<ellipse cx="100" cy="86" rx="42" ry="40" fill="' + c.body + '" stroke="rgba(0,0,0,.06)" stroke-width="1.5"/>' +
      '<ellipse cx="72" cy="62" rx="14" ry="12" fill="' + c.dark + '"/><ellipse cx="100" cy="49" rx="9" ry="5.5" fill="' + c.dark + '"/>' +
      '<circle cx="66" cy="96" r="7.5" fill="#ff9bb0" opacity=".38"/><circle cx="134" cy="96" r="7.5" fill="#ff9bb0" opacity=".38"/>' +
      eyes("cow", mood, c) +
      '<ellipse cx="100" cy="109" rx="28" ry="18" fill="' + c.light + '"/><ellipse cx="90" cy="108" rx="3.6" ry="5.4" fill="rgba(120,40,60,.55)"/><ellipse cx="110" cy="108" rx="3.6" ry="5.4" fill="rgba(120,40,60,.55)"/>' +
      '<path d="M91,119 Q100,125 109,119" stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
  }

  // a cockatiel: a round yellow face with a crest, orange cheeks, a small beak, wings that flap and long tail feathers
  function cockatiel(c, mood) {
    return '<path d="M94,166 L88,198 L104,178 Z" fill="' + c.dark + '"/><path d="M106,166 L114,198 L98,178 Z" fill="' + c.body + '" stroke="' + c.dark + '" stroke-width="1.5"/>' +
      '<ellipse cx="86" cy="181" rx="10" ry="4.5" fill="#f0a24b"/><ellipse cx="114" cy="181" rx="10" ry="4.5" fill="#f0a24b"/>' +
      '<g class="pet-wing pet-wing-l"><ellipse cx="58" cy="132" rx="13" ry="33" transform="rotate(10 58 132)" fill="' + c.dark + '"/></g>' +
      '<g class="pet-wing pet-wing-r"><ellipse cx="142" cy="132" rx="13" ry="33" transform="rotate(-10 142 132)" fill="' + c.dark + '"/></g>' +
      '<ellipse cx="100" cy="138" rx="38" ry="42" fill="' + c.body + '"/><ellipse cx="100" cy="150" rx="22" ry="28" fill="#fff" opacity=".2"/>' +
      '<path d="M88,52 Q80,28 94,14 Q94,34 104,48 Z" fill="' + c.light + '"/><path d="M100,50 Q102,22 118,12 Q112,34 112,52 Z" fill="' + c.light + '"/><path d="M80,56 Q66,40 72,24 Q84,38 92,52 Z" fill="' + c.light + '"/>' +
      '<circle cx="100" cy="86" r="41" fill="' + c.light + '"/>' +
      '<circle cx="68" cy="98" r="11" fill="#f0822f"/><circle cx="132" cy="98" r="11" fill="#f0822f"/>' +
      eyes("cockatiel", mood, c) +
      '<path d="M91,92 Q100,84 109,92 Q106,106 100,109 Q94,106 91,92 Z" fill="#b9bec7"/><path d="M95,98 Q100,102 105,98" stroke="rgba(0,0,0,.18)" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
  }

  function cat(c, mood) {
    return '<g class="pet-tail pet-tail-cat"><path d="M136,158 Q172,152 166,116 Q164,104 156,106" fill="none" stroke="' + c.body + '" stroke-width="11" stroke-linecap="round"/></g>' +
      '<ellipse cx="80" cy="176" rx="14" ry="8" fill="' + c.body + '"/><ellipse cx="120" cy="176" rx="14" ry="8" fill="' + c.body + '"/>' +
      '<ellipse cx="100" cy="142" rx="37" ry="35" fill="' + c.body + '"/><ellipse cx="100" cy="150" rx="23" ry="25" fill="' + c.light + '"/>' +
      '<polygon points="58,66 64,28 92,50" fill="' + c.body + '"/><polygon points="142,66 136,28 108,50" fill="' + c.body + '"/>' +
      '<polygon points="65,58 68,40 82,51" fill="#f4a0b4"/><polygon points="135,58 132,40 118,51" fill="#f4a0b4"/>' +
      '<circle cx="100" cy="86" r="44" fill="' + c.body + '"/>' +
      '<path d="M92,46 V58 M100,44 V59 M108,46 V58" stroke="' + c.dark + '" stroke-width="3" stroke-linecap="round" fill="none"/>' +
      '<ellipse cx="100" cy="103" rx="15" ry="11" fill="' + c.light + '"/>' +
      '<circle cx="70" cy="98" r="7" fill="#ff9bb0" opacity=".35"/><circle cx="130" cy="98" r="7" fill="#ff9bb0" opacity=".35"/>' +
      eyes("cat", mood, c) +
      '<path d="M95,97 H105 L100,103 Z" fill="#f08aa0"/>' +
      '<path d="M100,103 Q96,109 91,106 M100,103 Q104,109 109,106" stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M78,100 L54,95 M78,105 L54,108 M122,100 L146,95 M122,105 L146,108" stroke="' + INK + '" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>';
  }

  function penguin(c, mood) {
    return '<ellipse cx="80" cy="183" rx="14" ry="6" fill="#f4a43a"/><ellipse cx="120" cy="183" rx="14" ry="6" fill="#f4a43a"/>' +
      '<g class="pet-wing pet-wing-l"><ellipse cx="54" cy="128" rx="11" ry="32" fill="' + c.dark + '" transform="rotate(14 54 128)"/></g>' +
      '<g class="pet-wing pet-wing-r"><ellipse cx="146" cy="128" rx="11" ry="32" fill="' + c.dark + '" transform="rotate(-14 146 128)"/></g>' +
      '<ellipse cx="100" cy="118" rx="46" ry="64" fill="' + c.body + '"/><ellipse cx="100" cy="142" rx="30" ry="40" fill="' + c.light + '"/>' +
      '<path d="M62,88 Q62,60 84,62 Q100,68 116,62 Q138,60 138,88 Q138,114 100,114 Q62,114 62,88 Z" fill="' + c.light + '"/>' +
      '<circle cx="70" cy="98" r="6" fill="#ff9bb0" opacity=".4"/><circle cx="130" cy="98" r="6" fill="#ff9bb0" opacity=".4"/>' +
      eyes("penguin", mood, c) +
      '<path d="M90,92 Q100,86 110,92 Q106,106 100,108 Q94,106 90,92 Z" fill="#f4a43a"/>';
  }

  // ===== the shop =====
  function star(cx, cy, r, fill, stroke) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push((cx + rr * Math.cos(a)).toFixed(1) + "," + (cy + rr * Math.sin(a)).toFixed(1));
    }
    return '<polygon points="' + pts.join(" ") + '" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="2" stroke-linejoin="round"' : "") + '/>';
  }

  function heart(cx, cy, s, fill, stroke) {
    return '<path d="M' + cx + ',' + (cy + s * 0.95) + ' C' + (cx - s * 1.6) + ',' + (cy - s * 0.1) + ' ' + (cx - s * 0.8) + ',' + (cy - s * 1.25) + ' ' + cx + ',' + (cy - s * 0.45) +
      ' C' + (cx + s * 0.8) + ',' + (cy - s * 1.25) + ' ' + (cx + s * 1.6) + ',' + (cy - s * 0.1) + ' ' + cx + ',' + (cy + s * 0.95) + ' Z" fill="' + fill + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="2" stroke-linejoin="round"' : "") + '/>';
  }

  function flower(cx, cy, r, petal, centre) {
    let s = "";
    for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5 - Math.PI / 2; s += '<circle cx="' + (cx + r * 0.62 * Math.cos(a)).toFixed(1) + '" cy="' + (cy + r * 0.62 * Math.sin(a)).toFixed(1) + '" r="' + (r * 0.5).toFixed(1) + '" fill="' + petal + '"/>'; }
    return s + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.32).toFixed(1) + '" fill="' + centre + '"/>';
  }

  const ITEMS = [
    // hats
    { id: "hatt-keps", slot: "hat", name: "Keps", price: 15, view: "44 6 126 66", art: function () {
      return '<path d="M60,54 Q100,10 140,54 Z" fill="#e0506d"/><path d="M118,52 Q152,44 162,60 Q140,62 116,58 Z" fill="#b83c56"/><circle cx="100" cy="24" r="5" fill="#b83c56"/>'; } },
    { id: "hatt-blomma", slot: "hat", name: "Blomma", price: 15, view: "90 14 80 66", art: function () {
      let petals = "";
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; petals += '<circle cx="' + (134 + 11 * Math.cos(a)).toFixed(1) + '" cy="' + (44 + 11 * Math.sin(a)).toFixed(1) + '" r="8" fill="#ff8fb0"/>'; }
      return petals + '<circle cx="134" cy="44" r="7" fill="#ffd54a"/>'; } },
    { id: "hatt-mossa", slot: "hat", name: "Stickad mössa", price: 20, view: "40 0 120 74", art: function () {
      return '<path d="M60,58 Q62,14 100,14 Q138,14 140,58 Z" fill="#4c9be8"/><rect x="56" y="46" width="88" height="15" rx="7" fill="#7fb9f2"/>' +
        '<path d="M70,46 V61 M84,46 V61 M98,46 V61 M112,46 V61 M126,46 V61" stroke="#4c9be8" stroke-width="2.5" opacity=".6"/><circle cx="100" cy="11" r="10" fill="#fff"/>'; } },
    { id: "hatt-propeller", slot: "hat", name: "Propellerkeps", price: 35, view: "44 4 126 68", art: function () {
      return '<path d="M60,54 Q100,14 140,54 Z" fill="#43b581"/><path d="M118,52 Q152,44 162,60 Q140,62 116,58 Z" fill="#2f8f64"/>' +
        '<rect x="97" y="22" width="6" height="12" fill="#2f8f64"/><g class="pet-prop"><ellipse cx="86" cy="21" rx="15" ry="4.5" fill="#f2c94c"/><ellipse cx="114" cy="21" rx="15" ry="4.5" fill="#e0506d"/></g><circle cx="100" cy="21" r="4" fill="#2a2630"/>'; } },
    { id: "hatt-trolleri", slot: "hat", name: "Trollerihatt", price: 40, view: "40 -6 120 80", art: function () {
      return '<path d="M76,52 L82,6 H118 L124,52 Z" fill="#3b2f63"/><ellipse cx="100" cy="52" rx="42" ry="8" fill="#2c2350"/><rect x="77" y="38" width="46" height="9" fill="#e0506d"/>' + star(100, 24, 8, "#ffd54a"); } },
    { id: "hatt-student", slot: "hat", name: "Studenthatt", price: 50, view: "40 4 120 76", art: function () {
      return '<path d="M74,48 V64 Q100,76 126,64 V48 Z" fill="#2a2a3a"/><path d="M50,40 L100,20 L150,40 L100,58 Z" fill="#3a3a52"/><path d="M142,42 L146,68" stroke="#f2c94c" stroke-width="3" fill="none"/><circle cx="146" cy="70" r="4.5" fill="#f2c94c"/>'; } },
    { id: "hatt-krona", slot: "hat", name: "Krona", price: 60, view: "50 6 100 54", art: function () {
      return '<path d="M66,54 L70,22 L87,40 L100,16 L113,40 L130,22 L134,54 Z" fill="#f2c94c" stroke="#d9a520" stroke-width="2" stroke-linejoin="round"/><circle cx="100" cy="34" r="4.5" fill="#e0506d"/><circle cx="80" cy="46" r="3.5" fill="#4c9be8"/><circle cx="120" cy="46" r="3.5" fill="#43b581"/>'; } },
    // glasses and the like
    { id: "glas-runda", slot: "face", name: "Runda glasögon", price: 20, view: "60 62 80 40", art: function () {
      return '<g fill="rgba(255,255,255,.28)" stroke="#2a2630" stroke-width="3"><circle cx="84" cy="82" r="13"/><circle cx="116" cy="82" r="13"/></g><path d="M97,82 H103 M71,80 L62,76 M129,80 L138,76" stroke="#2a2630" stroke-width="3" stroke-linecap="round" fill="none"/>'; } },
    { id: "glas-sol", slot: "face", name: "Solglasögon", price: 25, view: "60 62 80 40", art: function () {
      return '<path d="M70,76 H98 V88 Q98,96 88,96 H80 Q70,96 70,88 Z M102,76 H130 V88 Q130,96 120,96 H112 Q102,96 102,88 Z" fill="#1f2330"/><path d="M98,79 H102 M70,78 L62,75 M130,78 L138,75" stroke="#1f2330" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M75,80 L82,80 M107,80 L114,80" stroke="#8fa0ff" stroke-width="2.5" stroke-linecap="round"/>'; } },
    { id: "glas-clown", slot: "face", name: "Clownnäsa", price: 20, view: "76 82 48 36", art: function () {
      return '<circle cx="100" cy="99" r="10" fill="#e8394d"/><circle cx="97" cy="95" r="3" fill="#fff" opacity=".7"/>'; } },
    { id: "glas-mustasch", slot: "face", name: "Mustasch", price: 30, view: "70 92 60 30", art: function () {
      return '<path d="M80,110 Q90,100 100,107 Q110,100 120,110 Q110,118 100,112 Q90,118 80,110 Z" fill="#5a3a22"/>'; } },
    { id: "glas-stjarna", slot: "face", name: "Stjärnglasögon", price: 35, view: "56 58 88 48", art: function () {
      return star(84, 82, 17, "#ffd54a", "#e0a020") + star(116, 82, 17, "#ffd54a", "#e0a020") + '<path d="M97,82 H103" stroke="#e0a020" stroke-width="3" stroke-linecap="round"/>'; } },
    // around the neck
    { id: "hals-fluga", slot: "neck", name: "Fluga", price: 15, view: "70 108 60 44", art: function () {
      return '<polygon points="100,130 78,118 78,142" fill="#8a5cd1"/><polygon points="100,130 122,118 122,142" fill="#8a5cd1"/><circle cx="100" cy="130" r="7" fill="#6a3fb5"/>'; } },
    { id: "hals-halsduk", slot: "neck", name: "Halsduk", price: 20, view: "52 108 96 70", art: function () {
      return '<path d="M60,122 Q100,148 140,122 L140,138 Q100,164 60,138 Z" fill="#e0506d"/><path d="M118,142 L136,178 L120,182 L108,150 Z" fill="#e0506d"/><path d="M84,138 L88,152 M100,142 L102,156 M118,138 L120,148" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>'; } },
    { id: "hals-klocka", slot: "neck", name: "Halsband med klocka", price: 25, view: "56 108 88 54", art: function () {
      return '<path d="M62,122 Q100,146 138,122" fill="none" stroke="#43b581" stroke-width="8" stroke-linecap="round"/><circle cx="100" cy="142" r="8" fill="#f2c94c" stroke="#d9a520" stroke-width="2"/><path d="M95,144 H105" stroke="#d9a520" stroke-width="2"/>'; } },
    { id: "hals-medalj", slot: "neck", name: "Guldmedalj", price: 40, view: "66 108 68 68", art: function () {
      return '<path d="M78,118 L100,148 M122,118 L100,148" stroke="#e0506d" stroke-width="7" stroke-linecap="round"/><circle cx="100" cy="152" r="14" fill="#f2c94c" stroke="#d9a520" stroke-width="3"/>' + star(100, 152, 8, "#fff6c9"); } },
    { id: "hals-pi", slot: "neck", name: "Pi-halsband", price: 45, view: "62 108 76 68", art: function () {
      return '<path d="M66,120 Q100,150 134,120" fill="none" stroke="#9aa4b8" stroke-width="2.5"/><circle cx="100" cy="150" r="14" fill="#2f9d88" stroke="#1f7a69" stroke-width="3"/><text x="100" y="157" text-anchor="middle" font-size="19" font-weight="800" font-family="Nunito, Arial, sans-serif" fill="#fff">π</text>'; } },
    // more hats
    { id: "hatt-kock", slot: "hat", name: "Kockmössa", price: 25, view: "44 -2 112 66", art: function () {
      return '<circle cx="78" cy="34" r="16" fill="#fff" stroke="#e1e6f0" stroke-width="2"/><circle cx="122" cy="34" r="16" fill="#fff" stroke="#e1e6f0" stroke-width="2"/><circle cx="100" cy="26" r="19" fill="#fff" stroke="#e1e6f0" stroke-width="2"/>' +
        '<rect x="68" y="42" width="64" height="18" rx="5" fill="#fff" stroke="#e1e6f0" stroke-width="2"/><path d="M80,46 V57 M92,46 V57 M108,46 V57 M120,46 V57" stroke="#e1e6f0" stroke-width="2"/>'; } },
    { id: "hatt-cowboy", slot: "hat", name: "Cowboyhatt", price: 30, view: "34 12 132 56", art: function () {
      return '<path d="M72,54 Q70,22 86,24 Q100,34 114,24 Q130,22 128,54 Z" fill="#c58a4a"/><rect x="71" y="43" width="58" height="7" fill="#7a4a22"/><path d="M36,56 Q38,46 58,52 Q100,62 142,52 Q162,46 164,56 Q130,66 100,66 Q70,66 36,56 Z" fill="#a9733b"/>'; } },
    { id: "hatt-krans", slot: "hat", name: "Blomsterkrans", price: 25, view: "52 24 96 40", art: function () {
      const cols = [["#ff8fb0", "#ffd54a"], ["#fff", "#ffd54a"], ["#ffb454", "#fff"], ["#b99cf0", "#ffd54a"], ["#ff8fb0", "#ffd54a"], ["#fff", "#ffd54a"], ["#ffb454", "#fff"]];
      let leaves = "", flowers = "";
      cols.forEach(function (c, i) {
        const p = curvePoint([62, 58], [100, 28], [138, 58], i / 6);
        leaves += '<ellipse cx="' + (p[0] + (i % 2 ? 6 : -6)).toFixed(1) + '" cy="' + (p[1] + 3).toFixed(1) + '" rx="7" ry="3.4" fill="#43b581"/>';
        flowers += flower(Number(p[0].toFixed(1)), Number(p[1].toFixed(1)), 9, c[0], c[1]);
      });
      return '<path d="M62,58 Q100,28 138,58" fill="none" stroke="#43b581" stroke-width="4"/>' + leaves + flowers; } },
    { id: "hatt-pirat", slot: "hat", name: "Pirathatt", price: 40, view: "40 6 120 62", art: function () {
      return '<path d="M42,58 Q58,60 66,44 Q100,18 134,44 Q142,60 158,58 Q150,34 120,24 Q100,12 80,24 Q50,34 42,58 Z" fill="#2a2a3a"/><path d="M66,44 Q100,26 134,44 L134,50 Q100,34 66,50 Z" fill="#3d3d57"/>' +
        '<circle cx="100" cy="34" r="7" fill="#fff"/><rect x="95" y="38" width="10" height="5" rx="2" fill="#fff"/><circle cx="97" cy="33" r="1.8" fill="#2a2a3a"/><circle cx="103" cy="33" r="1.8" fill="#2a2a3a"/>'; } },
    { id: "hatt-antenn", slot: "hat", name: "Rymdantenner", price: 30, view: "56 -2 88 62", art: function () {
      return '<path d="M62,56 Q100,36 138,56" fill="none" stroke="#8a5cd1" stroke-width="5" stroke-linecap="round"/><path d="M80,45 Q72,26 76,12 M120,45 Q128,26 124,12" fill="none" stroke="#8a5cd1" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="76" cy="10" r="7" fill="#43b581"/><circle cx="124" cy="10" r="7" fill="#e0506d"/><circle cx="74" cy="8" r="2" fill="#fff" opacity=".7"/><circle cx="122" cy="8" r="2" fill="#fff" opacity=".7"/>'; } },
    // more glasses and the like
    { id: "glas-hjarta", slot: "face", name: "Hjärtglasögon", price: 35, view: "56 62 88 44", art: function () {
      return heart(84, 82, 10, "rgba(255,111,145,.85)", "#c93a62") + heart(116, 82, 10, "rgba(255,111,145,.85)", "#c93a62") + '<path d="M95,80 H105 M72,78 L62,74 M128,78 L138,74" stroke="#c93a62" stroke-width="3" stroke-linecap="round" fill="none"/>'; } },
    { id: "glas-pirat", slot: "face", name: "Piratlapp", price: 25, view: "56 58 88 48", art: function () {
      return '<path d="M60,66 Q100,56 140,70" fill="none" stroke="#1f2330" stroke-width="3" stroke-linecap="round"/><ellipse cx="84" cy="82" rx="14" ry="12" fill="#1f2330"/><path d="M76,76 Q84,72 90,74" stroke="#4a4f66" stroke-width="2" stroke-linecap="round" fill="none"/>'; } },
    { id: "glas-3d", slot: "face", name: "3D-glasögon", price: 30, view: "56 62 88 40", art: function () {
      return '<rect x="68" y="72" width="30" height="22" rx="3" fill="rgba(232,57,77,.72)" stroke="#f4f4f4" stroke-width="4"/><rect x="102" y="72" width="30" height="22" rx="3" fill="rgba(47,184,232,.72)" stroke="#f4f4f4" stroke-width="4"/><path d="M98,80 H102 M68,78 L60,74 M132,78 L140,74" stroke="#f4f4f4" stroke-width="3.5" stroke-linecap="round" fill="none"/>'; } },
    { id: "glas-mask", slot: "face", name: "Hjältemask", price: 40, view: "50 62 100 44", art: function () {
      return '<path fill-rule="evenodd" d="M58,80 Q80,64 100,76 Q120,64 142,80 Q142,100 118,100 Q108,92 100,94 Q92,92 82,100 Q58,100 58,80 Z M71,84 a13,9 0 1,0 26,0 a13,9 0 1,0 -26,0 Z M103,84 a13,9 0 1,0 26,0 a13,9 0 1,0 -26,0 Z" fill="#e0506d"/>' +
        '<path d="M60,82 L48,92 M140,82 L152,92" stroke="#b83c56" stroke-width="4" stroke-linecap="round"/><path d="M66,76 Q74,72 82,74" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".6"/>'; } },
    // more around the neck
    { id: "hals-slips", slot: "neck", name: "Slips", price: 20, view: "72 108 56 76", art: function () {
      return '<polygon points="76,116 100,130 88,138" fill="#fff" stroke="#dfe5f0" stroke-width="2" stroke-linejoin="round"/><polygon points="124,116 100,130 112,138" fill="#fff" stroke="#dfe5f0" stroke-width="2" stroke-linejoin="round"/>' +
        '<polygon points="94,124 106,124 103,134 97,134" fill="#2f7fd1"/><path d="M97,134 H103 L109,168 L100,178 L91,168 Z" fill="#4c9be8"/><path d="M96,146 L106,142 M94,156 L108,152" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>'; } },
    { id: "hals-krans", slot: "neck", name: "Blomhalsband", price: 25, view: "52 108 96 56", art: function () {
      const cols = [["#ff8fb0", "#ffd54a"], ["#fff", "#ffd54a"], ["#ffb454", "#fff"], ["#b99cf0", "#ffd54a"], ["#ff8fb0", "#ffd54a"]];
      let s = '<path d="M60,120 Q100,152 140,120" fill="none" stroke="#43b581" stroke-width="3"/>';
      cols.forEach(function (c, i) { const p = curvePoint([60, 120], [100, 152], [140, 120], (i + 0.5) / 5); s += flower(Number(p[0].toFixed(1)), Number((p[1] + 3).toFixed(1)), 9, c[0], c[1]); });
      return s; } },
    { id: "hals-snacka", slot: "neck", name: "Snäckhalsband", price: 30, view: "60 108 80 62", art: function () {
      return '<path d="M64,120 Q100,150 136,120" fill="none" stroke="#9aa4b8" stroke-width="2"/><circle cx="76" cy="130" r="3.4" fill="#fff"/><circle cx="124" cy="130" r="3.4" fill="#fff"/><circle cx="86" cy="138" r="3.4" fill="#f2c94c"/><circle cx="114" cy="138" r="3.4" fill="#f2c94c"/>' +
        '<path d="M100,166 L84,150 Q100,134 116,150 Z" fill="#f6c9b0" stroke="#e0a88a" stroke-width="2" stroke-linejoin="round"/><path d="M100,166 L92,146 M100,166 L100,142 M100,166 L108,146" stroke="#e0a88a" stroke-width="1.8" stroke-linecap="round"/>'; } },
    { id: "hals-hjarta", slot: "neck", name: "Hjärtmedaljong", price: 35, view: "66 108 68 68", art: function () {
      return '<path d="M70,120 Q100,150 130,120" fill="none" stroke="#d9a520" stroke-width="2.6"/>' + heart(100, 154, 12, "#e8394d", "#b83c56") + '<path d="M91,148 Q93,144 97,145" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".8"/>'; } },
    // more hats, glasses and necklaces
    { id: "hatt-tomte", slot: "hat", name: "Tomteluva", price: 30, view: "46 -6 108 70", art: function () {
      return '<path d="M64,56 Q68,20 108,8 Q134,2 146,20 Q126,16 124,56 Z" fill="#e0443f"/><rect x="58" y="46" width="84" height="13" rx="6.5" fill="#fff"/><circle cx="146" cy="20" r="8" fill="#fff"/>'; } },
    { id: "hatt-fest", slot: "hat", name: "Festhatt", price: 20, view: "56 0 88 66", art: function () {
      return '<path d="M76,56 L100,8 L124,56 Z" fill="#f6d34a"/><path d="M86,36 L110,46 M80,46 L116,60 M92,24 L106,30" stroke="#e0506d" stroke-width="5" stroke-linecap="round"/><rect x="74" y="52" width="52" height="7" rx="3.5" fill="#8a5cd1"/><circle cx="100" cy="8" r="6" fill="#8a5cd1"/>'; } },
    { id: "hatt-halm", slot: "hat", name: "Halmhatt", price: 25, view: "36 22 128 44", art: function () {
      return '<ellipse cx="100" cy="54" rx="56" ry="10" fill="#f0cf7a"/><path d="M70,54 Q72,26 100,26 Q128,26 130,54 Z" fill="#f6dc8f"/><rect x="70" y="42" width="60" height="8" fill="#e0506d"/><path d="M42,54 Q100,66 158,54" fill="none" stroke="#d9b45a" stroke-width="2"/>'; } },
    { id: "hatt-hjalm", slot: "hat", name: "Cykelhjälm", price: 25, view: "52 12 96 52", art: function () {
      return '<path d="M58,58 Q60,16 100,16 Q140,16 142,58 Z" fill="#ff7a3d"/><path d="M80,20 Q78,40 82,58 M100,16 V58 M120,20 Q122,40 118,58" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85" fill="none"/><rect x="54" y="54" width="92" height="7" rx="3.5" fill="#d9531c"/>'; } },
    { id: "glas-skid", slot: "face", name: "Skidglasögon", price: 35, view: "48 60 104 44", art: function () {
      return '<path d="M66,82 L50,80 M134,82 L150,80" stroke="#2a2630" stroke-width="6" stroke-linecap="round"/><rect x="66" y="70" width="68" height="26" rx="12" fill="#4c9be8" fill-opacity=".75" stroke="#2a2630" stroke-width="3.5"/><path d="M76,78 L90,76" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>'; } },
    { id: "glas-las", slot: "face", name: "Läsglasögon", price: 20, view: "60 66 80 34", art: function () {
      return '<g fill="rgba(255,255,255,.3)" stroke="#8a5f3a" stroke-width="3"><rect x="68" y="72" width="26" height="19" rx="4"/><rect x="106" y="72" width="26" height="19" rx="4"/></g><path d="M94,78 H106 M68,76 L61,72 M132,76 L139,72" stroke="#8a5f3a" stroke-width="3" stroke-linecap="round" fill="none"/>'; } },
    { id: "glas-kinder", slot: "face", name: "Rosa kinder", price: 15, view: "56 84 88 30", art: function () {
      return '<circle cx="68" cy="100" r="9" fill="#ff8fb0" opacity=".6"/><circle cx="132" cy="100" r="9" fill="#ff8fb0" opacity=".6"/>'; } },
    { id: "glas-fraknar", slot: "face", name: "Fräknar", price: 15, view: "72 86 56 26", art: function () {
      return '<g fill="#b06a3a"><circle cx="82" cy="94" r="1.7"/><circle cx="88" cy="99" r="1.7"/><circle cx="92" cy="93" r="1.7"/><circle cx="118" cy="94" r="1.7"/><circle cx="112" cy="99" r="1.7"/><circle cx="108" cy="93" r="1.7"/></g>'; } },
    { id: "hals-bandana", slot: "neck", name: "Bandana", price: 20, view: "58 108 84 66", art: function () {
      return '<path d="M62,120 Q100,142 138,120 L100,172 Z" fill="#e0506d"/><g fill="#fff"><circle cx="86" cy="130" r="2.6"/><circle cx="100" cy="140" r="2.6"/><circle cx="114" cy="130" r="2.6"/><circle cx="100" cy="156" r="2.6"/></g>'; } },
    { id: "hals-parlor", slot: "neck", name: "Pärlhalsband", price: 30, view: "58 108 84 56", art: function () {
      let s = "";
      for (let i = 0; i <= 8; i++) { const p = curvePoint([64, 120], [100, 164], [136, 120], i / 8); s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5" fill="' + (i % 2 ? "#ffc6d6" : "#fff") + '" stroke="#cfd6e6" stroke-width="1.6"/>'; }
      return s; } },
    { id: "hals-horlurar", slot: "face", name: "Hörlurar", price: 30, view: "32 24 136 92", art: function (head) {
      const h = head || HEAD.dog, L = h.cx - h.rx - 1, R = h.cx + h.rx + 1, y = h.cy + 4, top = h.cy - h.ry - 24;
      const cup = function (x) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="9.5" ry="15" fill="#e0506d" stroke="#3a3f58" stroke-width="3"/><ellipse cx="' + x + '" cy="' + y + '" rx="4" ry="8" fill="#f58ba0"/>'; };
      return '<path d="M' + L + ',' + y + ' C' + (L - 6) + ',' + top + ' ' + (R + 6) + ',' + top + ' ' + R + ',' + y + '" fill="none" stroke="#3a3f58" stroke-width="7" stroke-linecap="round"/>' + cup(L) + cup(R); } },
    { id: "hals-kappa", slot: "neck", name: "Hjältekappa", price: 40, view: "50 108 100 76", art: function () {
      return '<path d="M64,120 Q100,138 136,120 L146,178 Q100,166 54,178 Z" fill="#e0443f"/><path d="M64,120 Q100,138 136,120" fill="none" stroke="#b83c56" stroke-width="3"/><circle cx="100" cy="132" r="5" fill="#f2c94c" stroke="#d9a520" stroke-width="2"/>'; } },
  ];


  // ===== themed sets: one for each area of the course =====
  // Three pieces each (hat, glasses, necklace). A piece is unlocked by finishing lessons in that area, then bought with coins.
  const SETS = [
    { id: "tal", name: "Siffervännen", area: "tal", areaName: "Tal & räkning" },
    { id: "algebra", name: "Mysteriet x", area: "algebra", areaName: "Samband & algebra" },
    { id: "geometri", name: "Formvännen", area: "geometri", areaName: "Form & rum" },
    { id: "matning", name: "Tidsvännen", area: "matning", areaName: "Tid & mätning" },
    { id: "data", name: "Slumpvännen", area: "data", areaName: "Data & slump" }
  ];
  const NEED = [2, 4, 6];     // finished lessons in the area that unlock the first, second and third piece
  const TEXT = ' font-family="Nunito, Arial, sans-serif" font-weight="900" text-anchor="middle"';

  function curvePoint(p0, p1, p2, t) {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  }

  function wedge(cx, cy, r, a0, a1, fill) {
    const p = function (a) { const rad = (a - 90) * Math.PI / 180; return (cx + r * Math.cos(rad)).toFixed(1) + "," + (cy + r * Math.sin(rad)).toFixed(1); };
    return '<path d="M' + cx + ',' + cy + ' L' + p(a0) + ' A' + r + ',' + r + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + p(a1) + ' Z" fill="' + fill + '"/>';
  }

  function themed(set, n, slot, id, name, price, view, art) {
    return { id: id, slot: slot, name: name, price: price, view: view, art: art, set: set, need: NEED[n] };
  }

  const THEMED = [
    // Siffervännen
    themed("tal", 0, "hat", "tal-hatt", "Räknehatt", 30, "44 8 112 62", function () {
      return '<path d="M60,58 Q62,16 100,16 Q138,16 140,58 Z" fill="#f08a3c"/><rect x="57" y="50" width="86" height="12" rx="6" fill="#d96f22"/><text x="100" y="42"' + TEXT + ' font-size="19" fill="#fff">1+2</text>'; }),
    themed("tal", 1, "face", "tal-glas", "Plusglasögon", 40, "60 62 80 40", function () {
      return '<g stroke="#2a2630" stroke-width="3" fill="#fff6d6"><circle cx="84" cy="82" r="13"/><circle cx="116" cy="82" r="13"/></g><path d="M97,82 H103 M71,80 L62,76 M129,80 L138,76" stroke="#2a2630" stroke-width="3" stroke-linecap="round" fill="none"/>' +
        '<path d="M84,75 V89 M77,82 H91" stroke="#e0506d" stroke-width="3.6" stroke-linecap="round"/><path d="M109,82 H123" stroke="#2f7fd1" stroke-width="3.6" stroke-linecap="round"/>'; }),
    themed("tal", 2, "neck", "tal-hals", "Räknepärlor", 50, "52 108 96 54", function () {
      let beads = "";
      const colors = ["#e0506d", "#f2c94c", "#4c9be8", "#43b581", "#8a5cd1"];
      for (let i = 0; i <= 10; i++) { const p = curvePoint([62, 120], [100, 154], [138, 120], i / 10); beads += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="6" fill="' + colors[i % colors.length] + '" stroke="rgba(0,0,0,.18)" stroke-width="1"/>'; }
      return '<path d="M62,120 Q100,154 138,120" fill="none" stroke="#9aa4b8" stroke-width="2"/>' + beads; }),
    // Mysteriet x
    themed("algebra", 0, "hat", "alg-hatt", "x-hatt", 30, "44 8 112 62", function () {
      return '<path d="M60,58 Q62,16 100,16 Q138,16 140,58 Z" fill="#7a56c7"/><rect x="57" y="50" width="86" height="12" rx="6" fill="#5c3fa6"/><text x="100" y="44"' + TEXT + ' font-size="28" font-style="italic" fill="#ffd54a">x</text>'; }),
    themed("algebra", 1, "face", "alg-glas", "Detektivmonokel", 40, "76 60 80 90", function () {
      return '<circle cx="116" cy="82" r="15" fill="rgba(180,220,255,.38)" stroke="#d9a520" stroke-width="3.6"/><path d="M107,76 Q111,72 118,73" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".85"/>' +
        '<path d="M127,94 L138,108" stroke="#d9a520" stroke-width="4" stroke-linecap="round"/><path d="M133,101 Q144,128 120,142" stroke="#e3b030" stroke-width="1.8" fill="none"/>'; }),
    themed("algebra", 2, "neck", "alg-hals", "Balansvåg", 50, "60 108 80 62", function () {
      return '<path d="M64,120 Q100,146 136,120" fill="none" stroke="#e3b030" stroke-width="2"/><path d="M100,134 V158 M92,158 H108 M80,138 H120" stroke="#b8891a" stroke-width="3" stroke-linecap="round" fill="none"/>' +
        '<path d="M82,138 L77,147 M82,138 L87,147 M118,138 L113,147 M118,138 L123,147" stroke="#b8891a" stroke-width="1.6" fill="none"/>' +
        '<path d="M75,147 H89 Q82,156 75,147 Z M111,147 H125 Q118,156 111,147 Z" fill="#f2c94c" stroke="#b8891a" stroke-width="1.4"/>'; }),
    // Formvännen
    themed("geometri", 0, "hat", "geo-hatt", "Triangelhatt", 30, "60 -10 80 72", function () {
      return '<polygon points="100,4 70,58 130,58" fill="#2ec4b6"/><path d="M92,24 L110,20 M85,38 L116,32 M78,50 L122,44" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/><ellipse cx="100" cy="58" rx="31" ry="4.5" fill="#1b9e92"/><circle cx="100" cy="5" r="7" fill="#ffd54a"/>'; }),
    themed("geometri", 1, "face", "geo-glas", "Fyrkantsglasögon", 40, "60 62 80 40", function () {
      return '<g stroke="#e0861f" stroke-width="3.6" fill="rgba(255,255,255,.3)"><rect x="70" y="70" width="26" height="24" rx="4"/><rect x="104" y="70" width="26" height="24" rx="4"/></g><path d="M96,80 H104 M70,76 L62,73 M130,76 L138,73" stroke="#e0861f" stroke-width="3.2" stroke-linecap="round" fill="none"/>'; }),
    themed("geometri", 2, "neck", "geo-hals", "Vinkelhalsband", 50, "60 108 80 62", function () {
      let ticks = "";
      for (let a = 0; a <= 180; a += 20) { const rad = (a - 180) * Math.PI / 180; ticks += '<path d="M' + (100 + 15 * Math.cos(rad)).toFixed(1) + ',' + (156 + 15 * Math.sin(rad)).toFixed(1) + ' L' + (100 + 20 * Math.cos(rad)).toFixed(1) + ',' + (156 + 20 * Math.sin(rad)).toFixed(1) + '" stroke="#1f5fa6" stroke-width="1.6"/>'; }
      return '<path d="M66,120 Q100,146 134,120" fill="none" stroke="#9aa4b8" stroke-width="2"/><path d="M78,156 A22,22 0 0 1 122,156 Z" fill="rgba(120,200,255,.6)" stroke="#2f7fd1" stroke-width="2.6" stroke-linejoin="round"/>' + ticks + '<circle cx="100" cy="156" r="2.4" fill="#1f5fa6"/>'; }),
    // Tidsvännen
    themed("matning", 0, "hat", "mat-hatt", "Klockhatt", 30, "44 8 112 62", function () {
      return '<path d="M60,58 Q62,14 100,14 Q138,14 140,58 Z" fill="#43b581"/><rect x="57" y="50" width="86" height="12" rx="6" fill="#2f8f64"/><circle cx="100" cy="35" r="15" fill="#fff" stroke="#2f8f64" stroke-width="3"/>' +
        '<path d="M100,35 V26 M100,35 L107,39" stroke="#2a2630" stroke-width="2.8" stroke-linecap="round"/><circle cx="100" cy="22" r="1.4" fill="#2a2630"/><circle cx="100" cy="48" r="1.4" fill="#2a2630"/><circle cx="86" cy="35" r="1.4" fill="#2a2630"/><circle cx="114" cy="35" r="1.4" fill="#2a2630"/>'; }),
    themed("matning", 1, "face", "mat-glas", "Klockglasögon", 40, "60 62 80 40", function () {
      return '<g stroke="#2a2630" stroke-width="3" fill="#fff"><circle cx="84" cy="82" r="13"/><circle cx="116" cy="82" r="13"/></g><path d="M97,82 H103 M71,80 L62,76 M129,80 L138,76" stroke="#2a2630" stroke-width="3" stroke-linecap="round" fill="none"/>' +
        '<path d="M84,82 V73 M84,82 L91,86 M116,82 V73 M116,82 L110,89" stroke="#e0506d" stroke-width="2.8" stroke-linecap="round"/>'; }),
    themed("matning", 2, "neck", "mat-hals", "Måttband", 50, "52 108 96 76", function () {
      let ticks = "";
      for (let i = 1; i < 10; i++) {
        const p = curvePoint([60, 122], [100, 148], [140, 122], i / 10);
        ticks += '<path d="M' + p[0].toFixed(1) + ',' + (p[1] + 1).toFixed(1) + ' V' + (p[1] + (i % 5 === 0 ? 10 : 6)).toFixed(1) + '" stroke="#2a2630" stroke-width="1.6"/>';
      }
      return '<path d="M60,122 Q100,148 140,122 L140,138 Q100,164 60,138 Z" fill="#f6d34a"/><path d="M118,142 L136,178 L120,182 L108,150 Z" fill="#f6d34a"/>' + ticks +
        '<path d="M114,160 L122,156 M118,168 L126,164 M122,176 L128,173" stroke="#2a2630" stroke-width="1.6"/>'; }),
    // Slumpvännen
    themed("data", 0, "hat", "data-hatt", "Tärningshatt", 30, "66 4 68 64", function () {
      return '<g transform="rotate(-10 100 36)"><rect x="79" y="16" width="42" height="42" rx="9" fill="#fff" stroke="#c9d3e6" stroke-width="2.5"/>' +
        '<g fill="#2a2630"><circle cx="89" cy="26" r="3.8"/><circle cx="111" cy="26" r="3.8"/><circle cx="100" cy="37" r="3.8" fill="#e0506d"/><circle cx="89" cy="48" r="3.8"/><circle cx="111" cy="48" r="3.8"/></g></g>'; }),
    themed("data", 1, "face", "data-glas", "Diagramglasögon", 40, "60 62 80 40", function () {
      const bars = function (cx) { return '<rect x="' + (cx - 8) + '" y="83" width="5" height="7" fill="#e0506d"/><rect x="' + (cx - 2) + '" y="76" width="5" height="14" fill="#4c9be8"/><rect x="' + (cx + 4) + '" y="80" width="5" height="10" fill="#43b581"/>'; };
      return '<g stroke="#2a2630" stroke-width="3" fill="#fff"><circle cx="84" cy="82" r="13"/><circle cx="116" cy="82" r="13"/></g><path d="M97,82 H103 M71,80 L62,76 M129,80 L138,76" stroke="#2a2630" stroke-width="3" stroke-linecap="round" fill="none"/>' + bars(84) + bars(116); }),
    themed("data", 2, "neck", "data-hals", "Cirkeldiagram", 50, "60 108 80 62", function () {
      return '<path d="M66,120 Q100,146 134,120" fill="none" stroke="#9aa4b8" stroke-width="2"/><circle cx="100" cy="150" r="15" fill="#fff" stroke="#fff" stroke-width="2"/>' +
        wedge(100, 150, 14, 0, 140, "#e0506d") + wedge(100, 150, 14, 140, 250, "#4c9be8") + wedge(100, 150, 14, 250, 360, "#f2c94c") + '<circle cx="100" cy="150" r="15" fill="none" stroke="#6b7893" stroke-width="2"/>'; })
  ];
  THEMED.forEach(function (it) { ITEMS.push(it); });

  // ===== pieces that are unlocked by badges ("märken", see rewards.js) =====
  // badges: the ids of the badges that all have to be earned. The piece is bought with coins as the others, once it is unlocked.
  function earned(badges, slot, id, name, price, view, art) {
    return { id: id, slot: slot, name: name, price: price, view: view, art: art, badges: [].concat(badges) };
  }

  const EARNED = [
    earned("forsta", "hat", "markt-planta", "Liten planta", 15, "70 10 60 54", function () {
      return '<ellipse cx="100" cy="57" rx="13" ry="4.5" fill="#8a5a3a"/><path d="M100,56 Q97,42 100,28" stroke="#3a9e6a" stroke-width="4" fill="none" stroke-linecap="round"/>' +
        '<path d="M100,42 Q82,38 78,24 Q97,24 100,42 Z" fill="#43b581"/><path d="M100,36 Q118,32 122,18 Q103,18 100,36 Z" fill="#5fd39a"/>'; }),
    earned("fem", "hat", "markt-stjarnkrona", "Stjärnkrona", 30, "50 4 100 54", function () {
      return '<path d="M64,58 Q100,40 136,58 L134,46 Q100,30 66,46 Z" fill="#f2c94c" stroke="#d9a520" stroke-width="2" stroke-linejoin="round"/>' +
        star(78, 30, 9, "#fff3b8", "#d9a520") + star(100, 17, 12, "#fff3b8", "#d9a520") + star(122, 30, 9, "#fff3b8", "#d9a520"); }),
    earned("tio", "neck", "markt-tiomedalj", "Tiomedalj", 25, "66 108 68 70", function () {
      return '<path d="M78,118 L100,150 M122,118 L100,150" stroke="#4c9be8" stroke-width="7" stroke-linecap="round"/><circle cx="100" cy="155" r="16" fill="#c9803f" stroke="#9c5f26" stroke-width="3"/>' +
        '<circle cx="100" cy="155" r="11" fill="none" stroke="#e8b27a" stroke-width="1.5"/><text x="100" y="161" text-anchor="middle" font-size="15" font-weight="800" font-family="Nunito, Arial, sans-serif" fill="#fff">10</text>'; }),
    earned("tjugo", "hat", "markt-lager", "Lagerkrans", 40, "46 8 108 56", function () {
      let leaves = "";
      for (let i = 0; i <= 7; i++) {
        const t = i / 7, l = curvePoint([62, 58], [56, 22], [100, 16], t), r = curvePoint([138, 58], [144, 22], [100, 16], t);
        leaves += '<ellipse cx="' + l[0].toFixed(1) + '" cy="' + l[1].toFixed(1) + '" rx="8" ry="4.5" fill="' + (i % 2 ? "#43a05a" : "#5fb36a") + '" transform="rotate(' + (-70 + i * 12) + ' ' + l[0].toFixed(1) + ' ' + l[1].toFixed(1) + ')"/>' +
          '<ellipse cx="' + r[0].toFixed(1) + '" cy="' + r[1].toFixed(1) + '" rx="8" ry="4.5" fill="' + (i % 2 ? "#43a05a" : "#5fb36a") + '" transform="rotate(' + (70 - i * 12) + ' ' + r[0].toFixed(1) + ' ' + r[1].toFixed(1) + ')"/>';
      }
      return leaves + '<circle cx="100" cy="17" r="5" fill="#f2c94c" stroke="#d9a520" stroke-width="2"/>'; }),
    earned("direkt", "face", "markt-sikte", "Siktesglasögon", 25, "56 62 88 44", function () {
      const lens = function (cx) { return '<circle cx="' + cx + '" cy="82" r="14" fill="rgba(255,255,255,.4)" stroke="#2a2630" stroke-width="3"/><path d="M' + cx + ',69 V95 M' + (cx - 13) + ',82 H' + (cx + 13) + '" stroke="#e0506d" stroke-width="2" stroke-linecap="round"/><circle cx="' + cx + '" cy="82" r="3" fill="#e0506d"/>'; };
      return lens(84) + lens(116) + '<path d="M98,82 H102 M70,80 L62,76 M130,80 L138,76" stroke="#2a2630" stroke-width="3" stroke-linecap="round" fill="none"/>'; }),
    earned("ge-inte-upp", "face", "markt-pannband", "Kämpapannband", 20, "50 44 106 44", function () {
      return '<path d="M56,62 Q100,48 144,62 L144,73 Q100,59 56,73 Z" fill="#e0506d" stroke="#b83c56" stroke-width="2" stroke-linejoin="round"/><circle cx="100" cy="62" r="8" fill="#fff"/><circle cx="100" cy="62" r="4.5" fill="#e0506d"/>' +
        '<path d="M144,66 L158,76 M144,70 L156,86" stroke="#b83c56" stroke-width="5" stroke-linecap="round"/>'; }),
    earned("pysslare", "hat", "markt-pyssel", "Pysslarhatt", 25, "46 0 108 72", function () {
      return '<path d="M70,56 L100,4 L130,56 Z" fill="#8a5cd1"/><ellipse cx="100" cy="56" rx="38" ry="8" fill="#6e45b8"/><circle cx="100" cy="5" r="5" fill="#ffe27a"/>' +
        star(92, 32, 6, "#ffe27a") + star(110, 42, 5, "#ffe27a") + star(104, 20, 4, "#fff3b8"); }),
    earned("begrepp", "neck", "markt-bok", "Ordboken", 20, "62 108 76 68", function () {
      return '<path d="M72,118 Q100,148 128,118" fill="none" stroke="#9aa4b8" stroke-width="2.5"/><rect x="84" y="144" width="32" height="27" rx="3" fill="#e0506d" stroke="#b83c56" stroke-width="2"/>' +
        '<path d="M88,147 V168" stroke="#fff" stroke-width="2" opacity=".7"/><text x="102" y="164" text-anchor="middle" font-size="13" font-weight="800" font-family="Nunito, Arial, sans-serif" fill="#fff">Aa</text>'; }),
    earned("uppdrag", "neck", "markt-uppdrag", "Uppdragsbricka", 20, "66 108 68 74", function () {
      return '<path d="M78,118 L100,150 M122,118 L100,150" stroke="#43b581" stroke-width="7" stroke-linecap="round"/><rect x="84" y="146" width="32" height="30" rx="7" fill="#fff" stroke="#2f8f64" stroke-width="3"/>' +
        '<path d="M92,162 L98,168 L110,154" fill="none" stroke="#2f8f64" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'; }),
    earned("ovare", "wall", "markt-gympa", "Träningshallen", 30, "0 0 200 140", function () {
      let rungs = "";
      for (let y = 22; y < 122; y += 14) rungs += '<path d="M12,' + y + ' H62" stroke="#c28a4d" stroke-width="4" stroke-linecap="round"/>';
      return '<rect width="200" height="140" fill="#f7ead2"/><rect x="12" y="8" width="6" height="118" fill="#c28a4d"/><rect x="56" y="8" width="6" height="118" fill="#c28a4d"/>' + rungs +
        '<rect x="126" y="14" width="46" height="32" rx="3" fill="#fff" stroke="#c28a4d" stroke-width="3"/><rect x="140" y="26" width="18" height="12" fill="none" stroke="#e8544a" stroke-width="2"/><ellipse cx="149" cy="50" rx="11" ry="3.5" fill="none" stroke="#e8544a" stroke-width="3"/>' +
        '<circle cx="100" cy="124" r="12" fill="#e8544a"/><path d="M88,124 H112 M100,112 Q92,124 100,136 M100,112 Q108,124 100,136" fill="none" stroke="#b83c2f" stroke-width="1.6"/>'; }),
    earned("tabell", "wall", "markt-tabell", "Tabellrummet", 30, "0 0 200 140", function () {
      let grid = "";
      for (let r = 1; r <= 4; r++) for (let c = 1; c <= 4; c++) grid += '<text x="' + (38 + (c - 1) * 40) + '" y="' + (38 + (r - 1) * 22) + '" text-anchor="middle" font-size="15" font-weight="800" font-family="Nunito, Arial, sans-serif" fill="#f4f1e8" opacity=".9">' + (r * c) + '</text>';
      return '<rect width="200" height="140" fill="#f4e6c8"/><rect x="12" y="10" width="176" height="112" rx="6" fill="#2f6b57" stroke="#a9773e" stroke-width="6"/>' +
        '<path d="M58,20 V112 M98,20 V112 M138,20 V112 M24,46 H176 M24,68 H176 M24,90 H176" stroke="#f4f1e8" stroke-width="1.5" opacity=".35"/>' + grid + '<rect x="60" y="124" width="80" height="5" rx="2" fill="#a9773e"/>'; }),
    // all the area badges: the rainbow
    earned(["tal", "form", "mat", "samband", "data"], "wall", "markt-regnbage", "Regnbågen", 50, "0 0 200 140", function () {
      let arcs = "";
      ["#e0506d", "#ff9f43", "#ffd54a", "#43b581", "#4c9be8", "#8a5cd1"].forEach(function (c, i) { const r = 84 - i * 9; arcs += '<path d="M' + (100 - r) + ',112 A' + r + ',' + r + ' 0 0 1 ' + (100 + r) + ',112" fill="none" stroke="' + c + '" stroke-width="9"/>'; });
      return '<rect width="200" height="140" fill="#d3ecfb"/>' + arcs + '<ellipse cx="30" cy="114" rx="28" ry="11" fill="#fff"/><ellipse cx="170" cy="114" rx="28" ry="11" fill="#fff"/><ellipse cx="100" cy="152" rx="150" ry="42" fill="#7cc576"/>'; })
  ];
  EARNED.forEach(function (it) { if (it.slot === "wall") it.room = true; ITEMS.push(it); });


  // ===== the pet's room: wallpaper, rug, bed, window, shelf, lamp, plant and toy =====
  // Drawn in the same 200 x 200 box. The wall is the top 140, the floor the rest, and the pet stands in the middle.
  const ROOM_SLOTS = [["wall", "Vägg"], ["rug", "Matta"], ["bed", "Bädd"], ["window", "Fönster"], ["shelf", "Hylla"], ["lamp", "Lampa"], ["plant", "Växt"], ["toy", "Leksak"]];
  const ROOM_SLOT_IDS = ROOM_SLOTS.map(function (s) { return s[0]; });
  const WALL_DEFAULT = '<rect width="200" height="140" fill="#fdf1d6"/>';
  const FLOOR = '<rect y="140" width="200" height="60" fill="#d9b779"/><rect y="138" width="200" height="5" fill="#c29a55"/>' +
    '<path d="M0,156 H200 M0,172 H200 M0,188 H200 M44,140 V156 M120,156 V172 M70,172 V188 M160,172 V188 M20,188 V200" stroke="#c8a463" stroke-width="1.4"/>';

  function ri(id, slot, name, price, view, art) { return { id: id, slot: slot, name: name, price: price, view: view, art: art, room: true }; }

  const ROOM_ITEMS = [
    ri("rum-vagg-rand", "wall", "Randig vägg", 20, "0 0 200 140", function () {
      let s = WALL_DEFAULT;
      for (let x = 0; x < 200; x += 28) s += '<rect x="' + x + '" width="14" height="140" fill="#f5dca0"/>';
      return s; }),
    ri("rum-vagg-stjarnor", "wall", "Stjärnvägg", 30, "0 0 200 140", function () {
      let s = '<rect width="200" height="140" fill="#2b3a6b"/>';
      [[24, 22, 6], [70, 60, 5], [120, 18, 7], [168, 44, 5], [40, 104, 5], [150, 100, 6], [100, 76, 4], [184, 112, 4]].forEach(function (p) { s += star(p[0], p[1], p[2], "#ffe27a"); });
      return s; }),
    ri("rum-vagg-hav", "wall", "Havsvägg", 30, "0 0 200 140", function () {
      return '<rect width="200" height="140" fill="#bfe6f7"/><path d="M0,40 Q25,30 50,40 T100,40 T150,40 T200,40 V70 H0 Z" fill="#9fd6f0"/><path d="M0,86 Q25,76 50,86 T100,86 T150,86 T200,86 V140 H0 Z" fill="#7cc4e8"/>' +
        '<circle cx="30" cy="110" r="5" fill="#fff" opacity=".6"/><circle cx="48" cy="96" r="3" fill="#fff" opacity=".6"/><circle cx="160" cy="116" r="6" fill="#fff" opacity=".6"/><circle cx="176" cy="100" r="3" fill="#fff" opacity=".6"/>'; }),
    ri("rum-vagg-siffror", "wall", "Sifferväggen", 35, "0 0 200 140", function () {
      let s = '<rect width="200" height="140" fill="#e9f0fb"/>';
      [["1", 20, 30], ["+", 66, 22], ["2", 112, 34], ["=", 156, 24], ["3", 184, 60], ["7", 30, 82], ["−", 78, 100], ["5", 140, 96], ["9", 100, 64]].forEach(function (t) {
        s += '<text x="' + t[1] + '" y="' + t[2] + '" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="22" fill="#b9cbf0" text-anchor="middle">' + t[0] + '</text>'; });
      return s; }),
    ri("rum-matta-rod", "rug", "Röd matta", 15, "20 150 160 50", function () {
      return '<ellipse cx="100" cy="176" rx="76" ry="16" fill="#e0506d"/><ellipse cx="100" cy="176" rx="60" ry="11" fill="#f08aa0"/>'; }),
    ri("rum-matta-bla", "rug", "Blå matta", 15, "20 150 160 50", function () {
      return '<ellipse cx="100" cy="176" rx="76" ry="16" fill="#3f86d4"/><ellipse cx="100" cy="176" rx="60" ry="11" fill="#8cc2f5"/><ellipse cx="100" cy="176" rx="40" ry="7" fill="#3f86d4" opacity=".5"/>'; }),
    ri("rum-matta-stjarna", "rug", "Stjärnmatta", 30, "20 150 160 50", function () {
      return '<ellipse cx="100" cy="176" rx="76" ry="16" fill="#7a56c7"/><ellipse cx="100" cy="176" rx="62" ry="12" fill="#9b7fe0"/>' + star(100, 176, 11, "#ffd54a") + star(54, 177, 5, "#ffd54a") + star(146, 177, 5, "#ffd54a"); }),
    ri("rum-kudde", "bed", "Kudde", 20, "0 150 76 40", function () {
      return '<ellipse cx="38" cy="172" rx="31" ry="11" fill="#f08aa0"/><ellipse cx="38" cy="168" rx="26" ry="7" fill="#f7b3c2"/>'; }),
    ri("rum-korg", "bed", "Korg", 30, "0 148 78 40", function () {
      return '<path d="M8,160 Q8,179 22,179 H54 Q68,179 68,160 Z" fill="#c98a4b"/><path d="M12,166 H64 M14,172 H62" stroke="#a9702f" stroke-width="1.6"/><ellipse cx="38" cy="160" rx="30" ry="6" fill="#b8763a"/><ellipse cx="38" cy="160" rx="25" ry="4.2" fill="#f6d7a8"/>'; }),
    ri("rum-saeng", "bed", "Säng", 50, "0 130 78 56", function () {
      return '<rect x="3" y="136" width="9" height="42" rx="3" fill="#9a6030"/><rect x="5" y="152" width="66" height="22" rx="4" fill="#b8763a"/><rect x="12" y="146" width="56" height="14" rx="5" fill="#9ec5ff"/>' +
        '<rect x="28" y="144" width="40" height="16" rx="5" fill="#4c9be8"/><ellipse cx="21" cy="146" rx="9" ry="6" fill="#fff"/><rect x="8" y="174" width="6" height="5" fill="#9a6030"/><rect x="62" y="174" width="6" height="5" fill="#9a6030"/>'; }),
    ri("rum-fonster", "window", "Fönster", 25, "4 12 64 68", function () {
      return '<rect x="10" y="18" width="52" height="56" rx="4" fill="#fff"/><rect x="15" y="23" width="42" height="46" rx="2" fill="#8fd0f2"/><circle cx="47" cy="34" r="6" fill="#ffe27a"/><ellipse cx="26" cy="56" rx="9" ry="4" fill="#fff" opacity=".85"/><path d="M36,23 V69 M15,46 H57" stroke="#fff" stroke-width="3"/>'; }),
    ri("rum-fonster-natt", "window", "Nattfönster", 35, "4 12 64 68", function () {
      return '<rect x="10" y="18" width="52" height="56" rx="4" fill="#fff"/><rect x="15" y="23" width="42" height="46" rx="2" fill="#26305e"/><circle cx="46" cy="34" r="6" fill="#fff3b8"/><circle cx="49" cy="32" r="5" fill="#26305e"/>' + star(24, 34, 3, "#ffe27a") + star(28, 58, 3, "#ffe27a") + star(48, 58, 2.5, "#ffe27a") + '<path d="M36,23 V69 M15,46 H57" stroke="#fff" stroke-width="3"/>'; }),
    ri("rum-fonster-rund", "window", "Rundfönster", 30, "4 12 64 68", function () {
      return '<circle cx="36" cy="46" r="28" fill="#fff"/><circle cx="36" cy="46" r="23" fill="#8fd0f2"/><circle cx="46" cy="38" r="5" fill="#ffe27a"/><ellipse cx="26" cy="56" rx="8" ry="3.5" fill="#fff" opacity=".85"/><path d="M36,23 V69 M13,46 H59" stroke="#fff" stroke-width="3"/>'; }),
    ri("rum-hylla", "shelf", "Bokhylla", 35, "130 22 70 48", function () {
      let s = '<rect x="136" y="58" width="60" height="6" rx="2" fill="#a9773e"/><path d="M142,64 V72 M190,64 V72" stroke="#8a5f2e" stroke-width="3"/>';
      [["#e0506d", 142, 36, 9], ["#4c9be8", 152, 40, 9], ["#43b581", 162, 32, 9], ["#f2c94c", 172, 38, 9], ["#8a5cd1", 182, 34, 9]].forEach(function (b) { s += '<rect x="' + b[1] + '" y="' + (58 - b[2]) + '" width="' + b[3] + '" height="' + b[2] + '" rx="1.5" fill="' + b[0] + '"/>'; });
      return s; }),
    ri("rum-hylla-matte", "shelf", "Mattehylla", 45, "130 22 70 48", function () {
      let s = '<rect x="136" y="58" width="60" height="6" rx="2" fill="#a9773e"/><path d="M142,64 V72 M190,64 V72" stroke="#8a5f2e" stroke-width="3"/>';
      [["#4c9be8", 139, 36, 11, "+"], ["#e0506d", 151, 40, 11, "−"], ["#43b581", 163, 34, 11, "="], ["#8a5cd1", 175, 38, 11, "π"]].forEach(function (b) {
        s += '<rect x="' + b[1] + '" y="' + (58 - b[2]) + '" width="' + b[3] + '" height="' + b[2] + '" rx="1.5" fill="' + b[0] + '"/><text x="' + (b[1] + 6) + '" y="' + (58 - b[2] / 2 + 4) + '" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="11" fill="#fff" text-anchor="middle">' + b[4] + '</text>'; });
      return s + '<rect x="187" y="46" width="9" height="12" rx="2" fill="#f6d34a"/><path d="M189,46 L188,38 M192,46 V37 M195,46 L196,39" stroke="#e0506d" stroke-width="2" stroke-linecap="round"/>'; }),
    ri("rum-lampa", "lamp", "Golvlampa", 25, "164 56 36 128", function () {
      return '<ellipse cx="185" cy="176" rx="11" ry="3.5" fill="#6f5f50"/><rect x="183.5" y="84" width="3" height="92" fill="#8a7a6a"/><ellipse cx="185" cy="90" rx="22" ry="9" fill="#fff6c9" opacity=".4"/><polygon points="173,66 197,66 192,88 178,88" fill="#f6d34a"/><polygon points="173,66 197,66 195,72 175,72" fill="#e3b030"/>'; }),
    ri("rum-lampa-stjarna", "lamp", "Stjärnlampa", 35, "164 56 36 128", function () {
      return '<ellipse cx="185" cy="176" rx="11" ry="3.5" fill="#6f5f50"/><rect x="183.5" y="84" width="3" height="92" fill="#8a7a6a"/><circle cx="185" cy="76" r="19" fill="#fff6c9" opacity=".4"/>' + star(185, 76, 14, "#ffd54a", "#e0a020"); }),
    ri("rum-vaxt", "plant", "Krukväxt", 15, "144 128 36 54", function () {
      return '<ellipse cx="156" cy="146" rx="5" ry="12" fill="#43b581" transform="rotate(-24 156 156)"/><ellipse cx="166" cy="144" rx="5" ry="13" fill="#2f9d6c" transform="rotate(20 166 156)"/><ellipse cx="161" cy="143" rx="4.5" ry="12" fill="#58c796"/><polygon points="150,156 172,156 169,178 153,178" fill="#d9784a"/><rect x="149" y="154" width="24" height="5" rx="2" fill="#c9683c"/>'; }),
    ri("rum-kaktus", "plant", "Kaktus", 20, "144 128 36 54", function () {
      return '<rect x="156" y="134" width="10" height="26" rx="5" fill="#4aa86b"/><path d="M156,148 H151 V142" stroke="#4aa86b" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M166,144 H171 V138" stroke="#4aa86b" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="161" cy="130" r="3" fill="#ff8fb0"/>' +
        '<polygon points="150,156 172,156 169,178 153,178" fill="#c98a4b"/><rect x="149" y="154" width="24" height="5" rx="2" fill="#b8763a"/>'; }),
    ri("rum-blommor", "plant", "Blommor", 20, "144 128 36 54", function () {
      return '<path d="M156,156 Q154,142 152,134 M162,156 V130 M168,156 Q170,142 172,136" stroke="#43b581" stroke-width="2.4" fill="none"/><circle cx="152" cy="132" r="5" fill="#ff8fb0"/><circle cx="162" cy="128" r="5.5" fill="#ffd54a"/><circle cx="172" cy="134" r="5" fill="#e0506d"/>' +
        '<polygon points="150,156 172,156 169,178 153,178" fill="#4c9be8"/><rect x="149" y="154" width="24" height="5" rx="2" fill="#3f86d4"/>'; }),
    ri("rum-boll", "toy", "Boll", 15, "118 156 30 30", function () {
      return '<ellipse cx="132" cy="178" rx="9" ry="2.6" fill="#000" opacity=".12"/><circle cx="132" cy="169" r="9" fill="#e0506d"/><path d="M124,166 Q132,172 140,166" stroke="#fff" stroke-width="2.4" fill="none"/>'; }),
    ri("rum-klossar", "toy", "Klossar", 25, "112 144 42 40", function () {
      const t = function (x, y, c, l) { return '<rect x="' + x + '" y="' + y + '" width="14" height="14" rx="2" fill="' + c + '"/><text x="' + (x + 7) + '" y="' + (y + 11) + '" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="10" fill="#fff" text-anchor="middle">' + l + '</text>'; };
      return t(118, 164, "#4c9be8", "A") + t(132, 164, "#f2c94c", "1") + t(125, 150, "#e0506d", "B"); }),
    ri("rum-tarning", "toy", "Stor tärning", 30, "116 146 36 36", function () {
      return '<rect x="122" y="152" width="24" height="24" rx="6" fill="#fff" stroke="#c9d3e6" stroke-width="2"/><g fill="#2a2630"><circle cx="129" cy="159" r="2.4"/><circle cx="139" cy="159" r="2.4"/><circle cx="134" cy="164" r="2.4" fill="#e0506d"/><circle cx="129" cy="170" r="2.4"/><circle cx="139" cy="170" r="2.4"/></g>'; }),
    ri("rum-vagg-prickar", "wall", "Prickvägg", 25, "0 0 200 140", function () {
      let s = '<rect width="200" height="140" fill="#ffe9ef"/>';
      for (let y = 14; y < 140; y += 28) for (let x = (y / 28) % 2 ? 14 : 28; x < 200; x += 28) s += '<circle cx="' + x + '" cy="' + y + '" r="6" fill="#ffc6d6"/>';
      return s; }),
    ri("rum-vagg-tegel", "wall", "Tegelvägg", 30, "0 0 200 140", function () {
      let s = '<rect width="200" height="140" fill="#d98b6a"/>';
      for (let y = 0; y < 140; y += 14) { s += '<path d="M0,' + y + ' H200" stroke="#b9694a" stroke-width="2"/>'; for (let x = (y / 14) % 2 ? 0 : 20; x < 200; x += 40) s += '<path d="M' + x + ',' + y + ' V' + (y + 14) + '" stroke="#b9694a" stroke-width="2"/>'; }
      return s; }),
    ri("rum-matta-regnbage", "rug", "Regnbågsmatta", 35, "20 150 160 50", function () {
      return '<ellipse cx="100" cy="176" rx="76" ry="16" fill="#e8394d"/><ellipse cx="100" cy="176" rx="64" ry="13.5" fill="#f59a3a"/><ellipse cx="100" cy="176" rx="52" ry="11" fill="#f6d34a"/><ellipse cx="100" cy="176" rx="40" ry="8.5" fill="#5bbf6e"/><ellipse cx="100" cy="176" rx="28" ry="6" fill="#4c9be8"/>'; }),
    ri("rum-kuddhog", "bed", "Kuddhög", 35, "0 140 80 46", function () {
      return '<ellipse cx="40" cy="176" rx="34" ry="9" fill="#9b7fe0"/><ellipse cx="30" cy="166" rx="24" ry="8" fill="#f08aa0"/><ellipse cx="50" cy="162" rx="22" ry="8" fill="#8cc2f5"/><ellipse cx="38" cy="154" rx="18" ry="7" fill="#ffd54a"/>'; }),
    ri("rum-fonster-gardin", "window", "Fönster med gardin", 35, "0 12 72 68", function () {
      return '<rect x="10" y="18" width="52" height="56" rx="4" fill="#fff"/><rect x="15" y="23" width="42" height="46" rx="2" fill="#8fd0f2"/><path d="M6,16 H30 Q24,44 26,76 H6 Z M66,16 H42 Q48,44 46,76 H66 Z" fill="#f08aa0"/><path d="M6,16 H66" stroke="#b8763a" stroke-width="3"/>'; }),
    ri("rum-hylla-pokal", "shelf", "Pokalhylla", 40, "130 22 70 48", function () {
      return '<rect x="136" y="58" width="60" height="6" rx="2" fill="#a9773e"/><path d="M142,64 V72 M190,64 V72" stroke="#8a5f2e" stroke-width="3"/>' +
        '<path d="M148,32 H168 Q168,46 158,48 Q148,46 148,32 Z" fill="#f2c94c" stroke="#d9a520" stroke-width="2"/><path d="M148,34 Q140,34 142,40 Q144,44 150,42 M168,34 Q176,34 174,40 Q172,44 166,42" fill="none" stroke="#d9a520" stroke-width="2"/><rect x="155" y="48" width="6" height="6" fill="#d9a520"/><rect x="150" y="54" width="16" height="4" rx="1.5" fill="#b8891a"/>' +
        star(158, 40, 4, "#fff6c9") + '<circle cx="184" cy="48" r="8" fill="#f2c94c" stroke="#d9a520" stroke-width="2"/><path d="M180,40 L184,50 L188,40" stroke="#e0506d" stroke-width="3" fill="none"/>'; }),
    ri("rum-lampa-lava", "lamp", "Lavalampa", 30, "164 110 36 78", function () {
      return '<ellipse cx="184" cy="178" rx="12" ry="3.4" fill="#6f5f50"/><path d="M176,176 L178,130 H190 L192,176 Z" fill="#ff8fb0" opacity=".85"/><path d="M178,130 L180,122 H188 L190,130 Z" fill="#6f5f50"/><rect x="176" y="174" width="16" height="5" rx="2" fill="#6f5f50"/>' +
        '<circle cx="184" cy="160" r="5" fill="#ffd54a"/><circle cx="183" cy="146" r="3.6" fill="#ffd54a"/><circle cx="186" cy="136" r="2.6" fill="#fff3b8"/>'; }),
    ri("rum-palm", "plant", "Palm", 30, "136 100 52 84", function () {
      return '<path d="M160,176 Q156,150 162,126" fill="none" stroke="#9a6030" stroke-width="6" stroke-linecap="round"/>' +
        '<path d="M162,126 Q144,114 136,124 M162,126 Q150,106 142,108 M162,126 Q166,104 160,98 M162,126 Q178,106 186,108 M162,126 Q180,114 188,124" fill="none" stroke="#2f9d6c" stroke-width="5" stroke-linecap="round"/>' +
        '<polygon points="150,166 174,166 171,184 153,184" fill="#c98a4b"/><rect x="148" y="164" width="28" height="5" rx="2" fill="#b8763a"/>'; }),
    ri("rum-nalle", "toy", "Nalle", 30, "112 144 42 42", function () {
      return '<ellipse cx="132" cy="182" rx="12" ry="3" fill="#000" opacity=".12"/><circle cx="125" cy="168" r="4" fill="#a9733b"/><circle cx="139" cy="168" r="4" fill="#a9733b"/><ellipse cx="132" cy="174" rx="10" ry="9" fill="#c58a4a"/><circle cx="132" cy="160" r="8.5" fill="#c58a4a"/>' +
        '<circle cx="125.5" cy="153.5" r="3.4" fill="#a9733b"/><circle cx="138.5" cy="153.5" r="3.4" fill="#a9733b"/><ellipse cx="132" cy="163" rx="4" ry="3" fill="#f2d3a8"/><circle cx="132" cy="162" r="1.4" fill="#2a2630"/><circle cx="129" cy="158" r="1.2" fill="#2a2630"/><circle cx="135" cy="158" r="1.2" fill="#2a2630"/>' +
        '<path d="M126,172 L128,178 M138,172 L136,178" stroke="#a9733b" stroke-width="3" stroke-linecap="round"/>'; }),
    ri("rum-raket", "toy", "Leksaksraket", 35, "112 140 42 46", function () {
      return '<ellipse cx="132" cy="184" rx="11" ry="2.8" fill="#000" opacity=".12"/><path d="M132,144 Q142,156 140,176 H124 Q122,156 132,144 Z" fill="#fff" stroke="#c9d3e6" stroke-width="2"/><circle cx="132" cy="160" r="4.5" fill="#8fd0f2" stroke="#4c9be8" stroke-width="2"/>' +
        '<path d="M124,170 L116,182 L125,178 Z M140,170 L148,182 L139,178 Z" fill="#e0506d"/><path d="M132,144 Q136,150 138,154 H126 Q128,150 132,144 Z" fill="#e0506d"/><path d="M128,177 Q132,186 136,177 Z" fill="#f6a53a"/>'; }),
    // the backgrounds of before are wallpapers now (a student who had one has the wallpaper: see migrate)
    ri("rum-vagg-gras", "wall", "Äng", 25, "0 0 200 140", function () {
      return '<rect width="200" height="140" fill="#bfe6f7"/><circle cx="160" cy="32" r="15" fill="#ffe27a"/><ellipse cx="100" cy="150" rx="150" ry="46" fill="#7cc576"/><ellipse cx="30" cy="144" rx="70" ry="26" fill="#63b45e"/>' +
        '<circle cx="34" cy="124" r="4" fill="#ff8fb0"/><circle cx="166" cy="126" r="4" fill="#fff"/><circle cx="150" cy="132" r="3.5" fill="#ffd54a"/>'; }),
    ri("rum-vagg-strand", "wall", "Strand", 35, "0 0 200 140", function () {
      return '<rect width="200" height="140" fill="#c6ebfa"/><rect y="62" width="200" height="34" fill="#5bc0e8"/><path d="M0,70 Q25,64 50,70 T100,70 T150,70 T200,70" fill="none" stroke="#9adcf3" stroke-width="3"/><ellipse cx="100" cy="152" rx="150" ry="54" fill="#f3dca4"/><circle cx="36" cy="30" r="15" fill="#ffe27a"/>'; }),
    ri("rum-vagg-sno", "wall", "Snö", 30, "0 0 200 140", function () {
      let s = "";
      [[28, 30], [70, 58], [120, 24], [160, 62], [40, 96], [176, 100], [92, 76]].forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="#fff"/>'; });
      return '<rect width="200" height="140" fill="#d6e8f7"/>' + s + '<ellipse cx="100" cy="152" rx="150" ry="40" fill="#fff"/><ellipse cx="170" cy="144" rx="50" ry="20" fill="#eef5fb"/>'; }),
    ri("rum-vagg-tavla", "wall", "Klassrummet", 40, "0 0 200 140", function () {
      return '<rect width="200" height="140" fill="#f4e6c8"/><rect x="18" y="14" width="164" height="92" rx="6" fill="#2f6b57" stroke="#a9773e" stroke-width="6"/>' +
        '<text x="100" y="66" text-anchor="middle" font-size="26" font-weight="800" font-family="Nunito, Arial, sans-serif" fill="#f4f1e8" opacity=".92">2 + 2 = 4</text><path d="M32,88 H70" stroke="#f4f1e8" stroke-width="2" opacity=".6"/><rect x="60" y="108" width="80" height="5" rx="2" fill="#a9773e"/>'; }),
    ri("rum-vagg-rymd", "wall", "Rymden", 50, "0 0 200 140", function () {
      let s = "";
      [[20, 24], [72, 14], [128, 30], [182, 20], [30, 112], [176, 96], [58, 70], [150, 76]].forEach(function (p, i) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i % 3 ? 1.5 : 2.4) + '" fill="#fff"/>'; });
      return '<rect width="200" height="140" fill="#1d1741"/>' + s + '<circle cx="158" cy="48" r="19" fill="#e0861f"/><ellipse cx="158" cy="48" rx="30" ry="7" fill="none" stroke="#f6c453" stroke-width="3" transform="rotate(-18 158 48)"/><circle cx="36" cy="46" r="9" fill="#76c0ec"/><ellipse cx="100" cy="152" rx="130" ry="30" fill="#3a2f74"/>'; }),
    ri("rum-vagg-skog", "wall", "Skogen", 35, "0 0 200 140", function () {
      let s = '<rect width="200" height="140" fill="#d6ecd2"/><circle cx="164" cy="28" r="13" fill="#fff3b0"/>';
      [[22, 92, 34], [62, 100, 26], [150, 94, 30], [184, 102, 24]].forEach(function (t) {
        s += '<rect x="' + (t[0] - 3) + '" y="' + t[1] + '" width="6" height="26" fill="#8a5f3a"/><polygon points="' + t[0] + ',' + (t[1] - t[2] * 1.4) + ' ' + (t[0] - t[2] / 2) + ',' + (t[1] + 6) + ' ' + (t[0] + t[2] / 2) + ',' + (t[1] + 6) + '" fill="#3f9a62"/>' +
          '<polygon points="' + t[0] + ',' + (t[1] - t[2] * 1.0) + ' ' + (t[0] - t[2] / 2.4) + ',' + (t[1] - 8) + ' ' + (t[0] + t[2] / 2.4) + ',' + (t[1] - 8) + '" fill="#4fae72"/>'; });
      return s + '<ellipse cx="100" cy="150" rx="150" ry="44" fill="#6fae6a"/><circle cx="40" cy="128" r="3.4" fill="#ff8fb0"/><circle cx="168" cy="130" r="3.4" fill="#fff"/>'; }),
    ri("rum-vagg-regnbage", "wall", "Regnbåge", 40, "0 0 200 140", function () {
      let s = '<rect width="200" height="140" fill="#d4ecfb"/>';
      ["#e8394d", "#f59a3a", "#f6d34a", "#5bbf6e", "#4c9be8", "#8a5cd1"].forEach(function (c, i) { const r = 80 - i * 8; s += '<path d="M' + (100 - r) + ',108 A' + r + ',' + r + ' 0 0 1 ' + (100 + r) + ',108" fill="none" stroke="' + c + '" stroke-width="8"/>'; });
      return s + '<ellipse cx="30" cy="110" rx="24" ry="10" fill="#fff"/><ellipse cx="170" cy="110" rx="24" ry="10" fill="#fff"/><ellipse cx="100" cy="148" rx="150" ry="40" fill="#9bd68f"/>'; }),
    ri("rum-vagg-orken", "wall", "Öknen", 35, "0 0 200 140", function () {
      return '<rect width="200" height="140" fill="#fde7b3"/><circle cx="150" cy="36" r="18" fill="#ffd05a"/><ellipse cx="30" cy="138" rx="110" ry="36" fill="#f2c576"/><ellipse cx="170" cy="148" rx="120" ry="40" fill="#e7ae55"/>' +
        '<rect x="30" y="92" width="9" height="32" rx="4.5" fill="#4aa86b"/><path d="M30,108 H24 V100 M39,104 H45 V97" stroke="#4aa86b" stroke-width="5" stroke-linecap="round" fill="none"/>'; }),
    ri("rum-vagg-solnedgang", "wall", "Solnedgång", 40, "0 0 200 140", function () {
      return '<rect width="200" height="50" fill="#ff9aa8"/><rect y="50" width="200" height="30" fill="#ffc58a"/><rect y="80" width="200" height="30" fill="#ffe3a3"/><circle cx="100" cy="108" r="26" fill="#ffd96a"/>' +
        '<path d="M0,110 Q40,92 80,110 Q120,124 160,106 Q184,98 200,108 V140 H0 Z" fill="#4a4f8a"/>'; }),
    // new wallpapers
    ri("rum-vagg-hjartan", "wall", "Hjärtvägg", 25, "0 0 200 140", function () {
      let s = '<rect width="200" height="140" fill="#fde8ee"/>';
      for (let y = 16; y < 140; y += 30) for (let x = (y - 16) / 30 % 2 ? 16 : 36; x < 210; x += 40) s += '<path d="M0,7 C-14,-5 -8,-14 0,-7 C8,-14 14,-5 0,7 Z" transform="translate(' + x + ' ' + y + ')" fill="#f7a8bf"/>';
      return s; }),
    ri("rum-vagg-moln", "wall", "Molnvägg", 25, "0 0 200 140", function () {
      let s = '<rect width="200" height="140" fill="#cfe9fb"/>';
      [[40, 34, 1], [140, 24, 1.1], [92, 82, 1.2], [176, 76, .9], [24, 112, .8]].forEach(function (c) {
        s += '<g transform="translate(' + c[0] + ' ' + c[1] + ') scale(' + c[2] + ')" fill="#fff"><ellipse cx="0" cy="0" rx="22" ry="10"/><ellipse cx="-12" cy="-6" rx="11" ry="9"/><ellipse cx="8" cy="-9" rx="13" ry="11"/></g>'; });
      return s; }),
    ri("rum-vagg-berg", "wall", "Bergsvägg", 35, "0 0 200 140", function () {
      return '<rect width="200" height="140" fill="#cfe3f5"/><circle cx="162" cy="26" r="12" fill="#fff3b0"/><polygon points="0,140 44,56 76,104 108,38 150,112 176,72 200,120 200,140" fill="#8fa7c6"/>' +
        '<polygon points="108,38 98,56 108,52 116,58" fill="#fff"/><polygon points="44,56 36,70 44,66 52,72" fill="#fff"/><polygon points="176,72 169,84 176,80 183,86" fill="#fff"/>'; }),
    ri("rum-vagg-djungel", "wall", "Djungelvägg", 40, "0 0 200 140", function () {
      let s = '<rect width="200" height="140" fill="#cfeccf"/>';
      [[20, 40, -30, "#43a05a"], [44, 70, 24, "#5fb36a"], [90, 30, -12, "#2f8f5a"], [128, 64, 28, "#43a05a"], [166, 36, -26, "#5fb36a"], [184, 84, 18, "#2f8f5a"], [66, 112, -20, "#5fb36a"], [146, 110, 24, "#43a05a"]].forEach(function (l) {
        s += '<ellipse cx="' + l[0] + '" cy="' + l[1] + '" rx="9" ry="27" fill="' + l[3] + '" transform="rotate(' + l[2] + ' ' + l[0] + ' ' + l[1] + ')"/><path d="M' + l[0] + ',' + (l[1] - 22) + ' V' + (l[1] + 22) + '" stroke="#2a7a4a" stroke-width="1.5" transform="rotate(' + l[2] + ' ' + l[0] + ' ' + l[1] + ')"/>'; });
      return s; }),
    ri("rum-matta-gras", "rug", "Gräsmatta", 20, "20 150 160 50", function () {
      return '<ellipse cx="100" cy="176" rx="76" ry="16" fill="#5fb36a"/><ellipse cx="100" cy="176" rx="62" ry="12" fill="#7cc576"/><circle cx="68" cy="177" r="2.6" fill="#fff"/><circle cx="126" cy="174" r="2.6" fill="#ffd54a"/><circle cx="98" cy="180" r="2.6" fill="#ff8fb0"/>'; }),
    ri("rum-matta-hjarta", "rug", "Hjärtmatta", 25, "20 150 160 50", function () {
      return '<ellipse cx="100" cy="176" rx="76" ry="16" fill="#e0506d"/><ellipse cx="100" cy="176" rx="64" ry="12.5" fill="#f08aa0"/><path d="M0,6 C-16,-6 -10,-16 0,-8 C10,-16 16,-6 0,6 Z" transform="translate(100 177)" fill="#fff"/>'; }),
    ri("rum-haengmatta", "bed", "Hängmatta", 40, "0 126 80 60", function () {
      return '<rect x="3" y="128" width="5" height="52" rx="2" fill="#9a6030"/><rect x="72" y="128" width="5" height="52" rx="2" fill="#9a6030"/><ellipse cx="40" cy="182" rx="36" ry="4" fill="#000" opacity=".1"/>' +
        '<path d="M8,138 Q40,178 72,138 Z" fill="#f2a65a"/><path d="M16,146 Q40,170 64,146" fill="none" stroke="#fff" stroke-width="2.4" opacity=".7"/><path d="M8,138 Q40,126 72,138" fill="none" stroke="#c98a4b" stroke-width="2"/>'; }),
    ri("rum-fonster-persienn", "window", "Fönster med persienner", 30, "4 12 64 68", function () {
      let s = '<rect x="10" y="18" width="52" height="56" rx="4" fill="#fff"/><rect x="15" y="23" width="42" height="46" rx="2" fill="#8fd0f2"/>';
      for (let y = 25; y < 52; y += 6) s += '<rect x="15" y="' + y + '" width="42" height="4" rx="1" fill="#f6efe2" stroke="#d6c7a8" stroke-width=".8"/>';
      return s + '<path d="M36,23 V54" stroke="#d6c7a8" stroke-width="1"/><circle cx="36" cy="56" r="2.2" fill="#d6c7a8"/>'; }),
    ri("rum-hylla-vaxter", "shelf", "Växthylla", 30, "130 22 70 48", function () {
      let s = '<rect x="136" y="58" width="60" height="6" rx="2" fill="#a9773e"/><path d="M142,64 V72 M190,64 V72" stroke="#8a5f2e" stroke-width="3"/>';
      [[148, "#d9784a"], [166, "#4c9be8"], [184, "#f2c94c"]].forEach(function (p, i) {
        s += '<polygon points="' + (p[0] - 7) + ',50 ' + (p[0] + 7) + ',50 ' + (p[0] + 5) + ',58 ' + (p[0] - 5) + ',58" fill="' + p[1] + '"/>' +
          '<ellipse cx="' + (p[0] - 3) + '" cy="42" rx="3" ry="8" fill="#43b581" transform="rotate(-20 ' + (p[0] - 3) + ' 48)"/><ellipse cx="' + (p[0] + 3) + '" cy="40" rx="3" ry="9" fill="#2f9d6c" transform="rotate(18 ' + (p[0] + 3) + ' 48)"/>' + (i === 1 ? '<circle cx="' + p[0] + '" cy="34" r="3.4" fill="#ff8fb0"/>' : ''); });
      return s; }),
    ri("rum-lampa-moln", "lamp", "Molnlampa", 30, "164 56 36 128", function () {
      return '<ellipse cx="185" cy="176" rx="11" ry="3.5" fill="#6f5f50"/><rect x="183.5" y="90" width="3" height="86" fill="#8a7a6a"/><circle cx="185" cy="76" r="20" fill="#fff6c9" opacity=".35"/>' +
        '<g fill="#fff" stroke="#dfe9f5" stroke-width="1.4"><ellipse cx="185" cy="80" rx="15" ry="8"/><ellipse cx="178" cy="74" rx="8" ry="7"/><ellipse cx="190" cy="72" rx="9" ry="8"/></g>'; }),
    ri("rum-bonsai", "plant", "Bonsai", 30, "144 128 36 54", function () {
      return '<path d="M161,160 Q154,150 160,142 Q166,136 158,130" fill="none" stroke="#7a4d2a" stroke-width="4" stroke-linecap="round"/><circle cx="155" cy="130" r="9" fill="#43b581"/><circle cx="168" cy="136" r="8" fill="#2f9d6c"/><circle cx="160" cy="124" r="8" fill="#58c796"/>' +
        '<rect x="148" y="160" width="26" height="9" rx="3" fill="#3f86d4"/><rect x="152" y="168" width="18" height="6" fill="#3f86d4"/>'; }),
    ri("rum-solros", "plant", "Solros", 25, "144 124 36 58", function () {
      let petals = "";
      for (let i = 0; i < 10; i++) petals += '<ellipse cx="161" cy="124" rx="3.4" ry="8" fill="#ffd54a" transform="rotate(' + (i * 36) + ' 161 133) translate(0 -1)"/>';
      return '<path d="M161,158 V136" stroke="#43b581" stroke-width="3.5"/><ellipse cx="152" cy="148" rx="3.4" ry="8" fill="#43b581" transform="rotate(-50 152 148)"/>' + petals + '<circle cx="161" cy="133" r="7" fill="#7a4d2a"/>' +
        '<polygon points="150,156 172,156 169,178 153,178" fill="#d9784a"/><rect x="149" y="154" width="24" height="5" rx="2" fill="#c06a3c"/>'; }),
    ri("rum-xylofon", "toy", "Xylofon", 30, "112 148 46 38", function () {
      let s = '<ellipse cx="134" cy="182" rx="14" ry="3" fill="#000" opacity=".12"/><path d="M118,174 L146,158 M118,178 L146,162" stroke="#a9773e" stroke-width="2.4" stroke-linecap="round"/>';
      ["#e0506d", "#f59a3a", "#f6d34a", "#43b581", "#4c9be8", "#8a5cd1"].forEach(function (c, i) { s += '<rect x="' + (118 + i * 5) + '" y="' + (170 - i * 2.6 - (6 - i) * 1.2) + '" width="4.4" height="' + (14 - i * 1.5) + '" rx="1.6" fill="' + c + '" transform="rotate(-24 ' + (120 + i * 5) + ' 172)"/>'; });
      return s; }),
    ri("rum-drake", "toy", "Drake", 30, "116 140 40 46", function () {
      return '<ellipse cx="136" cy="184" rx="10" ry="2.6" fill="#000" opacity=".12"/><path d="M136,148 L150,162 L136,176 L122,162 Z" fill="#f6d34a" stroke="#d9a520" stroke-width="1.6"/><path d="M136,148 V176 M122,162 H150" stroke="#e0506d" stroke-width="2"/>' +
        '<path d="M136,176 Q128,180 132,184 Q140,182 138,186" fill="none" stroke="#8a5cd1" stroke-width="2"/>'; }),
  ];
  ROOM_ITEMS.forEach(function (it) { ITEMS.push(it); });

  // ===== the Swedish year: things that are in the shop only at some time of the year =====
  // A season has a name for headings (name) and one for the middle of a sentence (inline: "jul" but "Lucia"), and a window of dates (month, day; a window can go past New Year). Things with `season` are shown and can be bought only while the
  // window is open; what was bought is kept for good and can be worn at any time. They are cheap, so that the first coins can buy one.
  const SEASONS = [
    { id: "semla", name: "Semmeltider", inline: "semmeltider", from: [2, 1], to: [3, 12] },
    { id: "pask", name: "Påsk", inline: "påsk", from: [3, 15], to: [4, 25] },
    { id: "midsommar", name: "Midsommar", inline: "midsommar", from: [6, 1], to: [6, 30] },
    { id: "kraftskiva", name: "Kräftskiva", inline: "kräftskiva", from: [8, 1], to: [9, 14] },
    { id: "halloween", name: "Halloween", inline: "Halloween", from: [10, 18], to: [11, 3] },
    { id: "jul", name: "Jul", inline: "jul", from: [11, 28], to: [1, 6] },
    { id: "lucia", name: "Lucia", inline: "Lucia", from: [12, 1], to: [12, 14] }
  ];
  const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  function dateOf(date) { return date instanceof Date ? date : new Date(date === undefined ? Date.now() : date); }
  function inWindow(s, month, day) {
    const a = s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1], d = month * 100 + day;
    return a <= b ? d >= a && d <= b : d >= a || d <= b;
  }
  // the ids of the seasons that are open on a date (a Date or a time in ms; now by default)
  function activeSeasons(date) {
    const d = dateOf(date);
    return SEASONS.filter(function (s) { return inWindow(s, d.getMonth() + 1, d.getDate()); }).map(function (s) { return s.id; });
  }
  function season(id) { return SEASONS.find(function (s) { return s.id === id; }) || null; }
  // when it closes, for the shop: "14 december"
  function seasonEnds(id) { const s = season(id); return s ? s.to[1] + " " + MONTHS[s.to[0] - 1] : ""; }
  // is the thing (an item, a treat) for sale at this date? Things without a season always are.
  function inSeason(thing, date) { return !thing || !thing.season || activeSeasons(date).indexOf(thing.season) >= 0; }

  function flower(x, y, fill) { return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6.5" fill="' + fill + '" stroke="rgba(0,0,0,.18)" stroke-width="1"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.4" fill="#f2b800"/>'; }
  function crayfish(x, y, k) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><ellipse cx="0" cy="0" rx="9" ry="5" fill="#c92f2a"/><circle cx="-11" cy="-5" r="4" fill="#c92f2a"/><circle cx="11" cy="-5" r="4" fill="#c92f2a"/>' +
      '<path d="M9,1 q8,2 10,9 M-9,1 q-8,2 -10,9" stroke="#c92f2a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="-3" cy="-2" r="1.4" fill="#fff"/><circle cx="3" cy="-2" r="1.4" fill="#fff"/></g>';
  }
  function seasonal(id, slot, name, price, view, seasonId, art) {
    const it = { id: id, slot: slot, name: name, price: price, view: view, season: seasonId, art: art };
    if (ROOM_SLOT_IDS.indexOf(slot) >= 0) it.room = true;
    return it;
  }

  const SEASONAL = [
    seasonal("hatt-renhorn", "hat", "Renhorn", 20, "44 6 112 56", "jul", function () {
      return '<path d="M62,56 Q100,42 138,56" stroke="#8a5a2b" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M70,52 Q60,30 66,16 M66,28 Q56,24 52,16 M130,52 Q140,30 134,16 M134,28 Q144,24 148,16" stroke="#8a5a2b" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<circle cx="66" cy="14" r="4" fill="#e0443f"/><circle cx="134" cy="14" r="4" fill="#e0443f"/>'; }),
    seasonal("glas-tomteskagg", "face", "Tomteskägg", 20, "54 92 92 68", "jul", function () {
      return '<path d="M62,98 Q66,150 100,156 Q134,150 138,98 Q120,112 100,106 Q80,112 62,98 Z" fill="#fff" stroke="#dcdde6" stroke-width="2"/><path d="M84,104 Q100,98 116,104 Q108,114 100,108 Q92,114 84,104 Z" fill="#f4f4f6" stroke="#dcdde6" stroke-width="2"/>'; }),
    seasonal("rum-julgran", "plant", "Julgran", 25, "142 118 44 66", "jul", function () {
      return '<rect x="160" y="170" width="8" height="10" fill="#8a5a2b"/><polygon points="164,128 148,152 180,152" fill="#2f8f64"/><polygon points="164,140 146,166 182,166" fill="#3aa376"/><polygon points="164,152 144,176 184,176" fill="#43b581"/>' +
        star(164, 126, 6, "#ffd54a", "#e0a020") + '<circle cx="158" cy="148" r="3" fill="#e0443f"/><circle cx="170" cy="160" r="3" fill="#4c9be8"/><circle cx="156" cy="168" r="3" fill="#ffd54a"/><circle cx="172" cy="146" r="2.5" fill="#fff"/>'; }),
    seasonal("hatt-lucia", "hat", "Luciakrona", 25, "56 4 88 62", "lucia", function () {
      let s = '<path d="M60,58 Q100,38 140,58" stroke="#2f8f64" stroke-width="10" fill="none" stroke-linecap="round"/>';
      [[72, 54], [86, 48], [114, 48], [128, 54]].forEach(function (p) { s += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="9" ry="4" fill="#3aa376" transform="rotate(' + (p[0] < 100 ? -20 : 20) + ' ' + p[0] + ' ' + p[1] + ')"/>'; });
      [[80, 46], [100, 42], [120, 46]].forEach(function (p) {
        s += '<rect x="' + (p[0] - 4) + '" y="' + (p[1] - 20) + '" width="8" height="20" rx="2" fill="#fffaf0" stroke="#e6dcc8"/><ellipse cx="' + p[0] + '" cy="' + (p[1] - 26) + '" rx="4" ry="6.5" fill="#ffb300"/><ellipse cx="' + p[0] + '" cy="' + (p[1] - 25) + '" rx="2" ry="3.5" fill="#fff3a0"/>';
      });
      return s + '<circle cx="92" cy="50" r="2.6" fill="#e0443f"/><circle cx="108" cy="50" r="2.6" fill="#e0443f"/>'; }),
    seasonal("hatt-pumpa", "hat", "Pumpahatt", 20, "56 4 88 64", "halloween", function () {
      return '<ellipse cx="100" cy="40" rx="36" ry="24" fill="#f08a2b"/><path d="M84,18 Q76,40 84,62 M100,16 V64 M116,18 Q124,40 116,62" stroke="#c96a14" stroke-width="3" fill="none" opacity=".7"/><rect x="95" y="8" width="10" height="14" rx="3" fill="#4a7a3a"/>' +
        '<path d="M102,12 Q116,6 120,16" stroke="#58b05b" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M82,36 l8,-9 l8,9z M102,36 l8,-9 l8,9z" fill="#3b2a12"/><path d="M82,48 Q100,60 118,48 L112,45 L106,51 L100,45 L94,51 L88,45 Z" fill="#3b2a12"/>'; }),
    seasonal("rum-pumpa", "plant", "Snidad pumpa", 20, "144 148 40 38", "halloween", function () {
      return '<ellipse cx="164" cy="170" rx="17" ry="13" fill="#f08a2b"/><path d="M156,158 Q151,170 156,182 M164,157 V183 M172,158 Q177,170 172,182" stroke="#c96a14" stroke-width="2" fill="none" opacity=".7"/><rect x="161" y="153" width="6" height="8" rx="2" fill="#4a7a3a"/>' +
        '<path d="M155,169 l5,-6 l5,6z M164,169 l5,-6 l5,6z" fill="#ffd54a"/><path d="M155,176 Q164,183 173,176 L170,173 L166,177 L164,173 L162,177 L158,173 Z" fill="#ffd54a"/>'; }),
    seasonal("hatt-pask", "hat", "Kycklinghatt", 20, "56 8 88 58", "pask", function () {
      return '<path d="M64,58 L72,48 L80,58 L88,48 L96,58 L104,48 L112,58 L120,48 L128,58 L136,48 L136,62 H64 Z" fill="#fff" stroke="#e6dcc8" stroke-width="2"/><circle cx="100" cy="36" r="22" fill="#ffd54a"/>' +
        '<path d="M118,36 L130,40 L118,44 Z" fill="#f08a2b"/><circle cx="108" cy="30" r="3" fill="#2a2630"/><path d="M80,40 Q86,52 98,48" stroke="#f2b800" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M94,15 Q92,6 99,8" stroke="#f2b800" stroke-width="3" fill="none" stroke-linecap="round"/>'; }),
    seasonal("rum-paskris", "plant", "Påskris", 20, "142 120 44 68", "pask", function () {
      let s = '<path d="M164,176 Q160,150 150,130 M164,176 Q166,146 164,126 M164,176 Q170,150 180,132 M164,176 Q172,158 184,152" stroke="#8a5a2b" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
      [[150, 130, "#ff8fb0"], [164, 124, "#ffd54a"], [180, 130, "#7fb9f2"], [184, 150, "#ff8fb0"], [157, 142, "#43b581"]].forEach(function (f) { s += '<ellipse cx="' + f[0] + '" cy="' + f[1] + '" rx="3.6" ry="7" fill="' + f[2] + '" transform="rotate(' + (f[0] - 164) + ' ' + f[0] + ' ' + f[1] + ')"/>'; });
      return s + '<path d="M152,170 H176 L173,184 H155 Z" fill="#7fb9f2"/><rect x="150" y="167" width="28" height="5" rx="2" fill="#4c9be8"/>'; }),
    seasonal("hatt-angsbukett", "hat", "Ängsbukett", 20, "56 6 88 58", "midsommar", function () {
      return '<path d="M66,56 Q100,44 134,56" stroke="#43b581" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M82,52 L74,26 M100,48 L100,16 M118,52 L126,26" stroke="#3aa376" stroke-width="3" fill="none" stroke-linecap="round"/>' + flower(74, 24, "#fff") + flower(100, 14, "#4c9be8") + flower(126, 24, "#e0443f"); }),
    seasonal("rum-midsommarstang", "plant", "Midsommarstång", 25, "140 96 48 88", "midsommar", function () {
      return '<rect x="162" y="106" width="4" height="76" fill="#8a5a2b"/><ellipse cx="164" cy="132" rx="13" ry="5" fill="none" stroke="#43b581" stroke-width="4"/><circle cx="164" cy="102" r="7" fill="#ffd54a"/><path d="M164,108 Q148,112 144,134 M164,108 Q180,112 184,134" stroke="#3aa376" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<circle cx="144" cy="138" r="4" fill="#ff8fb0"/><circle cx="184" cy="138" r="4" fill="#ffd54a"/><circle cx="164" cy="137" r="3" fill="#4c9be8"/>'; }),
    seasonal("hatt-kraft", "hat", "Kräfthatt", 20, "56 -6 88 68", "kraftskiva", function () {
      return '<path d="M72,58 L100,12 L128,58 Z" fill="#e0443f"/><path d="M80,44 H120 M88,30 H112" stroke="#fff" stroke-width="3"/>' + crayfish(100, 8, 1); }),
    seasonal("hals-haklapp", "neck", "Kräfthaklapp", 20, "54 108 92 76", "kraftskiva", function () {
      return '<path d="M66,120 Q100,138 134,120 L140,162 Q100,178 60,162 Z" fill="#fffaf0" stroke="#e6dcc8" stroke-width="2"/>' + crayfish(100, 150, 1.3); })
  ];
  SEASONAL.forEach(function (it) { ITEMS.push(it); });

  function isRoomSlot(slot) { return ROOM_SLOT_IDS.indexOf(slot) >= 0; }

  // ===== the backgrounds became wallpapers =====
  // There are no backgrounds in the shop any more: each of them is a wallpaper of the room. A pet that had bought one owns the wallpaper
  // for the price it paid (so no coins change), and has it on the wall if the background was the one in use. Stjärnhimmel and Under vattnet
  // are the wallpapers Stjärnvägg and Havsvägg that were there already. The three that badges unlock (markt-gympa, markt-tabell and
  // markt-regnbage) keep their ids: they are wallpapers now, so only the place where the pet had it on is moved.
  // migrate(pet) returns the changed record, or null when there is nothing to change (it can be run again and again).
  const BG_TO_WALL = {
    "bg-gras": "rum-vagg-gras", "bg-natt": "rum-vagg-stjarnor", "bg-strand": "rum-vagg-strand", "bg-sno": "rum-vagg-sno", "bg-tavla": "rum-vagg-tavla",
    "bg-rymd": "rum-vagg-rymd", "bg-skog": "rum-vagg-skog", "bg-regnbage": "rum-vagg-regnbage", "bg-orken": "rum-vagg-orken", "bg-hav": "rum-vagg-hav",
    "bg-solnedgang": "rum-vagg-solnedgang"
  };

  function migrate(pet) {
    if (!pet || typeof pet !== "object" || !pet.kind) return null;
    const owned = pet.owned || {};
    const old = Object.keys(owned).filter(function (id) { return BG_TO_WALL[id]; });
    const phones = pet.worn && pet.worn.neck === "hals-horlurar";
    if (!old.length && !("bg" in pet) && pet.scene === "room" && !phones) return null;
    const next = JSON.parse(JSON.stringify(pet));
    if (phones) {
      // the headphones moved from the neck to the face: on the head if that place is free, otherwise just taken off (they are still owned)
      delete next.worn.neck;
      if (!next.worn.face) next.worn.face = "hals-horlurar";
    }
    next.owned = next.owned || {};
    old.forEach(function (id) {
      const to = BG_TO_WALL[id];
      next.owned[to] = (Number(next.owned[to]) || 0) + (Number(next.owned[id]) || 0);   // what was paid stays paid
      delete next.owned[id];
    });
    const wore = next.bg && (BG_TO_WALL[next.bg] || next.bg);
    next.room = next.room || {};
    // what the pet showed stays what it shows: the background if that was the view, otherwise the wall it already had
    if (wore && next.owned[wore] !== undefined && item(wore) && item(wore).slot === "wall" && (!next.room.wall || next.scene !== "room")) next.room.wall = wore;
    delete next.bg;
    next.scene = "room";
    return next;
  }

  function item(id) {
    return ITEMS.find(function (i) { return i.id === id; }) || null;
  }

  // ===== food and play =====
  // Things that are used up, not kept: a treat or a toy costs a few coins and sets off a short animation (see pet.js).
  // type "food" or "toy"; a: how to say one of it ("ett äpple"), pl: what the animal loves when it is the favourite;
  // motion: how a toy moves in the animation. Drawn in a 60 x 60 box.
  const FOODS = [
    { id: "applet", type: "food", name: "Äpple", price: 2, a: "ett äpple", pl: "äpplen", count: "äpplen", art: function () {
      return '<ellipse cx="30" cy="35" rx="18" ry="17" fill="#e0443f"/><path d="M30,19 Q29,11 35,8" stroke="#6b4a2a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M33,15 Q42,8 48,14 Q40,20 33,15 Z" fill="#43b581"/><ellipse cx="22" cy="29" rx="4" ry="6.5" fill="#fff" opacity=".35"/>'; } },
    { id: "morot", type: "food", name: "Morot", price: 2, a: "en morot", pl: "morötter", count: "morötter", art: function () {
      return '<path d="M19,17 Q30,11 41,17 L32,54 Q30,57 28,54 Z" fill="#f08a2b"/><path d="M24,26 H32 M26,36 H34 M28,45 H33" stroke="#c96a14" stroke-width="2.2" stroke-linecap="round"/><path d="M30,16 Q22,6 17,8 Q22,13 28,16 M30,16 Q30,4 30,3 Q33,10 31,16 M31,16 Q38,6 44,8 Q38,13 32,16" fill="#43b581" stroke="#2f9a6a" stroke-width="1.5" stroke-linejoin="round"/>'; } },
    { id: "fisk", type: "food", name: "Fisk", price: 3, a: "en fisk", pl: "fisk", count: "fiskar", art: function () {
      return '<path d="M44,30 L57,18 V42 Z" fill="#4c9be8"/><ellipse cx="28" cy="30" rx="19" ry="13" fill="#6fb6f2"/><path d="M20,22 Q26,30 20,38 M28,20 Q34,30 28,40" stroke="#4c9be8" stroke-width="2" fill="none" stroke-linecap="round" opacity=".6"/><circle cx="15" cy="27" r="3.2" fill="#fff"/><circle cx="14.4" cy="27.4" r="1.7" fill="#2a2630"/>'; } },
    { id: "ben", type: "food", name: "Hundben", price: 3, a: "ett hundben", pl: "hundben", count: "hundben", art: function () {
      const knob = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#f6efe2" stroke="#d6c7a8" stroke-width="2.2"/>'; };
      return '<g transform="rotate(-35 30 30)">' + knob(11, 23.5) + knob(11, 36.5) + knob(49, 23.5) + knob(49, 36.5) +
        '<rect x="12" y="24" width="36" height="12" rx="4" fill="#f6efe2" stroke="#d6c7a8" stroke-width="2.2"/><rect x="9" y="25" width="42" height="10" fill="#f6efe2"/></g>'; } },
    { id: "blabar", type: "food", name: "Blåbär", price: 2, a: "några blåbär", pl: "blåbär", count: "blåbär", art: function () {
      const b = function (x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#4b5fc4"/><path d="M' + (x - 3) + ',' + (y - r + 2) + ' l3,3 l3,-3" stroke="#2c3a8a" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="' + (x - r / 3) + '" cy="' + (y - r / 3) + '" r="' + (r / 5) + '" fill="#fff" opacity=".4"/>'; };
      return b(20, 38, 11) + b(40, 38, 11) + b(30, 22, 11); } },
    { id: "fron", type: "food", name: "Solrosfrö", price: 2, a: "ett solrosfrö", pl: "solrosfrön", count: "solrosfrön", art: function () {
      return '<path d="M30,6 Q48,24 40,50 Q30,58 20,50 Q12,24 30,6 Z" fill="#43403f"/><path d="M30,10 Q40,26 34,50 M30,10 Q20,26 26,50 M30,12 V52" stroke="#e9e4da" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>'; } },
    { id: "majs", type: "food", name: "Majskolv", price: 3, a: "en majskolv", pl: "majskolvar", count: "majskolvar", art: function () {
      let kernels = "";
      for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) kernels += '<circle cx="' + (24 + k * 6 + (r % 2) * 3) + '" cy="' + (14 + r * 6.6) + '" r="2.3" fill="#ffd54a" stroke="#e0a020" stroke-width=".7"/>';
      return '<ellipse cx="30" cy="30" rx="12" ry="24" fill="#f6c940" stroke="#e0a020" stroke-width="2"/>' + kernels +
        '<path d="M30,52 Q10,50 8,30 Q20,38 30,46 Z" fill="#6fc36f"/><path d="M30,52 Q50,50 52,30 Q40,38 30,46 Z" fill="#58b05b"/>'; } },
    { id: "klover", type: "food", name: "Klöver", price: 2, a: "lite klöver", pl: "klöver", count: "klöverblad", art: function () {
      const leaf = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="10" fill="#58b05b"/><path d="M' + x + ',' + y + ' l-6,-4 M' + x + ',' + y + ' l6,-4" stroke="#3f9a4a" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>'; };
      return '<path d="M30,34 Q32,46 40,56" stroke="#3f9a4a" stroke-width="3" fill="none" stroke-linecap="round"/>' + leaf(20, 28) + leaf(40, 28) + leaf(30, 16) + '<circle cx="30" cy="27" r="3" fill="#fff" opacity=".55"/>'; } },
    { id: "bulle", type: "food", name: "Kanelbulle", price: 3, a: "en kanelbulle", pl: "kanelbullar", count: "kanelbullar", art: function () {
      return '<ellipse cx="30" cy="36" rx="25" ry="17" fill="#d9a05b"/><ellipse cx="30" cy="31" rx="25" ry="17" fill="#e8b878"/>' +
        '<path d="M30,31 m-1,0 a3,2.2 0 1 1 5,1 a7,5 0 1 1 -10,-2 a12,8.5 0 1 1 17,4 a17,11.5 0 1 1 -22,-6" stroke="#a8682e" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        '<circle cx="14" cy="24" r="1.7" fill="#fff8ea"/><circle cx="46" cy="26" r="1.7" fill="#fff8ea"/><circle cx="22" cy="44" r="1.7" fill="#fff8ea"/><circle cx="40" cy="43" r="1.7" fill="#fff8ea"/><circle cx="30" cy="17" r="1.7" fill="#fff8ea"/>'; } }
  ];

  const TOYS = [
    { id: "boll", type: "toy", name: "Boll", price: 2, motion: "bounce", a: "en boll", pl: "bollar", art: function () {
      return '<circle cx="30" cy="30" r="22" fill="#e8394d"/><path d="M10,24 Q30,34 50,24 M10,38 Q30,28 50,38" stroke="#fff" stroke-width="3" fill="none" opacity=".85"/><ellipse cx="22" cy="20" rx="5" ry="7" fill="#fff" opacity=".3"/>'; } },
    { id: "frisbee", type: "toy", name: "Frisbee", price: 2, motion: "fly", a: "en frisbee", pl: "frisbees", art: function () {
      return '<ellipse cx="30" cy="34" rx="26" ry="10" fill="#2f8fe0"/><ellipse cx="30" cy="30" rx="26" ry="10" fill="#4fb0f4"/><ellipse cx="30" cy="30" rx="15" ry="5" fill="#8fd0fb"/>'; } },
    { id: "nystan", type: "toy", name: "Garnnystan", price: 2, motion: "roll", a: "ett garnnystan", pl: "garnnystan", art: function () {
      return '<circle cx="30" cy="30" r="21" fill="#ee7fa6"/><path d="M12,24 Q30,16 48,28 M10,32 Q30,24 50,36 M16,44 Q32,32 46,44 M22,12 Q34,30 26,50" stroke="#c9547f" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M50,40 Q58,44 54,54" stroke="#ee7fa6" stroke-width="3" fill="none" stroke-linecap="round"/>'; } },
    { id: "bubblor", type: "toy", name: "Såpbubblor", price: 1, motion: "float", a: "såpbubblor", pl: "såpbubblor", art: function () {
      const b = function (x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#d6efff" fill-opacity=".45" stroke="#7fc2ee" stroke-width="2"/><path d="M' + (x - r * 0.55) + ',' + (y - r * 0.1) + ' Q' + (x - r * 0.5) + ',' + (y - r * 0.55) + ' ' + (x - r * 0.05) + ',' + (y - r * 0.6) + '" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'; };
      return b(22, 38, 14) + b(42, 22, 10) + b(44, 46, 7); } },
    { id: "ballong", type: "toy", name: "Ballong", price: 2, motion: "float", a: "en ballong", pl: "ballonger", art: function () {
      return '<path d="M30,6 Q50,6 50,24 Q50,40 30,46 Q10,40 10,24 Q10,6 30,6 Z" fill="#ef6f88"/><path d="M27,46 L30,50 L33,46 Z" fill="#c9476a"/><path d="M30,50 Q24,54 30,58" stroke="#8a7a6a" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="18" rx="4" ry="7" fill="#fff" opacity=".35" transform="rotate(20 22 18)"/>'; } },
    { id: "klocka", type: "toy", name: "Klocka", price: 2, motion: "bounce", a: "en klocka", pl: "klockor", art: function () {
      return '<path d="M30,8 Q12,12 12,34 Q12,42 6,46 H54 Q48,42 48,34 Q48,12 30,8 Z" fill="#f2c94c" stroke="#d9a520" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="30" cy="50" rx="6" ry="5" fill="#d9a520"/><circle cx="30" cy="7" r="3.2" fill="#d9a520"/><path d="M20,18 Q17,28 18,36" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>'; } },
    { id: "snobollen", type: "toy", name: "Snöboll", price: 2, motion: "bounce", a: "en snöboll", pl: "snöbollar", art: function () {
      return '<circle cx="30" cy="30" r="21" fill="#eef5fc" stroke="#8fb6da" stroke-width="2.6"/><path d="M13,36 Q20,52 40,47 Q52,42 51,28 Q46,46 30,47 Q18,46 13,36 Z" fill="#cfe2f4"/><path d="M19,20 Q25,13 34,15" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="24" cy="30" r="1.8" fill="#9fc0e0"/><circle cx="37" cy="26" r="1.5" fill="#9fc0e0"/>'; } }
  ];

  // treats of the Swedish year (for sale only in their season, see SEASONS)
  [
    { id: "lussekatt", season: "lucia", type: "food", name: "Lussekatt", price: 3, a: "en lussekatt", pl: "lussekatter", count: "lussekatter", art: function () {
      return '<path d="M44,15 C28,6 12,18 22,28 C29,36 44,33 40,46 C37,54 21,54 13,46" stroke="#f0a928" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M44,15 C28,6 12,18 22,28 C29,36 44,33 40,46 C37,54 21,54 13,46" stroke="#f8cf6a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/><circle cx="48" cy="21" r="2.6" fill="#5a2b1a"/><circle cx="12" cy="40" r="2.6" fill="#5a2b1a"/>'; } },
    { id: "pepparkaka", season: "jul", type: "food", name: "Pepparkaka", price: 3, a: "en pepparkaka", pl: "pepparkakor", count: "pepparkakor", art: function () {
      return '<circle cx="30" cy="14" r="9" fill="#b9733a"/><path d="M22,22 Q30,26 38,22 L52,26 Q56,34 50,36 L40,34 L44,52 Q40,56 34,52 L30,42 L26,52 Q20,56 16,52 L20,34 L10,36 Q4,34 8,26 Z" fill="#b9733a"/><circle cx="26" cy="12" r="1.6" fill="#fff"/><circle cx="34" cy="12" r="1.6" fill="#fff"/><path d="M26,17 Q30,20 34,17" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="30" cy="30" r="2" fill="#fff"/><circle cx="30" cy="38" r="2" fill="#fff"/>'; } },
    { id: "paskagg", season: "pask", type: "food", name: "Påskägg", price: 3, a: "ett påskägg", pl: "påskägg", count: "påskägg", art: function () {
      return '<ellipse cx="30" cy="32" rx="19" ry="24" fill="#8a5a2b"/><path d="M12,26 L19,20 L26,26 L33,20 L40,26 L47,20 M11,38 L18,32 L25,38 L32,32 L39,38 L46,32" stroke="#ff8fb0" stroke-width="3" fill="none" stroke-linejoin="round"/><path d="M14,46 Q30,52 46,46" stroke="#7fb9f2" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="18" rx="3" ry="6" fill="#fff" opacity=".4" transform="rotate(20 22 18)"/>'; } },
    { id: "semla", season: "semla", type: "food", name: "Semla", price: 3, a: "en semla", pl: "semlor", count: "semlor", art: function () {
      return '<ellipse cx="30" cy="42" rx="24" ry="10" fill="#d9a05b"/><path d="M12,34 Q30,28 48,34 Q40,42 30,42 Q20,42 12,34 Z" fill="#fff"/><path d="M6,32 Q8,10 30,10 Q52,10 54,32 Q30,26 6,32 Z" fill="#e8b878"/><path d="M14,18 Q30,6 46,18" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>'; } },
    { id: "jordgubbar", season: "midsommar", type: "food", name: "Jordgubbar", price: 3, a: "några jordgubbar", pl: "jordgubbar", count: "jordgubbar", art: function () {
      const b = function (x, y) {
        return '<path d="M' + x + ',' + (y + 18) + ' Q' + (x - 17) + ',' + (y + 2) + ' ' + (x - 10) + ',' + (y - 8) + ' Q' + x + ',' + (y - 14) + ' ' + (x + 10) + ',' + (y - 8) + ' Q' + (x + 17) + ',' + (y + 2) + ' ' + x + ',' + (y + 18) + ' Z" fill="#e0344a"/>' +
          '<path d="M' + (x - 8) + ',' + (y - 9) + ' L' + x + ',' + (y - 4) + ' L' + (x + 8) + ',' + (y - 9) + ' L' + x + ',' + (y - 14) + ' Z" fill="#3f9a4a"/>' +
          '<circle cx="' + (x - 5) + '" cy="' + (y + 3) + '" r="1.2" fill="#ffe27a"/><circle cx="' + (x + 5) + '" cy="' + (y + 1) + '" r="1.2" fill="#ffe27a"/><circle cx="' + x + '" cy="' + (y + 9) + '" r="1.2" fill="#ffe27a"/>'; };
      return b(20, 34) + b(40, 28); } }
  ].forEach(function (f) { FOODS.push(f); });

  // what the animal likes to eat, in the plural for counting ("morötter"); used by the problems about the pet
  function countable(kind) {
    const k = KINDS[kind];
    const f = k && k.likes && FOODS.find(function (x) { return x.id === k.likes.food; });
    return f ? f.count : "äpplen";
  }

  function thing(id) {
    return FOODS.find(function (t) { return t.id === id; }) || TOYS.find(function (t) { return t.id === id; }) || null;
  }

  // a treat or a toy on its own (the shelf and the animation)
  function snack(id) {
    const t = thing(id);
    if (!t) return "";
    return '<svg class="pet-thumb" viewBox="0 0 60 60" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g>' + t.art() + '</g></svg>';
  }

  const FREE_BG = '<rect width="200" height="200" fill="#e8f3fb"/><ellipse cx="100" cy="204" rx="140" ry="34" fill="#d3e7f5"/>';

  // ===== putting it together =====
  function petLayers(pet, mood) {
    const kind = KINDS[pet.kind] ? pet.kind : "dog";
    const c = colorOf(kind, pet.color);
    const worn = pet.worn || {};
    const shift = SHIFT[kind];
    const part = function (slot) {
      const it = worn[slot] && item(worn[slot]);
      return it && it.slot === slot ? '<g transform="translate(0 ' + shift[slot] + ')">' + it.art(headOf(kind)) + '</g>' : "";
    };
    const body = bodyOf(kind, c, mood);
    const inner = body + part("neck") + part("face") + part("hat");
    return '<g class="pet-bob">' + (shift.place ? '<g transform="' + shift.place + '">' + inner + '</g>' : inner) + '</g>';
  }

  function bodyOf(kind, c, mood) {
    const draw = { cat: cat, penguin: penguin, tax: tax, rabbit: rabbit, hedgehog: hedgehog, fox: fox, hamster: hamster, dragon: dragon, axolotl: axolotl, pig: pig, cow: cow, cockatiel: cockatiel }[kind] || dog;
    return draw(c, mood);
  }

  // the pet in its room (pet.scene "room"; the things in pet.room)
  function roomSvg(pet, options) {
    const kind = KINDS[pet.kind] ? pet.kind : "dog";
    const mood = options.mood || "";
    counter += 1;
    const clip = "pet-clip-" + counter;
    const r = pet.room || {};
    const layer = function (slot) { const it = r[slot] && item(r[slot]); return it && it.slot === slot ? it.art() : ""; };
    const sparks = mood === "happy"
      ? '<g class="pet-sparks"><text class="pet-spark" x="52" y="64">✦</text><text class="pet-spark s2" x="144" y="58">✦</text><text class="pet-spark s3" x="100" y="38">♥</text></g>'
      : "";
    const label = options.label || (KINDS[kind].name + (pet.name ? " som heter " + pet.name : "") + " i sitt rum");
    return '<svg class="pet-svg pet-room-svg pet-' + kind + (mood ? " is-" + mood : "") + '" viewBox="0 0 200 200" role="img" aria-label="' + label.replace(/[<>&"]/g, "") + '" xmlns="http://www.w3.org/2000/svg"' +
      (options.size ? ' width="' + options.size + '" height="' + options.size + '"' : "") + '>' +
      '<defs><clipPath id="' + clip + '"><rect width="200" height="200" rx="26"/></clipPath></defs><g clip-path="url(#' + clip + ')">' +
      (layer("wall") || WALL_DEFAULT) + FLOOR + layer("window") + layer("shelf") + layer("rug") + layer("bed") + layer("lamp") + layer("plant") + '<g class="room-toy">' + layer("toy") + '</g>' +
      '<ellipse cx="100" cy="177" rx="34" ry="5" fill="#000" opacity=".14"/></g>' +
      '<g class="pet-actor"><g transform="translate(25 38) scale(.75)">' + petLayers(pet, mood) + '</g></g>' + sparks + '</svg>';
  }

  function svg(pet, options) {
    options = options || {};
    if (pet.scene === "room" && !options.bare) return roomSvg(pet, options);
    const kind = KINDS[pet.kind] ? pet.kind : "dog";
    const c = colorOf(kind, pet.color);
    const worn = pet.worn || {};
    const mood = options.mood || "";
    counter += 1;
    const clip = "pet-clip-" + counter;
    const shift = SHIFT[kind];
    const part = function (slot) {
      const it = worn[slot] && item(worn[slot]);
      return it && it.slot === slot ? '<g transform="translate(0 ' + shift[slot] + ')">' + it.art(headOf(kind)) + '</g>' : "";
    };
    const bg = options.bare ? "" : FREE_BG;   // only for a pet that has no room yet (the chooser): the room is where a pet lives
    const body = bodyOf(kind, c, mood);
    const sparks = mood === "happy"
      ? '<g class="pet-sparks"><text class="pet-spark" x="46" y="60">✦</text><text class="pet-spark s2" x="150" y="52">✦</text><text class="pet-spark s3" x="100" y="26">♥</text></g>'
      : "";
    const label = options.label || (KINDS[kind].name + (pet.name ? " som heter " + pet.name : ""));
    return '<svg class="pet-svg pet-' + kind + (mood ? " is-" + mood : "") + '" viewBox="0 0 200 200" role="img" aria-label="' + label.replace(/[<>&"]/g, "") + '" xmlns="http://www.w3.org/2000/svg"' +
      (options.size ? ' width="' + options.size + '" height="' + options.size + '"' : "") + '>' +
      (options.bare ? "" : '<defs><clipPath id="' + clip + '"><rect width="200" height="200" rx="26"/></clipPath></defs><g clip-path="url(#' + clip + ')">' + bg + '<ellipse cx="100" cy="186" rx="48" ry="7" fill="#000" opacity=".12"/></g>') +
      '<g class="pet-actor">' + petLayers(pet, mood) + '</g>' + sparks + '</svg>';
  }

  // an item on its own (shop shelves)
  function thumb(id) {
    const it = item(id);
    if (!it) return "";
    return '<svg class="pet-thumb" viewBox="' + it.view + '" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g>' + it.art() + '</g></svg>';
  }

  // the head only, small, for the lesson footer. With options.crop: a viewBox of your own (the pet peeking over an edge). With options.wide: the whole upper body with some air around it (gills, wings, ears and
  // a tall hat fit), for the pet on the map; the picture then is 184 wide and 150 high.
  // ===== the arm that points =====
  // An arm, a paw, a hoof, a claw, a flipper or a wing reaching to the left, for the pet that peeks over the step card and points at the
  // button (see peek in pet.js). 90 wide and 36 high, the shoulder at the right edge (behind the head) and the tip at the left.
  // The kind of limb is in data-arm: paw, hoof, foot, claw, flipper or wing.
  const ARM = {
    dog: "paw", tax: "paw", cat: "paw", fox: "paw", rabbit: "paw", hamster: "paw", hedgehog: "paw",
    pig: "hoof", cow: "hoof", axolotl: "foot", dragon: "claw", penguin: "flipper", cockatiel: "wing"
  };

  function pointer(kind, colorId) {
    kind = KINDS[kind] ? kind : "dog";
    const c = colorOf(kind, colorId);
    const type = ARM[kind];
    const B = c.body, D = c.dark, Lt = c.light;
    const st = ' stroke="' + D + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
    const limb = '<rect x="30" y="11" width="62" height="14" rx="7" fill="' + B + '"' + st + '/>';
    let tip = "";
    if (type === "paw") {
      // a paw seen from above: the paw with three toes at the front, and the lines between them
      const fur = kind === "fox" ? D : kind === "rabbit" || kind === "hedgehog" ? Lt : B;
      const line = kind === "fox" ? Lt : D;
      tip = '<circle cx="10" cy="8.5" r="5.8" fill="' + fur + '"' + st + '/><circle cx="6" cy="18" r="6.4" fill="' + fur + '"' + st + '/><circle cx="10" cy="27.5" r="5.8" fill="' + fur + '"' + st + '/>' +
        '<ellipse cx="25" cy="18" rx="15" ry="12.5" fill="' + fur + '"' + st + '/>' +
        '<path d="M9,13 Q15,14 19,17.4 M9,23 Q15,22 19,18.6" fill="none" stroke="' + line + '" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>';
    } else if (type === "hoof") {
      // a trotter or a hoof with the split in the middle
      tip = '<ellipse cx="22" cy="18" rx="15" ry="11.5" fill="' + B + '"' + st + '/>' +
        '<path d="M14,8 Q2,10 2,18 Q2,26 14,28 Q22,18 14,8 Z" fill="' + D + '"/>' +
        '<path d="M2,18 H16" stroke="' + Lt + '" stroke-width="1.8" stroke-linecap="round"/>';
    } else if (type === "hand") {
      // a small hand with three fingers, the longest one pointing
      tip = '<ellipse cx="24" cy="18" rx="13" ry="11" fill="' + B + '"' + st + '/>' +
        '<ellipse cx="9" cy="11" rx="8" ry="3.6" fill="' + B + '"' + st + '/><ellipse cx="6" cy="18" rx="10" ry="3.8" fill="' + B + '"' + st + '/><ellipse cx="9" cy="25" rx="8" ry="3.6" fill="' + B + '"' + st + '/>' +
        '<circle cx="1.6" cy="18" r="1.4" fill="' + Lt + '"/>';
    } else if (type === "foot") {
      // a salamander's foot: a rounded sole with four short toes
      tip = '<ellipse cx="24" cy="18" rx="13" ry="11" fill="' + B + '"' + st + '/>' +
        '<ellipse cx="8" cy="8.5" rx="7" ry="3.4" fill="' + B + '"' + st + '/><ellipse cx="4.5" cy="15.2" rx="8.5" ry="3.5" fill="' + B + '"' + st + '/><ellipse cx="4.5" cy="21.2" rx="8.5" ry="3.5" fill="' + B + '"' + st + '/><ellipse cx="8" cy="27.8" rx="7" ry="3.4" fill="' + B + '"' + st + '/>';
    } else if (type === "claw") {
      tip = '<ellipse cx="26" cy="18" rx="13" ry="11" fill="' + B + '"' + st + '/>' +
        '<path d="M15,9 L1,12 L15,15 Z" fill="' + Lt + '"' + st + '/><path d="M13,16 L0,18 L13,20 Z" fill="' + Lt + '"' + st + '/><path d="M15,21 L1,25 L15,27 Z" fill="' + Lt + '"' + st + '/>';
    } else if (type === "flipper") {
      // a long, narrow flipper that narrows to a tip
      return '<svg class="pet-arm" data-arm="flipper" viewBox="0 0 90 36" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M92,7 Q52,3 6,16 Q1,18 6,21 Q52,33 92,28 Z" fill="' + D + '"' + st + '/>' +
        '<path d="M86,12 Q50,10 14,18" fill="none" stroke="' + Lt + '" stroke-width="2.4" stroke-linecap="round" opacity=".4"/></svg>';
    } else {
      // a wing: the long feathers at the tip are the fingers that point
      return '<svg class="pet-arm" data-arm="wing" viewBox="0 0 90 36" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M92,5 Q60,1 34,9 L3,12 L27,16 L1,21 L29,22 L7,30 Q54,31 92,27 Z" fill="' + D + '"' + st + '/>' +
        '<path d="M92,10 Q62,7 38,12 L38,20 Q62,18 92,21 Z" fill="' + Lt + '" opacity=".92"/>' +
        '<path d="M27,16 L36,14 M29,22 L38,20 M7,30 L30,25" stroke="' + D + '" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';
    }
    return '<svg class="pet-arm" data-arm="' + type + '" viewBox="0 0 90 36" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">' + limb + tip + '</svg>';
  }

  const WIDE_CROP = "8 0 184 150";
  function face(pet, mood, options) {
    const kind = KINDS[pet.kind] ? pet.kind : "dog";
    const wide = Boolean(options && options.wide);
    const w = pet.worn || {};
    const s = svg({ kind: kind, color: pet.color, worn: wide ? { hat: w.hat, face: w.face, neck: w.neck } : { hat: w.hat, face: w.face }, bg: null, name: pet.name }, { mood: mood, bare: true });
    const crop = (options && options.crop) || (wide ? WIDE_CROP : (SHIFT[kind].crop || "40 14 120 110"));
    return s.replace(/<g class="pet-sparks">[\s\S]*?<\/g>/, "").replace('viewBox="0 0 200 200"', 'viewBox="' + crop + '"');
  }

  return { HEAD: HEAD, headOf: headOf, SEASONS: SEASONS, activeSeasons: activeSeasons, season: season, seasonEnds: seasonEnds, inSeason: inSeason, KINDS: KINDS, FOODS: FOODS, TOYS: TOYS, pointer: pointer, ARM: ARM, countable: countable, thing: thing, snack: snack, ITEMS: ITEMS, SETS: SETS, ROOM_SLOTS: ROOM_SLOTS, isRoomSlot: isRoomSlot, migrate: migrate, BG_TO_WALL: BG_TO_WALL, item: item, colorOf: colorOf, svg: svg, thumb: thumb, face: face };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaPetArt;
