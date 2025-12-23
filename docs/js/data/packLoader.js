/*-------------------------------------------------
 * packLoader.js
 * Purpose: Load decision pack JSON from repo root
 * Note   : web/ is a subfolder; use root-relative paths
 *-------------------------------------------------*/

window.DAT = window.DAT || {};

DAT.loadPack = async function loadPack(packPathFromRepoRoot) {
  // Example: "decision-trees/figure1.json"
  const url = `/${packPathFromRepoRoot}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return await res.json();
};
