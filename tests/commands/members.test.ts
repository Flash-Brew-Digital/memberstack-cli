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
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
vi.mock("node:fs/promises", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
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

  it("note sends memberId and text", async () => {
    graphqlRequest.mockResolvedValueOnce({ updateMemberNote: mockMember });

    await runCommand(membersCommand, [
      "note",
      "mem_1",
      "--text",
      "VIP customer",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.memberId).toBe("mem_1");
    expect(call.variables.input.note).toBe("VIP customer");
  });

  it("note clears when no text provided", async () => {
    graphqlRequest.mockResolvedValueOnce({ updateMemberNote: mockMember });

    await runCommand(membersCommand, ["note", "mem_1"]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.memberId).toBe("mem_1");
    expect(call.variables.input.note).toBe("");
  });

  it("handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Unauthorized"));

    const original = process.exitCode;
    await runCommand(membersCommand, ["count"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("list writes members to file", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [{ node: mockMember }],
        pageInfo: { endCursor: null },
      },
    });

    await runCommand(membersCommand, ["list"]);

    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining("members.json"),
      expect.stringContaining("mem_1")
    );
  });

  it("list --all auto-paginates across multiple pages", async () => {
    const edges = Array.from({ length: 200 }, (_, i) => ({
      node: { ...mockMember, id: `mem_${i}` },
    }));
    graphqlRequest
      .mockResolvedValueOnce({
        getMembers: { edges, pageInfo: { endCursor: "c1" } },
      })
      .mockResolvedValueOnce({
        getMembers: {
          edges: [{ node: { ...mockMember, id: "mem_200" } }],
          pageInfo: { endCursor: null },
        },
      });

    await runCommand(membersCommand, ["list", "--all"]);

    expect(graphqlRequest).toHaveBeenCalledTimes(2);
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written).toHaveLength(201);
  });

  it("list --order DESC reverses results", async () => {
    const mem2 = { ...mockMember, id: "mem_2", auth: { email: "b@test.com" } };
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [{ node: mockMember }, { node: mem2 }],
        pageInfo: { endCursor: null },
      },
    });

    await runCommand(membersCommand, ["list", "--order", "DESC"]);

    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written[0].id).toBe("mem_2");
  });

  it("list handles empty result", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getMembers: { edges: [], pageInfo: { endCursor: null } },
    });

    await runCommand(membersCommand, ["list"]);

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("create passes plans, custom fields, meta data, and login redirect", async () => {
    graphqlRequest.mockResolvedValueOnce({
      signupMemberEmailPassword: { member: mockMember },
    });

    await runCommand(membersCommand, [
      "create",
      "--email",
      "new@test.com",
      "--password",
      "secret123",
      "--plans",
      "pln_1",
      "--custom-fields",
      "company=Acme",
      "--meta-data",
      "source=cli",
      "--login-redirect",
      "https://example.com",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.plans).toEqual([{ planId: "pln_1" }]);
    expect(call.variables.input.customFields).toEqual({ company: "Acme" });
    expect(call.variables.input.metaData).toEqual({ source: "cli" });
    expect(call.variables.input.loginRedirect).toBe("https://example.com");
  });

  it("update --email sends separate updateMemberAuth mutation", async () => {
    graphqlRequest
      .mockResolvedValueOnce({ updateMemberAuth: mockMember })
      .mockResolvedValueOnce({ updateMember: mockMember });

    await runCommand(membersCommand, [
      "update",
      "mem_1",
      "--email",
      "new@test.com",
      "--custom-fields",
      "company=Acme",
    ]);

    expect(graphqlRequest.mock.calls[0][0].query).toContain("updateMemberAuth");
    expect(graphqlRequest.mock.calls[0][0].variables.input).toEqual({
      memberId: "mem_1",
      email: "new@test.com",
    });
    expect(graphqlRequest.mock.calls[1][0].query).toContain("updateMember");
  });

  it("update with no options prints error", async () => {
    const original = process.exitCode;
    await runCommand(membersCommand, ["update", "mem_1"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("export fetches all members and writes output", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [{ node: mockMember }],
        pageInfo: { endCursor: null },
      },
    });
    writeOutputFile.mockResolvedValueOnce(undefined);

    await runCommand(membersCommand, ["export", "--format", "csv"]);

    expect(writeOutputFile).toHaveBeenCalledWith(
      expect.stringContaining("members.csv"),
      expect.arrayContaining([
        expect.objectContaining({ email: "test@example.com" }),
      ]),
      "csv"
    );
  });

  it("import creates members from file rows", async () => {
    readInputFile.mockResolvedValueOnce([
      { email: "a@test.com", password: "pass1" },
      { email: "b@test.com", password: "pass2" },
    ]);
    graphqlRequest
      .mockResolvedValueOnce({
        signupMemberEmailPassword: { member: mockMember },
      })
      .mockResolvedValueOnce({
        signupMemberEmailPassword: { member: mockMember },
      });

    await runCommand(membersCommand, ["import", "--file", "members.csv"]);

    expect(readInputFile).toHaveBeenCalledWith("members.csv");
    expect(graphqlRequest).toHaveBeenCalledTimes(2);
  });

  it("import skips rows missing email or password", async () => {
    readInputFile.mockResolvedValueOnce([{ email: "a@test.com" }]);

    await runCommand(membersCommand, ["import", "--file", "members.csv"]);

    expect(graphqlRequest).not.toHaveBeenCalled();
  });

  it("import continues on row failure", async () => {
    readInputFile.mockResolvedValueOnce([
      { email: "a@test.com", password: "pass1" },
      { email: "b@test.com", password: "pass2" },
    ]);
    graphqlRequest
      .mockRejectedValueOnce(new Error("Duplicate"))
      .mockResolvedValueOnce({
        signupMemberEmailPassword: { member: mockMember },
      });

    await runCommand(membersCommand, ["import", "--file", "members.csv"]);

    expect(graphqlRequest).toHaveBeenCalledTimes(2);
  });

  it("import passes plans, login redirect, and prefixed fields", async () => {
    readInputFile.mockResolvedValueOnce([
      {
        email: "a@test.com",
        password: "pass1",
        plans: "pln_1, pln_2",
        loginRedirect: "/dashboard",
        "customFields.company": "Acme",
        "metaData.source": "csv",
      },
    ]);
    graphqlRequest.mockResolvedValueOnce({
      signupMemberEmailPassword: { member: mockMember },
    });

    await runCommand(membersCommand, ["import", "--file", "members.csv"]);

    const input = graphqlRequest.mock.calls[0][0].variables.input;
    expect(input.plans).toEqual([{ planId: "pln_1" }, { planId: "pln_2" }]);
    expect(input.loginRedirect).toBe("/dashboard");
    expect(input.customFields).toEqual({ company: "Acme" });
    expect(input.metaData).toEqual({ source: "csv" });
  });

  it("find filters by custom field values", async () => {
    const matched = { ...mockMember, customFields: { company: "Acme" } };
    const unmatched = {
      ...mockMember,
      id: "mem_2",
      customFields: { company: "Other" },
    };
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [{ node: matched }, { node: unmatched }],
        pageInfo: { endCursor: null },
      },
    });

    await runCommand(membersCommand, ["find", "--field", "company=Acme"]);

    expect(graphqlRequest).toHaveBeenCalled();
  });

  it("find with --plan uses server-side filter", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [{ node: mockMember }],
        pageInfo: { endCursor: null },
      },
    });

    await runCommand(membersCommand, ["find", "--plan", "pln_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          filters: { planIds: ["pln_1"] },
        }),
      })
    );
  });

  it("find with --plan and --field fetches all then filters locally", async () => {
    const memberWithPlan = {
      ...mockMember,
      customFields: { company: "Acme" },
      planConnections: [
        {
          id: "pc_1",
          status: "ACTIVE",
          type: "FREE",
          active: true,
          plan: { id: "pln_1", name: "Free" },
        },
      ],
    };
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [{ node: memberWithPlan }],
        pageInfo: { endCursor: null },
      },
    });

    await runCommand(membersCommand, [
      "find",
      "--plan",
      "pln_1",
      "--field",
      "company=Acme",
    ]);

    // Should NOT pass planIds filter since --field is also present
    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.not.objectContaining({ filters: expect.anything() }),
      })
    );
  });

  it("stats computes member statistics", async () => {
    const activeMember = {
      ...mockMember,
      planConnections: [
        {
          id: "pc_1",
          status: "ACTIVE",
          type: "FREE",
          active: true,
          plan: { id: "pln_1", name: "Free" },
        },
      ],
    };
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [{ node: activeMember }, { node: mockMember }],
        pageInfo: { endCursor: null },
      },
    });

    await runCommand(membersCommand, ["stats"]);

    expect(graphqlRequest).toHaveBeenCalled();
  });

  it("bulk-update processes rows and updates members", async () => {
    readInputFile.mockResolvedValueOnce([
      { id: "mem_1", "customFields.company": "Acme" },
    ]);
    graphqlRequest.mockResolvedValueOnce({ updateMember: mockMember });

    await runCommand(membersCommand, ["bulk-update", "--file", "updates.csv"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          input: expect.objectContaining({
            memberId: "mem_1",
            customFields: { company: "Acme" },
          }),
        }),
      })
    );
  });

  it("bulk-update --dry-run previews without calling API", async () => {
    readInputFile.mockResolvedValueOnce([
      { id: "mem_1", "customFields.company": "Acme" },
    ]);

    await runCommand(membersCommand, [
      "bulk-update",
      "--file",
      "updates.csv",
      "--dry-run",
    ]);

    expect(graphqlRequest).not.toHaveBeenCalled();
  });

  it("bulk-update skips rows missing id", async () => {
    readInputFile.mockResolvedValueOnce([{ email: "a@test.com" }]);

    await runCommand(membersCommand, ["bulk-update", "--file", "updates.csv"]);

    expect(graphqlRequest).not.toHaveBeenCalled();
  });

  it("bulk-update with email triggers updateMemberAuth", async () => {
    readInputFile.mockResolvedValueOnce([
      { id: "mem_1", email: "new@test.com" },
    ]);
    graphqlRequest.mockResolvedValueOnce({ updateMemberAuth: mockMember });

    await runCommand(membersCommand, ["bulk-update", "--file", "updates.csv"]);

    expect(graphqlRequest.mock.calls[0][0].query).toContain("updateMemberAuth");
  });

  it("bulk-add-plan with no-plan filter targets only planless members", async () => {
    const noPlan = { ...mockMember, planConnections: [] };
    const hasPlan = {
      ...mockMember,
      id: "mem_2",
      auth: { email: "b@test.com" },
      planConnections: [
        {
          id: "pc_1",
          status: "ACTIVE",
          type: "FREE",
          active: true,
          plan: { id: "pln_1", name: "Free" },
        },
      ],
    };
    graphqlRequest
      .mockResolvedValueOnce({
        getMembers: {
          edges: [{ node: noPlan }, { node: hasPlan }],
          pageInfo: { endCursor: null },
        },
      })
      .mockResolvedValueOnce({ addFreePlan: { id: "pln_1", name: "Free" } });

    await runCommand(membersCommand, [
      "bulk-add-plan",
      "--plan",
      "pln_1",
      "--filter",
      "no-plan",
    ]);

    const addCalls = graphqlRequest.mock.calls.filter((c) =>
      c[0].query.includes("addFreePlan")
    );
    expect(addCalls).toHaveLength(1);
  });

  it("bulk-add-plan --dry-run previews without adding plans", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [{ node: mockMember }],
        pageInfo: { endCursor: null },
      },
    });

    await runCommand(membersCommand, [
      "bulk-add-plan",
      "--plan",
      "pln_1",
      "--filter",
      "all",
      "--dry-run",
    ]);

    expect(graphqlRequest).toHaveBeenCalledTimes(1);
  });

  it("bulk-add-plan rejects unknown filter", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getMembers: {
        edges: [],
        pageInfo: { endCursor: null },
      },
    });

    const original = process.exitCode;
    await runCommand(membersCommand, [
      "bulk-add-plan",
      "--plan",
      "pln_1",
      "--filter",
      "unknown",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
