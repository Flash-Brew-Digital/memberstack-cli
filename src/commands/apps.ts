import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { graphqlRequest } from "../lib/graphql-client.js";
import { printError, printRecord, printSuccess } from "../lib/utils.js";

interface App {
  id: string;
  name: string;
  slug: string | null;
  status: "ACTIVE" | "DELETED";
  stack: "REACT" | "WEBFLOW" | "VANILLA" | "WORDPRESS" | null;
  createdAt: string;
  deletedAt: string | null;
  image: string | null;
  captchaEnabled: boolean | null;
  preventDisposableEmails: boolean | null;
  requireUser2FA: boolean | null;
  disableConcurrentLogins: boolean | null;
  memberSessionDurationDays: number | null;
  allowMemberSelfDelete: boolean | null;
}

const APP_FIELDS = `
  id
  name
  slug
  status
  stack
  createdAt
  deletedAt
  image
  captchaEnabled
  preventDisposableEmails
  requireUser2FA
  disableConcurrentLogins
  memberSessionDurationDays
  allowMemberSelfDelete
`;

export const appsCommand = new Command("apps").description("Manage apps");

appsCommand
  .command("current")
  .description("Show the current app")
  .action(async () => {
    const spinner = yoctoSpinner({ text: "Fetching current app..." }).start();
    try {
      const result = await graphqlRequest<{ currentApp: App }>({
        query: `query { currentApp { ${APP_FIELDS} } }`,
      });
      spinner.stop();
      printRecord(result.currentApp);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

appsCommand
  .command("create")
  .description("Create a new app")
  .requiredOption("--name <name>", "App name")
  .requiredOption(
    "--stack <stack>",
    "Tech stack (REACT, WEBFLOW, VANILLA, WORDPRESS)"
  )
  .option(
    "--wordpress-page-builder <builder>",
    "WordPress page builder (GUTENBERG, ELEMENTOR, DIVI, BEAVER_BUILDER, BRICKS, CORNERSTONE, OTHER)"
  )
  .option("--template-id <templateId>", "Template ID to use")
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Creating app..." }).start();
    try {
      const input: Record<string, unknown> = {
        name: opts.name,
        stack: opts.stack,
      };
      if (opts.wordpressPageBuilder !== undefined) {
        input.wordpressPageBuilder = opts.wordpressPageBuilder;
      }
      if (opts.templateId !== undefined) {
        input.templateId = opts.templateId;
      }

      const result = await graphqlRequest<{ createApp: App }>({
        query: `mutation($input: CreateAppInput!) {
  createApp(input: $input) {
    ${APP_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("App created successfully.");
      printRecord(result.createApp);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

appsCommand
  .command("update")
  .description("Update the current app")
  .option("--name <name>", "App name")
  .option("--stack <stack>", "Tech stack (REACT, WEBFLOW, VANILLA, WORDPRESS)")
  .option("--status <status>", "App status (ACTIVE, DELETED)")
  .option(
    "--wordpress-page-builder <builder>",
    "WordPress page builder (GUTENBERG, ELEMENTOR, DIVI, BEAVER_BUILDER, BRICKS, CORNERSTONE, OTHER)"
  )
  .option("--business-entity-name <name>", "Business entity name")
  .option("--terms-of-service-url <url>", "Terms of service URL")
  .option("--privacy-policy-url <url>", "Privacy policy URL")
  .option("--prevent-disposable-emails", "Prevent disposable emails")
  .option("--no-prevent-disposable-emails", "Allow disposable emails")
  .option("--captcha-enabled", "Enable captcha")
  .option("--no-captcha-enabled", "Disable captcha")
  .option("--require-user-2fa", "Require user 2FA")
  .option("--no-require-user-2fa", "Disable required 2FA")
  .option("--disable-concurrent-logins", "Disable concurrent logins")
  .option("--no-disable-concurrent-logins", "Allow concurrent logins")
  .option(
    "--member-session-duration-days <days>",
    "Member session duration in days"
  )
  .option("--allow-member-self-delete", "Allow members to self-delete")
  .option("--no-allow-member-self-delete", "Prevent member self-deletion")
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Updating app..." }).start();
    try {
      const input: Record<string, unknown> = {};

      if (opts.name !== undefined) {
        input.name = opts.name;
      }
      if (opts.stack !== undefined) {
        input.stack = opts.stack;
      }
      if (opts.status !== undefined) {
        input.status = opts.status;
      }
      if (opts.wordpressPageBuilder !== undefined) {
        input.wordpressPageBuilder = opts.wordpressPageBuilder;
      }
      if (opts.businessEntityName !== undefined) {
        input.businessEntityName = opts.businessEntityName;
      }
      if (opts.termsOfServiceUrl !== undefined) {
        input.termsOfServiceURL = opts.termsOfServiceUrl;
      }
      if (opts.privacyPolicyUrl !== undefined) {
        input.privacyPolicyURL = opts.privacyPolicyUrl;
      }
      if (opts.preventDisposableEmails !== undefined) {
        input.preventDisposableEmails = opts.preventDisposableEmails;
      }
      if (opts.captchaEnabled !== undefined) {
        input.captchaEnabled = opts.captchaEnabled;
      }
      if (opts.requireUser2fa !== undefined) {
        input.requireUser2FA = opts.requireUser2fa;
      }
      if (opts.disableConcurrentLogins !== undefined) {
        input.disableConcurrentLogins = opts.disableConcurrentLogins;
      }
      if (opts.memberSessionDurationDays !== undefined) {
        input.memberSessionDurationDays = Number(
          opts.memberSessionDurationDays
        );
      }
      if (opts.allowMemberSelfDelete !== undefined) {
        input.allowMemberSelfDelete = opts.allowMemberSelfDelete;
      }

      if (Object.keys(input).length === 0) {
        spinner.stop();
        printError(
          "No update options provided. Use --help to see available options."
        );
        process.exitCode = 1;
        return;
      }

      const result = await graphqlRequest<{ updateApp: App }>({
        query: `mutation($input: UpdateAppInput!) {
  updateApp(input: $input) {
    ${APP_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("App updated successfully.");
      printRecord(result.updateApp);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

appsCommand
  .command("delete")
  .description("Delete an app")
  .requiredOption("--app-id <appId>", "App ID to delete")
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Deleting app..." }).start();
    try {
      const result = await graphqlRequest<{ deleteApp: App }>({
        query: `mutation($input: DeleteAppInput!) {
  deleteApp(input: $input) {
    ${APP_FIELDS}
  }
}`,
        variables: { input: { appId: opts.appId } },
      });
      spinner.stop();
      printSuccess(`App "${result.deleteApp.name}" deleted.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

appsCommand
  .command("restore")
  .description("Restore a deleted app")
  .requiredOption("--app-id <appId>", "App ID to restore")
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Restoring app..." }).start();
    try {
      const result = await graphqlRequest<{ restoreApp: App }>({
        query: `mutation($input: RestoreAppInput!) {
  restoreApp(input: $input) {
    ${APP_FIELDS}
  }
}`,
        variables: { input: { appId: opts.appId } },
      });
      spinner.stop();
      printSuccess(`App "${result.restoreApp.name}" restored.`);
      printRecord(result.restoreApp);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
