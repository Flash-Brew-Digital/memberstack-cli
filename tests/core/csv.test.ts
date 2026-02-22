import { describe, expect, it, vi } from "vitest";

const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

const {
  readCsvFile,
  readInputFile,
  flattenObject,
  writeOutputFile,
  unflattenObject,
} = await import("../../src/lib/csv.js");

describe("csv", () => {
  describe("flattenObject", () => {
    it("flattens a simple object", () => {
      const result = flattenObject({ name: "Alice", age: 30 });
      expect(result).toEqual({ name: "Alice", age: "30" });
    });

    it("flattens nested objects with dot notation", () => {
      const result = flattenObject({
        user: { name: "Alice", address: { city: "NYC" } },
      });
      expect(result).toEqual({
        "user.name": "Alice",
        "user.address.city": "NYC",
      });
    });

    it("joins arrays with commas", () => {
      const result = flattenObject({ tags: ["a", "b", "c"] });
      expect(result).toEqual({ tags: "a, b, c" });
    });

    it("converts null and undefined to empty strings", () => {
      const result = flattenObject({ a: null, b: undefined });
      expect(result).toEqual({ a: "", b: "" });
    });

    it("converts booleans to strings", () => {
      const result = flattenObject({ active: true, deleted: false });
      expect(result).toEqual({ active: "true", deleted: "false" });
    });

    it("returns empty object for empty input", () => {
      const result = flattenObject({});
      expect(result).toEqual({});
    });
  });

  describe("unflattenObject", () => {
    it("returns flat keys as-is", () => {
      const result = unflattenObject({ name: "Alice", age: "30" });
      expect(result).toEqual({ name: "Alice", age: "30" });
    });

    it("unflattens dotted keys into nested objects", () => {
      const result = unflattenObject({
        "user.name": "Alice",
        "user.email": "alice@test.com",
      });
      expect(result).toEqual({
        user: { name: "Alice", email: "alice@test.com" },
      });
    });

    it("skips empty string values", () => {
      const result = unflattenObject({ name: "Alice", empty: "" });
      expect(result).toEqual({ name: "Alice" });
    });

    it("handles deeply dotted keys", () => {
      const result = unflattenObject({ "a.b.c": "deep" });
      expect(result).toEqual({ a: { "b.c": "deep" } });
    });

    it("returns empty object for empty input", () => {
      const result = unflattenObject({});
      expect(result).toEqual({});
    });
  });

  describe("readCsvFile", () => {
    it("parses a valid CSV file", async () => {
      mockReadFile.mockResolvedValueOnce("name,age\nAlice,30\nBob,25\n");

      const result = await readCsvFile("/data.csv");
      expect(result).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
      expect(mockReadFile).toHaveBeenCalledWith("/data.csv", "utf-8");
    });

    it("skips empty lines", async () => {
      mockReadFile.mockResolvedValueOnce("name,age\nAlice,30\n\n\nBob,25\n");

      const result = await readCsvFile("/data.csv");
      expect(result).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("throws on CSV parse errors", async () => {
      mockReadFile.mockResolvedValueOnce('"unclosed quote');

      await expect(readCsvFile("/bad.csv")).rejects.toThrow("CSV parse error:");
    });
  });

  describe("readInputFile", () => {
    it("reads a JSON file by extension", async () => {
      const data = [{ name: "Alice" }];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(data));

      const result = await readInputFile("/data.json");
      expect(result).toEqual(data);
    });

    it("reads a .JSON file case-insensitively", async () => {
      const data = [{ name: "Bob" }];
      mockReadFile.mockResolvedValueOnce(JSON.stringify(data));

      const result = await readInputFile("/DATA.JSON");
      expect(result).toEqual(data);
    });

    it("falls back to CSV for non-JSON extensions", async () => {
      mockReadFile.mockResolvedValueOnce("name,age\nAlice,30\n");

      const result = await readInputFile("/data.csv");
      expect(result).toEqual([{ name: "Alice", age: "30" }]);
    });
  });

  describe("writeOutputFile", () => {
    it("writes JSON format with pretty printing and trailing newline", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);

      const data = [{ name: "Alice", age: 30 }];
      await writeOutputFile("/out.json", data, "json");

      expect(mockWriteFile).toHaveBeenCalledWith(
        "/out.json",
        `${JSON.stringify(data, null, 2)}\n`
      );
    });

    it("writes CSV format with flattened data and trailing newline", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);

      const data = [{ name: "Alice", meta: { role: "admin" } }];
      await writeOutputFile("/out.csv", data, "csv");

      const written = mockWriteFile.mock.calls[0][1] as string;
      expect(written).toContain("name");
      expect(written).toContain("meta.role");
      expect(written).toContain("Alice");
      expect(written).toContain("admin");
      expect(written.endsWith("\n")).toBe(true);
    });

    it("defaults to JSON for non-csv format values", async () => {
      mockWriteFile.mockResolvedValueOnce(undefined);

      await writeOutputFile("/out.txt", [{ a: 1 }], "other");

      const written = mockWriteFile.mock.calls[0][1] as string;
      expect(JSON.parse(written)).toEqual([{ a: 1 }]);
    });
  });
});
