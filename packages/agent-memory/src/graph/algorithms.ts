/**
 * @beta
 * Pure graph algorithms: PageRank, spreading activation, community detection.
 * Zero external dependencies — all implemented from first principles.
 *
 * Sources / inspiration:
 *   - Personalized PageRank: HippoRAG (2025), original PageRank (Brin & Page 1998)
 *   - Spreading Activation: Collins & Loftus (1975), Synapse framework
 *   - Community detection: threshold-based connected components (simplified Louvain)
 */

import type { AdjacencyList, GraphNode } from "./types";

// ─── PageRank ─────────────────────────────────────────────────────────────────

/**
 * Compute PageRank scores for all nodes in the adjacency list.
 *
 * Uses the standard iterative power method until convergence or maxIter.
 * Edge weights are used as link strengths (weighted PageRank).
 *
 * @param graph     - Adjacency list for the session
 * @param damping   - Damping factor (classic = 0.85)
 * @param maxIter   - Maximum iterations before stopping
 * @param tolerance - Convergence threshold
 */
export function computePageRank(
  graph: AdjacencyList,
  damping = 0.85,
  maxIter = 50,
  tolerance = 1e-6
): Map<string, number> {
  const N = graph.size;
  if (N === 0) return new Map();

  const ids = Array.from(graph.keys());
  const rank = new Map<string, number>(ids.map((id) => [id, 1 / N]));

  for (let iter = 0; iter < maxIter; iter++) {
    const newRank = new Map<string, number>(ids.map((id) => [id, (1 - damping) / N]));

    for (const [fromId, node] of graph) {
      if (node.edges.size === 0) {
        // Dangling node — distribute rank equally (dangling node handling)
        const share = (damping * (rank.get(fromId) ?? 0)) / N;
        for (const id of ids) {
          newRank.set(id, (newRank.get(id) ?? 0) + share);
        }
        continue;
      }

      // Weighted out-degree sum
      let totalWeight = 0;
      for (const edge of node.edges.values()) {
        totalWeight += edge.weight;
      }
      if (totalWeight === 0) continue;

      const fromRank = rank.get(fromId) ?? 0;
      for (const [toId, edge] of node.edges) {
        const contribution = damping * fromRank * (edge.weight / totalWeight);
        newRank.set(toId, (newRank.get(toId) ?? 0) + contribution);
      }
    }

    // Check convergence
    let delta = 0;
    for (const id of ids) {
      delta += Math.abs((newRank.get(id) ?? 0) - (rank.get(id) ?? 0));
      rank.set(id, newRank.get(id) ?? 0);
    }
    if (delta < tolerance) break;
  }

  return rank;
}

// ─── Personalised PageRank ────────────────────────────────────────────────────

/**
 * Personalised PageRank (PPR) — like HippoRAG.
 * Biases the random walk toward a set of seed nodes.
 * Returns scores for ALL nodes, with seed nodes naturally getting higher scores.
 *
 * @param graph   - Adjacency list
 * @param seeds   - Map of seedId → initial weight (will be normalised)
 * @param damping - Restart probability = (1 - damping)
 */
export function personalizedPageRank(
  graph: AdjacencyList,
  seeds: Map<string, number>,
  damping = 0.85,
  maxIter = 40
): Map<string, number> {
  const N = graph.size;
  if (N === 0) return new Map();

  const ids = Array.from(graph.keys());

  // Normalise seed weights
  let seedTotal = 0;
  for (const w of seeds.values()) seedTotal += w;
  const seedDist = new Map<string, number>();
  if (seedTotal > 0) {
    for (const [id, w] of seeds) {
      seedDist.set(id, w / seedTotal);
    }
  }

  // Start from uniform
  const rank = new Map<string, number>(ids.map((id) => [id, 1 / N]));

  for (let iter = 0; iter < maxIter; iter++) {
    const newRank = new Map<string, number>();

    // Restart distribution
    for (const id of ids) {
      newRank.set(id, (1 - damping) * (seedDist.get(id) ?? 0));
    }

    for (const [fromId, node] of graph) {
      if (node.edges.size === 0) continue;

      let totalWeight = 0;
      for (const edge of node.edges.values()) totalWeight += edge.weight;
      if (totalWeight === 0) continue;

      const fromRank = rank.get(fromId) ?? 0;
      for (const [toId, edge] of node.edges) {
        newRank.set(
          toId,
          (newRank.get(toId) ?? 0) + damping * fromRank * (edge.weight / totalWeight)
        );
      }
    }

    for (const id of ids) {
      rank.set(id, newRank.get(id) ?? 0);
    }
  }

  return rank;
}

// ─── Spreading Activation ─────────────────────────────────────────────────────

/**
 * Spreading Activation — inspired by Collins & Loftus (1975) and HippoRAG.
 *
 * Injects energy into seed nodes and propagates it through edges hop-by-hop.
 * Energy diminishes by `decayFactor` at each hop and by edge weight.
 *
 * @param graph       - Adjacency list
 * @param seeds       - Map of nodeId → initial activation energy
 * @param maxHops     - Maximum propagation depth
 * @param decayFactor - Per-hop energy multiplier (e.g. 0.5 = halved each hop)
 * @returns           - Map of nodeId → total received activation
 */
