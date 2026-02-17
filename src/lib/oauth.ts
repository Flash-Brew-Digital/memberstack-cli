import { createHash, randomBytes } from "node:crypto";
import {
  OAUTH_AUTHORIZATION_ENDPOINT,
  OAUTH_REGISTRATION_ENDPOINT,
  OAUTH_RESOURCE,
  OAUTH_REVOCATION_ENDPOINT,
  OAUTH_TOKEN_ENDPOINT,
} from "./constants.js";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface RegistrationResponse {
  client_id: string;
  client_secret?: string;
}

interface AuthorizationUrlParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}

interface ExchangeParams {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}

interface RefreshParams {
  clientId: string;
  refreshToken: string;
}

interface RevokeParams {
  clientId: string;
  token: string;
}

const TRAILING_EQUALS = /=+$/;

const base64url = (buffer: Buffer): string =>
  buffer.toString("base64url").replace(TRAILING_EQUALS, "");

export const generateCodeVerifier = (): string => base64url(randomBytes(32));

export const generateCodeChallenge = (verifier: string): string => {
  const hash = createHash("sha256").update(verifier).digest();
  return base64url(hash);
};

export const generateState = (): string => randomBytes(16).toString("hex");

export const buildAuthorizationUrl = ({
  clientId,
  redirectUri,
  codeChallenge,
  state,
}: AuthorizationUrlParams): string => {
  const url = new URL(OAUTH_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "read write");
  url.searchParams.set("resource", OAUTH_RESOURCE);
  return url.toString();
};

export const registerClient = async (redirectUri: string): Promise<string> => {
  const response = await fetch(OAUTH_REGISTRATION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Memberstack CLI",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "read write",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Client registration failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as RegistrationResponse;
  return data.client_id;
};

export const exchangeCodeForTokens = async ({
  clientId,
  code,
  redirectUri,
  codeVerifier,
}: ExchangeParams): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    resource: OAUTH_RESOURCE,
  });

  const response = await fetch(OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  return (await response.json()) as TokenResponse;
};

export const refreshAccessToken = async ({
  clientId,
  refreshToken,
}: RefreshParams): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
    resource: OAUTH_RESOURCE,
  });

  const response = await fetch(OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  return (await response.json()) as TokenResponse;
};

export const revokeToken = async ({
  clientId,
  token,
}: RevokeParams): Promise<void> => {
  const body = new URLSearchParams({
    client_id: clientId,
    token,
  });

  await fetch(OAUTH_REVOCATION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
};
