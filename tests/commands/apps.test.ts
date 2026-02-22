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

const { appsCommand } = await import("../../src/commands/apps.js");

describe("apps", () => {
  it("current fetches and prints the current app", async () => {
    const app = { id: "app_1", name: "My App", status: "ACTIVE" };
    graphqlRequest.mockResolvedValueOnce({ currentApp: app });

    await runCommand(appsCommand, ["current"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining("currentApp"),
      })
    );
  });

  it("create sends name and stack", async () => {
    const app = { id: "app_2", name: "New App", status: "ACTIVE" };
    graphqlRequest.mockResolvedValueOnce({ createApp: app });

    await runCommand(appsCommand, [
      "create",
      "--name",
      "New App",
      "--stack",
      "REACT",
    ]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: expect.objectContaining({ name: "New App", stack: "REACT" }),
        },
      })
    );
  });

  it("update sends only provided fields", async () => {
    const app = { id: "app_1", name: "Renamed", status: "ACTIVE" };
    graphqlRequest.mockResolvedValueOnce({ updateApp: app });

    await runCommand(appsCommand, ["update", "--name", "Renamed"]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input).toEqual({ name: "Renamed" });
  });

  it("update with no options sets exit code 1", async () => {
    const original = process.exitCode;
    await runCommand(appsCommand, ["update"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("delete sends appId", async () => {
    const app = { id: "app_1", name: "Deleted App" };
    graphqlRequest.mockResolvedValueOnce({ deleteApp: app });

    await runCommand(appsCommand, ["delete", "--app-id", "app_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { appId: "app_1" } },
      })
    );
  });

  it("restore sends appId", async () => {
    const app = { id: "app_1", name: "Restored App" };
    graphqlRequest.mockResolvedValueOnce({ restoreApp: app });

    await runCommand(appsCommand, ["restore", "--app-id", "app_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { appId: "app_1" } },
      })
    );
  });

  it("create sends optional wordpress and template fields", async () => {
    const app = { id: "app_3", name: "WP App", status: "ACTIVE" };
    graphqlRequest.mockResolvedValueOnce({ createApp: app });

    await runCommand(appsCommand, [
      "create",
      "--name",
      "WP App",
      "--stack",
      "WORDPRESS",
      "--wordpress-page-builder",
      "ELEMENTOR",
      "--template-id",
      "tmpl_1",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.wordpressPageBuilder).toBe("ELEMENTOR");
    expect(call.variables.input.templateId).toBe("tmpl_1");
  });

  it("update sends boolean and numeric fields", async () => {
    const app = { id: "app_1", name: "My App", status: "ACTIVE" };
    graphqlRequest.mockResolvedValueOnce({ updateApp: app });

    await runCommand(appsCommand, [
      "update",
      "--captcha-enabled",
      "--prevent-disposable-emails",
      "--require-user-2fa",
      "--disable-concurrent-logins",
      "--member-session-duration-days",
      "30",
      "--allow-member-self-delete",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.captchaEnabled).toBe(true);
    expect(call.variables.input.preventDisposableEmails).toBe(true);
    expect(call.variables.input.requireUser2FA).toBe(true);
    expect(call.variables.input.disableConcurrentLogins).toBe(true);
    expect(call.variables.input.memberSessionDurationDays).toBe(30);
    expect(call.variables.input.allowMemberSelfDelete).toBe(true);
  });

  it("update sends stack, status, and business fields", async () => {
    const app = { id: "app_1", name: "My App", status: "ACTIVE" };
    graphqlRequest.mockResolvedValueOnce({ updateApp: app });

    await runCommand(appsCommand, [
      "update",
      "--stack",
      "WEBFLOW",
      "--status",
      "ACTIVE",
      "--business-entity-name",
      "Acme Inc",
      "--terms-of-service-url",
      "https://example.com/tos",
      "--privacy-policy-url",
      "https://example.com/privacy",
      "--wordpress-page-builder",
      "GUTENBERG",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.stack).toBe("WEBFLOW");
    expect(call.variables.input.status).toBe("ACTIVE");
    expect(call.variables.input.businessEntityName).toBe("Acme Inc");
    expect(call.variables.input.termsOfServiceURL).toBe(
      "https://example.com/tos"
    );
    expect(call.variables.input.privacyPolicyURL).toBe(
      "https://example.com/privacy"
    );
    expect(call.variables.input.wordpressPageBuilder).toBe("GUTENBERG");
  });

  it("create handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Validation error"));

    const original = process.exitCode;
    await runCommand(appsCommand, [
      "create",
      "--name",
      "Bad",
      "--stack",
      "REACT",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("update handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Update failed"));

    const original = process.exitCode;
    await runCommand(appsCommand, ["update", "--name", "Test"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("delete handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Not found"));

    const original = process.exitCode;
    await runCommand(appsCommand, ["delete", "--app-id", "app_bad"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("restore handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Cannot restore"));

    const original = process.exitCode;
    await runCommand(appsCommand, ["restore", "--app-id", "app_bad"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("handles non-Error exceptions", async () => {
    graphqlRequest.mockRejectedValueOnce("string error");

    const original = process.exitCode;
    await runCommand(appsCommand, ["current"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
