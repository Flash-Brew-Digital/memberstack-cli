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

const { pricesCommand } = await import("../../src/commands/prices.js");

const mockPrice = {
  id: "prc_1",
  name: "Monthly",
  status: "ACTIVE",
  active: true,
  amount: 9.99,
  type: "SUBSCRIPTION",
  currency: "usd",
  memberCount: 0,
};

describe("prices", () => {
  it("create sends required fields", async () => {
    graphqlRequest.mockResolvedValueOnce({ createPrice: mockPrice });

    await runCommand(pricesCommand, [
      "create",
      "--plan-id",
      "pln_1",
      "--name",
      "Monthly",
      "--amount",
      "9.99",
      "--type",
      "SUBSCRIPTION",
      "--currency",
      "usd",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.planId).toBe("pln_1");
    expect(call.variables.input.name).toBe("Monthly");
    expect(call.variables.input.amount).toBe(9.99);
    expect(call.variables.input.type).toBe("SUBSCRIPTION");
    expect(call.variables.input.currency).toBe("usd");
  });

  it("create sends optional fields", async () => {
    graphqlRequest.mockResolvedValueOnce({ createPrice: mockPrice });

    await runCommand(pricesCommand, [
      "create",
      "--plan-id",
      "pln_1",
      "--name",
      "Monthly",
      "--amount",
      "9.99",
      "--type",
      "SUBSCRIPTION",
      "--interval-type",
      "MONTHLY",
      "--interval-count",
      "1",
      "--free-trial-enabled",
      "--free-trial-days",
      "14",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.intervalType).toBe("MONTHLY");
    expect(call.variables.input.intervalCount).toBe(1);
    expect(call.variables.input.freeTrialEnabled).toBe(true);
    expect(call.variables.input.freeTrialDays).toBe(14);
  });

  it("update sends priceId and fields", async () => {
    graphqlRequest.mockResolvedValueOnce({ updatePrice: mockPrice });

    await runCommand(pricesCommand, [
      "update",
      "prc_1",
      "--name",
      "Updated",
      "--amount",
      "19.99",
    ]);

    const call = graphqlRequest.mock.calls[0][0];
    expect(call.variables.input.priceId).toBe("prc_1");
    expect(call.variables.input.name).toBe("Updated");
    expect(call.variables.input.amount).toBe(19.99);
  });

  it("update rejects with no options", async () => {
    const original = process.exitCode;
    await runCommand(pricesCommand, ["update", "prc_1"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("activate sends priceId", async () => {
    graphqlRequest.mockResolvedValueOnce({ reactivatePrice: mockPrice });

    await runCommand(pricesCommand, ["activate", "prc_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { priceId: "prc_1" } },
      })
    );
  });

  it("deactivate sends priceId", async () => {
    graphqlRequest.mockResolvedValueOnce({ deactivatePrice: mockPrice });

    await runCommand(pricesCommand, ["deactivate", "prc_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { priceId: "prc_1" } },
      })
    );
  });

  it("delete sends priceId", async () => {
    graphqlRequest.mockResolvedValueOnce({ deletePrice: mockPrice });

    await runCommand(pricesCommand, ["delete", "prc_1"]);

    expect(graphqlRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { priceId: "prc_1" } },
      })
    );
  });

  it("handles errors gracefully", async () => {
    graphqlRequest.mockRejectedValueOnce(new Error("Stripe error"));

    const original = process.exitCode;
    await runCommand(pricesCommand, [
      "create",
      "--plan-id",
      "pln_1",
      "--name",
      "Test",
      "--amount",
      "5",
      "--type",
      "ONETIME",
    ]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
