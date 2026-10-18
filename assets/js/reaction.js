/* Reaction time test — click to begin, wait for green, press. Five rounds, then the result shows straight away. */
(() => {
  const $ = id => document.getElementById(id);
  const A = $("arena"), pbEl = $("pb");
  const ROUNDS = 5, MIN = 1200, MAX = 3000;
  const TIERS = [[150, "Exceptional"], [170, "Excellent"], [190, "Very good"], [220, "Good"], [260, "Average"], [320, "Below average"], [400, "Slow"], [500, "Very slow"], [Infinity, "Training needed"]];
  const tierOf = ms => TIERS.find(t => ms <= t[0])[1];
  const LO = 120, HI = 440;

  let state = "ready", round = 0, vals = [], timer = 0, signalAt = null, lastEnd = 0, last = null;

  const dots = $("dots");
  for(let i = 0; i < ROUNDS; i++) dots.appendChild(document.createElement("i"));

  function setState(s){
    state = s; A.dataset.state = s;
    RT.lock(s !== "ready" && s !== "result");
    paintChrome();
  }
  function paintChrome(){
    [].forEach.call(dots.children, (d, i) => {
      d.className = i < vals.length ? "done" : (i === round - 1 && state !== "ready" && state !== "result" ? "now" : "");
    });
    $("roundTxt").textContent = state === "ready" || state === "result" ? "5 rounds" : `Round ${Math.min(round, ROUNDS)} of ${ROUNDS}`;
    const hints = { ready: "or press Space", wait: "Don't press yet", signal: "Click, tap or press Space", false: "or press Space", round: "or press Space" };
    $("hint").textContent = hints[state] || "";
  }
  function paintPb(){
    const b = RT.store.get("rx:best", null);
    pbEl.textContent = b ? `Best average ${b} ms` : "No best yet";
  }
  function show(title, help){ $("runState").textContent = title; $("runHelp").textContent = help; }

  function beginWait(){
    clearTimeout(timer); signalAt = null;
    setState("wait");
    show("Wait for green…", "Don't press anything until the screen turns green.");
    A.focus({ preventScroll: true });
    const d = MIN + Math.random() * (MAX - MIN);
    timer = setTimeout(() => {
      setState("signal");
      show("Press!", "Click, tap or press Space now.");
      requestAnimationFrame(() => { signalAt = performance.now(); });
    }, d);
  }
  function nextRound(){
    round++; beginWait();
    if(round === 1) A.scrollIntoView({ block: "nearest" });
  }
  function falseStart(early){
    clearTimeout(timer); signalAt = null; lastEnd = performance.now();
    setState("false");
    show(early ? "Too early" : "Too soon!", early ? "That was faster than a human can react, so it counts as a guess. Press to retry this round." : "You pressed before green. Press to retry this round.");
  }
  function capture(stamp){
    if(signalAt === null) return;
    const now = performance.now();
    const t = typeof stamp === "number" && stamp <= now + 2 && stamp >= signalAt - 100 ? stamp : now;
    const ms = Math.round(t - signalAt);
    if(ms < 100){ falseStart(true); return; }
    clearTimeout(timer); lastEnd = now;
    vals.push(ms);
    if(vals.length >= ROUNDS){ finish(); return; }   /* straight to the result, no extra click */
    setState("round");
    show(`${ms} ms`, `${tierOf(ms)}. Press for the next round.`);
  }

  /* display-only flourish: runs after the result is final and never touches measurement */
  function countUp(el, to){
    if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches){ el.textContent = to; return; }
    const t0 = performance.now(), dur = 650, from = Math.round(to * .55);
    (function tick(now){
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if(k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function finish(){
    const avg = Math.round(RT.stats.mean(vals)), med = Math.round(RT.stats.median(vals));
    const best = Math.min(...vals), slow = Math.max(...vals);
    const cons = Math.max(0, Math.min(100, Math.round(100 - RT.stats.std(vals) / avg * 100)));
    const prevSessions = RT.store.get("sess:reaction", []).slice(0, 5).map(h => h.n);
    const pb = RT.store.get("rx:best", null);
    const newBest = pb !== null && avg < pb;
    if(pb === null || avg < pb) RT.store.set("rx:best", avg);
    const tier = tierOf(avg);

    last = { avg, tier };
    $("rKick").textContent = "Average of 5 rounds";
    countUp($("rNum"), avg);
    $("rTier").textContent = tier;
    $("rBest").hidden = !newBest;
    const dl = $("rDelta");
    if(prevSessions.length){
      const d = avg - Math.round(RT.stats.mean(prevSessions));
      dl.hidden = false;
      dl.className = "delta " + (d < 0 ? "good" : d > 0 ? "bad" : "");
      dl.textContent = d === 0 ? `Same as your last ${prevSessions.length}` : `${d < 0 ? "−" : "+"}${Math.abs(d)} ms vs your last ${prevSessions.length}`;
    } else dl.hidden = true;
    $("tMed").textContent = med; $("tBest").textContent = best; $("tSlow").textContent = slow; $("tCons").textContent = cons + "%";
    const pos = Math.max(0, Math.min(1, (avg - LO) / (HI - LO)));
    $("scale").classList.add("has-pin");
    $("pin").style.left = (pos * 100) + "%"; $("pinTxt").textContent = avg + " ms";
    const bi = vals.indexOf(best), mx = Math.max(...vals);
    $("rbars").innerHTML = vals.map((v, i) => `<div class="rb${i === bi ? " best" : ""}"><i style="height:${Math.max(8, v / mx * 100)}%"></i><span>${v}</span></div>`).join("");

    RT.analysis.add({ t: Date.now(), n: avg, kick: "Reaction time · 5 rounds", value: avg, unit: "ms average", tier,
      tiles: [[med + " ms", "Median"], [best + " ms", "Best"], [slow + " ms", "Slowest"], [cons + "%", "Consistency"]],
      scale: { title: "Performance scale", note: "A simple site benchmark, not a clinical or laboratory classification.", pos, text: avg + " ms", ticks: ["120", "200", "280", "360", "440+"] },
      bars: { title: "Round performance", note: "Your five recorded responses, in milliseconds. Fastest is highlighted.", vals: vals.slice(), labels: vals.map(v => v + ""), best: bi },
      row: [avg + " ms", med + " ms", best + " ms", slow + " ms", cons + "%", tier] });

    setState("result"); lastEnd = performance.now();
    A.classList.add("lock"); setTimeout(() => A.classList.remove("lock"), 600);
    paintPb();
  }

  function toReady(){
    clearTimeout(timer); round = 0; vals = []; signalAt = null;
    setState("ready"); $("scale").classList.remove("has-pin");
    A.focus({ preventScroll: true });
  }

  function act(stamp){
    if(state === "ready"){ nextRound(); return; }
    if(state === "wait"){ falseStart(false); return; }
    if(state === "signal"){ capture(stamp); return; }
    if(performance.now() - lastEnd < 300) return;
    if(state === "false") beginWait();
    else if(state === "round") nextRound();
  }

  RT.arena.guard(A);
  A.addEventListener("pointerdown", ev => {
    if(state === "result") return;
    if(ev.pointerType === "mouse" && ev.button !== 0) return;
    act(ev.timeStamp);
  });
  A.addEventListener("contextmenu", ev => { if(state !== "ready" && state !== "result") ev.preventDefault(); });

  document.addEventListener("keydown", ev => {
    if(ev.key === "Escape"){ if(RT.fs && performance.now() - RT.fs.changed < 400) return; if(state !== "ready" && state !== "result") toReady(); return; }
    if(ev.code !== "Space" && ev.key !== "Enter") return;
    const onA = RT.arena.target(A);
    if(!onA && RT.arena.INTERACTIVE.test((document.activeElement || {}).tagName || "")) return;
    if(!onA && state === "ready") return;       /* arena not on screen: let Space scroll the page */
    if(ev.repeat){ if(onA || state !== "ready") ev.preventDefault(); return; }
    if(state === "result"){ if(onA && performance.now() - lastEnd > 600){ ev.preventDefault(); toReady(); } return; }
    ev.preventDefault();                          /* never scroll the page while playing */
    act(ev.timeStamp);
  });

  $("reset").addEventListener("click", toReady);
  $("again").addEventListener("click", toReady);
  $("share").addEventListener("click", async ev => {
    if(!last) return; const b = ev.currentTarget; b.disabled = true;
    await RT.share({ value: String(last.avg), unit: "MS AVERAGE", sub: `${last.tier} · 5-round reaction time test`,
      text: `My average reaction time is ${last.avg} ms. Can you beat it?`, url: location.href.split("#")[0], file: `reaction-${last.avg}ms.png`, site: location.host });
    b.disabled = false;
  });

  RT.analysis.init({ key: "reaction", heads: ["Average", "Median", "Best", "Slowest", "Consistency", "Rating"], lastIsTier: true, trend: "Average ms", lowerBetter: true, tip: "Judge yourself on the five-round average and test at the same time of day on the same device." });
  paintPb(); paintChrome();
})();
