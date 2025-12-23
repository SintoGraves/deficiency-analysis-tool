/*-------------------------------------------------
 * packLoader.js
 * Purpose: Load decision pack JSON for GitHub Pages (/docs as site root)
 * Approach: Fetch pack files relative to the deployed site root.
 *-------------------------------------------------*/

window.DAT = window.DAT || {};

DAT.loadPack = async function loadPack(packPathRelativeToDocs) {
  // Example: "decision-trees/figure1.json"
  const url = packPathRelativeToDocs;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return await res.json();
};
