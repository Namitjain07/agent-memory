import { describe, expect, it, beforeEach } from "vitest";
import { AgentMemory } from "../src/core/agent-memory";
import { InMemoryAdapter } from "../src/adapters/in-memory";
import { MemoryGraph } from "../src/graph/memory-graph";
import {
  computePageRank,
  personalizedPageRank,
  spreadActivation,
  detectClusters,
  findBridgeNodes,
  cosineSimilarityGraph,
  normalizeMap
} from "../src/graph/algorithms";
import type { AdjacencyList, GraphNode } from "../src/graph/types";

// ─── Algorithm unit tests ─────────────────────────────────────────────────────

function makeGraph(
  nodes: { id: string; neighbours: { id: string; weight: number }[] }[]
): AdjacencyList {
  const graph = new Map<string, GraphNode>();
  for (const n of nodes) {
    graph.set(n.id, {
      id: n.id,
      pageRank: 1 / nodes.length,
      cluster: -1,
      addedAt: Date.now(),
      edges: new Map(
        n.neighbours.map(({ id, weight }) => [
          id,
          { similarity: weight, temporal: 1, weight, createdAt: Date.now() }
        ])
      )
    });
  }
  return graph;
}

describe("cosineSimilarityGraph", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarityGraph([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });
  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarityGraph([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarityGraph([], [])).toBe(0);
  });
  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarityGraph([1, 2], [1])).toBe(0);
  });
});

describe("normalizeMap", () => {
  it("scales max to 1", () => {
    const m = new Map([["a", 0], ["b", 2], ["c", 4]]);
    const n = normalizeMap(m);
    expect(n.get("c")).toBeCloseTo(1);
    expect(n.get("b")).toBeCloseTo(0.5);
    expect(n.get("a")).toBeCloseTo(0);
  });
});

describe("computePageRank", () => {
  it("returns empty map for empty graph", () => {
    expect(computePageRank(new Map()).size).toBe(0);
  });

  it("all nodes sum to 1 approximately", () => {
    const g = makeGraph([
      { id: "a", neighbours: [{ id: "b", weight: 1 }, { id: "c", weight: 0.5 }] },
      { id: "b", neighbours: [{ id: "a", weight: 1 }] },
      { id: "c", neighbours: [{ id: "a", weight: 0.8 }] }
    ]);
    const pr = computePageRank(g);
    const total = Array.from(pr.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 1);
  });

  it("hub node gets higher PageRank than leaf nodes", () => {
    // Star graph: center A connected to B, C, D
    const g = makeGraph([
      { id: "A", neighbours: [{ id: "B", weight: 1 }, { id: "C", weight: 1 }, { id: "D", weight: 1 }] },
      { id: "B", neighbours: [{ id: "A", weight: 1 }] },
      { id: "C", neighbours: [{ id: "A", weight: 1 }] },
      { id: "D", neighbours: [{ id: "A", weight: 1 }] }
    ]);
    const pr = computePageRank(g);
    expect(pr.get("A")!).toBeGreaterThan(pr.get("B")!);
    expect(pr.get("A")!).toBeGreaterThan(pr.get("C")!);
  });
});

describe("personalizedPageRank", () => {
  it("seed nodes get higher scores than non-seeds in disconnected graph", () => {
    const g = makeGraph([
      { id: "seed1", neighbours: [{ id: "neighbour", weight: 0.9 }] },
      { id: "neighbour", neighbours: [{ id: "seed1", weight: 0.9 }] },
      { id: "isolated", neighbours: [] }
    ]);
    const seeds = new Map([["seed1", 1.0]]);
    const ppr = personalizedPageRank(g, seeds);
    expect(ppr.get("seed1")!).toBeGreaterThan(ppr.get("isolated")!);
    expect(ppr.get("neighbour")!).toBeGreaterThan(ppr.get("isolated")!);
  });
});

