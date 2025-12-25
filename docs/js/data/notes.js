/*-------------------------------------------------
 * /docs/js/data/notes.js
 * Central note library (Figures 1 & 2)
 * Namespace: window.DDT
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});

  DDT.NOTES = {

    "NOTE 1": {
      title: "NOTE 1: SUT MISSION DETERMINATION",
      body:
        "1. Identify the mission of the System Under Test. (The mission will normally be the primary COI identified when the Integrated Evaluation Framework was generated).*\n\n" +
        "2. Identify the sub-tasks (sub-missions) that must work to ensure the primary mission can be accomplished. (These will be the sub-tasks that were identified when the Integrated Evaluation Framework was generated).\n\n" +
        "3. Identify the areas, components, actions, and events that make the sub-task accomplishment possible. (It is essential that a Mission Task Analysis was properly done at the time of Integrated Evaluation Framework Generation. If not, a job task analysis must be done before going to test to ensure all operational mission components are identified).\n\n" +
        "* Some COIs are supportive. While they still have an assigned mission (i.e. C3 primary mission is Command, Control and Communication), when assessing the effect a deficiency has on a mission, both the primary mission and supported mission(s) must be analyzed to determine whether there is an Operational Mission Failure. (i.e. The Commander may have an alternate means to communicate, but for an ASW mission the SUT is the only means for supporting the ASW mission.) The OMF would be driven by the ASW mission, not the C3 mission."
    },

    "NOTE 2": {
      title: "NOTE 2: STAND-ALONE, MULTI-NODE, NETWORKED",
      body:
        "1. A satellite communication system with receive suites is a multi-node SUT where the satellite has a mission requirement and the receive suite has a mission requirement. A casualty that prevents either node of the SUT from meeting its mission requirement is an Operational Mission Failure.\n\n" +
        "2. A firecontrol radar suite with three illuminator radars is a networked system that would be a degraded casualty situation if either one of the illuminators stopped working, but an Operational Mission Failure if they all stopped working.\n\n" +
        "3. A networked computer suite with a server and satellite computers is a networked system where each satellite computer replicates the capability of the next. The server going down, or the satellite computers reduced down past a minimum number, would be an Operational Mission Failure.\n\n" +
        "4. A new computer that is designed to work on a network is a standalone system that would be an Operational Mission Failure if that standalone computer stopped working."
    },

    "NOTE 3": {
      title: "NOTE 3: Non-OMF Blue Sheet",
      body:
        "Non-OMF Blue Sheets should only be generated if the fault or failure has a significant effect on the operation of the system.\n\n" +
        "(i.e. the system is still operable, but the operator spends a significant amount of time resetting or dealing with the fault or failure.)"
    }

  };
})();

