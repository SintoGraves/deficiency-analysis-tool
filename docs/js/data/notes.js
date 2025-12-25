/*-------------------------------------------------
 * /docs/js/data/notes.js
 * Central note library (full-text notes)
 * Namespace: window.DDT
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});

  // Canonical keys: "NOTE 1", "NOTE 2", ...
  // Referenced automatically when a node's title/question/body contains "NOTE 1" or "(Note 1)".
  DDT.NOTES = {
    "NOTE 1": {
      title: "NOTE 1: SUT MISSION DETERMINATION",
      body:
        "1. Identify the mission of the System Under Test. (The mission will normally be the primary COI identified when the Integrated Evaluation Framework was generated).*\n\n" +
        "2. Identify the sub-tasks (sub-missions) that must work to ensure the primary mission can be accomplished. (These will be the sub-tasks that were identified when the Integrated Evaluation Framework was generated)\n\n" +
        "3. Identify the areas, components, actions, and events that make the sub-task accomplishment possible. (It is essential that a Mission Task Analysis was properly done at the time of Integrated Evaluation Framework Generation. If not, a job task analysis must be done before going to test to ensure all operational mission components are identified).\n\n" +
        "* Some COIs are supportive. While they still have an assigned mission (i.e. C3 primary mission is Command, Control and Communication), when assessing the effect a deficiency has on a mission, both the primary mission and supported mission(s) must be analyzed to determine whether there is an Operational Mission Failure. (i.e. The Commander may have an alternate means to communicate, but for an ASW mission the SUT is the only means for supporting the ASW mission.) The OMF would be driven by the ASW mission, not the C3 mission."
    }
  };
})();