describe("spreadActivation", () => {
  it("seeds retain initial activation", () => {
    const g = makeGraph([
      { id: "A", neighbours: [{ id: "B", weight: 1 }] },
      { id: "B", neighbours: [{ id: "A", weight: 1 }] }
    ]);
    const seeds = new Map([["A", 1.0]]);
    const result = spreadActivation(g, seeds, 2, 0.5);
    // B should have received activation from A
    expect(result.get("B")!).toBeGreaterThan(0);
  });

  it("deeper nodes get less activation", () => {
    const g = makeGraph([
      { id: "A", neighbours: [{ id: "B", weight: 1 }] },
      { id: "B", neighbours: [{ id: "A", weight: 1 }, { id: "C", weight: 1 }] },
      { id: "C", neighbours: [{ id: "B", weight: 1 }] }
    ]);
    const seeds = new Map([["A", 1.0]]);
    const result = spreadActivation(g, seeds, 3, 0.5);
    // B is 1 hop away, C is 2 hops away
    expect((result.get("B") ?? 0)).toBeGreaterThanOrEqual(result.get("C") ?? 0);
  });

  it("returns no spread activation for unknown/isolated seed node", () => {
    const result = spreadActivation(new Map(), new Map([["x", 1]]), 2, 0.5);
    // Seed "x" has no neighbours in empty graph — no activation propagates to anyone
    // The result may contain "x" at 0 (seed subtracted), but no other nodes
    for (const [id, val] of result) {
      if (id !== "x") expect(val).toBe(0);
    }
  });
});

describe("detectClusters", () => {
  it("disconnected components get different cluster IDs", () => {
    // Two isolated groups
    const g = makeGraph([
      { id: "A", neighbours: [{ id: "B", weight: 0.9 }] },
      { id: "B", neighbours: [{ id: "A", weight: 0.9 }] },
      { id: "C", neighbours: [{ id: "D", weight: 0.9 }] },
      { id: "D", neighbours: [{ id: "C", weight: 0.9 }] }
    ]);
    const assignment = detectClusters(g, 0.7); // threshold below all edges
    expect(assignment.get("A")).toBe(assignment.get("B"));
    expect(assignment.get("C")).toBe(assignment.get("D"));
    expect(assignment.get("A")).not.toBe(assignment.get("C"));
  });

  it("single node is its own cluster", () => {
    const g = makeGraph([{ id: "lone", neighbours: [] }]);
    const assignment = detectClusters(g, 0.7);
    expect(assignment.has("lone")).toBe(true);
  });

  it("fully connected graph is one cluster", () => {
    const g = makeGraph([
      { id: "X", neighbours: [{ id: "Y", weight: 0.95 }, { id: "Z", weight: 0.95 }] },
      { id: "Y", neighbours: [{ id: "X", weight: 0.95 }, { id: "Z", weight: 0.95 }] },
      { id: "Z", neighbours: [{ id: "X", weight: 0.95 }, { id: "Y", weight: 0.95 }] }
    ]);
    const assignment = detectClusters(g, 0.7);
    const ids = new Set(assignment.values());
    expect(ids.size).toBe(1);
  });
});

describe("findBridgeNodes", () => {
  it("identifies node that connects two clusters", () => {
    const g = makeGraph([
      { id: "A", neighbours: [{ id: "bridge", weight: 0.9 }] },
      { id: "bridge", neighbours: [{ id: "A", weight: 0.9 }, { id: "B", weight: 0.9 }] },
      { id: "B", neighbours: [{ id: "bridge", weight: 0.9 }] }
    ]);
    // Manually assign clusters: A=0, bridge=0, B=1 (simulating two clusters)
    const assignment = new Map([["A", 0], ["bridge", 0], ["B", 1]]);
    const bridges = findBridgeNodes(g, assignment);
    expect(bridges.has("bridge")).toBe(true);
    expect(bridges.get("bridge")!.clusters.has(1)).toBe(true);
  });
});

// ─── MemoryGraph integration tests ───────────────────────────────────────────

function makeMemory() {
  return new AgentMemory({
    adapter: new InMemoryAdapter(),
    defaultSessionId: "test",
    embedding: {
      // Synthetic embeddings — deterministic
      embedFn: async (text: string) => {
        // Simple hash-based pseudo-embedding (2D for testing)
        const h = Array.from(text).reduce((a, c) => a + c.charCodeAt(0), 0);
        return [Math.sin(h), Math.cos(h)];
      },
      embedBatchFn: async (texts: string[]) =>
        texts.map((text) => {
          const h = Array.from(text).reduce((a, c) => a + c.charCodeAt(0), 0);
          return [Math.sin(h), Math.cos(h)];
        })
    }
  });
}

