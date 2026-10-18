/* Reaction Test — shared engine: storage, stats, share card, history, game lock, cursor glow. */
window.RT = window.RT || {};

RT.store = {
  get(k, d){ try { const v = localStorage.getItem("rt:" + k); return v === null ? d : JSON.parse(v); } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem("rt:" + k, JSON.stringify(v)); } catch(e){} },
  del(k){ try { localStorage.removeItem("rt:" + k); } catch(e){} },
  wipe(){ try { Object.keys(localStorage).filter(k => k.indexOf("rt:") === 0).forEach(k => localStorage.removeItem(k)); } catch(e){} }
};

RT.stats = {
  mean: a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
  std(a){ const m = RT.stats.mean(a); return a.length ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) : 0; },
  median(a){ if(!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
};

/* ---------- share ---------- */
RT.shareCard = async function(o){
  try { await document.fonts.ready; } catch(e){}
  const W = 1200, H = 630, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#06080d"; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W/2, H*.46, 20, W/2, H*.46, 520);
  rg.addColorStop(0, "rgba(56,189,248,.24)"); rg.addColorStop(1, "rgba(56,189,248,0)");
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(56,189,248,.35)"; g.lineWidth = 2;
  g.beginPath(); g.roundRect(24, 24, W - 48, H - 48, 34); g.stroke();
  g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 3;
  g.beginPath(); g.arc(92, 92, 17, 0, 7); g.stroke();
  g.fillStyle = "#7dd3fc"; g.beginPath(); g.arc(92, 92, 6.5, 0, 7); g.fill();
  g.textAlign = "left"; g.fillStyle = "#f8fafc"; g.font = "700 28px Inter, system-ui, sans-serif";
  g.fillText("Reaction Test", 124, 102);
  g.textAlign = "center";
  g.fillStyle = "#f8fafc"; g.font = '700 220px "JetBrains Mono", ui-monospace, monospace';
  g.fillText(o.value, W/2, H*.57);
  g.fillStyle = "#7dd3fc"; g.font = '700 36px "JetBrains Mono", ui-monospace, monospace';
  g.fillText(o.unit, W/2, H*.57 + 62);
  g.fillStyle = "rgba(226,232,240,.72)"; g.font = "500 30px Inter, system-ui, sans-serif";
  g.fillText(o.sub, W/2, H*.57 + 116);
  g.fillStyle = "rgba(226,232,240,.4)"; g.font = "600 24px Inter, system-ui, sans-serif";
  g.fillText(o.site || location.host || "reaction test", W/2, H - 56);
  return new Promise(r => c.toBlob(r, "image/png"));
};

RT.share = async function(o){
  const blob = await RT.shareCard(o);
  const file = new File([blob], o.file || "result.png", { type: "image/png" });
  try {
    if(navigator.canShare && navigator.canShare({ files: [file] })){
      await navigator.share({ files: [file], text: o.text, url: o.url });
      return "shared";
    }
  } catch(e){ if(e && e.name === "AbortError") return "cancel"; }
  let copied = false;
  try { await navigator.clipboard.writeText(o.text + " " + o.url); copied = true; } catch(e){}
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  if(RT.toast) RT.toast(copied ? "Image saved and text copied" : "Image saved");
  return "saved";
};

/* ---------- mini bar graph ---------- */
RT.bars = {
  build(el, n){ el.textContent = ""; for(let i = 0; i < n; i++) el.appendChild(document.createElement("i")); },
  paint(el, vals, peakIdx){
    const max = Math.max(1e-9, ...vals), k = el.children;
    for(let i = 0; i < k.length; i++){
      const v = vals[i], on = v !== undefined && v !== null;
      k[i].style.height = on ? Math.max(6, (v / max) * 100) + "%" : "6%";
      k[i].className = on ? (i === peakIdx ? "on pk" : "on") : "";
    }
  }
};

/* ---------- history panel: sparkline + rows (all inside the arena) ----------
   RT.hist.render({ list, spark, rows:[{t, mid, val, num}], label, lowerBetter, empty }) */
RT.hist = {
  spark(sp, rows, o){
    const nums = rows.slice(0, 20).map(r => r.num).filter(v => typeof v === "number").reverse();
    if(nums.length < 2){ sp.hidden = true; return; }
    const W = 300, H = 54, p = 5, lo = Math.min(...nums), hi = Math.max(...nums), rg = hi - lo || 1;
    const pts = nums.map((v, i) => [p + i * (W - 2 * p) / (nums.length - 1), p + (1 - (v - lo) / rg) * (H - 2 * p)]);
    const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
    const last = pts[pts.length - 1];
    sp.innerHTML = '<div class="spark-top"><span></span><span></span></div><svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="' + d + " L" + last[0] + " " + H + " L" + pts[0][0] + " " + H + ' Z"/><path d="' + d + '"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.2"/></svg>';
    const s1 = sp.querySelectorAll(".spark-top span");
    s1[0].textContent = (o.label || "Trend") + " · last " + nums.length;
    const best = o.lowerBetter ? lo : hi;
    s1[1].textContent = "Best " + (Number.isInteger(best) ? best : best.toFixed(2));
    sp.hidden = false;
  },
  render(o){
    const list = o.list, sp = o.spark, rows = o.rows || [];
    list.textContent = "";
    if(!rows.length){
      if(sp) sp.hidden = true;
      const d = document.createElement("div"); d.className = "h-empty"; d.textContent = o.empty || "No results yet. Finish a run and it appears here.";
      list.appendChild(d); return;
    }
    if(sp) RT.hist.spark(sp, rows, o);
    rows.forEach(r => {
      const row = document.createElement("div"); row.className = "h-row";
      const a = document.createElement("span"); a.textContent = new Date(r.t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const b = document.createElement("span"); b.textContent = r.mid;
      const c = document.createElement("b"); c.textContent = r.val;
      row.append(a, b, c); list.appendChild(row);
    });
  }
};

/* ---------- game lock: no accidental scroll while a game runs ---------- */
RT.lock = (function(){
  let on = false, wl = null;
  const html = document.documentElement;
  const allowed = t => t && t.closest && t.closest(".links,.panel");
  const stop = e => { if(on && e.cancelable && !allowed(e.target)) e.preventDefault(); };
  addEventListener("wheel", stop, { passive: false });
  addEventListener("touchmove", stop, { passive: false });
  addEventListener("keydown", e => {
    if(!on) return;
    if(["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," ","Spacebar"].indexOf(e.key) < 0) return;
    if(/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) return;
    e.preventDefault();
  });
  async function keepAwake(){
    try { if("wakeLock" in navigator && !wl){ wl = await navigator.wakeLock.request("screen"); wl.addEventListener("release", () => { wl = null; }); } } catch(e){}
  }
  document.addEventListener("visibilitychange", () => { if(on && document.visibilityState === "visible") keepAwake(); });
  return function(v){
    v = !!v; if(v === on) return;
    on = v; html.classList.toggle("game-lock", v);
    if(v) keepAwake(); else if(wl){ wl.release().catch(() => {}); wl = null; }
  };
})();

/* ---------- cursor glow for arenas and test cards ---------- */
document.addEventListener("pointermove", ev => {
  const t = ev.target.closest && ev.target.closest(".arena,.tcard,.dpanel");
  if(!t) return;
  const r = t.getBoundingClientRect();
  t.style.setProperty("--mx", (ev.clientX - r.left) + "px");
  t.style.setProperty("--my", (ev.clientY - r.top) + "px");
}, { passive: true });

/* Common arena helpers */
RT.arena = {
  /* true when most of the arena is on screen: only then Space/Enter drive the game instead of scrolling the page */
  inView(el){
    const r = el.getBoundingClientRect();
    const vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return vis > Math.min(r.height, innerHeight) * 0.4;
  },
  /* is the arena on screen? (Space starts a test only when you can see it, otherwise it scrolls the page as normal) */
  visible(A){ const r = A.getBoundingClientRect(); return r.bottom > innerHeight * .2 && r.top < innerHeight * .8; },
  /* true when the key press is meant for the arena: it has focus, or nothing has focus and it is on screen */
  target(A){ const el = document.activeElement; return RT.arena.visible(A) && (el === A || !el || el === document.body || el === document.documentElement); },
  INTERACTIVE: /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/,
  /* stop pointerdown on chrome (top bar, buttons, panel) from starting/clicking the game */
  guard(A, sels){
    (sels || [".a-top", ".opts", ".r-actions", ".a-reset", ".panel"]).forEach(s => {
      A.querySelectorAll(s).forEach(el => el.addEventListener("pointerdown", ev => ev.stopPropagation()));
    });
  }
};


/* ---------- analysis + history (dark panels under every test) ----------
   Each test calls RT.analysis.init({key, heads, start}) once, then RT.analysis.add(session) after each run.
   session = { t, kick, value, unit, tier, tiles:[[v,label]x4], scale:{title,note,pos,text,ticks:[..]}, bars:{title,note,vals:[..],labels:[..],best:i}, row:[..] } */
RT.analysis = (function(){
  let cfg = null;
  const $ = id => document.getElementById(id);
  const sk = () => "sess:" + cfg.key;
  const list = () => RT.store.get(sk(), []);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if(cls) e.className = cls; if(txt !== undefined) e.textContent = txt; return e; };
  function ago(t){
    const d = Date.now() - t, m = Math.round(d / 60000);
    if(m < 1) return "just now"; if(m < 60) return m + " min ago";
    const h = Math.round(m / 60); if(h < 24) return h + " h ago";
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const fmt = v => Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
  const bucketOf = t => { const h = new Date(t).getHours(); return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : h >= 17 && h < 22 ? "evening" : "night"; };
  function trendSvg(vals, best, avg, lb){
    const W = 640, H = 190, L = 44, R = 16, T = 16, B = 26, n = vals.length;
    const lo0 = Math.min(...vals, best, avg), hi0 = Math.max(...vals, best, avg), pad = (hi0 - lo0 || 1) * .14, lo = lo0 - pad, hi = hi0 + pad;
    const X = i => L + i * (W - L - R) / (n - 1), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const pts = vals.map((v, i) => [X(i), Y(v)]);
    const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
    const last = pts[n - 1];
    const dots = pts.slice(0, -1).map(q => '<circle class="pt" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2.8"/>').join("");
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Trend across your recent sessions">' +
      [0, .5, 1].map(f => '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + f * (H - T - B)).toFixed(1) + '" y2="' + (T + f * (H - T - B)).toFixed(1) + '"/>').join("") +
      '<text class="ax" x="' + (L - 8) + '" y="' + (T + 4) + '" text-anchor="end">' + fmt(hi0) + '</text><text class="ax" x="' + (L - 8) + '" y="' + (H - B + 4) + '" text-anchor="end">' + fmt(lo0) + '</text>' +
      '<line class="avg" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(avg).toFixed(1) + '" y2="' + Y(avg).toFixed(1) + '"/><text class="lab" x="' + (W - R) + '" y="' + (Y(avg) - 6).toFixed(1) + '" text-anchor="end">average</text>' +
      '<line class="pb" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(best).toFixed(1) + '" y2="' + Y(best).toFixed(1) + '"/><text class="lab pbl" x="' + L + '" y="' + (Y(best) + (lb ? 14 : -6)).toFixed(1) + '">best</text>' +
      '<path class="area" d="' + d + " L" + last[0].toFixed(1) + " " + (H - B) + " L" + pts[0][0].toFixed(1) + " " + (H - B) + ' Z"/><path class="line" d="' + d + '"/>' + dots +
      '<circle class="halo" cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="9"/><circle class="now" cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="4.5"/>' +
      '<text class="ax" x="' + L + '" y="' + (H - 6) + '">oldest</text><text class="ax" x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">latest</text></svg>';
  }
  function drawAnalysis(l){
    const empty = $("anEmpty"), data = $("anData");
    if(!l.length){ empty.hidden = false; data.hidden = true; return; }
    empty.hidden = true; data.hidden = false;
    const cur = l[0], grp = l.filter(s => s.kick === cur.kick && typeof s.n === "number"), chrono = grp.slice().reverse().slice(-20);
    const vals = grp.slice().reverse().map(s => s.n), n = vals.length, lb = !!cfg.lowerBetter;
    const best = lb ? Math.min(...vals) : Math.max(...vals), avg = mean(vals);
    const unit = String(cur.unit || "").split(" ")[0];
    const prevAvg = n > 1 ? mean(vals.slice(0, -1)) : null, delta = prevAvg === null ? null : cur.n - prevAvg;
    const good = d => lb ? d < 0 : d > 0;
    $("anKick").textContent = n + " session" + (n > 1 ? "s" : "") + " · " + cur.kick;
    $("anWhen").textContent = "last played " + ago(cur.t);

    const kp = $("anKpis"); kp.textContent = "";
    const kpi = (label, val, sub, cls) => { const d = el("div", "kpi" + (cls ? " " + cls : "")); d.appendChild(el("span", "k-l", label)); const b = el("b", "", val); d.appendChild(b); d.appendChild(el("span", "k-s", sub)); kp.appendChild(d); };
    kpi("Personal best", fmt(best), unit, "pb");
    kpi("Average", fmt(avg), "across " + n + " session" + (n > 1 ? "s" : ""));
    if(delta === null) kpi("Last vs average", "—", "needs a second session");
    else kpi("Last vs average", (delta === 0 ? "±0" : (delta < 0 ? "−" : "+") + fmt(Math.abs(delta))), delta === 0 ? "right on your average" : (good(delta) ? "better than before" : "off your average"), delta === 0 ? "" : good(delta) ? "up" : "down");
    kpi("Latest result", fmt(cur.n), cur.tier ? cur.tier : unit);

    $("anTrendNote").textContent = n > 1 ? "Last " + chrono.length + " sessions in this mode. Dashed line is your best, dotted line your average." : "One session saved so far.";
    const tr = $("anTrend");
    if(n > 1) tr.innerHTML = trendSvg(chrono.map(s => s.n), best, avg, lb);
    else { tr.textContent = ""; tr.appendChild(el("div", "h-empty", "Play one more session and your trend line appears here.")); }

    const mixEl = $("anMix"); mixEl.textContent = "";
    const tiers = {}; grp.forEach(s => { if(s.tier) tiers[s.tier] = (tiers[s.tier] || 0) + 1; });
    const keys = Object.keys(tiers);
    if(keys.length){
      $("anMixTitle").textContent = "Rating mix"; $("anMixNote").textContent = "How your sessions in this mode were rated.";
      const mx = Math.max(...keys.map(k => tiers[k]));
      keys.sort((a, b) => tiers[b] - tiers[a]).forEach(k => {
        const r = el("div", "mrow" + (k === cur.tier ? " cur" : "")); r.appendChild(el("span", "", k));
        const bar = el("div", "mbar"), f = el("i"); f.style.width = Math.max(6, tiers[k] / mx * 100) + "%"; bar.appendChild(f); r.appendChild(bar); r.appendChild(el("b", "", String(tiers[k]))); mixEl.appendChild(r);
      });
    } else {
      $("anMixTitle").textContent = "Your range"; $("anMixNote").textContent = "Strongest, average and weakest session in this mode.";
      const worst = lb ? Math.max(...vals) : Math.min(...vals), top = Math.max(best, avg, worst, 1e-9);
      [["Best", best, "cur"], ["Average", avg, ""], [lb ? "Slowest" : "Lowest", worst, ""]].forEach(([k, v, c]) => {
        const r = el("div", "mrow " + c); r.appendChild(el("span", "", k));
        const bar = el("div", "mbar"), f = el("i"); f.style.width = Math.max(6, v / top * 100) + "%"; bar.appendChild(f); r.appendChild(bar); r.appendChild(el("b", "", fmt(v))); mixEl.appendChild(r);
      });
    }

    const ins = $("anIns"); ins.textContent = "";
    const card = (label, val, sub, cls) => { const d = el("div", "ins" + (cls ? " " + cls : "")); d.appendChild(el("span", "k-l", label)); d.appendChild(el("b", "", val)); d.appendChild(el("p", "", sub)); ins.appendChild(d); };
    if(n >= 4){
      const rec = vals.slice(-3), prv = vals.slice(Math.max(0, n - 6), n - 3), pct = (mean(rec) - mean(prv)) / (mean(prv) || 1) * 100, imp = lb ? -pct : pct;
      card("Momentum", imp > 2 ? "Improving" : imp < -2 ? "Slipping" : "Holding steady", Math.abs(pct).toFixed(1) + "% " + (imp >= 0 ? "better" : "worse") + " over your last 3 sessions than the 3 before.", imp > 2 ? "up" : imp < -2 ? "down" : "");
    } else card("Momentum", "Needs 4 sessions", "Play " + (4 - n) + " more in this mode to see whether you are improving.", "wait");
    if(n >= 3){
      const r10 = vals.slice(-10), m = mean(r10), sd = Math.sqrt(mean(r10.map(v => (v - m) * (v - m)))), cv = sd / (m || 1);
      card("Steadiness", cv < .05 ? "Very steady" : cv < .12 ? "Steady" : "Variable", "Results move about " + Math.round(cv * 100) + "% from session to session. Steadier scores mean the number is really yours.", cv < .12 ? "up" : "");
    } else card("Steadiness", "Needs 3 sessions", "Play " + (3 - n) + " more to see how consistent you are.", "wait");
    const bk = {}; grp.forEach(s => { const k = bucketOf(s.t); (bk[k] = bk[k] || []).push(s.n); });
    const bks = Object.keys(bk);
    if(n >= 4 && bks.length >= 2){
      bks.sort((a, b) => lb ? mean(bk[a]) - mean(bk[b]) : mean(bk[b]) - mean(bk[a]));
      card("Best time of day", bks[0].charAt(0).toUpperCase() + bks[0].slice(1), "Your " + (lb ? "fastest" : "strongest") + " average (" + fmt(mean(bk[bks[0]])) + " " + unit + ") comes in the " + bks[0] + ", across " + bk[bks[0]].length + " session" + (bk[bks[0]].length > 1 ? "s" : "") + ".", "");
    } else card("Best time of day", "Needs variety", "Play at different times of day (4 sessions in total) and we will show when you perform best.", "wait");

    const today = new Date().toDateString(), todayN = l.filter(s => new Date(s.t).toDateString() === today).length;
    const msg = [];
    if(n === 1) msg.push("First session saved. Play a few more and this page turns into a real progress report.");
    else if(cur.n === best && vals.filter(v => v === best).length === 1) msg.push("That was your best session in this mode so far.");
    else if(delta !== null) msg.push("Your last session was " + fmt(Math.abs(delta)) + " " + unit + " " + (delta === 0 ? "exactly on" : good(delta) ? "better than" : "off") + " your average.");
    if(todayN >= 2) msg.push("You have completed " + todayN + " sessions today.");
    if(cfg.tip) msg.push(cfg.tip);
    $("anCoachTxt").textContent = msg.join(" ");
  }
  function drawHistory(l){
    const wrap = $("histTable"), note = $("histNote"), clr = $("histClear"), sp = $("histSpark");
    wrap.textContent = "";
    clr.hidden = !l.length;
    note.textContent = l.length ? l.length + " saved session" + (l.length > 1 ? "s" : "") + ". Stored only in this browser." : "Saved only in this browser.";
    if(!l.length){ sp.hidden = true; wrap.appendChild(el("div", "h-empty", "No completed sessions yet. Finish a test and your first session is saved here.")); return; }
    const nums = l.slice(0, 20).map(s => s.n).filter(v => typeof v === "number").reverse();
    if(nums.length >= 2){
      const W = 300, H = 54, p = 5, lo = Math.min(...nums), hi = Math.max(...nums), rg = hi - lo || 1;
      const pts = nums.map((v, i) => [p + i * (W - 2 * p) / (nums.length - 1), p + (1 - (v - lo) / rg) * (H - 2 * p)]);
      const d = pts.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" "), last = pts[pts.length - 1];
      sp.innerHTML = '<div class="spark-top"><span></span><span></span></div><svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="' + d + " L" + last[0] + " " + H + " L" + pts[0][0] + " " + H + ' Z"/><path d="' + d + '"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.2"/></svg>';
      const sp1 = sp.querySelectorAll(".spark-top span"); sp1[0].textContent = (cfg.trend || "Trend") + " · last " + nums.length;
      sp1[1].textContent = "Best " + (cfg.lowerBetter ? lo : hi); sp.hidden = false;
    } else sp.hidden = true;
    const t = el("table", "h-table"), th = el("thead"), tr = el("tr");
    ["Date"].concat(cfg.heads).forEach(h => tr.appendChild(el("th", "", h))); th.appendChild(tr); t.appendChild(th);
    const tb = el("tbody");
    l.forEach(s => {
      const r = el("tr");
      r.appendChild(el("td", "mono", new Date(s.t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + new Date(s.t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })));
      s.row.forEach((v, i) => r.appendChild(el("td", i === s.row.length - 1 && cfg.lastIsTier ? "tierc" : "", v)));
      tb.appendChild(r);
    });
    t.appendChild(tb); wrap.appendChild(t);
  }
  function render(){ const l = list(); drawAnalysis(l); drawHistory(l); }
  return {
    init(c){
      cfg = c;
      $("anStart").addEventListener("click", () => {
        const a = document.getElementById("test"); if(a) a.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => { const ar = document.getElementById("arena"); if(ar) ar.focus({ preventScroll: true }); }, 450);
      });
      $("histClear").addEventListener("click", () => {
        if(!confirm("Clear all saved sessions for this test from this browser?")) return;
        RT.store.del(sk()); render();
      });
      render();
    },
    add(s){
      const l = list(); l.unshift(s); RT.store.set(sk(), l.slice(0, 30));
      const sc = $("scale");                         /* result-view scale: dot slides to this session's position */
      if(sc && s.scale){
        const tk = sc.querySelector(".scale-ticks");
        if(tk && s.scale.ticks && tk.children.length !== s.scale.ticks.length){ tk.textContent = ""; s.scale.ticks.forEach(t => tk.appendChild(el("span", "", t))); }
        sc.classList.add("has-pin"); $("pin").style.left = Math.max(0, Math.min(1, s.scale.pos)) * 100 + "%"; $("pinTxt").textContent = s.scale.text;
      }
      render();
    },
    render
  };
})();
