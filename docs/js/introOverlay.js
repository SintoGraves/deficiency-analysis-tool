/*-------------------------------------------------
 * /docs/js/introOverlay.js
 * DDT Intro Overlay — particle text fly-in/fly-out
 * - Runs as a fixed overlay, then self-destructs
 * - No dependencies on DDT modules
 * - Exposes: window.DDTIntro.runOnce(options)
 *-------------------------------------------------*/
(function () {
  const DEFAULTS = {
    words: ["Flow Diagram", "DEMO"],
    cycles: 1,                 // how many full word-sequences before exit
    background: "#0b0f14",
    particleColor: "rgba(235,245,255,0.95)",
    sampleStep: 5,             // higher = fewer particles = faster
    particleSize: 2,
    fontScale: 0.17,
    inDuration: 1200,
    holdDuration: 450,
    outDuration: 900,
    pauseDuration: 200,
    maxParticles: 5200
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
      this.x = this.sx; this.y = this.sy;
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

  function buildOverlayDOM() {
    const overlay = document.createElement("div");
    overlay.id = "ddtIntroOverlay";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:9999",
      "display:block",
      "background:#0b0f14"
    ].join(";");

    const canvas = document.createElement("canvas");
    canvas.id = "ddtIntroCanvas";
    canvas.style.cssText = "width:100%;height:100%;display:block;";
    overlay.appendChild(canvas);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Skip";
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

    document.body.appendChild(overlay);
    return { overlay, canvas, btn };
  }

  async function runOnce(userOptions) {
    const opt = { ...DEFAULTS, ...(userOptions || {}) };

    // Respect reduced motion
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return; // simply skip
    }

    const { overlay, canvas, btn } = buildOverlayDOM();
    const ctx = canvas.getContext("2d", { alpha: false });

    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d");

    let rafId = 0;
    let done = false;

    function teardown() {
      done = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    function finish(resolve) {
      // quick fade then teardown
      overlay.style.transition = "opacity 250ms ease";
      overlay.style.opacity = "0";
      setTimeout(() => {
        teardown();
        resolve();
      }, 260);
    }

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    function resize() {
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      canvas.width = w; canvas.height = h;
      off.width = w; off.height = h;
    }

    resize();
    window.addEventListener("resize", resize);

    btn.addEventListener("click", () => {
      // Skip immediately
      if (done) return;
      // resolve will be wired below
      skipRequested = true;
    });

    let skipRequested = false;

    const SETTINGS = {
      background: opt.background,
      particleColor: opt.particleColor,
      sampleStep: opt.sampleStep,
      particleSize: opt.particleSize,
      fontScale: opt.fontScale,
      inDuration: opt.inDuration,
      holdDuration: opt.holdDuration,
      outDuration: opt.outDuration,
      pauseDuration: opt.pauseDuration,
      inEasePower: 2.2,
      outSpeed: 1.9,
      drift: 0.20,
      maxParticles: opt.maxParticles
    };

    function fontPx(w, h) {
      return Math.floor(Math.min(w, h) * SETTINGS.fontScale);
    }

    function rasterizeWordTargets(text) {
      const w = canvas.width, h = canvas.height;
      offCtx.clearRect(0, 0, w, h);
      offCtx.fillStyle = "#ffffff";
      offCtx.textAlign = "center";
      offCtx.textBaseline = "middle";
      offCtx.font = `800 ${fontPx(w, h)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      offCtx.fillText(text, w * 0.5, h * 0.5);

      const img = offCtx.getImageData(0, 0, w, h).data;
      const targets = [];
      const step = SETTINGS.sampleStep;

      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          const i = (y * w + x) * 4;
          if (img[i + 3] > 10) targets.push({ x, y });
        }
      }

      if (targets.length > SETTINGS.maxParticles) {
        const ratio = targets.length / SETTINGS.maxParticles;
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
        for (const pt of particles) pt.setBlowoutVelocity(w, h, SETTINGS.outSpeed, SETTINGS.drift);
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
          finish(resolve);
          return;
        }

        // Exit condition after N sequences
        if (completedSequences >= opt.cycles) {
          finish(resolve);
          return;
        }

        ctx.fillStyle = SETTINGS.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const t = now - phaseStart;

        if (phase === PHASE.IN) {
          const u = easeInOut(t / SETTINGS.inDuration, SETTINGS.inEasePower);
          for (const p of particles) {
            p.x = lerp(p.sx, p.tx, u) + p.jx * 0.35;
            p.y = lerp(p.sy, p.ty, u) + p.jy * 0.35;
          }
          if (t >= SETTINGS.inDuration) setPhase(PHASE.HOLD);
        } else if (phase === PHASE.HOLD) {
          for (const p of particles) {
            p.x = p.tx + p.jx * 0.25;
            p.y = p.ty + p.jy * 0.25;
          }
          if (t >= SETTINGS.holdDuration) setPhase(PHASE.OUT);
        } else if (phase === PHASE.OUT) {
          const u = easeInOut(t / SETTINGS.outDuration, 1.6);
          for (const p of particles) {
            p.x += p.vx * (1 + u * 2.5);
            p.y += p.vy * (1 + u * 2.5);
            p.x += (Math.random() - 0.5) * SETTINGS.drift;
            p.y += (Math.random() - 0.5) * SETTINGS.drift;
          }
          if (t >= SETTINGS.outDuration) {
            nextWord();
            setPhase(PHASE.PAUSE);
          }
        } else if (phase === PHASE.PAUSE) {
          if (t >= SETTINGS.pauseDuration) setPhase(PHASE.IN);
        }

        ctx.fillStyle = SETTINGS.particleColor;
        const s = SETTINGS.particleSize;
        for (const p of particles) ctx.fillRect(p.x, p.y, s, s);

        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    });
  }

  window.DDTIntro = { runOnce };
})();
