import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { graphqlRequest } from "../lib/graphql-client.js";
import {
  printError,
  printRecord,
  printSuccess,
  printTable,
} from "../lib/utils.js";

interface Plan {
  allowedDomains: string[] | null;
  applyLogicToTeamMembers: boolean | null;
  copiedToLive: boolean | null;
  description: string | null;
  icon: string | null;
  id: string;
  image: string | null;
  isPaid: boolean | null;
  limitMembers: boolean | null;
  logic: {
    addedLogic: unknown;
    removedLogic: unknown;
  } | null;
  memberCount: number | null;
  memberLimit: number | null;
  name: string;
  permissions: unknown[];
  prices: unknown[];
  priority: number | null;
  redirects: {
    afterSignup: string | null;
    afterLogin: string | null;
    afterLogout: string | null;
    afterPurchase: string | null;
    afterCancel: string | null;
    afterReplace: string | null;
    verificationRequired: string | null;
  } | null;
  restrictToAdmin: boolean | null;
  status: "ACTIVE" | "INACTIVE";
  teamAccountInviteSignupLink: string | null;
  teamAccountsEnabled: boolean | null;
  teamAccountUpgradeLink: string | null;
}

const PLAN_FIELDS = `
  id
  name
  icon
  description
  image
  status
  isPaid
  memberCount
  priority
  copiedToLive
  limitMembers
  memberLimit
  teamAccountsEnabled
  teamAccountUpgradeLink
  teamAccountInviteSignupLink
  restrictToAdmin
  applyLogicToTeamMembers
  prices {
    id
    status
    active
    amount
    interval {
      type
      count
    }
    name
    type
    description
    freeTrial {
      enabled
      days
    }
    setupFee {
      enabled
      name
      amount
    }
    expiration {
      count
      interval
    }
    currency
    memberCount
  }
  permissions {
    id
  }
  redirects {
    afterSignup
    afterLogin
    afterLogout
    afterPurchase
    afterCancel
    afterReplace
    verificationRequired
  }
  allowedDomains
  logic {
    addedLogic {
      add
      remove
      cancelRecurring
      removeAllFree
      cancelAllRecurring
    }
    removedLogic {
      add
      remove
      cancelRecurring
      removeAllFree
      cancelAllRecurring
    }
  }
`;

const collect = (value: string, previous: string[]): string[] => [
  ...previous,
  value,
];

