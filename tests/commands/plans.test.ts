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

const { plansCommand } = await import("../../src/commands/plans.js");

const mockPlan = {
  id: "pln_1",
  name: "Free Plan",
  icon: null,
  description: "A free plan",
  image: null,
  status: "ACTIVE",
  isPaid: false,
  memberCount: 10,
  priority: 1,
  copiedToLive: false,
  limitMembers: false,
  memberLimit: null,
  teamAccountsEnabled: false,
  teamAccountUpgradeLink: null,
  teamAccountInviteSignupLink: null,
  restrictToAdmin: false,
  applyLogicToTeamMembers: false,
  prices: [],
  permissions: [],
  redirects: null,
  allowedDomains: [],
  logic: null,
};

describe("plans", () => {
  describe("list", () => {
    it("fetches all plans", async () => {
      graphqlRequest.mockResolvedValueOnce({ getPlans: [mockPlan] });

      await runCommand(plansCommand, ["list"]);

      expect(graphqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining("getPlans"),
          variables: { input: {} },
        })
      );
    });

    it("passes status and orderBy filters", async () => {
      graphqlRequest.mockResolvedValueOnce({ getPlans: [] });

      await runCommand(plansCommand, [
        "list",
        "--status",
        "ACTIVE",
        "--order-by",
        "PRIORITY",
      ]);

      expect(graphqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            input: { status: "ACTIVE", orderBy: "PRIORITY" },
          },
        })
      );
    });

    it("handles null getPlans response", async () => {
      graphqlRequest.mockResolvedValueOnce({ getPlans: null });

      await runCommand(plansCommand, ["list"]);
      // Should not throw — falls back to empty array
    });
  });

  describe("get", () => {
    it("fetches a plan by ID", async () => {
      graphqlRequest.mockResolvedValueOnce({ getPlan: mockPlan });

      await runCommand(plansCommand, ["get", "pln_1"]);

      expect(graphqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { id: "pln_1" },
        })
      );
    });
  });

  describe("create", () => {
    it("sends name and description", async () => {
      graphqlRequest.mockResolvedValueOnce({ createPlan: mockPlan });

      await runCommand(plansCommand, [
        "create",
        "--name",
        "Test",
        "--description",
        "A test plan",
      ]);

      expect(graphqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            input: { name: "Test", description: "A test plan" },
          },
        })
      );
    });

    it("sends optional flags when provided", async () => {
      graphqlRequest.mockResolvedValueOnce({ createPlan: mockPlan });

      await runCommand(plansCommand, [
        "create",
        "--name",
        "Paid",
        "--description",
        "Paid plan",
        "--icon",
        "star",
        "--is-paid",
        "--team-accounts-enabled",
        "--team-account-upgrade-link",
        "https://example.com/upgrade",
        "--team-account-invite-signup-link",
        "https://example.com/invite",
      ]);

      const call = graphqlRequest.mock.calls[0][0];
      expect(call.variables.input).toEqual({
        name: "Paid",
        description: "Paid plan",
        icon: "star",
        isPaid: true,
        teamAccountsEnabled: true,
        teamAccountUpgradeLink: "https://example.com/upgrade",
        teamAccountInviteSignupLink: "https://example.com/invite",
      });
    });
  });

  describe("update", () => {
    it("sends planId and updated fields", async () => {
      graphqlRequest.mockResolvedValueOnce({ updatePlan: mockPlan });

      await runCommand(plansCommand, [
        "update",
        "pln_1",
        "--name",
        "Updated",
        "--status",
        "INACTIVE",
      ]);

      const call = graphqlRequest.mock.calls[0][0];
      expect(call.variables.input).toEqual({
        planId: "pln_1",
        name: "Updated",
        status: "INACTIVE",
      });
    });

    it("rejects when no options provided", async () => {
      const original = process.exitCode;
      await runCommand(plansCommand, ["update", "pln_1"]);

      expect(process.exitCode).toBe(1);
      expect(graphqlRequest).not.toHaveBeenCalled();
      process.exitCode = original;
    });

    it("sends redirects as parsed key-value pairs", async () => {
      graphqlRequest.mockResolvedValueOnce({ updatePlan: mockPlan });

      await runCommand(plansCommand, [
        "update",
        "pln_1",
        "--redirect",
        "afterLogin=/dashboard",
        "--redirect",
        "afterSignup=/welcome",
      ]);

      const call = graphqlRequest.mock.calls[0][0];
      expect(call.variables.input.redirects).toEqual({
        afterLogin: "/dashboard",
        afterSignup: "/welcome",
      });
    });

    it("sends permissionIds", async () => {
      graphqlRequest.mockResolvedValueOnce({ updatePlan: mockPlan });

      await runCommand(plansCommand, [
        "update",
        "pln_1",
        "--permission-id",
        "perm_a",
        "--permission-id",
        "perm_b",
      ]);

      const call = graphqlRequest.mock.calls[0][0];
      expect(call.variables.input.permissionIds).toEqual(["perm_a", "perm_b"]);
    });

    it("sends allowedDomains", async () => {
      graphqlRequest.mockResolvedValueOnce({ updatePlan: mockPlan });

      await runCommand(plansCommand, [
        "update",
        "pln_1",
        "--allowed-domain",
        "example.com",
      ]);

      const call = graphqlRequest.mock.calls[0][0];
      expect(call.variables.input.allowedDomains).toEqual(["example.com"]);
    });

    it("sends boolean toggle flags", async () => {
      graphqlRequest.mockResolvedValueOnce({ updatePlan: mockPlan });

      await runCommand(plansCommand, [
        "update",
        "pln_1",
        "--limit-members",
        "--member-limit",
        "50",
        "--restrict-to-admin",
      ]);

      const call = graphqlRequest.mock.calls[0][0];
      expect(call.variables.input.limitMembers).toBe(true);
      expect(call.variables.input.memberLimit).toBe(50);
      expect(call.variables.input.restrictToAdmin).toBe(true);
    });
  });

  describe("delete", () => {
    it("sends planId", async () => {
      graphqlRequest.mockResolvedValueOnce({ deletePlan: mockPlan });

      await runCommand(plansCommand, ["delete", "pln_1"]);

      expect(graphqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { input: { planId: "pln_1" } },
        })
      );
    });
  });

  describe("order", () => {
    it("parses plan:priority pairs and sends orders", async () => {
      graphqlRequest.mockResolvedValueOnce({ orderPlans: [mockPlan] });

      await runCommand(plansCommand, [
        "order",
        "--plan",
        "pln_a:1",
        "--plan",
        "pln_b:2",
      ]);

      expect(graphqlRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            input: {
              orders: [
                { planId: "pln_a", priority: 1 },
                { planId: "pln_b", priority: 2 },
              ],
            },
          },
        })
      );
    });

    it("handles invalid format gracefully", async () => {
      const original = process.exitCode;
      await runCommand(plansCommand, ["order", "--plan", "invalid"]);
      expect(process.exitCode).toBe(1);
      process.exitCode = original;
    });
  });

  it("handles graphql errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Server error"));

    const original = process.exitCode;
    await runCommand(plansCommand, ["get", "pln_1"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
