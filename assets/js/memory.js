/* Memory tests: Sequence, Number, Visual. Three lives each. Input is only accepted in the "input" phase,
   so nothing can be played during feedback or after the run has ended. */
(() => {
  const $ = id => document.getElementById(id);
  const A = $("arena"), stage = $("stage"), status = $("memStatus"), hearts = $("hearts"), lvlEl = $("memLvl"), lvlLab = $("memLvlLab"), pbEl = $("pb");
  const MODES = {
    sequence: { name: "Sequence", unit: "LEVEL", help: "Watch the tiles light up, then repeat the order. Each level adds one more step." },
    number:   { name: "Number",   unit: "DIGITS", help: "A number flashes on screen. Remember it and type it back. Each level adds a digit." },
    visual:   { name: "Visual",   unit: "LEVEL", help: "Memorise which tiles light up, then tap them all. The grid grows as you go." }
  };
  const LIVES = 3;
  let mode = RT.store.get("mem:mode", "sequence"); if(!MODES[mode]) mode = "sequence";
  let state = "ready", phase = "idle";            /* phase: idle | show | input | feedback | over */
  let level = 1, lives = LIVES, timers = [], gen = 0, started = 0, last = null, lastEnd = 0, sizes = [], hitsOk = 0, hitsAll = 0;
  let seq = [], pos = 0, pads = [], target = new Set(), found = new Set(), numAns = "", numInput = null;

  const later = (fn, ms) => { const my = gen, id = setTimeout(() => { timers = timers.filter(x => x !== id); if(my === gen) fn(); }, ms); timers.push(id); return id; };
  const clearAll = () => { timers.forEach(clearTimeout); timers = []; gen++; };
  const setState = s => { state = s; A.dataset.state = s; RT.lock(s === "run"); };
  const pbKey = () => `mem:best:${mode}`;
  const say = (t, cls) => { status.textContent = t; status.className = "mem-status" + (cls ? " " + cls : ""); };
  const live = () => state === "run" && phase === "input";

  function paintReady(){
    document.querySelectorAll("#modeSeg button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.mode === mode)));
    $("rHelp").textContent = MODES[mode].help + " Three lives.";
    const pb = RT.store.get(pbKey(), null);
    pbEl.textContent = pb ? `Best ${pb} ${MODES[mode].unit.toLowerCase()} · ${MODES[mode].name}` : `No best yet · ${MODES[mode].name}`;
    A.setAttribute("aria-label", `${MODES[mode].name} memory test. Click to begin`);
  }
  function paintHud(){
    lvlEl.textContent = level; lvlLab.textContent = mode === "number" ? "Digits" : "Level";
    hearts.textContent = ""; for(let i = 0; i < LIVES; i++){ const h = document.createElement("i"); if(i >= lives) h.className = "off"; hearts.appendChild(h); }
  }

  /* ---------- tile grids ---------- */
  function grid(n){
    stage.textContent = ""; pads = [];
    const gap = 10, byW = Math.floor((Math.min(380, A.clientWidth - 40) - gap * (n - 1)) / n), byH = Math.floor((290 - gap * (n - 1)) / n);
    const ps = Math.max(34, Math.min(76, byW, byH));
    const g = document.createElement("div"); g.className = "pads"; g.style.setProperty("--n", n); g.style.setProperty("--ps", ps + "px"); g.style.setProperty("--gap", gap + "px");
    for(let i = 0; i < n * n; i++){
      const b = document.createElement("button"); b.type = "button"; b.className = "pad"; b.setAttribute("aria-label", `Tile ${i + 1}`);
      b.addEventListener("pointerdown", ev => { ev.stopPropagation(); if(ev.pointerType === "mouse" && ev.button !== 0) return; ev.preventDefault(); onPad(i); });
      b.addEventListener("keydown", ev => { if(ev.key === "Enter" || ev.code === "Space"){ ev.preventDefault(); ev.stopPropagation(); if(!ev.repeat) onPad(i); } });
      b.addEventListener("click", ev => ev.preventDefault());
      g.appendChild(b); pads.push(b);
    }
    stage.appendChild(g); lockPads(true);
  }
  const lockPads = on => pads.forEach(p => { p.disabled = on; p.tabIndex = on ? -1 : 0; });
  const flash = (i, cls, ms) => { const p = pads[i]; if(!p) return; p.classList.add(cls); later(() => p.classList.remove(cls), ms); };
  const clearPads = () => pads.forEach(p => { p.className = "pad"; });

  /* ---------- levels ---------- */
  function startLevel(fresh){
    if(state !== "run") return;
    paintHud();
    if(mode === "sequence") levelSequence(fresh);
    else if(mode === "number") levelNumber();
    else levelVisual();
  }
  function levelSequence(fresh){
    if(!pads.length) grid(3);
    if(fresh || seq.length !== level){ seq = []; for(let i = 0; i < level; i++){ let p; do { p = Math.floor(Math.random() * 9); } while(i && p === seq[i - 1]); seq.push(p); } }
    pos = 0; phase = "show"; lockPads(true); clearPads(); say("Watch…");
    const step = Math.max(300, 520 - level * 12);
    seq.forEach((p, i) => later(() => flash(p, "lit", step * .7), 700 + i * step));
    later(() => { phase = "input"; lockPads(false); say("Your turn"); }, 700 + seq.length * step + 120);
  }
  function levelVisual(){
    const n = level <= 2 ? 3 : level <= 5 ? 4 : level <= 9 ? 5 : 6, count = Math.min(level + 2, Math.floor(n * n * .55));
    phase = "show"; grid(n); say("Memorise…"); target = new Set(); found = new Set();
    while(target.size < count) target.add(Math.floor(Math.random() * n * n));
    later(() => target.forEach(i => pads[i].classList.add("lit")), 600);
    later(() => { clearPads(); phase = "input"; lockPads(false); say("Tap the tiles"); }, 600 + 900 + count * 130);
  }
  function levelNumber(){
    phase = "show"; stage.textContent = "";
    let s = String(1 + Math.floor(Math.random() * 9)); while(s.length < level) s += Math.floor(Math.random() * 10);
    numAns = s; say("Remember this");
    const show = document.createElement("div"); show.className = "num-show"; show.textContent = s;
    const bar = document.createElement("div"); bar.className = "num-bar"; const fill = document.createElement("i"); bar.appendChild(fill);
    stage.append(show, bar);
    const ms = 900 + level * 650; fill.style.transition = `transform ${ms}ms linear`;
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.transform = "scaleX(0)"; }));
    later(askNumber, ms);
  }
  function askNumber(){
    stage.textContent = ""; say("What was the number?"); phase = "input";
    const f = document.createElement("form"); f.className = "num-form"; f.autocomplete = "off";
    const inp = document.createElement("input"); inp.className = "num-in"; inp.inputMode = "numeric"; inp.pattern = "[0-9]*"; inp.maxLength = 14; inp.setAttribute("aria-label", "Type the number you saw");
    const go = document.createElement("button"); go.type = "submit"; go.className = "btn-main"; go.textContent = "Check";
    f.append(inp, go); stage.appendChild(f); numInput = inp;
    f.addEventListener("pointerdown", ev => ev.stopPropagation());
    inp.addEventListener("input", () => { inp.value = inp.value.replace(/\D/g, ""); });
    f.addEventListener("submit", ev => { ev.preventDefault(); if(!live()) return; const v = inp.value.trim(); if(v) judgeNumber(v); });
    setTimeout(() => { if(live()) inp.focus({ preventScroll: true }); }, 30);
  }
  function judgeNumber(v){
    phase = "feedback"; hitsAll++; const ok = v === numAns; if(ok) hitsOk++;
    stage.textContent = ""; numInput = null;
    const c = document.createElement("div"); c.className = "num-cmp";
    c.innerHTML = `Number <b>${numAns}</b><br>You typed <b>${v}</b>`;
    stage.appendChild(c);
    resolve(ok);
  }

  /* ---------- input ---------- */
  function onPad(i){
    if(!live() || mode === "number") return;
    if(mode === "sequence"){
      hitsAll++;
      if(i === seq[pos]){ hitsOk++; flash(i, "ok", 220); pos++; if(pos >= seq.length){ phase = "feedback"; lockPads(true); resolve(true); } }
      else { phase = "feedback"; lockPads(true); flash(i, "bad", 500); flash(seq[pos], "lit", 700); resolve(false); }
    } else {
      if(found.has(i)) return; hitsAll++;
      if(target.has(i)){ hitsOk++; found.add(i); pads[i].classList.add("ok"); if(found.size === target.size){ phase = "feedback"; lockPads(true); resolve(true); } }
      else { phase = "feedback"; lockPads(true); pads[i].classList.add("bad"); target.forEach(t => { if(!found.has(t)) pads[t].classList.add("lit"); }); resolve(false); }
    }
  }

  function resolve(ok){
    if(ok){ sizes.push(level); say(mode === "number" ? "Correct" : "Nice", "good"); level++; later(() => startLevel(true), mode === "number" ? 1100 : 750); return; }
    lives--; paintHud();
    if(lives <= 0){ phase = "over"; lockPads(true); stage.classList.add("over"); say("Game over", "bad"); later(finish, 800); return; }
    say(lives === 1 ? "Wrong. One life left" : "Wrong. Try this level again", "bad");
    later(() => startLevel(mode !== "sequence"), 1500);
  }

  /* ---------- flow ---------- */
  function begin(){
    clearAll(); stage.classList.remove("over"); level = 1; lives = LIVES; sizes = []; hitsOk = hitsAll = 0; seq = []; pads = []; stage.textContent = ""; started = performance.now();
    A.scrollIntoView({ block: "nearest" });
    setState("run"); phase = "show"; startLevel(true);
  }
  function finish(){
    if(state !== "run") return;
    clearAll(); phase = "idle"; lockPads(true); stage.classList.remove("over"); stage.textContent = ""; pads = [];
    const reached = Math.max(0, level - 1), secs = Math.round((performance.now() - started) / 1000);
    const prev = RT.store.get(pbKey(), null), newBest = prev !== null && reached > prev;
    if(prev === null || reached > prev) RT.store.set(pbKey(), reached);
    const tier = reached >= 10 ? "Excellent" : reached >= 7 ? "Good" : reached >= 5 ? "Average" : "Keep practising";
    const acc = hitsAll ? Math.round(hitsOk / hitsAll * 100) : 0;
    last = { reached, name: MODES[mode].name, unit: MODES[mode].unit };
    $("rKick").textContent = `${MODES[mode].name} memory test`;
    $("rNum").textContent = reached; $("rUnit").textContent = MODES[mode].unit; $("rBest").hidden = !newBest; $("rTier").textContent = tier;
    $("tA").textContent = hitsAll ? acc + "%" : "—";
    $("tB").textContent = prev === null ? reached : Math.max(prev, reached);
    $("tC").textContent = secs + "s"; $("tD").textContent = LIVES + " / " + LIVES;
    RT.bars.build($("rBars"), Math.max(1, sizes.length)); RT.bars.paint($("rBars"), sizes.length ? sizes : [0], sizes.length - 1);
    if(reached > 0 || hitsAll > 0){
      RT.analysis.add({ t: Date.now(), n: reached, kick: `${MODES[mode].name} memory test`, value: reached, unit: MODES[mode].unit.toLowerCase(), tier,
        tiles: [[hitsAll ? acc + "%" : "—", "Accuracy"], [Math.max(prev === null ? 0 : prev, reached), "Your best"], [secs + "s", "Time played"], [sizes.length ? sizes.length : 0, "Levels cleared"]],
        scale: { title: "Memory scale", note: "A simple site benchmark. Most people reach around 5 to 8.", pos: reached / 15, text: reached + " " + MODES[mode].unit.toLowerCase(), ticks: ["0", "5", "10", "15+"] },
        bars: { title: mode === "number" ? "Digits per level" : mode === "sequence" ? "Steps per level" : "Level reached", note: "Each bar is a level you cleared.", vals: sizes.length ? sizes.slice() : [0], labels: sizes.map(String), best: sizes.length - 1 },
        row: [MODES[mode].name, reached + " " + MODES[mode].unit.toLowerCase(), hitsAll ? acc + "%" : "—", secs + "s", tier] });
    }
    setState("result"); lastEnd = performance.now();
    A.classList.add("lock"); setTimeout(() => A.classList.remove("lock"), 700);
    paintReady();
  }
  function toReady(){ clearAll(); stage.classList.remove("over"); phase = "idle"; stage.textContent = ""; pads = []; numInput = null; setState("ready"); paintReady(); A.focus({ preventScroll: true }); }

  $("modeSeg").addEventListener("click", ev => { const b = ev.target.closest("button"); if(!b) return; mode = b.dataset.mode; RT.store.set("mem:mode", mode); paintReady(); A.focus({ preventScroll: true }); });
  RT.arena.guard(A);
  A.addEventListener("pointerdown", ev => { if(state === "ready" && (ev.pointerType !== "mouse" || ev.button === 0)) begin(); });
  document.addEventListener("keydown", ev => {
    if(ev.key === "Escape"){ if(state === "run") toReady(); return; }
    if(ev.code !== "Space" && ev.key !== "Enter") return;
    const onA = RT.arena.target(A), tag = (document.activeElement || {}).tagName || "";
    if(!onA && RT.arena.INTERACTIVE.test(tag)) return;
    if(!onA && state !== "run") return;
    if(ev.repeat){ if(onA) ev.preventDefault(); return; }
    if(state === "result"){ if(onA && performance.now() - lastEnd > 700){ ev.preventDefault(); toReady(); } return; }
    if(state === "ready" && onA){ ev.preventDefault(); begin(); }
    else if(state === "run" && ev.code === "Space") ev.preventDefault();
  });
  $("reset").addEventListener("click", toReady);
  $("again").addEventListener("click", toReady);
  $("share").addEventListener("click", async ev => {
    if(!last) return; const b = ev.currentTarget; b.disabled = true;
    await RT.share({ value: String(last.reached), unit: last.unit, sub: `${last.name} memory test`,
      text: `I reached ${last.unit.toLowerCase()} ${last.reached} on the ${last.name.toLowerCase()} memory test. Can you beat it?`, url: location.href.split("#")[0], file: `memory-${last.reached}.png`, site: location.host });
    b.disabled = false;
  });
  RT.analysis.init({ key: "memory", heads: ["Game", "Reached", "Accuracy", "Time", "Rating"], trend: "Level", tip: "Chunk what you see into small groups and say it quietly to yourself." });
  paintReady();
})();
