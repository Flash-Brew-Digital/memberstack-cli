import { Command, Help, Option } from "commander";

declare const __VERSION__: string | undefined;
const version = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

export const program = new Command();

program
  .name("memberstack")
  .usage("<command> [subcommand] [params] [options]")
  .description("Manage your Memberstack account from the terminal.")
  .version(version)
  .configureHelp({
    visibleOptions(cmd: Command) {
      const opts = Help.prototype.visibleOptions.call(this, cmd);
      const help = opts.find((o) => o.long === "--help");
      const rest = opts.filter((o) => o.long !== "--help");
      return help ? [help, ...rest] : opts;
    },
  })
  .addOption(
    new Option("-j, --json", "Output raw JSON instead of formatted tables").env(
      "MEMBERSTACK_JSON"
    )
  )
  .option("-q, --quiet", "Suppress banner and non-essential output")
  .option("--no-color", "Disable color output")
  .addOption(
    new Option("--mode <mode>", "Set environment mode")
      .choices(["sandbox", "live"])
      .default("sandbox")
      .env("MEMBERSTACK_MODE")
  )
  .addOption(
    new Option("--live", "Shorthand for --mode live").conflicts("sandbox")
  )
  .addOption(
    new Option("--sandbox", "Shorthand for --mode sandbox").conflicts("live")
  )
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.live) {
      thisCommand.setOptionValueWithSource("mode", "live", "cli");
    } else if (opts.sandbox) {
      thisCommand.setOptionValueWithSource("mode", "sandbox", "cli");
    }
  })
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
