/*-------------------------------------------------
 * actions.js
 * Purpose: Apply action objects emitted by decision nodes
 * Contract: Designed to be deterministic and auditable.
 *-------------------------------------------------*/

window.ENG = window.ENG || {};

function setDeep(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function addUnique(arr, value) {
  if (!Array.isArray(arr)) return;
  if (!arr.includes(value)) arr.push(value);
}

ENG.applyActions = function applyActions(caseObj, actions) {
  if (!actions || !Array.isArray(actions)) return;

  actions.forEach((a) => {
    if (!a || !a.type) return;

    switch (a.type) {
      case "SET_RESULT":
        // {type:"SET_RESULT", path:"results.classification", value:"RECOMMENDATION"}
        setDeep(caseObj, a.path, a.value);
        break;

      case "ADD_REQUIRED_SECTION":
        addUnique(caseObj.reporting.required_sections, a.value);
        break;

      case "SET_ANALYSIS_STAGE":
        setDeep(caseObj, "analysis_state.stage", a.value);
        break;

      case "UNLOCK":
        // {type:"UNLOCK", value:{figure2:true}}
        Object.keys(a.value || {}).forEach((k) => {
          caseObj.analysis_state.unlocked[k] = !!a.value[k];
        });
        break;

      case "MARK_PACK_COMPLETE":
        // handled by decisionEngine when it knows pack id; ignore safely here
        break;

      case "ACTION":
        // Nested action record (for future). Safe no-op in MVP.
        break;

      case "ROUTE_TO_PACK":
        // handled at app level (navigation). Safe no-op in MVP.
        break;

      default:
        // Unknown action types are ignored for forward compatibility.
        break;
    }
  });

  STATE.touch(caseObj);
};
