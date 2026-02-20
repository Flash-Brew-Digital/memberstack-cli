import { Command, Option } from "commander";
import yoctoSpinner from "yocto-spinner";
import { graphqlRequest } from "../lib/graphql-client.js";
import { printError, printRecord, printSuccess } from "../lib/utils.js";

interface Price {
  active: boolean;
  amount: number;
  currency: string;
  id: string;
  memberCount: number | null;
  name: string | null;
  status: string;
  type: string;
}

const PRICE_FIELDS = `
  id
  name
  status
  active
  amount
  type
  currency
  memberCount
`;

const PRICE_TYPES = ["SUBSCRIPTION", "ONETIME"];
const INTERVAL_TYPES = ["YEARLY", "MONTHLY", "WEEKLY"];
const EXPIRATION_INTERVALS = ["MONTHS", "DAYS"];

const parseNumber = (value: string): number => {
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid number: ${value}`);
  }
  return num;
};

export const pricesCommand = new Command("prices")
  .usage("<command> [options]")
  .description("Manage prices for plans");

pricesCommand
  .command("create")
  .description("Create a price for a plan")
  .requiredOption("--plan-id <id>", "Plan ID to add the price to")
  .requiredOption("--name <name>", "Price name")
  .requiredOption("--amount <amount>", "Price amount", parseNumber)
  .addOption(
    new Option("--type <type>", "Price type")
      .choices(PRICE_TYPES)
      .makeOptionMandatory()
  )
  .option("--currency <currency>", "Currency code (e.g. USD, EUR, GBP)", "usd")
  .addOption(
    new Option("--interval-type <type>", "Billing interval").choices(
      INTERVAL_TYPES
    )
  )
  .option(
    "--interval-count <count>",
    "Number of intervals between billings",
    parseNumber
  )
  .option("--setup-fee-amount <amount>", "Setup fee amount", parseNumber)
  .option("--setup-fee-name <name>", "Setup fee name")
  .option("--setup-fee-enabled", "Enable setup fee")
  .option("--free-trial-enabled", "Enable free trial")
  .option("--free-trial-requires-card", "Require card for free trial")
  .option(
    "--free-trial-days <days>",
    "Free trial duration in days",
    parseNumber
  )
  .option("--expiration-count <count>", "Expiration count", parseNumber)
  .addOption(
    new Option(
      "--expiration-interval <interval>",
      "Expiration interval"
    ).choices(EXPIRATION_INTERVALS)
  )
  .option("--cancel-at-period-end", "Cancel at period end")
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Creating price..." }).start();
    try {
      const input: Record<string, unknown> = {
        planId: opts.planId,
        name: opts.name,
        amount: opts.amount,
        type: opts.type,
        currency: opts.currency,
      };
      if (opts.intervalType) {
        input.intervalType = opts.intervalType;
      }
      if (opts.intervalCount !== undefined) {
        input.intervalCount = opts.intervalCount;
      }
      if (opts.setupFeeAmount !== undefined) {
        input.setupFeeAmount = opts.setupFeeAmount;
      }
      if (opts.setupFeeName) {
        input.setupFeeName = opts.setupFeeName;
      }
      if (opts.setupFeeEnabled) {
        input.setupFeeEnabled = true;
      }
      if (opts.freeTrialEnabled) {
        input.freeTrialEnabled = true;
      }
      if (opts.freeTrialRequiresCard) {
        input.freeTrialRequiresCard = true;
      }
      if (opts.freeTrialDays !== undefined) {
        input.freeTrialDays = opts.freeTrialDays;
      }
      if (opts.expirationCount !== undefined) {
        input.expirationCount = opts.expirationCount;
      }
      if (opts.expirationInterval) {
        input.expirationInterval = opts.expirationInterval;
      }
      if (opts.cancelAtPeriodEnd) {
        input.cancelAtPeriodEnd = true;
      }

      const result = await graphqlRequest<{ createPrice: Price }>({
        query: `mutation($input: CreatePriceInput!) {
  createPrice(input: $input) {
    ${PRICE_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("Price created successfully.");
      printRecord(result.createPrice);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

pricesCommand
  .command("update")
  .description("Update a price")
  .argument("<priceId>", "Price ID to update")
  .option("--name <name>", "Price name")
  .option("--amount <amount>", "Price amount", parseNumber)
  .addOption(new Option("--type <type>", "Price type").choices(PRICE_TYPES))
  .option("--currency <currency>", "Currency code")
  .addOption(
    new Option("--interval-type <type>", "Billing interval").choices(
      INTERVAL_TYPES
    )
  )
  .option(
    "--interval-count <count>",
    "Number of intervals between billings",
    parseNumber
  )
  .option("--setup-fee-amount <amount>", "Setup fee amount", parseNumber)
  .option("--setup-fee-name <name>", "Setup fee name")
  .option("--setup-fee-enabled", "Enable setup fee")
  .option("--no-setup-fee-enabled", "Disable setup fee")
  .option("--free-trial-enabled", "Enable free trial")
  .option("--no-free-trial-enabled", "Disable free trial")
  .option("--free-trial-requires-card", "Require card for free trial")
  .option(
    "--free-trial-days <days>",
    "Free trial duration in days",
    parseNumber
  )
  .option("--expiration-count <count>", "Expiration count", parseNumber)
  .addOption(
    new Option(
      "--expiration-interval <interval>",
      "Expiration interval"
    ).choices(EXPIRATION_INTERVALS)
  )
  .option("--cancel-at-period-end", "Cancel at period end")
  .option("--no-cancel-at-period-end", "Do not cancel at period end")
  .action(async (priceId: string, opts) => {
    const input: Record<string, unknown> = { priceId };
    if (opts.name) {
      input.name = opts.name;
    }
    if (opts.amount !== undefined) {
      input.amount = opts.amount;
    }
    if (opts.type) {
      input.type = opts.type;
    }
    if (opts.currency) {
      input.currency = opts.currency;
    }
    if (opts.intervalType) {
      input.intervalType = opts.intervalType;
    }
    if (opts.intervalCount !== undefined) {
      input.intervalCount = opts.intervalCount;
    }
    if (opts.setupFeeAmount !== undefined) {
      input.setupFeeAmount = opts.setupFeeAmount;
    }
    if (opts.setupFeeName) {
      input.setupFeeName = opts.setupFeeName;
    }
    if (opts.setupFeeEnabled !== undefined) {
      input.setupFeeEnabled = opts.setupFeeEnabled;
    }
    if (opts.freeTrialEnabled !== undefined) {
      input.freeTrialEnabled = opts.freeTrialEnabled;
    }
    if (opts.freeTrialRequiresCard) {
      input.freeTrialRequiresCard = true;
    }
    if (opts.freeTrialDays !== undefined) {
      input.freeTrialDays = opts.freeTrialDays;
    }
    if (opts.expirationCount !== undefined) {
      input.expirationCount = opts.expirationCount;
    }
    if (opts.expirationInterval) {
      input.expirationInterval = opts.expirationInterval;
    }
    if (opts.cancelAtPeriodEnd !== undefined) {
      input.cancelAtPeriodEnd = opts.cancelAtPeriodEnd;
    }

    if (Object.keys(input).length <= 1) {
      printError(
        "No update options provided. Use --help to see available options."
      );
      process.exitCode = 1;
      return;
    }

    const spinner = yoctoSpinner({ text: "Updating price..." }).start();
    try {
      const result = await graphqlRequest<{ updatePrice: Price }>({
        query: `mutation($input: UpdatePriceInput!) {
  updatePrice(input: $input) {
    ${PRICE_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("Price updated successfully.");
      printRecord(result.updatePrice);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

pricesCommand
  .command("activate")
  .description("Reactivate a price")
  .argument("<priceId>", "Price ID to reactivate")
  .action(async (priceId: string) => {
    const spinner = yoctoSpinner({ text: "Reactivating price..." }).start();
    try {
      const result = await graphqlRequest<{ reactivatePrice: Price }>({
        query: `mutation($input: ReactivatePriceInput!) {
  reactivatePrice(input: $input) {
    ${PRICE_FIELDS}
  }
}`,
        variables: { input: { priceId } },
      });
      spinner.stop();
      printSuccess("Price reactivated.");
      printRecord(result.reactivatePrice);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

pricesCommand
  .command("deactivate")
  .description("Deactivate a price")
  .argument("<priceId>", "Price ID to deactivate")
  .action(async (priceId: string) => {
    const spinner = yoctoSpinner({ text: "Deactivating price..." }).start();
    try {
      const result = await graphqlRequest<{ deactivatePrice: Price }>({
        query: `mutation($input: DeactivatePriceInput!) {
  deactivatePrice(input: $input) {
    ${PRICE_FIELDS}
  }
}`,
        variables: { input: { priceId } },
      });
      spinner.stop();
      printSuccess("Price deactivated.");
      printRecord(result.deactivatePrice);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

pricesCommand
  .command("delete")
  .description("Delete a price")
  .argument("<priceId>", "Price ID to delete")
  .action(async (priceId: string) => {
    const spinner = yoctoSpinner({ text: "Deleting price..." }).start();
    try {
      const result = await graphqlRequest<{ deletePrice: Price }>({
        query: `mutation($input: DeletePriceInput!) {
  deletePrice(input: $input) {
    ${PRICE_FIELDS}
  }
}`,
        variables: { input: { priceId } },
      });
      spinner.stop();
      printSuccess(`Price "${result.deletePrice.id}" deleted.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
