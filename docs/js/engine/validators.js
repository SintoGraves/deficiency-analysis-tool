/*-------------------------------------------------
 * validators.js
 * Purpose: Lightweight validation for POC UI display.
 *          (Full JSON Schema validation can be added later.)
 *-------------------------------------------------*/

window.ENG = window.ENG || {};

ENG.getStatusLine = function getStatusLine(caseObj) {
  const r = caseObj.results || {};
  return [
    `Case: ${caseObj.case_id}`,
    `Classification: ${r.classification || "UNDETERMINED"}`,
    `Analysis: ${r.analysis_method || "UNDETERMINED"}`
  ].join(" | ");
};
