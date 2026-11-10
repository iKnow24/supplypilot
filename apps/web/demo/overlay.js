// Injected into every page of the demo recording (never shipped with the app).
// Draws a visible cursor, click ripples, a caption bar and full-screen title cards.
// State lives in sessionStorage so captions survive page navigations.
(() => {
  const KEY = "sp-demo-overlay";
  const read = () => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || "{}");
    } catch {
      return {};
    }
  };
  const write = (patch) => sessionStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));

  const css = (el, styles) => Object.assign(el.style, styles);
  const FONT = "var(--font-geist-sans, 'Geist', ui-sans-serif, system-ui, sans-serif)";
  const BRAND = "oklch(0.42 0.085 165)";

  function mount() {
    if (document.getElementById("sp-demo-root") || !document.body) return;
    const root = document.createElement("div");
    root.id = "sp-demo-root";
    root.setAttribute("aria-hidden", "true");
    css(root, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2147483647" });

    // Caption bar
    const cap = document.createElement("div");
    cap.id = "sp-demo-caption";
    css(cap, {
      position: "absolute",
      left: "50%",
      bottom: "48px",
      transform: "translate(-50%, 12px)",
      maxWidth: "1100px",
      padding: "18px 30px",
      borderRadius: "16px",
      background: "rgba(16, 24, 20, 0.88)",
      color: "white",
      font: `500 26px/1.35 ${FONT}`,
      letterSpacing: "-0.01em",
      textAlign: "center",
      boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
      opacity: "0",
      transition: "opacity 350ms ease, transform 350ms ease",
      backdropFilter: "blur(6px)",
    });
    const kicker = document.createElement("div");
    kicker.id = "sp-demo-kicker";
    css(kicker, {
      font: `600 14px/1 ${FONT}`,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#8fe0bd",
      marginBottom: "10px",
    });
    const text = document.createElement("div");
    text.id = "sp-demo-text";
    cap.append(kicker, text);

    // Title card
    const card = document.createElement("div");
    card.id = "sp-demo-card";
    css(card, {
      position: "absolute",
      inset: "0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "22px",
      background: `radial-gradient(1200px 700px at 30% 20%, oklch(0.5 0.09 165), ${BRAND} 55%, oklch(0.3 0.06 165))`,
      color: "white",
      textAlign: "center",
      opacity: "0",
      transition: "opacity 600ms ease",
      font: `400 22px/1.4 ${FONT}`,
    });

    // Cursor
    const cursor = document.createElement("div");
    cursor.id = "sp-demo-cursor";
    cursor.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2.5l15 8.6-6.6 1.6-3.1 6.3z" fill="#111" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    css(cursor, {
      position: "absolute",
      left: "0",
      top: "0",
      transform: "translate(-200px,-200px)",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    });

    root.append(card, cap, cursor);
    document.body.append(root);

    const s = read();
    if (s.cursor) moveCursor(s.cursor.x, s.cursor.y);
    if (s.caption) setCaption(s.caption.kicker, s.caption.text, true);
  }

  function moveCursor(x, y) {
    const c = document.getElementById("sp-demo-cursor");
    if (c) c.style.transform = `translate(${x - 3}px, ${y - 2}px)`;
  }

  function setCaption(kicker, text, instant) {
    const cap = document.getElementById("sp-demo-caption");
    if (!cap) return;
    if (!text) {
      cap.style.opacity = "0";
      cap.style.transform = "translate(-50%, 12px)";
      return;
    }
    document.getElementById("sp-demo-kicker").textContent = kicker || "";
    document.getElementById("sp-demo-kicker").style.display = kicker ? "block" : "none";
    document.getElementById("sp-demo-text").textContent = text;
    if (instant) cap.style.transition = "none";
    cap.style.opacity = "1";
    cap.style.transform = "translate(-50%, 0)";
    if (instant) requestAnimationFrame(() => (cap.style.transition = "opacity 350ms ease, transform 350ms ease"));
  }

  window.__spDemo = {
    caption(kicker, text) {
      write({ caption: text ? { kicker, text } : null });
      setCaption(kicker, text, false);
    },
    card(html) {
      const card = document.getElementById("sp-demo-card");
      if (!card) return;
      if (html) card.innerHTML = html;
      card.style.opacity = html ? "1" : "0";
    },
    ripple(x, y) {
      const root = document.getElementById("sp-demo-root");
      const r = document.createElement("div");
      css(r, {
        position: "absolute",
        left: `${x - 22}px`,
        top: `${y - 22}px`,
        width: "44px",
        height: "44px",
        borderRadius: "999px",
        border: `3px solid ${BRAND}`,
        background: "oklch(0.42 0.085 165 / 0.18)",
        transform: "scale(0.3)",
        opacity: "1",
        transition: "transform 450ms ease-out, opacity 450ms ease-out",
      });
      root.append(r);
      requestAnimationFrame(() => {
        r.style.transform = "scale(1.4)";
        r.style.opacity = "0";
      });
      setTimeout(() => r.remove(), 600);
    },
    highlight(selectorRect) {
      const root = document.getElementById("sp-demo-root");
      const h = document.createElement("div");
      const { x, y, width, height } = selectorRect;
      css(h, {
        position: "absolute",
        left: `${x - 8}px`,
        top: `${y - 6}px`,
        width: `${width + 16}px`,
        height: `${height + 12}px`,
        borderRadius: "12px",
        boxShadow: `0 0 0 3px ${BRAND}, 0 0 0 9999px rgba(16,24,20,0.28)`,
        opacity: "0",
        transition: "opacity 400ms ease",
      });
      root.prepend(h);
      requestAnimationFrame(() => (h.style.opacity = "1"));
      window.__spDemoClearHighlight = () => {
        h.style.opacity = "0";
        setTimeout(() => h.remove(), 400);
      };
    },
  };

  addEventListener(
    "mousemove",
    (e) => {
      moveCursor(e.clientX, e.clientY);
      write({ cursor: { x: e.clientX, y: e.clientY } });
    },
    true,
  );

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
