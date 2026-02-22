import { describe, expect, it, vi } from "vitest";
import { createMockSpinner, runCommand } from "./helpers.js";

vi.mock("yocto-spinner", () => ({ default: () => createMockSpinner() }));
vi.mock("../../src/lib/program.js", () => ({
  program: { opts: () => ({}) },
}));

const execAsync = vi.fn();
vi.mock("node:child_process", () => ({
  exec: (...args: unknown[]) => {
    const cb = args.at(-1) as (
      err: Error | null,
      result: { stdout: string; stderr: string }
    ) => void;
    const promise = execAsync(args[0]);
    promise
      .then(() => cb(null, { stdout: "", stderr: "" }))
      .catch((err: Error) => cb(err, { stdout: "", stderr: "" }));
  },
}));

const { updateCommand } = await import("../../src/commands/update.js");

describe("update", () => {
  it("runs npm install -g by default", async () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] = "/usr/local/lib/node_modules/.bin/memberstack";
    execAsync.mockResolvedValueOnce({ stdout: "", stderr: "" });

    await runCommand(updateCommand, []);

    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining("npm install -g memberstack-cli@latest")
    );
    process.argv[1] = originalArgv1;
  });

  it("detects pnpm from script path", async () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] =
      "/home/user/.local/share/pnpm/global/5/node_modules/.bin/memberstack";
    execAsync.mockResolvedValueOnce({ stdout: "", stderr: "" });

    await runCommand(updateCommand, []);

    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining("pnpm add -g memberstack-cli@latest")
    );
    process.argv[1] = originalArgv1;
  });

  it("detects yarn from script path", async () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] =
      "/home/user/.config/yarn/global/node_modules/.bin/memberstack";
    execAsync.mockResolvedValueOnce({ stdout: "", stderr: "" });

    await runCommand(updateCommand, []);

    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining("yarn global add memberstack-cli@latest")
    );
    process.argv[1] = originalArgv1;
  });

  it("detects bun from script path", async () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] =
      "/home/user/.bun/install/global/node_modules/.bin/memberstack";
    execAsync.mockResolvedValueOnce({ stdout: "", stderr: "" });

    await runCommand(updateCommand, []);

    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining("bun install -g memberstack-cli@latest")
    );
    process.argv[1] = originalArgv1;
  });

  it("handles update failure", async () => {
    execAsync.mockRejectedValueOnce(new Error("Permission denied"));

    const original = process.exitCode;
    await runCommand(updateCommand, []);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
