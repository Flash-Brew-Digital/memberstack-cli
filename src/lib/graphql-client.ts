import { GRAPHQL_BASE_URL } from "./constants.js";
import { program } from "./program.js";
import { getAppId, getValidAccessToken } from "./token-storage.js";

interface GraphqlRequestOptions {
  query: string;
  variables?: Record<string, unknown>;
}

interface GraphqlError {
  message: string;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: GraphqlError[];
}

export const graphqlRequest = async <T>(
  options: GraphqlRequestOptions
): Promise<T> => {
  const { query, variables } = options;

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error(
      'Not authenticated. Run "auth login" first to connect your Memberstack account.'
    );
  }

  const appId = await getAppId();
  if (!appId) {
    throw new Error(
      'No app ID found in stored credentials. Try logging in again with "auth login".'
    );
  }

  const mode: string = program.opts().mode;
  const endpoint = `${GRAPHQL_BASE_URL}?mode=${mode}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "ms-app-id": appId,
    "ms-mode": mode,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as GraphqlResponse<T>;

  if (!response.ok) {
    if (body.errors?.length) {
      const messages = body.errors.map((e) => e.message).join("; ");
      throw new Error(`GraphQL error (${response.status}): ${messages}`);
    }
    throw new Error(`GraphQL request failed with status ${response.status}`);
  }

  if (body.errors?.length) {
    const messages = body.errors.map((e) => e.message).join("; ");
    throw new Error(`GraphQL error: ${messages}`);
  }

  if (!body.data) {
    throw new Error("GraphQL response contained no data");
  }

  return body.data;
};
