/*-------------------------------------------------
 * js/state/caseStore.js
 * Stores flow case state + auditable trace + back stack
 * AND (NEW) an Event Workspace for multi-document drafting.
 *
 * Backward compatibility:
 * - Existing engine calls still work:
 *   reset(), resetTraceOnly(), getState(), replaceState(), getMeta(), setMeta(),
 *   getTrace(), appendTrace(), pushHistory(), canGoBack(), popHistory()
 *
 * New capabilities:
 * - Event workspace: create/list/open/update documents, sequential numbering,
 *   copy/paste between docs, review routing, persistence (localStorage in POC).
 *
 * Namespace: window.DDT
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});

  function nowIso() {
    return new Date().toISOString();
  }

  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  }

  // ---------- Persistence (POC) ----------
  // In production (.exe), replace these with filesystem/network-share handlers.
  const LS_PREFIX = "ddt::eventWorkspace::v1::";

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); return true; } catch { return false; }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function normalizeEventId(s) {
    const raw = String(s || "").trim();
    if (!raw) return "";
    return raw.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  }

  function pad3(n) {
    const x = Math.max(0, parseInt(n, 10) || 0);
    return String(x).padStart(3, "0");
  }

  function buildDocId(docType, seq) {
    // Example: BlueSheet-001, OPCON-002
    const t = String(docType || "Doc").replace(/[^\w]+/g, "");
    return `${t}-${pad3(seq)}`;
  }

  function defaultDocTemplate(docType) {
    // Keep intentionally minimal; doc UI owns schema.
    // You can add per-type field stubs later without breaking store.
    return {
      docType: docType || "Doc",
      title: "",
      fields: {},            // arbitrary key/value fields used by the editor
      attachments: [],       // optional metadata
      status: "DRAFT",       // DRAFT | IN_REVIEW | FINAL
      reviewers: [],         // [{name, role, status, completedAt, comments}]
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }

  // ---------- Store Factory ----------
  DDT.createCaseStore = function createCaseStore(opts) {
    // ======== EXISTING FLOW STATE ========
    let meta = { packId: null, nodeId: null, steps: 0 };
    let state = {};     // arbitrary flow case state
    let trace = [];     // append-only (unless reset)
    let history = [];   // stack of { packId, nodeId, stateSnapshot, traceLen }

    function snapshotState() {
      return deepCopy(state);
    }

    function setMeta(packId, nodeId) {
      meta.packId = packId;
      meta.nodeId = nodeId;
      meta.steps = trace.length;
    }

    function addHistory(packId, nodeId) {
      history.push({
        packId,
        nodeId,
        stateSnapshot: snapshotState(),
        traceLen: trace.length
      });
    }

    // ======== NEW EVENT WORKSPACE ========
    // Goal: one test event containing many artifacts (Blue Sheets, OPCONs, TACONs, etc.)
    // Storage:
    // - In the POC: localStorage keyed by eventId.
    // - In production: folder on network share with JSON + templates.
    let workspace = {
      eventId: "",                 // normalized
      eventTitle: "",              // human label
      createdAt: null,
      updatedAt: null,
      activeDocId: "",             // which doc is currently "open"
      docCounters: {},             // { BlueSheet: 5, OPCON: 2, ... }
      documents: {},               // { "BlueSheet-001": {..doc..}, ... }
      clipboard: {
        // For copy/paste between docs
        sourceDocId: "",
        copiedAt: null,
        fields: {}                 // {fieldKey: value}
      }
    };

    function workspaceKey(eventId) {
      return LS_PREFIX + normalizeEventId(eventId);
    }

    function touchWorkspace() {
      workspace.updatedAt = nowIso();
    }

    function ensureWorkspace(eventId, title) {
      const id = normalizeEventId(eventId);
      if (!id) throw new Error("EventId is required to initialize workspace.");
      if (workspace.eventId === id) return;

      // Try load existing
      const key = workspaceKey(id);
      const raw = lsGet(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          // Minimal validation
          if (parsed && parsed.eventId === id && parsed.documents && parsed.docCounters) {
            workspace = parsed;
            if (title && !workspace.eventTitle) workspace.eventTitle = String(title);
            touchWorkspace();
            persistWorkspace();
            return;
          }
        } catch {
          // fallthrough to new workspace
        }
      }

      // New workspace
      workspace = {
        eventId: id,
        eventTitle: String(title || id),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        activeDocId: "",
        docCounters: {},
        documents: {},
        clipboard: { sourceDocId: "", copiedAt: null, fields: {} }
      };
      persistWorkspace();
    }

    function persistWorkspace() {
      if (!workspace.eventId) return false;
      touchWorkspace();
      return lsSet(workspaceKey(workspace.eventId), JSON.stringify(workspace));
    }

    function getWorkspaceSafe() {
      return deepCopy(workspace);
    }

    function listDocs() {
      const ids = Object.keys(workspace.documents || {});
      ids.sort();
      return ids.map((id) => ({ id, ...deepCopy(workspace.documents[id]) }));
    }

    function nextSeqForType(docType) {
      const t = String(docType || "Doc").replace(/[^\w]+/g, "");
      const current = workspace.docCounters[t] || 0;
      const next = current + 1;
      workspace.docCounters[t] = next;
      return { type: t, seq: next };
    }

    function createDoc(docType, seed) {
      if (!workspace.eventId) throw new Error("Workspace not initialized. Call initEvent(eventId) first.");

      const { type, seq } = nextSeqForType(docType);
      const id = buildDocId(type, seq);

      const base = defaultDocTemplate(type);
      const doc = {
        ...base,
        ...deepCopy(seed || {}),
        docType: type,
        updatedAt: nowIso(),
        createdAt: nowIso()
      };

      workspace.documents[id] = doc;
      workspace.activeDocId = id;
      persistWorkspace();

      return { id, doc: deepCopy(doc) };
    }

    function getDoc(docId) {
      const id = String(docId || "");
      const doc = workspace.documents && workspace.documents[id];
      return doc ? deepCopy(doc) : null;
    }

    function setActiveDoc(docId) {
      const id = String(docId || "");
      if (!workspace.documents || !workspace.documents[id]) return false;
      workspace.activeDocId = id;
      persistWorkspace();
      return true;
    }

    function getActiveDocId() {
      return workspace.activeDocId || "";
    }

    function updateDoc(docId, patch) {
      const id = String(docId || "");
      const existing = workspace.documents && workspace.documents[id];
      if (!existing) return false;

      const next = { ...existing, ...deepCopy(patch || {}) };
      next.updatedAt = nowIso();

      // Protect invariant fields
      next.docType = existing.docType;
      next.createdAt = existing.createdAt || next.createdAt;

      workspace.documents[id] = next;
      persistWorkspace();
      return true;
    }

    function updateDocFields(docId, fieldPatch) {
      const id = String(docId || "");
      const existing = workspace.documents && workspace.documents[id];
      if (!existing) return false;

      const next = deepCopy(existing);
      next.fields = { ...(next.fields || {}), ...(deepCopy(fieldPatch || {})) };
      next.updatedAt = nowIso();

      workspace.documents[id] = next;
      persistWorkspace();
      return true;
    }

    function deleteDoc(docId) {
      const id = String(docId || "");
      if (!workspace.documents || !workspace.documents[id]) return false;
      delete workspace.documents[id];

      if (workspace.activeDocId === id) workspace.activeDocId = "";
      persistWorkspace();
      return true;
    }

    // ---------- Clipboard (copy/paste) ----------
    function copyFieldsFromDoc(docId, keys) {
      const doc = getDoc(docId);
      if (!doc) return false;

      const src = doc.fields || {};
      let payload = {};

      if (Array.isArray(keys) && keys.length) {
        for (const k of keys) payload[k] = src[k];
      } else {
        // Copy all fields by default
        payload = deepCopy(src);
      }

      workspace.clipboard = {
        sourceDocId: String(docId || ""),
        copiedAt: nowIso(),
        fields: payload
      };
      persistWorkspace();
      return true;
    }

    function pasteFieldsToDoc(docId, map) {
      // map optional: { targetKey: sourceKey } or { targetKey: {sourceKey, transform} }
      const doc = getDoc(docId);
      if (!doc) return false;

      const clip = workspace.clipboard || {};
      const srcFields = clip.fields || {};
      const destPatch = {};

      if (map && typeof map === "object") {
        for (const [targetKey, spec] of Object.entries(map)) {
          if (typeof spec === "string") {
            destPatch[targetKey] = srcFields[spec];
          } else if (spec && typeof spec === "object") {
            const v = srcFields[spec.sourceKey];
            destPatch[targetKey] = (typeof spec.transform === "function") ? spec.transform(v) : v;
          }
        }
      } else {
        // Default: merge all clipboard fields into destination
        Object.assign(destPatch, deepCopy(srcFields));
      }

      return updateDocFields(docId, destPatch);
    }

    function getClipboard() {
      return deepCopy(workspace.clipboard || { sourceDocId: "", copiedAt: null, fields: {} });
    }

    // ---------- Review routing ----------
    function setDocStatus(docId, status) {
      const allowed = new Set(["DRAFT", "IN_REVIEW", "FINAL"]);
      const s = String(status || "").toUpperCase();
      if (!allowed.has(s)) return false;
      return updateDoc(docId, { status: s });
    }

    function addReviewer(docId, reviewer) {
      const doc = getDoc(docId);
      if (!doc) return false;

      const r = reviewer || {};
      const next = deepCopy(doc);
      next.reviewers = Array.isArray(next.reviewers) ? next.reviewers : [];

      next.reviewers.push({
        name: String(r.name || ""),
        role: String(r.role || ""),
        status: "PENDING",             // PENDING | DONE
        completedAt: null,
        comments: ""
      });

      next.updatedAt = nowIso();
      workspace.documents[docId] = next;
      persistWorkspace();
      return true;
    }

    function completeReviewer(docId, reviewerName, comments) {
      const doc = getDoc(docId);
      if (!doc) return false;

      const next = deepCopy(doc);
      next.reviewers = Array.isArray(next.reviewers) ? next.reviewers : [];

      const name = String(reviewerName || "").trim();
      const idx = next.reviewers.findIndex(r => String(r.name || "").trim() === name);
      if (idx < 0) return false;

      next.reviewers[idx].status = "DONE";
      next.reviewers[idx].completedAt = nowIso();
      if (comments !== undefined) next.reviewers[idx].comments = String(comments || "");

      next.updatedAt = nowIso();
      workspace.documents[docId] = next;
      persistWorkspace();
      return true;
    }

    function allReviewsDone(docId) {
      const doc = getDoc(docId);
      if (!doc) return false;
      const arr = Array.isArray(doc.reviewers) ? doc.reviewers : [];
      if (!arr.length) return true; // if no reviewers defined, treat as done
      return arr.every(r => String(r.status || "").toUpperCase() === "DONE");
    }

    function finalizeDoc(docId) {
      // Only allow FINAL if all reviewers are DONE (if reviewers exist)
      if (!allReviewsDone(docId)) return false;
      return setDocStatus(docId, "FINAL");
    }

    // ---------- Flow context helper for docs ----------
    // Stores the latest flow context to workspace so docs can reference it.
    function captureFlowContext() {
      const m = { ...meta };
      const t = deepCopy(trace);
      const s = deepCopy(state);
      // Save minimal but useful linkage
      workspace.lastFlow = {
        capturedAt: nowIso(),
        meta: m,
        state: s,
        trace: t
      };
      persistWorkspace();
      return true;
    }

    // ---------- Public API ----------
    return {
      // ===== Existing API (unchanged) =====
      reset() {
        meta = { packId: null, nodeId: null, steps: 0 };
        state = {};
        trace = [];
        history = [];

        // Also reset workspace in-memory (does not delete persisted events)
        workspace = {
          eventId: "",
          eventTitle: "",
          createdAt: null,
          updatedAt: null,
          activeDocId: "",
          docCounters: {},
          documents: {},
          clipboard: { sourceDocId: "", copiedAt: null, fields: {} }
        };
      },

      resetTraceOnly() {
        trace = [];
        history = [];
        meta.steps = 0;
      },

      getState() { return state; },
      replaceState(nextState) { state = nextState || {}; },

      getMeta() { return { ...meta }; },
      setMeta,

      getTrace() { return trace.slice(); },

      appendTrace(entry) {
        trace.push({
          t: nowIso(),
          ...entry
        });
        meta.steps = trace.length;
      },

      pushHistory(packId, nodeId) {
        addHistory(packId, nodeId);
      },

      canGoBack() {
        return history.length > 0;
      },

      popHistory() {
        return history.pop() || null;
      },

      // ===== New Event Workspace API =====
      initEvent(eventId, title) {
        ensureWorkspace(eventId, title);
        return getWorkspaceSafe();
      },

      loadEvent(eventId) {
        ensureWorkspace(eventId);
        return getWorkspaceSafe();
      },

      getEvent() {
        return getWorkspaceSafe();
      },

      saveEvent() {
        return persistWorkspace();
      },

      deleteEvent(eventId) {
        const id = normalizeEventId(eventId);
        if (!id) return false;
        lsRemove(workspaceKey(id));
        if (workspace.eventId === id) {
          workspace = {
            eventId: "",
            eventTitle: "",
            createdAt: null,
            updatedAt: null,
            activeDocId: "",
            docCounters: {},
            documents: {},
            clipboard: { sourceDocId: "", copiedAt: null, fields: {} }
          };
        }
        return true;
      },

      listDocuments() {
        return listDocs();
      },

      createDocument(docType, seed) {
        return createDoc(docType, seed);
      },

      getDocument(docId) {
        return getDoc(docId);
      },

      updateDocument(docId, patch) {
        return updateDoc(docId, patch);
      },

      updateDocumentFields(docId, fieldPatch) {
        return updateDocFields(docId, fieldPatch);
      },

      deleteDocument(docId) {
        return deleteDoc(docId);
      },

      setActiveDocument(docId) {
        return setActiveDoc(docId);
      },

      getActiveDocumentId() {
        return getActiveDocId();
      },

      // Clipboard
      copyFields(docId, keys) {
        return copyFieldsFromDoc(docId, keys);
      },

      pasteFields(docId, map) {
        return pasteFieldsToDoc(docId, map);
      },

      getClipboard() {
        return getClipboard();
      },

      // Review routing
      setDocumentStatus(docId, status) {
        return setDocStatus(docId, status);
      },

      addReviewer(docId, reviewer) {
        return addReviewer(docId, reviewer);
      },

      completeReviewer(docId, reviewerName, comments) {
        return completeReviewer(docId, reviewerName, comments);
      },

      allReviewsDone(docId) {
        return allReviewsDone(docId);
      },

      finalizeDocument(docId) {
        return finalizeDoc(docId);
      },

      // Flow capture for linkage into docs
      captureFlowContext() {
        return captureFlowContext();
      }
    };
  };
})();
