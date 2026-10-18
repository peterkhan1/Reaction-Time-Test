/* Typing speed test — our own engine. Timed, live WPM, results + analysis inside the arena. */
(() => {
  const $ = id => document.getElementById(id);
  const A = $("arena"), input = $("tyIn"), wordsEl = $("words"), wrap = $("wordsWrap"), caret = $("caret"), prog = $("prog"), pbEl = $("pb");
  const WORDS = ("the of and to a in is it you that he was for on are with as his they be at one have this from or had by hot word but what some we can out other were all there when up use your how said an each she which do their time if will way about many then them write would like so these her long make thing see him two has look more day could go come did number sound no most people my over know water than call first who may down side been now find any new work part take get place made live where after back little only round man year came show every good me give our under name very through just form sentence great think say help low line differ turn cause much mean before move right boy old too same tell does set three want air well also play small end put home read hand port large spell add even land here must big high such follow act why ask men change went light kind off need house picture try us again animal point mother world near build self earth father head stand own page should country found answer school grow study still learn plant cover food sun four between state keep eye never last let thought city tree cross farm hard start might story saw far sea draw left late run while press close night real life few north open seem together next white children begin got walk example ease paper group always music those both mark often letter until mile river car feet care second book carry took science eat room friend began idea fish mountain stop once base hear horse cut sure watch color face wood main enough plain girl usual young ready above ever red list though feel talk bird soon body dog family direct pose leave song measure door product black short numeral class wind question happen complete ship area half rock order fire south problem piece told knew pass since top whole king space heard best hour better true during hundred five remember step early hold west ground interest reach fast verb sing listen six table travel less morning ten simple several vowel toward war lay against pattern slow center love person money serve appear road map rain rule govern pull cold notice voice unit power town fine certain fly fall lead cry dark machine note wait plan figure star box noun field rest correct able pound done beauty drive stood contain front teach week final gave green oh quick develop ocean warm free minute strong special mind behind clear tail produce fact street inch multiply nothing course stay wheel full force blue object decide surface deep moon island foot system busy test record boat common gold possible plane stead dry wonder laugh thousand ago ran check game shape equate hot miss brought heat snow tire bring yes distant fill east paint language among").split(" ");
  const DURS = [15, 30, 60, 120];
  /* Benchmarks are rough. Dhakal et al. 2018 (168,960 typists): mean 51.6 WPM, SD 20.2 */
  const TIERS = [[0, "Beginner"], [25, "Below average"], [40, "Average"], [55, "Good"], [70, "Fast"], [90, "Very fast"], [120, "Elite"]];

  let cfg = Object.assign({ dur: 30, punct: false }, RT.store.get("ty:cfg", {}));
  if(DURS.indexOf(cfg.dur) < 0) cfg.dur = 30;
  let state = "ready", words = [], els = [], idx = 0, typedWords = [], cur = "", t0 = 0, raf = 0, lastEnd = 0, last = null, lh = 46;
  let keysOk = 0, keysBad = 0, charsOk = 0, secChars = [], extraChars = 0;

  const pbKey = () => `ty:best:${cfg.dur}:${cfg.punct ? "p" : "w"}`;

  function gen(){
    const n = Math.max(120, Math.round(cfg.dur * 4)), out = []; let prevW = "", cap = true;
    for(let i = 0; i < n; i++){
      let w; do { w = WORDS[Math.floor(Math.random() * WORDS.length)]; } while(w === prevW);
      prevW = w;
      if(cfg.punct){
        if(cap){ w = w[0].toUpperCase() + w.slice(1); cap = false; }
        const r = Math.random();
        if(r < .09){ w += "."; cap = true; } else if(r < .17) w += ","; else if(r < .2) w += "?";
        if(w.endsWith("?")) cap = true;
      }
      out.push(w);
    }
    return out;
  }

  function paintCfg(){
    document.querySelectorAll("#durSeg button").forEach(b => b.setAttribute("aria-checked", String(+b.dataset.dur === cfg.dur)));
    $("punct").setAttribute("aria-pressed", String(cfg.punct));
    const b = RT.store.get(pbKey(), null);
    pbEl.textContent = b ? `Best ${b} WPM · ${cfg.dur}s` : `No best yet · ${cfg.dur}s`;
    $("tyTime").textContent = cfg.dur;
  }

  function build(){
    words = gen(); wordsEl.textContent = ""; els = [];
    words.forEach(w => {
      const s = document.createElement("span"); s.className = "w";
      for(const ch of w){ const l = document.createElement("span"); l.className = "l"; l.textContent = ch; s.appendChild(l); }
      wordsEl.appendChild(s); els.push(s);
    });
    wordsEl.appendChild(caret);
    wordsEl.style.transform = "translateY(0)";
    lh = parseFloat(getComputedStyle(wordsEl).lineHeight) || 46;
    wrap.style.setProperty("--lh", lh + "px");
    idx = 0; cur = ""; typedWords = []; input.value = "";
    placeCaret();
  }

  function setState(s){ state = s; A.dataset.state = s; RT.lock(s === "run"); }

  function placeCaret(){
    const w = els[idx]; if(!w) return;
    const letters = w.querySelectorAll(".l:not(.extra)");
    let x, y;
    if(cur.length < letters.length){ const l = letters[cur.length]; x = l.offsetLeft; y = l.offsetTop; }
    else { const l = w.lastElementChild; x = l.offsetLeft + l.offsetWidth; y = l.offsetTop; }
    caret.style.transform = `translate(${x}px,${y}px)`;
    const base = els[0].offsetTop, row = Math.round((w.offsetTop - base) / lh);
    wordsEl.style.transform = `translateY(${-Math.max(0, row - 1) * lh}px)`;
  }

  function paintWord(i, typed, active){
    const w = els[i], target = words[i];
    w.querySelectorAll(".extra").forEach(e => e.remove());
    const letters = w.querySelectorAll(".l");
    letters.forEach((l, k) => { l.className = "l" + (k < typed.length ? (typed[k] === target[k] ? " ok" : " bad") : ""); });
    for(let k = target.length; k < typed.length; k++){ const e = document.createElement("span"); e.className = "l extra bad"; e.textContent = typed[k]; w.appendChild(e); }
    w.classList.toggle("err", !active && typed !== target);
  }

  /* ---------- run ---------- */
  function start(){
    t0 = performance.now(); keysOk = keysBad = charsOk = extraChars = 0; secChars = new Array(cfg.dur).fill(0);
    A.scrollIntoView({ block: "nearest" });
    setState("run"); raf = requestAnimationFrame(loop);
  }
  const correctChars = () => {
    let c = 0;
    for(let i = 0; i < typedWords.length; i++){ if(typedWords[i] === words[i]) c += words[i].length + 1; }
    for(let k = 0; k < cur.length; k++) if(cur[k] === (words[idx] || "")[k]) c++;
    return c;
  };
  const rawChars = () => typedWords.reduce((s, w) => s + w.length + 1, 0) + cur.length;
  function loop(){
    const el = performance.now() - t0, total = cfg.dur * 1000;
    if(el >= total){ finish(); return; }
    prog.style.transform = `scaleX(${el / total})`;
    $("tyTime").textContent = Math.ceil((total - el) / 1000);
    const min = Math.max(el, 2500) / 60000;
    $("tyWpm").textContent = Math.round(correctChars() / 5 / min);
    const k = keysOk + keysBad; $("tyAcc").textContent = k ? Math.round(keysOk / k * 100) : 100;
    raf = requestAnimationFrame(loop);
  }

  function commit(){
    if(!cur) return;
    const ok = cur === words[idx];
    keysOk += ok ? 1 : 0; keysBad += ok ? 0 : 1; /* the space itself */
    typedWords.push(cur); paintWord(idx, cur, false);
    idx++; cur = ""; input.value = ""; placeCaret();
  }

  input.addEventListener("input", () => {
    if(state === "result") { input.value = ""; return; }
    let v = input.value;
    if(state === "ready" && v.trim()) start();
    if(state !== "run"){ input.value = ""; return; }
    const sp = v.indexOf(" ");
    let tail = "";
    if(sp >= 0){ tail = v.slice(sp + 1); v = v.slice(0, sp); }
    /* keystroke accuracy: compare newly added chars */
    if(v.length > cur.length){
      for(let k = cur.length; k < v.length; k++){
        const ok = v[k] === (words[idx] || "")[k];
        ok ? keysOk++ : keysBad++;
        if(k >= (words[idx] || "").length) extraChars++;
        const s = Math.min(cfg.dur - 1, Math.floor((performance.now() - t0) / 1000)); secChars[s]++;
      }
    }
    cur = v.slice(0, (words[idx] || "").length + 12);
    if(sp >= 0){ if(cur){ commit(); } input.value = tail; cur = tail; if(tail) paintWord(idx, cur, true); }
    else { input.value = cur; }
    paintWord(idx, cur, true); placeCaret();
    if(idx >= words.length) finish();
  });

  input.addEventListener("keydown", ev => {
    if(ev.key === "Tab"){ ev.preventDefault(); toReady(true); return; }
    if(ev.key === "Escape"){ ev.preventDefault(); if(state === "run") toReady(false); return; }
    if(ev.key === "Enter" && state === "result"){ ev.preventDefault(); toReady(true); return; }
    if(ev.key === "Backspace" && state === "run" && !input.value && idx > 0 && typedWords[idx - 1] !== words[idx - 1]){
      ev.preventDefault();
      idx--; const prev = typedWords.pop(); cur = prev; input.value = prev;
      els[idx].classList.remove("err"); paintWord(idx, cur, true); placeCaret();
    }
  });
  input.addEventListener("focus", () => A.classList.remove("blurred"));
  input.addEventListener("blur", () => { if(state !== "result") A.classList.add("blurred"); });

  /* ---------- result ---------- */
  function finish(){
    cancelAnimationFrame(raf);
    const mins = cfg.dur / 60, ok = correctChars();
    const wpm = Math.round(ok / 5 / mins), raw = Math.round(rawChars() / 5 / mins);
    const tot = keysOk + keysBad, acc = tot ? Math.round(keysOk / tot * 100) : 0;
    const perSec = secChars.map(c => c * 12); /* chars/sec -> approx wpm */
    const m = RT.stats.mean(perSec), cons = m ? Math.max(0, Math.round(100 - RT.stats.std(perSec) / m * 100)) : 0;
    const badWords = typedWords.filter((w, i) => w !== words[i]).length + (cur && cur !== words[idx] ? 1 : 0);
    const tier = TIERS.filter(t => wpm >= t[0]).pop()[1];
    const prev = RT.store.get(pbKey(), null), newBest = prev !== null && wpm > prev;
    if(prev === null || wpm > prev) RT.store.set(pbKey(), wpm);
    last = { wpm, acc, tier };
    $("rKick").textContent = `${cfg.dur} seconds · ${cfg.punct ? "with punctuation" : "common words"}`;
    $("rNum").textContent = wpm; $("rTier").textContent = tier; $("rBest").hidden = !newBest;
    $("tAcc").textContent = acc + "%"; $("tRaw").textContent = raw; $("tWords").textContent = typedWords.length - badWords + (cur && cur === words[idx] ? 1 : 0) + " / " + badWords;
    $("tCons").textContent = cons + "%";
    RT.bars.build($("rBars"), cfg.dur > 60 ? 60 : cfg.dur);
    const vals = cfg.dur > 60 ? Array.from({ length: 60 }, (_, i) => RT.stats.mean(perSec.slice(Math.floor(i * cfg.dur / 60), Math.floor((i + 1) * cfg.dur / 60)))) : perSec;
    RT.bars.paint($("rBars"), vals, vals.indexOf(Math.max(...vals)));
    prog.style.transform = "scaleX(1)";
    if(rawChars() > 0){
      RT.analysis.add({ t: Date.now(), n: wpm, kick: `Typing test · ${cfg.dur}s · ${cfg.punct ? "with punctuation" : "common words"}`, value: wpm, unit: "WPM", tier,
        tiles: [[acc + "%", "Accuracy"], [raw, "Raw WPM"], [(typedWords.length - badWords + (cur && cur === words[idx] ? 1 : 0)) + " / " + badWords, "Words ✓ / ✗"], [cons + "%", "Consistency"]],
        scale: { title: "Speed scale", note: "A simple site benchmark. Average typists land around 40 to 55 WPM.", pos: wpm / 120, text: wpm + " WPM", ticks: ["0", "30", "60", "90", "120+"] },
        bars: { title: "Typing speed per second", note: "Approximate WPM in each second. Steadier bars mean steadier rhythm.", vals: perSec.slice(), labels: perSec.map(v => String(Math.round(v))), best: perSec.indexOf(Math.max(...perSec)) },
        row: [cfg.dur + "s" + (cfg.punct ? " +punct" : ""), wpm + " WPM", acc + "%", String(raw), cons + "%", tier] });
    }
    input.blur(); A.classList.remove("blurred");
    setState("result"); lastEnd = performance.now();
    A.classList.add("lock"); setTimeout(() => A.classList.remove("lock"), 700);
    paintCfg();
  }

  function toReady(focus){
    cancelAnimationFrame(raf); prog.style.transform = "scaleX(0)";
    setState("ready"); paintCfg(); build(); A.classList.remove("blurred");
    $("tyWpm").textContent = "0"; $("tyAcc").textContent = "100";
    if(focus !== false) input.focus({ preventScroll: true });
  }

  /* ---------- options ---------- */
  $("durSeg").addEventListener("click", ev => { const b = ev.target.closest("button"); if(!b) return; cfg.dur = +b.dataset.dur; RT.store.set("ty:cfg", cfg); paintCfg(); build(); input.focus({ preventScroll: true }); });
  $("punct").addEventListener("click", () => { cfg.punct = !cfg.punct; RT.store.set("ty:cfg", cfg); paintCfg(); build(); input.focus({ preventScroll: true }); });

  RT.arena.guard(A);
  A.addEventListener("pointerdown", () => { if(state !== "result") setTimeout(() => input.focus({ preventScroll: true }), 0); });
  A.addEventListener("click", ev => { if(state !== "result" && !ev.target.closest("button")) input.focus({ preventScroll: true }); });
  document.addEventListener("keydown", ev => {
    if(state !== "result" || ev.repeat) return;
    if(ev.key !== "Enter" && ev.code !== "Space") return;
    if(/INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY/.test((document.activeElement || {}).tagName || "")) return;
    if(performance.now() - lastEnd > 700){ ev.preventDefault(); toReady(true); }
  });
  $("reset").addEventListener("click", () => toReady(true));
  $("again").addEventListener("click", () => toReady(true));
  $("share").addEventListener("click", async ev => {
    if(!last) return; const b = ev.currentTarget; b.disabled = true;
    await RT.share({ value: String(last.wpm), unit: "WPM", sub: `${last.acc}% accuracy · ${cfg.dur}s typing speed test`,
      text: `I typed ${last.wpm} WPM with ${last.acc}% accuracy. Can you beat it?`, url: location.href.split("#")[0], file: `typing-${last.wpm}wpm.png`, site: location.host });
    b.disabled = false;
  });

  RT.analysis.init({ key: "typing", heads: ["Length", "WPM", "Accuracy", "Raw WPM", "Consistency", "Rating"], lastIsTier: true, trend: "WPM", tip: "Accuracy first: clean typing at a steady pace beats rushed typing with corrections." });
  paintCfg(); build();
  document.fonts && document.fonts.ready.then(() => { if(state === "ready"){ build(); } });
  if(!matchMedia("(pointer:coarse)").matches) input.focus({ preventScroll: true }); else A.classList.add("blurred");
})();
