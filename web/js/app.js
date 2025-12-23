/*-------------------------------------------------
 * app.js
 * Purpose: UI glue for the POC.
 *          - Loads Figure 1 pack
 *          - Presents YES/NO questions
 *          - Displays instruction/action nodes
 *          - Supports Back, New Case, Download JSON
 *-------------------------------------------------*/

(async function () {
  const screen = document.getElementById("screen");
  const caseMeta = document.getElementById("caseMeta");
  const statusLine = document.getElementById("statusLine");

  const btnNew = document.getElementById("btnNew");
  const btnBack = document.getElementById("btnBack");
  const btnDownload = document.getElementById("btnDownload");

  let pack = null;
  let caseObj = STATE.newCase();
  let currentNodeId = null;
  const navStack = []; // for Back navigation (node history)

  function render() {
    caseMeta.textContent = `${caseObj.test_context.test_type} | ${caseObj.test_context.test_item} | ${caseObj.test_context.test_location} | ${caseObj.test_context.test_date}`;
    statusLine.textContent = ENG.getStatusLine(caseObj);

    btnBack.disabled = navStack.length === 0;

    const node = ENG.getNode(pack, currentNodeId);
    if (!node) {
      screen.innerHTML = `<h2 class="section-title">Error</h2><p>Missing node: <code>${currentNodeId}</code></p>`;
      return;
    }

    if (node.type === "QUESTION") {
      screen.innerHTML = `
        <h2 class="section-title">Figure 1 — Classification</h2>
        <div class="question-text">${escapeHtml(node.question_text)}</div>

        <div class="choices">
          <button id="btnYes">YES</button>
          <button id="btnNo" class="secondary">NO</button>
        </div>

        <div class="help">
          <strong>Note:</strong> This POC records a trace and updates case results deterministically.
          It does not generate DOCX yet.
        </div>

        <hr />

        <div class="kv">
          <div>Current node</div><div><code>${escapeHtml(node.id)}</code></div>
          <div>Classification</div><div>${escapeHtml(caseObj.results.classification || "UNDETERMINED")}</div>
          <div>Analysis method</div><div>${escapeHtml(caseObj.results.analysis_method || "UNDETERMINED")}</div>
          <div>Blue sheet</div><div>${caseObj.results.blue_sheet_required ? "Required" : "Not required"}</div>
        </div>
      `;

      document.getElementById("btnYes").addEventListener("click", () => onAnswer("YES"));
      document.getElementById("btnNo").addEventListener("click", () => onAnswer("NO"));

    } else if (node.type === "INSTRUCTION") {
      screen.innerHTML = `
        <h2 class="section-title">Direction</h2>
        <div class="question-text">${escapeHtml(node.instruction_text)}</div>

        <div class="choices">
          <button id="btnContinue">Continue</button>
        </div>

        <hr />

        <div class="kv">
          <div>Node</div><div><code>${escapeHtml(node.id)}</code></div>
          <div>Classification</div><div>${escapeHtml(caseObj.results.classification || "UNDETERMINED")}</div>
          <div>Analysis method</div><div>${escapeHtml(caseObj.results.analysis_method || "UNDETERMINED")}</div>
          <div>Required sections</div><div>${escapeHtml((caseObj.reporting.required_sections || []).join(", "))}</div>
        </div>
      `;

      document.getElementById("btnContinue").addEventListener("click", () => onContinue());

    } else if (node.type === "ACTION") {
      const actionLabel = node.action ? JSON.stringify(node.action) : "(none)";
      screen.innerHTML = `
        <h2 class="section-title">Action / Routing</h2>
        <div class="question-text">This node indicates a routing or system action.</div>
        <div class="help"><code>${escapeHtml(actionLabel)}</code></div>

        <div class="choices">
          <button id="btnContinue">Continue</button>
        </div>

        <hr />

        <div class="kv">
          <div>Node</div><div><code>${escapeHtml(node.id)}</code></div>
          <div>Classification</div><div>${escapeHtml(caseObj.results.classification || "UNDETERMINED")}</div>
          <div>Unlocked</div><div>${escapeHtml(JSON.stringify(caseObj.analysis_state.unlocked))}</div>
        </div>
      `;

      document.getElementById("btnContinue").addEventListener("click", () => onContinue());

    } else {
      screen.innerHTML = `<h2 class="section-title">Unsupported Node Type</h2><p>${escapeHtml(node.type)}</p>`;
    }
  }

  function onAnswer(answer) {
    ENG.startPackIfNeeded(caseObj, pack);

    const prior = currentNodeId;
    navStack.push(prior);

    const res = ENG.answerQuestion(caseObj, pack, currentNodeId, answer);
    currentNodeId = res.nextNodeId;

    // Auto-enter non-question nodes (render them immediately)
    autoAdvanceNonQuestionNodes();
    render();
  }

  function onContinue() {
    const prior = currentNodeId;
    navStack.push(prior);

    const res = ENG.enterNonQuestionNode(caseObj, pack, currentNodeId);
    if (res.nextNodeId) {
      currentNodeId = res.nextNodeId;
      autoAdvanceNonQuestionNodes();
    } else {
      // terminal; mark pack complete if requested
      ENG.maybeCompletePack(caseObj, pack, currentNodeId);
    }

    render();
  }

  function autoAdvanceNonQuestionNodes() {
    // For nodes that have immediate nexts, step through until we land on a question or terminal node.
    // We do NOT auto-click terminal instruction screens; those require user to read and Continue.
    while (true) {
      const node = ENG.getNode(pack, currentNodeId);
      if (!node) break;

      // If ACTION nodes have a next, you may auto-enter them; but keep it conservative for POC.
      // Here: do not auto-enter instruction/action; show them to the user.
      break;
    }
  }

  function onBack() {
    if (navStack.length === 0) return;
    currentNodeId = navStack.pop();
    render();
  }

  function onNewCase() {
    caseObj = STATE.newCase();
    currentNodeId = pack.entry_node_id;
    navStack.length = 0;
    render();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Wire buttons
  btnNew.addEventListener("click", onNewCase);
  btnBack.addEventListener("click", onBack);
  btnDownload.addEventListener("click", () => STATE.downloadCaseJson(caseObj));

  // Load Figure 1 pack and start
  try {
    pack = await DAT.loadPack("decision-trees/figure1.json");
    currentNodeId = pack.entry_node_id;
    render();
  } catch (e) {
    screen.innerHTML = `<h2 class="section-title">Load Error</h2><p>${escapeHtml(e.message)}</p>
      <div class="help">
        Ensure <code>decision-trees/figure1.json</code> exists at repo root, and GitHub Pages is serving the repo.
      </div>`;
  }
})();
