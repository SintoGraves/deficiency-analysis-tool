/*-------------------------------------------------
 * caseStore.js
 * Purpose: Create and manage case JSON in-memory.
 *          For POC: supports download to file.
 *-------------------------------------------------*/

window.STATE = window.STATE || {};

STATE.newCase = function newCase() {
  const now = new Date().toISOString();

  return {
    schema_version: "1.0",
    case_id: `POC-${now.replace(/[:.]/g, "-")}`,
    case_status: "IN_PROGRESS",
    timestamps: {
      created_utc: now,
      last_modified_utc: now
    },
    test_context: {
      test_date: new Date().toISOString().slice(0, 10),
      test_location: "TBD",
      test_item: "SUT",
      test_type: "OT",
      event_id: ""
    },
    deficiency_observation: {
      title: "Observed Issue",
      statement: "Describe the observed behavior and context.",
      conditions: "",
      steps_to_reproduce: [],
      evidence_references: [],
      requirement_references: []
    },
    analysis_state: {
      stage: "FIGURE1_CLASSIFICATION",
      unlocked: { figure1: true, figure2: false, figure3: false, figure4: false, rollup: false, figure5: false }
    },
    decision_trace: {
      figure1: { pack_id: "FIGURE1", pack_version: "1.0", status: "NOT_STARTED", entry_node_id: null, exit_node_id: null, trace: [], outputs: {} },
      figure2: { pack_id: "FIGURE2", pack_version: "", status: "NOT_STARTED", entry_node_id: null, exit_node_id: null, trace: [], outputs: {} }
    },
    results: {
      classification: "UNDETERMINED",
      failure_type: "UNDETERMINED",
      blue_sheet_required: false,
      blue_sheet_status: "NOT_APPLICABLE",
      analysis_method: "UNDETERMINED"
    },
    reporting: {
      required_sections: ["DEFICIENCY_DESCRIPTION", "RESULTS_PARAGRAPH"],
      generated_artifacts: [],
      template_versions: {}
    },
    attachments: []
  };
};

STATE.touch = function touch(caseObj) {
  caseObj.timestamps.last_modified_utc = new Date().toISOString();
};

STATE.downloadCaseJson = function downloadCaseJson(caseObj) {
  const blob = new Blob([JSON.stringify(caseObj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${caseObj.case_id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
};
