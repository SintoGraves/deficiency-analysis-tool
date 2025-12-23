/*-------------------------------------------------
 * decisionEngine.js
 * Purpose: Execute decision pack nodes (QUESTION/INSTRUCTION/ACTION)
 * Inputs : pack JSON, case JSON, current node id, user answer
 * Output : next node id, trace entry appended, actions applied
 *-------------------------------------------------*/

window.ENG = window.ENG || {};

ENG.getNode = function getNode(pack, nodeId) {
  if (!pack || !Array.isArray(pack.nodes)) return null;
  return pack.nodes.find(n => n.id === nodeId) || null;
};

ENG.isTerminal = function isTerminal(node) {
  return node && (node.type === "INSTRUCTION" || node.type === "ACTION") && !node.next;
};

ENG.startPackIfNeeded = function startPackIfNeeded(caseObj, pack) {
  const slot = caseObj.decision_trace.figure1; // MVP only (Figure 1)
  if (slot.status === "NOT_STARTED") {
    slot.status = "IN_PROGRESS";
    slot.entry_node_id = pack.entry_node_id;
    slot.exit_node_id = null;
    STATE.touch(caseObj);
  }
};

ENG.answerQuestion = function answerQuestion(caseObj, pack, nodeId, answer /* "YES"|"NO" */) {
  const node = ENG.getNode(pack, nodeId);
  if (!node || node.type !== "QUESTION") throw new Error(`Node not found or not QUESTION: ${nodeId}`);

  const next = node.answers && node.answers[answer] ? node.answers[answer].next : null;
  if (!next) throw new Error(`No transition for answer ${answer} at node ${nodeId}`);

  // Append trace entry
  const traceEntry = {
    node_id: node.id,
    node_type: "QUESTION",
    timestamp_utc: new Date().toISOString(),
    question_text: node.question_text,
    answer: answer,
    rationale_snippets: []
  };
  caseObj.decision_trace.figure1.trace.push(traceEntry);

  // Apply any actions attached to the node itself (rare), or to specific answers
  const actions = [];
  if (Array.isArray(node.actions)) actions.push(...node.actions);
  if (node.actions_on_answer && Array.isArray(node.actions_on_answer[answer])) actions.push(...node.actions_on_answer[answer]);

  ENG.applyActions(caseObj, actions);

  return { nextNodeId: next };
};

ENG.enterNonQuestionNode = function enterNonQuestionNode(caseObj, pack, nodeId) {
  const node = ENG.getNode(pack, nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);

  if (node.type === "INSTRUCTION") {
    caseObj.decision_trace.figure1.trace.push({
      node_id: node.id,
      node_type: "INSTRUCTION",
      timestamp_utc: new Date().toISOString(),
      instruction_text: node.instruction_text,
      rationale_snippets: []
    });
    ENG.applyActions(caseObj, node.actions || []);
    return { nextNodeId: node.next || null };

  } else if (node.type === "ACTION") {
    caseObj.decision_trace.figure1.trace.push({
      node_id: node.id,
      node_type: "ACTION",
      timestamp_utc: new Date().toISOString(),
      action: node.action || null,
      rationale_snippets: []
    });
    ENG.applyActions(caseObj, node.actions || []);
    return { nextNodeId: node.next || null };
  }

  throw new Error(`enterNonQuestionNode called on non-INSTRUCTION/ACTION: ${nodeId}`);
};

ENG.maybeCompletePack = function maybeCompletePack(caseObj, pack, currentNodeId) {
  const node = ENG.getNode(pack, currentNodeId);
  if (!node) return;

  // If it's an INSTRUCTION with MARK_PACK_COMPLETE in actions, mark complete.
  const acts = node.actions || [];
  const hasComplete = acts.some(a => a && a.type === "MARK_PACK_COMPLETE");
  if (hasComplete) {
    caseObj.decision_trace.figure1.status = "COMPLETED";
    caseObj.decision_trace.figure1.exit_node_id = node.id;
    STATE.touch(caseObj);
  }
};
