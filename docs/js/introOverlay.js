/*-------------------------------------------------
 * /docs/js/introOverlay.js
 * DDT Intro Overlay (Hardened)
 * - Fixed overlay canvas; isolated from app layout
 * - Saves/restores html/body styles to prevent reflow/column collapse
 * - Cleans up RAF + listeners reliably (skip-safe, error-safe)
 * - Exposes: window.DDTIntro.runOnce(options)
 *-------------------------------------------------*/
(function () {
  const DEFAULTS = {
    words: ["Flow Diagram", "DEMO"],
    cycles: 1,

    background: "#0b0f14",
    particleColor: "rgba(235,245,255,0.95)",

    // Performance
    sampleStep: 6,          // higher = fewer particles
    particleSize: 2,
    maxParticles: 4200,

    // Typography
    fontScale: 0.17,        // relative to min(w,h)
    fontWeight: 800,

    // Timing (ms)
    inDuration: 1200,
    holdDuration: 450,
    outDuration: 900,
    pauseDuration: 200,

    // Motion tuning
    inEasePower: 2.2,
    outSpeed: 1.9,
    drift: 0.20,

    // Overlay UI
    showSkip: true,
    skipLabel: "Skip",

    // Safety
    respectReducedMotion: true
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t, p) {
    t = clamp(t, 0, 1);
    if (t < 0.5) return 0.5 * Math.pow(2 * t, p);
    return 1 - 0.5 * Math.pow(2 * (1 - t), p);
  }

  class Particle {
    constructor() {
      this.x = this.y = 0;
      this.sx = this.sy = 0;
      this.tx = this.ty = 0;
      this.vx = this.vy = 0;
      this.jx = (Math.random() - 0.5);
      this.jy = (Math.random() - 0.5);
    }
    setStartRandom(w, h) {
      const cx = w * 0.5, cy = h * 0.5;
      const r = Math.max(w, h) * (0.55 + Math.random() * 0.85);
      const a = Math.random() * Math.PI * 2;
      this.sx = cx + Math.cos(a) * r;
      this.sy = cy + Math.sin(a) * r;
      this.x = this.sx;
      this.y = this.sy;
    }
    setTarget(tx, ty) { this.tx = tx; this.ty = ty; }
    setBlowoutVelocity(w, h, outSpeed, drift) {
      const cx = w * 0.5, cy = h * 0.5;
      const dx = this.x - cx, dy = this.y - cy;
      const mag = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / mag, ny = dy / mag;
      const rand = 0.55 + Math.random() * 1.05;
      this.vx = (nx * outSpeed + (Math.random() - 0.5) * drift) * rand;
      this.vy = (ny * outSpeed + (Math.random() - 0.5) * drift) * rand;
    }
  }

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (_) {
      return false;
    }
  }

  function snapshotStyles(el, props) {
    const snap = {};
    for (const p of props) snap[p] = el.style[p] || "";
    return snap;
  }

  function restoreStyles(el, snap) {
    for (const [k, v] of Object.entries(snap)) el.style[k] = v;
  }

  function buildOverlayDOM(opt) {
    const overlay = document.createElement("div");
    overlay.id = "ddtIntroOverlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:9999",
      "display:block",
      `background:${opt.background}`,
      "pointer-events:auto" // capture clicks (skip)
    ].join(";");

    const canvas = document.createElement("canvas");
    canvas.id = "ddtIntroCanvas";
    canvas.style.cssText = "width:100%;height:100%;display:block;";
    overlay.appendChild(canvas);

    let btn = null;
    if (opt.showSkip) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = opt.skipLabel || "Skip";
      btn.setAttribute("aria-label", "Skip intro");
      btn.style.cssText = [
        "position:fixed",
        "top:16px",
        "right:16px",
        "z-index:10000",
        "padding:10px 12px",
        "border-radius:10px",
        "border:1px solid rgba(255,255,255,.2)",
        "background:rgba(0,0,0,.35)",
        "color:#fff",
        "cursor:pointer"
      ].join(";");
      overlay.appendChild(btn);
    }

    document.body.appendChild(overlay);
    return { overlay, canvas, btn };
  }

  async function runOnce(userOptions) {
    const opt = { ...DEFAULTS, ...(userOptions || {}) };

    if (opt.respectReducedMotion && prefersReducedMotion()) {
      return; // skip entirely
    }

    // ---- HARDENING: snapshot/lock global styles to prevent layout shifts ----
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    const htmlProps = ["overflow", "width", "height"];
    const bodyProps = ["overflow", "width", "height", "position", "top", "left", "right", "margin", "padding"];

    const htmlSnap = snapshotStyles(htmlEl, htmlProps);
    const bodySnap = snapshotStyles(bodyEl, bodyProps);

    // Also snapshot scroll position if we need to lock the page
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;

    // Lock scrolling in a way that does not create scrollbar width jitter:
    // - hide overflow on html/body
    // - pin body position so scroll doesn't jump
    // This is more robust than overflow:hidden alone on some browsers.
    function lockPage() {
      htmlEl.style.overflow = "hidden";
      bodyEl.style.overflow = "hidden";

      bodyEl.style.position = "fixed";
      bodyEl.style.top = `-${scrollY}px`;
      bodyEl.style.left = "0";
      bodyEl.style.right = "0";
      bodyEl.style.width = "100%";
    }

    function unlockPage() {
      restoreStyles(htmlEl, htmlSnap);
      restoreStyles(bodyEl, bodySnap);

      // Restore scroll position if we pinned the body
      // (parse the pinned top if present)
      const top = bodyEl.style.top;
      let restoredY = scrollY;
      if (top && top.startsWith("-")) {
        const n = parseInt(top.replace("px", ""), 10);
        if (!Number.isNaN(n)) restoredY = -n;
      }
      window.scrollTo(scrollX, restoredY);
    }

    lockPage();

    // ---- Build overlay DOM ----
    const { overlay, canvas, btn } = buildOverlayDOM(opt);

    // Canvas contexts
    const ctx = canvas.getContext("2d", { alpha: false });
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d", { willReadFrequently: true }); // resolves warning

    // Runtime state
    let rafId = 0;
    let done = false;
    let skipRequested = false;

    function safeCancelRAF() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function teardown() {
      if (done) return;
      done = true;

      safeCancelRAF();
      window.removeEventListener("resize", onResize);

      // Remove overlay from DOM
      try {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      } catch (_) {}

      // Restore global styles LAST
      try {
        unlockPage();
      } catch (_) {}
    }

    function fadeAndFinish(resolve) {
      // Ensure finish is idempotent
      if (done) return;

      overlay.style.transition = "opacity 240ms ease";
      overlay.style.opacity = "0";
      setTimeout(() => {
        teardown();
        resolve();
      }, 260);
    }

    // Ensure skip works even if animation fails
    if (btn) {
      btn.addEventListener("click", () => { skipRequested = true; }, { passive: true });
    }

    // DPI-aware sizing
    function getDpr() {
      return Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    }

    function onResize() {
      const dpr = getDpr();
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);

      canvas.width = w;
      canvas.height = h;
      off.width = w;
      off.height = h;

      // Important: reset transform to avoid any lingering transforms
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    onResize();
    window.addEventListener("resize", onResize);

    // Rasterize word into pixel targets
    function fontPx(w, h) {
      return Math.floor(Math.min(w, h) * opt.fontScale);
    }

    function rasterizeWordTargets(text) {
      const w = canvas.width, h = canvas.height;

      offCtx.clearRect(0, 0, w, h);
      offCtx.fillStyle = "#ffffff";
      offCtx.textAlign = "center";
      offCtx.textBaseline = "middle";
      offCtx.font = `${opt.fontWeight} ${fontPx(w, h)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      offCtx.fillText(text, w * 0.5, h * 0.5);

      const img = offCtx.getImageData(0, 0, w, h).data;
      const targets = [];

      const step = opt.sampleStep;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const i = (y * w + x) * 4;
          if (img[i + 3] > 10) targets.push({ x, y });
        }
      }

      if (targets.length > opt.maxParticles) {
        const ratio = targets.length / opt.maxParticles;
        const reduced = [];
        for (let i = 0; i < targets.length; i += ratio) reduced.push(targets[Math.floor(i)]);
        return reduced;
      }

      return targets;
    }

    let particles = [];
    let wordIndex = 0;
    let completedSequences = 0;

    const PHASE = { IN: 0, HOLD: 1, OUT: 2, PAUSE: 3 };
    let phase = PHASE.IN;
    let phaseStart = performance.now();
    let targets = rasterizeWordTargets(opt.words[wordIndex]);

    function syncParticlesToTargets() {
      const w = canvas.width, h = canvas.height;

      if (particles.length < targets.length) {
        for (let i = particles.length; i < targets.length; i++) particles.push(new Particle());
      } else if (particles.length > targets.length) {
        particles.length = targets.length;
      }

      for (let i = 0; i < targets.length; i++) {
        const p = particles[i];
        p.setStartRandom(w, h);
        p.setTarget(targets[i].x, targets[i].y);
      }
    }

    function nextWord() {
      wordIndex++;
      if (wordIndex >= opt.words.length) {
        wordIndex = 0;
        completedSequences++;
      }
      targets = rasterizeWordTargets(opt.words[wordIndex]);
      syncParticlesToTargets();
    }

    function setPhase(p) {
      phase = p;
      phaseStart = performance.now();

      const w = canvas.width, h = canvas.height;
      if (phase === PHASE.OUT) {
        for (const pt of particles) pt.setBlowoutVelocity(w, h, opt.outSpeed, opt.drift);
      }
      if (phase === PHASE.IN) {
        for (const pt of particles) pt.setStartRandom(w, h);
      }
    }

    syncParticlesToTargets();
    setPhase(PHASE.IN);

    return new Promise((resolve) => {
      function tick(now) {
        if (done) return;

        if (skipRequested) {
          fadeAndFinish(resolve);
          return;
        }

        if (completedSequences >= opt.cycles) {
          fadeAndFinish(resolve);
          return;
        }

        // Clear frame
        ctx.fillStyle = opt.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const t = now - phaseStart;

        if (phase === PHASE.IN) {
          const u = easeInOut(t / opt.inDuration, opt.inEasePower);
          for (const p of particles) {
            p.x = lerp(p.sx, p.tx, u) + p.jx * 0.35;
            p.y = lerp(p.sy, p.ty, u) + p.jy * 0.35;
          }
          if (t >= opt.inDuration) setPhase(PHASE.HOLD);
        } else if (phase === PHASE.HOLD) {
          for (const p of particles) {
            p.x = p.tx + p.jx * 0.25;
            p.y = p.ty + p.jy * 0.25;
          }
          if (t >= opt.holdDuration) setPhase(PHASE.OUT);
        } else if (phase === PHASE.OUT) {
          const u = easeInOut(t / opt.outDuration, 1.6);
          for (const p of particles) {
            p.x += p.vx * (1 + u * 2.5);
            p.y += p.vy * (1 + u * 2.5);
            p.x += (Math.random() - 0.5) * opt.drift;
            p.y += (Math.random() - 0.5) * opt.drift;
          }
          if (t >= opt.outDuration) {
            nextWord();
            setPhase(PHASE.PAUSE);
          }
        } else if (phase === PHASE.PAUSE) {
          if (t >= opt.pauseDuration) setPhase(PHASE.IN);
        }

        // Draw particles
        ctx.fillStyle = opt.particleColor;
        const s = opt.particleSize;
        for (const p of particles) ctx.fillRect(p.x, p.y, s, s);

        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    }).finally(() => {
      // Absolute guarantee of cleanup
      try { teardown(); } catch (_) {}
    });
  }

  window.DDTIntro = { runOnce };
})();
