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

const { usersCommand } = await import("../../src/commands/users.js");

const mockAppUser = {
  user: {
    id: "usr_1",
    auth: { email: "admin@example.com" },
    profile: { firstName: "Jane", lastName: "Doe" },
  },
  role: "ADMIN",
};

describe("users", () => {
  it("list fetches users with pagination", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getUsers: {
        edges: [{ cursor: "c1", node: mockAppUser }],
      },
    });

    await runCommand(usersCommand, ["list"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("getUsers"),
      })
    );
  });

  it("get finds user by ID", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getUsers: {
        edges: [{ node: mockAppUser }],
      },
    });

    await runCommand(usersCommand, ["get", "usr_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("getUsers"),
      })
    );
  });

  it("get finds user by email", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getUsers: {
        edges: [{ node: mockAppUser }],
      },
    });

    await runCommand(usersCommand, ["get", "admin@example.com"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("getUsers"),
      })
    );
  });

  it("get sets exit code 1 when user not found", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getUsers: {
        edges: [{ node: mockAppUser }],
      },
    });

    const original = process.exitCode;
    await runCommand(usersCommand, ["get", "nonexistent@example.com"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("add sends email and role", async () => {
    graphqlRequest.mockResolvedValueOnce({
      addUserToApp: { app: { id: "app_1", name: "My App" }, role: "ADMIN" },
    });

    await runCommand(usersCommand, [
      "add",
      "--email",
      "new@example.com",
      "--role",
      "ADMIN",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: { email: "new@example.com", role: "ADMIN" },
        },
      })
    );
  });

  it("add sends email without role", async () => {
    graphqlRequest.mockResolvedValueOnce({
      addUserToApp: { app: { id: "app_1", name: "My App" }, role: "ADMIN" },
    });

    await runCommand(usersCommand, ["add", "--email", "new@example.com"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: { email: "new@example.com" },
        },
      })
    );
  });

  it("remove sends userId", async () => {
    graphqlRequest.mockResolvedValueOnce({
      removeUserFromApp: {
        app: { id: "app_1", name: "My App" },
        role: "ADMIN",
      },
    });

    await runCommand(usersCommand, ["remove", "usr_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { userId: "usr_1" } },
      })
    );
  });

  it("update-role sends userId and role", async () => {
    graphqlRequest.mockResolvedValueOnce({
      updateUserRole: {
        app: { id: "app_1", name: "My App" },
        role: "MEMBERS_READ",
      },
    });

    await runCommand(usersCommand, [
      "update-role",
      "usr_1",
      "--role",
      "MEMBERS_READ",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: { userId: "usr_1", role: "MEMBERS_READ" },
        },
      })
    );
  });

  it("handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Unauthorized"));

    const original = process.exitCode;
    await runCommand(usersCommand, ["list"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
