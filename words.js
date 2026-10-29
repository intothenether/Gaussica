// Words for families. The pages say "lärare", "elev" and "klass". For a caregiver (vårdnadshavare) they say vårdnadshavare, barn and
// familj, and for a child whose guide is a caregiver "din lärare" becomes "din vårdnadshavare". The words are changed on the parts of the
// pages that are the site talking (the teacher view, the messages, the account, the pet's talk). The lessons, the answers and what people
// have written are never changed.
//
//   GaussicaWords.setMode("caregiver" | "family" | null)   the mode follows the signed-in user (see app.js)
//   GaussicaWords.t(text, mode)                            the changed text (used by the tests)

window.GaussicaWords = (function () {
  "use strict";

  // The parts of the pages where the words are changed, and what is left alone inside them.
  const PLACES = "#admin-page, #admin-top-link, .footer-admin-link, #view-switch, #preview-banner, #student-modal, .student-profile-bar, #chat-link, " +
    ".chat-overlay, #mailbox, .mb-banner, .mb-inline, .pl-top-actions, #pet-overlay, .hp-bubble, .pet-bubble, .pet-toast, .tv-notice";
  const LEFT_ALONE = "textarea, input, script, style, code, pre, svg, canvas, .chat-text, .tv-chat-text, .tv-assign-note, .tv-sent-text, .mb-text, " +
    ".mb-banner-note, .tv-userline, .tv-help-prompt, .tv-help-list strong, .tv-prompt, .tv-try-answer, .tv-diagnosis, .tv-correct strong, .tv-task-top strong, [data-user-text]";

  const L = "(?<![\\p{L}\\p{N}])";           // not in the middle of a word
  const R = "(?![\\p{L}\\p{N}])";
  const cache = {};

  // [from, to]: whole words, the case of the first letter kept
  function word(from, to) { return { re: new RegExp(L + from + R, "giu"), to: to }; }
  const TEACHER = [word("läraren", "vårdnadshavaren"), word("lärarens", "vårdnadshavarens"), word("lärare", "vårdnadshavare"), word("lärarna", "vårdnadshavarna")];
  const CLASS = [word("dina klasser", "din familj"), word("klassen", "familjen"), word("klasser", "familjer"), word("klass", "familj"),
    word("klasskoden", "familjekoden"), word("klasskod", "familjekod"), word("klassöversikt", "översikt"), word("klasslistan", "familjelistan")];
  const STUDENT = [
    word("en enskild elev", "ett enskilt barn"), word("en elev", "ett barn"), word("enskild elev", "enskilt barn"), word("enskilda elever", "enskilda barn"), word("den eleven", "det barnet"),
    word("denna elev", "detta barn"), word("elevernas", "barnens"), word("eleverna", "barnen"), word("elevens", "barnets"), word("eleven", "barnet"),
    word("elever", "barn"), word("elev", "barn"),
    word("elevkonto", "barnkonto"), word("elevkonton", "barnkonton"), word("elevsvar", "barnens svar"), word("elevdata", "barnens data"), word("elevvy", "barnvy")
  ];
  const RULES = {
    // the adult: a caregiver sees barn and familj where a teacher sees elever and klasser
    caregiver: [word("lärarvy", "Mina barn")].concat(STUDENT, CLASS, TEACHER),
    // the child of a caregiver: the one to ask is a vårdnadshavare
    family: CLASS.concat(TEACHER)
  };

  function same(from, to) {
    if (!from) return to;
    const first = from.charAt(0);
    return first !== first.toLowerCase() && first === first.toUpperCase() ? to.charAt(0).toUpperCase() + to.slice(1) : to;
  }

  function t(text, mode) {
    const rules = RULES[mode];
    if (!rules || !text) return text;
    let out = String(text);
    rules.forEach(function (r) { out = out.replace(r.re, function (m) { return same(m, r.to); }); });
    return out;
  }

  // ----- the pages: changed when the mode is set, and again for whatever is added or changed later -----
  let mode = null;
  let observer = null;
  const ATTRS = ["aria-label", "title", "placeholder"];

  function inPlace(node) {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return Boolean(el && el.closest && el.closest(PLACES) && !el.closest(LEFT_ALONE));
  }

  function fixText(node) {
    if (!inPlace(node)) return;
    const now = t(node.nodeValue, mode);
    if (now !== node.nodeValue) node.nodeValue = now;
  }

  function fixAttrs(el) {
    if (!inPlace(el)) return;
    ATTRS.forEach(function (a) {
      const v = el.getAttribute(a);
      if (!v) return;
      const now = t(v, mode);
      if (now !== v) el.setAttribute(a, now);
    });
  }

  function walk(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1) return;
    // a whole subtree outside the places is skipped, unless a place is inside it
    const within = root.closest && root.closest(PLACES);
    if (!within && !(root.querySelector && root.querySelector(PLACES))) return;
    fixAttrs(root);
    const it = document.createTreeWalker(root, 4 | 1);   // text and elements
    let n = it.nextNode();
    while (n) {
      if (n.nodeType === 3) fixText(n); else fixAttrs(n);
      n = it.nextNode();
    }
  }

  function setMode(next) {
    mode = RULES[next] ? next : null;
    if (observer) { observer.disconnect(); observer = null; }
    if (!mode || typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    walk(document.body);
    observer = new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === "childList") m.addedNodes.forEach(walk);
        else if (m.type === "characterData") fixText(m.target);
        else if (m.type === "attributes") fixAttrs(m.target);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  return { setMode: setMode, t: t, mode: function () { return mode; } };
}());

if (typeof module !== "undefined") module.exports = window.GaussicaWords;
