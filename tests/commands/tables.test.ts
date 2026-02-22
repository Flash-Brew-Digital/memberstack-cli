import { describe, expect, it, vi } from "vitest";
import { createMockSpinner, runCommand } from "./helpers.js";

vi.mock("yocto-spinner", () => ({ default: () => createMockSpinner() }));
vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({}) },
}));

const graphqlRequest = vi.fn();
vi.mock("../../src/lib/graphql-client.js", () => ({
  graphqlRequest: (...args: unknown[]) => graphqlRequest(...args),
}));

const { tablesCommand } = await import("../../src/commands/tables.js");

const mockTable = {
  id: "tbl_1",
  key: "users",
  name: "Users",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
  createRule: "AUTHENTICATED",
  readRule: "PUBLIC",
  updateRule: "AUTHENTICATED_OWN",
  deleteRule: "ADMIN_ONLY",
  fields: [
    {
      id: "fld_1",
      key: "name",
      name: "Name",
      type: "TEXT",
      required: true,
      defaultValue: null,
      tableOrder: 0,
      referencedTableId: null,
    },
  ],
};

describe("tables", () => {
  it("list fetches all tables", async () => {
    graphqlRequest.mockResolvedValueOnce({ dataTables: [mockTable] });

    await runCommand(tablesCommand, ["list"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("dataTables"),
      })
    );
  });

  it("get fetches a table by key", async () => {
    graphqlRequest.mockResolvedValueOnce({ dataTable: mockTable });

    await runCommand(tablesCommand, ["get", "users"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { key: "users" },
      })
    );
  });

  it("describe fetches and displays table schema", async () => {
    graphqlRequest.mockResolvedValueOnce({ dataTable: mockTable });

    await runCommand(tablesCommand, ["describe", "users"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { key: "users" },
      })
    );
  });

  it("create sends mutation with name and key", async () => {
    graphqlRequest.mockResolvedValueOnce({ createDataTable: mockTable });

    await runCommand(tablesCommand, [
      "create",
      "--name",
      "Users",
      "--key",
      "users",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("createDataTable"),
        variables: { input: { name: "Users", key: "users" } },
      })
    );
  });

  it("create passes access rules when provided", async () => {
    graphqlRequest.mockResolvedValueOnce({ createDataTable: mockTable });

    await runCommand(tablesCommand, [
      "create",
      "--name",
      "Users",
      "--key",
      "users",
      "--create-rule",
      "AUTHENTICATED",
      "--read-rule",
      "PUBLIC",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: {
            name: "Users",
            key: "users",
            createRule: "AUTHENTICATED",
            readRule: "PUBLIC",
          },
        },
      })
    );
  });

  it("update sends mutation with id and options", async () => {
    graphqlRequest.mockResolvedValueOnce({ updateDataTable: mockTable });

    await runCommand(tablesCommand, [
      "update",
      "tbl_1",
      "--name",
      "Updated Users",
      "--delete-rule",
      "ADMIN_ONLY",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("updateDataTable"),
        variables: {
          input: {
            id: "tbl_1",
            name: "Updated Users",
            deleteRule: "ADMIN_ONLY",
          },
        },
      })
    );
  });

  it("update with no options sets exit code 1", async () => {
    const original = process.exitCode;
    await runCommand(tablesCommand, ["update", "tbl_1"]);
    expect(process.exitCode).toBe(1);
    expect(graphqlRequest).not.toHaveBeenCalled();
    process.exitCode = original;
  });

  it("delete sends mutation with id", async () => {
    graphqlRequest.mockResolvedValueOnce({ deleteDataTable: "tbl_1" });

    await runCommand(tablesCommand, ["delete", "tbl_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("deleteDataTable"),
        variables: { input: { id: "tbl_1" } },
      })
    );
  });

  it("describe with no fields", async () => {
    const emptyTable = { ...mockTable, fields: [] };
    graphqlRequest.mockResolvedValueOnce({ dataTable: emptyTable });

    await runCommand(tablesCommand, ["describe", "empty"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { key: "empty" },
      })
    );
  });

  it("describe with referenced table", async () => {
    const tableWithRef = {
      ...mockTable,
      fields: [
        {
          id: "fld_2",
          key: "author",
          name: "Author",
          type: "RELATION",
          required: false,
          defaultValue: null,
          tableOrder: 1,
          referencedTableId: "tbl_2",
          referencedTable: { id: "tbl_2", key: "authors", name: "Authors" },
        },
      ],
    };
    graphqlRequest.mockResolvedValueOnce({ dataTable: tableWithRef });

    await runCommand(tablesCommand, ["describe", "users"]);

    expect(graphqlRequest).toHaveBeenCalled();
  });

  it("get handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Not found"));

    const original = process.exitCode;
    await runCommand(tablesCommand, ["get", "bad_key"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("describe handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Not found"));

    const original = process.exitCode;
    await runCommand(tablesCommand, ["describe", "bad_key"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("create handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Duplicate key"));

    const original = process.exitCode;
    await runCommand(tablesCommand, [
      "create",
      "--name",
      "Bad",
      "--key",
      "bad",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("update handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Not found"));

    const original = process.exitCode;
    await runCommand(tablesCommand, ["update", "tbl_bad", "--name", "Test"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("delete handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Cannot delete"));

    const original = process.exitCode;
    await runCommand(tablesCommand, ["delete", "tbl_bad"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("list handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Network error"));

    const original = process.exitCode;
    await runCommand(tablesCommand, ["list"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
