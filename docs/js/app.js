/*-------------------------------------------------
 * /docs/js/app.js
 * Deficiency Decision Tool (POC) — Single Page Layout (DROP-IN)
 * - Wizard controls (Start Over / Back / Reset) live INSIDE wizard block (footer)
 * - Manual is a separate LEFT TAB; other LEFT TAB is Wizard+Notes
 * - Switching LEFT tabs does NOT reset wizard position/state
 * - Document generation (Blue/OPCON/TACON) on right (embedded); no navigation away
 * - Trace hidden unless ?debug=1
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});
  DDT.version = "0.3.1";

  // ===== Module loading (classic scripts; no bundler) =====
  const modulePaths = [
    "./js/data/packLoader.js",
    "./js/data/glossary.js",
    "./js/data/notes.js",
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

  function pickId(ids) {
    for (const id of ids) {
      const el = qs(id);
      if (el) return { el, id };
    }
    return { el: null, id: null };
  }

  function esc(s) {
    return String((s === undefined || s === null) ? "" : s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function safeOn(el, evt, fn) {
    if (!el) return false;
    el.addEventListener(evt, fn);
    return true;
  }

  // ===== Manual loaders (tab 1 uses fetch; tab 2 uses iframe in HTML) =====
  async function loadManualFrontMatter(manualStatusEl, manualBodyEl) {
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

  // ===== Node text helpers =====
  function getNodeDisplayText(node) {
    if (!node) return "";
    const parts = [];
    if (node.title) parts.push(node.title);
    if (node.question) parts.push(node.question);
    if (node.body) parts.push(node.body);
    return parts.join(" ");
  }

  function findAbbreviationsInNode(node) {
    const text = getNodeDisplayText(node).toUpperCase();
    const hits = [];
    for (const abbr of Object.keys(DDT.GLOSSARY || {})) {
      const re = new RegExp("\\b" + abbr + "\\b", "g");
      if (re.test(text)) hits.push(abbr);
    }
    hits.sort();
    return hits;
  }

  function findNoteRefsInNode(node) {
    const text = getNodeDisplayText(node);
    if (!text) return [];
    const re = /\bNOTE\s+(\d+)\b/gi;
    const refs = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      const key = `NOTE ${m[1]}`;
      if (!refs.includes(key)) refs.push(key);
    }
    refs.sort((a, b) => {
      const na = parseInt(a.replace(/\D+/g, ""), 10);
      const nb = parseInt(b.replace(/\D+/g, ""), 10);
      return na - nb;
    });
    return refs;
  }

  // ===== Notes Panel =====
  function renderNotesPanel(nodeId, node, meta, notesMetaEl, notesBodyEl) {
    if (!notesMetaEl || !notesBodyEl) return;

    const packId = (meta && meta.packId) ? meta.packId : "-";
    notesMetaEl.textContent = `Pack: ${packId}  |  Step: ${nodeId || "-"}`;

    const abbrs = findAbbreviationsInNode(node);
    const noteRefs = findNoteRefsInNode(node);

    const notes = Array.isArray(node?.notes) ? node.notes : [];
    const directives = Array.isArray(node?.directives) ? node.directives : [];
    const hints = Array.isArray(node?.hints) ? node.hints : [];

    const noteText = (typeof node?.note === "string") ? node.note.trim() : "";
    const directiveText = (typeof node?.directive === "string") ? node.directive.trim() : "";
    const hintText = (typeof node?.hint === "string") ? node.hint.trim() : "";

    let html = "";

    if (abbrs.length) {
      html += `<div class="note-block">
        <div class="note-kind">Reference</div>
        <div class="note-title">Abbreviations</div>
        <div class="note-body">${esc(
          abbrs.map(a => `${a} — ${(DDT.GLOSSARY || {})[a] || ""}`).join("\n")
        )}</div>
      </div>`;
    }

    if (directives.length || directiveText) {
      html += `<div class="note-block">
        <div class="note-kind">Directive</div>
        <div class="note-title">Required Actions</div>
        <div class="note-body">${esc(directives.length ? directives.join("\n") : directiveText)}</div>
      </div>`;
    }

    if (noteRefs.length) {
      const lib = (DDT.NOTES && typeof DDT.NOTES === "object") ? DDT.NOTES : {};
      for (const ref of noteRefs) {
        const entry = lib[ref];
        if (!entry) continue;
        html += `<div class="note-block">
          <div class="note-kind">Reference</div>
          <div class="note-title">${esc(entry.title || ref)}</div>
          <div class="note-body">${esc(entry.body || "")}</div>
        </div>`;
      }
    }

    if (notes.length) {
      for (const n of notes) {
        html += `<div class="note-block">
          <div class="note-kind">Note</div>
          <div class="note-title">${esc(n?.title || "Note")}</div>
          <div class="note-body">${esc(n?.body || "")}</div>
        </div>`;
      }
    } else if (noteText) {
      html += `<div class="note-block">
        <div class="note-kind">Note</div>
        <div class="note-title">Note</div>
        <div class="note-body">${esc(noteText)}</div>
      </div>`;
    }

    if (hints.length || hintText) {
      html += `<div class="note-block">
        <div class="note-kind">Hint</div>
        <div class="note-title">Guidance</div>
        <div class="note-body">${esc(hints.length ? hints.join("\n") : hintText)}</div>
      </div>`;
    }

    if (!html) html = `<div class="hint">No additional notes for this step.</div>`;
    notesBodyEl.innerHTML = html;
  }

  // ===== Generic tab helper =====
  function setActiveTab(btns, wrapMap, activeKey) {
    // btns and wrapMap can contain nulls; guard.
    for (const [key, btn] of Object.entries(btns)) {
      if (!btn) continue;
      const isActive = key === activeKey;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    for (const [key, wrap] of Object.entries(wrapMap)) {
      if (!wrap) continue;
      wrap.hidden = key !== activeKey;
    }
  }

  // ===== Send flow context to Blue Sheet iframe =====
  function pushContextToBlueSheet(frameEl, payload) {
    if (!frameEl || !frameEl.contentWindow) return;
    try {
      frameEl.contentWindow.postMessage(
        { type: "DDT_FLOW_CONTEXT", payload },
        "*"
      );
    } catch (e) {
      console.warn("postMessage to Blue Sheet failed:", e);
    }
  }

  async function main() {
    await loadModules();

    const debug = new URLSearchParams(location.search).get("debug") === "1";

    // ==========================
    // Core elements (required)
    // ==========================
    const elScreen = qs("screen");
    const elFlowMeta = qs("flowMeta");

    const { el: elPackSelect } = pickId(["packSelect"]);
    const { el: elStartOver } = pickId(["btnStartOver", "btnRestart", "btnStart"]);
    const { el: elBack } = pickId(["btnBack"]);
    const { el: elReset } = pickId(["btnReset", "btnResetTrace", "btnResetCase"]);
    const { el: elGoDoc } = pickId(["btnGenerate", "btnGoReport", "btnReport"]);

    // Notes
    const { el: elNotesMeta } = pickId(["notesMeta"]);
    const { el: elNotesBody } = pickId(["notesBody"]);

    if (!elScreen) throw new Error("Missing required element #screen in index.html");
    if (!elPackSelect) throw new Error("Missing required element #packSelect in index.html");
    if (!elStartOver) console.warn("[DDT] btnStartOver not found. Wizard footer button required by UX.");
    if (!elBack) console.warn("[DDT] btnBack not found. Wizard footer button required by UX.");
    if (!elReset) console.warn("[DDT] btnReset not found. Wizard footer button required by UX.");

    // ==========================
    // Left tabs: Manual vs Wizard
    // ==========================
    const tabLeftWizard = qs("tabLeftWizard");
    const tabLeftManual = qs("tabLeftManual");
    const wrapLeftWizard = qs("leftWizardWrap");
    const wrapLeftManual = qs("leftManualWrap");

    // ==========================
    // Manual (inside Manual tab)
    // ==========================
    const { el: elManualStatus } = pickId(["manualStatus"]);
    const { el: elManualBody } = pickId(["manualBody"]);
    const elManualReportWrap = qs("manualReportWrap");

    const tabManualFront = qs("tabManualFront");
    const tabManualReport = qs("tabManualReport");

    // Manual: load front matter on boot (even if manual tab is not visible yet)
    await loadManualFrontMatter(elManualStatus, elManualBody);

    // Manual tab behavior (Front Matter vs Report)
    const manualBtns = { front: tabManualFront, report: tabManualReport };
    const manualWraps = { front: elManualBody, report: elManualReportWrap };
    function showManual(which) {
      setActiveTab(manualBtns, manualWraps, which);
    }
    safeOn(tabManualFront, "click", () => showManual("front"));
    safeOn(tabManualReport, "click", () => showManual("report"));
    showManual("front");

    // Left tab behavior (Wizard+Notes vs Manual) — IMPORTANT: hide/show only.
    const leftBtns = { wizard: tabLeftWizard, manual: tabLeftManual };
    const leftWraps = { wizard: wrapLeftWizard, manual: wrapLeftManual };
    function showLeft(which) {
      setActiveTab(leftBtns, leftWraps, which);
    }
    safeOn(tabLeftWizard, "click", () => showLeft("wizard"));
    safeOn(tabLeftManual, "click", () => showLeft("manual"));
    // Default: Wizard tab active (no state reset)
    showLeft("wizard");

    // ==========================
    // Right doc tabs (Blue/OPCON/TACON)
    // ==========================
    const tabDocBlue = qs("tabDocBlue");
    const tabDocOpcon = qs("tabDocOpcon");
    const tabDocTacon = qs("tabDocTacon");
    const wrapDocBlue = qs("docBlueWrap");
    const wrapDocOpcon = qs("docOpconWrap");
    const wrapDocTacon = qs("docTaconWrap");
    const blueFrame = qs("blueSheetFrame");

    const docBtns = { blue: tabDocBlue, opcon: tabDocOpcon, tacon: tabDocTacon };
    const docWraps = { blue: wrapDocBlue, opcon: wrapDocOpcon, tacon: wrapDocTacon };
    function showDoc(which) {
      setActiveTab(docBtns, docWraps, which);
    }
    safeOn(tabDocBlue, "click", () => showDoc("blue"));
    safeOn(tabDocOpcon, "click", () => showDoc("opcon"));
    safeOn(tabDocTacon, "click", () => showDoc("tacon"));
    showDoc("blue");

    // ==========================
    // Debug
    // ==========================
    const { el: elDebugWrap } = pickId(["debugTraceWrap"]);
    const { el: elTrace } = pickId(["trace"]);
    const { el: elTraceMeta } = pickId(["traceMeta"]);
    if (elDebugWrap) elDebugWrap.hidden = !debug;

    // ==========================
    // Case store + engine
    // ==========================
    const store = DDT.createCaseStore();

    let currentPack = null;
    let lastNotesNodeId = null;

    function updateFlowMeta() {
      if (!elFlowMeta) return;
      const meta = store.getMeta();
      elFlowMeta.textContent = `Pack: ${meta.packId || "-"}  |  Step: ${meta.nodeId || "-"}`;
    }

    function updateNotesFromStore() {
      if (!elNotesMeta || !elNotesBody) return;
      const meta = store.getMeta();
      const nodeId = meta && meta.nodeId;
      if (!currentPack || !currentPack.nodes || !nodeId) return;

      if (nodeId === lastNotesNodeId) return;
      lastNotesNodeId = nodeId;

      const node = currentPack.nodes[nodeId];
      if (!node) return;

      renderNotesPanel(nodeId, node, meta, elNotesMeta, elNotesBody);
    }

    const engine = DDT.createDecisionEngine({
      renderTarget: elScreen,
      debug,

      onTraceUpdated: () => {
        const meta = store.getMeta();
        if (elBack) elBack.disabled = !store.canGoBack();

        updateFlowMeta();
        updateNotesFromStore();

        if (debug && elTrace && elTraceMeta) {
          elTrace.textContent = JSON.stringify(store.getTrace(), null, 2);
          elTraceMeta.textContent =
            `Pack: ${meta.packId || "-"}  |  Node: ${meta.nodeId || "-"}  |  Steps: ${meta.steps || 0}`;
        }
      },

      onNodeRendered: (nodeId, node) => {
        lastNotesNodeId = nodeId;
        updateFlowMeta();
        renderNotesPanel(nodeId, node, store.getMeta(), elNotesMeta, elNotesBody);
      }
    });

    async function startPack(packId) {
      const pack = await DDT.loadPack(packId);
      currentPack = pack;
      lastNotesNodeId = null;

      store.reset();
      engine.loadPack(pack, store);
      engine.start();

      updateFlowMeta();
      updateNotesFromStore();
    }

    // ==========================
    // Wiring: Wizard controls (in wizard footer)
    // ==========================
    safeOn(elPackSelect, "change", () => startPack(elPackSelect.value));
    safeOn(elStartOver, "click", () => startPack(elPackSelect.value));
    safeOn(elReset, "click", () => startPack(elPackSelect.value));
    safeOn(elBack, "click", () => engine.back());

    // ==========================
    // Generate Document (right panel) — no navigation
    // ==========================
    safeOn(elGoDoc, "click", () => {
      // Persist snapshot for demo credibility / recovery
      try {
        localStorage.setItem("ddt_last_case", JSON.stringify({
          meta: store.getMeta(),
          state: store.getState(),
          trace: store.getTrace()
        }));
      } catch (_) {}

      // Switch to Blue Sheet (single page)
      showDoc("blue");

      // Push current flow context into the embedded Blue Sheet tool
      const meta = store.getMeta();
      const node = currentPack?.nodes?.[meta?.nodeId] || null;

      pushContextToBlueSheet(blueFrame, {
        meta,
        currentNode: node
          ? { id: meta.nodeId, title: node.title, question: node.question, body: node.body }
          : null,
        trace: store.getTrace()
      });
    });

    // ==========================
    // Boot
    // ==========================
    await startPack(elPackSelect.value);

    // Ensure UI reflects initial state
    updateFlowMeta();
    updateNotesFromStore();
  }

  main().catch((err) => {
    console.error(err);
    const el = document.getElementById("screen");
    if (el) {
      el.innerHTML = `<div class="screen">
        <div class="node-type">error</div>
        <h2 class="h-title">Load Error</h2>
        <div class="body">${esc(err?.message || err)}</div>
        <div class="body">Confirm your IDs exist in <code>/docs/index.html</code> and files are under <code>/docs</code>.</div>
      </div>`;
    }
  });
})();
