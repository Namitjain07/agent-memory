/**
 * @beta MemoryGraph — Graph-based memory optimization for AI agents.
 *
 * Combines network science algorithms (PageRank, Spreading Activation,
 * Community Detection) with the standard agent-memory store to produce
 * smarter, multi-hop recall.
 *
 * Inspired by:
 *   - HippoRAG (2025): Personalized PageRank on knowledge graphs
 *   - A-MEM (2025): Autonomous edge linking between memories
 *   - Spreading Activation: Collins & Loftus (1975)
 *   - GraphRAG: community detection for cluster-aware retrieval
 *
 * @example
 * ```ts
 * import { MemoryGraph } from "@namitjain.india/agent-memory/beta";
 *
 * const graph = new MemoryGraph(memory, { edgesPerNode: 6, maxHops: 3 });
 *
 * // Store memories normally via graph (auto-builds edges)
 * await graph.remember({ role: "user", content: "...", sessionId: "s1" });
 *
 * // Enhanced recall with spreading activation + PageRank
 * const results = await graph.graphRecall("my query", { sessionId: "s1" });
 *
 * // Graph analytics
 * const clusters = await graph.clusters("s1");
 * const hubs     = await graph.hubs("s1");
 * const bridges  = await graph.bridges("s1");
 * const stats    = await graph.graphStats("s1");
 * ```
 *
 * > **Beta notice**: API may change in minor versions.
 * > Import from `@namitjain.india/agent-memory/beta`.
 */

import type { AgentMemory } from "../core/agent-memory";
import type { MemoryItem } from "../types/memory";
import type { RememberInput, SummariseFn } from "../types/config";
import type {
  AdjacencyList,
  EdgeWeight,
  GraphNode,
  GraphRecallOptions,
  GraphRecallResult,
  GraphBridgeResult,
  GraphHubResult,
  GraphStats,
  MemoryCluster,
  MemoryGraphOptions,
  SerializedGraph,
  SerializedNode
} from "./types";
import {
  computePageRank,
  personalizedPageRank,
  spreadActivation,
  detectClusters,
  findBridgeNodes,
  cosineSimilarityGraph,
  recencyScore,
  normalizeMap
} from "./algorithms";

const DEFAULT_OPTIONS: Required<MemoryGraphOptions> = {
  edgesPerNode: 6,
  similarityThreshold: 0.60,
  activationDecay: 0.50,
  maxHops: 3,
  pageRankDamping: 0.85,
  edgeTemporalDecay: 0.005,
  scoreWeights: { similarity: 0.40, activation: 0.25, pageRank: 0.20, recency: 0.15 }
};

/** @beta */
export class MemoryGraph {
  private readonly memory: AgentMemory;
  private readonly opts: Required<MemoryGraphOptions>;

  /** In-memory graph per session: sessionId → adjacency list. */
  private readonly graphs = new Map<string, AdjacencyList>();

  /** Embedding cache: itemId → embedding vector. */
  private readonly embedCache = new Map<string, number[]>();

  constructor(memory: AgentMemory, options: MemoryGraphOptions = {}) {
    this.memory = memory;
    this.opts = {
      ...DEFAULT_OPTIONS,
      ...options,
      scoreWeights: { ...DEFAULT_OPTIONS.scoreWeights, ...options.scoreWeights }
    };
  }

  // ─── Public API — memory operations ──────────────────────────────────────

  /**
   * Store a memory item AND automatically add it as a new node in the graph,
   * linking it to the most similar existing nodes.
   */
  async remember(input: RememberInput): Promise<MemoryItem> {
    const item = await this.memory.remember(input);
    const sessionId = item.sessionId;
    const graph = this.getOrCreateGraph(sessionId);
    await this.addNode(item, graph);
    this.recomputePageRank(graph);
    return item;
  }

  /**
   * @beta Build / rebuild the full graph for a session from scratch.
   * Useful after importing existing data or calling `memory.remember()` directly.
   */
  async buildGraph(sessionId: string): Promise<void> {
    const items = await this.memory.getBySession(sessionId);
    const graph = new Map<string, GraphNode>();
    this.graphs.set(sessionId, graph);
    this.embedCache.clear();

    for (const item of items) {
      await this.addNode(item, graph);
    }
    this.recomputePageRank(graph);
    this.assignClusters(graph);
  }

  // ─── Graph recall ─────────────────────────────────────────────────────────

