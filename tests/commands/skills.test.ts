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

const { skillsCommand } = await import("../../src/commands/skills.js");

describe("skills", () => {
  it("add runs npx skills add with correct arguments", async () => {
    execAsync.mockResolvedValueOnce({ stdout: "", stderr: "" });

    await runCommand(skillsCommand, ["add", "memberstack-cli"]);

    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        "npx skills add Flash-Brew-Digital/memberstack-skills --skill memberstack-cli --agent claude-code codex -y"
      )
    );
  });

  it("remove runs npx skills remove with correct arguments", async () => {
    execAsync.mockResolvedValueOnce({ stdout: "", stderr: "" });

    await runCommand(skillsCommand, ["remove", "memberstack-cli"]);

    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining(
        "npx skills remove --skill memberstack-cli --agent claude-code codex -y"
      )
    );
  });

  it("add handles errors gracefully", async () => {
    execAsync.mockRejectedValueOnce(new Error("Command failed"));

    const original = process.exitCode;
    await runCommand(skillsCommand, ["add", "bad-skill"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });

  it("remove handles errors gracefully", async () => {
    execAsync.mockRejectedValueOnce(new Error("Command failed"));

    const original = process.exitCode;
    await runCommand(skillsCommand, ["remove", "bad-skill"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = original;
  });
});
