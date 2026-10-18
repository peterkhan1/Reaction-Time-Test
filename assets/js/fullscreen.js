/* Optional fullscreen for every test, using the standard Fullscreen API.
   - Only the player decides: nothing goes fullscreen unless the fullscreen button is pressed.
   - If the browser refuses, the game just carries on in the normal layout.
   - Esc (browser-controlled) always exits; the session is never reset by a fullscreen change. */
(() => {
  const A = document.getElementById("arena");
  if(!A || !window.RT) return;
  const d = document;
  const req = A.requestFullscreen || A.webkitRequestFullscreen;
  const ex = d.exitFullscreen || d.webkitExitFullscreen;
  const ok = !!(req && (d.fullscreenEnabled || d.webkitFullscreenEnabled));
  const cur = () => d.fullscreenElement || d.webkitFullscreenElement;
  const isFs = () => cur() === A;
  const fs = RT.fs = { supported: ok, changed: -1e9, active: isFs, enter, exit };

  const btn = d.createElement("button");
  btn.type = "button"; btn.className = "fs-btn"; btn.hidden = !ok;
  btn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="in" d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/><path class="out" d="M7 3v4H3M17 7h-4V3M13 17v-4h4M3 13h4v4"/></svg><span></span>';
  A.appendChild(btn);
  const paint = () => {
    const on = isFs();
    btn.setAttribute("aria-label", on ? "Exit fullscreen" : "Enter fullscreen");
    btn.querySelector("span").textContent = on ? "Exit fullscreen" : "Fullscreen";
    A.classList.toggle("is-fs", on);
    d.documentElement.classList.toggle("rt-fs", on);
  };
  function enter(){
    if(!ok || isFs()) return;
    try {
      const p = req.call(A, { navigationUI: "hide" });
      if(p && p.catch) p.catch(() => {});
    } catch(e){}
  }
  function exit(){ if(isFs() && ex) { try { const p = ex.call(d); if(p && p.catch) p.catch(() => {}); } catch(e){} } }

  const onChange = () => {
    fs.changed = performance.now(); paint();
    try { A.focus({ preventScroll: true }); } catch(e){}
  };
  d.addEventListener("fullscreenchange", onChange);
  d.addEventListener("webkitfullscreenchange", onChange);
  d.addEventListener("fullscreenerror", paint);

  /* the button must not count as a tap on the game */
  btn.addEventListener("pointerdown", e => e.stopPropagation());
  btn.addEventListener("click", e => { e.stopPropagation(); isFs() ? exit() : enter(); });
  paint();
})();
