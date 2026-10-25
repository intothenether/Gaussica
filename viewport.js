// Follows the part of the screen that is actually visible, so the lesson player, the chat and the other
// full-screen boxes still fit when the on-screen keyboard is open on a phone.
//
// It writes on <html>:
//   --vv-h, --vv-top   height and top edge of the visible area (px). Full-screen boxes use them instead of 100%.
//   .is-keyboard       a text field has focus and the visible area is much smaller than before (the keyboard is up)
//   .is-short          the visible area is low (a phone held sideways), so the compact layout is used there too
// styles.css uses the two classes to make the lesson player compact. When the field that gets focus would end up
// behind the keyboard, it is scrolled into view.

(function () {
  "use strict";

  const root = document.documentElement;
  const vv = window.visualViewport;
  let baseline = 0;   // the visible height when no text field has focus: the height without the keyboard

  function textFieldFocused() {
    const a = document.activeElement;
    if (!a) return false;
    if (a.tagName === "TEXTAREA" || a.isContentEditable) return true;
    return a.tagName === "INPUT" && !/^(checkbox|radio|button|submit|reset|range|color|file|image)$/i.test(a.type);
  }

  function sync() {
    const h = vv ? vv.height : window.innerHeight;
    if (vv && vv.scale > 1.05) {   // pinch-zoomed: the visible area is not the screen, so leave the layout alone
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
      root.classList.remove("is-keyboard", "is-short");
      return;
    }
    const focused = textFieldFocused();
    if (!focused || !baseline) baseline = h;
    root.style.setProperty("--vv-h", Math.round(h) + "px");
    root.style.setProperty("--vv-top", Math.round(vv ? vv.offsetTop : 0) + "px");
    const keyboard = focused && baseline - h > 120;
    root.classList.toggle("is-keyboard", keyboard);
    root.classList.toggle("is-short", h < 480);
  }

  function reveal(target) {
    if (!target || !target.scrollIntoView || !target.closest(".player, .chat-overlay, .fb-overlay, .auth-screen")) return;
    const inMain = Boolean(target.closest(".pl-main"));
    setTimeout(function () {
      if (document.activeElement === target) target.scrollIntoView({ block: inMain ? "center" : "nearest", behavior: "smooth" });
    }, 320);   // after the keyboard has slid up
  }

  if (vv) {
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
  }
  window.addEventListener("resize", sync);
  window.addEventListener("orientationchange", function () { baseline = 0; setTimeout(sync, 250); });
  document.addEventListener("focusin", function (e) { sync(); reveal(e.target); });
  document.addEventListener("focusout", function () { setTimeout(sync, 80); });
  sync();

  window.GaussicaViewport = { sync: sync };
}());