describe("MemoryGraph", () => {
  let memory: AgentMemory;
  let graph: MemoryGraph;

  beforeEach(() => {
    memory = makeMemory();
    graph = new MemoryGraph(memory, {
      similarityThreshold: 0.0, // low threshold so test nodes always get edges
      edgesPerNode: 3,
      maxHops: 2,
      activationDecay: 0.5
    });
  });

  it("remember() stores items normally and adds them to the graph", async () => {
    await graph.remember({ role: "user", content: "Hello world", sessionId: "s1" });
    await graph.remember({ role: "assistant", content: "Hi there", sessionId: "s1" });

    const stats = await graph.graphStats("s1");
    expect(stats.nodeCount).toBe(2);
  });

  it("graphStats() returns correct node/edge counts", async () => {
    await graph.remember({ role: "user", content: "TypeScript is great", sessionId: "s2" });
    await graph.remember({ role: "user", content: "I love TypeScript", sessionId: "s2" });
    await graph.remember({ role: "user", content: "Python is also great", sessionId: "s2" });

    const stats = await graph.graphStats("s2");
    expect(stats.nodeCount).toBe(3);
    expect(stats.sessionId).toBe("s2");
    expect(stats.density).toBeGreaterThanOrEqual(0);
  });

  it("buildGraph() populates graph from existing memories", async () => {
    await memory.remember({ role: "user", content: "First message", sessionId: "s3" });
    await memory.remember({ role: "user", content: "Second message", sessionId: "s3" });

    // Build graph from pre-existing memories
    await graph.buildGraph("s3");
    const stats = await graph.graphStats("s3");
    expect(stats.nodeCount).toBe(2);
  });

  it("hubs() returns nodes sorted by PageRank descending", async () => {
    await graph.remember({ role: "user", content: "Alpha memory", sessionId: "s4" });
    await graph.remember({ role: "user", content: "Beta memory", sessionId: "s4" });
    await graph.remember({ role: "user", content: "Gamma memory", sessionId: "s4" });

    const hubs = await graph.hubs("s4", { topK: 3 });
    expect(hubs.length).toBeGreaterThan(0);
    // PageRanks should be in descending order
    for (let i = 1; i < hubs.length; i++) {
      expect(hubs[i - 1]!.pageRank).toBeGreaterThanOrEqual(hubs[i]!.pageRank);
    }
  });

  it("clusters() returns non-empty cluster list", async () => {
    await graph.remember({ role: "user", content: "Memory about dogs", sessionId: "s5" });
    await graph.remember({ role: "user", content: "Memory about cats", sessionId: "s5" });

    const clusters = await graph.clusters("s5");
    expect(clusters.length).toBeGreaterThan(0);
    // All nodes should be assigned
    const totalMembers = clusters.reduce((sum, c) => sum + c.memberIds.length, 0);
    expect(totalMembers).toBe(2);
  });

  it("exportGraph() and importGraph() round-trip correctly", async () => {
    await graph.remember({ role: "user", content: "Export test A", sessionId: "s6" });
    await graph.remember({ role: "user", content: "Export test B", sessionId: "s6" });

    const snapshot = graph.exportGraph("s6");
    expect(snapshot).not.toBeNull();
    expect(snapshot!.nodes.length).toBe(2);
    expect(snapshot!.sessionId).toBe("s6");

    // Import into a new MemoryGraph instance
    const graph2 = new MemoryGraph(memory);
    graph2.importGraph("s6", snapshot!);
    const snapshot2 = graph2.exportGraph("s6");
    expect(snapshot2!.nodes.length).toBe(2);
  });

  it("exportGraph() returns null for unknown session", () => {
    expect(graph.exportGraph("nonexistent")).toBeNull();
  });

  it("graphRecall() returns results scored with graph components", async () => {
    await graph.remember({ role: "user", content: "I love TypeScript", sessionId: "s7" });
    await graph.remember({ role: "user", content: "TypeScript is my favourite language", sessionId: "s7" });
    await graph.remember({ role: "user", content: "I use TypeScript every day at work", sessionId: "s7" });

    const results = await graph.graphRecall("TypeScript language", {
      sessionId: "s7",
      topK: 3,
      useSpreadingActivation: true
    });

    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.pageRankScore).toBeGreaterThanOrEqual(0);
      expect(r.item).toBeDefined();
    }
  });
});
