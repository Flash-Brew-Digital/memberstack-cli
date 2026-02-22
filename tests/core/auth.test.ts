import { describe, expect, it, vi } from "vitest";
import { runCommand } from "../commands/helpers.js";

const loadTokens = vi.fn();
const clearTokens = vi.fn();
const getValidAccessToken = vi.fn();
const saveTokens = vi.fn();
const revokeToken = vi.fn();
const registerClient = vi.fn();
const exchangeCodeForTokens = vi.fn();

vi.mock("../../src/lib/token-storage.js", () => ({
  loadTokens: (...args: unknown[]) => loadTokens(...args),
  clearTokens: (...args: unknown[]) => clearTokens(...args),
  saveTokens: (...args: unknown[]) => saveTokens(...args),
  getValidAccessToken: (...args: unknown[]) => getValidAccessToken(...args),
}));
vi.mock("../../src/lib/oauth.js", () => ({
  registerClient: (...args: unknown[]) => registerClient(...args),
  generateCodeVerifier: () => "verifier",
  generateCodeChallenge: () => "challenge",
  generateState: () => "test_state",
  buildAuthorizationUrl: () => "https://auth.example.com",
  exchangeCodeForTokens: (...args: unknown[]) => exchangeCodeForTokens(...args),
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

let callbackHandler: ((req: unknown, res: unknown) => void) | null = null;

const invokeCallback = (req: unknown, res: unknown): void => {
  if (!callbackHandler) {
    throw new Error("callbackHandler not set");
  }
  callbackHandler(req, res);
};

vi.mock("node:http", () => ({
  createServer: (handler?: (req: unknown, res: unknown) => void) => {
    if (handler) {
      callbackHandler = handler;
    }
    const server: Record<string, unknown> = {};
    server.listen = (...args: unknown[]) => {
      const cb = args.find((a) => typeof a === "function") as
        | (() => void)
        | undefined;
      if (cb) {
        queueMicrotask(cb);
      }
      return server;
    };
    server.close = (cb?: () => void) => {
      if (cb) {
        queueMicrotask(cb);
      }
      return server;
    };
    server.address = () => ({ port: 3456 });
    server.on = () => server;
    return server;
  },
}));

const graphqlRequest = vi.fn();
vi.mock("../../src/lib/graphql-client.js", () => ({
  graphqlRequest: (...args: unknown[]) => graphqlRequest(...args),
}));

const { authCommand } = await import("../../src/commands/auth.js");

describe("auth", () => {
  describe("login", () => {
    it("completes OAuth flow successfully", async () => {
      registerClient.mockResolvedValueOnce("client_123");
      exchangeCodeForTokens.mockResolvedValueOnce({
        access_token: "at_abc",
        refresh_token: "rt_abc",
        expires_in: 3600,
      });
      saveTokens.mockResolvedValueOnce(undefined);

      callbackHandler = null;
      const promise = runCommand(authCommand, ["login"]);

      await vi.waitFor(() => {
        expect(callbackHandler).not.toBeNull();
      });

      const res = { writeHead: vi.fn(), end: vi.fn() };
      invokeCallback({ url: "/callback?code=auth_code&state=test_state" }, res);

      await promise;

      expect(registerClient).toHaveBeenCalled();
      expect(exchangeCodeForTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client_123",
          code: "auth_code",
          codeVerifier: "verifier",
        })
      );
      expect(saveTokens).toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "text/html",
      });
    });

    it("handles authorization error in callback", async () => {
      registerClient.mockResolvedValueOnce("client_123");

      callbackHandler = null;
      const original = process.exitCode;
      const promise = runCommand(authCommand, ["login"]);

      await vi.waitFor(() => {
        expect(callbackHandler).not.toBeNull();
      });

      const res = { writeHead: vi.fn(), end: vi.fn() };
      invokeCallback(
        { url: "/callback?error=access_denied&error_description=User+denied" },
        res
      );

      await promise;

      expect(process.exitCode).toBe(1);
      expect(res.writeHead).toHaveBeenCalledWith(400, {
        "Content-Type": "text/html",
      });
      process.exitCode = original;
    });

    it("handles missing code/state in callback", async () => {
      registerClient.mockResolvedValueOnce("client_123");

      callbackHandler = null;
      const original = process.exitCode;
      const promise = runCommand(authCommand, ["login"]);

      await vi.waitFor(() => {
        expect(callbackHandler).not.toBeNull();
      });

      const res = { writeHead: vi.fn(), end: vi.fn() };
      invokeCallback({ url: "/callback" }, res);

      await promise;

      expect(process.exitCode).toBe(1);
      expect(res.writeHead).toHaveBeenCalledWith(400, {
        "Content-Type": "text/html",
      });
      process.exitCode = original;
    });

    it("handles state mismatch in callback", async () => {
      registerClient.mockResolvedValueOnce("client_123");

      callbackHandler = null;
      const original = process.exitCode;
      const promise = runCommand(authCommand, ["login"]);

      await vi.waitFor(() => {
        expect(callbackHandler).not.toBeNull();
      });

      const res = { writeHead: vi.fn(), end: vi.fn() };
      invokeCallback(
        { url: "/callback?code=auth_code&state=wrong_state" },
        res
      );

      await promise;

      expect(process.exitCode).toBe(1);
      expect(res.writeHead).toHaveBeenCalledWith(400, {
        "Content-Type": "text/html",
      });
      process.exitCode = original;
    });

    it("returns 404 for non-callback paths", async () => {
      registerClient.mockResolvedValueOnce("client_123");
      exchangeCodeForTokens.mockResolvedValueOnce({
        access_token: "at_abc",
        refresh_token: "rt_abc",
        expires_in: 3600,
      });
      saveTokens.mockResolvedValueOnce(undefined);

      callbackHandler = null;
      const promise = runCommand(authCommand, ["login"]);

      await vi.waitFor(() => {
        expect(callbackHandler).not.toBeNull();
      });

      const notFoundRes = { writeHead: vi.fn(), end: vi.fn() };
      invokeCallback({ url: "/favicon.ico" }, notFoundRes);

      expect(notFoundRes.writeHead).toHaveBeenCalledWith(404);
      expect(notFoundRes.end).toHaveBeenCalledWith("Not found");

      const res = { writeHead: vi.fn(), end: vi.fn() };
      invokeCallback({ url: "/callback?code=auth_code&state=test_state" }, res);

      await promise;

      expect(saveTokens).toHaveBeenCalled();
    });

    it("handles registration failure", async () => {
      registerClient.mockRejectedValueOnce(new Error("Registration failed"));

      callbackHandler = null;
      const original = process.exitCode;
      await runCommand(authCommand, ["login"]);

      expect(process.exitCode).toBe(1);
      process.exitCode = original;
    });

    it("handles error param without description", async () => {
      registerClient.mockResolvedValueOnce("client_123");

      callbackHandler = null;
      const original = process.exitCode;
      const promise = runCommand(authCommand, ["login"]);

      await vi.waitFor(() => {
        expect(callbackHandler).not.toBeNull();
      });

      const res = { writeHead: vi.fn(), end: vi.fn() };
      invokeCallback({ url: "/callback?error=server_error" }, res);

      await promise;

      expect(process.exitCode).toBe(1);
      process.exitCode = original;
    });
  });

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
