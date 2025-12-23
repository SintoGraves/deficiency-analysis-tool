/*-------------------------------------------------
 * js/data/packLoader.js
 * Fetch decision packs from /docs/decision-trees/*.json
 * Namespace: window.DDT
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});

  DDT.loadPack = async function loadPack(packId) {
    if (!packId) throw new Error("packId is required");
    const url = `./decision-trees/${packId}.json`; // /docs is site root
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url} (${res.status})`);
    }

    const pack = await res.json();

    // minimal structural validation
    if (!pack || !pack.packId || !pack.entryNodeId || !pack.nodes) {
      throw new Error(`Invalid decision pack format: ${url}`);
    }
    return pack;
  };
})();
