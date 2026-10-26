// The drawings of the pets: a dog, a cat and a penguin, with clothes and accessories and a few backgrounds.
// Everything is plain SVG made here, so there are no image files and it works offline.
//
//   GaussicaPetArt.KINDS                      { dog, cat, penguin }: name, colours, default names
//   GaussicaPetArt.ITEMS                      the shop: [{ id, slot, name, price, view, set?, need? }]  (slot: hat | face | neck | bg)
//   GaussicaPetArt.SETS                       the themed sets, one for each area of the course: pieces with set and need
//                                             (the number of finished lessons in the area that unlocks the piece)
//   GaussicaPetArt.item(id)                   one item
//   GaussicaPetArt.svg(pet, options)          the pet as an SVG string. pet = { kind, color, worn: { hat, face, neck }, bg }
//                                             options = { mood: "happy", size, bare, label }
//   GaussicaPetArt.thumb(itemId)              an item on its own, for the shop
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
    }
  };

  // how much an item moves for each animal, so that it sits right on the head, face and neck
  const SHIFT = {
    dog: { hat: 2, face: 1, neck: 0 },
    cat: { hat: 0, face: 1, neck: 0 },
    penguin: { hat: 12, face: 1, neck: -3 }
  };

  function colorOf(kind, id) {
    const list = KINDS[kind].colors;
    return list.find(function (c) { return c.id === id; }) || list[0];
  }

  // ===== the animals =====
  function eyes(kind, mood, c) {
    const pos = kind === "penguin" ? [[86, 82], [114, 82]] : kind === "cat" ? [[84, 83], [116, 83]] : [[82, 84], [118, 84]];
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
    const ry = kind === "cat" ? 7.5 : 6.5;
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
    // backgrounds
    { id: "bg-gras", slot: "bg", name: "Äng", price: 25, view: "0 0 200 200", art: function (id) {
      return '<rect width="200" height="200" fill="#bfe6f7"/><circle cx="160" cy="36" r="16" fill="#ffe27a"/><ellipse cx="100" cy="206" rx="150" ry="46" fill="#7cc576"/><ellipse cx="30" cy="196" rx="70" ry="26" fill="#63b45e"/>' +
        '<circle cx="34" cy="176" r="4" fill="#ff8fb0"/><circle cx="166" cy="180" r="4" fill="#fff"/><circle cx="150" cy="190" r="3.5" fill="#ffd54a"/>'; } },
    { id: "bg-natt", slot: "bg", name: "Stjärnhimmel", price: 35, view: "0 0 200 200", art: function () {
      let s = "";
      [[24, 30], [60, 20], [150, 26], [176, 70], [18, 110], [182, 130], [48, 62]].forEach(function (p, i) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i % 2 ? 1.8 : 2.6) + '" fill="#fff6c9"/>'; });
      return '<rect width="200" height="200" fill="#26305e"/>' + s + '<circle cx="158" cy="44" r="14" fill="#fff3b8"/><circle cx="164" cy="40" r="12" fill="#26305e"/><ellipse cx="100" cy="208" rx="140" ry="36" fill="#1c2347"/>'; } },
    { id: "bg-strand", slot: "bg", name: "Strand", price: 35, view: "0 0 200 200", art: function () {
      return '<rect width="200" height="200" fill="#c6ebfa"/><rect y="96" width="200" height="40" fill="#5bc0e8"/><path d="M0,104 Q25,98 50,104 T100,104 T150,104 T200,104" fill="none" stroke="#9adcf3" stroke-width="3"/><ellipse cx="100" cy="206" rx="150" ry="62" fill="#f3dca4"/><circle cx="36" cy="40" r="15" fill="#ffe27a"/>'; } },
    { id: "bg-sno", slot: "bg", name: "Snö", price: 30, view: "0 0 200 200", art: function () {
      let s = "";
      [[28, 30], [70, 58], [120, 24], [160, 62], [40, 96], [176, 108], [92, 84]].forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="#fff"/>'; });
      return '<rect width="200" height="200" fill="#d6e8f7"/>' + s + '<ellipse cx="100" cy="208" rx="150" ry="44" fill="#fff"/><ellipse cx="170" cy="196" rx="50" ry="22" fill="#eef5fb"/>'; } },
    { id: "bg-tavla", slot: "bg", name: "Klassrummet", price: 40, view: "0 0 200 200", art: function () {
      return '<rect width="200" height="200" fill="#f4e6c8"/><rect x="18" y="16" width="164" height="86" rx="6" fill="#2f6b57" stroke="#a9773e" stroke-width="6"/>' +
        '<text x="100" y="68" text-anchor="middle" font-size="26" font-weight="800" font-family="Nunito, Arial, sans-serif" fill="#f4f1e8" opacity=".92">2 + 2 = 4</text><path d="M32,88 H70" stroke="#f4f1e8" stroke-width="2" opacity=".6"/>' +
        '<rect y="150" width="200" height="50" fill="#d9b779"/>'; } },
    { id: "bg-rymd", slot: "bg", name: "Rymden", price: 50, view: "0 0 200 200", art: function () {
      let s = "";
      [[20, 24], [72, 14], [128, 30], [182, 20], [30, 120], [176, 100], [58, 70], [150, 76]].forEach(function (p, i) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (i % 3 ? 1.5 : 2.4) + '" fill="#fff"/>'; });
      return '<rect width="200" height="200" fill="#1d1741"/>' + s + '<circle cx="158" cy="52" r="20" fill="#e0861f"/><ellipse cx="158" cy="52" rx="32" ry="7" fill="none" stroke="#f6c453" stroke-width="3" transform="rotate(-18 158 52)"/><circle cx="36" cy="46" r="9" fill="#76c0ec"/><ellipse cx="100" cy="212" rx="130" ry="36" fill="#3a2f74"/>'; } }
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
      return '<rect x="122" y="152" width="24" height="24" rx="6" fill="#fff" stroke="#c9d3e6" stroke-width="2"/><g fill="#2a2630"><circle cx="129" cy="159" r="2.4"/><circle cx="139" cy="159" r="2.4"/><circle cx="134" cy="164" r="2.4" fill="#e0506d"/><circle cx="129" cy="170" r="2.4"/><circle cx="139" cy="170" r="2.4"/></g>'; })
  ];
  ROOM_ITEMS.forEach(function (it) { ITEMS.push(it); });

  function isRoomSlot(slot) { return ROOM_SLOT_IDS.indexOf(slot) >= 0; }

  function item(id) {
    return ITEMS.find(function (i) { return i.id === id; }) || null;
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
      return it && it.slot === slot ? '<g transform="translate(0 ' + shift[slot] + ')">' + it.art() + '</g>' : "";
    };
    const body = kind === "cat" ? cat(c, mood) : kind === "penguin" ? penguin(c, mood) : dog(c, mood);
    return '<g class="pet-bob">' + body + part("neck") + part("face") + part("hat") + '</g>';
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
      (layer("wall") || WALL_DEFAULT) + FLOOR + layer("window") + layer("shelf") + layer("rug") + layer("bed") + layer("lamp") + layer("plant") + layer("toy") +
      '<ellipse cx="100" cy="177" rx="34" ry="5" fill="#000" opacity=".14"/></g>' +
      '<g transform="translate(25 38) scale(.75)">' + petLayers(pet, mood) + '</g>' + sparks + '</svg>';
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
      return it && it.slot === slot ? '<g transform="translate(0 ' + shift[slot] + ')">' + it.art() + '</g>' : "";
    };
    const bgItem = pet.bg && item(pet.bg);
    const bg = options.bare ? "" : (bgItem && bgItem.slot === "bg" ? bgItem.art() : FREE_BG);
    const body = kind === "cat" ? cat(c, mood) : kind === "penguin" ? penguin(c, mood) : dog(c, mood);
    const sparks = mood === "happy"
      ? '<g class="pet-sparks"><text class="pet-spark" x="46" y="60">✦</text><text class="pet-spark s2" x="150" y="52">✦</text><text class="pet-spark s3" x="100" y="26">♥</text></g>'
      : "";
    const label = options.label || (KINDS[kind].name + (pet.name ? " som heter " + pet.name : ""));
    return '<svg class="pet-svg pet-' + kind + (mood ? " is-" + mood : "") + '" viewBox="0 0 200 200" role="img" aria-label="' + label.replace(/[<>&"]/g, "") + '" xmlns="http://www.w3.org/2000/svg"' +
      (options.size ? ' width="' + options.size + '" height="' + options.size + '"' : "") + '>' +
      (options.bare ? "" : '<defs><clipPath id="' + clip + '"><rect width="200" height="200" rx="26"/></clipPath></defs><g clip-path="url(#' + clip + ')">' + bg + '<ellipse cx="100" cy="186" rx="48" ry="7" fill="#000" opacity=".12"/></g>') +
      petLayers(pet, mood) + sparks + '</svg>';
  }

  // an item on its own (shop shelves)
  function thumb(id) {
    const it = item(id);
    if (!it) return "";
    return '<svg class="pet-thumb" viewBox="' + it.view + '" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><g>' + it.art() + '</g></svg>';
  }

  // the head only, small, for the lesson footer
  function face(pet, mood) {
    const kind = KINDS[pet.kind] ? pet.kind : "dog";
    const s = svg({ kind: kind, color: pet.color, worn: { hat: (pet.worn || {}).hat, face: (pet.worn || {}).face }, bg: null, name: pet.name }, { mood: mood, bare: true });
    return s.replace(/<g class="pet-sparks">[\s\S]*?<\/g>/, "").replace('viewBox="0 0 200 200"', 'viewBox="40 14 120 110"');
  }

  return { KINDS: KINDS, ITEMS: ITEMS, SETS: SETS, ROOM_SLOTS: ROOM_SLOTS, isRoomSlot: isRoomSlot, item: item, colorOf: colorOf, svg: svg, thumb: thumb, face: face };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaPetArt;
