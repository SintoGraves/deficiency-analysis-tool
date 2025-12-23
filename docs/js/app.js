/*-------------------------------------------------
 * /docs/js/app.js
 * Deficiency Decision Tool (POC)
 * - Loads modules (no build step, GitHub Pages /docs root)
 * - Loads manual (front-matter) into left panel
 * - Runs wizard in upper-right
 * - Renders node notes/directives/hints into lower-right
 * - Hides trace by default; enable with ?debug=1
 * - "Generate Document" navigates to /docs/report.html
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});
  DDT.version = "0.2.0";

  // ===== Module loading (classic scripts; no bundler) =====
  const modulePaths = [
    "./js/data/packLoader.js",
    "./js/state/caseStore.js",
    "./js/engine/validators.js",
    "./js/engine/actions.js",
    "./js/engine/decisionEngine.js"
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  async function loadModules() {
    for (const p of modulePaths) await loadScript(p);
  }

  // ===== DOM helpers =====
  function qs(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function renderNotesPanel(nodeId, node, meta, notesMetaEl, notesBodyEl) {
    if (!notesMetaEl || !notesBodyEl) return;

    const packId = (meta && meta.packId) ? meta.packId : "-";
    notesMetaEl.textContent = `Pack: ${packId}  |  Step: ${nodeId || "-"}`;

    // Notes content sources (optional in packs)
    const notes = Array.isArray(node && node.notes) ? node.notes : [];
    const directives = Array.isArray(node && node.directives) ? node.directives : [];
    const hints = Array.isArray(node && node.hints) ? node.hints : [];

    // Also: allow simple string fields for convenience
    const noteText = (node && typeof node.note === "string") ? node.note.trim() : "";
    const directiveText = (node && typeof node.directive === "string") ? node.directive.trim() : "";
    const hintText = (node && typeof node.hint === "string") ? node.hint.trim() : "";

    let html = "";

    // Directives first (most important)
    if (directives.length || directiveText) {
      html += `<div class="note-block">
        <div class="note-kind">Directive</div>
        <div class="note-title">Required Actions</div>
        <div class="note-body">${esc(
          directives.length ? directives.join("\n") : directiveText
        )}</div>
      </div>`;
    }

    // Notes next
    if (notes.length || noteText) {
      if (notes.length) {
        notes.forEach((n) => {
          const t = (n && n.title) ? n.title : "Note";
          const b = (n && n.body) ? n.body : "";
          html += `<div class="note-block">
            <div class="note-kind">Note</div>
            <div class="note-title">${esc(t)}</div>
            <div class="note-body">${esc(b)}</div>
          </div>`;
        });
      } else {
        html += `<div class="note-block">
          <div class="note-kind">Note</div>
          <div class="note-title">Note</div>
          <div class="note-body">${esc(noteText)}</div>
        </div>`;
      }
    }

    // Hints last
    if (hints.length || hintText) {
      html += `<div class="note-block">
        <div class="note-kind">Hint</div>
        <div class="note-title">Guidance</div>
        <div class="note-body">${esc(
          hints.length ? hints.join("\n") : hintText
        )}</div>
      </div>`;
    }

    if (!html) {
      html = `<div class="hint">No additional notes for this step.</div>`;
    }

    notesBodyEl.innerHTML = html;
  }

  async function loadManual(manualStatusEl, manualBodyEl) {
    if (!manualStatusEl || !manualBodyEl) return;
    try {
      const res = await fetch("./manual/front-matter.html", { cache: "no-store" });
      if (!res.ok) throw new Error(`Manual fetch failed (${res.status})`);
      manualBodyEl.innerHTML = await res.text();
      manualStatusEl.textContent = "Front matter loaded";
    } catch (e) {
      console.error(e);
      manualStatusEl.textContent = "Manual not available";
      manualBodyEl.innerHTML = `<p class="hint">Unable to load <code>/docs/manual/front-matter.html</code>.</p>`;
    }
  }

  async function main() {
    await loadModules();

    // ===== Debug toggle (trace hidden unless ?debug=1) =====
    const debug = new URLSearchParams(location.search).get("debug") === "1";

    // ===== UI elements =====
    const elScreen = qs("screen");
    const elBack = qs("btnBack");
    const elReset = qs("btnReset");
    const elStartOver = qs("btnStartOver");
    const elPackSelect = qs("packSelect");
    const elGoReport = qs("btnGoReport");

    const elManualStatus = qs("manualStatus");
    const elManualBody = qs("manualBody");

    const elNotesMeta = qs("notesMeta");
    const elNotesBody = qs("notesBody");

    // Debug trace elements (optional on page)
    const elDebugWrap = qs("debugTraceWrap");
    const elTrace = qs("trace");
    const elTraceMeta = qs("traceMeta");
    if (elDebugWrap) elDebugWrap.hidden = !debug;

    // Load manual in left panel
    await loadManual(elManualStatus, elManualBody);

    // Create store + engine
    const store = DDT.createCaseStore();

    // If your decisionEngine.js supports notes targets, we pass them.
    // If it does not, passing extra options is harmless; we also render notes ourselves on node change.
    const engine = DDT.createDecisionEngine({
      renderTarget: elScreen,
      notesTarget: elNotesBody,
      notesMetaTarget: elNotesMeta,
      debug: debug,

      // Called whenever trace updates; we only display trace if debug enabled and panel exists.
      onTraceUpdated: () => {
        const meta = store.getMeta();
        if (elBack) elBack.disabled = !store.canGoBack();

        if (debug && elTrace && elTraceMeta) {
          elTrace.textContent = JSON.stringify(store.getTrace(), null, 2);
          elTraceMeta.textContent = `Pack: ${meta.packId || "-"}  |  Node: ${meta.nodeId || "-"}  |  Steps: ${meta.steps || 0}`;
        }
      },

      // Optional hook: if engine exposes onNodeRendered, we will receive it.
      onNodeRendered: (nodeId, node) => {
        const meta = store.getMeta();
        renderNotesPanel(nodeId, node, meta, elNotesMeta, elNotesBody);
      }
    });

    // Compatibility: if engine doesn't call onNodeRendered, we will render notes after start/answer/back
    function renderNotesFromCurrent() {
      try {
        const meta = store.getMeta();
        // pack is internal to engine, so we rely on engine exposing getCurrentNode() if available
        if (typeof engine.getCurrentNode === "function") {
          const cur = engine.getCurrentNode();
          renderNotesPanel(meta.nodeId, cur, meta, elNotesMeta, elNotesBody);
        } else {
          // If no accessor exists, leave notes as-is; once you add notes support in engine, it will populate.
          if (elNotesBody && !elNotesBody.dataset.warned) {
            elNotesBody.dataset.warned = "1";
            elNotesBody.innerHTML = `<div class="hint">
              Notes panel is ready. To populate it automatically, ensure <code>decisionEngine.js</code>
              passes the current node into <code>onNodeRendered(nodeId, node)</code>.
            </div>`;
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function startPack(packId) {
      const pack = await DDT.loadPack(packId);
      store.reset();
      engine.loadPack(pack, store);
      engine.start();
      renderNotesFromCurrent();
    }

    // Controls
    if (elPackSelect) elPackSelect.addEventListener("change", () => startPack(elPackSelect.value));
    if (elStartOver) elStartOver.addEventListener("click", () => startPack(elPackSelect.value));

    if (elReset) elReset.addEventListener("click", () => {
      store.reset();
      startPack(elPackSelect ? elPackSelect.value : "figure1");
    });

    if (elBack) elBack.addEventListener("click", () => {
      engine.back();
      renderNotesFromCurrent();
    });

    if (elGoReport) elGoReport.addEventListener("click", () => {
      // For now, just navigate. Later, report.html will read stored case/trace.
      try {
        localStorage.setItem("ddt_last_case", JSON.stringify({
          meta: store.getMeta(),
          state: store.getState(),
          trace: store.getTrace()
        }));
      } catch (e) {
        // ignore storage failures
      }
      window.location.href = "./report.html";
    });

    // Start
    await startPack(elPackSelect ? elPackSelect.value : "figure1");
  }

  main().catch((err) => {
    console.error(err);
    const el = document.getElementById("screen");
    if (el) {
      el.innerHTML = `<div class="screen">
        <div class="node-type">error</div>
        <h2 class="h-title">Load Error</h2>
        <div class="body">${esc(err && err.message ? err.message : err)}</div>
        <div class="body">Confirm GitHub Pages is serving from <code>/docs</code> and decision packs exist under <code>/docs/decision-trees</code>.</div>
      </div>`;
    }
  });
})();
