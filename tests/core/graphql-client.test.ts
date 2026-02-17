import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/constants.js", () => ({
  GRAPHQL_BASE_URL: "https://api.test/graphql",
}));

vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({}) },
}));

const getValidAccessToken = vi.fn();
const getAppId = vi.fn();
vi.mock("../../src/lib/token-storage.js", () => ({
  getValidAccessToken: () => getValidAccessToken(),
  getAppId: () => getAppId(),
}));

const { graphqlRequest } = await import("../../src/lib/graphql-client.js");

describe("graphqlRequest", () => {
  it("sends query with auth headers", async () => {
    getValidAccessToken.mockResolvedValueOnce("at_123");
    getAppId.mockResolvedValueOnce("app_1");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { currentApp: { id: "app_1" } } }), {
        status: 200,
      })
    );

    const result = await graphqlRequest<{ currentApp: { id: string } }>({
      query: "query { currentApp { id } }",
    });

    expect(result.currentApp.id).toBe("app_1");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.test/graphql?mode=sandbox",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer at_123",
          "ms-app-id": "app_1",
        }),
      })
    );
  });

  it("passes variables in the request body", async () => {
    getValidAccessToken.mockResolvedValueOnce("at_123");
    getAppId.mockResolvedValueOnce("app_1");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { getPlan: { id: "pln_1" } } }), {
        status: 200,
      })
    );

    await graphqlRequest({
      query: "query($id: ID!) { getPlan(id: $id) { id } }",
      variables: { id: "pln_1" },
    });

    const body = JSON.parse(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.variables).toEqual({ id: "pln_1" });
  });

  it("throws when not authenticated", async () => {
    getValidAccessToken.mockResolvedValueOnce(null);

    await expect(
      graphqlRequest({ query: "query { currentApp { id } }" })
    ).rejects.toThrow("Not authenticated");
  });

  it("throws when no app ID", async () => {
    getValidAccessToken.mockResolvedValueOnce("at_123");
    getAppId.mockResolvedValueOnce(null);

    await expect(
      graphqlRequest({ query: "query { currentApp { id } }" })
    ).rejects.toThrow("No app ID found");
  });

  it("throws on GraphQL errors in response body", async () => {
    getValidAccessToken.mockResolvedValueOnce("at_123");
    getAppId.mockResolvedValueOnce("app_1");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [{ message: "Field not found" }],
        }),
        { status: 200 }
      )
    );

    await expect(graphqlRequest({ query: "query { bad }" })).rejects.toThrow(
      "GraphQL error: Field not found"
    );
  });

  it("throws on HTTP errors with GraphQL error messages", async () => {
    getValidAccessToken.mockResolvedValueOnce("at_123");
    getAppId.mockResolvedValueOnce("app_1");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [{ message: "Unauthorized" }],
        }),
        { status: 401 }
      )
    );

    await expect(
      graphqlRequest({ query: "query { currentApp { id } }" })
    ).rejects.toThrow("GraphQL error (401): Unauthorized");
  });

  it("throws on HTTP errors without GraphQL body", async () => {
    getValidAccessToken.mockResolvedValueOnce("at_123");
    getAppId.mockResolvedValueOnce("app_1");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 500 })
    );

    await expect(
      graphqlRequest({ query: "query { currentApp { id } }" })
    ).rejects.toThrow("GraphQL request failed with status 500");
  });

  it("throws when response has no data", async () => {
    getValidAccessToken.mockResolvedValueOnce("at_123");
    getAppId.mockResolvedValueOnce("app_1");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );

    await expect(
      graphqlRequest({ query: "query { currentApp { id } }" })
    ).rejects.toThrow("GraphQL response contained no data");
  });
});
