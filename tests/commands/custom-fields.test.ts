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

const { customFieldsCommand } = await import(
  "../../src/commands/custom-fields.js"
);

const mockField = {
  id: "cf_1",
  key: "company",
  label: "Company",
  hidden: false,
  visibility: "PUBLIC",
  restrictToAdmin: false,
  order: 1,
  tableHidden: false,
  tableOrder: 1,
};

describe("custom-fields", () => {
  it("list fetches all custom fields", async () => {
    graphqlRequest.mockResolvedValueOnce({ getCustomFields: [mockField] });

    await runCommand(customFieldsCommand, ["list"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("getCustomFields"),
      })
    );
  });

  it("create sends key and label", async () => {
    graphqlRequest.mockResolvedValueOnce({ createCustomField: mockField });

    await runCommand(customFieldsCommand, [
      "create",
      "--key",
      "company",
      "--label",
      "Company",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: expect.objectContaining({ key: "company", label: "Company" }),
        },
      })
    );
  });

  it("create with optional flags", async () => {
    graphqlRequest.mockResolvedValueOnce({ createCustomField: mockField });

    await runCommand(customFieldsCommand, [
      "create",
      "--key",
      "company",
      "--label",
      "Company",
      "--hidden",
      "--visibility",
      "PRIVATE",
      "--restrict-to-admin",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.hidden).toBe(true);
    expect(call.variables.input.visibility).toBe("PRIVATE");
    expect(call.variables.input.restrictToAdmin).toBe(true);
  });

  it("update sends customFieldId and label", async () => {
    graphqlRequest.mockResolvedValueOnce({ updateCustomField: mockField });

    await runCommand(customFieldsCommand, [
      "update",
      "cf_1",
      "--label",
      "Updated",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: expect.objectContaining({
            customFieldId: "cf_1",
            label: "Updated",
          }),
        },
      })
    );
  });

  it("delete sends customFieldId", async () => {
    graphqlRequest.mockResolvedValueOnce({ deleteCustomField: "cf_1" });

    await runCommand(customFieldsCommand, ["delete", "cf_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { customFieldId: "cf_1" } },
      })
    );
  });

  it("handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Forbidden"));

    const original = process.exitCode;
    await runCommand(customFieldsCommand, ["list"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
