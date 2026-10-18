/* Reaction Test — site chrome: menus, scroll styles, reveal, TOC, contact helpers. */
window.RT = window.RT || {};
(function(){
  document.documentElement.classList.add("js");
  const header = document.querySelector(".site-header");
  const toggle = document.getElementById("navToggle");
  const dds = [].slice.call(document.querySelectorAll(".dd"));

  RT.toast = function(msg){
    const t = document.getElementById("toast"); if(!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(RT._tt); RT._tt = setTimeout(() => t.classList.remove("show"), 2400);
  };

  const closeAll = except => dds.forEach(d => { if(d !== except){ clearTimeout(d._t); d.classList.remove("open"); d.querySelector(".dd-btn").setAttribute("aria-expanded", "false"); } });
  const closeMobile = () => { header.classList.remove("nav-open"); toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Open menu"); };
  const menuOpen = () => dds.some(d => d.classList.contains("open")) || header.classList.contains("nav-open");

  /* dropdowns: hover opens (mouse only), click toggles, only one open at a time,
     outside click / Esc / focus leaving / choosing a link closes. State lives only in the .open class. */
  const mobile = window.matchMedia("(max-width:860px)");
  const setOpen = (d, on) => { d.classList.toggle("open", on); d.querySelector(".dd-btn").setAttribute("aria-expanded", String(on)); };
  dds.forEach(d => {
    const btn = d.querySelector(".dd-btn");
    btn.addEventListener("click", ev => {
      ev.stopPropagation(); clearTimeout(d._t);
      const on = !d.classList.contains("open");
      closeAll(d); setOpen(d, on);
    });
    d.addEventListener("pointerenter", ev => {
      if(ev.pointerType !== "mouse" || mobile.matches) return;
      clearTimeout(d._t); d._t = setTimeout(() => { closeAll(d); setOpen(d, true); }, 70);
    });
    d.addEventListener("pointerleave", ev => {
      if(ev.pointerType !== "mouse" || mobile.matches) return;
      clearTimeout(d._t); d._t = setTimeout(() => setOpen(d, false), 220);
    });
    d.addEventListener("focusout", ev => { if(!mobile.matches && ev.relatedTarget && !d.contains(ev.relatedTarget)) setOpen(d, false); });
    d.querySelectorAll(".dd-item").forEach(a => a.addEventListener("click", () => { closeAll(); closeMobile(); }));
  });
  toggle.addEventListener("click", ev => {
    ev.stopPropagation();
    const open = !header.classList.contains("nav-open");
    header.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if(!open) closeAll();
  });
  document.addEventListener("click", ev => { if(!header.contains(ev.target)){ closeAll(); closeMobile(); } });
  document.addEventListener("keydown", ev => { if(ev.key === "Escape"){ closeAll(); closeMobile(); } });

  /* an open menu: the first click on the arena only closes it */
  document.querySelectorAll(".arena").forEach(a => a.addEventListener("pointerdown", ev => {
    if(menuOpen()){ ev.stopImmediatePropagation(); closeAll(); closeMobile(); }
  }, true));

  /* scrolled header + progress hairline */
  const prog = document.querySelector(".progress");
  let tick = false;
  const onScroll = () => {
    tick = false;
    const y = window.scrollY || 0;
    header.classList.toggle("scrolled", y > 8);
    if(prog){ const h = document.documentElement.scrollHeight - innerHeight; prog.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")"; }
  };
  addEventListener("scroll", () => { if(!tick){ tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* reveal on scroll */
  const rv = [].slice.call(document.querySelectorAll("[data-reveal]"));
  if("IntersectionObserver" in window && rv.length){
    const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: .05 });
    rv.forEach((el, i) => { el.style.setProperty("--d", ((i % 4) * .06) + "s"); io.observe(el); });
  } else rv.forEach(el => el.classList.add("in"));

  /* table of contents: follows the reader (last section whose top has passed the header; last item at page end) */
  const toc = [].slice.call(document.querySelectorAll(".toc a[href^='#']"));
  if(toc.length){
    const secs = toc.map(a => document.getElementById(a.getAttribute("href").slice(1)));
    const box = toc[0].closest(".toc");
    let on = -1, tick = false;
    const mark = i => {
      if(i === on) return; on = i;
      toc.forEach((a, k) => { a.classList.toggle("on", k === i); if(k === i) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
      const a = toc[i];                       /* keep the active item visible inside a scrollable list */
      if(box && box.scrollHeight > box.clientHeight + 2){
        const top = a.offsetTop - box.offsetTop;
        if(top < box.scrollTop + 40 || top > box.scrollTop + box.clientHeight - 60) box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: "smooth" });
      }
    };
    const update = () => {
      tick = false;
      const line = (document.querySelector(".site-header") ? document.querySelector(".site-header").offsetHeight : 58) + 90;
      let cur = 0;
      secs.forEach((s, i) => { if(s && s.getBoundingClientRect().top <= line) cur = i; });
      if(innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = secs.length - 1;
      mark(cur);
    };
    addEventListener("scroll", () => { if(!tick){ tick = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
    update();
  }

  /* analysis empty state: take the visitor back to the test box */
  const as = document.getElementById("analysisStart");
  if(as) as.addEventListener("click", () => {
    const t = document.getElementById("test"); if(!t) return;
    t.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => { const a = t.querySelector(".arena"); a && a.focus({ preventScroll: true }); }, 450);
  });

  /* contact: copy email + mailto form */
  document.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); RT.toast("Email copied"); } catch(e){ RT.toast("Copy failed. Select the address manually."); }
  }));
  const cf = document.getElementById("contactForm");
  if(cf) cf.addEventListener("submit", ev => {
    ev.preventDefault();
    const d = new FormData(cf), to = cf.dataset.to;
    const subj = "[" + d.get("topic") + "] " + (d.get("subject") || "Message from the website");
    const body = (d.get("message") || "") + "\n\n— " + (d.get("name") || "");
    location.href = "mailto:" + to + "?subject=" + encodeURIComponent(subj) + "&body=" + encodeURIComponent(body);
    RT.toast("Opening your email app…");
  });

  /* privacy: wipe everything this site saved in the browser */
  const wipe = document.getElementById("wipeData");
  if(wipe){
    const count = () => { try { return Object.keys(localStorage).filter(k => k.indexOf("rt:") === 0).length; } catch(e){ return 0; } };
    const out = document.getElementById("wipeCount");
    const paint = () => { if(out) out.textContent = count() ? count() + " saved item" + (count() > 1 ? "s" : "") + " in this browser" : "Nothing saved in this browser"; };
    wipe.addEventListener("click", () => { RT.store && RT.store.wipe(); paint(); RT.toast("Saved data deleted"); });
    paint();
  }
})();
