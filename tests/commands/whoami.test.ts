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

const { whoamiCommand } = await import("../../src/commands/whoami.js");

describe("whoami", () => {
  it("queries currentApp and currentUser", async () => {
    graphqlRequest.mockResolvedValueOnce({
      currentApp: { id: "app_1", name: "My App", status: "ACTIVE" },
      currentUser: { auth: { email: "test@example.com" } },
    });

    await runCommand(whoamiCommand, []);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("currentApp"),
      })
    );
    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("currentUser"),
      })
    );
  });

  it("handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Unauthorized"));

    const original = process.exitCode;
    await runCommand(whoamiCommand, []);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
