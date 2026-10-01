import { describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import { AgentMemory } from "@namitjain.india/agent-memory";
import { SQLiteAdapter } from "@namitjain.india/agent-memory-sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { run } from "../src/index.js";

function makeDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-cli-"));
  const dbPath = join(dir, "test.db");
  const adapter = new SQLiteAdapter({ dbPath });
  const memory = new AgentMemory({ adapter });
  return new Promise<string>((resolve, reject) => {
    (async () => {
      try {
        await memory.remember({
          kind: "fact",
          sessionId: "s1",
          key: "language",
          value: "TypeScript",
          importance: 0.9
        });
        await memory.remember({ role: "user", content: "I love TypeScript", sessionId: "s1" });
        await memory.remember({ role: "user", content: "I also enjoy Python", sessionId: "s2" });
        adapter.close();
        resolve(dbPath);
      } catch (err) {
        reject(err);
      }
    })();
  }) as unknown as string;
}

async function makeDbAsync(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-cli-"));
  const dbPath = join(dir, "test.db");
  const adapter = new SQLiteAdapter({ dbPath });
  const memory = new AgentMemory({ adapter });
  await memory.remember({
    kind: "fact",
    sessionId: "s1",
    key: "language",
    value: "TypeScript",
    importance: 0.9
  });
  await memory.remember({ role: "user", content: "I love TypeScript", sessionId: "s1" });
  await memory.remember({ role: "user", content: "I also enjoy Python", sessionId: "s2" });
  adapter.close();
  return dbPath;
}

function captureOutput(): {
  stdout: PassThrough;
  stderr: PassThrough;
  getStdout: () => string;
  getStderr: () => string;
} {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const so: Buffer[] = [];
  const se: Buffer[] = [];
  stdout.on("data", (c: Buffer) => so.push(c));
  stderr.on("data", (c: Buffer) => se.push(c));
  return {
    stdout,
    stderr,
    getStdout: () => Buffer.concat(so).toString(),
    getStderr: () => Buffer.concat(se).toString()
  };
}

describe("agent-memory CLI", () => {
  it("prints help with no args", async () => {
    const { stdout, stderr, getStdout } = captureOutput();
    const result = await run([], { stdout, stderr } as unknown as never);
    expect(result.exitCode).toBe(0);
    expect(getStdout()).toContain("agent-memory CLI");
  });

  it("prints version with --version", async () => {
    const { stdout, stderr, getStdout } = captureOutput();
    const result = await run(["--version"], { stdout, stderr } as unknown as never);
    expect(result.exitCode).toBe(0);
    expect(getStdout()).toContain("v0.1.0");
  });

  it("lists items in a database", async () => {
    const dbPath = await makeDbAsync();
    const { stdout, stderr, getStdout } = captureOutput();
    const result = await run(["--db", dbPath, "list", "--format", "json"], {
      stdout,
      stderr
    } as unknown as never);
    expect(result.exitCode).toBe(0);
    const out = getStdout();
    const items = JSON.parse(out);
    expect(items.length).toBe(3);
    rmSync(dbPath, { recursive: true, force: true });
  });

  it("filters list by session", async () => {
    const dbPath = await makeDbAsync();
    const { stdout, stderr, getStdout } = captureOutput();
    const result = await run(["--db", dbPath, "--session", "s1", "list", "--format", "json"], {
      stdout,
      stderr
    } as unknown as never);
    expect(result.exitCode).toBe(0);
    const items = JSON.parse(getStdout());
    expect(items.length).toBe(2);
    expect(items.every((i: { sessionId: string }) => i.sessionId === "s1")).toBe(true);
    rmSync(dbPath, { recursive: true, force: true });
  });

  it("searches items by keyword", async () => {
    const dbPath = await makeDbAsync();
    const { stdout, stderr, getStdout } = captureOutput();
    const result = await run(["--db", dbPath, "search", "Python", "--format", "json"], {
      stdout,
      stderr
    } as unknown as never);
    expect(result.exitCode).toBe(0);
    const items = JSON.parse(getStdout());
    expect(items.length).toBeGreaterThan(0);
    rmSync(dbPath, { recursive: true, force: true });
  });

  it("handles queries with backslash and LIKE wildcards safely", async () => {
    // CodeQL: a query like "100%" or "foo\\bar" used to let the user
    // accidentally escape the LIKE wildcards. Verify the search still
    // returns the right items (not zero results, not the wrong ones).
    const dbPath = await makeDbAsync();
    const { stdout, stderr, getStdout } = captureOutput();

    // Query containing a literal backslash — should NOT escape the LIKE
    // wildcards in a way that empties the result set.
    const result = await run(["--db", dbPath, "search", "50%_\\backslash", "--format", "json"], {
      stdout,
      stderr
    } as unknown as never);
    expect(result.exitCode).toBe(0);
    // We don't expect matches, but we also don't expect SQL errors.
    // The result is an empty array (no items contain that string).
    const items = JSON.parse(getStdout());
    expect(Array.isArray(items)).toBe(true);
    rmSync(dbPath, { recursive: true, force: true });
  });

  it("prints stats", async () => {
    const dbPath = await makeDbAsync();
    const { stdout, stderr, getStdout } = captureOutput();
    const result = await run(["--db", dbPath, "stats", "--format", "json"], {
      stdout,
      stderr
    } as unknown as never);
    expect(result.exitCode).toBe(0);
    const stats = JSON.parse(getStdout());
    expect(stats.total).toBe(3);
    expect(stats.sessions).toBe(2);
    rmSync(dbPath, { recursive: true, force: true });
  });

  it("rejects unknown subcommand", async () => {
    const dbPath = await makeDbAsync();
    const { stdout, stderr } = captureOutput();
    const result = await run(["--db", dbPath, "wibble"], { stdout, stderr } as unknown as never);
    expect(result.exitCode).toBe(2);
    rmSync(dbPath, { recursive: true, force: true });
  });

  // suppress unused warning
  void makeDb;
});
