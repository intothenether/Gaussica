// The tip after a wrong answer, in the middle of the screen. A line at the bottom is easy to skip for a student who does not read everything,
// so the tip comes in a box that stays until the student has pressed the button (or Esc), and then the student answers again. The same tip
// stays in the bottom bar afterwards, for the moment when the answer is being changed.
//
//   GaussicaTip.show(host, { source, lead, extra, onClose })   host: where the box goes (the player), source: the element with the tip (copied),
//                                                          lead: a line of text above the tip, extra: [{ label, onClick }] more buttons (a worked
//                                                          example, the explanation of the lesson), onClose(): the focus goes back
//   GaussicaTip.close()                                  closes it (a new question, the player closed)
//   GaussicaTip.isOpen()
//
// It is a dialog: the focus goes to the button, Tab stays in the box, Esc closes it. Clicking beside it does not, so that a tap on the wrong place
// does not make it vanish unread.

(function (root) {
  "use strict";

  let open = null;   // { overlay, onClose, opener }

  function make(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function isOpen() { return Boolean(open); }

  function close(silently) {
    if (!open) return;
    const done = open;
    open = null;
    done.overlay.remove();
    if (!silently && done.onClose) done.onClose();
  }

  // The student's pet looks at the tip with its head on one side; without a pet it is a light bulb.
  function icon() {
    try {
      const P = window.GaussicaPet, A = window.GaussicaPetArt;
      const pet = P && P.current ? P.current() : null;
      const markup = pet && A && A.svg ? A.svg(pet, { bare: true, label: "" }) : "";
      if (markup) {
        const span = make("span", "tip-icon tip-pet");
        span.setAttribute("aria-hidden", "true");
        span.innerHTML = markup;
        return span;
      }
    } catch (e) { /* no pet: the bulb */ }
    return make("span", "tip-icon", "💡");
  }

  function show(host, opts) {
    opts = opts || {};
    const source = opts.source;
    if (!host || !source || !source.firstChild) return null;
    close(true);

    const overlay = make("div", "tip-overlay");
    const box = make("div", "tip-box");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "tip-title");
    const head = make("div", "tip-head");
    head.appendChild(icon());
    const title = make("h2", "tip-title", "Inte riktigt, läs tipset");
    title.id = "tip-title";
    head.appendChild(title);

    // the tip itself, as it is in the bottom bar (the text with its marks, the badge of a pattern that was found)
    const body = make("div", "tip-body");
    if (opts.lead) body.appendChild(make("p", "tip-lead", opts.lead));
    Array.from(source.childNodes).forEach(function (n) { body.appendChild(n.cloneNode(true)); });

    const actions = make("div", "tip-actions");
    const again = make("button", "primary-button tip-again", "Jag har läst tipset, prova igen");
    again.type = "button";
    again.addEventListener("click", function () { close(); });
    (opts.extra || []).forEach(function (x) {
      const b = make("button", "tip-extra", x.label);
      b.type = "button";
      b.addEventListener("click", function () { close(true); if (opts.onClose) opts.onClose(true); x.onClick(); });
      actions.appendChild(b);
    });
    actions.appendChild(again);

    box.append(head, body, actions);
    overlay.appendChild(box);
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(); return; }
      if (e.key === "Tab") {   // the focus stays in the box
        const items = Array.from(box.querySelectorAll("button"));
        const at = items.indexOf(document.activeElement);
        if (!items.length) return;
        e.preventDefault();
        items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    });
    host.appendChild(overlay);
    open = { overlay: overlay, onClose: opts.onClose };
    again.focus({ preventScroll: true });
    return { close: close };
  }

  const api = { show: show, close: close, isOpen: isOpen };
  root.GaussicaTip = api;
  if (typeof module !== "undefined") module.exports = api;
}(typeof window !== "undefined" ? window : globalThis));
