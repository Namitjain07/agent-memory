import { describe, expect, it } from "vitest";
import { useMemory } from "../src";

describe("useMemory", () => {
  it("exports a function", () => {
    expect(typeof useMemory).toBe("function");
  });
});
