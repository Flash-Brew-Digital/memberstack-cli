import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Command } from "commander";
import pc from "picocolors";
import yoctoSpinner from "yocto-spinner";
import { printError, printSuccess } from "../lib/utils.js";

const execAsync = promisify(exec);

declare const __VERSION__: string | undefined;
const currentVersion = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

const PACKAGE_NAME = "memberstack-cli";
const DISPLAY_NAME = "Memberstack CLI";

type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

const detectPackageManager = (): PackageManager => {
  const scriptPath = process.argv[1] ?? "";
  if (scriptPath.includes("/pnpm/") || scriptPath.includes("/.pnpm/")) {
    return "pnpm";
  }
  if (scriptPath.includes("/yarn/")) {
    return "yarn";
  }
  if (scriptPath.includes("/.bun/") || scriptPath.includes("/bun/")) {
    return "bun";
  }
  return "npm";
};

const getUpdateCommand = (pm: PackageManager): string => {
  switch (pm) {
    case "bun": {
      return `bun install -g ${PACKAGE_NAME}@latest`;
    }
    case "pnpm": {
      return `pnpm add -g ${PACKAGE_NAME}@latest`;
    }
    case "yarn": {
      return `yarn global add ${PACKAGE_NAME}@latest`;
    }
    default: {
      return `npm install -g ${PACKAGE_NAME}@latest`;
    }
  }
};

export const updateCommand = new Command("update")
  .description("Update the Memberstack CLI to the latest version")
  .action(async () => {
    const pm = detectPackageManager();

    process.stderr.write(
      `\n  ${pc.bold("Current version:")} ${currentVersion}\n`
    );
    process.stderr.write(`  ${pc.bold("Package manager:")} ${pm}\n\n`);

    const command = getUpdateCommand(pm);
    const spinner = yoctoSpinner({ text: `Running ${command}...` }).start();

    try {
      await execAsync(command);
      spinner.stop();
      printSuccess(
        `Successfully updated ${DISPLAY_NAME}. Run "memberstack --version" to verify.`
      );
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error
          ? error.message
          : `Failed to update via ${pm}. Try running: ${command}`
      );
      process.exitCode = 1;
    }
  });
