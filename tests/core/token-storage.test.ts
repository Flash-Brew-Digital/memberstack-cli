import { describe, expect, it, vi } from "vitest";

const mockMkdir = vi.fn();
const mockReadFile = vi.fn();
const mockRm = vi.fn();
const mockWriteFile = vi.fn();
vi.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  rm: (...args: unknown[]) => mockRm(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

vi.mock("node:os", () => ({
  homedir: () => "/mock-home",
}));

vi.mock("../../src/lib/constants.js", () => ({
  TOKEN_STORAGE_DIR: ".memberstack",
  TOKEN_STORAGE_FILE: "auth.json",
}));

const mockRefreshAccessToken = vi.fn();
vi.mock("../../src/lib/oauth.js", () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}));

const { saveTokens, loadTokens, clearTokens, getValidAccessToken, getAppId } =
  await import("../../src/lib/token-storage.js");

const TOKEN_PATH = "/mock-home/.memberstack/auth.json";
const TOKEN_DIR = "/mock-home/.memberstack";

/** Build a base64url-encoded JWT with the given payload. */
const buildJwt = (payload: Record<string, unknown>): string => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString(
    "base64url"
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
};

describe("token-storage", () => {
  describe("saveTokens", () => {
    it("creates the storage directory with restricted permissions", async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      await saveTokens(
        { access_token: "at_1", expires_in: 3600, token_type: "Bearer" },
        "client_1"
      );

      expect(mockMkdir).toHaveBeenCalledWith(TOKEN_DIR, {
        recursive: true,
        mode: 0o700,
      });
    });

    it("writes token data with restricted file permissions", async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      await saveTokens(
        { access_token: "at_1", expires_in: 3600, token_type: "Bearer" },
        "client_1"
      );

      expect(mockWriteFile).toHaveBeenCalledWith(
        TOKEN_PATH,
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it("stores the correct fields including computed expires_at", async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      const now = Math.floor(Date.now() / 1000);

      await saveTokens(
        {
          access_token: "at_1",
          refresh_token: "rt_1",
          expires_in: 3600,
          token_type: "Bearer",
        },
        "client_1"
      );

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.access_token).toBe("at_1");
      expect(written.refresh_token).toBe("rt_1");
      expect(written.client_id).toBe("client_1");
      expect(written.expires_at).toBeGreaterThanOrEqual(now + 3600);
      expect(written.expires_at).toBeLessThanOrEqual(now + 3601);
    });

    it("parses app_id from a valid JWT access token", async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      const jwt = buildJwt({ appId: "app_123" });

      await saveTokens(
        { access_token: jwt, expires_in: 3600, token_type: "Bearer" },
        "client_1"
      );

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.app_id).toBe("app_123");
    });

    it("sets app_id to undefined for a non-JWT access token", async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      await saveTokens(
        { access_token: "plain-token", expires_in: 3600, token_type: "Bearer" },
        "client_1"
      );

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.app_id).toBeUndefined();
    });

    it("sets app_id to undefined when JWT payload has no appId", async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      const jwt = buildJwt({ sub: "user_1" });

      await saveTokens(
        { access_token: jwt, expires_in: 3600, token_type: "Bearer" },
        "client_1"
      );

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.app_id).toBeUndefined();
    });

    it("sets app_id to undefined when JWT payload is invalid base64", async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      await saveTokens(
        {
          access_token: "header.!!!invalid!!!.signature",
          expires_in: 3600,
          token_type: "Bearer",
        },
        "client_1"
      );

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written.app_id).toBeUndefined();
    });
  });

  describe("loadTokens", () => {
    it("reads and parses stored tokens", async () => {
      const stored = {
        access_token: "at_1",
        refresh_token: "rt_1",
        expires_at: 9_999_999_999,
        client_id: "client_1",
        app_id: "app_1",
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(stored));

      const result = await loadTokens();
      expect(result).toEqual(stored);
      expect(mockReadFile).toHaveBeenCalledWith(TOKEN_PATH, "utf-8");
    });

    it("returns null when token file does not exist", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await loadTokens();
      expect(result).toBeNull();
    });
  });

  describe("clearTokens", () => {
    it("removes the token file", async () => {
      mockRm.mockResolvedValueOnce(undefined);

      await clearTokens();
      expect(mockRm).toHaveBeenCalledWith(TOKEN_PATH);
    });

    it("does not throw when file does not exist", async () => {
      mockRm.mockRejectedValueOnce(new Error("ENOENT"));

      await expect(clearTokens()).resolves.toBeUndefined();
    });
  });

  describe("getValidAccessToken", () => {
    it("returns null when no tokens are stored", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await getValidAccessToken();
      expect(result).toBeNull();
    });

    it("returns the access token when it has not expired", async () => {
      const stored = {
        access_token: "at_valid",
        refresh_token: "rt_1",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        client_id: "client_1",
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(stored));

      const result = await getValidAccessToken();
      expect(result).toBe("at_valid");
    });

    it("returns null when token is expired and no refresh token exists", async () => {
      const stored = {
        access_token: "at_expired",
        expires_at: 0,
        client_id: "client_1",
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(stored));

      const result = await getValidAccessToken();
      expect(result).toBeNull();
    });

    it("refreshes and returns new token when expired with refresh token", async () => {
      const stored = {
        access_token: "at_expired",
        refresh_token: "rt_1",
        expires_at: 0,
        client_id: "client_1",
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(stored));
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      mockRefreshAccessToken.mockResolvedValueOnce({
        access_token: "at_refreshed",
        expires_in: 3600,
        token_type: "Bearer",
      });

      const result = await getValidAccessToken();
      expect(result).toBe("at_refreshed");
      expect(mockRefreshAccessToken).toHaveBeenCalledWith({
        clientId: "client_1",
        refreshToken: "rt_1",
      });
    });

    it("returns null when refresh fails", async () => {
      const stored = {
        access_token: "at_expired",
        refresh_token: "rt_bad",
        expires_at: 0,
        client_id: "client_1",
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(stored));
      mockRefreshAccessToken.mockRejectedValueOnce(new Error("refresh failed"));

      const result = await getValidAccessToken();
      expect(result).toBeNull();
    });

    it("treats tokens within the 60-second buffer as expired", async () => {
      const stored = {
        access_token: "at_almost_expired",
        expires_at: Math.floor(Date.now() / 1000) + 30,
        client_id: "client_1",
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(stored));

      const result = await getValidAccessToken();
      expect(result).toBeNull();
    });
  });

  describe("getAppId", () => {
    it("returns the stored app_id", async () => {
      const stored = {
        access_token: "at_1",
        expires_at: 9_999_999_999,
        client_id: "client_1",
        app_id: "app_42",
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(stored));

      const result = await getAppId();
      expect(result).toBe("app_42");
    });

    it("returns null when no tokens are stored", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await getAppId();
      expect(result).toBeNull();
    });

    it("returns null when app_id is not set", async () => {
      const stored = {
        access_token: "at_1",
        expires_at: 9_999_999_999,
        client_id: "client_1",
      };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(stored));

      const result = await getAppId();
      expect(result).toBeNull();
    });
  });
});
