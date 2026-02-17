import { Command } from "commander";
import { vi } from "vitest";

/**
 * Creates a fresh parent program with --json and --live flags,
 * adds the given command, and parses the provided args.
 */
export const runCommand = async (
  command: Command,
  args: string[]
): Promise<void> => {
  const program = new Command();
  program.option("--json", "Output as JSON");
  program.option("--live", "Use live mode");
  program.exitOverride();
  program.addCommand(command);
  await program.parseAsync(["node", "test", command.name(), ...args]);
};

export const createMockSpinner = () => {
  const spinner: Record<string, unknown> = { text: "" };
  spinner.start = vi.fn(() => spinner);
  spinner.stop = vi.fn(() => spinner);
  return spinner;
};
