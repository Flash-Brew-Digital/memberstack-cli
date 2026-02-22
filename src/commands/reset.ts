import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { Command } from "commander";
import pc from "picocolors";
import { clearTokens } from "../lib/token-storage.js";
import { printError, printSuccess } from "../lib/utils.js";

const FILES_TO_DELETE = ["members.json", "members.csv"];

const confirm = (message: string): Promise<boolean> =>
  new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    rl.question(message, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });

const tryDelete = async (filePath: string): Promise<boolean> => {
  try {
    await rm(filePath);
    return true;
  } catch {
    return false;
  }
};

export const resetCommand = new Command("reset")
  .description("Delete local data files and clear authentication")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (opts: { force?: boolean }) => {
    if (!opts.force) {
      process.stderr.write("\n");
      process.stderr.write(`  ${pc.bold("This will:")}\n`);
      process.stderr.write(
        `    - Delete ${FILES_TO_DELETE.join(", ")} (if present)\n`
      );
      process.stderr.write("    - Clear stored authentication tokens\n");
      process.stderr.write("\n");

      const proceed = await confirm(`  ${pc.bold("Continue?")} (y/n) `);
      if (!proceed) {
        process.stderr.write("\n  Aborted.\n\n");
        return;
      }
      process.stderr.write("\n");
    }

    try {
      const results: string[] = [];

      for (const file of FILES_TO_DELETE) {
        const fullPath = resolve(file);
        const deleted = await tryDelete(fullPath);
        if (deleted) {
          results.push(`Deleted ${file}`);
        }
      }

      await clearTokens();
      results.push("Cleared authentication tokens");

      for (const result of results) {
        printSuccess(`  ${result}`);
      }

      if (results.length === 1) {
        process.stderr.write(
          `\n  ${pc.dim("No local data files found to delete.")}\n`
        );
      }

      process.stderr.write("\n");
    } catch (error) {
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
