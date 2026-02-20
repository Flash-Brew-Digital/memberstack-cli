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
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const graphqlRequest = vi.fn();
vi.mock("../../src/lib/graphql-client.js", () => ({
  graphqlRequest: (...args: unknown[]) => graphqlRequest(...args),
}));

const { membersCommand } = await import("../../src/commands/members.js");

const mockMember = {
  id: "mem_1",
  createdAt: "2024-01-01",
  lastLogin: "2024-01-02",
  auth: { email: "test@example.com" },
  customFields: {},
  metaData: {},
  json: {},
  loginRedirect: null,
  permissions: { all: [] },
  planConnections: [],
};

describe("members", () => {
  it("list fetches members with pagination", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [{ cursor: "c1", node: mockMember }],
      },
    });

    await runCommand(membersCommand, ["list", "--limit", "10"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("getMembers"),
      })
    );
  });

  it("get fetches by member ID", async () => {
    graphqlRequest.mockResolvedValueOnce({ currentMember: mockMember });

    await runCommand(membersCommand, ["get", "mem_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { id: "mem_1" },
      })
    );
  });

  it("get fetches by email via search", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getMembers: { edges: [{ node: mockMember }] },
    });

    await runCommand(membersCommand, ["get", "test@example.com"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { search: "test@example.com" },
      })
    );
  });

  it("create sends email and password", async () => {
    graphqlRequest.mockResolvedValueOnce({
      signupMemberEmailPassword: { member: mockMember },
    });

    await runCommand(membersCommand, [
      "create",
      "--email",
      "new@test.com",
      "--password",
      "secret123",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.email).toBe("new@test.com");
    expect(call.variables.input.password).toBe("secret123");
  });

  it("delete sends memberId", async () => {
    graphqlRequest.mockResolvedValueOnce({ deleteMember: "mem_1" });

    await runCommand(membersCommand, ["delete", "mem_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { memberId: "mem_1" } },
      })
    );
  });

  it("add-plan sends planId and memberId", async () => {
    graphqlRequest.mockResolvedValueOnce({
      addFreePlan: { id: "pln_1", name: "Free" },
    });

    await runCommand(membersCommand, [
      "add-plan",
      "mem_1",
      "--plan-id",
      "pln_1",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: { planId: "pln_1", memberId: "mem_1" },
        },
      })
    );
  });

  it("remove-plan sends planId and memberId", async () => {
    graphqlRequest.mockResolvedValueOnce({
      removeFreePlan: { id: "pln_1", name: "Free" },
    });

    await runCommand(membersCommand, [
      "remove-plan",
      "mem_1",
      "--plan-id",
      "pln_1",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: { planId: "pln_1", memberId: "mem_1" },
        },
      })
    );
  });

  it("count queries getMembersCount", async () => {
    graphqlRequest.mockResolvedValueOnce({ getMembersCount: 42 });

    await runCommand(membersCommand, ["count"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("getMembersCount"),
      })
    );
  });

  it("update sends custom fields and meta data", async () => {
    graphqlRequest.mockResolvedValueOnce({ updateMember: mockMember });

    await runCommand(membersCommand, [
      "update",
      "mem_1",
      "--meta-data",
      "source=cli",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.memberId).toBe("mem_1");
    expect(call.variables.input.metaData).toEqual({ source: "cli" });
  });

  it("update sends --json-data as parsed JSON", async () => {
    graphqlRequest.mockResolvedValueOnce({ updateMember: mockMember });

    await runCommand(membersCommand, [
      "update",
      "mem_1",
      "--json-data",
      '{"key":"value"}',
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.memberId).toBe("mem_1");
    expect(call.variables.input.json).toEqual({ key: "value" });
  });

  it("update accepts --json-data alongside global --json without conflict", async () => {
    graphqlRequest.mockResolvedValueOnce({ updateMember: mockMember });

    await runCommand(membersCommand, [
      "update",
      "mem_1",
      "--json-data",
      '{"key":"value"}',
      "--json",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.json).toEqual({ key: "value" });
  });

  it("handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Unauthorized"));

    const original = process.exitCode;
    await runCommand(membersCommand, ["count"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
