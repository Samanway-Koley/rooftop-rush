/* Rooftop Rush boot watchdog (plain script, no modules).
   If game.js never boots, say exactly why instead of spinning forever. */
(function () {
  'use strict';
  function show(msg) {
    try {
      var ld = document.getElementById('loader');
      if (!ld || ld.classList.contains('hide')) return;
      var el = document.getElementById('ld-err');
      if (!el || el.textContent) return;
      el.classList.add('on');
      el.textContent = msg;
    } catch (e) {}
  }
  function styled() {
    try { return getComputedStyle(document.getElementById('loader')).position === 'absolute'; }
    catch (e) { return true; }
  }
  setTimeout(function () {
    if (window.game) return;
    if (!window.__rrGameScriptLoaded) {
      show('game.js was not found. Keep index.html, styles.css, game.js and boot-check.js together in the same rooftop-rush folder.');
      return;
    }
    show(styled()
      ? 'The 3D engine could not finish loading. Check that cdn.jsdelivr.net is reachable, then reload.'
      : 'styles.css was not found. Keep every Rooftop Rush file in the same folder.');
  }, 20000);
})();
