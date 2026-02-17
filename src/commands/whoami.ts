import { Command } from "commander";
import pc from "picocolors";
import { graphqlRequest } from "../lib/graphql-client.js";
import { printError } from "../lib/utils.js";

export const whoamiCommand = new Command("whoami")
  .description("Show current authenticated identity")
  .action(async () => {
    try {
      const result = await graphqlRequest<{
        currentApp: { id: string; name: string; status: string };
        currentUser: { auth: { email: string } };
      }>({
        query: `query {
          currentApp { id name status }
          currentUser { auth { email } }
        }`,
      });

      process.stderr.write("\n");
      process.stderr.write(
        `  ${pc.bold("App:")}   ${result.currentApp.name} (${result.currentApp.id})\n`
      );
      process.stderr.write(
        `  ${pc.bold("Status:")} ${result.currentApp.status}\n`
      );
      process.stderr.write(
        `  ${pc.bold("User:")}  ${result.currentUser.auth.email}\n`
      );
      process.stderr.write("\n");
    } catch (error) {
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
