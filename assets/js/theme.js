/* Theme manager. Loaded synchronously in <head> so the right theme is set before first paint.
   Order of precedence: saved choice (rt:theme) -> system preference. */
(() => {
  const KEY = "rt:theme", root = document.documentElement;
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  const saved = () => { try { const v = localStorage.getItem(KEY); return v === "dark" || v === "light" ? v : null; } catch(e){ return null; } };
  const current = () => saved() || (mq && mq.matches ? "dark" : "light");

  function paint(t){
    root.dataset.theme = t;
    root.style.colorScheme = t;
    const m = document.querySelector('meta[name="theme-color"]');
    if(m) m.setAttribute("content", t === "dark" ? "#0c111a" : "#f4f6fa");
    document.querySelectorAll("[data-theme-toggle]").forEach(b => {
      b.setAttribute("aria-pressed", String(t === "dark"));
      if(b.classList.contains("theme-btn")) b.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
  }
  paint(current());

  function set(t, persist){
    if(persist){ try { localStorage.setItem(KEY, t); } catch(e){} }
    const calm = !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    if(calm){ root.classList.add("theme-anim"); clearTimeout(set.t); set.t = setTimeout(() => root.classList.remove("theme-anim"), 420); }
    paint(t);
  }

  document.addEventListener("DOMContentLoaded", () => {
    paint(current());
    document.addEventListener("click", ev => {
      const b = ev.target.closest && ev.target.closest("[data-theme-toggle]");
      if(!b) return;
      set(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
  });
  if(mq){ const f = () => { if(!saved()) set(current(), false); }; mq.addEventListener ? mq.addEventListener("change", f) : mq.addListener(f); }
  window.addEventListener("storage", e => { if(e.key === KEY) paint(current()); });
})();
