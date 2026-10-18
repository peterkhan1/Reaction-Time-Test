/* Aim trainer: five modes, all options / play / results inside one arena. */
(() => {
  const $ = id => document.getElementById(id);
  const A = $("arena"), prog = $("prog"), pbEl = $("pb");
  const hud = { a: $("hudA"), b: $("hudB"), c: $("hudC"), al: $("hudAL"), bl: $("hudBL"), cl: $("hudCL") };

  const MODES = {
    classic:   { name: "Classic",   type: "timed", n: 3, desc: "Hit the targets as they appear. Three are always on screen." },
    flick:     { name: "Flick",     type: "count", n: 1, delay: [250, 700], desc: "One target at a time after a random delay. Flick to it fast." },
    precision: { name: "Precision", type: "count", n: 1, scale: .55, desc: "Small targets. Accuracy matters more than speed." },
    moving:    { name: "Moving",    type: "timed", n: 3, move: true, desc: "Targets drift across the screen. Lead your shots." },
    tracking:  { name: "Tracking",  type: "timed", track: true, desc: "Keep your cursor on the moving target. No clicking needed." }
  };
  const SIZES = { s: { n: "Small", d: 26 }, m: { n: "Medium", d: 40 }, l: { n: "Large", d: 60 } };
  const TIMED = [15, 30, 60], COUNT = [10, 20, 30];

  let cfg = Object.assign({ mode: "classic", size: "m", t: 30, n: 20 }, RT.store.get("aim:cfg", {}));
  if(!MODES[cfg.mode]) cfg.mode = "classic";
  if(!SIZES[cfg.size]) cfg.size = "m";
  if(!TIMED.includes(cfg.t)) cfg.t = 30;
  if(!COUNT.includes(cfg.n)) cfg.n = 20;

  let state = "ready", t0 = 0, raf = 0, lastEnd = 0, last = null, field = null, lastFrame = 0;
  let targets = [], timers = [], rips = [], tr = null, lastPos = null;
  let hits = 0, misses = 0, streak = 0, bestStreak = 0, times = [], hitsBySec = [];
  const ptr = { x: -99, y: -99 };

  const M = () => MODES[cfg.mode];
  const timed = () => M().type === "timed";
  const len = () => timed() ? cfg.t : cfg.n;
  const lenText = () => timed() ? `${len()} seconds` : `${len()} targets`;
  const pbKey = () => `aim:best:${cfg.mode}:${cfg.size}:${len()}`;
  const lowerBetter = () => cfg.mode === "flick";
  const diam = () => Math.round(SIZES[cfg.size].d * (M().scale || 1) * (innerWidth < 600 ? .9 : 1));
  const unitOf = m => ({ classic: "hits", moving: "hits", flick: "ms", precision: "%", tracking: "%" })[m];

  function setState(s){ state = s; A.dataset.state = s; if(window.RT && RT.lock) RT.lock(s === "run"); }

  /* ---------- options ---------- */
  function paintCfg(){
    document.querySelectorAll("#modeSeg button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.mode === cfg.mode)));
    document.querySelectorAll("#sizeSeg button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.size === cfg.size)));
    const vals = timed() ? TIMED : COUNT, cur = len(), seg = $("lenSeg");
    seg.setAttribute("aria-label", timed() ? "Duration" : "Number of targets");
    seg.textContent = "";
    vals.forEach(v => {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "radio"); b.dataset.len = v;
      b.setAttribute("aria-checked", String(v === cur));
      b.textContent = timed() ? v + "s" : v + " targets";
      seg.appendChild(b);
    });
    $("sizeSeg").classList.toggle("off", cfg.mode === "precision");
    const pb = RT.store.get(pbKey(), null);
    pbEl.textContent = pb === null ? `No best yet · ${M().name}` : `Best ${pb}${unitOf(cfg.mode) === "hits" ? " hits" : " " + unitOf(cfg.mode)} · ${M().name}`;
    $("rHelp").textContent = `${M().desc} ${lenText()[0].toUpperCase()}${lenText().slice(1)}.`;
    A.setAttribute("aria-label", `Aim trainer area. ${M().name} mode, ${lenText()}. Click to begin`);
  }

  function bindSeg(id, fn){
    $(id).addEventListener("click", ev => {
      const b = ev.target.closest("button"); if(!b) return;
      fn(b.dataset); RT.store.set("aim:cfg", cfg); paintCfg(); A.focus({ preventScroll: true });
    });
  }
  bindSeg("modeSeg", d => { cfg.mode = d.mode; });
  bindSeg("sizeSeg", d => { cfg.size = d.size; });
  bindSeg("lenSeg", d => { cfg[timed() ? "t" : "n"] = +d.len; });

  /* ---------- targets ---------- */
  function mk(d){
    const w = document.createElement("div"); w.className = "tgt";
    w.style.width = w.style.height = d + "px"; w.appendChild(document.createElement("i")); return w;
  }
  const place = t => { t.el.style.transform = `translate3d(${t.x - t.r}px,${t.y - t.r}px,0)`; };

  function spawn(far){
    const d = diam(), r = d / 2, minFar = Math.min(220, (field.x1 - field.x0) / 3);
    let x, y, i = 0;
    do {
      x = field.x0 + r + Math.random() * (field.x1 - field.x0 - d);
      y = field.y0 + r + Math.random() * (field.y1 - field.y0 - d);
      i++;
    } while(i < 40 && (targets.some(o => Math.hypot(o.x - x, o.y - y) < d * 1.6) || (far && Math.hypot(far.x - x, far.y - y) < minFar)));
    const t = { x, y, r, el: mk(d), born: performance.now(), vx: 0, vy: 0 };
    if(M().move){
      const a = Math.random() * 6.283, sp = (110 + Math.random() * 90) * (innerWidth < 600 ? .8 : 1);
      t.vx = Math.cos(a) * sp; t.vy = Math.sin(a) * sp;
    }
    t.el.addEventListener("pointerdown", ev => onTarget(ev, t));
    place(t); A.appendChild(t.el); targets.push(t); lastPos = { x, y };
    return t;
  }
  function spawnNext(){
    const dl = M().delay;
    if(!dl){ spawn(lastPos); return; }
    timers.push(setTimeout(() => { if(state === "run") spawn(lastPos); }, dl[0] + Math.random() * (dl[1] - dl[0])));
  }
  function clearField(){
    targets.forEach(t => t.el.remove()); targets = []; tr = null;
    timers.forEach(clearTimeout); timers = [];
    rips.forEach(r => r.remove()); rips = [];
  }
  function fx(cls, x, y, ms){
    const e = document.createElement("span"); e.className = cls; e.style.left = x + "px"; e.style.top = y + "px";
    e.addEventListener("animationend", () => { e.remove(); rips = rips.filter(v => v !== e); });
    A.appendChild(e); rips.push(e); if(rips.length > 16) rips.shift().remove();
  }

  /* ---------- run ---------- */
  function start(){
    clearField();
    A.scrollIntoView({ block: "nearest" });
    setState("run");
    const r = A.getBoundingClientRect();
    field = { x0: 18, y0: 58, x1: r.width - 18, y1: r.height - 20 };
    hits = misses = streak = bestStreak = 0; times = [];
    hitsBySec = new Array(cfg.t).fill(0);
    const m = M();
    hud.al.textContent = m.track ? "On target" : (timed() ? "Hits" : "Targets");
    hud.bl.textContent = timed() ? "Time left" : (cfg.mode === "flick" ? "Avg ms" : "Avg ms");
    hud.cl.textContent = m.track ? "Longest lock" : "Accuracy";
    t0 = performance.now(); lastFrame = t0;
    if(m.track) initTrack();
    else if(timed()) for(let i = 0; i < m.n; i++) spawn();
    else spawnNext();
    raf = requestAnimationFrame(loop);
  }

  function initTrack(){
    const d = diam(), r = d / 2;
    tr = { x: (field.x0 + field.x1) / 2, y: (field.y0 + field.y1) / 2, r, el: mk(d), heading: Math.random() * 6.283,
           speed: 170 * (innerWidth < 600 ? .8 : 1), turnAt: 0, want: 0, onTime: 0, cur: 0, longest: 0, breaks: 0, on: false, bySec: new Array(cfg.t).fill(0) };
    tr.want = tr.heading; place(tr); A.appendChild(tr.el); targets = [tr];
  }

  function bounce(t){
    if(t.x < field.x0 + t.r){ t.x = field.x0 + t.r; t.vx = Math.abs(t.vx); }
    if(t.x > field.x1 - t.r){ t.x = field.x1 - t.r; t.vx = -Math.abs(t.vx); }
    if(t.y < field.y0 + t.r){ t.y = field.y0 + t.r; t.vy = Math.abs(t.vy); }
    if(t.y > field.y1 - t.r){ t.y = field.y1 - t.r; t.vy = -Math.abs(t.vy); }
  }

  function stepTrack(dt, now, el){
    const t = tr;
    if(now >= t.turnAt){ t.want = t.heading + (Math.random() < .5 ? -1 : 1) * (.7 + Math.random() * 1.6); t.turnAt = now + 500 + Math.random() * 900; }
    t.heading += (t.want - t.heading) * Math.min(1, dt * 3.2);
    t.x += Math.cos(t.heading) * t.speed * dt; t.y += Math.sin(t.heading) * t.speed * dt;
    if(t.x < field.x0 + t.r || t.x > field.x1 - t.r){ t.x = Math.min(Math.max(t.x, field.x0 + t.r), field.x1 - t.r); t.heading = Math.PI - t.heading; t.want = t.heading; }
    if(t.y < field.y0 + t.r || t.y > field.y1 - t.r){ t.y = Math.min(Math.max(t.y, field.y0 + t.r), field.y1 - t.r); t.heading = -t.heading; t.want = t.heading; }
    place(t);
    const on = Math.hypot(ptr.x - t.x, ptr.y - t.y) <= t.r + 1;
    if(on){ t.onTime += dt; t.cur += dt; t.longest = Math.max(t.longest, t.cur); t.bySec[Math.min(cfg.t - 1, Math.floor(el / 1000))] += dt; }
    else { if(t.on) t.breaks++; t.cur = 0; }
    t.on = on; t.el.classList.toggle("on", on);
  }

  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const accNow = () => hits + misses ? Math.round(hits / (hits + misses) * 100) + "%" : "—";

  function loop(){
    const now = performance.now(), dt = Math.min(.05, (now - lastFrame) / 1000), el = now - t0;
    lastFrame = now;
    if(timed() && el >= cfg.t * 1000){ finish(); return; }
    if(M().move) targets.forEach(t => { t.x += t.vx * dt; t.y += t.vy * dt; bounce(t); place(t); });
    if(M().track) stepTrack(dt, now, el);
    if(M().track){
      hud.a.textContent = (el > 0 ? Math.round(tr.onTime / (el / 1000) * 100) : 0) + "%";
      hud.c.textContent = tr.longest.toFixed(1) + "s";
    } else {
      hud.a.textContent = timed() ? hits : `${hits}/${cfg.n}`;
      hud.c.textContent = accNow();
    }
    hud.b.textContent = timed() ? Math.max(0, (cfg.t * 1000 - el) / 1000).toFixed(1) : (times.length ? Math.round(mean(times)) : "—");
    prog.style.transform = `scaleX(${timed() ? Math.min(1, el / (cfg.t * 1000)) : hits / cfg.n})`;
    raf = requestAnimationFrame(loop);
  }

  function onTarget(ev, t){
    ev.stopPropagation();
    if(state !== "run" || M().track) return;
    if(ev.pointerType === "mouse" && ev.button !== 0) return;
    const now = performance.now();
    if(timed() && now - t0 >= cfg.t * 1000){ finish(); return; }
    hits++; streak++; bestStreak = Math.max(bestStreak, streak);
    times.push(now - t.born);
    if(timed()) hitsBySec[Math.min(cfg.t - 1, Math.floor((now - t0) / 1000))]++;
    fx("rip", t.x, t.y);
    t.el.remove(); targets = targets.filter(o => o !== t);
    if(timed()) spawn();
    else if(hits >= cfg.n) finish();
    else spawnNext();
  }

  function finish(){
    cancelAnimationFrame(raf);
    const m = cfg.mode, el = Math.min(performance.now() - t0, cfg.t * 1000);
    const acc = hits + misses ? hits / (hits + misses) * 100 : 0;
    const avg = Math.round(mean(times)), fast = times.length ? Math.round(Math.min(...times)) : 0, slow = times.length ? Math.round(Math.max(...times)) : 0;
    let num, unit, tiles, bars, peak;
    if(m === "classic" || m === "moving"){
      num = hits; unit = "HITS";
      tiles = [[Math.round(acc), "Accuracy %"], [avg || "—", "Avg ms"], [misses, "Misses"], [bestStreak, "Best streak"]];
      bars = hitsBySec; peak = bars.indexOf(Math.max(...bars));
    } else if(m === "flick"){
      num = hits ? avg : null; unit = "MS AVG";
      tiles = [[Math.round(acc), "Accuracy %"], [fast || "—", "Fastest ms"], [slow || "—", "Slowest ms"], [misses, "Misses"]];
      bars = times.map(Math.round); peak = bars.indexOf(Math.min(...bars));
    } else if(m === "precision"){
      num = Math.round(acc); unit = "% ACCURACY";
      tiles = [[hits, "Hits"], [avg || "—", "Avg ms"], [misses, "Misses"], [bestStreak, "Best streak"]];
      bars = times.map(Math.round); peak = bars.indexOf(Math.min(...bars));
    } else {
      const on = tr.onTime;
      num = Math.round(on / cfg.t * 100); unit = "% ON TARGET";
      tiles = [[on.toFixed(1), "On target s"], [Math.max(0, cfg.t - on).toFixed(1), "Off target s"], [tr.longest.toFixed(1), "Longest s"], [tr.breaks, "Lock breaks"]];
      bars = tr.bySec.map(v => Math.min(1, v)); peak = bars.indexOf(Math.max(...bars));
    }
    const prev = RT.store.get(pbKey(), null);
    let newBest = false;
    if(num !== null){
      const better = prev === null || (lowerBetter() ? num < prev : num > prev);
      newBest = prev !== null && better;
      if(better) RT.store.set(pbKey(), num);
    }
    last = { num, unit, text: `${M().name} · ${m === "precision" ? "Small" : SIZES[cfg.size].n} targets · ${lenText()}` };
    $("rKick").textContent = last.text;
    $("rNum").textContent = num === null ? "—" : num;
    $("rUnit").textContent = unit;
    $("rBest").hidden = !newBest;
    ["A", "B", "C", "D"].forEach((k, i) => { $("t" + k).textContent = tiles[i][0]; $("l" + k).textContent = tiles[i][1]; });
    RT.bars.build($("rBars"), bars.length); RT.bars.paint($("rBars"), bars, peak);
    prog.style.transform = "scaleX(1)";
    clearField();
    if(num !== null){
      const accP = Math.round(acc), kindTitle = m === "flick" || m === "precision" ? "Time to hit each target (ms)" : "Hits in each second";
      RT.analysis.add({ t: Date.now(), n: num, kick: last.text, value: num, unit: unit.toLowerCase().replace("ms avg", "ms average"), tier: "",
        tiles: tiles.map(t => [t[0], t[1]]),
        scale: { title: m === "tracking" ? "On-target scale" : "Accuracy scale", note: m === "tracking" ? "Share of the run your cursor stayed on the target." : "Hits divided by hits plus misses.", pos: (m === "tracking" ? num : accP) / 100, text: (m === "tracking" ? num : accP) + "%", ticks: ["0%", "25%", "50%", "75%", "100%"] },
        bars: { title: kindTitle, note: "The best value is highlighted.", vals: bars.slice(), labels: bars.map(v => typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : v), best: peak },
        row: [M().name, lenText(), num + " " + unit.toLowerCase().replace("ms avg", "ms").replace("% accuracy", "%").replace("% on target", "%"), accP + "%", avg ? avg + " ms" : "—"] });
    }
    setState("result");
    lastEnd = performance.now();
    A.classList.add("lock"); setTimeout(() => A.classList.remove("lock"), 700);
    paintCfg();
  }

  function toReady(){
    cancelAnimationFrame(raf); clearField();
    prog.style.transform = "scaleX(0)";
    setState("ready"); paintCfg();
    A.focus({ preventScroll: true });
  }

  /* ---------- input ---------- */
  RT.arena.guard(A);

  A.addEventListener("pointerdown", ev => {
    const r = A.getBoundingClientRect();
    ptr.x = ev.clientX - r.left; ptr.y = ev.clientY - r.top;
    if(state === "result") return;
    if(ev.pointerType === "mouse" && ev.button !== 0) return;
    if(state === "ready"){ start(); return; }
    if(state !== "run" || M().track) return;
    misses++; streak = 0; fx("miss", ptr.x, ptr.y);
  });
  A.addEventListener("pointermove", ev => {
    const r = A.getBoundingClientRect();
    ptr.x = ev.clientX - r.left; ptr.y = ev.clientY - r.top;
    A.style.setProperty("--mx", ptr.x + "px"); A.style.setProperty("--my", ptr.y + "px");
  });
  A.addEventListener("pointerleave", () => { ptr.x = ptr.y = -99; });
  A.addEventListener("contextmenu", ev => ev.preventDefault());

  document.addEventListener("keydown", ev => {
    if(ev.key === "Escape"){ if(state === "run") toReady(); return; }
    if(ev.code !== "Space" && ev.key !== "Enter") return;
    const onA = RT.arena.target(A);
    if(!onA && RT.arena.INTERACTIVE.test((document.activeElement || {}).tagName || "")) return;
    if(!onA && state !== "run") return;
    if(ev.repeat){ if(onA) ev.preventDefault(); return; }
    if(state === "result"){ if(onA && performance.now() - lastEnd > 700){ ev.preventDefault(); toReady(); } return; }
    if(state === "ready" && onA){ ev.preventDefault(); start(); }
    else if(state === "run") ev.preventDefault();
  });

  /* ---------- buttons ---------- */
  $("reset").addEventListener("click", toReady);
  $("again").addEventListener("click", toReady);
  $("share").addEventListener("click", async ev => {
    if(!last || last.num === null) return;
    const b = ev.currentTarget; b.disabled = true;
    const v = String(last.num), u = last.unit;
    await RT.share({
      value: v, unit: u, sub: last.text,
      text: `I scored ${v} ${u.toLowerCase()} on the ${last.text} aim trainer. Can you beat it?`,
      url: location.href.split("#")[0], file: `aim-${v}.png`, site: location.host
    });
    b.disabled = false;
  });

  RT.analysis.init({ key: "aim", heads: ["Mode", "Length", "Score", "Accuracy", "Avg time"], trend: "Score", tip: "Keep the same mode and target size for a few runs before you judge your progress." });
  paintCfg();
})();
