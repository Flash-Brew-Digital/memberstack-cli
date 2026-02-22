import { describe, expect, it, vi } from "vitest";
import { createMockSpinner, runCommand } from "./helpers.js";

vi.mock("yocto-spinner", () => ({ default: () => createMockSpinner() }));
vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({}) },
}));
const readInputFile = vi.fn();
const writeOutputFile = vi.fn();
vi.mock("../../src/lib/csv.js", () => ({
  readInputFile: (...args: unknown[]) => readInputFile(...args),
  writeOutputFile: (...args: unknown[]) => writeOutputFile(...args),
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

  it("query resolves table and sends parsed JSON body", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({
        dataRecords: {
          edges: [{ node: mockRecord }],
          totalCount: 1,
        },
      });

    await runCommand(recordsCommand, [
      "query",
      "users",
      "--query",
      '{"filter":{"fieldFilters":{"name":{"equals":"Alice"}}}}',
    ]);

    expect(graphqlRequest).toHaveBeenCalledTimes(2);
    const queryCall = graphqlRequest.mock.calls[1][0];
    expect(queryCall.variables.tableId).toBe("tbl_1");
    expect(queryCall.variables.filter).toEqual({
      fieldFilters: { name: { equals: "Alice" } },
    });
  });

  it("export fetches all records and writes output file", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({
        dataRecords: {
          edges: [{ node: mockRecord }],
          pageInfo: { endCursor: null },
        },
      });
    writeOutputFile.mockResolvedValueOnce(undefined);

    await runCommand(recordsCommand, ["export", "users", "--format", "csv"]);

    expect(writeOutputFile).toHaveBeenCalledWith(
      expect.stringContaining("records-users.csv"),
      expect.arrayContaining([expect.objectContaining({ id: "rec_1" })]),
      "csv"
    );
  });

  it("export with --output writes to custom path", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({
        dataRecords: {
          edges: [{ node: mockRecord }],
          pageInfo: { endCursor: null },
        },
      });
    writeOutputFile.mockResolvedValueOnce(undefined);

    await runCommand(recordsCommand, [
      "export",
      "users",
      "--output",
      "custom.json",
    ]);

    expect(writeOutputFile).toHaveBeenCalledWith(
      expect.stringContaining("custom.json"),
      expect.any(Array),
      "json"
    );
  });

  it("import creates records from file rows", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({ createDataRecord: mockRecord })
      .mockResolvedValueOnce({ createDataRecord: mockRecord });
    readInputFile.mockResolvedValueOnce([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);

    await runCommand(recordsCommand, [
      "import",
      "users",
      "--file",
      "records.csv",
    ]);

    expect(readInputFile).toHaveBeenCalledWith("records.csv");
    expect(graphqlRequest).toHaveBeenCalledTimes(3);
  });

  it("import skips rows with no data fields", async () => {
    graphqlRequest.mockResolvedValueOnce({ dataTable: { id: "tbl_1" } });
    readInputFile.mockResolvedValueOnce([
      { id: "rec_1", createdAt: "2024-01-01" },
    ]);

    await runCommand(recordsCommand, [
      "import",
      "users",
      "--file",
      "records.csv",
    ]);

    expect(graphqlRequest).toHaveBeenCalledTimes(1);
  });

  it("import continues on row failure", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockRejectedValueOnce(new Error("Validation error"))
      .mockResolvedValueOnce({ createDataRecord: mockRecord });
    readInputFile.mockResolvedValueOnce([{ name: "Bad" }, { name: "Good" }]);

    await runCommand(recordsCommand, [
      "import",
      "users",
      "--file",
      "records.csv",
    ]);

    expect(graphqlRequest).toHaveBeenCalledTimes(3);
  });

  it("import strips data. prefix from field keys", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({ createDataRecord: mockRecord });
    readInputFile.mockResolvedValueOnce([{ "data.name": "Alice" }]);

    await runCommand(recordsCommand, [
      "import",
      "users",
      "--file",
      "records.csv",
    ]);

    const createCall = graphqlRequest.mock.calls[1][0];
    expect(createCall.variables.input.data).toEqual({ name: "Alice" });
  });

  it("bulk-update processes rows and updates records", async () => {
    readInputFile.mockResolvedValueOnce([{ id: "rec_1", name: "Updated" }]);
    graphqlRequest.mockResolvedValueOnce({ updateDataRecord: mockRecord });

    await runCommand(recordsCommand, ["bulk-update", "--file", "updates.csv"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          input: { id: "rec_1", data: { name: "Updated" } },
        }),
      })
    );
  });

  it("bulk-update --dry-run previews without calling API", async () => {
    readInputFile.mockResolvedValueOnce([{ id: "rec_1", name: "Updated" }]);

    await runCommand(recordsCommand, [
      "bulk-update",
      "--file",
      "updates.csv",
      "--dry-run",
    ]);

    expect(graphqlRequest).not.toHaveBeenCalled();
  });

  it("bulk-update skips rows missing id", async () => {
    readInputFile.mockResolvedValueOnce([{ name: "No ID" }]);

    await runCommand(recordsCommand, ["bulk-update", "--file", "updates.csv"]);

    expect(graphqlRequest).not.toHaveBeenCalled();
  });

  it("bulk-delete deletes matching records", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({
        dataRecords: {
          edges: [{ node: mockRecord }],
          pageInfo: { endCursor: null },
        },
      })
      .mockResolvedValueOnce({ deleteDataRecord: "rec_1" });

    await runCommand(recordsCommand, [
      "bulk-delete",
      "users",
      "--where",
      "name equals Alice",
    ]);

    expect(graphqlRequest).toHaveBeenCalledTimes(3);
    const deleteCall = graphqlRequest.mock.calls[2][0];
    expect(deleteCall.variables.input).toEqual({ id: "rec_1" });
  });

  it("bulk-delete --dry-run previews without deleting", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({
        dataRecords: {
          edges: [{ node: mockRecord }],
          pageInfo: { endCursor: null },
        },
      });

    await runCommand(recordsCommand, [
      "bulk-delete",
      "users",
      "--where",
      "name equals Alice",
      "--dry-run",
    ]);

    expect(graphqlRequest).toHaveBeenCalledTimes(2);
  });

  it("bulk-delete with no matching records exits early", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ dataTable: { id: "tbl_1" } })
      .mockResolvedValueOnce({
        dataRecords: {
          edges: [],
          pageInfo: { endCursor: null },
        },
      });

    await runCommand(recordsCommand, ["bulk-delete", "users"]);

    expect(graphqlRequest).toHaveBeenCalledTimes(2);
  });
});
