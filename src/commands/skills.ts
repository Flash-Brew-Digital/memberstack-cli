import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { printError, printSuccess } from "../lib/utils.js";

const execAsync = promisify(exec);

const SKILLS_REPO = "Flash-Brew-Digital/memberstack-skills";

const runSkillsCommand = async (args: string[]): Promise<void> => {
  await execAsync(`npx skills ${args.join(" ")}`);
};

export const skillsCommand = new Command("skills")
  .usage("<command> [options]")
  .description("Manage Memberstack skills");

skillsCommand
  .command("add")
  .description("Add a Memberstack skill")
  .argument("<skill>", "Skill name to add")
  .action(async (skill: string) => {
    const spinner = yoctoSpinner({
      text: `Adding agent skill "${skill}" to your project...`,
    }).start();
    try {
      await runSkillsCommand([
        "add",
        SKILLS_REPO,
        "--skill",
        skill,
        "--agent",
        "claude-code",
        "codex",
        "-y",
      ]);
      spinner.stop();
      printSuccess(`Skill "${skill}" added successfully.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error
          ? error.message
          : "Failed to add the agent skill. Please ensure the skill name is correct and try again."
      );
      process.exitCode = 1;
    }
  });

skillsCommand
  .command("remove")
  .description("Remove a Memberstack skill")
  .argument("<skill>", "Skill name to remove")
  .action(async (skill: string) => {
    const spinner = yoctoSpinner({
      text: `Removing agent skill "${skill}" from your project...`,
    }).start();
    try {
      await runSkillsCommand([
        "remove",
        "--skill",
        skill,
        "--agent",
        "claude-code",
        "codex",
        "-y",
      ]);
      spinner.stop();
      printSuccess(`Skill "${skill}" removed successfully.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error
          ? error.message
          : "Failed to remove the agent skill. Please ensure the skill name is correct and try again."
      );
      process.exitCode = 1;
    }
  });
