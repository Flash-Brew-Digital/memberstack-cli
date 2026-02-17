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

const { appsCommand } = await import("../../src/commands/apps.js");

describe("apps", () => {
  it("current fetches and prints the current app", async () => {
    const app = { id: "app_1", name: "My App", status: "ACTIVE" };
    graphqlRequest.mockResolvedValueOnce({ currentApp: app });

    await runCommand(appsCommand, ["current"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("currentApp"),
      })
    );
  });

  it("create sends name and stack", async () => {
    const app = { id: "app_2", name: "New App", status: "ACTIVE" };
    graphqlRequest.mockResolvedValueOnce({ createApp: app });

    await runCommand(appsCommand, [
      "create",
      "--name",
      "New App",
      "--stack",
      "REACT",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: expect.objectContaining({ name: "New App", stack: "REACT" }),
        },
      })
    );
  });

  it("update sends only provided fields", async () => {
    const app = { id: "app_1", name: "Renamed", status: "ACTIVE" };
    graphqlRequest.mockResolvedValueOnce({ updateApp: app });

    await runCommand(appsCommand, ["update", "--name", "Renamed"]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input).toEqual({ name: "Renamed" });
  });

  it("update with no options sets exit code 1", async () => {
    const original = process.exitCode;
    await runCommand(appsCommand, ["update"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("delete sends appId", async () => {
    const app = { id: "app_1", name: "Deleted App" };
    graphqlRequest.mockResolvedValueOnce({ deleteApp: app });

    await runCommand(appsCommand, ["delete", "--app-id", "app_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { appId: "app_1" } },
      })
    );
  });

  it("restore sends appId", async () => {
    const app = { id: "app_1", name: "Restored App" };
    graphqlRequest.mockResolvedValueOnce({ restoreApp: app });

    await runCommand(appsCommand, ["restore", "--app-id", "app_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { appId: "app_1" } },
      })
    );
  });

  it("handles graphql errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Network error"));

    const original = process.exitCode;
    await runCommand(appsCommand, ["current"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
