import { describe, expect, it, vi } from "vitest";
import { runCommand } from "../commands/helpers.js";

const loadTokens = vi.fn();
const clearTokens = vi.fn();
const getValidAccessToken = vi.fn();
const revokeToken = vi.fn();

vi.mock("../../src/lib/token-storage.js", () => ({
  loadTokens: (...args: unknown[]) => loadTokens(...args),
  clearTokens: (...args: unknown[]) => clearTokens(...args),
  saveTokens: vi.fn(),
  getValidAccessToken: (...args: unknown[]) => getValidAccessToken(...args),
}));
vi.mock("../../src/lib/oauth.js", () => ({
  registerClient: vi.fn(),
  generateCodeVerifier: vi.fn().mockReturnValue("verifier"),
  generateCodeChallenge: vi.fn().mockReturnValue("challenge"),
  generateState: vi.fn().mockReturnValue("state"),
  buildAuthorizationUrl: vi.fn().mockReturnValue("https://auth.example.com"),
  exchangeCodeForTokens: vi.fn(),
  revokeToken: (...args: unknown[]) => revokeToken(...args),
}));
vi.mock("open", () => ({ default: vi.fn() }));
vi.mock("yocto-spinner", () => {
  const spinner: Record<string, unknown> = { text: "" };
  spinner.start = vi.fn(() => spinner);
  spinner.stop = vi.fn(() => spinner);
  return { default: () => spinner };
});
vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({}) },
}));

const graphqlRequest = vi.fn();
vi.mock("../../src/lib/graphql-client.js", () => ({
  graphqlRequest: (...args: unknown[]) => graphqlRequest(...args),
}));

const { authCommand } = await import("../../src/commands/auth.js");

describe("auth", () => {
  describe("logout", () => {
    it("clears tokens and revokes refresh token", async () => {
      loadTokens.mockResolvedValueOnce({
        refresh_token: "rt_abc",
        client_id: "client_1",
        expires_at: 0,
      });
      clearTokens.mockResolvedValueOnce(undefined);
      revokeToken.mockResolvedValueOnce(undefined);

      await runCommand(authCommand, ["logout"]);

      expect(revokeToken).toHaveBeenCalledWith({
        clientId: "client_1",
        token: "rt_abc",
      });
      expect(clearTokens).toHaveBeenCalled();
    });

    it("clears tokens even without refresh token", async () => {
      loadTokens.mockResolvedValueOnce({ expires_at: 0 });
      clearTokens.mockResolvedValueOnce(undefined);

      await runCommand(authCommand, ["logout"]);

      expect(revokeToken).not.toHaveBeenCalled();
      expect(clearTokens).toHaveBeenCalled();
    });

    it("handles logout errors gracefully", async () => {
      loadTokens.mockRejectedValueOnce(new Error("Disk error"));

      const original = process.exitCode;
      await runCommand(authCommand, ["logout"]);
      expect(process.exitCode).toBe(1);
      process.exitCode = original;
    });
  });

  describe("status", () => {
    it("shows not logged in when no tokens", async () => {
      loadTokens.mockResolvedValueOnce(null);

      await runCommand(authCommand, ["status"]);

      expect(loadTokens).toHaveBeenCalled();
    });

    it("shows logged in status with valid token", async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      loadTokens.mockResolvedValueOnce({
        refresh_token: "rt_abc",
        client_id: "client_1",
        expires_at: futureExpiry,
        app_id: "app_1",
      });
      getValidAccessToken.mockResolvedValueOnce("at_valid");

      await runCommand(authCommand, ["status"]);

      expect(loadTokens).toHaveBeenCalled();
      expect(getValidAccessToken).toHaveBeenCalled();
    });

    it("shows expired status", async () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
      loadTokens.mockResolvedValueOnce({
        refresh_token: "rt_abc",
        client_id: "client_1",
        expires_at: pastExpiry,
      });
      getValidAccessToken.mockResolvedValueOnce(null);

      await runCommand(authCommand, ["status"]);

      expect(loadTokens).toHaveBeenCalled();
    });
  });

  describe("update-profile", () => {
    it("sends first name and last name", async () => {
      graphqlRequest.mockResolvedValueOnce({
        updateUserProfile: {
          id: "usr_1",
          auth: { email: "test@example.com" },
          profile: { firstName: "Ben", lastName: "Sabic" },
        },
      });

      await runCommand(authCommand, [
        "update-profile",
        "--first-name",
        "Ben",
        "--last-name",
        "Sabic",
      ]);

      const call = graphqlRequest.mock.calls[0][0];
      expect(call.variables.input).toEqual({
        firstName: "Ben",
        lastName: "Sabic",
      });
    });

    it("sends email only", async () => {
      graphqlRequest.mockResolvedValueOnce({
        updateUserProfile: {
          id: "usr_1",
          auth: { email: "new@example.com" },
          profile: { firstName: "Ben", lastName: "Sabic" },
        },
      });

      await runCommand(authCommand, [
        "update-profile",
        "--email",
        "new@example.com",
      ]);

      const call = graphqlRequest.mock.calls[0][0];
      expect(call.variables.input).toEqual({ email: "new@example.com" });
    });

    it("rejects with no options", async () => {
      const original = process.exitCode;
      await runCommand(authCommand, ["update-profile"]);
      expect(process.exitCode).toBe(1);
      process.exitCode = original;
    });

    it("handles errors gracefully", async () => {
      graphqlRequest.mockRejectedValueOnce(new Error("Unauthorized"));

      const original = process.exitCode;
      await runCommand(authCommand, ["update-profile", "--first-name", "Test"]);
      expect(process.exitCode).toBe(1);
      process.exitCode = original;
    });
  });
});
