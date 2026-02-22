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

const { permissionsCommand } = await import(
  "../../src/commands/permissions.js"
);

const mockPermission = {
  id: "perm_1",
  name: "can:edit",
  description: "Can edit content",
};

describe("permissions", () => {
  it("list fetches permissions", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getPermissions: [mockPermission],
    });

    await runCommand(permissionsCommand, ["list"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("getPermissions"),
      })
    );
  });

  it("create sends name and description", async () => {
    graphqlRequest.mockResolvedValueOnce({
      createPermission: mockPermission,
    });

    await runCommand(permissionsCommand, [
      "create",
      "--name",
      "can:edit",
      "--description",
      "Can edit content",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input).toEqual({
      name: "can:edit",
      description: "Can edit content",
    });
  });

  it("create sends name only", async () => {
    graphqlRequest.mockResolvedValueOnce({
      createPermission: mockPermission,
    });

    await runCommand(permissionsCommand, ["create", "--name", "can:view"]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input).toEqual({ name: "can:view" });
  });

  it("update sends permissionId and fields", async () => {
    graphqlRequest.mockResolvedValueOnce({
      updatePermission: mockPermission,
    });

    await runCommand(permissionsCommand, [
      "update",
      "perm_1",
      "--name",
      "can:write",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.permissionId).toBe("perm_1");
    expect(call.variables.input.name).toBe("can:write");
  });

  it("update rejects with no options", async () => {
    const original = process.exitCode;
    await runCommand(permissionsCommand, ["update", "perm_1"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("delete sends permissionId", async () => {
    graphqlRequest.mockResolvedValueOnce({
      deletePermission: mockPermission,
    });

    await runCommand(permissionsCommand, ["delete", "perm_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { permissionId: "perm_1" } },
      })
    );
  });

  it("link-plan sends planId and permissionIds", async () => {
    graphqlRequest.mockResolvedValueOnce({
      linkPermissionsToPlan: { id: "pln_1", name: "Pro" },
    });

    await runCommand(permissionsCommand, [
      "link-plan",
      "--plan-id",
      "pln_1",
      "--permission-id",
      "perm_1",
      "--permission-id",
      "perm_2",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.planId).toBe("pln_1");
    expect(call.variables.input.permissionIds).toEqual(["perm_1", "perm_2"]);
  });

  it("unlink-plan sends planId and permissionId", async () => {
    graphqlRequest.mockResolvedValueOnce({
      detachPermissionFromPlan: { id: "pln_1", name: "Pro" },
    });

    await runCommand(permissionsCommand, [
      "unlink-plan",
      "--plan-id",
      "pln_1",
      "--permission-id",
      "perm_1",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.planId).toBe("pln_1");
    expect(call.variables.input.permissionId).toBe("perm_1");
  });

  it("link-member sends memberId and permissionIds", async () => {
    graphqlRequest.mockResolvedValueOnce({
      linkPermissionsToMember: { id: "mem_1" },
    });

    await runCommand(permissionsCommand, [
      "link-member",
      "--member-id",
      "mem_1",
      "--permission-id",
      "perm_1",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.memberId).toBe("mem_1");
    expect(call.variables.input.permissionIds).toEqual(["perm_1"]);
  });

  it("unlink-member sends memberId and permissionId", async () => {
    graphqlRequest.mockResolvedValueOnce({
      detachPermissionFromMember: { id: "mem_1" },
    });

    await runCommand(permissionsCommand, [
      "unlink-member",
      "--member-id",
      "mem_1",
      "--permission-id",
      "perm_1",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.memberId).toBe("mem_1");
    expect(call.variables.input.permissionId).toBe("perm_1");
  });

  it("update with description only", async () => {
    graphqlRequest.mockResolvedValueOnce({
      updatePermission: mockPermission,
    });

    await runCommand(permissionsCommand, [
      "update",
      "perm_1",
      "--description",
      "Updated desc",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.description).toBe("Updated desc");
  });

  it("list handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Unauthorized"));

    const original = process.exitCode;
    await runCommand(permissionsCommand, ["list"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("create handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Duplicate name"));

    const original = process.exitCode;
    await runCommand(permissionsCommand, ["create", "--name", "bad"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("update handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Not found"));

    const original = process.exitCode;
    await runCommand(permissionsCommand, [
      "update",
      "perm_bad",
      "--name",
      "test",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("delete handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("In use"));

    const original = process.exitCode;
    await runCommand(permissionsCommand, ["delete", "perm_bad"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("link-plan handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Plan not found"));

    const original = process.exitCode;
    await runCommand(permissionsCommand, [
      "link-plan",
      "--plan-id",
      "pln_bad",
      "--permission-id",
      "perm_1",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("unlink-plan handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Not linked"));

    const original = process.exitCode;
    await runCommand(permissionsCommand, [
      "unlink-plan",
      "--plan-id",
      "pln_1",
      "--permission-id",
      "perm_bad",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("link-member handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Member not found"));

    const original = process.exitCode;
    await runCommand(permissionsCommand, [
      "link-member",
      "--member-id",
      "mem_bad",
      "--permission-id",
      "perm_1",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("unlink-member handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Not linked"));

    const original = process.exitCode;
    await runCommand(permissionsCommand, [
      "unlink-member",
      "--member-id",
      "mem_1",
      "--permission-id",
      "perm_bad",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
