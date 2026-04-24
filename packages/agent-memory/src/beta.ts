/**
 * @beta agent-memory/beta — Graph-based memory optimization.
 *
 * Import from this subpath to access beta features that may change between
 * minor versions:
 *
 * ```ts
 * import { MemoryGraph } from "@namitjain.india/agent-memory/beta";
 * ```
 *
 * All stable APIs remain available from the main entry point:
 * ```ts
 * import { AgentMemory, createProvider } from "@namitjain.india/agent-memory";
 * ```
 */

export { MemoryGraph } from "./graph/memory-graph";

export type {
  MemoryGraphOptions,
  GraphRecallOptions,
  GraphRecallResult,
  MemoryCluster,
  GraphHubResult,
  GraphBridgeResult,
  GraphStats,
  GraphNode,
  EdgeWeight,
  SerializedGraph,
  SerializedNode
} from "./graph/types";

// Re-export core algorithms for advanced users
export {
  computePageRank,
  personalizedPageRank,
  spreadActivation,
  detectClusters,
  findBridgeNodes
} from "./graph/algorithms";
