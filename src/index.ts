import pc from "picocolors";
import { appsCommand } from "./commands/apps.js";
import { authCommand } from "./commands/auth.js";
import { customFieldsCommand } from "./commands/custom-fields.js";
import { membersCommand } from "./commands/members.js";
import { plansCommand } from "./commands/plans.js";
import { recordsCommand } from "./commands/records.js";
import { tablesCommand } from "./commands/tables.js";
import { whoamiCommand } from "./commands/whoami.js";
import { program } from "./lib/program.js";

const banner = [
  "",
  pc.bold(
    pc.cyan(
      "███╗   ███╗███████╗███╗   ███╗██████╗ ███████╗██████╗ ███████╗████████╗ █████╗  ██████╗██╗  ██╗"
    )
  ),
  pc.bold(
    pc.cyan(
      "████╗ ████║██╔════╝████╗ ████║██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝"
    )
  ),
  pc.bold(
    pc.cyan(
      "██╔████╔██║█████╗  ██╔████╔██║██████╔╝█████╗  ██████╔╝███████╗   ██║   ███████║██║     █████╔╝ "
    )
  ),
  pc.bold(
    pc.cyan(
      "██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██╔══██╗██╔══╝  ██╔══██╗╚════██║   ██║   ██╔══██║██║     ██╔═██╗ "
    )
  ),
  pc.bold(
    pc.cyan(
      "██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║██████╔╝███████╗██║  ██║███████║   ██║   ██║  ██║╚██████╗██║  ██╗"
    )
  ),
  pc.bold(
    pc.cyan(
      "╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝"
    )
  ),
  "",
].join("\n");

process.stderr.write(`${banner}\n`);

program.addCommand(appsCommand);
program.addCommand(authCommand);
program.addCommand(whoamiCommand);
program.addCommand(membersCommand);
program.addCommand(plansCommand);
program.addCommand(tablesCommand);
program.addCommand(recordsCommand);
program.addCommand(customFieldsCommand);

await program.parseAsync();