export function spreadActivation(
  graph: AdjacencyList,
  seeds: Map<string, number>,
  maxHops = 3,
  decayFactor = 0.5
): Map<string, number> {
  const activation = new Map<string, number>();

  // Initialise with seed energies
  for (const [id, energy] of seeds) {
    activation.set(id, (activation.get(id) ?? 0) + energy);
  }

  let frontier = new Map<string, number>(seeds);

  for (let hop = 0; hop < maxHops; hop++) {
    const nextFrontier = new Map<string, number>();

    for (const [nodeId, energy] of frontier) {
      const node = graph.get(nodeId);
      if (!node) continue;

      // Compute total outgoing weight for normalisation
      let totalWeight = 0;
      for (const edge of node.edges.values()) totalWeight += edge.weight;
      if (totalWeight === 0) continue;

      for (const [neighbourId, edge] of node.edges) {
        const propagated = energy * decayFactor * (edge.weight / totalWeight);
        if (propagated < 1e-9) continue; // prune negligible energy

        activation.set(neighbourId, (activation.get(neighbourId) ?? 0) + propagated);
        nextFrontier.set(
          neighbourId,
          (nextFrontier.get(neighbourId) ?? 0) + propagated
        );
      }
    }

    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  // Remove seed contributions from the "spread" result
  // (caller can add them back separately as similarity score)
  for (const id of seeds.keys()) {
    const current = activation.get(id) ?? 0;
    const seed = seeds.get(id) ?? 0;
    activation.set(id, Math.max(0, current - seed));
  }

  return activation;
}

// ─── Community Detection ──────────────────────────────────────────────────────

/**
 * Threshold-based community detection.
 *
 * Builds a graph of edges where weight >= threshold, then finds
 * connected components via BFS. Each component is a "cluster".
 *
 * This is a simplified alternative to Louvain — O(N + E), no external deps.
 *
 * @param graph     - Adjacency list
 * @param threshold - Minimum edge weight to include in cluster graph (default: 0.65)
 * @returns         - Map of nodeId → clusterId
 */
export function detectClusters(
  graph: AdjacencyList,
  threshold = 0.65
): Map<string, number> {
  const assignment = new Map<string, number>();
  let clusterId = 0;

  for (const startId of graph.keys()) {
    if (assignment.has(startId)) continue;

    // BFS from this unvisited node
    const queue: string[] = [startId];
    assignment.set(startId, clusterId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = graph.get(current);
      if (!node) continue;

      for (const [neighbourId, edge] of node.edges) {
        if (assignment.has(neighbourId)) continue;
        if (edge.weight >= threshold) {
          assignment.set(neighbourId, clusterId);
          queue.push(neighbourId);
        }
      }
    }

    clusterId++;
  }

  return assignment;
}

// ─── Bridge nodes ─────────────────────────────────────────────────────────────

/**
 * Find bridge nodes — nodes that have edges into multiple different clusters.
 * These are the "connectors" that link distinct topic groups in memory.
 *
 * @param graph      - Adjacency list (nodes must have `.cluster` set)
 * @param assignment - Cluster assignment map (nodeId → clusterId)
 */
export function findBridgeNodes(
  graph: AdjacencyList,
  assignment: Map<string, number>
): Map<string, { clusters: Set<number>; bridgeScore: number }> {
  const bridges = new Map<string, { clusters: Set<number>; bridgeScore: number }>();

  for (const [nodeId, node] of graph) {
    const ownCluster = assignment.get(nodeId) ?? -1;
    const foreignClusters = new Set<number>();
    let bridgeScore = 0;

    for (const [neighbourId, edge] of node.edges) {
      const neighbourCluster = assignment.get(neighbourId) ?? -1;
      if (neighbourCluster !== ownCluster && neighbourCluster !== -1) {
        foreignClusters.add(neighbourCluster);
        bridgeScore += edge.weight;
      }
    }

    if (foreignClusters.size > 0) {
      bridges.set(nodeId, { clusters: foreignClusters, bridgeScore });
    }
  }

  return bridges;
}

// ─── Cosine similarity helper ─────────────────────────────────────────────────

export function cosineSimilarityGraph(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── Recency score helper (same formula as core) ──────────────────────────────

export function recencyScore(timestamp: number, lambdaPerHour = 0.03): number {
  const hoursAgo = (Date.now() - timestamp) / 3_600_000;
  return Math.exp(-lambdaPerHour * hoursAgo);
}

// ─── Normalise a map of scores to [0, 1] ─────────────────────────────────────

export function normalizeMap(scores: Map<string, number>): Map<string, number> {
  const values = Array.from(scores.values());
  const max = Math.max(...values, 1e-9);
  const result = new Map<string, number>();
  for (const [id, val] of scores) {
    result.set(id, val / max);
  }
  return result;
}
