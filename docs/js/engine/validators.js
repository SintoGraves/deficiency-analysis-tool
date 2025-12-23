/*-------------------------------------------------
 * js/engine/validators.js
 * Pack and node validation helpers (lightweight MVP).
 * Namespace: window.DDT
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});

  DDT.validatePack = function validatePack(pack) {
    if (!pack || typeof pack !== "object") throw new Error("Pack is missing");
    if (!pack.packId) throw new Error("Pack missing packId");
    if (!pack.entryNodeId) throw new Error("Pack missing entryNodeId");
    if (!pack.nodes || typeof pack.nodes !== "object") throw new Error("Pack missing nodes map");
    if (!pack.nodes[pack.entryNodeId]) throw new Error("entryNodeId not found in nodes");
  };

  DDT.validateNode = function validateNode(nodeId, node) {
    if (!node || typeof node !== "object") throw new Error(`Node ${nodeId} is missing`);
    if (!node.type) throw new Error(`Node ${nodeId} missing type`);
  };
})();
