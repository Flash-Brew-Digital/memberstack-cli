import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({}) },
}));

const { parseKeyValuePairs, parseJsonString, parseWhereClause, delay } =
  await import("../../src/lib/utils.js");

describe("utils", () => {
  describe("parseKeyValuePairs", () => {
    it("parses simple key=value pairs", () => {
      const result = parseKeyValuePairs(["name=Alice", "age=30"]);
      expect(result).toEqual({ name: "Alice", age: "30" });
    });

    it("handles values containing equals signs", () => {
      const result = parseKeyValuePairs(["query=a=b&c=d"]);
      expect(result).toEqual({ query: "a=b&c=d" });
    });

    it("throws on missing equals sign", () => {
      expect(() => parseKeyValuePairs(["invalid"])).toThrow(
        'Invalid key=value pair: "invalid"'
      );
    });
  });

  describe("parseJsonString", () => {
    it("parses valid JSON", () => {
      const result = parseJsonString('{"key": "value"}');
      expect(result).toEqual({ key: "value" });
    });

    it("throws on invalid JSON", () => {
      expect(() => parseJsonString("not json")).toThrow("Invalid JSON string");
    });
  });

  describe("parseWhereClause", () => {
    it("parses field operator value clauses", () => {
      const result = parseWhereClause(["name equals Alice"]);
      expect(result).toEqual({ name: { equals: "Alice" } });
    });

    it("coerces boolean and number values", () => {
      const result = parseWhereClause(["active equals true", "age gt 18"]);
      expect(result).toEqual({
        active: { equals: true },
        age: { gt: 18 },
      });
    });

    it("coerces null values", () => {
      const result = parseWhereClause(["field equals null"]);
      expect(result).toEqual({ field: { equals: null } });
    });

    it("handles multi-word values", () => {
      const result = parseWhereClause(["name contains John Doe"]);
      expect(result).toEqual({ name: { contains: "John Doe" } });
    });

    it("throws on too few parts", () => {
      expect(() => parseWhereClause(["invalid"])).toThrow(
        'Invalid where clause: "invalid"'
      );
    });

    it("throws on unknown operator", () => {
      expect(() => parseWhereClause(["name LIKE Alice"])).toThrow(
        'Unknown operator "LIKE"'
      );
    });
  });

  describe("delay", () => {
    it("resolves after specified ms", async () => {
      vi.useFakeTimers();
      const promise = delay(100);
      vi.advanceTimersByTime(100);
      await promise;
      vi.useRealTimers();
    });
  });
});
