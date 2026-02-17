import { describe, expect, it, vi } from "vitest";
import { createMockSpinner, runCommand } from "./helpers.js";

vi.mock("yocto-spinner", () => ({ default: () => createMockSpinner() }));
vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({}) },
}));
vi.mock("../../src/lib/csv.js", () => ({
  readInputFile: vi.fn(),
  writeOutputFile: vi.fn(),
}));

const graphqlRequest = vi.fn();
vi.mock("../../src/lib/graphql-client.js", () => ({
  graphqlRequest: (...args: unknown[]) => graphqlRequest(...args),
}));

const { recordsCommand } = await import("../../src/commands/records.js");

const mockRecord = {
  id: "rec_1",
  tableKey: "users",
  data: { name: "Alice" },
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
  internalOrder: 0,
};

describe("records", () => {
  it("create resolves table ID and sends data", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({ createDataRecord: mockRecord });

    await runCommand(recordsCommand, [
      "create",
      "users",
      "--data",
      "name=Alice",
    ]);

    expect(graphqlRequest).toHaveBeenCalledTimes(2);
    const createCall = graphqlRequest.mock.calls[1][0];
    expect(createCall.variables.input).toEqual({
      tableId: "tbl_1",
      data: { name: "Alice" },
    });
  });

  it("update sends record ID and data", async () => {
    graphqlRequest.mockResolvedValueOnce({ updateDataRecord: mockRecord });

    await runCommand(recordsCommand, [
      "update",
      "users",
      "rec_1",
      "--data",
      "name=Bob",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input).toEqual({
      id: "rec_1",
      data: { name: "Bob" },
    });
  });

  it("delete sends record ID", async () => {
    graphqlRequest.mockResolvedValueOnce({ deleteDataRecord: "rec_1" });

    await runCommand(recordsCommand, ["delete", "users", "rec_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { id: "rec_1" } },
      })
    );
  });

  it("count queries dataTable recordCount", async () => {
    graphqlRequest.mockResolvedValueOnce({
      dataTable: { recordCount: 15 },
    });

    await runCommand(recordsCommand, ["count", "users"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { key: "users" },
      })
    );
  });

  it("find resolves table and queries with filters", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({
        dataRecords: {
          edges: [{ node: mockRecord }],
          totalCount: 1,
        },
      });

    await runCommand(recordsCommand, [
      "find",
      "users",
      "--where",
      "name equals Alice",
      "--take",
      "10",
    ]);

    expect(graphqlRequest).toHaveBeenCalledTimes(2);
  });

  it("handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Table not found"));

    const original = process.exitCode;
    await runCommand(recordsCommand, ["count", "unknown"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
