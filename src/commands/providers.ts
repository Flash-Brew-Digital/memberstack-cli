import { Command, Option } from "commander";
import yoctoSpinner from "yocto-spinner";
import { graphqlRequest } from "../lib/graphql-client.js";
import {
  printError,
  printRecord,
  printSuccess,
  printTable,
} from "../lib/utils.js";

interface AuthProviderConfig {
  clientId: string | null;
  enabled: boolean;
  id: string;
  name: string;
  provider: string;
  providerType: string;
}

const PROVIDER_FIELDS = `
  id
  providerType
  name
  provider
  enabled
  clientId
`;

const PROVIDER_TYPES = [
  "GOOGLE",
  "FACEBOOK",
  "GITHUB",
  "LINKEDIN",
  "SPOTIFY",
  "DRIBBBLE",
];

export const providersCommand = new Command("providers")
  .usage("<command> [options]")
  .description("Manage auth providers (e.g. Google)");

providersCommand
  .command("list")
  .description("List configured auth providers")
  .action(async () => {
    const spinner = yoctoSpinner({
      text: "Fetching providers...",
    }).start();
    try {
      const result = await graphqlRequest<{
        getSSOClients: AuthProviderConfig[];
      }>({
        query: `query { getSSOClients { ${PROVIDER_FIELDS} } }`,
      });
      spinner.stop();
      const rows = result.getSSOClients.map((p) => ({
        id: p.id,
        type: p.providerType,
        name: p.name,
        enabled: p.enabled,
        clientId: p.clientId ?? "",
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

providersCommand
  .command("configure")
  .description("Configure an auth provider")
  .addOption(
    new Option("--type <type>", "Provider type")
      .choices(PROVIDER_TYPES)
      .makeOptionMandatory()
  )
  .option("--name <name>", "Display name")
  .option("--client-id <id>", "OAuth client ID")
  .option("--client-secret <secret>", "OAuth client secret")
  .addOption(
    new Option("--status <status>", "Provider status")
      .choices(["enabled", "disabled"])
      .makeOptionMandatory(false)
  )
  .action(
    async (opts: {
      type: string;
      name?: string;
      clientId?: string;
      clientSecret?: string;
      status?: "enabled" | "disabled";
    }) => {
      const isEnabling = opts.status === "enabled";
      const hasClientId = Boolean(opts.clientId);
      const hasClientSecret = Boolean(opts.clientSecret);

      if (isEnabling && !(hasClientId && hasClientSecret)) {
        printError(
          "--status enabled requires both --client-id and --client-secret"
        );
        process.exitCode = 1;
        return;
      }

      const spinner = yoctoSpinner({
        text: "Configuring provider...",
      }).start();
      try {
        const input: Record<string, unknown> = {
          provider: opts.type.toLowerCase(),
        };
        if (opts.name) {
          input.name = opts.name;
        }
        if (opts.clientId) {
          input.clientId = opts.clientId;
        }
        if (opts.clientSecret) {
          input.clientSecret = opts.clientSecret;
        }
        if (opts.status !== undefined) {
          input.enabled = opts.status === "enabled";
        }

        const result = await graphqlRequest<{
          updateSSOClient: AuthProviderConfig;
        }>({
          query: `mutation($input: UpdateSSOClientInput!) {
  updateSSOClient(input: $input) {
    ${PROVIDER_FIELDS}
  }
}`,
          variables: { input },
        });
        spinner.stop();
        printSuccess(`Provider "${opts.type}" configured.`);
        printRecord({
          id: result.updateSSOClient.id,
          type: result.updateSSOClient.providerType,
          name: result.updateSSOClient.name,
          enabled: result.updateSSOClient.enabled,
          clientId: result.updateSSOClient.clientId ?? "",
        });
      } catch (error) {
        spinner.stop();
        printError(
          error instanceof Error ? error.message : "An unknown error occurred"
        );
        process.exitCode = 1;
      }
    }
  );

providersCommand
  .command("remove")
  .description("Remove an auth provider")
  .argument("<id>", "Provider config ID")
  .action(async (id: string) => {
    const spinner = yoctoSpinner({
      text: "Removing provider...",
    }).start();
    try {
      await graphqlRequest<{ removeSSOClient: string }>({
        query: `mutation($input: RemoveSSOClientInput!) {
  removeSSOClient(input: $input)
}`,
        variables: { input: { id } },
      });
      spinner.stop();
      printSuccess(`Provider "${id}" removed.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
