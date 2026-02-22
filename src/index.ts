if (process.argv.includes("--no-color") || process.env.NO_COLOR) {
  process.env.NO_COLOR = "1";
}

import pc from "picocolors";
import { appsCommand } from "./commands/apps.js";
import { authCommand } from "./commands/auth.js";
import { customFieldsCommand } from "./commands/custom-fields.js";
import { membersCommand } from "./commands/members.js";
import { permissionsCommand } from "./commands/permissions.js";
import { plansCommand } from "./commands/plans.js";
import { pricesCommand } from "./commands/prices.js";
import { providersCommand } from "./commands/providers.js";
import { recordsCommand } from "./commands/records.js";
import { skillsCommand } from "./commands/skills.js";
import { tablesCommand } from "./commands/tables.js";
import { usersCommand } from "./commands/users.js";
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

if (!(process.argv.includes("--quiet") || process.argv.includes("-q"))) {
  process.stderr.write(`${banner}\n`);
}

program.action(() => program.help());
program.addCommand(appsCommand);
program.addCommand(authCommand);
program.addCommand(whoamiCommand);
program.addCommand(membersCommand);
program.addCommand(permissionsCommand);
program.addCommand(plansCommand);
program.addCommand(pricesCommand);
program.addCommand(tablesCommand);
program.addCommand(recordsCommand);
program.addCommand(customFieldsCommand);
program.addCommand(usersCommand);
program.addCommand(providersCommand);
program.addCommand(skillsCommand);

await program.parseAsync();
