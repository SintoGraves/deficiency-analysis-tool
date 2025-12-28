/*-------------------------------------------------
 * js/engine/decisionEngine.js
 * Generic wizard engine that renders pack nodes one-at-a-time.
 * Node types supported: info, decision, outcome, handoff, connector
 * Namespace: window.DDT
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function renderNode(el, nodeId, node, store) {
    const type = node.type || "unknown";
    const title = node.title || nodeId;
    const body = node.body || "";
    const question = node.question || "";

    let html = "";
    html += `<div class="node-type">${esc(type)}</div>`;
    html += `<h2 class="h-title">${esc(title)}</h2>`;

    if (body) html += `<div class="body">${esc(body)}</div>`;
    if (type === "decision") html += `<div class="question">${esc(question)}</div>`;

    html += `<div class="choices" id="choices"></div>`;

    el.innerHTML = html;

    const choicesEl = el.querySelector("#choices");
    return choicesEl;
  }

  function button(label, className, onClick) {
    const b = document.createElement("button");
    b.className = `btn ${className || ""}`.trim();
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  DDT.createDecisionEngine = function createDecisionEngine(opts) {
    const renderTarget = opts && opts.renderTarget;
    const onTraceUpdated = (opts && opts.onTraceUpdated) || function () {};

    if (!renderTarget) throw new Error("renderTarget is required");

    let pack = null;
    let store = null;

    function getNode(nodeId) {
      const node = pack.nodes[nodeId];
      DDT.validateNode(nodeId, node);
      return node;
    }

    function setCurrent(nodeId) {
      store.setMeta(pack.packId, nodeId);
      const node = getNode(nodeId);

      const choicesEl = renderNode(renderTarget, nodeId, node, store);

      // Always trace node entry
      store.appendTrace({ kind: "enter", nodeId, nodeType: node.type, title: node.title || "" });

      // Apply effects on entry (info/instruction nodes often include effects)
      if (node.effects) DDT.applyEffects(store, node.effects);

      // Render actions per node type
      if (node.type === "info") {
        choicesEl.appendChild(button("Continue", "", () => goNextFromInfo(nodeId, node)));
      } else if (node.type === "connector") {
        choicesEl.appendChild(button("Continue", "", () => goNextFromInfo(nodeId, node)));
      } else if (node.type === "decision") {
        renderDecisionChoices(choicesEl, nodeId, node);
      } else if (node.type === "handoff") {
        choicesEl.appendChild(button("Go to next pack", "", () => doHandoff(nodeId, node)));
      } else if (node.type === "outcome") {
        choicesEl.appendChild(button("Start Over", "secondary", () => restartSamePack()));
      } else {
        choicesEl.appendChild(button("Continue", "", () => goNextFromInfo(nodeId, node)));
      }

      onTraceUpdated();
    }

    function pushHistoryBeforeMove() {
      const meta = store.getMeta();
      if (meta.packId && meta.nodeId) store.pushHistory(meta.packId, meta.nodeId);
    }

    function goNextFromInfo(nodeId, node) {
      const nextId = node.next;
      if (!nextId) {
        // If info has no next, treat as terminal (should be rare)
        store.appendTrace({ kind: "error", message: `Node ${nodeId} has no next` });
        onTraceUpdated();
        return;
      }
      pushHistoryBeforeMove();
      store.appendTrace({ kind: "ack", nodeId });
      setCurrent(nextId);
    }

    function renderDecisionChoices(choicesEl, nodeId, node) {
      const choices = node.choices || {};
      const keys = Object.keys(choices);

      if (keys.length === 0) {
        choicesEl.appendChild(button("Continue", "", () => {
          store.appendTrace({ kind: "error", message: `Decision node ${nodeId} has no choices` });
          onTraceUpdated();
        }));
        return;
      }

      // Preferred: YES/NO ordering when present
      const order = ["yes", "no"];
      const orderedKeys = [
        ...order.filter(k => keys.includes(k)),
        ...keys.filter(k => !order.includes(k))
      ];

      orderedKeys.forEach((k) => {
        const target = choices[k];
        const label = k.toUpperCase().replaceAll("_", " ");
        choicesEl.appendChild(button(label, "", () => {
          pushHistoryBeforeMove();
          store.appendTrace({ kind: "answer", nodeId, answer: k, to: target });
          setCurrent(target);
        }));
      });
    }

    async function doHandoff(nodeId, node) {
      const h = node.handoff || {};
      const targetPackId = h.targetPackId;

      if (!targetPackId) {
        store.appendTrace({ kind: "error", message: `Handoff node ${nodeId} missing targetPackId` });
        onTraceUpdated();
        return;
      }

      // Record handoff as a trace event and load new pack.
      store.appendTrace({ kind: "handoff", nodeId, toPack: targetPackId, reason: h.reason || "" });

      // Clear history on pack switch for MVP (keeps behavior simple and auditable).
      const nextPack = await DDT.loadPack(targetPackId);
      pack = nextPack;
      DDT.validatePack(pack);

     // Move to new pack entry (setCurrent will set correct meta)
     setCurrent(pack.entryNodeId);
    }

    function restartSamePack() {
      if (!pack || !store) return;
      store.reset();
      store.setMeta(pack.packId, pack.entryNodeId);
      setCurrent(pack.entryNodeId);
    }

    return {
      loadPack(nextPack, caseStore) {
        pack = nextPack;
        store = caseStore;
        DDT.validatePack(pack);
      },

      start() {
        if (!pack || !store) throw new Error("Engine requires pack + caseStore");
        store.setMeta(pack.packId, pack.entryNodeId);
        setCurrent(pack.entryNodeId);
      },

      refresh() {
        if (!pack || !store) return;
        const meta = store.getMeta();
        if (!meta.nodeId) return;
        setCurrent(meta.nodeId);
      },

      back() {
        if (!store.canGoBack()) return;
        const prev = store.popHistory();
        if (!prev) return;

        // restore state snapshot and truncate trace to the prior length
        store.replaceState(prev.stateSnapshot);

        // For MVP: we do not physically truncate trace entries (audit trail stays intact),
        // but we record a "back" event and render the previous node.
        store.appendTrace({ kind: "back", toNode: prev.nodeId });

        setCurrent(prev.nodeId);
      }
    };
  };
})();
