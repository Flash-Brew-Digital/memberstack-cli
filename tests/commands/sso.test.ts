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

const { ssoCommand } = await import("../../src/commands/sso.js");

const mockSSOApp = {
  id: "sso_app_1",
  name: "My App",
  clientId: "client_123",
  clientSecret: "secret_456",
  redirectUris: ["https://example.com/callback"],
};

describe("sso", () => {
  it("list fetches SSO apps", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getSSOApps: [mockSSOApp],
    });

    await runCommand(ssoCommand, ["list"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("getSSOApps"),
      })
    );
  });

  it("create sends name and redirect URIs", async () => {
    graphqlRequest.mockResolvedValueOnce({
      createSSOApp: mockSSOApp,
    });

    await runCommand(ssoCommand, [
      "create",
      "--name",
      "My App",
      "--redirect-uri",
      "https://example.com/callback",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input).toEqual({
      name: "My App",
      redirectUris: ["https://example.com/callback"],
    });
  });

  it("create supports multiple redirect URIs", async () => {
    graphqlRequest.mockResolvedValueOnce({
      createSSOApp: {
        ...mockSSOApp,
        redirectUris: [
          "https://example.com/callback",
          "https://example.com/auth",
        ],
      },
    });

    await runCommand(ssoCommand, [
      "create",
      "--name",
      "My App",
      "--redirect-uri",
      "https://example.com/callback",
      "--redirect-uri",
      "https://example.com/auth",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.redirectUris).toEqual([
      "https://example.com/callback",
      "https://example.com/auth",
    ]);
  });

  it("update sends id and name", async () => {
    graphqlRequest.mockResolvedValueOnce({
      updateSSOApp: { ...mockSSOApp, name: "Renamed" },
    });

    await runCommand(ssoCommand, ["update", "sso_app_1", "--name", "Renamed"]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.id).toBe("sso_app_1");
    expect(call.variables.input.name).toBe("Renamed");
  });

  it("update sends id and redirect URIs", async () => {
    graphqlRequest.mockResolvedValueOnce({
      updateSSOApp: mockSSOApp,
    });

    await runCommand(ssoCommand, [
      "update",
      "sso_app_1",
      "--redirect-uri",
      "https://new.example.com/callback",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.id).toBe("sso_app_1");
    expect(call.variables.input.redirectUris).toEqual([
      "https://new.example.com/callback",
    ]);
  });

  it("update rejects with no options", async () => {
    const original = process.exitCode;
    await runCommand(ssoCommand, ["update", "sso_app_1"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("create rejects with no redirect URIs", async () => {
    const original = process.exitCode;
    await runCommand(ssoCommand, ["create", "--name", "No URIs"]);
    expect(process.exitCode).toBe(1);
    expect(graphqlRequest).not.toHaveBeenCalled();
    process.exitCode = original;
  });

  it("delete sends id", async () => {
    graphqlRequest.mockResolvedValueOnce({ deleteSSOApp: "sso_app_1" });

    await runCommand(ssoCommand, ["delete", "sso_app_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { id: "sso_app_1" } },
      })
    );
  });

  it("list handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Unauthorized"));

    const original = process.exitCode;
    await runCommand(ssoCommand, ["list"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("create handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Duplicate name"));

    const original = process.exitCode;
    await runCommand(ssoCommand, [
      "create",
      "--name",
      "Bad",
      "--redirect-uri",
      "https://example.com",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("update handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Not found"));

    const original = process.exitCode;
    await runCommand(ssoCommand, ["update", "sso_bad", "--name", "test"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("delete handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Not found"));

    const original = process.exitCode;
    await runCommand(ssoCommand, ["delete", "sso_bad"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
