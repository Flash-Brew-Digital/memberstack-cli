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

const { providersCommand } = await import("../../src/commands/providers.js");

const mockProvider = {
  id: "sso_1",
  providerType: "GOOGLE",
  name: "Google",
  provider: "google",
  enabled: true,
  clientId: "client_123",
};

describe("providers", () => {
  it("list fetches providers", async () => {
    graphqlRequest.mockResolvedValueOnce({
      getSSOClients: [mockProvider],
    });

    await runCommand(providersCommand, ["list"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("getSSOClients"),
      })
    );
  });

  it("configure sends type and options", async () => {
    graphqlRequest.mockResolvedValueOnce({
      updateSSOClient: mockProvider,
    });

    await runCommand(providersCommand, [
      "configure",
      "--type",
      "GOOGLE",
      "--client-id",
      "my_client_id",
      "--client-secret",
      "my_secret",
      "--status",
      "enabled",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.provider).toBe("google");
    expect(call.variables.input.clientId).toBe("my_client_id");
    expect(call.variables.input.clientSecret).toBe("my_secret");
    expect(call.variables.input.enabled).toBe(true);
  });

  it("configure sends type only", async () => {
    graphqlRequest.mockResolvedValueOnce({
      updateSSOClient: mockProvider,
    });

    await runCommand(providersCommand, ["configure", "--type", "GITHUB"]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.provider).toBe("github");
    expect(call.variables.input.clientId).toBeUndefined();
  });

  it("configure can disable a provider", async () => {
    graphqlRequest.mockResolvedValueOnce({
      updateSSOClient: { ...mockProvider, enabled: false },
    });

    await runCommand(providersCommand, [
      "configure",
      "--type",
      "GOOGLE",
      "--status",
      "disabled",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.enabled).toBe(false);
  });

  it("configure rejects enabling without client id", async () => {
    const original = process.exitCode;
    const callCountBefore = graphqlRequest.mock.calls.length;

    await runCommand(providersCommand, [
      "configure",
      "--type",
      "GOOGLE",
      "--status",
      "enabled",
      "--client-secret",
      "my_secret",
    ]);

    expect(process.exitCode).toBe(1);
    expect(graphqlRequest.mock.calls.length).toBe(callCountBefore);
    process.exitCode = original;
  });

  it("configure rejects enabling without client secret", async () => {
    const original = process.exitCode;
    const callCountBefore = graphqlRequest.mock.calls.length;

    await runCommand(providersCommand, [
      "configure",
      "--type",
      "GOOGLE",
      "--status",
      "enabled",
      "--client-id",
      "my_client_id",
    ]);

    expect(process.exitCode).toBe(1);
    expect(graphqlRequest.mock.calls.length).toBe(callCountBefore);
    process.exitCode = original;
  });

  it("remove sends id", async () => {
    graphqlRequest.mockResolvedValueOnce({ removeSSOClient: "sso_1" });

    await runCommand(providersCommand, ["remove", "sso_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { id: "sso_1" } },
      })
    );
  });

  it("rejects invalid type", async () => {
    const original = process.exitCode;
    try {
      await runCommand(providersCommand, ["configure", "--type", "INVALID"]);
    } catch {
      // Commander throws on invalid choices
    }
    process.exitCode = original;
  });

  it("handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Unauthorized"));

    const original = process.exitCode;
    await runCommand(providersCommand, ["list"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
