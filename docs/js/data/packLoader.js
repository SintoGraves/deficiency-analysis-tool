/*-------------------------------------------------
 * /docs/js/data/packLoader.js
 * Fetch + validate + normalize decision packs.
 *
 * Goals:
 * - Works on GitHub Pages (/docs is site root)
 * - Accepts multiple pack schemas and normalizes to:
 *     { packId, title, version, start, nodes: { [id]: node } }
 *
 * Required node fields after normalize:
 * - type: "question" | "action" (others allowed, but UI may not render)
 * - text: main prompt text
 * - For question nodes: choices: [{label,value,next}]
 * - For action nodes: next: nodeId|null
 *-------------------------------------------------*/
(function () {
  const DDT = (window.DDT = window.DDT || {});

  function isObj(x) {
    return !!x && typeof x === "object" && !Array.isArray(x);
  }

  function err(msg) {
    return new Error(msg);
  }

  function normalizeChoice(c) {
    if (!c) return null;

    // Accept {label,value,next} or {text,value,to} or {label,next}
    const label = c.label ?? c.text ?? c.name ?? "";
    const value = c.value ?? c.key ?? (label ? String(label).toLowerCase() : "");
    const next = c.next ?? c.to ?? c.goto ?? null;

    if (!label) return null;
    return { label: String(label), value: String(value), next: next ? String(next) : null };
  }

  function normalizeNode(node, nodeId) {
    const n = isObj(node) ? { ...node } : {};
    const type = String(n.type ?? n.kind ?? "").toLowerCase();

    // Normalize primary text field: text | question | prompt
    const text = n.text ?? n.question ?? n.prompt ?? "";

    // Normalize choices: choices | options | answers
    const rawChoices = n.choices ?? n.options ?? n.answers ?? null;
    let choices = null;
    if (Array.isArray(rawChoices)) {
      choices = rawChoices.map(normalizeChoice).filter(Boolean);
    }

    // Normalize next for action/instruction nodes
    const next = n.next ?? n.to ?? n.goto ?? null;

    return {
      ...n,
      id: String(n.id ?? nodeId),
      type: type || (choices ? "question" : "action"),
      text: String(text),
      choices: choices || null,
      next: next ? String(next) : null
    };
  }

  function normalizePack(pack, inferredPackId) {
    if (!isObj(pack)) throw err("Decision pack is not an object");

    const packId = String(pack.packId ?? pack.id ?? inferredPackId ?? "unknown");
    const title = String(pack.title ?? pack.name ?? packId);
    const version = String(pack.version ?? "1.0.0");
    const start = pack.start ?? pack.startNode ?? pack.entry ?? null;

// Nodes may be an object map or an array
// Support legacy and nested pack.meta.nodes structures
const rawNodes =
  pack.nodes ??
  pack.steps ??
  pack.tree ??
  (pack.meta && pack.meta.nodes) ??
  null;

    let nodesMap = {};

    if (Array.isArray(rawNodes)) {
      // Convert array => map using node.id
      rawNodes.forEach((node, i) => {
        const id = node && (node.id ?? node.key) ? String(node.id ?? node.key) : `node_${i + 1}`;
        nodesMap[id] = normalizeNode(node, id);
      });
    } else if (isObj(rawNodes)) {
      Object.keys(rawNodes).forEach((id) => {
        nodesMap[id] = normalizeNode(rawNodes[id], id);
      });
    } else {
      throw err("Decision pack missing nodes (expected pack.nodes as object or array)");
    }

    // Validate start
    const startId = start ? String(start) : null;
    if (!startId) throw err("Decision pack missing start/startNode/entry");
    if (!nodesMap[startId]) throw err(`Decision pack start node "${startId}" not found in nodes`);

    // Minimal validation of nodes
    for (const [id, n] of Object.entries(nodesMap)) {
      if (!n.type) throw err(`Node "${id}" missing type`);
      if (!n.text) throw err(`Node "${id}" missing text/question/prompt`);
      if (n.type === "question") {
        if (!Array.isArray(n.choices) || n.choices.length < 2) {
          throw err(`Question node "${id}" must have choices/options (>=2)`);
        }
        for (const ch of n.choices) {
          if (!ch.next) throw err(`Choice "${ch.label}" on node "${id}" missing next/to`);
          if (!nodesMap[ch.next] && ch.next !== null) {
            // Allow terminal choices by setting next to null; otherwise ensure referenced node exists
            throw err(`Choice "${ch.label}" on node "${id}" points to missing node "${ch.next}"`);
          }
        }
      }
      if (n.type !== "question") {
        // For action nodes, next may be null (terminal)
        if (n.next && !nodesMap[n.next]) {
          throw err(`Action node "${id}" next "${n.next}" not found in nodes`);
        }
      }
    }

    return { packId, title, version, start: startId, nodes: nodesMap, source: pack.source ?? null };
  }

  // Public API: loadPack(packKey)
  // packKey "figure1" => fetch "./decision-trees/figure1.json"
  DDT.loadPack = async function loadPack(packKey) {
    const key = String(packKey || "").trim();
    if (!key) throw err("loadPack requires a packKey (e.g., 'figure1')");

    const url = `./decision-trees/${encodeURIComponent(key)}.json`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw err(`Failed to fetch decision pack: ${url} (${res.status})`);

    let raw;
    try {
    raw = await res.json();
    } catch (e) {
    throw err(`Failed to parse JSON in ${url}: ${e.message}`);
    }
   
    try {
      return normalizePack(raw, key);
    } catch (e) {
      // Preserve your existing error message pattern
      throw err(`Invalid decision pack format: ${url}\n${e.message}`);
    }
  };
})();
