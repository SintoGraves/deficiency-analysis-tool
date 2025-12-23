/*-------------------------------------------------
 * js/engine/actions.js
 * Applies node effects to case state (set/appendTraceTags).
 * Namespace: window.DDT
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});

  function ensureArray(v) { return Array.isArray(v) ? v : []; }

  DDT.applyEffects = function applyEffects(caseStore, effects) {
    if (!effects) return;

    const state = caseStore.getState();

    // set: shallow set
    if (effects.set && typeof effects.set === "object") {
      Object.keys(effects.set).forEach((k) => {
        state[k] = effects.set[k];
      });
    }

    // appendTraceTags: ensure state.traceTags is an array
    if (effects.appendTraceTags) {
      const tags = ensureArray(effects.appendTraceTags);
      if (!Array.isArray(state.traceTags)) state.traceTags = [];
      tags.forEach((t) => state.traceTags.push(t));
    }
  };
})();
