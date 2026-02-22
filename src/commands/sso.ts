import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { graphqlRequest } from "../lib/graphql-client.js";
import {
  printError,
  printRecord,
  printSuccess,
  printTable,
} from "../lib/utils.js";

interface SSOApp {
  clientId: string;
  clientSecret: string;
  id: string;
  name: string;
  redirectUris: string[];
}

const SSO_APP_FIELDS = `
  id
  name
  clientId
  clientSecret
  redirectUris
`;

const collect = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

export const ssoCommand = new Command("sso")
  .usage("<command> [options]")
  .description("Manage SSO apps");

ssoCommand
  .command("list")
  .description("List all SSO apps")
  .action(async () => {
    const spinner = yoctoSpinner({ text: "Fetching SSO apps..." }).start();
    try {
      const result = await graphqlRequest<{
        getSSOApps: SSOApp[];
      }>({
        query: `query { getSSOApps { ${SSO_APP_FIELDS} } }`,
      });
      spinner.stop();
      const rows = result.getSSOApps.map((app) => ({
        id: app.id,
        name: app.name,
        clientId: app.clientId,
      }));
      printTable(rows);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

ssoCommand
  .command("create")
  .description("Create an SSO app")
  .requiredOption("--name <name>", "App name")
  .requiredOption(
    "--redirect-uri <uri>",
    "Redirect URI (repeatable)",
    collect,
    []
  )
  .action(async (opts: { name: string; redirectUri: string[] }) => {
    if (opts.redirectUri.length === 0) {
      printError("At least one --redirect-uri is required.");
      process.exitCode = 1;
      return;
    }
    const spinner = yoctoSpinner({ text: "Creating SSO app..." }).start();
    try {
      const result = await graphqlRequest<{
        createSSOApp: SSOApp;
      }>({
        query: `mutation($input: CreateSSOAppInput!) {
  createSSOApp(input: $input) {
    ${SSO_APP_FIELDS}
  }
}`,
        variables: {
          input: { name: opts.name, redirectUris: opts.redirectUri },
        },
      });
      spinner.stop();
      printSuccess("SSO app created successfully.");
      printRecord(result.createSSOApp);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

ssoCommand
  .command("update")
  .description("Update an SSO app")
  .argument("<id>", "SSO app ID")
  .option("--name <name>", "App name")
  .option("--redirect-uri <uri>", "Redirect URI (repeatable)", collect, [])
  .action(
    async (id: string, opts: { name?: string; redirectUri: string[] }) => {
      const input: Record<string, unknown> = { id };
      if (opts.name) {
        input.name = opts.name;
      }
      if (opts.redirectUri.length > 0) {
        input.redirectUris = opts.redirectUri;
      }

      if (Object.keys(input).length <= 1) {
        printError(
          "No update options provided. Use --help to see available options."
        );
        process.exitCode = 1;
        return;
      }

      const spinner = yoctoSpinner({ text: "Updating SSO app..." }).start();
      try {
        const result = await graphqlRequest<{
          updateSSOApp: SSOApp;
        }>({
          query: `mutation($input: UpdateSSOAppInput!) {
  updateSSOApp(input: $input) {
    ${SSO_APP_FIELDS}
  }
}`,
          variables: { input },
        });
        spinner.stop();
        printSuccess("SSO app updated successfully.");
        printRecord(result.updateSSOApp);
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "An unknown error occurred"
        );
        process.exitCode = 1;
      }
    }
  );

ssoCommand
  .command("delete")
  .description("Delete an SSO app")
  .argument("<id>", "SSO app ID")
  .action(async (id: string) => {
    const spinner = yoctoSpinner({ text: "Deleting SSO app..." }).start();
    try {
      const result = await graphqlRequest<{ deleteSSOApp: string }>({
        query: `mutation($input: DeleteSSOAppInput!) {
  deleteSSOApp(input: $input)
}`,
        variables: { input: { id } },
      });
      spinner.stop();
      printSuccess(`SSO app ${result.deleteSSOApp} deleted.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
