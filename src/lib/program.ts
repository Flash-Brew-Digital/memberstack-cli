import { Command } from "commander";

export const program = new Command();

program
  .name("Memberstack CLI")
  .description("Manage your Memberstack account from the terminal.")
  .version("0.0.0")
  .option("-j, --json", "Output raw JSON instead of formatted tables")
  .option("--live", "Use live environment instead of sandbox");
