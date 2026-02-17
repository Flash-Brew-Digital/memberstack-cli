import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/constants.js", () => ({
  OAUTH_AUTHORIZATION_ENDPOINT: "https://auth.test/authorize",
  OAUTH_TOKEN_ENDPOINT: "https://auth.test/token",
  OAUTH_REGISTRATION_ENDPOINT: "https://auth.test/register",
  OAUTH_REVOCATION_ENDPOINT: "https://auth.test/revoke",
  OAUTH_RESOURCE: "https://auth.test/resource",
}));

const {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthorizationUrl,
  registerClient,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
} = await import("../../src/lib/oauth.js");

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const HEX_PATTERN = /^[0-9a-f]+$/;

describe("oauth", () => {
  describe("generateCodeVerifier", () => {
    it("returns a base64url string", () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(BASE64URL_PATTERN);
    });

    it("generates unique values", () => {
      const a = generateCodeVerifier();
      const b = generateCodeVerifier();
      expect(a).not.toBe(b);
    });
  });

  describe("generateCodeChallenge", () => {
    it("returns a base64url SHA-256 hash of the verifier", () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);
      expect(challenge).toMatch(BASE64URL_PATTERN);
      expect(challenge).not.toBe(verifier);
    });

    it("is deterministic for the same input", () => {
      const verifier = "test-verifier";
      const a = generateCodeChallenge(verifier);
      const b = generateCodeChallenge(verifier);
      expect(a).toBe(b);
    });
  });

  describe("generateState", () => {
    it("returns a hex string", () => {
      const state = generateState();
      expect(state).toMatch(HEX_PATTERN);
    });

    it("generates unique values", () => {
      const a = generateState();
      const b = generateState();
      expect(a).not.toBe(b);
    });
  });

  describe("buildAuthorizationUrl", () => {
    it("builds URL with all required parameters", () => {
      const url = buildAuthorizationUrl({
        clientId: "client_1",
        redirectUri: "http://localhost:3000/callback",
        codeChallenge: "challenge_abc",
        state: "state_xyz",
      });

      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://auth.test");
      expect(parsed.pathname).toBe("/authorize");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("client_id")).toBe("client_1");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/callback"
      );
      expect(parsed.searchParams.get("code_challenge")).toBe("challenge_abc");
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
      expect(parsed.searchParams.get("state")).toBe("state_xyz");
      expect(parsed.searchParams.get("scope")).toBe("read write");
    });
  });

  describe("registerClient", () => {
    it("sends registration request and returns client_id", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ client_id: "new_client" }), {
          status: 200,
        })
      );

      const clientId = await registerClient("http://localhost:3000/callback");

      expect(clientId).toBe("new_client");
      expect(fetch).toHaveBeenCalledWith(
        "https://auth.test/register",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("throws on registration failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Bad Request", { status: 400 })
      );

      await expect(
        registerClient("http://localhost:3000/callback")
      ).rejects.toThrow("Client registration failed: 400");
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("exchanges code for tokens", async () => {
      const mockTokens = {
        access_token: "at_123",
        refresh_token: "rt_123",
        expires_in: 3600,
        token_type: "Bearer",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockTokens), { status: 200 })
      );

      const tokens = await exchangeCodeForTokens({
        clientId: "client_1",
        code: "auth_code",
        redirectUri: "http://localhost:3000/callback",
        codeVerifier: "verifier",
      });

      expect(tokens).toEqual(mockTokens);
      expect(fetch).toHaveBeenCalledWith(
        "https://auth.test/token",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("throws on exchange failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Unauthorized", { status: 401 })
      );

      await expect(
        exchangeCodeForTokens({
          clientId: "client_1",
          code: "bad_code",
          redirectUri: "http://localhost:3000/callback",
          codeVerifier: "verifier",
        })
      ).rejects.toThrow("Token exchange failed: 401");
    });
  });

  describe("refreshAccessToken", () => {
    it("refreshes with client ID and refresh token", async () => {
      const mockTokens = {
        access_token: "at_new",
        expires_in: 3600,
        token_type: "Bearer",
      };
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockTokens), { status: 200 })
      );

      const tokens = await refreshAccessToken({
        clientId: "client_1",
        refreshToken: "rt_old",
      });

      expect(tokens.access_token).toBe("at_new");
    });

    it("throws on refresh failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Forbidden", { status: 403 })
      );

      await expect(
        refreshAccessToken({
          clientId: "client_1",
          refreshToken: "rt_expired",
        })
      ).rejects.toThrow("Token refresh failed: 403");
    });
  });

  describe("revokeToken", () => {
    it("sends revocation request", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 200 })
      );

      await revokeToken({ clientId: "client_1", token: "rt_abc" });

      expect(fetch).toHaveBeenCalledWith(
        "https://auth.test/revoke",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