const parseRedirects = (entries: string[]): Record<string, string> => {
  const redirects: Record<string, string> = {};
  for (const entry of entries) {
    const eqIndex = entry.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid redirect "${entry}". Expected format: key=url (e.g. afterLogin=/dashboard)`
      );
    }
    redirects[entry.slice(0, eqIndex)] = entry.slice(eqIndex + 1);
  }
  return redirects;
};

export const plansCommand = new Command("plans")
  .usage("<command> [options]")
  .description("Manage plans");

plansCommand
  .command("list")
  .description("List all plans")
  .option("--status <status>", "Filter by status (ALL, ACTIVE, INACTIVE)")
  .option("--order-by <field>", "Order by field (PRIORITY, CREATED_AT)")
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Fetching plans..." }).start();
    try {
      const input: Record<string, unknown> = {};
      if (opts.status !== undefined) {
        input.status = opts.status;
      }
      if (opts.orderBy !== undefined) {
        input.orderBy = opts.orderBy;
      }

      const result = await graphqlRequest<{ getPlans: Plan[] }>({
        query: `query($input: GetPlansInput) {
  getPlans(input: $input) {
    ${PLAN_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      const rows = (result.getPlans ?? []).map((plan) => ({
        id: plan.id,
        name: plan.name,
        status: plan.status,
        isPaid: plan.isPaid,
        memberCount: plan.memberCount,
        priority: plan.priority,
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

plansCommand
  .command("get")
  .description("Get a plan by ID")
  .argument("<id>", "Plan ID")
  .action(async (id: string) => {
    const spinner = yoctoSpinner({ text: "Fetching plan..." }).start();
    try {
      const result = await graphqlRequest<{ getPlan: Plan }>({
        query: `query($id: ID!) {
  getPlan(id: $id) {
    ${PLAN_FIELDS}
  }
}`,
        variables: { id },
      });
      spinner.stop();
      printRecord(result.getPlan);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

plansCommand
  .command("create")
  .description("Create a new plan")
  .requiredOption("--name <name>", "Plan name")
  .requiredOption("--description <description>", "Plan description")
  .option("--icon <icon>", "Plan icon")
  .option("--is-paid", "Mark plan as paid")
  .option("--team-accounts-enabled", "Enable team accounts")
  .option(
    "--team-account-invite-signup-link <url>",
    "Team account invite signup link"
  )
  .option("--team-account-upgrade-link <url>", "Team account upgrade link")
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Creating plan..." }).start();
    try {
      const input: Record<string, unknown> = {
        name: opts.name,
        description: opts.description,
      };
      if (opts.icon !== undefined) {
        input.icon = opts.icon;
      }
      if (opts.isPaid !== undefined) {
        input.isPaid = opts.isPaid;
      }
      if (opts.teamAccountsEnabled !== undefined) {
        input.teamAccountsEnabled = opts.teamAccountsEnabled;
      }
      if (opts.teamAccountInviteSignupLink !== undefined) {
        input.teamAccountInviteSignupLink = opts.teamAccountInviteSignupLink;
      }
      if (opts.teamAccountUpgradeLink !== undefined) {
        input.teamAccountUpgradeLink = opts.teamAccountUpgradeLink;
      }

      const result = await graphqlRequest<{ createPlan: Plan }>({
        query: `mutation($input: CreatePlanInput!) {
  createPlan(input: $input) {
    ${PLAN_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("Plan created successfully.");
      printRecord(result.createPlan);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

plansCommand
  .command("update")
  .description("Update a plan")
  .argument("<id>", "Plan ID")
  .option("--name <name>", "Plan name")
  .option("--description <description>", "Plan description")
  .option("--icon <icon>", "Plan icon")
  .option("--status <status>", "Plan status (ACTIVE, INACTIVE)")
  .option("--limit-members", "Enable member limit")
  .option("--no-limit-members", "Disable member limit")
  .option("--member-limit <number>", "Maximum number of members")
  .option("--team-account-upgrade-link <url>", "Team account upgrade link")
  .option(
    "--team-account-invite-signup-link <url>",
    "Team account invite signup link"
  )
  .option("--restrict-to-admin", "Restrict plan to admin")
  .option("--no-restrict-to-admin", "Remove admin restriction")
  .option(
    "--redirect <key=url>",
    "Set redirect URL (repeatable, keys: afterSignup, afterLogin, afterLogout, afterPurchase, afterCancel, afterReplace, verificationRequired)",
    collect,
    []
  )
  .option(
    "--permission-id <id>",
    "Permission ID (repeatable, replaces all permissions)",
    collect,
    []
  )
  .option(
    "--allowed-domain <email>",
    "Allowed email domain (repeatable, replaces all domains)",
    collect,
    []
  )
  .action(async (id: string, opts) => {
    const spinner = yoctoSpinner({ text: "Updating plan..." }).start();
    try {
      const input: Record<string, unknown> = { planId: id };

      if (opts.name !== undefined) {
        input.name = opts.name;
      }
      if (opts.description !== undefined) {
        input.description = opts.description;
      }
      if (opts.icon !== undefined) {
        input.icon = opts.icon;
      }
      if (opts.status !== undefined) {
        input.status = opts.status;
      }
      if (opts.limitMembers !== undefined) {
        input.limitMembers = opts.limitMembers;
      }
      if (opts.memberLimit !== undefined) {
        input.memberLimit = Number(opts.memberLimit);
      }
      if (opts.teamAccountUpgradeLink !== undefined) {
        input.teamAccountUpgradeLink = opts.teamAccountUpgradeLink;
      }
      if (opts.teamAccountInviteSignupLink !== undefined) {
        input.teamAccountInviteSignupLink = opts.teamAccountInviteSignupLink;
      }
      if (opts.restrictToAdmin !== undefined) {
        input.restrictToAdmin = opts.restrictToAdmin;
      }
      if ((opts.redirect as string[]).length > 0) {
        input.redirects = parseRedirects(opts.redirect as string[]);
      }
      if ((opts.permissionId as string[]).length > 0) {
        input.permissionIds = opts.permissionId;
      }
      if ((opts.allowedDomain as string[]).length > 0) {
        input.allowedDomains = opts.allowedDomain;
      }

      if (Object.keys(input).length === 1) {
        spinner.stop();
        printError(
          "No update options provided. Use --help to see available options."
        );
        process.exitCode = 1;
        return;
      }

      const result = await graphqlRequest<{ updatePlan: Plan }>({
        query: `mutation($input: UpdatePlanInput!) {
  updatePlan(input: $input) {
    ${PLAN_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("Plan updated successfully.");
      printRecord(result.updatePlan);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

plansCommand
  .command("delete")
  .description("Delete a plan")
  .argument("<id>", "Plan ID")
  .action(async (id: string) => {
    const spinner = yoctoSpinner({ text: "Deleting plan..." }).start();
    try {
      const result = await graphqlRequest<{ deletePlan: Plan }>({
        query: `mutation($input: DeletePlanInput!) {
  deletePlan(input: $input) {
    ${PLAN_FIELDS}
  }
}`,
        variables: { input: { planId: id } },
      });
      spinner.stop();
      printSuccess(`Plan "${result.deletePlan.name}" deleted.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

plansCommand
  .command("order")
  .description("Reorder plans by priority")
  .requiredOption(
    "--plan <planId:priority>",
    "Plan ID and priority (repeatable, e.g. --plan pln_abc:1)",
    collect,
    []
  )
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Reordering plans..." }).start();
    try {
      const orders = (opts.plan as string[]).map((entry) => {
        const colonIndex = entry.lastIndexOf(":");
        if (colonIndex === -1) {
          throw new Error(
            `Invalid format "${entry}". Expected planId:priority (e.g. pln_abc:1)`
          );
        }
        const planId = entry.slice(0, colonIndex);
        const priority = Number(entry.slice(colonIndex + 1));
        if (Number.isNaN(priority)) {
          throw new Error(
            `Invalid priority in "${entry}". Priority must be a number.`
          );
        }
        return { planId, priority };
      });

      const result = await graphqlRequest<{ orderPlans: Plan[] }>({
        query: `mutation($input: OrderPlansInput!) {
  orderPlans(input: $input) {
    ${PLAN_FIELDS}
  }
}`,
        variables: { input: { orders } },
      });
      spinner.stop();
      printSuccess("Plans reordered successfully.");
      printTable(result.orderPlans);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
