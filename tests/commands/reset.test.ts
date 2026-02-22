import { describe, expect, it, vi } from "vitest";
import { runCommand } from "./helpers.js";

vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({}) },
}));

const mockRm = vi.fn();
vi.mock("node:fs/promises", () => ({
  rm: (...args: unknown[]) => mockRm(...args),
}));

const mockClearTokens = vi.fn();
vi.mock("../../src/lib/token-storage.js", () => ({
  clearTokens: () => mockClearTokens(),
}));

let mockAnswer = "y";
vi.mock("node:readline", () => ({
  createInterface: () => ({
    question: (_msg: string, cb: (answer: string) => void) => {
      cb(mockAnswer);
    },
    close: vi.fn(),
  }),
}));

const { resetCommand } = await import("../../src/commands/reset.js");

describe("reset", () => {
  it("skips confirmation with --force", async () => {
    mockRm.mockResolvedValue(undefined);
    mockClearTokens.mockResolvedValueOnce(undefined);

    await runCommand(resetCommand, ["--force"]);

    expect(mockRm).toHaveBeenCalledTimes(2);
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("aborts when user answers no", async () => {
    mockAnswer = "n";
    mockRm.mockReset();
    mockClearTokens.mockReset();

    await runCommand(resetCommand, []);

    expect(mockRm).not.toHaveBeenCalled();
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it("proceeds when user answers yes", async () => {
    mockAnswer = "y";
    mockRm.mockReset();
    mockRm.mockResolvedValue(undefined);
    mockClearTokens.mockReset();
    mockClearTokens.mockResolvedValueOnce(undefined);

    await runCommand(resetCommand, []);

    expect(mockRm).toHaveBeenCalledTimes(2);
    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("aborts on empty answer (no default)", async () => {
    mockAnswer = "";
    mockRm.mockReset();
    mockClearTokens.mockReset();

    await runCommand(resetCommand, []);

    expect(mockRm).not.toHaveBeenCalled();
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it("handles missing files gracefully", async () => {
    mockRm.mockReset();
    mockRm.mockRejectedValue(new Error("ENOENT"));
    mockClearTokens.mockReset();
    mockClearTokens.mockResolvedValueOnce(undefined);

    await runCommand(resetCommand, ["--force"]);

    expect(mockClearTokens).toHaveBeenCalled();
  });

  it("handles unexpected errors", async () => {
    mockRm.mockReset();
    mockRm.mockResolvedValue(undefined);
    mockClearTokens.mockReset();
    mockClearTokens.mockRejectedValueOnce(new Error("Disk error"));

    const original = process.exitCode;
    await runCommand(resetCommand, ["--force"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