  /**
   * @beta Enhanced recall using spreading activation and PageRank.
   *
   * Algorithm:
   * 1. Vector search for top-K seeds (via AgentMemory)
   * 2. Personalized PageRank seeded from the query seeds
   * 3. Spreading activation outward from seeds
   * 4. Blend: score = w1·sim + w2·activation + w3·pageRank + w4·recency
   * 5. Optional cluster-aware deduplication
   */
  async graphRecall(
    query: string,
    options: GraphRecallOptions = {}
  ): Promise<GraphRecallResult[]> {
    const sessionId = options.sessionId ?? "default";
    const topK = options.topK ?? 5;
    const useActivation = options.useSpreadingActivation ?? true;
    const maxHops = options.maxHops ?? this.opts.maxHops;
    const w = this.opts.scoreWeights;

    // Ensure the graph exists
    const graph = this.getOrCreateGraph(sessionId);
    if (graph.size === 0) {
      await this.buildGraph(sessionId);
    }

    // 1. Standard recall for seeds + similarity scores
    const seedResults = await this.memory.recall(query, {
      sessionId,
      topK: Math.max(topK * 3, 15)  // over-fetch for re-ranking
    });

    if (seedResults.length === 0) return [];

    // Collect seed embeddings for PPR
    const seedMap = new Map<string, number>();
    for (const r of seedResults) {
      seedMap.set(r.item.id, r.similarity);
    }

    // 2. Personalized PageRank biased toward seed nodes
    const pprScores = personalizedPageRank(graph, seedMap, this.opts.pageRankDamping);
    const pprNorm = normalizeMap(pprScores);

    // 3. Spreading activation from seeds
    let activationScores = new Map<string, number>();
    if (useActivation) {
      activationScores = spreadActivation(graph, seedMap, maxHops, this.opts.activationDecay);
      activationScores = normalizeMap(activationScores);
    }

    // 4. Get all items in session for recency + cluster info
    const allItems = await this.memory.getBySession(sessionId);
    const itemMap = new Map<string, MemoryItem>(allItems.map((i) => [i.id, i]));

    // 5. Score every candidate
    const candidates: GraphRecallResult[] = [];
    for (const { item, similarity, recency: recencyVal } of seedResults) {
      const node = graph.get(item.id);
      const simScore = similarity;
      const activScore = activationScores.get(item.id) ?? 0;
      const pprScore = pprNorm.get(item.id) ?? 0;
      const recScore = recencyVal;

      const blended =
        w.similarity * simScore +
        w.activation * activScore +
        w.pageRank * pprScore +
        w.recency * recScore;

      candidates.push({
        item,
        score: blended,
        similarity: simScore,
        activationScore: activScore,
        pageRankScore: pprScore,
        recencyScore: recScore,
        cluster: node?.cluster ?? -1
      });
    }

    // Also surface highly activated non-seed nodes (graph-discovered)
    if (useActivation) {
      for (const [id, activation] of activationScores) {
        if (seedMap.has(id)) continue; // already in seeds
        if (activation < 0.1) continue;

        const item = itemMap.get(id);
        if (!item) continue;

        const node = graph.get(id);
        const pprScore = pprNorm.get(id) ?? 0;
        const recScore = recencyScore(item.timestamp);

        const blended =
          w.similarity * 0 +
          w.activation * activation +
          w.pageRank * pprScore +
          w.recency * recScore;

        candidates.push({
          item,
          score: blended,
          similarity: 0,
          activationScore: activation,
          pageRankScore: pprScore,
          recencyScore: recScore,
          cluster: node?.cluster ?? -1
        });
      }
    }

    // Sort by blended score
    candidates.sort((a, b) => b.score - a.score);

    // 6. Optional: cluster-aware deduplication (keep best per cluster)
    let results = candidates;
    if (options.clusterDeduplicate) {
      const seenClusters = new Set<number>();
      results = [];
      for (const c of candidates) {
        const cluster = c.cluster;
        if (cluster === -1 || !seenClusters.has(cluster)) {
          results.push(c);
          if (cluster !== -1) seenClusters.add(cluster);
        }
      }
    }

    return results.slice(0, topK);
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  /**
   * @beta Detect memory clusters (topic groups) using threshold-based
   * connected-component analysis.
   */
  async clusters(sessionId: string): Promise<MemoryCluster[]> {
    const graph = await this.ensureGraph(sessionId);
    const assignment = this.assignClusters(graph);
    const allItems = await this.memory.getBySession(sessionId);
    const itemMap = new Map(allItems.map((i) => [i.id, i]));

    // Group nodes by cluster
    const clusterMap = new Map<number, string[]>();
    for (const [nodeId, clusterId] of assignment) {
      if (!clusterMap.has(clusterId)) clusterMap.set(clusterId, []);
      clusterMap.get(clusterId)!.push(nodeId);
    }

    const result: MemoryCluster[] = [];
    for (const [clusterId, memberIds] of clusterMap) {
      // Count internal edges
      let internalEdges = 0;
      for (const id of memberIds) {
        const node = graph.get(id);
        if (!node) continue;
        for (const neighbourId of node.edges.keys()) {
          if (memberIds.includes(neighbourId)) internalEdges++;
        }
      }

      // Find hub (highest PageRank member)
      let hubId: string | null = null;
      let bestPR = -1;
      for (const id of memberIds) {
        const node = graph.get(id);
        const pr = node?.pageRank ?? 0;
        if (pr > bestPR) { bestPR = pr; hubId = id; }
      }

      result.push({
        id: clusterId,
        memberIds,
        internalEdges: Math.floor(internalEdges / 2), // undirected
        hubId: hubId && itemMap.has(hubId) ? hubId : null
      });
    }

    return result.sort((a, b) => b.memberIds.length - a.memberIds.length);
  }

  /**
   * @beta Return the most important memory nodes ranked by PageRank.
   * These are the "hubs" of the memory network.
   */
  async hubs(sessionId: string, options: { topK?: number } = {}): Promise<GraphHubResult[]> {
    const topK = options.topK ?? 5;
    const graph = await this.ensureGraph(sessionId);
    const allItems = await this.memory.getBySession(sessionId);
    const itemMap = new Map(allItems.map((i) => [i.id, i]));

    const nodes = Array.from(graph.entries())
      .map(([id, node]) => ({
        id,
        pageRank: node.pageRank,
        degree: node.edges.size,
        cluster: node.cluster,
        item: itemMap.get(id) ?? null
      }))
      .sort((a, b) => b.pageRank - a.pageRank)
      .slice(0, topK);

    return nodes;
  }

  /**
   * @beta Find bridge nodes — memories that connect different topic clusters.
   * These are often the most contextually versatile memories.
   */
  async bridges(sessionId: string): Promise<GraphBridgeResult[]> {
    const graph = await this.ensureGraph(sessionId);
    const assignment = this.assignClusters(graph);
    const allItems = await this.memory.getBySession(sessionId);
    const itemMap = new Map(allItems.map((i) => [i.id, i]));

    const bridgeMap = findBridgeNodes(graph, assignment);

    return Array.from(bridgeMap.entries())
      .map(([id, info]) => ({
        id,
        connectsClusters: Array.from(info.clusters),
        bridgeScore: info.bridgeScore,
        item: itemMap.get(id) ?? null
      }))
      .sort((a, b) => b.bridgeScore - a.bridgeScore);
  }

  /**
   * @beta Graph statistics for a session.
   */
  async graphStats(sessionId: string): Promise<GraphStats> {
    const graph = await this.ensureGraph(sessionId);
    const assignment = this.assignClusters(graph);

    const nodeCount = graph.size;
    let edgeCount = 0;
    let lastUpdated: number | null = null;

    for (const node of graph.values()) {
      edgeCount += node.edges.size;
      if (lastUpdated === null || node.addedAt > lastUpdated) {
        lastUpdated = node.addedAt;
      }
    }
    edgeCount = Math.floor(edgeCount / 2); // undirected

    const density = nodeCount > 1
      ? edgeCount / (nodeCount * (nodeCount - 1) / 2)
      : 0;

    const avgDegree = nodeCount > 0
      ? (Array.from(graph.values()).reduce((sum, n) => sum + n.edges.size, 0)) / nodeCount
      : 0;

    const clusterCount = new Set(assignment.values()).size;

    return { sessionId, nodeCount, edgeCount, density, avgDegree, clusterCount, lastUpdated };
  }

  /**
   * @beta Summarise a single memory cluster using a provided summarise function.
   * Useful for cluster-aware compression instead of chronological summarisation.
   */
  async summariseCluster(
    sessionId: string,
    clusterId: number,
    summariseFn: SummariseFn
  ): Promise<string> {
    const allClusters = await this.clusters(sessionId);
    const cluster = allClusters.find((c) => c.id === clusterId);
    if (!cluster || cluster.memberIds.length === 0) {
      return "";
    }

    const allItems = await this.memory.getBySession(sessionId);
    const entries = allItems
      .filter((item): item is MemoryItem & { kind: "entry" } =>
        item.kind === "entry" && cluster.memberIds.includes(item.id)
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    if (entries.length === 0) return "";

    return summariseFn({
      sessionId,
      entries,
      tokenCount: entries.reduce((sum, e) => sum + e.content.split(/\s+/).length, 0)
    });
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  /** @beta Export the graph for a session as a JSON-serializable object. */
  exportGraph(sessionId: string): SerializedGraph | null {
    const graph = this.graphs.get(sessionId);
    if (!graph) return null;

    const nodes: SerializedNode[] = [];
    for (const [id, node] of graph) {
      nodes.push({
        id,
        pageRank: node.pageRank,
        cluster: node.cluster,
        addedAt: node.addedAt,
        edges: Array.from(node.edges.entries()).map(([to, e]) => ({
          to,
          similarity: e.similarity,
          temporal: e.temporal,
          weight: e.weight,
          createdAt: e.createdAt
        }))
      });
    }

    return { sessionId, exportedAt: Date.now(), nodes };
  }

  /** @beta Restore a previously exported graph snapshot. */
  importGraph(sessionId: string, snapshot: SerializedGraph): void {
    const graph = new Map<string, GraphNode>();

    for (const sn of snapshot.nodes) {
      const edges = new Map<string, EdgeWeight>();
      for (const e of sn.edges) {
        edges.set(e.to, {
          similarity: e.similarity,
          temporal: e.temporal,
          weight: e.weight,
          createdAt: e.createdAt
        });
      }
      graph.set(sn.id, {
        id: sn.id,
        pageRank: sn.pageRank,
        cluster: sn.cluster,
        addedAt: sn.addedAt,
        edges
      });
    }

    this.graphs.set(sessionId, graph);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private getOrCreateGraph(sessionId: string): AdjacencyList {
    if (!this.graphs.has(sessionId)) {
      this.graphs.set(sessionId, new Map());
    }
    return this.graphs.get(sessionId)!;
  }

  private async ensureGraph(sessionId: string): Promise<AdjacencyList> {
    if (!this.graphs.has(sessionId) || this.graphs.get(sessionId)!.size === 0) {
      await this.buildGraph(sessionId);
    }
    return this.graphs.get(sessionId)!;
  }

  private async addNode(item: MemoryItem, graph: AdjacencyList): Promise<void> {
    if (graph.has(item.id)) return; // already present

    const node: GraphNode = {
      id: item.id,
      pageRank: 1 / (graph.size + 1),
      cluster: -1,
      edges: new Map(),
      addedAt: Date.now()
    };
    graph.set(item.id, node);

    // Cache embedding
    if (item.embedding) {
      this.embedCache.set(item.id, item.embedding);
    }

    // Compute edges to most similar existing nodes
    if (!item.embedding || item.embedding.length === 0) return;

    const candidates: { id: string; similarity: number }[] = [];

    for (const [existingId, existingNode] of graph) {
      if (existingId === item.id) continue;
      const existingEmbed = this.embedCache.get(existingId);
      if (!existingEmbed) continue;

      const sim = cosineSimilarityGraph(item.embedding, existingEmbed);
      if (sim >= this.opts.similarityThreshold) {
        candidates.push({ id: existingId, similarity: sim });
      }
    }

    // Sort by similarity, take top-N
    candidates.sort((a, b) => b.similarity - a.similarity);
    const topNeighbours = candidates.slice(0, this.opts.edgesPerNode);

    const now = Date.now();
    for (const { id: neighbourId, similarity } of topNeighbours) {
      const temporal = this.temporalScore(item, graph, neighbourId, now);
      const weight = this.edgeWeight(similarity, temporal);
      const edge: EdgeWeight = { similarity, temporal, weight, createdAt: now };

      // Undirected: set both directions
      node.edges.set(neighbourId, edge);
      graph.get(neighbourId)?.edges.set(item.id, edge);
    }
  }

  private temporalScore(
    item: MemoryItem,
    graph: AdjacencyList,
    neighbourId: string,
    now: number
  ): number {
    const neighbourNode = graph.get(neighbourId);
    if (!neighbourNode) return 0;

    // Find the item's timestamp via its addedAt proxy
    const timeDiff = Math.abs(item.timestamp - (neighbourNode.addedAt ?? now));
    const hoursApart = timeDiff / 3_600_000;
    return Math.exp(-0.1 * hoursApart); // fast decay — same-session bonus
  }

  private edgeWeight(similarity: number, temporal: number): number {
    // Blend: 70% semantic, 30% temporal proximity
    return 0.7 * similarity + 0.3 * temporal;
  }

  private recomputePageRank(graph: AdjacencyList): void {
    const ranks = computePageRank(graph, this.opts.pageRankDamping);
    for (const [id, pr] of ranks) {
      const node = graph.get(id);
      if (node) node.pageRank = pr;
    }
  }

  private assignClusters(graph: AdjacencyList): Map<string, number> {
    const assignment = detectClusters(graph, this.opts.similarityThreshold);
    for (const [nodeId, clusterId] of assignment) {
      const node = graph.get(nodeId);
      if (node) node.cluster = clusterId;
    }
    return assignment;
  }
}
