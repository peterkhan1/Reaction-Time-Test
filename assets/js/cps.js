/* CPS test logic. Everything (options, run, result, history) lives inside one arena. */
(() => {
  const $ = id => document.getElementById(id);
  const A = $("arena"), prog = $("prog"), pbEl = $("pb");
  const live = $("live"), runClicks = $("runClicks"), runLeft = $("runLeft");
  const liveBars = $("liveBars"), rBars = $("rBars");
  const DURS = [1, 5, 10, 15, 30, 60];
  /* Rough benchmarks (editable): [minimum CPS, label] */
  const TIERS = [[0,"Slow"],[4,"Average"],[6,"Good"],[8,"Fast"],[10,"Very fast"],[13,"Elite"],[16,"Extreme"]];

  let cfg = Object.assign({ dur: 10, input: "mouse", btn: "both" }, RT.store.get("cps:cfg", {}));
  if(!DURS.includes(cfg.dur)) cfg.dur = 10;
  let state = "ready", t0 = 0, clicks = 0, buckets = [], raf = 0, lastEnd = 0, last = null, rips = [];

  const label = c => c.input === "space" ? "Space bar" : (c.btn === "left" ? "Mouse, left button" : "Mouse, both buttons");
  const pbKey = () => `cps:best:${cfg.dur}:${cfg.input}`;
  const secs = n => `${n} second${n > 1 ? "s" : ""}`;

  function paintCfg(){
    document.querySelectorAll("#durSeg button").forEach(b => b.setAttribute("aria-checked", String(+b.dataset.dur === cfg.dur)));
    document.querySelectorAll("#inSeg button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.in === cfg.input)));
    document.querySelectorAll("#btnSeg button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.btn === cfg.btn)));
    $("btnSeg").classList.toggle("off", cfg.input === "space");
    const pb = RT.store.get(pbKey(), null);
    pbEl.textContent = pb ? `Best ${pb.toFixed(2)} CPS · ${cfg.dur}s` : `No best yet · ${cfg.dur}s`;
    const space = cfg.input === "space";
    $("rTitle").textContent = space ? "Press Space to begin" : "Click to begin";
    $("rHelp").textContent = (space ? "Press Space" : "Click") + ` as fast as you can for ${secs(cfg.dur)}.`;
    $("hint").textContent = space ? "Your first press starts the timer" : (cfg.btn === "both" ? "Left and right buttons both count" : "Left button only");
    A.setAttribute("aria-label", `Click speed test area. ${space ? "Press Space" : "Click"} to begin a ${secs(cfg.dur)} test`);
  }

  function setState(s){ state = s; A.dataset.state = s; if(window.RT && RT.lock) RT.lock(s === "run"); }
  function toReady(){
    cancelAnimationFrame(raf);
    prog.style.transform = "scaleX(0)";
    clearRips();
    setState("ready"); paintCfg();
    A.focus({ preventScroll: true });
  }

  function buildBars(el, n){
    el.textContent = "";
    for(let i = 0; i < n; i++) el.appendChild(document.createElement("i"));
  }
  function paintBars(el, upto, peakIdx){
    const max = Math.max(3, ...buckets);
    const kids = el.children;
    for(let i = 0; i < kids.length; i++){
      const on = i <= upto;
      kids[i].style.height = on ? Math.max(6, (buckets[i] / max) * 100) + "%" : "6%";
      kids[i].className = on ? (i === peakIdx ? "on pk" : "on") : "";
    }
  }

  function clearRips(){ rips.forEach(r => r.remove()); rips = []; }
  function ripple(x, y){
    const r = document.createElement("span");
    r.className = "rip"; r.style.left = x + "px"; r.style.top = y + "px";
    r.addEventListener("animationend", () => { r.remove(); rips = rips.filter(v => v !== r); });
    A.appendChild(r); rips.push(r);
    if(rips.length > 14) rips.shift().remove();
  }

  function start(now){
    t0 = now; clicks = 0; buckets = new Array(cfg.dur).fill(0);
    buildBars(liveBars, cfg.dur);
    live.textContent = "0.0"; runClicks.textContent = "0"; runLeft.textContent = cfg.dur.toFixed(1);
    A.scrollIntoView({ block: "nearest" });
    setState("run");
    raf = requestAnimationFrame(loop);
  }

  function loop(){
    const el = performance.now() - t0, total = cfg.dur * 1000;
    if(el >= total){ finish(); return; }
    prog.style.transform = `scaleX(${el / total})`;
    live.textContent = (clicks / Math.max(el / 1000, 1)).toFixed(1);
    runClicks.textContent = clicks;
    runLeft.textContent = ((total - el) / 1000).toFixed(1);
    paintBars(liveBars, Math.min(cfg.dur - 1, Math.floor(el / 1000)), -1);
    raf = requestAnimationFrame(loop);
  }

  function hit(x, y){
    const now = performance.now();
    if(state === "ready") start(now);
    if(state !== "run") return;
    if(now - t0 >= cfg.dur * 1000){ finish(); return; }
    clicks++;
    buckets[Math.min(cfg.dur - 1, Math.floor((now - t0) / 1000))]++;
    if(x == null){ const r = A.getBoundingClientRect(); x = r.width / 2 + (Math.random() - .5) * 120; y = r.height / 2 + (Math.random() - .5) * 60; }
    ripple(x, y);
  }

  function finish(){
    cancelAnimationFrame(raf);
    const dur = cfg.dur, cps = clicks / dur;
    const mean = clicks / dur;
    const peak = dur >= 2 ? Math.max(...buckets) : null;
    const peakIdx = peak ? buckets.indexOf(peak) : -1;
    const cons = dur >= 3 && mean > 0 ? Math.max(0, Math.round(100 - (RT.stats.std(buckets) / mean) * 100)) : null;
    let pace = null;
    if(dur >= 2){
      const h = Math.floor(dur / 2);
      const a = RT.stats.mean(buckets.slice(0, h)), b = RT.stats.mean(buckets.slice(h));
      if(a > 0) pace = Math.round(((b - a) / a) * 100);
    }
    const tier = TIERS.filter(t => cps >= t[0]).pop()[1];
    const prev = RT.store.get(pbKey(), null);
    const newBest = prev !== null && cps > prev;
    if(prev === null || cps > prev) RT.store.set(pbKey(), +cps.toFixed(2));
    last = { cps, dur, clicks, tier };
    $("rKick").textContent = `${secs(dur)} · ${label(cfg)}`;
    $("rNum").textContent = cps.toFixed(2);
    $("rTier").textContent = tier;
    $("rBest").hidden = !newBest;
    $("tClicks").textContent = clicks;
    $("tPeak").textContent = peak === null ? "—" : peak;
    $("tCons").textContent = cons === null ? "—" : cons + "%";
    $("tPace").textContent = pace === null ? "—" : (pace > 0 ? "+" : pace < 0 ? "−" : "") + Math.abs(pace) + "%";
    buildBars(rBars, dur); paintBars(rBars, dur - 1, peakIdx);
    prog.style.transform = "scaleX(1)";
    clearRips();
    RT.analysis.add({ t: Date.now(), n: +cps.toFixed(2), kick: `CPS test · ${secs(dur)} · ${label(cfg)}`, value: cps.toFixed(2), unit: "CPS", tier,
      tiles: [[clicks, "Clicks"], [peak === null ? "—" : peak, "Peak / sec"], [cons === null ? "—" : cons + "%", "Consistency"], [pace === null ? "—" : (pace > 0 ? "+" : pace < 0 ? "−" : "") + Math.abs(pace) + "%", "Pace"]],
      scale: { title: "Speed scale", note: "A simple site benchmark for comparison, not an official standard.", pos: cps / 16, text: cps.toFixed(2) + " CPS", ticks: ["0", "4", "8", "12", "16+"] },
      bars: { title: "Clicks per second", note: dur >= 2 ? "Clicks in each second of the test. The fastest second is highlighted." : "Too short for a per-second breakdown.", vals: buckets.slice(), labels: buckets.map(String), best: peakIdx },
      row: [secs(dur), label(cfg), cps.toFixed(2), String(clicks), cons === null ? "—" : cons + "%", tier] });
    setState("result");
    lastEnd = performance.now();
    A.classList.add("lock");
    setTimeout(() => A.classList.remove("lock"), 700);
    paintCfg();
  }

  /* ---------- options ---------- */
  function bindSeg(id, key, attr, parse){
    $(id).addEventListener("click", ev => {
      const b = ev.target.closest("button"); if(!b) return;
      cfg[key] = parse ? parse(b.dataset[attr]) : b.dataset[attr];
      RT.store.set("cps:cfg", cfg); paintCfg(); A.focus({ preventScroll: true });
    });
  }
  bindSeg("durSeg", "dur", "dur", Number);
  bindSeg("inSeg", "input", "in");
  bindSeg("btnSeg", "btn", "btn");

  /* ---------- input ---------- */
  RT.arena.guard(A);

  A.addEventListener("pointerdown", ev => {
    if(state === "result") return;
    if(cfg.input !== "mouse"){ A.focus({ preventScroll: true }); return; }
    if(ev.pointerType === "mouse"){
      if(ev.button === 1){ ev.preventDefault(); return; }
      if(ev.button > 2 || (ev.button === 2 && cfg.btn === "left")) return;
    }
    const r = A.getBoundingClientRect();
    hit(ev.clientX - r.left, ev.clientY - r.top);
  });
  A.addEventListener("contextmenu", ev => ev.preventDefault());
  A.addEventListener("pointermove", ev => {
    const r = A.getBoundingClientRect();
    A.style.setProperty("--mx", (ev.clientX - r.left) + "px");
    A.style.setProperty("--my", (ev.clientY - r.top) + "px");
  });

  document.addEventListener("keydown", ev => {
    if(ev.key === "Escape"){ if(state === "run") toReady(); return; }
    if(ev.code !== "Space" && ev.key !== "Enter") return;
    const onA = RT.arena.target(A);
    if(!onA && RT.arena.INTERACTIVE.test((document.activeElement || {}).tagName || "")) return;
    if(!onA && state !== "run") return;
    if(ev.repeat){ if(onA) ev.preventDefault(); return; }
    if(state === "result"){ if(onA && performance.now() - lastEnd > 700){ ev.preventDefault(); toReady(); } return; }
    if(cfg.input === "space" && ev.code === "Space"){ ev.preventDefault(); hit(null); }
    else if(cfg.input === "mouse" && ev.key === "Enter" && state === "ready"){ ev.preventDefault(); hit(null); }
    else if(ev.code === "Space" && (state === "run" || state === "ready")) ev.preventDefault();
  });

  /* ---------- buttons ---------- */
  $("reset").addEventListener("click", toReady);
  $("again").addEventListener("click", toReady);
  $("share").addEventListener("click", async ev => {
    if(!last) return;
    const b = ev.currentTarget; b.disabled = true;
    const v = last.cps.toFixed(2);
    await RT.share({
      value: v, unit: "CPS", sub: `${secs(last.dur)} click speed test · ${last.tier}`,
      text: `I clicked ${v} times per second in a ${secs(last.dur)} click speed test. Can you beat it?`,
      url: location.href.split("#")[0], file: `cps-${v}.png`, site: location.host
    });
    b.disabled = false;
  });

  RT.analysis.init({ key: "cps", heads: ["Length", "Input", "CPS", "Clicks", "Consistency", "Rating"], lastIsTier: true, trend: "CPS", tip: "Compare like with like: the same duration and input method give the fairest picture." });
  paintCfg();
})();
