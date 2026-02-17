import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { graphqlRequest } from "../lib/graphql-client.js";
import {
  printError,
  printRecord,
  printSuccess,
  printTable,
} from "../lib/utils.js";

interface CustomField {
  id: string;
  key: string;
  label: string;
  hidden: boolean;
  visibility: "PUBLIC" | "PRIVATE";
  restrictToAdmin: boolean;
  order: number | null;
  tableHidden: boolean;
  tableOrder: number | null;
}

const CUSTOM_FIELD_FIELDS = `
  id
  key
  label
  hidden
  visibility
  restrictToAdmin
  order
  tableHidden
  tableOrder
`;

export const customFieldsCommand = new Command("custom-fields").description(
  "Manage custom fields"
);

customFieldsCommand
  .command("list")
  .description("List all custom fields")
  .action(async () => {
    const spinner = yoctoSpinner({ text: "Fetching custom fields..." }).start();
    try {
      const result = await graphqlRequest<{
        getCustomFields: CustomField[];
      }>({
        query: `query { getCustomFields { ${CUSTOM_FIELD_FIELDS} } }`,
      });
      spinner.stop();
      printTable(result.getCustomFields);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

customFieldsCommand
  .command("create")
  .description("Create a custom field")
  .requiredOption("--key <key>", "Field key")
  .requiredOption("--label <label>", "Field label")
  .option("--hidden", "Hide the field")
  .option("--visibility <visibility>", "Field visibility (PUBLIC or PRIVATE)")
  .option("--restrict-to-admin", "Restrict field to admin access")
  .option("--plan-ids <ids...>", "Plan IDs to associate with the field")
  .action(async (opts) => {
    const spinner = yoctoSpinner({ text: "Creating custom field..." }).start();
    try {
      const input: Record<string, unknown> = {
        key: opts.key,
        label: opts.label,
      };
      if (opts.hidden !== undefined) {
        input.hidden = opts.hidden;
      }
      if (opts.visibility !== undefined) {
        input.visibility = opts.visibility;
      }
      if (opts.restrictToAdmin !== undefined) {
        input.restrictToAdmin = opts.restrictToAdmin;
      }
      if (opts.planIds !== undefined) {
        input.planIds = opts.planIds;
      }

      const result = await graphqlRequest<{
        createCustomField: CustomField;
      }>({
        query: `mutation($input: CreateCustomFieldInput!) {
  createCustomField(input: $input) {
    ${CUSTOM_FIELD_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("Custom field created successfully.");
      printRecord(result.createCustomField);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

customFieldsCommand
  .command("update")
  .description("Update a custom field")
  .argument("<id>", "Custom field ID")
  .requiredOption("--label <label>", "Field label")
  .option("--hidden", "Hide the field")
  .option("--no-hidden", "Show the field")
  .option("--table-hidden", "Hide the field from the table")
  .option("--no-table-hidden", "Show the field in the table")
  .option("--visibility <visibility>", "Field visibility (PUBLIC or PRIVATE)")
  .option("--restrict-to-admin", "Restrict field to admin access")
  .option("--no-restrict-to-admin", "Remove admin restriction")
  .action(async (id: string, opts) => {
    const spinner = yoctoSpinner({ text: "Updating custom field..." }).start();
    try {
      const input: Record<string, unknown> = {
        customFieldId: id,
        label: opts.label,
      };
      if (opts.hidden !== undefined) {
        input.hidden = opts.hidden;
      }
      if (opts.tableHidden !== undefined) {
        input.tableHidden = opts.tableHidden;
      }
      if (opts.visibility !== undefined) {
        input.visibility = opts.visibility;
      }
      if (opts.restrictToAdmin !== undefined) {
        input.restrictToAdmin = opts.restrictToAdmin;
      }

      const result = await graphqlRequest<{
        updateCustomField: CustomField;
      }>({
        query: `mutation($input: UpdateCustomFieldInput!) {
  updateCustomField(input: $input) {
    ${CUSTOM_FIELD_FIELDS}
  }
}`,
        variables: { input },
      });
      spinner.stop();
      printSuccess("Custom field updated successfully.");
      printRecord(result.updateCustomField);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });

customFieldsCommand
  .command("delete")
  .description("Delete a custom field")
  .argument("<id>", "Custom field ID")
  .action(async (id: string) => {
    const spinner = yoctoSpinner({ text: "Deleting custom field..." }).start();
    try {
      const result = await graphqlRequest<{ deleteCustomField: string }>({
        query: `mutation($input: DeleteCustomFieldInput!) {
  deleteCustomField(input: $input)
}`,
        variables: { input: { customFieldId: id } },
      });
      spinner.stop();
      printSuccess(`Custom field ${result.deleteCustomField} deleted.`);
    } catch (error) {
      spinner.stop();
      printError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
      process.exitCode = 1;
    }
  });
