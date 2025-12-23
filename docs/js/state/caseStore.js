/*-------------------------------------------------
 * js/state/caseStore.js
 * Stores case state + auditable trace + back stack.
 * Namespace: window.DDT
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});

  function nowIso() {
    return new Date().toISOString();
  }

  DDT.createCaseStore = function createCaseStore() {
    let meta = { packId: null, nodeId: null, steps: 0 };
    let state = {};          // arbitrary key/value (effects write here)
    let trace = [];          // append-only (unless reset)
    let history = [];        // stack of { packId, nodeId, stateSnapshot, traceLen }

    function snapshotState() {
      // Simple deep copy is sufficient for this MVP.
      return JSON.parse(JSON.stringify(state || {}));
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

    return {
      reset() {
        meta = { packId: null, nodeId: null, steps: 0 };
        state = {};
        trace = [];
        history = [];
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
      }
    };
  };
})();
