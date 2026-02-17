import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { TOKEN_STORAGE_DIR, TOKEN_STORAGE_FILE } from "./constants.js";
import { refreshAccessToken, type TokenResponse } from "./oauth.js";

export interface StoredTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  client_id: string;
  app_id?: string;
}

interface JwtPayload {
  appId?: string;
}

const parseAppIdFromToken = (accessToken: string): string | undefined => {
  const parts = accessToken.split(".");
  if (parts.length < 2) {
    return undefined;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    ) as JwtPayload;
    return payload.appId;
  } catch {
    return undefined;
  }
};

const getTokenStorageDir = (): string => join(homedir(), TOKEN_STORAGE_DIR);

const getTokenStoragePath = (): string =>
  join(getTokenStorageDir(), TOKEN_STORAGE_FILE);

export const saveTokens = async (
  tokens: TokenResponse,
  clientId: string
): Promise<void> => {
  const dir = getTokenStorageDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });

  const data: StoredTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
    client_id: clientId,
    app_id: parseAppIdFromToken(tokens.access_token),
  };

  await writeFile(getTokenStoragePath(), JSON.stringify(data, null, 2), {
    mode: 0o600,
  });
};

export const loadTokens = async (): Promise<StoredTokens | null> => {
  try {
    const content = await readFile(getTokenStoragePath(), "utf-8");
    return JSON.parse(content) as StoredTokens;
  } catch {
    return null;
  }
};

export const clearTokens = async (): Promise<void> => {
  try {
    await rm(getTokenStoragePath());
  } catch {
    // File may not exist, that's fine
  }
};

export const getValidAccessToken = async (): Promise<string | null> => {
  const tokens = await loadTokens();
  if (!tokens) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = 60;

  if (tokens.expires_at > now + bufferSeconds) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    return null;
  }

  try {
    const refreshed = await refreshAccessToken({
      clientId: tokens.client_id,
      refreshToken: tokens.refresh_token,
    });

    await saveTokens(refreshed, tokens.client_id);
    return refreshed.access_token;
  } catch {
    return null;
  }
};

export const getAppId = async (): Promise<string | null> => {
  const tokens = await loadTokens();
  return tokens?.app_id ?? null;
};
