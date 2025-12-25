/*-------------------------------------------------
 * /docs/js/app.js
 * Deficiency Decision Tool (POC)
 * - Robust DOM wiring (supports alternate IDs)
 * - Manual on left (loads ./manual/front-matter.html)
 * - Wizard on upper-right
 * - Notes on lower-right
 * - Trace hidden unless ?debug=1
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});
  DDT.version = "0.2.1";

  // ===== Module loading (classic scripts; no bundler) =====
  const modulePaths = [
    "./js/data/packLoader.js",
    "./js/data/glossary.js",
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

  // Try multiple IDs (supports you renaming buttons over time)
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

// Render Notes Panel
  
  function renderNotesPanel(nodeId, node, meta, notesMetaEl, notesBodyEl) {
    if (!notesMetaEl || !notesBodyEl) return;

    const packId = (meta && meta.packId) ? meta.packId : "-";
    notesMetaEl.textContent = `Pack: ${packId}  |  Step: ${nodeId || "-"}`;

    const abbrs = findAbbreviationsInNode(node);

    const notes = Array.isArray(node?.notes) ? node.notes : [];
    const directives = Array.isArray(node?.directives) ? node.directives : [];
    const hints = Array.isArray(node?.hints) ? node.hints : [];

    const noteText = (typeof node?.note === "string") ? node.note.trim() : "";
    const directiveText = (typeof node?.directive === "string") ? node.directive.trim() : "";
    const hintText = (typeof node?.hint === "string") ? node.hint.trim() : "";

    let html = "";

// -----------------------------
// DROP-IN SNIPPET (replace your existing Abbreviations block)
// Location: inside renderNotesPanel(), replacing:
//   // Abbreviations tied to the currently displayed node/question
//   if (abbrs.length) { ... }
// -----------------------------

// Build Abbreviation definitions (backward compatible: string OR {label, note})
const abbrLines = (abbrs || [])
  .map(a => {
    const entry = (DDT.GLOSSARY || {})[a];
    const label =
      (typeof entry === "string") ? entry :
      (entry && typeof entry === "object" && typeof entry.label === "string") ? entry.label :
      "";
    return `${a} — ${label}`.trim();
  })
  .filter(line => line && !line.endsWith("—"));

// Build Abbreviation notes (ONLY for entries with {note:"..."})
// IMPORTANT: We do NOT render these here; we append them LAST (see below).
const abbrNoteLines = (abbrs || [])
  .map(a => {
    const entry = (DDT.GLOSSARY || {})[a];
    const note =
      (entry && typeof entry === "object" && typeof entry.note === "string") ? entry.note.trim() : "";
    return note ? `${a} — ${note}` : "";
  })
  .filter(Boolean);

// Render Abbreviations (definitions) near the top (same place you had it)
if (abbrLines.length) {
  html += `<div class="note-block">
    <div class="note-kind">Reference</div>
    <div class="note-title">Abbreviations</div>
    <div class="note-body">${esc(abbrLines.join("\n"))}</div>
  </div>`;
}

/*
  DROP-IN CONTINUATION (append this at the VERY END of renderNotesPanel(),
  immediately before the line where you do: notesBodyEl.innerHTML = html;

  This guarantees abbreviation NOTES are LAST in the panel.
*/
if (abbrNoteLines.length) {
  html += `<div class="note-block">
    <div class="note-kind">Reference</div>
    <div class="note-title">Abbreviation Notes</div>
    <div class="note-body">${esc(abbrNoteLines.join("\n"))}</div>
  </div>`;
}


    if (directives.length || directiveText) {
      html += `<div class="note-block">
        <div class="note-kind">Directive</div>
        <div class="note-title">Required Actions</div>
        <div class="note-body">${esc(directives.length ? directives.join("\n") : directiveText)}</div>
      </div>`;
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

  async function main() {
    await loadModules();
    if (!DDT.GLOSSARY || typeof DDT.GLOSSARY !== "object") {
      console.warn("[DDT] glossary not loaded (DDT.GLOSSARY missing). Check /docs/js/data/glossary.js path and contents.");
    }
    
    const debug = new URLSearchParams(location.search).get("debug") === "1";

    // ---- Required (core) elements ----
    const elScreen = qs("screen");

    // These IDs sometimes change; support both names.
    const { el: elPackSelect, id: packIdUsed } = pickId(["packSelect"]);
    const { el: elStartOver } = pickId(["btnStartOver", "btnRestart", "btnStart"]);
    const { el: elBack } = pickId(["btnBack"]);
    const { el: elReset } = pickId(["btnReset", "btnResetTrace", "btnResetCase"]);

    const { el: elManualStatus } = pickId(["manualStatus"]);
    const { el: elManualBody } = pickId(["manualBody"]);

    const { el: elNotesMeta } = pickId(["notesMeta"]);
    const { el: elNotesBody } = pickId(["notesBody"]);

    if (!elScreen) {
      throw new Error("Missing required element #screen in index.html");
    }
    if (!elPackSelect) {
      throw new Error("Missing required element #packSelect in index.html");
    }

    // ---- Optional elements ----
    const { el: elGoReport } = pickId(["btnGoReport", "btnReport", "btnGenerate"]);
    const { el: elDebugWrap } = pickId(["debugTraceWrap"]);
    const { el: elTrace } = pickId(["trace"]);
    const { el: elTraceMeta } = pickId(["traceMeta"]);

    if (elDebugWrap) elDebugWrap.hidden = !debug;

    await loadManual(elManualStatus, elManualBody);

    const store = DDT.createCaseStore();

        // Notes render fallback (guarded to avoid double-renders/log spam)
    let currentPack = null;
    let lastNotesNodeId = null;

    function updateNotesFromStore() {
      if (!elNotesMeta || !elNotesBody) return;

      const meta = store.getMeta();
      const nodeId = meta && meta.nodeId;
      if (!currentPack || !currentPack.nodes || !nodeId) return;

      // Guard: only re-render if node changed
      if (nodeId === lastNotesNodeId) return;
      lastNotesNodeId = nodeId;

      const node = currentPack.nodes[nodeId];
      if (!node) return;

      renderNotesPanel(nodeId, node, meta, elNotesMeta, elNotesBody);
    }
    
    const engine = DDT.createDecisionEngine({
      renderTarget: elScreen,
      notesTarget: elNotesBody,         // harmless if engine ignores
      notesMetaTarget: elNotesMeta,     // harmless if engine ignores
      debug,

      onTraceUpdated: () => {
        const meta = store.getMeta();
        if (elBack) elBack.disabled = !store.canGoBack();

        if (debug && elTrace && elTraceMeta) {
          elTrace.textContent = JSON.stringify(store.getTrace(), null, 2);
          elTraceMeta.textContent =
            `Pack: ${meta.packId || "-"}  |  Node: ${meta.nodeId || "-"}  |  Steps: ${meta.steps || 0}`;
        }

        updateNotesFromStore();
      },

      onNodeRendered: (nodeId, node) => {
        lastNotesNodeId = nodeId; // keep guard in sync
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

      // Force Notes render for the entry node
      updateNotesFromStore();
    }

    // Controls (all guarded)
    safeOn(elPackSelect, "change", () => startPack(elPackSelect.value));
    safeOn(elStartOver, "click", () => startPack(elPackSelect.value));
    safeOn(elReset, "click", () => startPack(elPackSelect.value));
    safeOn(elBack, "click", () => engine.back());

    safeOn(elGoReport, "click", () => {
      try {
        localStorage.setItem("ddt_last_case", JSON.stringify({
          meta: store.getMeta(),
          state: store.getState(),
          trace: store.getTrace()
        }));
      } catch (_) {}
      window.location.href = "./report.html";
    });

    // Start default
    await startPack(elPackSelect.value);

    // Helpful console note (debug only)
    if (debug) {
      console.log(`[DDT] started (packSelect id: ${packIdUsed || "packSelect"})`);
    }
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
