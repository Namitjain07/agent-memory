/**
 * @beta
 * Types for the Memory Graph Network — a beta feature that adds
 * spreading activation, PageRank scoring, and community detection
 * on top of the standard memory store.
 */

// ─── Graph edge ───────────────────────────────────────────────────────────────

export interface EdgeWeight {
  /** Cosine similarity between the two memory embeddings (0–1). */
  similarity: number;
  /** Temporal proximity score, decayed since edge was formed (0–1). */
  temporal: number;
  /** Combined, time-decayed edge weight used in graph traversal. */
  weight: number;
  /** Unix timestamp (ms) when the edge was created. */
  createdAt: number;
}

// ─── Graph node ───────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  /** PageRank score, recomputed after each buildGraph / addNode call. */
  pageRank: number;
  /**
   * Community / cluster index assigned by detectClusters().
   * -1 means the node has not been assigned to a cluster yet.
   */
  cluster: number;
  /** Adjacency list: neighbour_id → edge weight info. */
  edges: Map<string, EdgeWeight>;
  /** Unix timestamp (ms) when this node was added to the graph. */
  addedAt: number;
}

/** Adjacency list for a single session. */
export type AdjacencyList = Map<string, GraphNode>;

// ─── Options ─────────────────────────────────────────────────────────────────

export interface MemoryGraphOptions {
  /**
   * Maximum number of edges created when a new node is added.
   * @default 6
   */
  edgesPerNode?: number;
  /**
   * Minimum cosine similarity to create an edge between two nodes.
   * @default 0.60
   */
  similarityThreshold?: number;
  /**
   * Per-hop energy decay factor for spreading activation (0–1).
   * Lower = activation fades faster.
   * @default 0.50
   */
  activationDecay?: number;
  /**
   * Maximum number of hops for spreading activation.
   * @default 3
   */
  maxHops?: number;
  /**
   * PageRank damping factor (classic = 0.85).
   * @default 0.85
   */
  pageRankDamping?: number;
  /**
   * Edge weight decay per hour (0–1 fraction lost per hour since edge creation).
   * Set to 0 to disable temporal decay on edges.
   * @default 0.005
   */
  edgeTemporalDecay?: number;
  /**
   * Blending weights for the final graph recall score.
   * Must sum to 1.
   * @default { similarity: 0.40, activation: 0.25, pageRank: 0.20, recency: 0.15 }
   */
  scoreWeights?: {
    similarity: number;
    activation: number;
    pageRank: number;
    recency: number;
  };
}

// ─── Recall results ───────────────────────────────────────────────────────────

export interface GraphRecallOptions {
  sessionId?: string;
  topK?: number;
  /** Enable spreading activation traversal (default: true). */
  useSpreadingActivation?: boolean;
  /**
   * If true, returns at most one result per cluster
   * (cluster-aware deduplication).
   * @default false
   */
  clusterDeduplicate?: boolean;
  /** Override max hops for this query. */
  maxHops?: number;
}

export interface GraphRecallResult {
  item: import("../types/memory").MemoryItem;
  /** Blended graph score (0–1). */
  score: number;
  /** Raw vector similarity component. */
  similarity: number;
  /** Spreading activation energy received. */
  activationScore: number;
  /** PageRank contribution. */
  pageRankScore: number;
  /** Recency component. */
  recencyScore: number;
  /** Cluster the memory belongs to (-1 = unassigned). */
  cluster: number;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface MemoryCluster {
  id: number;
  /** IDs of all memory items in this cluster. */
  memberIds: string[];
  /** Number of internal edges. */
  internalEdges: number;
  /**
   * Hub node ID (highest PageRank member).
   * null if cluster has no members.
   */
  hubId: string | null;
}

export interface GraphHubResult {
  id: string;
  pageRank: number;
  degree: number;
  cluster: number;
  item: import("../types/memory").MemoryItem | null;
}

export interface GraphBridgeResult {
  id: string;
  /** Cluster IDs this node connects. */
  connectsClusters: number[];
  /** Total cross-cluster edge weight. */
  bridgeScore: number;
  item: import("../types/memory").MemoryItem | null;
}

export interface GraphStats {
  sessionId: string;
  nodeCount: number;
  edgeCount: number;
  /** Edge count / (nodeCount * (nodeCount - 1)). */
  density: number;
  avgDegree: number;
  clusterCount: number;
  /** Timestamp of the most recent node addition. */
  lastUpdated: number | null;
}

// ─── Serialised snapshot ──────────────────────────────────────────────────────

export interface SerializedEdge {
  to: string;
  similarity: number;
  temporal: number;
  weight: number;
  createdAt: number;
}

export interface SerializedNode {
  id: string;
  pageRank: number;
  cluster: number;
  addedAt: number;
  edges: SerializedEdge[];
}

export interface SerializedGraph {
  sessionId: string;
  exportedAt: number;
  nodes: SerializedNode[];
}
