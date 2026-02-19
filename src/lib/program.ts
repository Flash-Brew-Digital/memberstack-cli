import { Command } from "commander";

declare const __VERSION__: string | undefined;
const version = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

export const program = new Command();

program
  .name("memberstack")
  .usage("<command> [subcommand] [params] [options]")
  .description("Manage your Memberstack account from the terminal.")
  .version(version)
  .option("-j, --json", "Output raw JSON instead of formatted tables")
  .option("--live", "Use live environment instead of sandbox")
  .addHelpText(
    "after",
    `
Examples:
  $ memberstack auth login
  $ memberstack members list --json
  $ memberstack plans create --name "Pro Plan"
  $ memberstack records find users --where "status equals active"
  $ memberstack skills add memberstack-cli`
  );
