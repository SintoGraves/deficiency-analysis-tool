/*-------------------------------------------------
 * js/app.js
 * App bootstrap: load decision packs, initialize engine, wire UI.
 * Namespace: window.DDT (Deficiency Decision Tool)
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});
  DDT.version = "0.1.0";

  // Import modules (classic script style via global namespace pattern)
  // The modules below attach themselves to window.DDT.
  // We load them dynamically to avoid manual <script> ordering.
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

  function qs(id) { return document.getElementById(id); }

  async function main() {
    await loadModules();

    const elScreen = qs("screen");
    const elTrace = qs("trace");
    const elTraceMeta = qs("traceMeta");
    const elBack = qs("btnBack");
    const elStartOver = qs("btnStartOver");
    const elResetTrace = qs("btnResetTrace");
    const elPackSelect = qs("packSelect");

    const store = DDT.createCaseStore();
    const engine = DDT.createDecisionEngine({
      renderTarget: elScreen,
      onTraceUpdated: () => {
        elTrace.textContent = JSON.stringify(store.getTrace(), null, 2);
        const meta = store.getMeta();
        elTraceMeta.textContent = `Pack: ${meta.packId || "-"}  |  Node: ${meta.nodeId || "-"}  |  Steps: ${meta.steps || 0}`;
        elBack.disabled = !store.canGoBack();
      }
    });

    async function startPack(packId) {
      const pack = await DDT.loadPack(packId);
      store.reset();
      engine.loadPack(pack, store);
      engine.start();
    }

    elPackSelect.addEventListener("change", () => startPack(elPackSelect.value));

    elStartOver.addEventListener("click", () => startPack(elPackSelect.value));

    elResetTrace.addEventListener("click", () => {
      store.resetTraceOnly();
      engine.refresh();
    });

    elBack.addEventListener("click", () => {
      engine.back();
    });

    // Default start: Figure 1
    await startPack(elPackSelect.value);
  }

  main().catch((err) => {
    console.error(err);
    const el = document.getElementById("screen");
    if (el) {
      el.innerHTML = `<div class="screen">
        <div class="node-type">error</div>
        <h2 class="h-title">Load Error</h2>
        <div class="body">${String(err && err.message ? err.message : err)}</div>
        <div class="body">Ensure your files are under <code>/docs</code> and JSON packs exist under <code>/docs/decision-trees</code>.</div>
      </div>`;
    }
  });
})();
